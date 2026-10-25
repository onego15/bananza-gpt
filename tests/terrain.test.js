import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TerrainField,baseDensity} from '../src/terrain.js';

test('all three caverns contain traversable air above a solid floor',()=>{
  const f=new TerrainField();
  for(const [x,y,z]of [[0,2,18],[4,-4,-28],[0,-10,-65]]){assert.ok(f.sample(x,y,z)<0);assert.ok(f.sample(x,y-7,z)>0);}
});
test('a rock wall becomes a continuous traversable tunnel with no stale collision data',()=>{
  const f=new TerrainField();assert.ok(f.sample(9,1,-15)>0);
  for(let z=-11;z>=-20;z-=1)f.carve(9,1,z,2);
  for(let z=-11;z>=-20;z-=.2){assert.ok(f.sample(9,1,z)<-.65);assert.ok(f.sample(9,.25,z)<-.4);assert.ok(f.sample(9,1.75,z)<-.4);}
  assert.ok(f.edits.length>0);assert.ok(f.dirty.size>0);
});
test('floor and ceiling excavation persist through save reconstruction',()=>{
  const f=new TerrainField();const floor=f.ground(4,12,6);assert.ok(f.sample(4,floor-1,12)>0);f.carve(4,floor-1,12,2.5);assert.ok(f.sample(4,floor-1,12)<-1);
  assert.ok(f.sample(0,20,8)>0);f.carve(0,20,8,2.5);assert.ok(f.sample(0,20,8)<-1);
  const restored=new TerrainField(JSON.parse(JSON.stringify(f.edits)));
  for(const p of [[4,floor-1,12],[0,20,8],[0,2,18]])assert.ok(Math.abs(f.sample(...p)-restored.sample(...p))<.005);
  assert.equal(restored.edits.length,f.edits.length);const twice=new TerrainField(restored.edits);assert.ok(twice.sample(4,floor-1,12)<-1);
});
test('repeated, overlapping and oblique cuts are monotonic; bedrock remains solid',()=>{
  const f=new TerrainField(),before=f.sample(-20,-1,-5);
  for(let i=0;i<150;i++)f.carve(-20+Math.sin(i)*2,-2-i*.1,-5-i*.2,2.1);
  assert.ok(f.sample(-20,-1,-5)<=before);assert.ok(f.sample(0,-24,-20)>0);assert.equal(f.carve(NaN,0,0,2),0);assert.equal(f.carve(0,0,0,-1),0);
  assert.ok(f.data.every(Number.isFinite));
});
test('surface normals push a character out of the floor',()=>{
  const f=new TerrainField(),y=f.ground(0,19,5),n=f.gradient(0,y,19);assert.ok(n[1]>.8);assert.ok(Math.abs(Math.hypot(...n)-1)<.001);
});
test('checkpoint foundations survive excavation so returning remains safe',()=>{
  const f=new TerrainField();
  for(const [x,z,from]of [[0,19,5],[4,-24,0],[-7,-59,-5]]){const y=f.ground(x,z,from);f.carve(x,y-1,z,5);assert.ok(f.sample(x,y-.5,z)>0);assert.ok(f.sample(x+3,y-1,z)<0);}
});
