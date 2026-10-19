export const STEP=1/120;
export function segmentBox(a,b,box,padding){
  let lo=0,hi=1;
  for(const [axis,size]of [['x','width'],['z','depth']]){
    const min=box[axis]-box[size]/2-padding,max=box[axis]+box[size]/2+padding,delta=b[axis]-a[axis];
    if(Math.abs(delta)<1e-12){if(a[axis]<min||a[axis]>max)return false;}
    else{const t1=(min-a[axis])/delta,t2=(max-a[axis])/delta;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return false;}
  }
  return true;
}
export function collision(a,b,scene){
  const r=scene.car_radius+scene.route_margin,d=scene.desk_dimensions;
  if(Math.abs(b.x)>d.width/2-r||Math.abs(b.z)>d.depth/2-r)return 'Desk edge guard';
  const hit=scene.obstacles.find(o=>segmentBox(a,b,o,scene.car_radius));return hit?.category??null;
}
function segmentDistance(a,b,p){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(a.x+t*dx-p.x,a.z+t*dz-p.z);}
export function createState(scene){
  const start=scene.route[0],next=scene.route[1];
  return {x:start.x,z:start.z,angle:Math.atan2(next.z-start.z,next.x-start.x),speed:0,time:0,lapStart:0,lap:1,
    nextCheckpoint:1,bestLap:null,impacts:0,hit:null,contactUntil:0,active:false,guidedWaypoint:1};
}
export function step(state,input,scene,dt=STEP){
  if(!Number.isFinite(dt)||dt<=0||dt>1/30)throw new RangeError('Physics dt must be 0 < dt <= 1/30 seconds');
  if(!state.active)return state;
  for(const key of ['throttle','steer','brake'])if(!Number.isFinite(input[key])||Math.abs(input[key])>1)throw new RangeError('Input must be finite in -1..1');
  state.time+=dt;
  state.angle+=input.steer*2.8*dt;
  state.speed+=input.throttle*80*dt;
  if(input.brake>0)state.speed=Math.sign(state.speed)*Math.max(0,Math.abs(state.speed)-input.brake*130*dt);
  state.speed*=Math.exp(-2.0*dt);state.speed=Math.max(-20,Math.min(45,state.speed));
  const before={x:state.x,z:state.z},next={x:state.x+Math.cos(state.angle)*state.speed*dt,z:state.z+Math.sin(state.angle)*state.speed*dt};
  state.hit=collision(before,next,scene);
  if(state.hit){if(state.time>=state.contactUntil){state.impacts++;state.contactUntil=state.time+.25;}state.speed*=-.25;}
  else{state.x=next.x;state.z=next.z;}
  const target=scene.checkpoints[state.nextCheckpoint];
  if(!state.hit&&segmentDistance(before,state,target)<scene.checkpoint_radius){
    if(state.nextCheckpoint===0){const lap=state.time-state.lapStart;state.bestLap=state.bestLap===null?lap:Math.min(state.bestLap,lap);state.lap++;state.lapStart=state.time;}
    state.nextCheckpoint=(state.nextCheckpoint+1)%scene.checkpoints.length;
  }
  return state;
}
export class FixedClock{
  constructor(){this.accumulator=0;this.steps=0;}
  reset(){this.accumulator=0;}
  advance(frameSeconds,callback){
    if(!Number.isFinite(frameSeconds)||frameSeconds<0)throw new RangeError('Frame delta must be finite and non-negative');
    this.accumulator+=Math.min(.25,frameSeconds);
    while(this.accumulator+1e-12>=STEP){callback(STEP);this.accumulator=Math.max(0,this.accumulator-STEP);this.steps++;}
  }
}
const wrap=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
export function guidedInput(state,scene){
  let target=scene.route[state.guidedWaypoint];
  if(Math.hypot(target.x-state.x,target.z-state.z)<.3){state.guidedWaypoint=(state.guidedWaypoint+1)%scene.route.length;target=scene.route[state.guidedWaypoint];}
  const distance=Math.hypot(target.x-state.x,target.z-state.z),error=wrap(Math.atan2(target.z-state.z,target.x-state.x)-state.angle);
  const desired=Math.abs(error)>.12?0:Math.min(22,Math.max(2,distance*3));
  return {steer:Math.max(-1,Math.min(1,error/.16)),throttle:desired>state.speed+.15?1:0,brake:desired<state.speed-.15?1:0};
}
