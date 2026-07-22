/* ============================================================
   THE RISE OF ILJANOR — world.js
   Auto-split from the original single-file index.html. Behavior is
   unchanged; this is a pure modularization refactor.
   ============================================================ */
import { doAttack } from './combat.js';
import { animate } from './game.js';
import { spawnEnemy } from './monsters.js';
import { disconnectGlobalHub, hub, hubPeer, netBroadcast, team } from './network.js';
import { MAX_FLOOR, state, useSkill } from './player.js';
import { saveGame } from './save.js';
import { buildTown } from './town.js';
import { handleKeyPress, showToast, toggleModal, updateHUD } from './ui.js';

export function mulberry32(seed){
  return function(){
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function lerp(a,b,t){ return a+(b-a)*t; }

/* ============================= REGION THEMES (every 10 floors) ============================= */
/* Biomes — actually changes ground/fog/lighting/prop-density to visually match each floor's named theme,
   not just the text label. Matched by keyword against the theme name so all 100 floors get a real look. */

export const BIOMES = {
  grass:   {fog:0x0a140f, ambient:0x2a5a3a, accent:0x6bffa0, ground:0x1c3a1e, trees:1.4, crystals:0.6},
  forest:  {fog:0x081208, ambient:0x1f4a2f, accent:0x4dffa0, ground:0x0f2012, trees:2.0, crystals:0.5},
  darkforest:{fog:0x060a06, ambient:0x142a1a, accent:0x2fff8a, ground:0x0a140b, trees:2.2, crystals:0.3},
  rocky:   {fog:0x14110a, ambient:0x4a4030, accent:0xd8b070, ground:0x2a2418, trees:0.3, crystals:0.9},
  water:   {fog:0x08141a, ambient:0x1f4a5a, accent:0x4dd8ff, ground:0x0e2430, trees:0.4, crystals:1.2},
  desert:  {fog:0x1a1508, ambient:0x6a5624, accent:0xffd76a, ground:0x3a2f14, trees:0.05, crystals:0.4},
  swamp:   {fog:0x0e140a, ambient:0x3a4a20, accent:0x8aff4d, ground:0x1c2410, trees:1.6, crystals:0.4},
  snow:    {fog:0x141c22, ambient:0x4a6a7a, accent:0xdffcff, ground:0xc8e6ee, trees:0.8, crystals:0.8},
  ruins:   {fog:0x0c0c0e, ambient:0x3a3a40, accent:0xc0c8e0, ground:0x1c1c22, trees:0.2, crystals:0.7},
  volcano: {fog:0x140806, ambient:0x6a2010, accent:0xff5a2a, ground:0x2a1008, trees:0.05, crystals:0.6},
  crystal: {fog:0x0a0a14, ambient:0x3a2a5a, accent:0xb06aff, ground:0x160f22, trees:0.1, crystals:2.2},
  flower:  {fog:0x120e14, ambient:0x5a3a5a, accent:0xff8ad0, ground:0x241a24, trees:1.0, crystals:0.7},
  jungle:  {fog:0x081008, ambient:0x1a4a24, accent:0x5aff7a, ground:0x0d1e10, trees:2.6, crystals:0.3},
  canyon:  {fog:0x140e08, ambient:0x6a4420, accent:0xff9a4a, ground:0x2a1c10, trees:0.1, crystals:0.5},
  mine:    {fog:0x0a0a0a, ambient:0x2a2a2a, accent:0xffb84d, ground:0x161616, trees:0.05, crystals:1.0},
  haunted: {fog:0x0c0a12, ambient:0x2a2040, accent:0x9a7aff, ground:0x14101e, trees:0.6, crystals:0.4},
  sky:     {fog:0x0e1420, ambient:0x3a5a8a, accent:0xaee0ff, ground:0x1a2438, trees:0.4, crystals:1.4},
  dark:    {fog:0x08080c, ambient:0x241a3a, accent:0xa04aff, ground:0x100c1a, trees:0.2, crystals:0.9},
  ocean:   {fog:0x061420, ambient:0x1a4a6a, accent:0x2adfff, ground:0x0a2030, trees:0.1, crystals:1.0},
  shadow:  {fog:0x06060a, ambient:0x1a1030, accent:0x7a3aff, ground:0x0c0a16, trees:0.1, crystals:0.6},
  holy:    {fog:0x141008, ambient:0x6a5a30, accent:0xffe89a, ground:0x2a2412, trees:0.4, crystals:1.0},
  demon:   {fog:0x140406, ambient:0x5a1018, accent:0xff2a4a, ground:0x240508, trees:0.1, crystals:0.7},
  dragon:  {fog:0x140a06, ambient:0x5a3018, accent:0xff8a3a, ground:0x261206, trees:0.3, crystals:0.6},
  celestial:{fog:0x0c1018, ambient:0x4a5a8a, accent:0xfff0c0, ground:0x1a2030, trees:0.2, crystals:1.6},
  metal:   {fog:0x0a0c10, ambient:0x3a4048, accent:0xc0d8ff, ground:0x181c22, trees:0, crystals:0.8},
  ember:   {fog:0x14090a, ambient:0x5a2320, accent:0xff6a3d, ground:0x1c1010, trees:0.6, crystals:0.6},
  ruby:    {fog:0x140406, ambient:0x6a1020, accent:0xff3d6a, ground:0x2a0810, trees:0.1, crystals:1.2},
};

export const BIOME_KEYWORDS = [
  [/desert/i,'desert'], [/snow|frozen|ice/i,'snow'], [/volcano|lava/i,'volcano'],
  [/dark forest/i,'darkforest'], [/forest|bamboo/i,'forest'], [/jungle/i,'jungle'],
  [/swamp/i,'swamp'], [/lake|river|ocean/i,'water'], [/rocky|hills|mountain/i,'rocky'],
  [/ruins|castle/i,'ruins'], [/crystal/i,'crystal'], [/flower/i,'flower'],
  [/canyon/i,'canyon'], [/mine/i,'mine'], [/haunted|shadow/i,'haunted'],
  [/sky|floating/i,'sky'], [/dark kingdom|demon kingdom/i,'dark'],
  [/holy|celestial/i,'holy'], [/demon/i,'demon'], [/dragon/i,'dragon'],
  [/mechanical/i,'metal'], [/ruby/i,'ruby'], [/thunder/i,'rocky'],
];

export function getFloorBiome(floor){
  const themeName = getFloorTheme(floor);
  for(const [re,key] of BIOME_KEYWORDS){
    if(re.test(themeName)) return Object.assign({name:themeName}, BIOMES[key]);
  }
  return Object.assign({name:themeName}, regionFor(floor)); // fallback to the original 10-tier palette
}

export const REGIONS = [
  {name:'Town of Beginnings', fog:0x0a0f14, ambient:0x25405a, accent:0x33c4ff, ground:0x141c22},
  {name:'Forest Reaches',     fog:0x0a140f, ambient:0x1f4a2f, accent:0x4dffa0, ground:0x101a12},
  {name:'Ember Depths',       fog:0x14090a, ambient:0x5a2320, accent:0xff6a3d, ground:0x1c1010},
  {name:'Frostvault',         fog:0x0a1218, ambient:0x2a4a5a, accent:0x8fd8ff, ground:0x0f1a20},
  {name:'Ashen Wastes',       fog:0x120e0a, ambient:0x4a3a20, accent:0xffb84d, ground:0x1a140d},
  {name:'Voidmarch',          fog:0x0a0a14, ambient:0x2a205a, accent:0xb06aff, ground:0x120f1e},
  {name:'Crimson Spire',      fog:0x140a0c, ambient:0x5a1f2a, accent:0xff3d6a, ground:0x1c0f13},
  {name:'Verdigris Ruins',    fog:0x0c1410, ambient:0x2f5a45, accent:0x4dffcf, ground:0x0f1c17},
  {name:'Obsidian Reach',     fog:0x0a0a0c, ambient:0x2a2a30, accent:0xd0d8ff, ground:0x121216},
  {name:'Aincrad Summit',     fog:0x0d0a14, ambient:0x4a2a6a, accent:0xffd76a, ground:0x160f1e},
];

export function regionFor(floor){ return REGIONS[Math.min(9, Math.floor((floor-1)/10))]; }

/* Named floor themes + boss names (display text only — visuals/colors still come from REGIONS above) */

export const FLOOR_INFO = {
  1:{theme:'Town of Beginnings, Grassland', boss:'Illfang the Kobold Lord'},
  2:{theme:'Forest', boss:'Wolf King'},
  3:{theme:'Rocky Hills', boss:'Stone Golem'},
  4:{theme:'Lake & River', boss:'Sea Serpent'},
  5:{theme:'Desert', boss:'Sand Scorpion'},
  6:{theme:'Dark Forest', boss:'Giant Spider'},
  7:{theme:'Swamp', boss:'Poison Hydra'},
  8:{theme:'Snow Field', boss:'Ice Wolf'},
  9:{theme:'Ancient Ruins', boss:'Guardian Knight'},
  10:{theme:'Volcano', boss:'Fire Dragon'},
  11:{theme:'Bamboo Forest', boss:'Samurai Captain'},
  12:{theme:'Castle Ruins', boss:'Undead King'},
  13:{theme:'Crystal Cave', boss:'Crystal Beast'},
  14:{theme:'Flower Valley', boss:'Queen Bee'},
  15:{theme:'Jungle', boss:'Giant Gorilla'},
  16:{theme:'Frozen Cave', boss:'Ice Giant'},
  17:{theme:'Canyon', boss:'Wyvern'},
  18:{theme:'Underground Mine', boss:'Rock Titan'},
  19:{theme:'Haunted Village', boss:'Ghost Lord'},
  20:{theme:'Thunder Plains', boss:'Thunder Griffin'},
  30:{theme:'Sky Islands', boss:'Sky Dragon'},
  40:{theme:'Lava Fortress', boss:'Demon General'},
  50:{theme:'Crystal Palace', boss:'Crystal Emperor'},
  60:{theme:'Frozen Kingdom', boss:'Ice Emperor'},
  70:{theme:'Mechanical City', boss:'Iron Titan'},
  80:{theme:'Demon Castle', boss:'Demon King'},
  90:{theme:'Celestial Realm', boss:'Archangel Boss'},
  100:{theme:'Ruby Palace', boss:'Heathcliff (Final Boss)'},
};

export const FLOOR_BLOCKS = [
  {min:21,max:29,theme:'Stronger Regions',bossPool:['Elite Boss']},
  {min:31,max:39,theme:'Floating Forests',bossPool:['Advanced Monster']},
  {min:41,max:49,theme:'Dark Kingdom',bossPool:['Dark Knight']},
  {min:51,max:59,theme:'Ocean Kingdom',bossPool:['Leviathan Spawn']},
  {min:61,max:69,theme:'Shadow Realm',bossPool:['Shadow King\'s Herald']},
  {min:71,max:79,theme:'Holy Kingdom',bossPool:['Fallen Angel']},
  {min:81,max:89,theme:'Dragon Mountains',bossPool:['Ancient Dragon']},
  {min:91,max:99,theme:'Final Aincrad Floors',bossPool:['Elite Floor Lord']},
];

export function getFloorTheme(floor){
  if(FLOOR_INFO[floor]) return FLOOR_INFO[floor].theme;
  const block = FLOOR_BLOCKS.find(b=>floor>=b.min && floor<=b.max);
  return block ? block.theme : regionFor(floor).name;
}

export function getFloorBossName(floor){
  if(FLOOR_INFO[floor]) return FLOOR_INFO[floor].boss;
  const block = FLOOR_BLOCKS.find(b=>floor>=b.min && floor<=b.max);
  return block ? `${block.bossPool[0]} (Floor ${floor})` : `Guardian of Floor ${floor}`;
}

export let scene, camera, renderer, clock;
export let playerMesh;

export let worldGroup;

export let remoteGroup;

export let raycaster;

export const keys = {};

export const camState = { yaw: 0, pitch: 0 };

export let pointerLocked = false;

export const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if(isTouchDevice){
  // Belt-and-suspenders: some mobile browsers still allow pinch-zoom/scroll bounce
  // even with CSS touch-action set, which visually "shakes" the camera. Kill it at the JS level too.
  document.addEventListener('touchmove', e=>{ if(!e.target.closest('input,textarea,.modal,#bugModal')) e.preventDefault(); }, {passive:false});
  document.addEventListener('gesturestart', e=>e.preventDefault());
  document.addEventListener('dblclick', e=>e.preventDefault());
}

export const touchMove = {x:0, y:0}; // x: strafe (-1..1), y: forward (-1..1), from virtual joystick


export const player = {
  pos: new THREE.Vector3(0, 1.7, 0),
  vel: new THREE.Vector3(),
  radius: 0.5,
};

export let enemies = [];

export let props = [];

export let interactables = []; // {mesh, type, action, range}

export function init3D(){
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(72, window.innerWidth/window.innerHeight, 0.1, 500);
  renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  document.body.appendChild(renderer.domElement);
  clock = new THREE.Clock();
  raycaster = new THREE.Raycaster();
  worldGroup = new THREE.Group();
  scene.add(worldGroup);
  remoteGroup = new THREE.Group();
  scene.add(remoteGroup);

  // Visible player body (third-person). Lives directly on the scene (not worldGroup)
  // so it survives buildTown()/buildField() calls, which clear worldGroup on every transition.
  playerMesh = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({color:0x4fd8ff, emissive:0x4fd8ff, emissiveIntensity:0.7, roughness:0.4});
  const body = makeCapsuleMesh(0.45, 1.15, bodyMat);
  body.position.y = 1.05;
  playerMesh.add(body);
  const headMat = new THREE.MeshStandardMaterial({color:0xd8b98a, roughness:0.8});
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28,12,12), headMat);
  head.position.y = 1.95;
  playerMesh.add(head);
  // small forward-facing indicator (a "sword" hint) so facing direction reads clearly in third-person
  const swordMat = new THREE.MeshStandardMaterial({color:0xeaf6ff, metalness:0.7, roughness:0.25, emissive:0x8fd8ff, emissiveIntensity:0.6});
  const sword = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.09,1.0), swordMat);
  sword.position.set(0, 1.05, 0.55);
  playerMesh.add(sword);
  // self-illuminating light so the character always reads clearly, regardless of floor/fog lighting
  const playerLight = new THREE.PointLight(0x8fd8ff, 0.9, 8);
  playerLight.position.y = 1.5;
  playerMesh.add(playerLight);
  scene.add(playerMesh);

  window.addEventListener('resize', ()=>{
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  document.addEventListener('keydown', e=>{ keys[e.code]=true; handleKeyPress(e.code); });
  document.addEventListener('keyup', e=>{ keys[e.code]=false; });
  renderer.domElement.addEventListener('click', ()=>{
    if(isTouchDevice) return; // touch uses on-screen controls instead of pointer lock
    if(!pointerLocked){ renderer.domElement.requestPointerLock(); }
    else { doAttack(); }
  });
  document.addEventListener('pointerlockchange', ()=>{
    pointerLocked = document.pointerLockElement === renderer.domElement;
  });
  document.addEventListener('mousemove', e=>{
    if(!pointerLocked) return;
    camState.yaw -= e.movementX * 0.0022;
    camState.pitch -= e.movementY * 0.0022;
    camState.pitch = Math.max(-1.2, Math.min(1.2, camState.pitch));
  });

  if(isTouchDevice) initTouchControls();

  try{
    buildTown(state.floor);
  }catch(err){
    console.error('World build failed, retrying without network features:', err);
    if(hub.connected || hubPeer) disconnectGlobalHub();
    try{ buildTown(state.floor); }catch(err2){ console.error('World still failed to build:', err2); }
  }
  animate();
}

export function initTouchControls(){
  document.getElementById('touchLayer').style.display = 'block';
  document.getElementById('hotbar').style.display = 'none';
  document.getElementById('crosshair').style.display = 'none';
  document.body.classList.add('touch-mode');

  // ---- Virtual joystick (left zone) ----
  const zone = document.getElementById('joystickZone');
  const base = document.getElementById('joystickBase');
  const knob = document.getElementById('joystickKnob');
  let joyId = null, joyOrigin = {x:0,y:0};
  const JOY_R = 55;

  zone.addEventListener('touchstart', e=>{
    for(const t of e.changedTouches){
      if(joyId !== null) continue;
      joyId = t.identifier;
      joyOrigin = {x:t.clientX, y:t.clientY};
      base.style.left = (t.clientX-55)+'px';
      base.style.top = (t.clientY-55)+'px';
      base.style.display = 'block';
    }
    e.preventDefault();
  }, {passive:false});

  zone.addEventListener('touchmove', e=>{
    for(const t of e.changedTouches){
      if(t.identifier !== joyId) continue;
      let dx = t.clientX - joyOrigin.x, dy = t.clientY - joyOrigin.y;
      const d = Math.hypot(dx,dy);
      if(d > JOY_R){ dx = dx/d*JOY_R; dy = dy/d*JOY_R; }
      knob.style.left = (32+dx)+'px';
      knob.style.top = (32+dy)+'px';
      touchMove.x = dx/JOY_R;      // strafe
      touchMove.y = -dy/JOY_R;     // forward (screen-up = forward)
    }
    e.preventDefault();
  }, {passive:false});

  function endJoy(e){
    for(const t of e.changedTouches){
      if(t.identifier !== joyId) continue;
      joyId = null;
      base.style.display = 'none';
      knob.style.left='32px'; knob.style.top='32px';
      touchMove.x = 0; touchMove.y = 0;
    }
  }
  zone.addEventListener('touchend', endJoy);
  zone.addEventListener('touchcancel', endJoy);

  // ---- Look drag (right zone) ----
  const lookZone = document.getElementById('lookZone');
  let lookId = null, lastX=0, lastY=0;
  lookZone.addEventListener('touchstart', e=>{
    for(const t of e.changedTouches){
      if(lookId !== null) continue;
      lookId = t.identifier;
      lastX = t.clientX; lastY = t.clientY;
    }
    e.preventDefault();
  }, {passive:false});
  lookZone.addEventListener('touchmove', e=>{
    for(const t of e.changedTouches){
      if(t.identifier !== lookId) continue;
      const dx = t.clientX - lastX, dy = t.clientY - lastY;
      lastX = t.clientX; lastY = t.clientY;
      camState.yaw += dx * 0.0045;
      camState.pitch -= dy * 0.0045;
      camState.pitch = Math.max(-1.2, Math.min(1.2, camState.pitch));
    }
    e.preventDefault();
  }, {passive:false});
  function endLook(e){
    for(const t of e.changedTouches){ if(t.identifier===lookId) lookId=null; }
  }
  lookZone.addEventListener('touchend', endLook);
  lookZone.addEventListener('touchcancel', endLook);

  // ---- Buttons ----
  const bindTap = (el, fn)=>{
    el.addEventListener('touchstart', e=>{ e.preventDefault(); e.stopPropagation(); fn(); }, {passive:false});
  };
  bindTap(document.getElementById('touchAttackBtn'), ()=>doAttack());
  bindTap(document.getElementById('touchInteractBtn'), ()=>tryInteract());
  document.querySelectorAll('.touchSkillBtn').forEach(btn=>{
    bindTap(btn, ()=>useSkill(btn.dataset.skill));
  });
  document.querySelectorAll('.touchMenuBtn').forEach(btn=>{
    bindTap(btn, ()=>toggleModal(btn.dataset.modal));
  });
}

export function clearWorld(){
  while(worldGroup.children.length) worldGroup.remove(worldGroup.children[0]);
  enemies.forEach(e=>{ if(e.hpBarEl) e.hpBarEl.remove(); });
  enemies = [];
  props = [];
  interactables = [];
}

export function makeSkyTexture(topColor, bottomColor){
  const canvas = document.createElement('canvas');
  canvas.width = 2; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0,0,0,256);
  grad.addColorStop(0, '#' + topColor.getHexString());
  grad.addColorStop(0.55, '#' + bottomColor.getHexString());
  grad.addColorStop(1, '#' + bottomColor.getHexString());
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,2,256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function setAtmosphere(theme){
  scene.fog = new THREE.Fog(theme.fog, 16, 95);
  const skyTop = new THREE.Color(theme.accent).lerp(new THREE.Color(0x000000), 0.72);
  const skyBottom = new THREE.Color(theme.fog);
  const skyTex = makeSkyTexture(skyTop, skyBottom);
  const skyGeo = new THREE.SphereGeometry(300, 16, 16);
  const skyMat = new THREE.MeshBasicMaterial({map:skyTex, side:THREE.BackSide, fog:false});
  const sky = new THREE.Mesh(skyGeo, skyMat);
  worldGroup.add(sky);
  scene.background = skyBottom;
  worldGroup.add(new THREE.AmbientLight(theme.ambient, 1.9));
  const dl = new THREE.DirectionalLight(theme.accent, 0.85);
  dl.position.set(10,20,10);
  worldGroup.add(dl);
  const hemi = new THREE.HemisphereLight(theme.accent, 0x151515, 0.7);
  worldGroup.add(hemi);
}

export function makeGround(theme, size){
  const g = new THREE.Mesh(
    new THREE.CircleGeometry(size, 48),
    new THREE.MeshStandardMaterial({color:theme.ground, roughness:0.9, metalness:0.15})
  );
  g.rotation.x = -Math.PI/2;
  worldGroup.add(g);
  // grid ring accents
  for(let r=8; r<size; r+=10){
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r-0.05, r+0.05, 64),
      new THREE.MeshBasicMaterial({color:theme.accent, transparent:true, opacity:0.12, side:THREE.DoubleSide})
    );
    ring.rotation.x = -Math.PI/2; ring.position.y = 0.02;
    worldGroup.add(ring);
  }
}

export function makePillar(x,z,h,theme,glow){
  const grp = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6,0.8,h,8),
    new THREE.MeshStandardMaterial({color:0x1a1f26, roughness:0.5, metalness:0.6})
  );
  body.position.y = h/2;
  grp.add(body);
  if(glow){
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.75,0.06,8,20),
      new THREE.MeshBasicMaterial({color:theme.accent})
    );
    ring.position.y = h*0.7; ring.rotation.x = Math.PI/2;
    grp.add(ring);
  }
  grp.position.set(x,0,z);
  worldGroup.add(grp);
  props.push(grp);
  return grp;
}

export function makeCrystalShard(x,y,z,scale,theme){
  const m = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.5*scale,0),
    new THREE.MeshStandardMaterial({color:theme.accent, emissive:theme.accent, emissiveIntensity:0.5, transparent:true, opacity:0.75, roughness:0.2})
  );
  m.position.set(x,y,z);
  m.userData.floatBase = y;
  m.userData.floatSpeed = 0.5+Math.random();
  worldGroup.add(m);
  props.push(m);
  return m;
}

export function makeTree(x,z,theme){
  const grp = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.35,2.2,6), new THREE.MeshStandardMaterial({color:0x2a1f18, roughness:1}));
  trunk.position.y = 1.1;
  grp.add(trunk);
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3,0), new THREE.MeshStandardMaterial({color:theme.ambient, emissive:theme.accent, emissiveIntensity:0.12, roughness:0.9}));
  leaves.position.y = 2.6;
  grp.add(leaves);
  grp.position.set(x,0,z);
  worldGroup.add(grp);
  props.push(grp);
}

export function makeGate(x,z,theme,label,active){
  const grp = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({color:0x22282f, metalness:0.7, roughness:0.4});
  const l = new THREE.Mesh(new THREE.BoxGeometry(0.4,4,0.4), frameMat); l.position.set(-1.6,2,0); grp.add(l);
  const r = new THREE.Mesh(new THREE.BoxGeometry(0.4,4,0.4), frameMat); r.position.set(1.6,2,0); grp.add(r);
  const t = new THREE.Mesh(new THREE.BoxGeometry(3.6,0.4,0.4), frameMat); t.position.set(0,4,0); grp.add(t);
  const portal = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8,3.6),
    new THREE.MeshBasicMaterial({color:theme.accent, transparent:true, opacity:active?0.55:0.15, side:THREE.DoubleSide})
  );
  portal.position.set(0,2,0);
  grp.add(portal);
  grp.position.set(x,0,z);
  worldGroup.add(grp);
  props.push(grp);
  grp.userData.portal = portal;
  return grp;
}

export function makeCapsuleMesh(radius, height, material){
  const grp = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 8), material);
  grp.add(cyl);
  const topCap = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), material);
  topCap.position.y = height/2;
  grp.add(topCap);
  const botCap = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), material);
  botCap.position.y = -height/2;
  grp.add(botCap);
  return grp;
}

export function buildField(floorNum){
  if(hub.connected) disconnectGlobalHub();
  clearWorld();
  const theme = regionFor(floorNum);
  setAtmosphere(theme);
  makeGround(theme, 40);

  const rng = mulberry32(floorNum*13+7);
  const treeCount = 18 + Math.floor(rng()*10);
  for(let i=0;i<treeCount;i++){
    const x = (rng()-0.5)*70, z = (rng()-0.5)*70;
    if(Math.abs(x)<6 && Math.abs(z)<6) continue;
    makeTree(x,z,theme);
  }
  for(let i=0;i<10;i++){
    makeCrystalShard((rng()-0.5)*60, 3+rng()*8, (rng()-0.5)*60, 0.5+rng()*1.2, theme);
  }
  for(let i=0;i<6;i++){
    makePillar((rng()-0.5)*55,(rng()-0.5)*55, 3+rng()*3, theme, rng()>0.5);
  }

  // Return gate back to town
  const returnGate = makeGate(0, 10, theme, 'TOWN', true);
  interactables.push({obj:returnGate, type:'townGate', range:3.2});

  // Scale difficulty with floor number
  const floorScale = 1 + (floorNum-1)*0.12;
  state.killCount = 0;
  state.killTarget = 4 + Math.floor(floorNum/15);
  state.fieldCleared = false;
  state.bossAlive = true;
  state.bossSpawned = false;

  // spawn regular enemies
  const enemyCount = state.killTarget + 2;
  for(let i=0;i<enemyCount;i++){
    const x = (rng()-0.5)*55, z = (rng()-0.5)*55;
    const elite = rng() > 0.78;
    spawnEnemy(x,z,theme,floorScale,elite,false);
  }

  player.pos.set(0, 1.7, 8);
  camState.yaw = Math.PI;
  state.area = 'field';
  updateHUD();
  showToast(`Field entered — defeat ${state.killTarget} monsters to summon the Floor Boss`);
}

export function goToTown(floorNum, fromNetwork){
  if(team.inTeam && !team.isHost && !fromNetwork){
    showToast('Sirf Team Leader floor/area badal sakta hai');
    return;
  }
  state.floor = floorNum;
  buildTown(floorNum);
  if(!fromNetwork && team.inTeam && team.isHost){
    netBroadcast({type:'floorSync', floor:floorNum, area:'town'});
  }
}

export function goToField(floorNum, fromNetwork){
  if(team.inTeam && !team.isHost && !fromNetwork){
    showToast('Sirf Team Leader floor/area badal sakta hai');
    return;
  }
  state.floor = floorNum;
  buildField(floorNum);
  if(!fromNetwork && team.inTeam && team.isHost){
    netBroadcast({type:'floorSync', floor:floorNum, area:'field'});
  }
}

export function tryUnlockNextFloor(){
  if(state.floor < MAX_FLOOR){
    state.maxUnlocked = Math.max(state.maxUnlocked, state.floor+1);
  }
  state.clearedFloors.add(state.floor);
  saveGame();
}

export let nearestInteract = null;

export function tryInteract(){
  if(!nearestInteract) return;
  const type = nearestInteract.type;
  if(type==='fieldGate') goToField(state.floor);
  else if(type==='townGate') goToTown(state.floor);
  else if(type==='nextFloor'){
    if(state.floor < MAX_FLOOR){ goToTown(state.floor+1); }
  }
  else if(type==='mapCrystal') toggleModal('mapModal');
  else if(type==='shopNpc') toggleModal('shopModal');
  else if(type==='questNpc') toggleModal('questModal');
}

export function updateMovement(dt){
  const speed = 6.5;
  const forward = new THREE.Vector3(Math.sin(camState.yaw), 0, Math.cos(camState.yaw));
  const up = new THREE.Vector3(0,1,0);
  const right = new THREE.Vector3().crossVectors(up, forward).normalize();
  let fAmt = 0, rAmt = 0;
  if(keys['KeyW']) fAmt += 1;
  if(keys['KeyS']) fAmt -= 1;
  if(keys['KeyD']) rAmt += 1;
  if(keys['KeyA']) rAmt -= 1;
  fAmt += touchMove.y;
  rAmt += touchMove.x;
  const rawMag = Math.hypot(fAmt, rAmt);
  if(rawMag > 1){ fAmt /= rawMag; rAmt /= rawMag; }
  const move = new THREE.Vector3().addScaledVector(forward, fAmt).addScaledVector(right, rAmt);
  if(move.lengthSq()>0){
    move.multiplyScalar(speed*dt);
    player.pos.add(move);
  }
  const bound = state.area==='town' ? 28 : 38;
  player.pos.x = Math.max(-bound, Math.min(bound, player.pos.x));
  player.pos.z = Math.max(-bound, Math.min(bound, player.pos.z));

  const dir = new THREE.Vector3(
    Math.sin(camState.yaw)*Math.cos(camState.pitch),
    Math.sin(camState.pitch),
    Math.cos(camState.yaw)*Math.cos(camState.pitch)
  );

  // Visible third-person body: follows the player, faces the movement/look direction.
  if(playerMesh){
    playerMesh.position.set(player.pos.x, 0, player.pos.z);
    playerMesh.rotation.y = camState.yaw;
  }

  // Third-person camera: orbit behind+above the player, looking at them.
  const camDist = 4.6, camHeightOffset = 1.6;
  camera.position.copy(player.pos).addScaledVector(dir, -camDist);
  camera.position.y += camHeightOffset;
  camera.lookAt(player.pos.clone().setY(player.pos.y - 0.2));
}

export function updateProps(t){
  props.forEach(p=>{
    if(p.userData.floatBase !== undefined){
      p.position.y = p.userData.floatBase + Math.sin(t*p.userData.floatSpeed)*0.4;
      p.rotation.y += 0.01;
    }
  });
}

export function updateInteractPrompt(){
  let nearest = null, nearestDist = 999;
  interactables.forEach(it=>{
    const d = it.obj.position.distanceTo(player.pos);
    if(d < it.range && d < nearestDist){ nearest = it; nearestDist = d; }
  });
  nearestInteract = nearest;
  const prompt = document.getElementById('interactPrompt');
  const touchBtn = document.getElementById('touchInteractBtn');
  const shortLabels = {fieldGate:'FIELD', townGate:'TOWN', nextFloor:'ASCEND', mapCrystal:'MAP', shopNpc:'SHOP', questNpc:'QUEST'};
  if(nearest){
    const labels = {fieldGate:'[E] Enter Field', townGate:'[E] Return to Town', nextFloor:`[E] Ascend to Floor ${state.floor+1}`, mapCrystal:'[E] Open Floor Map', shopNpc:'[E] Talk to Shopkeeper', questNpc:'[E] Talk to Quest Giver'};
    prompt.textContent = labels[nearest.type] || '[E] Interact';
    prompt.style.display='block';
    if(touchBtn){ touchBtn.textContent = shortLabels[nearest.type] || 'USE'; touchBtn.style.display='flex'; }
  } else {
    prompt.style.display='none';
    if(touchBtn) touchBtn.style.display='none';
  }
}
