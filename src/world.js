import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {mat,mesh,sculpt,tube,leafGeo,rng,textured} from './art.js';
export const REGIONS=[
  {name:'翠緑のゆりかご',en:'THE VERDANT HOLLOW',color:'#b9d390',pos:[0,1,15],desc:'根の奥に、忘れられた灯が眠る。'},
  {name:'星降る晶洞',en:'THE STARFALL GROTTO',color:'#86dce5',pos:[4,-6,-30],desc:'石の歌が、まだこの洞窟に響いている。'},
  {name:'暁の地底神殿',en:'THE SUNKEN SANCTUM',color:'#f1bc79',pos:[-3,-12,-64],desc:'最後の灯を、世界の心臓へ。'}
];
export function buildWorld(scene,field){
  const random=rng(641),decor=[],animated=[],m=new T.Object3D();
  const stone=mat('#a89c79',.95),stoneDark=mat('#6c776b',.9),trim=mat('#d6be84',.7,.18),gold=mat('#d9b265',.37,.55),plantMats=['#356c54','#668755','#8ba65e','#3d806f'].map(c=>{const m=mat(c,.9);m.side=T.DoubleSide;return m;}),stem=mat('#668478',.8),gill=mat('#d0e3c3',.8),mushMats=['#e0a66e','#63cbbd','#acbadd'].map(c=>mat(c,.55,.1,c,.2)),crystalMat=mat('#72d7d4',.23,.28,'#1e7b87',.55);
  const boxCache=new Map();
  textured(stone,38,.2);textured(stoneDark,38,.2);textured(trim,45,.1);
  function bevelBox(w,h,d){const key=`${w},${h},${d}`;if(boxCache.has(key))return boxCache.get(key);const s=new T.Shape();s.moveTo(-w/2,-h/2);s.lineTo(w/2,-h/2);s.lineTo(w/2,h/2);s.lineTo(-w/2,h/2);s.closePath();const g=new T.ExtrudeGeometry(s,{depth:d-.12,bevelEnabled:true,bevelSize:.06,bevelThickness:.06,bevelSegments:2,steps:1});g.translate(0,0,-(d-.12)/2);boxCache.set(key,g);return g;}
  function ground(x,z){return field.ground(x,z,z>-12?8:z>-49?1:-5);}
  function attach(obj,x,y,z){obj.position.set(x,y,z);scene.add(obj);decor.push({obj,x,y,z});return obj;}
  // Hundreds of curved leaf silhouettes with per-instance variation and no texture downloads.
  for(let type=0;type<4;type++){
    const inst=new T.InstancedMesh(leafGeo(1,.3),plantMats[type],420);let count=0;
    for(let i=0;i<75;i++){
      const x=(random()-.5)*43,z=-8+random()*40;if(Math.hypot(x/23,(z-8)/23)>.92)continue;
      const y=ground(x,z);if(y>4||y< -2)continue;
      for(let l=0;l<6;l++){
        m.position.set(x,y-.06,z);m.rotation.set(.35+random()*.65,l/6*Math.PI*2+random()*.4,(random()-.5)*.3);const s=.8+random()*1.4;m.scale.set(s,s*(.65+random()*.5),s);m.updateMatrix();if(count<420)inst.setMatrixAt(count++,m.matrix);
      }
    }inst.count=count;inst.castShadow=true;inst.receiveShadow=true;scene.add(inst);
  }
  // Delicate fern fans break up the broad-leaf silhouette.
  const fernMat=mat('#85a76b',.85);fernMat.side=T.DoubleSide;
  const fernLeaves=new T.InstancedMesh(leafGeo(.5,.09),fernMat,1300);let fi=0;
  for(let n=0;n<35;n++){const x=(random()-.5)*39,z=-7+random()*36;if(Math.hypot(x/21,(z-8)/21)>.95)continue;const y=ground(x,z);if(y>3||y< -1)continue;
    for(let f=0;f<5;f++){const angle=f/5*6.28+random()*.2,h=.8+random()*.9;for(let l=1;l<6;l++)for(const side of [-1,1]){const t=l/6,spread=Math.sin(t*Math.PI)*.38;m.position.set(x+Math.sin(angle)*t*.7,y+t*h,z+Math.cos(angle)*t*.7);m.rotation.set(.9,angle+side*1.1,side*.3);m.scale.setScalar((1-t*.7)*(.7+h*.25));m.updateMatrix();if(fi<1300)fernLeaves.setMatrixAt(fi++,m.matrix);}}
  }fernLeaves.count=fi;fernLeaves.receiveShadow=true;scene.add(fernLeaves);
  // Fern fronds, mushrooms and crystal clusters have authored profiles.
  for(let n=0;n<105;n++){
    const region=n<30?0:n<81?1:2,x=(random()-.5)*41,z=region===0?-9+random()*38:region===1?-16-random()*33:-55-random()*32;
    if(Math.hypot(x/22,(z-(region===0?8:region===1?-32:-71))/21)>.95)continue;
    const y=ground(x,z),g=new T.Group(),s=.45+random()*.8;
    if(region===1){
      for(let i=0;i<3+Math.floor(random()*4);i++){const h=.8+random()*3.4;const p=mesh(new T.CylinderGeometry(.22,.3,h,6,1),crystalMat,g,[(random()-.5)*1.4,h/2,(random()-.5)*1.4]);p.rotation.set((random()-.5)*.5,random()*6,(random()-.5)*.6);mesh(new T.ConeGeometry(.22,.6,6),crystalMat,p,[0,h/2+.28,0]);}
    }else{
      const h=1+random()*1.5;tube([[0,0,0],[.1,h*.5,.1],[0,h,0]],.09,stem,g,12);
      const points=[[0,.42],[.22,.4],[.58,.24],[.86,.08],[.93,0],[.9,-.08],[.5,-.14],[0,-.14]].map(p=>new T.Vector2(p[0]*s,p[1]*s));
      mesh(new T.LatheGeometry(points,24),mushMats[region],g,[0,h,0]);mesh(sculpt(.65*s,.07,.65*s),gill,g,[0,h-.08,0]);
      for(let q=0;q<7;q++){const a=random()*6.28,r=random()*.6*s;mesh(sculpt(.05,.025,.05),gill,g,[Math.cos(a)*r,h+.27*s,Math.sin(a)*r]);}
    }g.scale.setScalar(s);attach(g,x,y,z);
  }
  // Weathered arches make each excavation site legible at a distance.
  function arch(x,z,scale=1,region=0,rotation=0){
    const g=new T.Group(),material=region===2?stone:stoneDark;
    for(const sign of [-1,1]){
      for(let j=0;j<5;j++){const b=mesh(bevelBox(1.25,.86,1.3),material,g,[sign*3,j*.89+.43,0]);b.rotation.y=Math.sin(j*2+sign)*.045;b.rotation.z=sign*.025;mesh(bevelBox(1.45,.18,1.5),trim,g,[sign*3,j*.89+.8,0]);if(j===2){for(let q=0;q<3;q++){const rune=mesh(bevelBox(.07,.25,.025),gold,g,[sign*3+(q-1)*.19,j*.89+.42,.72]);rune.rotation.z=(q-1)*.35;}}}
      mesh(bevelBox(1.8,.35,1.8),stone,g,[sign*3,.15,0]);
    }
    for(let i=0;i<9;i++){const a=i/8*Math.PI,b=mesh(bevelBox(1.15,.85,1.25),material,g,[Math.cos(a)*3,4.3+Math.sin(a)*2.2,0]);b.rotation.z=a+Math.PI/2;}
    const sign=mesh(new T.TorusGeometry(.41,.05,8,24),gold,g,[0,6.48,.68]);sign.rotation.z=Math.PI/4;
    g.rotation.y=rotation;g.scale.setScalar(scale);attach(g,x,ground(x,z)-.2,z);return g;
  }
  arch(3,15,1.12,0);arch(8,-12,1.04,0,.1);arch(7,-20,.85,1);arch(-7,-47,.95,1);arch(-6,-56,1.06,2);arch(0,-83,1.6,2);
  // Ancient circular mosaic: cracks, inset radial marks and low foundations.
  function platform(x,z,r,region){const g=new T.Group();
    mesh(new T.CylinderGeometry(r,r+.25,.28,64),stoneDark,g,[0,-.05,0]);
    for(let i=0;i<3;i++){const ring=mesh(new T.TorusGeometry(r*(.45+i*.22),.035,5,72),trim,g,[0,.12,0]);ring.rotation.x=Math.PI/2;}
    for(let i=0;i<16;i++){const a=i/16*6.28;const line=mesh(new T.BoxGeometry(.075,.02,.65),trim,g,[Math.sin(a)*r*.83,.13,Math.cos(a)*r*.83]);line.rotation.y=a;}
    attach(g,x,ground(x,z)+.02,z);return g;
  }
  platform(0,13,4,0);platform(0,-73,8,2);
  for(let i=0;i<15;i++){
    const a=i/15*6.28,x=Math.sin(a)*17,z=-72+Math.cos(a)*15;
    const g=new T.Group(),h=2+random()*5;
    for(let n=0;n<Math.floor(h/.8);n++){const b=mesh(new T.CylinderGeometry(.7,.79,.79,8),stone,g,[0,n*.8+.4,0]);b.rotation.y=.2*n;}
    mesh(new T.BoxGeometry(1.9,.3,1.9),trim,g,[0,Math.floor(h/.8)*.8,0]);attach(g,x,ground(x,z),z);
  }
  // Copper root ribbons frame the ceiling and carry warm light.
  const bark=mat('#5a6351',.95);
  for(let i=0;i<10;i++){const x=-21+i*4.5;const g=tube([[x,15,15],[x+Math.sin(i)*3,14,4],[x+4,11,-4],[x+2,8,-9]],.22+(i%3)*.14,bark,scene,32);g.receiveShadow=true;
    for(let q=0;q<3;q++){const lg=mesh(leafGeo(1.8,.55),plantMats[i%4],scene,[x+q,13-q,9-q*5]);lg.rotation.set(1.6,0,i);}}
  const hanging=mat('#8fe1b0',.75,.05,'#3d856b',.3);
  for(let n=0;n<22;n++){const x=(random()-.5)*39,z=-5+random()*30,top=12+random()*3,len=2+random()*4;const g=new T.Group();tube([[0,0,0],[.2,-len*.3,0],[-.1,-len*.7,.2],[.25,-len,.1]],.025,bark,g,16);for(let q=0;q<8;q++){const a=q%2?-1:1;const l=mesh(leafGeo(.6,.19),hanging,g,[.1,-len*q/8,.1]);l.rotation.set(.6,0,a*1.3);}attach(g,x,top,z);}
  // Small mineral seams on the buried objectives tell the player where to dig.
  for(const [x,y,z,r]of [[-8,1,-4,3.7],[13,-5.8,-33,3.7],[-12,-1.7,5,3.3]]){
    for(let n=0;n<15;n++){const a=random()*6.28,dy=.2+random()*.8;const rr=r*Math.sqrt(1-dy*dy);const c=mesh(new T.OctahedronGeometry(.16+random()*.13,0),gold,scene,[x+Math.sin(a)*rr,y+dy*r/1.12,z+Math.cos(a)*rr]);c.rotation.set(random()*3,random()*3,random()*3);decor.push({obj:c,x:c.position.x,y:c.position.y+.4,z:c.position.z});}
  }
  // Stalactites and wall-foot stones keep the chamber surfaces from reading as a sphere.
  for(let n=0;n<65;n++){
    const region=n%3,cz=[8,-32,-71][region],a=random()*6.28,rx=[22,24,23][region],rz=[22,20,21][region],x=Math.sin(a)*rx,z=cz+Math.cos(a)*rz,y=ground(x,z);
    const rock=mesh(new T.IcosahedronGeometry(1,2),region===0?stoneDark:stone,scene,[x,y+.2,z],[.6+random()*1.8,.5+random()*1.2,.8+random()*1.3]);rock.rotation.set(random(),random()*6,random());decor.push({obj:rock,x,y,z});
    if(n%2===0){const h=1.5+random()*3,roof=[14,6,0][region];const pts=[[0,-h],[.1,-h*.85],[.3,-h*.35],[.65,0],[0,0]].map(p=>new T.Vector2(...p));mesh(new T.LatheGeometry(pts,9),region===0?stoneDark:stone,scene,[x*.8,roof,z]);}
  }
  // Light pools are limited to a few significant lights; the rest use emissive surfaces.
  const lights=[[-9,8,9,'#ffe1a4',36,27],[10,6,-7,'#d6f7ac',17,20],[-12,2,-28,'#55cde5',28,27],[18,1,-38,'#6eb1ff',26,25],[0,-2,-70,'#ffbf74',42,29],[-15,-5,-63,'#8fcddd',15,22]];
  for(const [x,y,z,c,intensity,dist]of lights){const l=new T.PointLight(c,intensity,dist,1.2);l.position.set(x,y,z);scene.add(l);}
  // Soft shafts use a transparent cone, subtle enough to preserve gameplay visibility.
  const shaftMat=new T.MeshBasicMaterial({color:'#dfefb9',transparent:true,opacity:.025,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending});
  for(let i=0;i<4;i++){const beam=mesh(new T.CylinderGeometry(.3,3.1,17,24,1,true),shaftMat,scene,[-9+i*6,9,5-i*3]);beam.rotation.z=-.25;beam.castShadow=false;}
  const particles=600,p=new Float32Array(particles*3),colors=new Float32Array(particles*3);
  for(let i=0;i<particles;i++){p[i*3]=(random()-.5)*45;p[i*3+1]=-9+random()*25;p[i*3+2]=30-random()*117;const c=new T.Color(p[i*3+2]>-15?'#dfe7a3':p[i*3+2]>-50?'#86e5e6':'#edc17b');colors.set([c.r,c.g,c.b],i*3);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(p,3));geo.setAttribute('color',new T.BufferAttribute(colors,3));const dust=new T.Points(geo,new T.PointsMaterial({size:.065,vertexColors:true,transparent:true,opacity:.7,depthWrite:false,blending:T.AdditiveBlending}));scene.add(dust);
  // A quiet companion, visible as a breathing lantern beside each checkpoint.
  const checkpoints=[[0,0,19],[4,-7,-24],[-7,-13,-59]].map((p,i)=>{
    const g=new T.Group(),y=ground(p[0],p[2]);mesh(new T.CylinderGeometry(.8,1,.35,12),stone,g,[0,.1,0]);
    mesh(new T.TorusGeometry(.42,.09,8,32),gold,g,[0,1.22,0]).rotation.x=Math.PI/2;
    const orb=mesh(sculpt(.27,.46,.27),mat('#e2ffbd',.2,.2,'#bdffa3',3),g,[0,1.45,0]);
    const l=new T.PointLight('#b4f4bd',3,8);l.position.y=1.6;g.add(l);attach(g,p[0],y,p[2]);animated.push({obj:orb,base:1.45});return {pos:new T.Vector3(p[0],y+.1,p[2]),obj:g,i};
  });
  const seeds=[[-8,1,-4],[13,-5.8,-33],[0,-11,-77]].map((p,i)=>{
    const g=new T.Group(),glow=mat(['#d4f7a2','#91f1ef','#ffd48b'][i],.23,.4,['#9fe764','#5bdddf','#ffba50'][i],2.2);
    const core=mesh(new T.OctahedronGeometry(.53,1),glow,g);core.scale.y=1.4;
    for(let n=0;n<2;n++){const r=mesh(new T.TorusGeometry(.85+n*.15,.035,6,48),gold,g);r.rotation.x=Math.PI/3+n*.8;r.rotation.y=n;}
    const light=new T.PointLight(['#ddff93','#67efff','#ffc46d'][i],4,8);g.add(light);scene.add(g);g.position.set(...p);return {obj:g,pos:new T.Vector3(...p),core,i,collected:false};
  });
  const seals=[[-9,-5.2,-34],[13,-5.4,-33]].map((p,i)=>{
    const g=new T.Group();mesh(sculpt(.65,.9,.5,'fist'),stoneDark,g);const ring=mesh(new T.TorusGeometry(.38,.065,6,40),mat('#87cbd4',.4,.3,'#328499',.6),g,[0,.13,.46]);ring.rotation.z=Math.PI/4;scene.add(g);g.position.set(...p);return {obj:g,pos:new T.Vector3(...p),active:false,ring,i};
  });
  const treasures=[[-12,-6.7,2],[-21,-6.6,-38],[18,-11.6,-79]].map((p,i)=>{
    const g=new T.Group(),lid=new T.Group();mesh(bevelBox(1.2,.6,.85),stoneDark,g,[0,.1,0]);lid.position.set(0,.42,-.4);g.add(lid);mesh(bevelBox(1.25,.2,.9),gold,lid,[0,0,.4]);for(const x of [-.42,.42])mesh(bevelBox(.1,.72,.92),gold,g,[x,.15,0]);mesh(new T.TorusGeometry(.2,.035,6,24),gold,g,[0,.2,.48]);const light=mesh(new T.OctahedronGeometry(.18,1),mat('#c8ffe4',.2,.3,'#7effc9',2),g,[0,.72,0]);g.position.set(...p);scene.add(g);return {obj:g,pos:new T.Vector3(...p),lid,light,opened:false,i};
  });
  const finale=new T.Group();mesh(new T.TorusGeometry(2.5,.11,10,80),gold,finale).rotation.x=Math.PI/2;
  for(let i=0;i<3;i++){const a=i/3*6.28;mesh(new T.OctahedronGeometry(.45,0),mat('#9ffbd4',.3,.4,'#7effcf',2),finale,[Math.sin(a)*2.5,.5,Math.cos(a)*2.5]);}finale.position.set(0,-11.6,-81);scene.add(finale);
  // Static authored groups are batched by material, while each destructible decoration
  // retains its own root so undermined ruins can still disappear correctly.
  for(const {obj} of decor){
    if(!obj.isGroup)continue;let hasLight=false;obj.traverse(c=>{if(c.isLight)hasLight=true;});if(hasLight)continue;
    obj.updateMatrixWorld(true);const inverse=obj.matrixWorld.clone().invert(),batches=new Map(),old=[];
    obj.traverse(c=>{if(!c.isMesh||Array.isArray(c.material))return;const g=c.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,c.matrixWorld));if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));if(!batches.has(c.material))batches.set(c.material,[]);batches.get(c.material).push(g);old.push(c);});
    old.forEach(c=>c.parent.remove(c));for(const [material,list]of batches){const g=mergeGeometries(list,false);if(g){g.computeBoundingSphere();mesh(g,material,obj);}list.forEach(g=>g.dispose());}
  }
  for(const d of decor){d.obj.updateMatrixWorld(true);d.box=new T.Box3().setFromObject(d.obj);d.removed=false;}
  const sightRay=new T.Ray();
  return {decor,checkpoints,seeds,seals,treasures,finale,occlude(from,to){const direction=to.clone().sub(from),length=direction.length();sightRay.set(from,direction.normalize());for(const d of decor){if(d.removed)continue;const hit=sightRay.intersectBox(d.box,new T.Vector3());d.obj.visible=!(hit&&hit.distanceTo(from)<length-1.1);}},update(t){dust.rotation.y=Math.sin(t*.035)*.03;dust.position.y=Math.sin(t*.2)*.2;for(const a of animated)a.obj.position.y=a.base+Math.sin(t*2)*.1;for(const s of seeds){s.core.rotation.y=t*.7;s.core.position.y=Math.sin(t*2+s.i)*.12;s.obj.rotation.y=.1*Math.sin(t*.3);}for(const c of treasures){c.light.rotation.y=t;c.lid.rotation.x+=(c.opened?-1.7-c.lid.rotation.x:-c.lid.rotation.x)*.08;}finale.rotation.y=t*.08;},prune(){for(const d of decor){if(!d.removed&&field.sample(d.x,d.y-.25,d.z)<-.65&&d.y> -20){d.removed=true;d.obj.visible=false;}}}};
}
