// Validate the real static URL in an isolated browser, without QA commands.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const url=process.env.TEST_URL||'http://127.0.0.1:4173/bananza-gpt/';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
page.setDefaultTimeout(90000);
const errors=[],failedRequests=[],assets=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
page.on('response',r=>{if(['script','stylesheet'].includes(r.request().resourceType()))assets.push({url:r.url(),status:r.status()});});
const report={url,startedAt:new Date().toISOString()};
const state=()=>page.evaluate(()=>window.__game.state);
await fs.mkdir('test-output',{recursive:true});
try{
  const response=await page.goto(url,{waitUntil:'networkidle',timeout:90000});
  report.httpStatus=response.status();assert.equal(response.status(),200);
  await page.waitForFunction(()=>window.__game?.state?.triangles>0);
  assert.ok(await page.locator('#playBtn').isVisible());
  assert.equal(await page.evaluate(()=>typeof window.__game.teleport),'undefined');
  report.initial=await state();
  await page.screenshot({path:'test-output/deployment-title.png'});
  await page.locator('#playBtn').click();await page.waitForTimeout(800);
  const before=await state();
  await page.keyboard.down('KeyW');await page.waitForTimeout(1000);await page.keyboard.up('KeyW');
  const moved=await state();assert.ok(Math.hypot(moved.position[0]-before.position[0],moved.position[2]-before.position[2])>1);
  await page.keyboard.down('Space');await page.waitForTimeout(220);
  const jumping=await state();assert.ok(jumping.position[1]>moved.position[1]+.3);
  await page.keyboard.up('Space');await page.waitForTimeout(1100);
  await page.keyboard.press('KeyE');await page.waitForTimeout(1000);
  const dug=await state();assert.ok(dug.edits>0&&dug.dug>0);
  report.input={before,moved,jumping,dug};
  await page.keyboard.press('Tab');assert.ok(await page.locator('#map').isVisible());await page.keyboard.press('Tab');
  await page.keyboard.press('KeyH');assert.ok(await page.locator('#help').isVisible());await page.locator('#closeHelp').click();
  await page.keyboard.press('KeyR');await page.waitForTimeout(600);
  const savedEdits=(await state()).edits;
  await page.screenshot({path:'test-output/deployment-play.png'});
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__game?.state?.edits>0);
  report.reloaded=await state();assert.equal(report.reloaded.edits,savedEdits);
  assert.ok(assets.length>=2&&assets.every(a=>a.status===200&&new URL(a.url).pathname.startsWith('/bananza-gpt/assets/')));
  assert.deepEqual(failedRequests,[]);assert.deepEqual(errors,[]);
  report.result='PASS: HTTP/assets/render/movement/jump/excavation/map/help/retry/save-reload';
}catch(e){report.result='FAIL';report.error=e.stack;process.exitCode=1;await page.screenshot({path:'test-output/deployment-failure.png'}).catch(()=>{});}
report.assets=assets;report.failedRequests=failedRequests;report.runtimeErrors=errors;report.finishedAt=new Date().toISOString();
await fs.writeFile('test-output/deployment.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));await browser.close();
