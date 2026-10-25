import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TerrainField} from '../src/terrain.js';
import {resolveCapsule,capsuleHull} from '../src/physics.js';

test('excavated floor has no ghost collision at the old surface',()=>{
  const f=new TerrainField(),y=f.ground(4,13,5),p={x:4,y:y+.02,z:13},v={x:0,y:0,z:0};
  f.carve(4,y-1.05,12.65,1.65);
  for(let i=0;i<180;i++){v.y-=27/120;p.y+=v.y/120;resolveCapsule(f,p,v);}
  assert.ok(p.y<y-1,`feet must descend into the hole, got ${p.y}, old floor ${y}`);
  assert.ok(f.sample(p.x,p.y+1,p.z)<0);
});
test('capsule traverses a curved CSG tunnel with an intact floor',()=>{
  const f=new TerrainField();
  for(let z=-11;z>=-20;z-=.7)f.carve(9,1.3,z,1.85,true,-.1);
  const p={x:9,y:.05,z:-11},v={x:0,y:0,z:-5};
  for(let i=0;i<220;i++){v.y=0;v.z=-5;p.z+=v.z/120;resolveCapsule(f,p,v);}
  assert.ok(p.z< -18,`stopped at ${p.z}`);assert.ok(p.y>-2);
  assert.ok(capsuleHull().every(([x,y,z])=>f.sample(p.x+x,p.y+y,p.z+z)<.06));
});
