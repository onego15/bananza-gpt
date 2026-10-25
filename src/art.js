import * as T from 'three';
export const rng=(seed=34)=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
export function mat(color,roughness=.65,metalness=0,emissive=0,intensity=0){return new T.MeshStandardMaterial({color,roughness,metalness,emissive,emissiveIntensity:intensity});}
export function textured(material,scale=42,strength=.12){material.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vArtPoint;').replace('#include <begin_vertex>','#include <begin_vertex>\nvArtPoint=(modelMatrix*vec4(position,1.)).xyz;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vArtPoint;').replace('#include <color_fragment>',`#include <color_fragment>\nfloat speckle=fract(sin(dot(floor(vArtPoint*${scale.toFixed(1)}),vec3(12.9898,78.233,56.425)))*43758.5453);diffuseColor.rgb*=${(1-strength*.5).toFixed(3)}+speckle*${strength.toFixed(3)};`);};material.customProgramCacheKey=()=>`grain${scale}-${strength}`;return material;}
export function mesh(geo,material,parent,pos=[0,0,0],scale){const m=new T.Mesh(geo,material);m.position.set(...pos);if(scale)m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent?.add(m);return m;}
export function sculpt(rx,ry,rz,kind='bean',seed=0){
  const w=32,h=24,ps=[],uv=[],idx=[];
  for(let j=0;j<=h;j++){const v=j/h,ph=v*Math.PI;for(let i=0;i<=w;i++){const u=i/w,th=u*Math.PI*2;let shape=1+.018*Math.sin(th*5+ph*7+seed)*Math.sin(ph);
    let x=Math.sin(ph)*Math.cos(th),y=Math.cos(ph),z=Math.sin(ph)*Math.sin(th);
    if(kind==='body'){shape*=1-.16*y;x*=1-.12*y;z*=1+.12*y;}
    if(kind==='head'){x*=1+.14*y;z*=1+.18*(-y);y+=.06*Math.sin(ph*2);}
    if(kind==='fist'){x=Math.sign(x)*Math.pow(Math.abs(x),.8);y=Math.sign(y)*Math.pow(Math.abs(y),.85);z=Math.sign(z)*Math.pow(Math.abs(z),.75);}
    if(kind==='ear'){x*=.7+.3*v;z+=.2*Math.sin(ph);}
    ps.push(x*rx*shape,y*ry*shape,z*rz*shape);uv.push(u,v);
  }}
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){const a=j*(w+1)+i,b=a+w+1;idx.push(a,a+1,b,b,a+1,b+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(ps,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
export function tube(points,r,material,parent,segments=24){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),segments,r,7,false),material,parent);}
export function leafGeo(length=1,width=.35){
  const ps=[],uv=[],ids=[];for(let j=0;j<=8;j++){const t=j/8,w=Math.sin(t*Math.PI)*width;for(let k=0;k<3;k++){const x=(k-1)*w;ps.push(x,t*length,Math.sin(t*Math.PI)*length*.22-Math.abs(k-1)*w*.26);uv.push(k/2,t);}}
  for(let j=0;j<8;j++)for(let k=0;k<2;k++){const a=j*3+k;ids.push(a,a+3,a+1,a+1,a+3,a+4);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(ps,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ids);g.computeVertexNormals();return g;
}
export function makeHero(){
  const root=new T.Group(),rig=new T.Group();root.add(rig);
  const fur=mat('#d39052',.88),cream=mat('#fff0ca',.85),dark=mat('#273533',.45),copper=mat('#c88d42',.34,.5),edge=mat('#f2c878',.35,.48),teal=mat('#236c63',.85),inner=mat('#b77154'),black=mat('#102923',.22),light=mat('#fdf7dd',.25),rune=mat('#95ffe0',.3,.4,'#60ffd3',2.5);
  textured(fur,55,.13);textured(cream,62,.08);textured(teal,75,.17);
  const body=mesh(sculpt(.65,.9,.47,'body'),fur,rig,[0,1.2,0]);
  mesh(sculpt(.48,.65,.13),cream,rig,[0,1.15,.38]);
  const head=new T.Group();head.position.set(0,2.08,.03);rig.add(head);
  mesh(sculpt(.72,.62,.54,'head'),fur,head);
  mesh(sculpt(.55,.32,.39,'head'),cream,head,[0,-.17,.36]);
  mesh(sculpt(.2,.145,.16,'head'),dark,head,[0,-.05,.72]);
  // Brows and sculpted ears establish a readable silhouette from either side.
  for(const s of [-1,1]){
    const ear=new T.Group();ear.position.set(s*.54,.42,-.03);ear.rotation.z=-s*.36;head.add(ear);
    mesh(sculpt(.27,.47,.15,'ear'),fur,ear,[0,.15,0]);mesh(sculpt(.16,.31,.05,'ear'),inner,ear,[0,.19,.13]);
    mesh(sculpt(.19,.24,.105),dark,head,[s*.335,.05,.47]);
    mesh(sculpt(.13,.175,.07),light,head,[s*.335,.065,.546]);
    mesh(sculpt(.071,.105,.045),black,head,[s*.315,.047,.604]);
    mesh(sculpt(.026,.036,.019),light,head,[s*.29,.105,.643]);
    const brow=mesh(sculpt(.22,.075,.1),fur,head,[s*.34,.28,.48]);brow.rotation.z=s*-.15;
    for(let q=0;q<3;q++){const tuft=mesh(leafGeo(.26,.12),fur,head,[s*(.59+q*.013),-.15+q*.13,.07]);tuft.rotation.z=s*(-1.1+q*.12);tuft.rotation.y=s*.6;}
  }
  tube([[-.15,-.23,.65],[0,-.27,.69],[.15,-.23,.65]],.018,dark,head,12);
  for(let i=0;i<3;i++){const tuft=mesh(leafGeo(.36,.13),fur,head,[(i-1)*.15,.48,-.05]);tuft.rotation.z=(i-1)*-.45;tuft.rotation.x=-.3;}
  // Layered back armour follows the body's curvature, rather than stacked primitives.
  for(let row=0;row<4;row++)for(let col=0;col<3;col++){const plate=mesh(sculpt(.245,.29,.095,'fist'),row%2?copper:fur,rig,[(col-1)*.32,.8+row*.29,-.4-Math.sin(row/3*Math.PI)*.13]);plate.rotation.x=.15;plate.rotation.z=(col-1)*-.18;}
  mesh(new T.TorusGeometry(.43,.115,9,40),teal,rig,[0,1.86,.01]).rotation.x=Math.PI/2;
  const scarf=tube([[.16,1.82,-.18],[.5,1.72,-.65],[.62,1.57,-1.1],[.4,1.52,-1.35]],.12,teal,rig);
  const arms=[],legs=[];
  for(const s of [-1,1]){
    const a=new T.Group();a.position.set(s*.62,1.65,0);rig.add(a);arms.push(a);
    mesh(sculpt(.22,.44,.24),fur,a,[s*.1,-.28,0]);
    const fist=new T.Group();fist.position.set(s*.2,-.68,.15);a.add(fist);
    mesh(sculpt(.43,.41,.4,'fist'),copper,fist);
    mesh(sculpt(.36,.15,.32,'fist'),edge,fist,[0,.3,0]);
    for(let f=0;f<3;f++){mesh(sculpt(.12,.18,.16,'fist'),edge,fist,[(f-1)*.215,-.02,.31]);tube([[(f-1)*.215,-.13,.35],[(f-1)*.215,-.22,.48],[(f-1)*.215,-.25,.54]],.055,cream,fist,7);}
    mesh(sculpt(.16,.22,.19),copper,fist,[s*-.35,-.02,.1]);
    const sig=mesh(new T.TorusGeometry(.18,.027,6,24),rune,fist,[0,.07,.38]);sig.rotation.z=Math.PI/4;
    const l=new T.Group();l.position.set(s*.32,.63,.01);rig.add(l);legs.push(l);
    mesh(sculpt(.23,.34,.24),fur,l,[0,-.18,0]);mesh(sculpt(.28,.19,.38,'fist'),dark,l,[0,-.45,.16]);
    for(let f=0;f<3;f++)mesh(sculpt(.055,.055,.12),cream,l,[(f-1)*.14,-.44,.48]);
  }
  tube([[0,.65,-.35],[0,.5,-.8],[.12,.35,-1.06],[.22,.37,-1.25]],.14,fur,rig);
  const trail=mesh(new T.TorusGeometry(.9,.035,5,38,Math.PI*1.15),new T.MeshBasicMaterial({color:'#b6ffe1',transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false}),rig,[-.45,1.4,.55]);trail.rotation.y=-.5;trail.castShadow=false;
  return {root,rig,head,arms,legs,scarf,animate(t,speed,attack,grounded,charge=0){
    const walk=Math.sin(t*13)*Math.min(1,speed/5);rig.position.y=Math.abs(walk)*.075;rig.rotation.z=-walk*.035;rig.rotation.x=speed>6?.1:0;head.rotation.y=Math.sin(t*.8)*.035;head.rotation.x=grounded?Math.sin(t*2)*.025:-.1;
    legs[0].rotation.x=walk*.75;legs[1].rotation.x=-walk*.75;
    for(let i=0;i<2;i++){const sign=i===0?1:-1;arms[i].rotation.x=-walk*.32*sign;arms[i].rotation.z=sign*.08;if(attack>0){const hit=Math.sin(Math.min(1,attack)*Math.PI);arms[i].rotation.x=-hit*(i===0?2.2:.5);arms[i].rotation.z=sign*(.08+hit*.22);}if(charge>0){arms[i].rotation.x=-2.5;arms[i].rotation.z=sign*.45;}}
    scarf.rotation.z=Math.sin(t*5)*.05*(1+speed*.1);
    trail.visible=attack>.1;trail.material.opacity=Math.sin(attack*Math.PI)*.6;trail.rotation.z=-attack*2;
  }};
}
export function makeEnemy(kind='crawler'){
  const root=new T.Group(),legs=[];const shell=mat(kind==='boss'?'#4e5e69':'#496575',.55,.25),rim=mat('#bbc8bc',.5,.35),glow=mat('#f8a962',.35,.3,'#ff842b',2.3),dark=mat('#243841');
  const scale=kind==='boss'?3:1;
  const body=mesh(sculpt(.85,.55,1,'fist'),shell,root,[0,.85,0]);
  for(let i=0;i<4;i++){const p=mesh(sculpt(.74-i*.07,.12,.14,'fist'),rim,root,[0,1.25,-.48+i*.31]);p.rotation.x=(i-1.5)*-.13;}
  for(const s of [-1,1]){mesh(sculpt(.16,.12,.07),glow,root,[s*.32,.95,.9]);for(let n=0;n<3;n++){const g=new T.Group();g.position.set(s*.66,.7,-.65+n*.65);root.add(g);tube([[0,0,0],[s*.5,-.1,.1],[s*.68,-.58,.26]],.09,dark,g,10);mesh(sculpt(.15,.12,.19,'fist'),shell,g,[s*.68,-.6,.26]);legs.push(g);}}
  if(kind==='boss'){mesh(sculpt(.37,.43,.12,'fist'),glow,root,[0,1.1,1.05]);for(let i=0;i<5;i++){const c=mesh(new T.ConeGeometry(.22,1,5),rim,root,[(i-2)*.32,1.7,-.25]);c.rotation.z=(i-2)*-.25;}}
  root.scale.setScalar(scale);
  return {root,body,legs,animate(t,speed){body.rotation.z=Math.sin(t*3)*.045;legs.forEach((l,i)=>{l.rotation.x=Math.sin(t*9+i)*.4*Math.min(1,speed);});}};
}
