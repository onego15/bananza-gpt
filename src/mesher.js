import * as T from 'three';
import {SIZE,ORIGIN,CHUNK,STEP} from './terrain.js';
const corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
const tets=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
export function terrainMaterial(){
  const mat=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.94,metalness:.04});
  mat.userData.hero={value:new T.Vector3()};mat.userData.cutaway={value:0};
  mat.onBeforeCompile=s=>{
    s.uniforms.uHero=mat.userData.hero;s.uniforms.uCutaway=mat.userData.cutaway;
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRockPos;').replace('#include <begin_vertex>','#include <begin_vertex>\nvRockPos=position;');
    s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 vRockPos;
uniform vec3 uHero;uniform float uCutaway;
float hashRock(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float rockNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hashRock(i),hashRock(i+vec3(1,0,0)),f.x),mix(hashRock(i+vec3(0,1,0)),hashRock(i+vec3(1,1,0)),f.x),f.y),mix(mix(hashRock(i+vec3(0,0,1)),hashRock(i+vec3(1,0,1)),f.x),mix(hashRock(i+vec3(0,1,1)),hashRock(i+vec3(1,1,1)),f.x),f.y),f.z);}
`);
    s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
if(uCutaway>.5){vec3 axis=cameraPosition-uHero;float t=dot(vRockPos-uHero,axis)/dot(axis,axis);vec3 off=vRockPos-uHero-axis*t;if(t>.075&&t<1.15&&length(off)<1.1+t*1.65)discard;}
float grain=rockNoise(vRockPos*2.6)*.18+rockNoise(vRockPos*8.0)*.10+rockNoise(vRockPos*.34)*.18;
float strata=sin(vRockPos.y*4.3+rockNoise(vRockPos*.25)*5.);
diffuseColor.rgb*=.71+grain+strata*.035;
`);
  };return mat;
}
export class TerrainMesh {
  constructor(scene,field){this.scene=scene;this.field=field;this.material=terrainMaterial();this.chunks=new Map();this.rebuilds=0;}
  buildAll(){for(let k=0;k<Math.ceil((SIZE[2]-1)/CHUNK);k++)for(let j=0;j<Math.ceil((SIZE[1]-1)/CHUNK);j++)for(let i=0;i<Math.ceil((SIZE[0]-1)/CHUNK);i++)this.build(i,j,k);this.field.dirty.clear();}
  flush(limit=5){for(const key of this.field.dirty){this.build(...key.split(',').map(Number));this.field.dirty.delete(key);if(--limit<=0)break;}}
  build(cx,cy,cz){
    const field=this.field,ps=[],ns=[],cs=[];const cv=new T.Color(),earth=new T.Color('#a99369'),moss=new T.Color('#526c4c'),rock=new T.Color('#6b8294'),crys=new T.Color('#718b98'),basalt=new T.Color('#7d777d');
    const vv=Array.from({length:8},()=>({p:[0,0,0],n:[0,1,0],d:0}));
    function edge(a,b){const av=vv[a],bv=vv[b],t=av.d/(av.d-bv.d);return {p:av.p.map((v,i)=>v+(bv.p[i]-v)*t),n:av.n.map((v,i)=>v+(bv.n[i]-v)*t)};}
    function tri(a,b,c){
      const u=b.p.map((v,i)=>v-a.p[i]),v=c.p.map((n,i)=>n-a.p[i]);const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
      if(cross[0]*a.n[0]+cross[1]*a.n[1]+cross[2]*a.n[2]<0)[b,c]=[c,b];
      for(const vert of [a,b,c]){const p=vert.p,n=vert.n,len=Math.hypot(...n)||1;ps.push(...p);ns.push(n[0]/len,n[1]/len,n[2]/len);
        if(p[2]>-16){cv.copy(earth);if(n[1]/len>.38&&p[1]>-2)cv.lerp(moss,Math.min(.7,(n[1]/len-.38)*1.4));}
        else if(p[2]>-51)cv.copy(rock).lerp(crys,(Math.sin(p[0]*.4+p[1]*.7)+1)*.25);else cv.copy(basalt);
        const shade=.88+.12*Math.sin(p[0]*.31+p[2]*.23);cv.multiplyScalar(shade);cs.push(cv.r,cv.g,cv.b);
      }
    }
    for(let k=cz*CHUNK;k<Math.min((cz+1)*CHUNK,SIZE[2]-1);k++)for(let j=cy*CHUNK;j<Math.min((cy+1)*CHUNK,SIZE[1]-1);j++)for(let i=cx*CHUNK;i<Math.min((cx+1)*CHUNK,SIZE[0]-1);i++){
      let neg=0,pos=0;for(let q=0;q<8;q++){const [a,b,c]=corners[q],ix=i+a,iy=j+b,iz=k+c,d=field.grid(ix,iy,iz);vv[q].d=d;if(d<0)neg++;else pos++;vv[q].p=[ix*STEP+ORIGIN[0],iy*STEP+ORIGIN[1],iz*STEP+ORIGIN[2]];}
      if(!neg||!pos)continue;
      for(let q=0;q<8;q++){const [a,b,c]=corners[q],ix=i+a,iy=j+b,iz=k+c;vv[q].n=[field.grid(ix-1,iy,iz)-field.grid(ix+1,iy,iz),field.grid(ix,iy-1,iz)-field.grid(ix,iy+1,iz),field.grid(ix,iy,iz-1)-field.grid(ix,iy,iz+1)];}
      for(const tet of tets){const a=tet.filter(n=>vv[n].d>=0),b=tet.filter(n=>vv[n].d<0);if(a.length===1)tri(edge(a[0],b[0]),edge(a[0],b[1]),edge(a[0],b[2]));else if(a.length===3)tri(edge(b[0],a[0]),edge(b[0],a[1]),edge(b[0],a[2]));else if(a.length===2){const p=edge(a[0],b[0]),q=edge(a[0],b[1]),r=edge(a[1],b[0]),s=edge(a[1],b[1]);tri(p,q,r);tri(q,s,r);}}
    }
    const key=`${cx},${cy},${cz}`,old=this.chunks.get(key);if(old){old.geometry.dispose();this.scene.remove(old);this.chunks.delete(key);}
    if(ps.length){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(ps,3));geo.setAttribute('normal',new T.Float32BufferAttribute(ns,3));geo.setAttribute('color',new T.Float32BufferAttribute(cs,3));geo.computeBoundingSphere();const mesh=new T.Mesh(geo,this.material);mesh.receiveShadow=true;mesh.castShadow=false;mesh.userData.terrain=true;this.scene.add(mesh);this.chunks.set(key,mesh);}this.rebuilds++;
  }
}
