// Captures actual rendered gameplay and HUD. No synthesized gameplay images.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const dir='test-output/recording';await fs.mkdir(dir,{recursive:true});await fs.mkdir('docs',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800},recordVideo:{dir:'test-output/video',size:{width:1280,height:800}}}),video=page.video(),videoStart=performance.now();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto((process.env.TEST_URL||'http://127.0.0.1:4173/bananza-gpt/')+'?qa');await page.waitForFunction(()=>window.__game?.state.edits===0);await page.waitForTimeout(1000);await page.screenshot({path:'docs/title.png'});await page.locator('#playBtn').click();await page.waitForTimeout(6500);
// Select the excavation site before recording; every action in the clip is live input.
await page.evaluate(()=>{const g=window.__game;g.teleport(-8,g.ground(-8,3,6)+.08,3,Math.PI);g.setCamera(0,.32,8.3);});await page.waitForTimeout(700);
const begin=performance.now();
const startOffset=(begin-videoStart)/1000;
const wait=ms=>page.waitForTimeout(ms);
async function action(keys,ms){for(const k of keys)await page.keyboard.down(k);await wait(ms);for(const k of keys)await page.keyboard.up(k);}
await action(['KeyW','KeyJ'],4500);await action(['KeyJ'],1400);await action(['Space','KeyW'],400);await action(['KeyK'],500);await action(['KeyL'],1400);await wait(350);await action(['KeyE'],200);await wait(700);await action(['KeyE'],200);await action(['KeyD','KeyW','KeyJ'],1800);await action(['KeyQ'],500);await wait(1200);
const remaining=14000-(performance.now()-begin);if(remaining>0)await wait(remaining);
const final=await page.evaluate(()=>window.__game.state);if(final.dug<30)throw new Error('Recording did not include enough actual excavation');await fs.writeFile(`${dir}/recording.json`,JSON.stringify({duration:14000,startOffset,method:'Playwright native page video, actual keyboard play and HUD; camera and starting position selected before recording',errors,final},null,2));console.log(JSON.stringify({duration:14000,startOffset,final,errors}));
await page.evaluate(()=>{const g=window.__game;g.teleport(1,g.ground(1,18,6)+.1,18,0);g.setCamera(0,.23,6);});await wait(1200);await page.screenshot({path:'docs/ruu.png'});
await page.evaluate(()=>{const g=window.__game;g.teleport(0,g.ground(0,-25,1)+.1,-25,Math.PI);g.setCamera(.3,.3,9);});await wait(1400);await page.screenshot({path:'docs/grotto.png'});
await page.evaluate(()=>{const g=window.__game;g.teleport(-4,g.ground(-4,-61,-5)+.1,-61,Math.PI);g.setCamera(.12,.3,9);});await wait(1400);await page.screenshot({path:'docs/sanctum.png'});
await browser.close();
await fs.copyFile(await video.path(),`${dir}/gameplay.webm`);
