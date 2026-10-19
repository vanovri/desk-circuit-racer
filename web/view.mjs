import * as THREE from 'three';

export function createView(container,config){
  let renderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}
  catch{return fallback(container,config);}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  container.append(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e3ddcd');scene.fog=new THREE.Fog('#e3ddcd',250,650);
  const camera=new THREE.PerspectiveCamera(44,1,.1,700);
  scene.add(new THREE.HemisphereLight('#fff7e5','#899281',2.3));
  const sun=new THREE.DirectionalLight('#fff2d7',3.5);sun.position.set(-60,125,70);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-120,right:120,top:100,bottom:-100,near:1,far:300});sun.shadow.bias=-.0004;scene.add(sun);
  const materials=new Map();
  const mat=(color,roughness=.65)=>{const key=color+':'+roughness;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color:'#'+color,roughness}));return materials.get(key);};
  function mesh(geometry,material,x,y,z,parent=scene){const object=new THREE.Mesh(geometry,material);object.position.set(x,y,z);object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;}
  function box(w,h,d,color,x,y,z,parent=scene){return mesh(new THREE.BoxGeometry(w,h,d),mat(color),x,y,z,parent);}
  const textureCanvas=document.createElement('canvas');textureCanvas.width=textureCanvas.height=256;const textureCtx=textureCanvas.getContext('2d');
  textureCtx.fillStyle='#bc9366';textureCtx.fillRect(0,0,256,256);let seed=117;
  for(let y=0;y<256;y++){seed=(seed*1664525+1013904223)>>>0;textureCtx.strokeStyle=`rgba(83,51,28,${.02+(seed%15)/100})`;textureCtx.beginPath();textureCtx.moveTo(0,y);textureCtx.bezierCurveTo(80,y-3,180,y+3,256,y);textureCtx.stroke();}
  const wood=new THREE.CanvasTexture(textureCanvas);wood.colorSpace=THREE.SRGBColorSpace;
  const tabletop=new THREE.MeshStandardMaterial({map:wood,roughness:.8});const {width:w,depth:d}=config.desk_dimensions;
  mesh(new THREE.BoxGeometry(w,4,d),tabletop,0,-2,0);
  for(const x of [-w/2+9,w/2-9])for(const z of [-d/2+9,d/2-9])box(4,21,4,'b18c63',x,-14,z);
  const floor=mesh(new THREE.PlaneGeometry(700,600),mat('ded9cb'),0,-25,0);floor.rotation.x=-Math.PI/2;floor.castShadow=false;
  for(const z of [-d/2,d/2])box(w,2.2,1,'927c58',0,1.1,z);
  for(const x of [-w/2,w/2])box(1,2.2,d,'927c58',x,1.1,0);
  for(const c of config.obstacles){
    const group=new THREE.Group();group.position.set(c.x,0,c.z);scene.add(group);
    if(c.category==='monitor'){
      box(c.width*.35,1.2,c.depth*.8,'3e4948',0,.6,0,group);box(2,c.height*.55,2,'515b57',0,c.height*.28,0,group);
      box(c.width,c.height*.6,1.5,c.color_hex,0,c.height*.7,0,group);
      box(c.width*.92,c.height*.51,.4,'1e3439',0,c.height*.7,1,group);
      box(c.width*.54,.8,.2,'a7bb9a',-c.width*.13,c.height*.77,1.25,group);
      for(let n=0;n<3;n++)box(c.width*(.6-n*.09),.5,.2,'6b8c79',-c.width*.11,c.height*(.7-n*.08),1.25,group);
    }else if(c.category==='keyboard'){
      box(c.width,c.height*.65,c.depth,c.color_hex,0,c.height*.325,0,group);
      for(let row=0;row<4;row++)for(let col=0;col<12;col++)box(c.width/13.2,.8,c.depth/5.1,col%5===0?'b4b59c':'dedaca',(col-5.5)*c.width/12.5,c.height*.65+.4,(row-1.5)*c.depth/4.5,group);
    }else if(c.category==='controller'){
      box(c.width,1.1,c.depth,c.color_hex,0,.55,0,group);box(c.width*.36,1.8,c.depth*.54,'303a37',0,2,0,group);
      for(const side of [-1,1])for(let n=0;n<9;n++)box(.65,.6,1.1,'d9cfa6',(n-4)*c.width/10,1.4,side*c.depth*.39,group);
      box(c.width*.14,1.5,c.depth*.25,'aeb8ad',c.width*.39,1.7,0,group);
    }else if(c.category==='mug'){
      const radius=Math.min(c.width,c.depth)*.31;
      mesh(new THREE.CylinderGeometry(radius,radius*.9,c.height,28),mat(c.color_hex,.35),0,c.height/2,0,group);
      mesh(new THREE.CylinderGeometry(radius*.85,radius*.85,.15,24),mat('4c3628'),0,c.height+.05,0,group);
      const handle=mesh(new THREE.TorusGeometry(c.width*.16,.5,8,20),mat(c.color_hex,.35),c.width*.23,c.height*.57,0,group);handle.rotation.y=Math.PI/2;
    }else if(c.category==='books'){
      for(let n=0;n<3;n++){box(c.width,c.height/3-.3,c.depth,n===1?'d1c9ad':c.color_hex,0,(n+.5)*c.height/3,0,group);}
    }else if(c.category==='lamp'){
      const radius=Math.min(c.width,c.depth)*.36;
      mesh(new THREE.CylinderGeometry(radius,radius*1.12,1.3,24),mat(c.color_hex),0,.65,0,group);
      box(1,c.height*.8,1,'7d826c',0,c.height*.4,0,group);
      mesh(new THREE.ConeGeometry(radius,c.height*.25,24),mat(c.color_hex,.4),0,c.height*.86,0,group);
    }else{
      const mouse=mesh(new THREE.SphereGeometry(1,20,12),mat(c.color_hex,.4),0,c.height*.5,0,group);mouse.scale.set(c.width*.46,c.height*.5,c.depth*.46);
    }
  }
  const routeGeometry=new THREE.BufferGeometry().setFromPoints(config.route.map(p=>new THREE.Vector3(p.x,.12,p.z)));
  const route=new THREE.Line(routeGeometry,new THREE.LineDashedMaterial({color:'#425f4b',dashSize:2,gapSize:1.5}));route.computeLineDistances();scene.add(route);
  const rings=config.checkpoints.map((p,index)=>{
    const ring=mesh(new THREE.TorusGeometry(config.checkpoint_radius,.32,8,32),new THREE.MeshStandardMaterial({color:'#78917a',roughness:.7}),p.x,.45,p.z);ring.rotation.x=Math.PI/2;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,64,64);ctx.fillStyle='#3c4a36';ctx.font='bold 44px system-ui';ctx.textAlign='center';ctx.fillText(String(index+1),32,49);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false}));sprite.position.set(p.x,7,p.z);sprite.scale.set(4.2,4.2,1);scene.add(sprite);return ring;
  });
  const car=new THREE.Group();scene.add(car);
  box(7.2,1.5,4.2,'dcad59',0,1.8,0,car);box(3.5,1.4,3.3,'43564c',-.6,3.0,0,car);
  for(const x of [-2.4,2.4])for(const z of [-2.1,2.1]){const wheel=mesh(new THREE.CylinderGeometry(1.15,1.15,.7,12),mat('343a34'),x,1.15,z,car);wheel.rotation.x=Math.PI/2;}
  box(.4,.65,3.4,'e7dec1',3.65,2,0,car);
  car.updateMatrixWorld(true);let carEnvelope=0;const vertex=new THREE.Vector3();
  car.traverse(object=>{if(object.isMesh){const positions=object.geometry.attributes.position;for(let i=0;i<positions.count;i++){vertex.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld);carEnvelope=Math.max(carEnvelope,Math.hypot(vertex.x,vertex.z));}}});
  if(carEnvelope>config.car_radius)throw new Error('Vehicle geometry exceeds its collision envelope');
  const target=new THREE.Vector3();let view='overview',aspect=1;
  function resize(){const rect=container.getBoundingClientRect();aspect=rect.width/rect.height;camera.aspect=aspect;camera.updateProjectionMatrix();renderer.setSize(rect.width,rect.height);}
  function render(state,dt){
    car.position.set(state.x,0,state.z);car.rotation.y=-state.angle;
    rings.forEach((ring,i)=>ring.material.color.set(i===state.nextCheckpoint?'#d6aa4b':'#758575'));
    let look;
    if(view==='chase'){
      target.set(state.x-Math.cos(state.angle)*28,20,state.z-Math.sin(state.angle)*28);look=new THREE.Vector3(state.x+Math.cos(state.angle)*7,2,state.z+Math.sin(state.angle)*7);
    }else{const scale=Math.max(1,1.5/aspect);target.set(95*scale,125*scale,145*scale);look=new THREE.Vector3(0,0,0);}
    camera.position.lerp(target,1-Math.exp(-5*Math.max(dt,.016)));camera.lookAt(look);renderer.render(scene,camera);
  }
  camera.position.set(95,125,145);resize();
  return {kind:'WebGL 3D',resize,render,setView:value=>{view=value;},dispose:()=>{scene.traverse(o=>{if(o.geometry)o.geometry.dispose();});for(const m of materials.values())m.dispose();renderer.dispose();wood.dispose();}};
}

function fallback(container,config){
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');container.append(canvas);let w=800,h=550;
  function resize(){const rect=container.getBoundingClientRect(),r=Math.min(devicePixelRatio||1,2);w=rect.width;h=rect.height;canvas.width=w*r;canvas.height=h*r;ctx.setTransform(r,0,0,r,0,0);}
  function render(state){const scale=Math.min(w/(config.desk_dimensions.width+14),h/(config.desk_dimensions.depth+14));const p=(x,z)=>[w/2+x*scale,h/2+z*scale];ctx.fillStyle='#e3ddcd';ctx.fillRect(0,0,w,h);const a=p(-config.desk_dimensions.width/2,-config.desk_dimensions.depth/2);ctx.fillStyle='#bc9366';ctx.fillRect(a[0],a[1],config.desk_dimensions.width*scale,config.desk_dimensions.depth*scale);
    for(const o of config.obstacles){const a=p(o.x-o.width/2,o.z-o.depth/2);ctx.fillStyle='#'+o.color_hex;ctx.fillRect(a[0],a[1],o.width*scale,o.depth*scale);}
    ctx.beginPath();config.route.forEach((q,i)=>{const a=p(q.x,q.z);i?ctx.lineTo(...a):ctx.moveTo(...a);});ctx.strokeStyle='#425f4b';ctx.setLineDash([5,4]);ctx.stroke();ctx.setLineDash([]);
    config.checkpoints.forEach((q,i)=>{const a=p(q.x,q.z);ctx.beginPath();ctx.arc(...a,config.checkpoint_radius*scale,0,Math.PI*2);ctx.strokeStyle=i===state.nextCheckpoint?'#fff1b7':'#4a654e';ctx.lineWidth=2;ctx.stroke();});
    const c=p(state.x,state.z);ctx.save();ctx.translate(...c);ctx.rotate(state.angle);ctx.fillStyle='#edc66b';ctx.fillRect(-3.6*scale,-2.1*scale,7.2*scale,4.2*scale);ctx.restore();
  }
  resize();return {kind:'2D compatibility view',resize,render,setView:()=>{},dispose:()=>{}};
}
