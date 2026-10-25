// Test only: an isolated Chromium profile. Navigation uses the game's keyboard controls.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],report=[];
page.on('pageerror',e=>errors.push(e.message));
const log=(name,data)=>{console.log(name,JSON.stringify(data));report.push({name,data});};
const state=()=>page.evaluate(()=>window.__game.state);
let held=new Set();
async function hold(keys){const next=new Set(keys);for(const k of held)if(!next.has(k))await page.keyboard.up(k);for(const k of next)if(!held.has(k))await page.keyboard.down(k);held=next;}
async function wait(ms){await page.waitForTimeout(ms);}
async function walkTo(x,z,{attack=false,timeout=18000,tolerance=.9}={}){
  const end=Date.now()+timeout;let last=null,stuck=0;
  while(Date.now()<end){const s=await state(),[px,py,pz]=s.position,dx=x-px,dz=z-pz;if(Math.hypot(dx,dz)<tolerance){await hold([]);return s;}
    if(s.mode!=='play')throw new Error('Unexpected mode '+s.mode);
    const keys=[];if(Math.abs(dx)>.45)keys.push(dx>0?'KeyD':'KeyA');if(Math.abs(dz)>.45)keys.push(dz>0?'KeyS':'KeyW');if(attack)keys.push('KeyJ');await hold(keys);
    if(last&&Math.hypot(px-last[0],pz-last[2])<.05)stuck++;else stuck=0;
    if(stuck===6){await page.keyboard.press('Space');}
    if(stuck>16){log('STUCK',{target:[x,z],state:s});break;}
    last=s.position;await wait(150);
  }await hold([]);const s=await state();log('walk result',{target:[x,z],position:s.position});return s;
}
try{
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:4173/bananza-gpt/')+'?qa');await page.waitForFunction(()=>window.__game?.state?.edits===0);await page.locator('#playBtn').click();await wait(1200);
  const initial=await state();await hold(['KeyW']);await wait(900);await hold([]);const moved=await state();log('movement',{from:initial.position,to:moved.position});
  await page.keyboard.down('Space');await wait(260);const jumping=await state();await page.keyboard.up('Space');await wait(1000);log('jump',{up:jumping.position[1],landed:(await state()).position[1]});
  await walkTo(-8,3);await walkTo(-8,-4,{attack:true});await wait(800);log('first seed',await state());await page.screenshot({path:'test-output/seed-one.png'});
  await walkTo(8,-6,{attack:true});await walkTo(8,-22,{attack:true,timeout:22000});log('first tunnel',await state());await page.screenshot({path:'test-output/first-tunnel.png'});
  await walkTo(4,-24);await wait(700);await walkTo(-9,-30,{attack:true});await walkTo(-9,-33,{attack:true});await hold(['KeyJ']);await wait(900);await hold([]);log('first seal',await state());
  await walkTo(13,-27,{attack:true});await walkTo(13,-33,{attack:true});await hold(['KeyJ']);await wait(900);await hold([]);
  if(!(await state()).seeds[1]){await page.keyboard.down('KeyL');await wait(1300);await page.keyboard.up('KeyL');await wait(800);await walkTo(13,-33,{attack:true});await page.keyboard.press('KeyK');await wait(500);}
  log('second seed',await state());await page.screenshot({path:'test-output/crystal-play.png'});
  await walkTo(-7,-43,{attack:true});await walkTo(-7,-58,{attack:true,timeout:22000});await walkTo(-7,-60);log('temple entry',await state());await page.screenshot({path:'test-output/temple-play.png'});
  await walkTo(0,-66,{attack:true});
  const deadline=Date.now()+70000;
  while(Date.now()<deadline){const s=await state(),boss=s.enemies.find(e=>e.id===99);if(!boss.alive)break;const [bx,by,bz]=boss.pos,[px,py,pz]=s.position;if(s.hp<=1){await page.keyboard.press('KeyR');await walkTo(0,-66,{attack:true});}
    // Jump during the warning; move into the exposed core during the recovery.
    if(boss.state==='windup'){await hold(['Space']);await wait(350);await hold([]);await wait(450);await page.keyboard.down('Space');await wait(250);await page.keyboard.up('Space');}
    else if(boss.state==='stunned'||boss.state==='recover'){await walkTo(bx,bz+2,{attack:true,timeout:1800,tolerance:1});await hold(['KeyW','KeyJ']);await wait(650);await hold([]);}
    else {await walkTo(bx,bz+6,{attack:false,timeout:500,tolerance:1});}
    await wait(200);
  }
  await hold([]);log('boss result',await state());
  await walkTo(0,-77,{attack:true});await wait(700);await walkTo(0,-81);await page.keyboard.press('KeyF');await wait(1800);const final=await state();log('ending',final);await page.screenshot({path:'test-output/ending.png'});
  await page.evaluate(()=>window.__game.save());await page.reload();await page.waitForFunction(()=>window.__game?.state?.edits!==undefined);log('save reload',await state());
  assert.equal(final.mode,'ending');assert.deepEqual(final.seeds,[true,true,true]);assert.equal(final.bossDead,true);assert.equal(errors.length,0);log('errors',errors);log('assertions','PASS: ending, three seeds, guardian, no runtime errors');
}catch(e){log('failure',e.stack);await page.screenshot({path:'test-output/playthrough-failure.png'});process.exitCode=1;}
await fs.mkdir('test-output',{recursive:true});await fs.writeFile('test-output/playthrough.json',JSON.stringify(report,null,2));await browser.close();
