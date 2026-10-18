/* The office is actual Blender glTF geometry. HTML is attached to its screen plane. */
import * as THREE from 'three';
import {GLTFLoader} from './vendor/three/addons/loaders/GLTFLoader.js';
import {CSS3DRenderer,CSS3DObject} from './vendor/three/addons/renderers/CSS3DRenderer.js';
import {OrbitControls} from './vendor/three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from './vendor/three/addons/environments/RoomEnvironment.js';
const MODEL=new URL('__OFFICE_MODEL__',import.meta.url);
const MANIFEST=new URL('__OFFICE_MANIFEST__',import.meta.url);
const ACTIONS={Chair:'career',TripoChair:'career',Laptop:'cases',Phone:'chat',FolderCurrent:'dossier',FolderArchive:'archive',FountainPen:'notes',Bookshelf:'archive',Mirror:'wardrobe',CityMap:'city',Lawyer:'career'};
const TITLES={Chair:'Кресло адвоката · профиль',TripoChair:'Кресло адвоката · профиль',Laptop:'Ноутбук · дела и подготовка',Phone:'Телефон · личная линия',FolderCurrent:'Папка текущего дела',FolderArchive:'Архив завершённых дел',FountainPen:'Перьевая ручка · блокнот',Bookshelf:'Архив практики',Mirror:'Гардероб и деловой имидж',CityMap:'Карта Новореченска',Lawyer:'Профиль адвоката'};
let state=null;
function actionOf(object){for(let o=object;o;o=o.parent){for(const key of Object.keys(ACTIONS))if(o.name===key)return key;}return null;}
function create(options){
 const {viewport,canvasHost,cssHost,screenElement,onOpen}=options;
 const s=state={...options,active:false,ready:false,failed:false,quality:options.quality||'auto',motion:!matchMedia('(prefers-reduced-motion: reduce)').matches,raf:0,frames:0,meshes:0,triangles:0,lastError:null};
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
 const ambient=new THREE.HemisphereLight(0xf7efdc,0x3e3b31,1.15);scene.add(ambient);
 const sun=new THREE.DirectionalLight(0xfff0d4,2.8);sun.position.set(-4,8,7);sun.castShadow=true;
 sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-10;sun.shadow.camera.right=10;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-7;sun.shadow.camera.near=.5;sun.shadow.camera.far=28;sun.shadow.normalBias=.028;sun.shadow.bias=-.00006;sun.shadow.blurSamples=8;scene.add(sun);scene.add(sun.target);
 const fill=new THREE.DirectionalLight(0xdce7e4,.6);fill.position.set(6,4,2);scene.add(fill);
 const pmrem=new THREE.PMREMGenerator(renderer),environment=new RoomEnvironment();
 scene.environment=pmrem.fromScene(environment,.06).texture;scene.environmentIntensity=.5;environment.dispose();pmrem.dispose();
 const controls=s.controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.1;controls.enableZoom=false;controls.rotateSpeed=.35;controls.enableRotate=matchMedia('(pointer:fine)').matches;
 controls.minAzimuthAngle=-.16;controls.maxAzimuthAngle=.36;controls.minPolarAngle=1.08;controls.maxPolarAngle=1.38;
 controls.addEventListener('change',invalidate);
 let width=1,height=1;
 function resize(){
  width=Math.max(1,viewport.clientWidth);height=Math.max(1,viewport.clientHeight);screenElement.inert=matchMedia('(max-width:700px)').matches;
  renderer.setPixelRatio(s.quality==='low'?1:Math.min(devicePixelRatio||1,1.65));renderer.setSize(width,height,false);cssRenderer.setSize(width,height);
  camera.aspect=width/height;
  if(s.manifest){const base=s.manifest.camera.fov,aspect=s.manifest.camera.aspect;camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(base/2))*Math.max(1,aspect/camera.aspect)));}
  camera.updateProjectionMatrix();invalidate();
 }
 s.resize=resize;s.invalidate=invalidate;
 const observer=new ResizeObserver(resize);observer.observe(viewport);
 function invalidate(){if(s.active&&!s.raf)s.raf=requestAnimationFrame(draw);}
 function draw(){s.raf=0;if(!s.active||s.failed)return;controls.update();renderer.render(scene,camera);cssRenderer.render(cssScene,camera);s.frames++;projectLabels();if(s.motion&&controls.enableDamping&&controls.update())invalidate();}
 function projectLabels(){
  if(!s.ready)return;
  for(const label of viewport.querySelectorAll('[data-object]')){
   const key=label.dataset.object,point=s.manifest.labelAnchors[key];
   if(!point){label.hidden=true;continue;}
   const v=new THREE.Vector3(...point).project(camera);label.hidden=v.z>1||v.z<0||Math.abs(v.x)>1.02||Math.abs(v.y)>1.1;
   label.style.left=((v.x*.5+.5)*width)+'px';label.style.top=((-v.y*.5+.5)*height)+'px';
  }
 }
 s.projectLabels=projectLabels;
 let down=null,hover=null;const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
 function pick(event){const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const intersections=raycaster.intersectObjects(scene.children,true);for(const hit of intersections){const action=actionOf(hit.object);if(action)return action;}return null;}
 renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
 renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>7){down=null;return;}down=null;const key=pick(e);if(key)onOpen(ACTIONS[key]);});
 renderer.domElement.addEventListener('pointermove',e=>{if(!s.ready)return;const key=pick(e);if(hover!==key){hover=key;renderer.domElement.style.cursor=key?'pointer':'grab';hint.textContent=key?TITLES[key]:'Выберите предмет, чтобы начать работу';for(const el of viewport.querySelectorAll('[data-object]'))el.classList.toggle('is-hovered',el.dataset.object===key);}});
 renderer.domElement.addEventListener('pointerleave',()=>{hover=null;hint.textContent='Выберите предмет, чтобы начать работу';});
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();fallback(new Error('WebGL context lost'));});
 renderer.domElement.addEventListener('webglcontextrestored',()=>{s.failed=false;s.lastError=null;viewport.removeAttribute('data-fallback');loading.hidden=s.ready;loading.textContent='Открываем кабинет…';loading.classList.remove('room-fallback-note');resize();invalidate();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(s.raf)cancelAnimationFrame(s.raf);s.raf=0;}else invalidate();});
 Promise.all([new GLTFLoader().loadAsync(MODEL.href),fetch(MANIFEST).then(r=>{if(!r.ok)throw Error('Office manifest not found');return r.json();})]).then(([gltf,manifest])=>{
  s.manifest=manifest;s.model=gltf.scene;scene.add(gltf.scene);gltf.scene.updateMatrixWorld(true);
  // Blender area lights are authored in the source. Browser illumination is deterministic here.
  gltf.scene.traverse(o=>{if(o.isLight)o.visible=false;if(o.isMesh){o.castShadow=true;o.receiveShadow=true;s.meshes++;const geo=o.geometry;s.triangles+=(geo.index?geo.index.count:geo.attributes.position.count)/3;}});
  camera.fov=manifest.camera.fov;camera.position.fromArray(manifest.camera.position);controls.target.fromArray(manifest.camera.target);camera.lookAt(controls.target);camera.updateMatrixWorld();s.defaultCamera=camera.position.clone();s.defaultTarget=controls.target.clone();
  const anchor=gltf.scene.getObjectByName('ScreenAnchor');if(!anchor)throw Error('Office screen anchor is missing');
  const domObject=new CSS3DObject(screenElement);anchor.getWorldPosition(domObject.position);anchor.getWorldQuaternion(domObject.quaternion);domObject.scale.set(manifest.screen.width/900,manifest.screen.height/560,1);cssScene.add(domObject);s.screenObject=domObject;
  s.ready=true;viewport.dataset.ready='true';loading.hidden=true;resize();controls.update();invalidate();
  viewport.dispatchEvent(new CustomEvent('office:loaded',{bubbles:true}));
 }).catch(fallback);
 function fallback(error){s.failed=true;s.lastError=error?.message||String(error);viewport.dataset.fallback='true';if(loading){loading.textContent='Все разделы доступны через кнопки под кабинетом.';loading.classList.add('room-fallback-note');}if(s.raf)cancelAnimationFrame(s.raf);s.raf=0;}
 resize();
}
const api={
 mount(options){if(!state)create(options);},
 setActive(active){if(!state)return;state.active=!!active;if(state.active){state.resize?.();state.invalidate?.();}else if(state.raf){cancelAnimationFrame(state.raf);state.raf=0;}},
 sync(){state?.projectLabels?.();state?.invalidate?.();},
 setQuality(quality){if(!state)return;state.quality=quality;if(state.renderer)state.renderer.shadowMap.enabled=quality!=='low';state.resize?.();},
 setMotion(motion){if(!state)return;state.motion=!!motion;if(state.controls)state.controls.enableDamping=!!motion;state.invalidate?.();},
 setView(view){const s=state;if(!s?.ready)return;if(view==='reset'){s.camera.position.copy(s.defaultCamera);s.controls.target.copy(s.defaultTarget);}else{const v=s.camera.position.clone().sub(s.controls.target);v.applyAxisAngle(new THREE.Vector3(0,1,0),view==='left'?-.08:.08);s.camera.position.copy(s.controls.target).add(v);}s.controls.update();s.invalidate();},
 diagnostics(){return state?{ready:state.ready,fallback:state.failed,active:state.active,meshes:state.meshes,triangles:state.triangles,frames:state.frames,quality:state.quality,drawCalls:state.renderer?.info.render.calls||0,error:state.lastError}: {ready:false,active:false};}
};
globalThis.OfficeRoom=Object.freeze(api);window.dispatchEvent(new Event('office:ready'));
