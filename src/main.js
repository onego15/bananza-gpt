import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {TerrainField,clamp,floorAt} from './terrain.js';
import {TerrainMesh} from './mesher.js';
import {resolveCapsule} from './physics.js';
import {makeHero,makeEnemy,mat,mesh,sculpt,rng} from './art.js';
import {buildWorld,REGIONS} from './world.js';
import {Soundscape} from './audio.js';
import {createUI} from './ui.js';
import './style.css';

const VERSION=2,SAVE_KEY='underbloom-v2',ui=createUI(),audio=new Soundscape();
let saved=null;try{const s=JSON.parse(localStorage.getItem(SAVE_KEY));if(s?.version===VERSION&&Array.isArray(s.edits))saved=s;}catch{}
const canvas=ui.el('game'),scene=new T.Scene();scene.background=new T.Color('#122e35');scene.fog=new T.FogExp2('#14383d',.022);
let renderer;try{renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(e){ui.el('loading').innerHTML='<h2>WebGL 2 が必要です</h2><p>Chrome / Edge のハードウェアアクセラレーションを有効にして、再読み込みしてください。</p>';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;renderer.info.autoReset=false;
const camera=new T.PerspectiveCamera(57,innerWidth/innerHeight,.12,160),composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),.32,.65,1.15);composer.addPass(bloom);
const grade=new ShaderPass({uniforms:{tDiffuse:{value:null},time:{value:0},pulse:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform sampler2D tDiffuse;uniform float time;uniform float pulse;varying vec2 vUv;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;vec2 p=vUv-.5;float vig=1.-dot(p,p)*.38;c*=vig;c+=pulse*vec3(.045,.032,.01);gl_FragColor=vec4(c,1.);}`});composer.addPass(grade);composer.addPass(new OutputPass());
scene.add(new T.HemisphereLight('#cfebcf','#334c50',1.65));scene.add(new T.AmbientLight('#a3c6bb',.24));
const sun=new T.DirectionalLight('#fff0cc',2.3);sun.position.set(-8,22,18);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-23,right:23,top:23,bottom:-23,near:1,far:70});sun.shadow.bias=-.001;sun.shadow.normalBias=.045;scene.add(sun);scene.add(sun.target);
const rim=new T.DirectionalLight('#87d5de',1);rim.position.set(12,8,-12);scene.add(rim);
const hero=makeHero();scene.add(hero.root);
const heroLight=new T.PointLight('#ffe2a6',2.8,9,1.5);scene.add(heroLight);
const v3=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),random=rng(808),keys=new Set();
let field,terrain,world,enemies=[],pickups=[],effects=[],rings=[],defeatedIds=[],mode='menu',region=0,lastRegion=-1,time=0,playtime=0,autoSave=0,dirtySave=false,shake=0,freeze=0,power=0,shards=0,hp=5,maxHp=5,seeds=[false,false,false],seals=[false,false],bossDead=false,endingSeen=false,checkpoint=0,kills=0,dug=0;
const player={pos:v3(0,1,22),vel:v3(),facing:Math.PI,grounded:false,coyote:0,jumpBuffer:0,cooldown:0,attackAnim:0,invuln:0,slam:false,charge:0,chargeHeld:false,step:0,lastSafe:v3(0,1,22),stuck:0};
const cam={yaw:0,pitch:.36,distance:8.3,target:v3(),ready:false,drag:false},input={jump:false,attack:false,dig:false,up:false,interact:false,chargeRelease:false};
const terrainContainer=new T.Group();scene.add(terrainContainer);
const effectContainer=new T.Group();scene.add(effectContainer);
const dustCanvas=document.createElement('canvas');dustCanvas.width=dustCanvas.height=64;const dc=dustCanvas.getContext('2d'),dg=dc.createRadialGradient(32,32,0,32,32,32);dg.addColorStop(0,'rgba(255,255,255,.6)');dg.addColorStop(.35,'rgba(255,255,255,.3)');dg.addColorStop(1,'rgba(255,255,255,0)');dc.fillStyle=dg;dc.fillRect(0,0,64,64);const puffTexture=new T.CanvasTexture(dustCanvas);
const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;const sc=shadowCanvas.getContext('2d'),sg=sc.createRadialGradient(32,32,2,32,32,32);sg.addColorStop(0,'rgba(5,23,25,.45)');sg.addColorStop(1,'rgba(5,23,25,0)');sc.fillStyle=sg;sc.fillRect(0,0,64,64);const shadowTexture=new T.CanvasTexture(shadowCanvas);
const shadow=mesh(new T.PlaneGeometry(2.3,1.9),new T.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}),scene);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;
const debrisGeo=new T.IcosahedronGeometry(1,0),particleMaterials=[mat('#b6a078'),mat('#708e96'),mat('#8e8280')],amberMat=mat('#f1bd6a',.33,.5,'#c78232',.4),shardGeo=new T.OctahedronGeometry(.17,0);
let resonanceTimer=0;
function initWorld(data){
  field=new TerrainField(data?.edits||[]);terrain=new TerrainMesh(terrainContainer,field);terrain.buildAll();world=buildWorld(scene,field);
  shards=data?.shards||0;seeds=data?.seeds||[false,false,false];seals=data?.seals||[false,false];bossDead=data?.bossDead||false;endingSeen=data?.endingSeen||false;checkpoint=clamp(data?.checkpoint||0,0,2);playtime=data?.playtime||0;dug=data?.dug||0;kills=data?.kills||0;
  power=Math.min(2,Math.floor(shards/20)+(seeds[0]?1:0));maxHp=5+(shards>=20?1:0)+(shards>=50?1:0);hp=maxHp;
  player.pos.copy(world.checkpoints[checkpoint].pos).add(v3(0,.2,.75));if(data?.position?.length===3&&data.position.every(Number.isFinite)){const p=v3(...data.position);if(field.sample(p.x,p.y+1,p.z)<-.35)player.pos.copy(p);}
  player.vel.set(0,0,0);player.lastSafe.copy(world.checkpoints[checkpoint].pos);hero.root.position.copy(player.pos);player.facing=Math.PI;
  world.seeds.forEach((s,i)=>{s.collected=seeds[i];s.obj.visible=!seeds[i];});world.seals.forEach((s,i)=>{s.active=seals[i];if(s.active)s.ring.material.emissiveIntensity=3;});
  world.treasures.forEach((t,i)=>{t.opened=Boolean(data?.treasures?.[i]);});
  defeatedIds=data?.defeated||[];
  const placements=[[-12,13],[12,9],[-16,-2],[14,-25],[-7,-36],[17,-43],[-13,-61],[9,-68]];
  placements.forEach(([x,z],i)=>{if(!data?.defeated?.includes(i))spawnEnemy(x,z,'crawler',i);});if(!bossDead)spawnEnemy(0,-73,'boss',99);
  // Embedded amber veins. Excavating reveals them; no invisible automatic rewards.
  for(let i=0;i<55;i++){const z=i<20?-6+random()*30:i<40?-18-random()*29:-55-random()*30,x=(random()-.5)*37,y=field.ground(x,z,z>-12?6:z>-50?0:-7)+(i%3===0?-1.4:.5);spawnPickup(v3(x,y,z),i%7===0?3:1,true,`vein${i}`);}
  for(let i=0;i<7;i++)spawnPickup(v3(Math.sin(i*.85)*3.5,.65,19-i*2.5),1,true,`trail${i}`);
  if(data?.collected){for(const p of pickups)if(data.collected.includes(p.id)){p.collected=true;p.obj.visible=false;}}
  updateHUD();
}
function spawnEnemy(x,z,kind,id){const art=makeEnemy(kind),y=field.ground(x,z,z>-12?6:z>-50?0:-7);art.root.position.set(x,y,z);scene.add(art.root);enemies.push({art,pos:art.root.position,home:v3(x,y,z),vel:v3(),hp:kind==='boss'?42:3,maxHp:kind==='boss'?42:3,kind,id,timer:1.5+random(),state:'idle',hit:0,alive:true,phase:0,active:false,face:0,contactCD:0});}
function spawnPickup(pos,value=1,embedded=false,id='drop'+Math.random()){
  if(pickups.filter(p=>!p.collected).length>170)return;
  const obj=mesh(shardGeo,amberMat,scene,[pos.x,pos.y,pos.z]);obj.scale.setScalar(value>1?1.4:1);pickups.push({obj,pos:obj.position,base:pos.y,value,collected:false,embedded,id,vel:embedded?v3():v3((random()-.5)*3,3+random()*2,(random()-.5)*3),life:0});
}
function burst(pos,material='earth',strong=false,count=24){
  const mi=material==='crystal'?1:material==='basalt'?2:0;
  for(let i=0;i<count;i++){
    const obj=mesh(debrisGeo,particleMaterials[mi],effectContainer,[pos.x,pos.y,pos.z]),s=.07+random()*(strong?.27:.18);obj.scale.set(s,s*(.5+random()),s);obj.castShadow=false;
    const dir=v3(random()-.5,random()*.9,random()-.5).normalize().multiplyScalar(3+random()*(strong?9:6));effects.push({obj,vel:dir,life:.6+random()*.6,max:1.2,kind:'debris',size:s});
  }
  for(let i=0;i<(strong?12:7);i++){
    const mat=new T.SpriteMaterial({map:puffTexture,color:['#cbb68c','#7ac7d0','#a18b7e'][mi],transparent:true,opacity:.28,depthWrite:false}),obj=new T.Sprite(mat);obj.position.copy(pos).add(v3((random()-.5)*1.3,random(),(random()-.5)*1.3));obj.scale.setScalar(1+random()*1.7);effectContainer.add(obj);effects.push({obj,vel:v3((random()-.5)*2,1+random(),(random()-.5)*2),life:.8+random()*.4,max:1.2,kind:'dust',size:obj.scale.x});
  }
  if(strong||count>12){const ring=mesh(new T.TorusGeometry(.55,.025,5,48),new T.MeshBasicMaterial({color:'#ffe3a8',transparent:true,opacity:.7,depthWrite:false}),effectContainer,[pos.x,pos.y,pos.z]);ring.rotation.x=Math.PI/2;rings.push({obj:ring,life:.45,max:.45,strong});}
  while(effects.length>230){const e=effects.shift();effectContainer.remove(e.obj);if(e.kind==='dust')e.obj.material.dispose();}
}
function attack(type='normal',charge=0){
  if(mode!=='play'||player.cooldown>0)return;
  const strong=charge>.45||type==='slam',radius=type==='dig'?1.65+power*.18:type==='slam'?3.2+power*.25:strong?2.85+power*.22:1.85+power*.13;
  const forward=v3(Math.sin(player.facing),0,Math.cos(player.facing));let pos=player.pos.clone().addScaledVector(forward,type==='dig'||type==='slam'?.35:2.0);
  pos.y+=type==='dig'?-1.05:type==='slam'?-.2:type==='up'?3.15:1.25;
  const material=field.materialAt(pos.x,pos.y,pos.z),hardness={earth:1,rock:.89,crystal:.89,basalt:.82}[material];
  const floorClip=type==='normal'?player.pos.y+.14:-100,r=radius*(strong?1:hardness);
  let hits=field.carve(pos.x,pos.y,pos.z,r,true,floorClip);
  if(type==='normal'){const mouth=player.pos.clone().addScaledVector(forward,.65);mouth.y+=1.25;hits+=field.carve(mouth.x,mouth.y,mouth.z,r*.88,true,floorClip);}
  dug+=hits;dirtySave=true;player.cooldown=strong?.65:type==='dig'?.34:.30;player.attackAnim=1;
  let enemyHit=false;
  for(const e of enemies){if(!e.alive||e.kind==='boss'&&!e.active)continue;const center=e.pos.clone().add(v3(0,e.kind==='boss'?2.3:.8,0)),distance=center.distanceTo(pos),reach=radius+(e.kind==='boss'?2:1);
    if(distance<reach&&Math.abs(center.y-pos.y)<reach+1){
      if(e.kind==='boss'&&e.state!=='stunned'&&e.state!=='recover'){audio.tone(360,.15,'triangle',.15);burst(pos,'basalt',false,7);ui.toast('硬い装甲に弾かれた','衝撃波のあと、青く光る核を狙おう',2);continue;}
      e.hp-=strong?4:1+power;e.hit=.2;e.timer=e.kind==='boss'?Math.max(e.timer,.7):.5;enemyHit=true;e.vel.addScaledVector(forward,strong?9:5);e.vel.y=3;
      if(e.hp<=0)defeat(e);
    }
  }
  for(const s of world.seals){if(!s.active&&s.pos.distanceTo(pos)<radius+.6&&field.sample(s.pos.x,s.pos.y,s.pos.z)<.2){s.active=true;seals[s.i]=true;s.ring.material.emissiveIntensity=3;resonanceTimer=.8;audio.collect(true);ui.toast('鳴石が共鳴した',seals.every(Boolean)?'晶洞の灯種が、目を覚ました':'もう一つの響きを探そう');dirtySave=true;}}
  const hit=hits>0||enemyHit;
  audio.punch(hit,strong);if(hit){burst(pos,field.materialAt(pos.x,pos.y,pos.z),strong,strong?44:27);shake=strong?.42:.20;freeze=strong?.065:.028;grade.uniforms.pulse.value=strong?1:.45;
    if(hits>8&&random()<.65)spawnPickup(pos.clone().add(v3(0,.5,0)),strong?2:1,false);
    world.prune();
  }else{burst(pos,'earth',false,4);}
  if(dug>25&&!seeds[0]&&playtime<45)ui.el('objectiveHint').textContent='削った穴を通って、金色の灯種へ';
}
function defeat(e){e.alive=false;e.art.root.visible=false;kills++;if(!defeatedIds.includes(e.id))defeatedIds.push(e.id);dirtySave=true;burst(e.pos.clone().add(v3(0,1,0)),e.kind==='boss'?'basalt':'crystal',true,40);audio.collect(e.kind==='boss');
  if(e.kind==='boss'){bossDead=true;shake=.55;ui.show('bossHud',false);ui.toast('残響の守り手、眠りにつく','最後の灯種を祭壇へ届けよう',6);world.seeds[2].obj.visible=!seeds[2];save();}
  else for(let i=0;i<4;i++)spawnPickup(e.pos.clone().add(v3((random()-.5)*1.5,1,(random()-.5)*1.5)),1,false);
}
function takeDamage(amount,source){if(player.invuln>0||mode!=='play')return;hp-=amount;player.invuln=1.7;shake=.3;audio.hurt();ui.el('hitflash').style.opacity='1';setTimeout(()=>ui.el('hitflash').style.opacity='0',140);if(source){const dir=player.pos.clone().sub(source);dir.y=0;dir.normalize();player.vel.addScaledVector(dir,7);player.vel.y=6;}ui.hearts(hp,maxHp);if(hp<=0)respawn(true);}
function respawn(death=false){player.pos.copy(world.checkpoints[checkpoint].pos).add(v3(0,.25,.75));player.vel.set(0,0,0);player.slam=false;player.invuln=2;hp=maxHp;cam.ready=false;ui.hearts(hp,maxHp);audio.tone(260,1,'sine',.2,0,520);ui.toast(death?'灯が、ルウを呼び戻した':'道しるべに帰還した','見つけた宝物も、掘った道も、そのまま残る。',4);save();}
function resolveBody(pos,vel,radius=.43,height=2.2){
  return resolveCapsule(field,pos,vel,radius,height);
}
function updatePlayer(dt){
  player.cooldown=Math.max(0,player.cooldown-dt);player.attackAnim=Math.max(0,player.attackAnim-dt*3.8);player.invuln=Math.max(0,player.invuln-dt);player.coyote=player.grounded?.13:Math.max(0,player.coyote-dt);player.jumpBuffer=Math.max(0,player.jumpBuffer-dt);
  if(keys.has('KeyQ'))cam.yaw+=dt*1.7;if(keys.has('KeyC'))cam.yaw-=dt*1.7;
  let ix=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),iz=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);const il=Math.hypot(ix,iz);if(il){ix/=il;iz/=il;}
  const dir=v3(Math.cos(cam.yaw)*ix-Math.sin(cam.yaw)*iz,0,-Math.sin(cam.yaw)*ix-Math.cos(cam.yaw)*iz),speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?9:5.7;
  const accel=player.grounded?17:7.5,blend=1-Math.exp(-accel*dt);player.vel.x+=(dir.x*speed-player.vel.x)*blend;player.vel.z+=(dir.z*speed-player.vel.z)*blend;
  if(il&&!player.slam){const a=Math.atan2(dir.x,dir.z),delta=Math.atan2(Math.sin(a-player.facing),Math.cos(a-player.facing));player.facing+=delta*(1-Math.exp(-18*dt));}
  if(input.jump)player.jumpBuffer=.16;
  if(player.jumpBuffer>0&&player.coyote>0){player.vel.y=10.8;player.grounded=false;player.coyote=0;player.jumpBuffer=0;audio.jump();}
  if(!keys.has('Space')&&player.vel.y>5.2)player.vel.y-=dt*15;
  if(input.dig&&!player.grounded&&player.vel.y<4&&!player.slam){player.slam=true;player.vel.y=-24;hero.arms.forEach(a=>a.rotation.x=-2);}
  player.vel.y-=dt*(player.slam?45:27);
  let landed=false;const steps=Math.max(1,Math.ceil(player.vel.length()*dt/.22));
  for(let i=0;i<steps;i++){
    player.pos.addScaledVector(player.vel,dt/steps);const g=resolveBody(player.pos,player.vel);landed||=g;
  }
  const support=field.sample(player.pos.x,player.pos.y-.045,player.pos.z),sn=field.gradient(player.pos.x,player.pos.y-.045,player.pos.z);
  player.grounded=landed||(support>-.018&&sn[1]>.5&&player.vel.y<.8);
  if(player.grounded&&player.vel.y<0)player.vel.y=0;
  if(player.slam&&landed){player.slam=false;player.cooldown=0;attack('slam');player.vel.y=4.3;}
  if(player.pos.y< -23.5||Math.abs(player.pos.x)>34||player.pos.z< -95||player.pos.z>35)respawn();
  if(field.sample(player.pos.x,player.pos.y+1,player.pos.z)>.4)player.stuck+=dt;else player.stuck=0;if(player.stuck>1.5){player.stuck=0;respawn();}
  if((input.attack||keys.has('KeyJ')||keys.has('Mouse0'))&&player.cooldown<=0)attack();
  if((input.dig||keys.has('KeyE'))&&player.grounded&&player.cooldown<=0)attack('dig');
  if((input.up||keys.has('KeyK'))&&player.cooldown<=0)attack('up');
  const held=keys.has('KeyL');if(held)player.charge=Math.min(1,player.charge+dt*.85);if(!held&&player.chargeHeld){if(player.cooldown<=0)attack('normal',player.charge);player.charge=0;}player.chargeHeld=held;
  hero.root.position.copy(player.pos);hero.root.rotation.y=player.facing;hero.root.visible=!(player.invuln>0&&Math.floor(time*13)%2===0);hero.animate(time,Math.hypot(player.vel.x,player.vel.z),player.attackAnim,player.grounded,player.charge);
  if(player.slam){hero.rig.rotation.x=-.35;hero.arms[0].rotation.x=hero.arms[1].rotation.x=-2.5;}
  heroLight.position.copy(player.pos).add(v3(0,2.8,.5));const gy=field.ground(player.pos.x,player.pos.z,player.pos.y+.12);shadow.position.set(player.pos.x,gy+.055,player.pos.z);shadow.scale.setScalar(clamp(1-(player.pos.y-gy)*.07,.5,1));shadow.visible=player.pos.y-gy<10;
  player.step+=dt*Math.hypot(player.vel.x,player.vel.z);if(player.grounded&&player.step>2.5){player.step=0;audio.noise(.045,.065,400);}
}
function updateEnemies(dt){
  for(const e of enemies){if(!e.alive)continue;const delta=player.pos.clone().sub(e.pos),dist=Math.hypot(delta.x,delta.z);if(dist>32)continue;e.hit=Math.max(0,e.hit-dt);e.art.root.traverse(o=>{if(o.isMesh)o.material.emissiveIntensity=o.material.emissive.getHex()?Math.max(e.hit*9,1):0;});
    if(e.kind==='boss'){
      e.contactCD=Math.max(0,e.contactCD-dt);
      e.active=seeds[0]&&seeds[1]&&region===2;if(!e.active)continue;ui.show('bossHud',true);ui.el('bossHealth').style.width=`${e.hp/e.maxHp*100}%`;e.timer-=dt;
      if(e.state==='idle'){e.state='chase';e.timer=2;}
      if(e.state==='chase'){
        if(dist<3.5&&e.contactCD<=0){takeDamage(1,e.pos);e.contactCD=1.7;}
        const speed=e.hp<12?3.8:2.5;if(dist>5){e.vel.x=delta.x/dist*speed;e.vel.z=delta.z/dist*speed;}else{e.vel.x=e.vel.z=0;}
        if(e.timer<=0){e.state='windup';e.timer=1.35;ui.el('bossHint').textContent='地面が光ったら、ジャンプで衝撃波をかわそう';e.art.body.scale.y=.85;const ring=mesh(new T.RingGeometry(.3,.4,64),new T.MeshBasicMaterial({color:'#f59d69',transparent:true,opacity:.8,side:T.DoubleSide,depthWrite:false}),effectContainer,[e.pos.x,e.pos.y+.08,e.pos.z]);ring.rotation.x=-Math.PI/2;rings.push({obj:ring,life:1.35,max:1.35,warning:true});}
      }else if(e.state==='windup'){
        e.vel.x=e.vel.z=0;e.art.root.position.y+=Math.sin(time*30)*.012;
        if(e.timer<=0){e.state='stunned';e.timer=3.5;e.art.body.scale.y=1;shake=.4;audio.punch(true,true);burst(e.pos.clone().add(v3(0,.4,0)),'basalt',true,35);const ring=mesh(new T.TorusGeometry(.7,.06,6,80),new T.MeshBasicMaterial({color:'#f5cc8c',transparent:true,opacity:.9,depthWrite:false}),effectContainer,[e.pos.x,e.pos.y+.18,e.pos.z]);ring.rotation.x=Math.PI/2;rings.push({obj:ring,life:1.1,max:1.1,shock:true,hit:false});ui.el('bossHint').textContent='核が露出した！ 近づいてパンチ';}
      }else if(e.state==='stunned'||e.state==='recover'){
        e.vel.x*=Math.exp(-dt*5);e.vel.z*=Math.exp(-dt*5);e.art.body.rotation.x=.18;if(e.timer<=0){e.state='chase';e.timer=e.hp<12?1.5:2.5;e.art.body.rotation.x=0;}
      }
    }else{
      e.timer-=dt;const canSee=field.sample((player.pos.x+e.pos.x)/2,e.pos.y+1,(player.pos.z+e.pos.z)/2)<0;
      if(dist<10&&dist>1.7&&Math.abs(delta.y)<4&&canSee){e.vel.x+=((delta.x/dist)*2.8-e.vel.x)*dt*4;e.vel.z+=((delta.z/dist)*2.8-e.vel.z)*dt*4;}
      else {e.vel.x*=Math.exp(-dt*5);e.vel.z*=Math.exp(-dt*5);}
      if(dist<1.9&&Math.abs(delta.y)<2.2&&e.timer<=0){takeDamage(1,e.pos);e.timer=1.5;}
    }
    e.vel.y-=dt*22;e.pos.addScaledVector(e.vel,dt);resolveBody(e.pos,e.vel,e.kind==='boss'?1.6:.5,e.kind==='boss'?3.2:1.3);
    if(e.pos.y< -22){e.pos.copy(e.home);e.vel.set(0,0,0);}
    if(dist>1){const target=Math.atan2(delta.x,delta.z);e.face+=Math.atan2(Math.sin(target-e.face),Math.cos(target-e.face))*Math.min(1,dt*4);e.art.root.rotation.y=e.face;}
    e.art.animate(time,Math.hypot(e.vel.x,e.vel.z));
  }
  if(region!==2||bossDead)ui.show('bossHud',false);
}
function updateCollectibles(dt){
  for(const c of world.treasures){const exposed=field.sample(c.pos.x,c.pos.y+.3,c.pos.z)<-.25;c.obj.visible=exposed;if(!c.opened&&exposed&&player.pos.clone().add(v3(0,1,0)).distanceTo(c.pos)<2.5){c.opened=true;audio.collect(true);shards+=12;checkUpgrade();ui.toast(['根の下の忘れもの','星をしまった宝箱','最後の庭師の宝箱'][c.i],'古い旅の記憶と、12個の琥珀片を見つけた。',5);save();}}
  for(const p of pickups){if(p.collected)continue;p.life+=dt;const isEmbedded=p.embedded&&field.sample(p.pos.x,p.base,p.pos.z)>.15;p.obj.visible=!isEmbedded;if(isEmbedded)continue;
    if(p.embedded)p.pos.y=p.base+Math.sin(time*2+p.base)*.12;else{p.vel.y-=dt*13;p.pos.addScaledVector(p.vel,dt);const d=field.sample(p.pos.x,p.pos.y,p.pos.z);if(d>-.17){const n=field.gradient(p.pos.x,p.pos.y,p.pos.z);p.pos.add(v3(...n).multiplyScalar(d+.18));p.vel.y=Math.abs(p.vel.y)*.2;p.vel.x*=.8;p.vel.z*=.8;}}
    p.obj.rotation.y+=dt*1.8;p.obj.rotation.z=Math.sin(time+p.base)*.15;
    const center=player.pos.clone().add(v3(0,1,0)),dist=p.pos.distanceTo(center);
    if(dist<3.3&&field.sample((p.pos.x+center.x)/2,(p.pos.y+center.y)/2,(p.pos.z+center.z)/2)<.1){p.embedded=false;p.pos.lerp(center,1-Math.exp(-dt*8));if(dist<.85){p.collected=true;p.obj.visible=false;shards+=p.value;audio.collect();dirtySave=true;checkUpgrade();}}
  }
  for(const s of world.seeds){if(s.collected)continue;const exposed=field.sample(s.pos.x,s.pos.y,s.pos.z)<-.35;const unlocked=s.i===0||s.i===1&&seals.every(Boolean)||s.i===2&&bossDead;s.obj.visible=exposed&&unlocked;
    if(exposed&&unlocked&&player.pos.clone().add(v3(0,1,0)).distanceTo(s.pos)<2.6){s.collected=true;seeds[s.i]=true;s.obj.visible=false;audio.collect(true);shake=.2;burst(s.pos,'crystal',true,35);hp=maxHp;checkUpgrade();ui.toast(['翠緑の灯種を見つけた','星の灯種を見つけた','暁の灯種を見つけた'][s.i],['こぶしが成長した。北の壁を砕いて、晶洞へ。','二つの灯が共鳴する。さらに深い神殿へ。','すべての灯を、神殿の奥の円環へ。'][s.i],6);save();}}
  let near=null;
  for(const cp of world.checkpoints){const dist=player.pos.distanceTo(cp.pos);if(dist<3){near=cp;if(cp.i>checkpoint){checkpoint=cp.i;save();ui.toast('新しい道しるべ','体力が回復し、旅が記録された。');}if(hp<maxHp){hp=maxHp;ui.hearts(hp,maxHp);}}}
  const canEnd=seeds.every(Boolean)&&bossDead&&player.pos.distanceTo(v3(0,-12,-81))<4;
  ui.show('interact',canEnd||near!==null);if(canEnd)ui.el('interact').querySelector('span').textContent='地底に灯をともす';else if(near)ui.el('interact').querySelector('span').textContent='道しるべに記録する';
  if(input.interact){if(canEnd)finishGame();else if(near){save();audio.collect();ui.toast('旅を記録した','灯はいつでも、ここで待っている。');}}
}
function checkUpgrade(){const old=power;power=Math.min(2,Math.floor(shards/20)+(seeds[0]?1:0));maxHp=5+(shards>=20?1:0)+(shards>=50?1:0);if(power>old){hp=maxHp;audio.collect(true);ui.toast('琥珀のこぶしが成長した','より広く、より力強く。硬い岩にも道をつくれる。');}updateHUD();}
function updateEffects(dt){
  for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.life-=dt;if(e.life<=0){effectContainer.remove(e.obj);if(e.kind==='dust')e.obj.material.dispose();effects.splice(i,1);continue;}e.obj.position.addScaledVector(e.vel,dt);if(e.kind==='debris'){e.vel.y-=dt*16;e.obj.rotation.x+=dt*6;e.obj.rotation.z+=dt*4;const s=e.size*Math.min(1,e.life*4);e.obj.scale.setScalar(s);}else{e.obj.material.opacity=.25*Math.max(0,e.life/e.max);e.obj.scale.setScalar(e.size*(2-e.life/e.max));}}
  for(let i=rings.length-1;i>=0;i--){const r=rings[i];r.life-=dt;const t=1-r.life/r.max,s=r.warning?1+t*24:r.shock?1+t*26:1+t*(r.strong?14:8);r.obj.scale.setScalar(s);r.obj.material.opacity=(r.warning?.45:.8)*(1-t);if(r.shock&&!r.hit&&player.pos.distanceTo(r.obj.position)<.7*s+1.3&&player.pos.distanceTo(r.obj.position)>.7*s-1.4&&player.pos.y-r.obj.position.y<1){takeDamage(1,r.obj.position);r.hit=true;}if(r.life<=0){effectContainer.remove(r.obj);r.obj.geometry.dispose();r.obj.material.dispose();rings.splice(i,1);}}
}
function updateCamera(dt){
  let target=player.pos.clone().add(v3(0,1.45,0)),distance=cam.distance;
  if(mode==='menu'&&!saved){target=v3(-1,2,15);const desired=v3(11,7.5,29);camera.position.lerp(desired,cam.ready?1-Math.exp(-dt*2):1);camera.lookAt(target);cam.ready=true;return;}
  const desired=v3(Math.sin(cam.yaw)*Math.cos(cam.pitch),Math.sin(cam.pitch),Math.cos(cam.yaw)*Math.cos(cam.pitch));
  for(let d=.5;d<distance;d+=.28){const p=target.clone().addScaledVector(desired,d);if(field.sample(p.x,p.y,p.z)>-.35){distance=Math.max(.85,d-.45);break;}}
  const cut=distance<5.2;distance=Math.max(5.2,distance);terrain.material.userData.hero.value.copy(target);terrain.material.userData.cutaway.value=cut?1:0;
  const p=target.clone().addScaledVector(desired,distance);p.y=Math.max(p.y,player.pos.y+.7);
  if(!cam.ready){camera.position.copy(p);cam.target.copy(target);cam.ready=true;}else{camera.position.lerp(p,1-Math.exp(-dt*(distance<3?20:8)));cam.target.lerp(target,1-Math.exp(-dt*12));}
  if(shake>0){camera.position.add(v3((random()-.5)*shake,(random()-.5)*shake*.65,(random()-.5)*shake*.5));shake=Math.max(0,shake-dt*1.8);}
  camera.lookAt(cam.target);camera.fov+=(57+(keys.has('ShiftLeft')?4:0)-camera.fov)*(1-Math.exp(-dt*3));camera.updateProjectionMatrix();
  world.occlude(camera.position,cam.target);
}
function objective(){if(!seeds[0])return {title:'最初の灯種を掘り出す',hint:'金色に輝く岩のふくらみをパンチ',pos:world.seeds[0].pos};if(!seals.every(Boolean))return {title:region===0?'北の壁を砕き、晶洞へ':'二つの鳴石を響かせる',hint:region===0?'こぶしでトンネルをつくろう':'光る円環をパンチ。岩の中にも一つ',pos:world.seals[seals[0]?1:0].pos};if(!seeds[1])return {title:'晶洞の灯種を掘り出す',hint:'東の鉱脈に、星の光が眠っている',pos:world.seeds[1].pos};if(!bossDead)return {title:region<2?'さらに深く、地底神殿へ':'残響の守り手を鎮める',hint:region<2?'南西の通路。壁は砕いて進める':'衝撃波はジャンプ。露出した核を狙おう',pos:v3(0,-12,-73)};if(!seeds[2])return {title:'最後の灯種を受けとる',hint:'守り手の向こう、暁の光へ',pos:world.seeds[2].pos};return {title:'地底に、灯をともす',hint:'神殿の奥の円環で F',pos:v3(0,-12,-81)};}
function updateHUD(){ui.el('seedCount').textContent=seeds.filter(Boolean).length;ui.el('shardCount').textContent=shards;ui.hearts(hp,maxHp);ui.el('powerLabel').textContent=`琥珀のこぶし ${['I','II','III'][power]}`;}
function updateUI(){const r=player.pos.z> -17?0:player.pos.z> -52?1:2;region=r;if(region!==lastRegion){lastRegion=region;ui.el('regionLabel').textContent=REGIONS[r].name;if(mode==='play')ui.location(REGIONS[r],r);const color=new T.Color(['#14383d','#163343','#302e3b'][r]);scene.fog.color.copy(color);scene.background.copy(color);}
  const o=objective();ui.el('objectiveTitle').textContent=o.title;ui.el('objectiveHint').textContent=o.hint;ui.el('objectiveDistance').textContent=`✧ ${Math.round(player.pos.distanceTo(o.pos))} m`;
  const wp=o.pos.clone().add(v3(0,3.4,0)),projected=wp.clone().project(camera),front=wp.sub(camera.position).dot(camera.getWorldDirection(v3()))>0;
  ui.el('waypoint').style.left=`${clamp((projected.x*.5+.5)*innerWidth,55,innerWidth-55)}px`;ui.el('waypoint').style.top=`${front?clamp((-projected.y*.5+.5)*innerHeight,100,innerHeight-125):innerHeight-135}px`;ui.el('waypoint').style.opacity=player.pos.distanceTo(o.pos)<5?.25:.9;ui.el('waypoint').querySelector('small').textContent=`${Math.round(player.pos.distanceTo(o.pos))}m`;
  ui.el('chargeBar').style.width=`${player.charge>0?player.charge*100:(1-player.cooldown/.65)*100}%`;ui.el('chargeBar').style.background=player.charge>0?'#9ffff0':'#e3c187';
  const angle=Math.atan2(o.pos.x-player.pos.x,o.pos.z-player.pos.z);ui.el('compass').style.opacity=.8;ui.el('compass').querySelector('b').textContent=Math.abs(cam.yaw)<.8?'N':'✧';
  const mp=ui.el('mapPlayer');mp.setAttribute('cx',150+player.pos.x*3.25);mp.setAttribute('cy',95+(8-player.pos.z)*3.35);ui.el('mapSeeds').innerHTML=world.seeds.map((s,i)=>`<text x="${150+s.pos.x*3.25}" y="${95+(8-s.pos.z)*3.35}" style="fill:${seeds[i]?'#8df4bf':'#edc888'};font-size:19px">${seeds[i]?'✧':'✦'}</text>`).join('');
  ui.el('seedCount').textContent=seeds.filter(Boolean).length;ui.el('shardCount').textContent=shards;
}
function save(){if(!field)return;const data={version:VERSION,edits:field.edits,shards,seeds,seals,bossDead,endingSeen,checkpoint,playtime,dug,kills,position:player.pos.toArray(),treasures:world.treasures.map(c=>c.opened),defeated:defeatedIds,collected:pickups.filter(p=>p.collected&&(p.id.startsWith('vein')||p.id.startsWith('trail'))).map(p=>p.id)};try{localStorage.setItem(SAVE_KEY,JSON.stringify(data));saved=data;dirtySave=false;ui.el('saveState').textContent='● セーブ済み';}catch{ui.el('saveState').textContent='セーブ容量が不足しています';}}
function start(){mode='play';ui.show('menu',false);ui.show('hud');ui.show('help',false);audio.start();cam.ready=false;lastRegion=-1;ui.location(REGIONS[region],region);canvas.focus();try{canvas.requestPointerLock?.()?.catch(()=>{});}catch{}if(playtime<2)ui.toast('こんにちは、ルウ。','WASD で歩こう。金色の岩を J で砕いてみよう。',6);}
function pause(){if(mode==='ending')return;mode='menu';keys.clear();save();ui.show('menu');ui.el('playBtn').innerHTML='旅にもどる <span>→</span>';ui.show('continueBtn',false);ui.show('newBtn');document.exitPointerLock?.();}
function finishGame(){endingSeen=true;mode='ending';keys.clear();save();audio.collect(true);ui.show('ending');ui.show('bossHud',false);document.exitPointerLock?.();ui.el('endStats').innerHTML=`<div>${Math.floor(playtime/60)}:${String(Math.floor(playtime%60)).padStart(2,'0')}<small>旅の時間</small></div><div>${dug.toLocaleString()}<small>砕いた岩の体積</small></div><div>${shards}<small>見つけた琥珀片</small></div>`;}
function newGame(){try{localStorage.removeItem(SAVE_KEY);}catch{}location.reload();}
ui.el('playBtn').onclick=start;ui.el('continueBtn').onclick=start;ui.el('newBtn').onclick=newGame;ui.el('endingNew').onclick=newGame;ui.el('menuBtn').onclick=pause;ui.el('helpBtn').onclick=()=>ui.show('help');ui.el('closeHelp').onclick=()=>{ui.show('help',false);if(mode==='help'){mode='play';audio.start();}};ui.el('exploreBtn').onclick=()=>{ui.show('ending',false);mode='play';};
ui.el('soundBtn').onclick=()=>{audio.start();audio.volume=audio.volume?0:.65;ui.el('soundBtn').textContent=audio.volume?'♪ 音 ON':'♪ 音 OFF';};let quality=true;ui.el('qualityBtn').onclick=()=>{quality=!quality;renderer.setPixelRatio(quality?Math.min(devicePixelRatio,1.5):1);renderer.shadowMap.enabled=quality;bloom.enabled=quality;composer.setPixelRatio(renderer.getPixelRatio());ui.el('qualityBtn').textContent=`画質：${quality?'高':'軽量'}`;};
document.addEventListener('keydown',e=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();if(e.repeat){keys.add(e.code);return;}
  if(e.code==='Escape'){if(mode==='play'||mode==='help')pause();else if(mode==='menu')start();return;}
  if(e.code==='KeyH'&&mode==='play'){mode='help';keys.clear();ui.show('help');document.exitPointerLock?.();return;}
  if((e.code==='Tab'||e.code==='KeyM')&&mode==='play'){ui.show('map',ui.el('map').classList.contains('hidden'));return;}
  if(e.code==='KeyR'&&mode==='play'){respawn();return;}keys.add(e.code);if(mode!=='play')return;
  if(e.code==='Space')input.jump=true;if(e.code==='KeyJ')input.attack=true;if(e.code==='KeyE')input.dig=true;if(e.code==='KeyK')input.up=true;if(e.code==='KeyF')input.interact=true;
});document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();if(mode==='play')pause();});
canvas.addEventListener('mousedown',e=>{if(mode!=='play')return;if(e.button===0){keys.add('Mouse0');input.attack=true;}if(e.button===2)cam.drag=true;});document.addEventListener('mouseup',e=>{if(e.button===0)keys.delete('Mouse0');if(e.button===2)cam.drag=false;});canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('mousemove',e=>{if(mode==='play'&&(document.pointerLockElement===canvas||cam.drag)){cam.yaw-=e.movementX*.0026;cam.pitch=clamp(cam.pitch+e.movementY*.0021,-.12,1.05);}});canvas.addEventListener('wheel',e=>{cam.distance=clamp(cam.distance+e.deltaY*.006,3.5,12);},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='play')pause();});window.addEventListener('beforeunload',()=>{if(playtime>1)save();});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);});
let prev=performance.now(),frames=0,fpsTime=0,measuredFPS=0;
function frame(now){requestAnimationFrame(frame);const rawDt=(now-prev)/1000;let dt=Math.min(.04,rawDt);prev=now;time+=dt;frames++;fpsTime+=rawDt;if(fpsTime>1){measuredFPS=frames/fpsTime;frames=0;fpsTime=0;}
  if(!field)return;
  if(mode==='play'){
    playtime+=dt;audio.update(region);if(freeze>0){freeze-=dt;dt*=.1;}
    updatePlayer(dt);updateEnemies(dt);updateCollectibles(dt);autoSave+=dt;if(autoSave>8){autoSave=0;save();}if(dirtySave)ui.el('saveState').textContent='○ 記録中';
  }else if(mode==='menu'){hero.animate(time,0,0,true);audio.update(region);}
  world.update(time);updateEffects(dt);terrain.flush(6);updateCamera(dt);updateUI();grade.uniforms.pulse.value=Math.max(0,grade.uniforms.pulse.value-dt*3);renderer.info.reset();composer.render();for(const k in input)input[k]=false;
}
// Read-only telemetry plus opt-in QA commands are kept off the normal game UI.
window.__game={get state(){return {mode,region,position:player.pos.toArray(),velocity:player.vel.toArray(),grounded:player.grounded,hp,maxHp,power,shards,seeds:[...seeds],seals:[...seals],bossDead,endingSeen,checkpoint,playtime,dug,edits:field?.edits.length,dirtyChunks:field?.dirty.size,fps:measuredFPS,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,enemies:enemies.map(e=>({id:e.id,hp:e.hp,state:e.state,pos:e.pos.toArray(),alive:e.alive})),camera:camera.position.toArray()};},sample:(...p)=>field.sample(...p),ground:(x,z,from)=>field.ground(x,z,from)};
if(new URLSearchParams(location.search).has('qa'))Object.assign(window.__game,{teleport(x,y,z,yaw=0){player.pos.set(x,y,z);player.vel.set(0,0,0);player.facing=yaw;cam.yaw=yaw+Math.PI;cam.ready=false;},carve(x,y,z,r){const n=field.carve(x,y,z,r);dug+=n;return n;},attack,save,start,respawn,finishGame,get field(){return field;},setCamera(yaw,pitch=.36,distance=8.3){cam.yaw=yaw;cam.pitch=pitch;cam.distance=distance;cam.ready=false;},get seeds(){return seeds;},get seals(){return seals;}});
setTimeout(()=>{initWorld(saved);ui.show('loading',false);if(saved){ui.el('playBtn').innerHTML='旅をつづける <span>→</span>';ui.show('newBtn');}else{player.pos.set(0,field.ground(0,24,6)+.1,24);hero.root.position.copy(player.pos);hero.root.rotation.y=.55;}cam.ready=false;requestAnimationFrame(frame);},50);
