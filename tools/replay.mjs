import fs from 'node:fs';import crypto from 'node:crypto';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {createState,step,guidedInput,STEP} from '../web/engine.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const raw=fs.readFileSync(path.join(root,'desk_scene.json')),scene=JSON.parse(raw),state=createState(scene);state.active=true;
const trace=[];let ticks=0;
for(;ticks<60000&&state.lap<2;ticks++){step(state,guidedInput(state,scene),scene,STEP);if(ticks%120===0)trace.push({tick:ticks+1,x:state.x,z:state.z,nextCheckpoint:state.nextCheckpoint});}
const report={status:state.lap===2&&state.impacts===0?'pass':'failed',data:'synthetic',step_seconds:STEP,ticks,
  lap_seconds:state.bestLap,impacts:state.impacts,completed_laps:state.lap-1,scene_sha256:crypto.createHash('sha256').update(raw).digest('hex'),
  method:'Actual engine with deterministic steering/throttle/brake controller; no position teleporting',trace};
const output=path.join(root,'reports','guided-replay.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,trace:undefined}));if(report.status!=='pass')process.exitCode=1;
