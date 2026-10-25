import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(60000);
await page.goto((process.env.TEST_URL||'http://127.0.0.1:4173/bananza-gpt/')+'?qa');await page.waitForFunction(()=>window.__game?.state.edits===0);await page.locator('#playBtn').click();
await page.evaluate(()=>{const g=window.__game;for(let i=0;i<250;i++){const x=-22+(i%15)*3,z=23-Math.floor(i/15)*6,y=z>-15?-1:z>-50?-8:-14;g.carve(x,y,z,1.5+(i%3)*.2);}g.teleport(0,g.ground(0,19.6,5)+.1,19.6,Math.PI);g.setCamera(0,.36,8.3);});
await page.waitForFunction(()=>window.__game.state.dirtyChunks===0);await page.waitForTimeout(1500);
async function measure(){const times=await page.evaluate(()=>new Promise(resolve=>{const a=[];let last=performance.now();function frame(t){a.push(t-last);last=t;if(a.length<120)requestAnimationFrame(frame);else resolve(a.slice(1));}requestAnimationFrame(frame);}));const sorted=[...times].sort((a,b)=>a-b);return {fps:1000/(times.reduce((a,b)=>a+b)/times.length),p95FrameMs:sorted[Math.floor(sorted.length*.95)],state:await page.evaluate(()=>window.__game.state)};}
const high=await measure();console.log('High',JSON.stringify({fps:high.fps,p95FrameMs:high.p95FrameMs}));
await page.keyboard.press('Escape');await page.waitForTimeout(150);if(!await page.locator('#menu').isVisible())await page.keyboard.press('Escape');await page.locator('#qualityBtn').click();await page.locator('#playBtn').click();await page.waitForTimeout(1500);
const light=await measure();console.log('Light',JSON.stringify({fps:light.fps,p95FrameMs:light.p95FrameMs}));
await fs.writeFile('docs/qa-quality.json',JSON.stringify({conditions:'1280x800, DPR1, 250 CSG edits, same cavern camera, 119 RAF frame intervals per setting; high then light, no screenshot while measuring',high,light},null,2));await browser.close();
