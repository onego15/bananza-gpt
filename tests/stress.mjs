import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));
const log=(name,value)=>{console.log(name,JSON.stringify(value));results.push({name,value});};
const state=()=>page.evaluate(()=>window.__game.state),sleep=ms=>page.waitForTimeout(ms);
try{
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:4173/bananza-gpt/')+'?qa');await page.waitForFunction(()=>window.__game?.state?.edits===0);await page.locator('#playBtn').click();await sleep(800);
  const ground=await page.evaluate(()=>window.__game.ground(4,13,5));
  await page.evaluate(y=>window.__game.teleport(4,y+.04,13,Math.PI),ground);await sleep(450);
  const before=await page.evaluate(y=>window.__game.sample(4,y-1,12.65),ground);
  await page.keyboard.down('KeyE');await sleep(300);await page.keyboard.up('KeyE');await sleep(700);
  const after=await page.evaluate(y=>window.__game.sample(4,y-1,12.65),ground);assert.ok(before>0&&after<0);log('floor excavation',{before,after,state:await state()});
  await sleep(800);await page.evaluate(()=>window.__game.teleport(0,15,8,Math.PI));const cBefore=await page.evaluate(()=>window.__game.sample(0,19.5,6));await page.keyboard.press('KeyK');await sleep(180);const cAfter=await page.evaluate(()=>window.__game.sample(0,19.5,6));log('ceiling excavation',{before:cBefore,after:cAfter});assert.ok(cBefore>0&&cAfter<0);
  await page.keyboard.press('KeyR');await sleep(700);const respawned=await state();assert.ok(Math.abs(respawned.position[0])<3&&respawned.position[2]>16);log('retry',respawned.position);
  const cutsBefore=(await state()).dug;await page.keyboard.down('Space');await sleep(280);await page.keyboard.up('Space');await page.keyboard.press('KeyE');await sleep(1100);const slammed=await state();assert.ok(slammed.dug>cutsBefore);log('air slam',{before:cutsBefore,after:slammed.dug});
  const gy=await page.evaluate(()=>window.__game.ground(20,2,5));await page.evaluate(y=>window.__game.teleport(20,y+.1,2,Math.PI/2),gy);await sleep(350);await page.keyboard.down('KeyW');await page.keyboard.down('KeyJ');await sleep(1700);await page.keyboard.up('KeyW');await page.keyboard.up('KeyJ');await sleep(500);const angled=await state();assert.ok(angled.position[0]>24);assert.ok(Math.hypot(...angled.position.map((v,i)=>v-angled.camera[i]))>4);log('oblique tunnel and camera',angled);
  const burst=await page.evaluate(()=>{let n=0;for(let i=0;i<250;i++){const x=-22+(i%15)*3,z=23-Math.floor(i/15)*6,y=z>-15?-1:z>-50?-8:-14;n+=window.__game.carve(x,y,z,1.5+(i%3)*.2);}return n;});
  await page.waitForFunction(()=>window.__game.state.dirtyChunks===0,{timeout:60000});await page.evaluate(()=>{const g=window.__game;g.teleport(0,g.ground(0,20,5)+.1,20,Math.PI);g.setCamera(0,.36,8.3);});await sleep(1200);
  const frameTimes=await page.evaluate(()=>new Promise(resolve=>{const times=[];let last=performance.now();function tick(t){times.push(t-last);last=t;if(times.length<180)requestAnimationFrame(tick);else resolve(times.slice(1));}requestAnimationFrame(tick);}));
  const sorted=[...frameTimes].sort((a,b)=>a-b),fps=1000/(frameTimes.reduce((a,b)=>a+b)/frameTimes.length);log('250-cut stress',{removedSamples:burst,fps,p95FrameMs:sorted[Math.floor(sorted.length*.95)],state:await state()});assert.ok(fps>25);
  const sample=await page.evaluate(()=>window.__game.sample(4,-1,13)),edits=(await state()).edits;await page.evaluate(()=>window.__game.save());
  for(let i=0;i<2;i++){await page.reload();await page.waitForFunction(()=>window.__game?.state?.edits>0);assert.equal((await state()).edits,edits);assert.ok(Math.abs((await page.evaluate(()=>window.__game.sample(4,-1,13)))-sample)<.01);await page.evaluate(()=>window.__game.save());}
  log('two reloads preserve all edits',{edits,sample});
  await page.locator('#playBtn').click();await page.evaluate(()=>window.__game.teleport(0,-24,-30));await sleep(1800);const recovered=await state();const bodyDensity=await page.evaluate(p=>window.__game.sample(p[0],p[1]+1,p[2]),recovered.position);assert.ok(recovered.position[1]>-22&&bodyDensity<.2);log('bedrock recovery',{position:recovered.position,bodyDensity});
  await page.keyboard.press('KeyR');await sleep(700);assert.ok((await state()).position[1]>-1);log('excavated checkpoint remains safe',(await state()).position);
  await page.keyboard.press('Tab');assert.ok(await page.locator('#map').isVisible());await page.keyboard.press('Tab');await page.keyboard.press('KeyH');assert.ok(await page.locator('#help').isVisible());await page.locator('#closeHelp').click();log('map and guide','PASS');
  await page.evaluate(()=>{const g=window.__game;g.teleport(-12,g.ground(-12,5,6)+.1,5,Math.PI);});await sleep(400);
  for(let i=0;i<3;i++){await page.keyboard.press('KeyE');await sleep(700);}await page.keyboard.down('KeyW');await sleep(750);await page.keyboard.up('KeyW');await sleep(700);await page.evaluate(()=>window.__game.save());
  const treasure=await page.evaluate(()=>JSON.parse(localStorage.getItem('underbloom-v2')).treasures);log('hidden chamber treasure',{treasure,state:await state()});assert.equal(treasure[0],true);
  assert.equal(errors.length,0);log('runtime errors',errors);log('assertions','PASS');
}catch(e){log('FAIL',e.stack);await page.screenshot({path:'test-output/stress-failure.png'});process.exitCode=1;}
await fs.writeFile('test-output/stress.json',JSON.stringify(results,null,2));await browser.close();
