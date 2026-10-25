// A shared scalar field drives both the smooth surface and capsule collisions.
// Values > 0 are rock, values < 0 are air. All edits are persistent sphere CSG.
export const STEP = .75;
export const ORIGIN = [-36, -25, -96];
export const SIZE = [97, 63, 177];
export const CHUNK = 12;
const ANCHORS=[[0,19],[4,-24],[-7,-59]];
const ANCHOR_BASES=ANCHORS.map(([x,z])=>[x,z,floorAt(x,z)+.25]);
const ROCK_STACKS=[[-15,12,2.8,10],[16,3,2.4,13],[-16,-29,2.8,5],[19,-39,3.3,7],[14,-72,2.5,3],[-17,-76,2.6,2]].map(([x,z,r,top])=>[x,z,r,top,floorAt(x,z)-1]);
const GEODES=[[-8,1,-4,3.7],[13,-5.8,-33,3.7],[-12,-1.7,5,3.3],[-21,-6.6,-38,2.7],[18,-11.6,-79,2.8]];
export const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
export function floorAt(x,z) {
  const base = z > -12 ? 0 : z > -47 ? -7 : -13;
  return base + Math.sin(x*.18+z*.065)*.65 + Math.sin(z*.2)*.45 + Math.cos(x*.33-z*.14)*.23;
}
function chamber(x,y,z,cx,cz,rx,rz,base,roof) {
  const r = Math.hypot((x-cx)/rx,(z-cz)/rz);
  const undulation = Math.sin(x*.31+z*.12)*.6 + Math.sin(z*.29-x*.16)*.5 + Math.sin(y*.62+x*.26+z*.21)*.65 + Math.sin(y*1.43-z*.53)*.17;
  const ground = base + Math.sin(x*.18+z*.065)*.65 + Math.sin(z*.2)*.45 + Math.cos(x*.33-z*.14)*.23;
  return Math.max((r-1)*Math.min(rx,rz)+undulation, ground-y, y-(roof-4*r*r+undulation));
}
function hall(x,y,z,ax,az,bx,bz,ay,by,r=5) {
  const dx=bx-ax,dz=bz-az,t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);
  const ground=ay+(by-ay)*t;
  return Math.max(Math.hypot(x-ax-dx*t,z-az-dz*t)-r,ground-y,y-ground-8);
}
export function baseDensity(x,y,z) {
  let d=Math.min(
    chamber(x,y,z,0,8,24,24,0,18),
    chamber(x,y,z,3,-32,26,22,-7,11),
    chamber(x,y,z,-1,-71,25,23,-13,5),
    hall(x,y,z,9,-6,7,-29,0,-7,5),
    hall(x,y,z,-7,-43,-7,-63,-7,-13,5),
    // A buried chamber reached by excavating the marked floor.
    chamber(x,y,z,-12,-4,6,7,-8,-3),
    hall(x,y,z,-12,-6,-3,-27,-8,-7,3)
  );
  // A geological seam seals each route. It can be cut anywhere.
  if(z < -13 && z > -16.7) d=Math.max(d,Math.min(-13-z,z+16.7,7-y,y+6));
  if(z < -49 && z > -52.6) d=Math.max(d,Math.min(-49-z,z+52.6,1-y,y+14));
  // Natural sculpted rock stacks. They are part of the editable terrain.
  const ripple=Math.sin(y*1.4)*.2;
  for(const [px,pz,rad,top,ground] of ROCK_STACKS) {
    d=Math.max(d,Math.min(rad+ripple-Math.hypot(x-px,z-pz),top-y,y-ground));
  }
  for(const [px,py,pz,r] of GEODES){
    d=Math.max(d,r-Math.hypot(x-px,(y-py)*1.12,z-pz));
  }
  return d;
}
export class TerrainField {
  constructor(edits=[]) {
    const [nx,ny,nz]=SIZE; this.data=new Float32Array(nx*ny*nz);this.edits=[];this.dirty=new Set();this.changed=0;
    for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)this.data[this.index(i,j,k)]=baseDensity(i*STEP+ORIGIN[0],j*STEP+ORIGIN[1],k*STEP+ORIGIN[2]);
    for(const e of edits)this.carve(e[0],e[1],e[2],e[3],false,e[5]??-100);
    this.edits=edits.map(e=>[...e]);
  }
  index(i,j,k){return i+SIZE[0]*(j+SIZE[1]*k);}
  grid(i,j,k){return this.data[this.index(clamp(i,0,SIZE[0]-1),clamp(j,0,SIZE[1]-1),clamp(k,0,SIZE[2]-1))];}
  sample(x,y,z) {
    const gx=(x-ORIGIN[0])/STEP,gy=(y-ORIGIN[1])/STEP,gz=(z-ORIGIN[2])/STEP;
    if(gx<0||gy<0||gz<0||gx>=SIZE[0]-1||gy>=SIZE[1]-1||gz>=SIZE[2]-1)return 10;
    const i=Math.floor(gx),j=Math.floor(gy),k=Math.floor(gz),a=gx-i,b=gy-j,c=gz-k;
    const l=(p,q,t)=>p+(q-p)*t;
    return l(l(l(this.grid(i,j,k),this.grid(i+1,j,k),a),l(this.grid(i,j+1,k),this.grid(i+1,j+1,k),a),b),l(l(this.grid(i,j,k+1),this.grid(i+1,j,k+1),a),l(this.grid(i,j+1,k+1),this.grid(i+1,j+1,k+1),a),b),c);
  }
  gradient(x,y,z) {
    const h=.24;let a=this.sample(x+h,y,z)-this.sample(x-h,y,z),b=this.sample(x,y+h,z)-this.sample(x,y-h,z),c=this.sample(x,y,z+h)-this.sample(x,y,z-h);const l=Math.hypot(a,b,c)||1;
    return [-a/l,-b/l,-c/l]; // outward from rock, toward air
  }
  materialAt(x,y,z) {
    if(z < -49)return 'basalt';
    if(z < -14)return 'crystal';
    return y< -2?'rock':'earth';
  }
  carve(x,y,z,r,record=true,minY=-100) {
    if(![x,y,z,r].every(Number.isFinite)||r<=0)return 0;
    // The bottommost bedrock protects against an endless fall.
    y=Math.max(-21,y);r=clamp(r,.3,5);
    const protectedAnchors=ANCHOR_BASES.filter(([ax,az])=>Math.hypot(ax-x,az-z)<r+2.5);
    const min=[x-r-1,y-r-1,z-r-1].map((n,a)=>clamp(Math.floor((n-ORIGIN[a])/STEP),0,SIZE[a]-1));
    const max=[x+r+1,y+r+1,z+r+1].map((n,a)=>clamp(Math.ceil((n-ORIGIN[a])/STEP),0,SIZE[a]-1));
    let n=0;
    for(let k=min[2];k<=max[2];k++)for(let j=min[1];j<=max[1];j++)for(let i=min[0];i<=max[0];i++){
      const wx=i*STEP+ORIGIN[0],wy=j*STEP+ORIGIN[1],wz=k*STEP+ORIGIN[2];
      if(wy< -23)continue;
      // Checkpoint foundations remain connected to bedrock. Returning to a lamp
      // must stay safe even when the player excavates everything around it.
      if(protectedAnchors.length&&protectedAnchors.some(([ax,az,top])=>(wx-ax)**2+(wz-az)**2<1.35**2&&wy<top))continue;
      const idx=this.index(i,j,k),v=Math.min(r-Math.hypot(wx-x,wy-y,wz-z),wy-minY),old=this.data[idx];
      if(-v<old){if(old>0&&v>0)n++;this.data[idx]=-v;}
    }
    if(record&&n>0){this.edits.push([+x.toFixed(3),+y.toFixed(3),+z.toFixed(3),r,false,minY]);this.changed+=n;}
    for(let k=Math.max(0,Math.floor((min[2]-1)/CHUNK));k<=Math.floor(max[2]/CHUNK);k++)for(let j=Math.max(0,Math.floor((min[1]-1)/CHUNK));j<=Math.floor(max[1]/CHUNK);j++)for(let i=Math.max(0,Math.floor((min[0]-1)/CHUNK));i<=Math.floor(max[0]/CHUNK);i++)this.dirty.add(`${i},${j},${k}`);
    return n;
  }
  ground(x,z,from=19) {
    let prev=this.sample(x,from,z);
    for(let y=from-.35;y> -24;y-=.35){let v=this.sample(x,y,z);if(v>=0&&prev<0){let a=y,b=y+.35;for(let n=0;n<6;n++){const m=(a+b)/2;if(this.sample(x,m,z)>0)a=m;else b=m;}return (a+b)/2;}prev=v;}
    return -23;
  }
}
