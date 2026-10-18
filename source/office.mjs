/* Blender geometry with live HTML surfaces attached to both devices. */
import * as THREE from 'three';
import {GLTFLoader} from './vendor/three/addons/loaders/GLTFLoader.js';
import {CSS3DRenderer,CSS3DObject} from './vendor/three/addons/renderers/CSS3DRenderer.js';
import {OrbitControls} from './vendor/three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from './vendor/three/addons/environments/RoomEnvironment.js';
const MODEL=new URL('__OFFICE_MODEL__',import.meta.url);
const MANIFEST=new URL('__OFFICE_MANIFEST__',import.meta.url);
const ACTIONS={Chair:'career',TripoChair:'career',Laptop:'laptop',Phone:'phone',FolderCurrent:'dossier',FolderArchive:'archive',FountainPen:'notes',Bookshelf:'archive',Mirror:'wardrobe',CityMap:'city',Lawyer:'career'};
const TITLES={Chair:'Кресло адвоката · профиль',TripoChair:'Кресло адвоката · профиль',Laptop:'Приблизиться к ноутбуку',Phone:'Приблизиться к телефону',FolderCurrent:'Папка текущего дела',FolderArchive:'Архив завершённых дел',FountainPen:'Перьевая ручка · блокнот',Bookshelf:'Архив практики',Mirror:'Гардероб и деловой имидж',CityMap:'Карта Новореченска',Lawyer:'Профиль адвоката'};
let state=null;
function actionOf(object){for(let o=object;o;o=o.parent)if(ACTIONS[o.name])return o.name;return null;}
function create(options){
 const {viewport,canvasHost,cssHost,screenElement,phoneElement,onOpen}=options;
 const s=state={...options,active:false,ready:false,failed:false,focus:null,transition:null,quality:options.quality||'auto',motion:!matchMedia('(prefers-reduced-motion: reduce)').matches,raf:0,frames:0,meshes:0,triangles:0,lastError:null};
 const loading=document.getElementById('room-loading'),hint=document.getElementById('room-hint');
 let renderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});}catch(error){fallback(error);return;}
 s.renderer=renderer;
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;
 renderer.shadowMap.enabled=s.quality!=='low';renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.domElement.setAttribute('aria-label','Трёхмерные предметы кабинета');renderer.domElement.setAttribute('role','img');
 canvasHost.append(renderer.domElement);
 const scene=s.scene=new THREE.Scene();scene.background=new THREE.Color('#d9d4c7');
 const cssScene=new THREE.Scene(),cssRenderer=s.cssRenderer=new CSS3DRenderer();
 cssRenderer.domElement.style.pointerEvents='none';cssHost.append(cssRenderer.domElement);
 const camera=s.camera=new THREE.PerspectiveCamera(28,1,.05,100);
 scene.add(new THREE.HemisphereLight(0xf7efdc,0x3e3b31,1.15));
 const sun=new THREE.DirectionalLight(0xfff0d4,2.8);sun.position.set(-4,8,7);sun.castShadow=true;
 sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-7,near:.5,far:28});sun.shadow.normalBias=.028;sun.shadow.bias=-.00006;scene.add(sun);scene.add(sun.target);
 const fill=new THREE.DirectionalLight(0xdce7e4,.6);fill.position.set(6,4,2);scene.add(fill);
 const pmrem=new THREE.PMREMGenerator(renderer),environment=new RoomEnvironment();
 scene.environment=pmrem.fromScene(environment,.06).texture;scene.environmentIntensity=.5;environment.dispose();pmrem.dispose();
 const controls=s.controls=new OrbitControls(camera,renderer.domElement);
 controls.enablePan=false;controls.enableZoom=false;controls.enableDamping=s.motion;controls.dampingFactor=.1;controls.rotateSpeed=.35;
 controls.enableRotate=matchMedia('(pointer:fine)').matches;
 controls.minAzimuthAngle=-.16;controls.maxAzimuthAngle=.36;controls.minPolarAngle=1.08;controls.maxPolarAngle=1.38;
 controls.addEventListener('change',invalidate);
 let width=1,height=1;
 function pose(){
  const up=new THREE.Vector3(0,1,0);let position,target,fov;
  if(!s.focus){
   position=s.defaultCamera.clone();target=s.defaultTarget.clone();
   const c=s.manifest.camera;fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(c.fov/2))*Math.max(1,c.aspect/camera.aspect)));
  }else{
   const surface=s.surfaces[s.focus],dimensions=s.focus==='phone'?s.manifest.phoneScreen:s.manifest.screen;
   target=surface.position.clone();fov=28;
   const fraction=s.focus==='phone'?.9:.86,tangent=Math.tan(THREE.MathUtils.degToRad(fov/2));
   // On a narrow display we see the centre of the laptop panel at readable size.
   // Its responsive workspace stays on that same 3D plane; the bezel may crop.
   const crop=s.focus==='laptop'&&width<=700;
   const distance=Math.max(dimensions.height/(2*tangent*fraction),crop?0:dimensions.width/(2*tangent*camera.aspect*.92));
   position=target.clone().add(new THREE.Vector3(0,0,distance).applyQuaternion(surface.quaternion));
   up.applyQuaternion(surface.quaternion);
   if(s.focus==='laptop'){
    const pixelsPerUnit=height/(2*distance*tangent);
    screenElement.style.setProperty('--laptop-work-width',Math.min(900,Math.max(250,width*.94/(pixelsPerUnit*dimensions.width/900)))+'px');
   }
  }
  return {position,target,fov,quaternion:new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(position,target,up))};
 }
 function applyPose(p){camera.position.copy(p.position);camera.quaternion.copy(p.quaternion);camera.fov=p.fov;camera.updateProjectionMatrix();controls.target.copy(p.target);}
 function finishTransition(){
  s.transition=null;viewport.dataset.moving='false';controls.enabled=!s.focus;
  if(!s.focus){camera.up.set(0,1,0);controls.update();}
  viewport.dispatchEvent(new CustomEvent('office:focusend',{bubbles:true,detail:{device:s.focus}}));
 }
 function moveToTarget(animate){
  if(!s.ready)return;
  const to=pose();controls.enabled=false;
  if(!animate||!s.motion){applyPose(to);finishTransition();}
  else{
   s.transition={start:performance.now(),duration:780,from:{position:camera.position.clone(),quaternion:camera.quaternion.clone(),target:controls.target.clone(),fov:camera.fov},to};
   viewport.dataset.moving='true';
  }
  invalidate();
 }
 function resize(retarget=true){
  width=Math.max(1,viewport.clientWidth);height=Math.max(1,viewport.clientHeight);
  screenElement.inert=s.focus==='phone'||(width<=700&&s.focus!=='laptop');phoneElement.inert=s.focus==='laptop';
  renderer.setPixelRatio(s.quality==='low'?1:Math.min(devicePixelRatio||1,1.65));renderer.setSize(width,height,false);cssRenderer.setSize(width,height);
  camera.aspect=width/height;
  if(s.ready&&retarget){
   if(s.transition)s.transition.to=pose();
   else if(s.focus)moveToTarget(false);
   else{camera.fov=pose().fov;camera.updateProjectionMatrix();}
  }
  invalidate();
 }
 s.resize=resize;s.invalidate=invalidate;
 s.setFocus=device=>{
  const focus=device==='laptop'||device==='phone'?device:null;
  if(s.focus===focus)return;
  s.focus=focus;viewport.dataset.focus=focus||'overview';resize(false);moveToTarget(true);
 };
 s.reset=()=>{s.focus=null;viewport.dataset.focus='overview';resize(false);moveToTarget(true);};
 s.finishMotion=()=>{if(s.transition){applyPose(s.transition.to);finishTransition();invalidate();}};
 new ResizeObserver(()=>resize()).observe(viewport);
 function invalidate(){if(s.active&&!document.hidden&&!s.raf)s.raf=requestAnimationFrame(draw);}
 function draw(now){
  s.raf=0;if(!s.active||s.failed||document.hidden)return;
  let moving=false;
  if(s.transition){
   const t=s.transition,p=Math.min(1,(now-t.start)/t.duration),e=p*p*(3-2*p);
   camera.position.lerpVectors(t.from.position,t.to.position,e);camera.quaternion.slerpQuaternions(t.from.quaternion,t.to.quaternion,e);
   camera.fov=THREE.MathUtils.lerp(t.from.fov,t.to.fov,e);camera.updateProjectionMatrix();controls.target.lerpVectors(t.from.target,t.to.target,e);
   if(p===1)finishTransition();else moving=true;
  }else if(!s.focus)moving=controls.update();
  renderer.render(scene,camera);cssRenderer.render(cssScene,camera);s.frames++;projectLabels();
  if(moving)invalidate();
 }
 function projectLabels(){
  if(!s.ready)return;
  for(const label of viewport.querySelectorAll('[data-object]')){
   const point=s.manifest.labelAnchors[label.dataset.object];
   if(!point){label.hidden=true;continue;}
   const v=new THREE.Vector3(...point).project(camera);label.hidden=!!s.focus||v.z>1||v.z<0||Math.abs(v.x)>1.02||Math.abs(v.y)>1.1;
   label.style.left=((v.x*.5+.5)*width)+'px';label.style.top=((-v.y*.5+.5)*height)+'px';
  }
 }
 s.projectLabels=projectLabels;
 let down=null,hover=null;const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
 function pick(event){const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);for(const hit of raycaster.intersectObjects(scene.children,true)){const action=actionOf(hit.object);if(action)return action;}return null;}
 renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
 renderer.domElement.addEventListener('pointerup',e=>{if(!down||s.focus||s.transition||Math.hypot(e.clientX-down.x,e.clientY-down.y)>7){down=null;return;}down=null;const key=pick(e);if(key)onOpen(ACTIONS[key]);});
 renderer.domElement.addEventListener('pointermove',e=>{if(!s.ready||s.focus)return;const key=pick(e);if(hover!==key){hover=key;renderer.domElement.style.cursor=key?'pointer':'grab';hint.textContent=key?TITLES[key]:'Выберите предмет, чтобы начать работу';for(const el of viewport.querySelectorAll('[data-object]'))el.classList.toggle('is-hovered',el.dataset.object===key);}});
 renderer.domElement.addEventListener('pointerleave',()=>{hover=null;hint.textContent='Выберите предмет, чтобы начать работу';});
 screenElement.addEventListener('click',e=>{if(!s.focus&&!e.target.closest('button'))onOpen('laptop');});
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();fallback(new Error('WebGL context lost'));});
 renderer.domElement.addEventListener('webglcontextrestored',()=>{s.failed=false;s.lastError=null;viewport.removeAttribute('data-fallback');loading.hidden=s.ready;loading.textContent='Открываем кабинет…';loading.classList.remove('room-fallback-note');resize();invalidate();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(s.raf)cancelAnimationFrame(s.raf);s.raf=0;}else invalidate();});
 Promise.all([new GLTFLoader().loadAsync(MODEL.href),fetch(MANIFEST).then(r=>{if(!r.ok)throw Error('Office manifest not found');return r.json();})]).then(([gltf,manifest])=>{
  s.manifest=manifest;s.model=gltf.scene;scene.add(gltf.scene);gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o=>{if(o.isLight)o.visible=false;if(o.isMesh){o.castShadow=true;o.receiveShadow=true;s.meshes++;s.triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;}});
  camera.position.fromArray(manifest.camera.position);controls.target.fromArray(manifest.camera.target);camera.lookAt(controls.target);camera.updateMatrixWorld();s.defaultCamera=camera.position.clone();s.defaultTarget=controls.target.clone();
  const anchor=gltf.scene.getObjectByName('ScreenAnchor'),phone=gltf.scene.getObjectByName(manifest.phoneScreen.parent);
  if(!anchor||!phone)throw Error('Device screen anchor is missing');
  const laptopObject=new CSS3DObject(screenElement);anchor.getWorldPosition(laptopObject.position);anchor.getWorldQuaternion(laptopObject.quaternion);laptopObject.scale.set(manifest.screen.width/900,manifest.screen.height/560,1);cssScene.add(laptopObject);
  const p=manifest.phoneScreen,phoneObject=new CSS3DObject(phoneElement);
  phoneElement.style.width=p.domWidth+'px';phoneElement.style.height=p.domHeight+'px';
  phoneObject.position.copy(phone.localToWorld(new THREE.Vector3(...p.position)));phone.getWorldQuaternion(phoneObject.quaternion);phoneObject.scale.set(p.width/p.domWidth,p.height/p.domHeight,1);cssScene.add(phoneObject);
  s.surfaces={laptop:laptopObject,phone:phoneObject};s.ready=true;viewport.dataset.ready='true';viewport.dataset.focus=s.focus||'overview';loading.hidden=true;
  resize(false);moveToTarget(false);invalidate();viewport.dispatchEvent(new CustomEvent('office:loaded',{bubbles:true}));
 }).catch(fallback);
 function fallback(error){s.failed=true;s.lastError=error?.message||String(error);viewport.dataset.fallback='true';loading.hidden=false;loading.textContent='Все разделы доступны через кнопки под кабинетом.';loading.classList.add('room-fallback-note');if(s.raf)cancelAnimationFrame(s.raf);s.raf=0;window.dispatchEvent(new Event('office:unavailable'));}
 resize(false);
}
const api={
 mount(options){if(!state)create(options);},
 setActive(active){if(!state)return;state.active=!!active;if(state.active){state.resize?.();state.invalidate?.();}else if(state.raf){cancelAnimationFrame(state.raf);state.raf=0;}},
 sync(){state?.projectLabels?.();state?.invalidate?.();},
 setFocus(device){state?.setFocus?.(device);},
 setQuality(quality){if(!state)return;state.quality=quality;if(state.renderer)state.renderer.shadowMap.enabled=quality!=='low';state.resize?.();},
 setMotion(motion){if(!state)return;state.motion=!!motion;if(state.controls)state.controls.enableDamping=!!motion;if(!motion)state.finishMotion?.();state.invalidate?.();},
 setView(view){const s=state;if(!s?.ready)return;if(view==='reset'){s.reset();return;}if(s.focus)return;const v=s.camera.position.clone().sub(s.controls.target);v.applyAxisAngle(new THREE.Vector3(0,1,0),view==='left'?-.08:.08);s.camera.position.copy(s.controls.target).add(v);s.controls.update();s.invalidate();},
 diagnostics(){return state?{ready:state.ready,fallback:state.failed,active:state.active,focus:state.focus,transitioning:!!state.transition,camera:state.camera?.position.toArray(),meshes:state.meshes,triangles:state.triangles,frames:state.frames,quality:state.quality,drawCalls:state.renderer?.info.render.calls||0,error:state.lastError}:{ready:false,active:false,focus:null,transitioning:false};}
};
globalThis.OfficeRoom=Object.freeze(api);window.dispatchEvent(new Event('office:ready'));
