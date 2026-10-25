const hullCache=new Map();
export function capsuleHull(radius=.43,height=2.2){
  const key=`${radius}/${height}`;if(hullCache.has(key))return hullCache.get(key);
  const hull=[[0,0,0],[0,height,0]];
  for(const [h,r]of [[radius*.28,radius*.7],[radius,radius],[height*.5,radius],[height-radius,radius],[height-radius*.28,radius*.7]])for(let i=0;i<8;i++){const a=i*Math.PI/4;hull.push([Math.sin(a)*r,h,Math.cos(a)*r]);}
  hullCache.set(key,hull);return hull;
}
// CSG unions are not exact signed distances inside overlapping air volumes.
// Probe the actual zero-isosurface on the capsule hull to avoid ghost floors.
export function resolveCapsule(field,pos,vel,radius=.43,height=2.2){
  let grounded=false;const probes=capsuleHull(radius,height);
  for(let iter=0;iter<4;iter++){
    let corrected=false;
    for(const [ox,oy,oz]of probes){const x=pos.x+ox,y=pos.y+oy,z=pos.z+oz,d=field.sample(x,y,z);if(d>-.004){const n=field.gradient(x,y,z),depth=Math.min(.6,d+.008);pos.x+=n[0]*depth;pos.y+=n[1]*depth;pos.z+=n[2]*depth;const dot=vel.x*n[0]+vel.y*n[1]+vel.z*n[2];if(dot<0){vel.x-=n[0]*dot;vel.y-=n[1]*dot;vel.z-=n[2]*dot;}if(n[1]>.48&&oy<radius*1.2)grounded=true;corrected=true;}}
    if(!corrected)break;
  }return grounded;
}
