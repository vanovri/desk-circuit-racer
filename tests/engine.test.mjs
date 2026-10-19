import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {STEP,segmentBox,collision,createState,step,FixedClock,guidedInput} from '../web/engine.mjs';
const scene=JSON.parse(fs.readFileSync(new URL('../desk_scene.json',import.meta.url)));
const idle={throttle:0,steer:0,brake:0};
test('sweep catches an obstacle between clear endpoints',()=>{
  const box={x:0,z:0,width:2,depth:2};assert.equal(segmentBox({x:-10,z:0},{x:10,z:0},box,1),true);
  assert.equal(segmentBox({x:-10,z:4},{x:10,z:4},box,1),false);
  assert.equal(segmentBox({x:0,z:0},{x:0,z:0},box,0),true);
});
test('guard rejects boundaries and scene route is continuously clear',()=>{
  assert.equal(collision({x:0,z:0},{x:100,z:0},scene),'Desk edge guard');
  assert.equal(collision({x:0,z:0},{x:scene.desk_dimensions.width/2-scene.car_radius-.5,z:0},scene),'Desk edge guard');
  for(let i=1;i<scene.route.length;i++)assert.equal(collision(scene.route[i-1],scene.route[i],scene),null);
});
test('physics is independent of display-frame partition',()=>{
  const values=[];
  for(const frame of [1/30,1/60,1/120]){
    const state=createState(scene),clock=new FixedClock();state.active=true;
    for(let i=0;i<Math.round(2/frame);i++)clock.advance(frame,dt=>step(state,{...idle,throttle:1},scene,dt));
    values.push([state.x,state.z,state.speed,state.time,clock.steps]);
  }
  assert.deepEqual(values[0],values[1]);assert.deepEqual(values[1],values[2]);assert.equal(values[0][4],240);
});
test('paused state is unchanged and invalid inputs cannot advance active state',()=>{
  const state=createState(scene),snapshot=structuredClone(state);step(state,idle,scene);assert.deepEqual(state,snapshot);
  assert.throws(()=>step(state,idle,scene,1),RangeError);state.active=true;
  assert.throws(()=>step(state,{...idle,throttle:NaN},scene),RangeError);
});
test('skipping later gates cannot complete a lap',()=>{
  const state=createState(scene);state.active=true;state.x=scene.checkpoints[5].x;state.z=scene.checkpoints[5].z;
  step(state,idle,scene);assert.equal(state.nextCheckpoint,1);assert.equal(state.lap,1);
});
test('guided controller drives a real collision-free full lap through the model',()=>{
  const state=createState(scene);state.active=true;
  for(let i=0;i<60000&&state.lap<2;i++)step(state,guidedInput(state,scene),scene,STEP);
  assert.equal(state.lap,2,JSON.stringify(state));assert.equal(state.impacts,0);assert.ok(state.bestLap>0);
});
test('restart produces a new waiting state and fixed clock clamps long pauses',()=>{
  const state=createState(scene);state.active=true;step(state,{...idle,throttle:1},scene);
  const reset=createState(scene);assert.equal(reset.speed,0);assert.equal(reset.active,false);assert.equal(reset.time,0);
  const clock=new FixedClock();clock.advance(10,()=>{});assert.equal(clock.steps,30);clock.reset();assert.equal(clock.accumulator,0);
});
