import {createState,step,FixedClock,guidedInput} from './engine.mjs';
import {createView} from './view.mjs';
const $=id=>document.getElementById(id),keys={forward:false,reverse:false,left:false,right:false,brake:false};
let config,state,view,guided=false,started=false,lastFrame=null,scheduled=false,dirty=0,finished=false;
const clock=new FixedClock();
for(const button of document.querySelectorAll('button'))button.disabled=true;
function clearKeys(){for(const key in keys)keys[key]=false;for(const button of document.querySelectorAll('[data-key]'))button.dataset.held='false';}
function hud(){
  $('clock').textContent=`${(state.time-state.lapStart).toFixed(2)} s`;$('speed').textContent=Math.abs(state.speed).toFixed(1);
  $('checkpoint').textContent=`Next gate: ${state.nextCheckpoint+1} / 6 · Lap ${state.lap}`;
  $('contact').textContent=state.hit?`Contact: ${state.hit}`:`${state.impacts} impacts`;
  $('best').textContent=`${guided?'Demo lap':'Best lap'}: ${state.bestLap===null?'--':state.bestLap.toFixed(2)+' s'}`;
  $('mode').textContent=finished?'Guided lap complete':!started?'Ready to drive':state.active?(guided?'Guided demo · 4× simulation':'Manual drive'):'Paused';
  $('pause').textContent=state.active||!started?'Pause':'Resume';$('pause').disabled=!started||finished;
  for(const button of document.querySelectorAll('[data-key]'))button.disabled=!state.active||guided;
}
function wake(frames=1){dirty=Math.max(dirty,frames);if(!scheduled){scheduled=true;requestAnimationFrame(tick);}}
function tick(timestamp){
  scheduled=false;if(document.hidden){lastFrame=null;return;}
  const dt=lastFrame===null?0:Math.max(0,(timestamp-lastFrame)/1000);lastFrame=timestamp;
  if(state.active){
    clock.advance(dt*(guided?4:1),stepTime=>{
      const input=guided?guidedInput(state,config):{throttle:keys.forward?1:keys.reverse?-.65:0,steer:Number(keys.right)-Number(keys.left),brake:Number(keys.brake)};
      step(state,input,config,stepTime);
      if(guided&&state.lap>=2){state.active=false;finished=true;dirty=Math.max(dirty,1);clearKeys();}
    });
  }
  if(state.active||dirty>0){view.render(state,Math.min(dt,.1));hud();dirty=Math.max(0,dirty-1);}
  if(state.active||dirty>0)wake();else lastFrame=null;
}
function camera(value){view.setView(value);$('overview').setAttribute('aria-pressed',String(value==='overview'));$('chase').setAttribute('aria-pressed',String(value==='chase'));wake(90);}
function begin(demo){guided=demo;started=true;finished=false;state=createState(config);state.active=true;clock.reset();lastFrame=null;clearKeys();camera(demo?'overview':'chase');wake();}
function pause(){if(!state)return;state.active=false;lastFrame=null;clock.reset();clearKeys();hud();wake();}
function restart(){state=createState(config);started=false;finished=false;guided=false;clearKeys();clock.reset();lastFrame=null;hud();camera('overview');wake();}
$('start').addEventListener('click',()=>begin(false));$('demo').addEventListener('click',()=>begin(true));
$('pause').addEventListener('click',()=>{if(!started||finished){begin(false);return;}if(state.active)pause();else{state.active=true;lastFrame=null;wake();}});
$('restart').addEventListener('click',restart);$('overview').addEventListener('click',()=>camera('overview'));$('chase').addEventListener('click',()=>camera('chase'));
const keyMap={KeyW:'forward',ArrowUp:'forward',KeyS:'reverse',ArrowDown:'reverse',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'brake'};
window.addEventListener('keydown',event=>{
  if(!state||['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;
  if(event.code==='KeyR'){event.preventDefault();restart();return;}
  const key=keyMap[event.code];if(key&&state.active&&!guided){event.preventDefault();keys[key]=true;}
});
window.addEventListener('keyup',event=>{if(keyMap[event.code])keys[keyMap[event.code]]=false;});
for(const button of document.querySelectorAll('[data-key]')){
  button.addEventListener('pointerdown',event=>{if(!state?.active||guided)return;event.preventDefault();keys[button.dataset.key]=true;button.dataset.held='true';button.setPointerCapture(event.pointerId);});
  const release=()=>{keys[button.dataset.key]=false;button.dataset.held='false';};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
}
window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else if(view)wake();});
window.addEventListener('resize',()=>{if(view){view.resize();wake(30);}});
window.addEventListener('pagehide',()=>{pause();view?.dispose();});
async function load(){try{
  const embedded=document.getElementById('scene-data');
  if(embedded)config=JSON.parse(embedded.textContent);
  else{const response=await fetch('desk_scene.json');if(!response.ok)throw new Error('Scene unavailable');config=await response.json();}
  state=createState(config);
  view=createView($('stage'),config);for(const button of document.querySelectorAll('button'))button.disabled=false;
  $('renderer').textContent=view.kind+' · nominal cm';hud();wake(90);
}catch(error){$('mode').textContent='Unable to load scene';$('renderer').textContent=error.message;for(const button of document.querySelectorAll('button'))button.disabled=true;}}
load();
