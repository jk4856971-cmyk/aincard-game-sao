/* ============================================================
   AINCRAD — town.js
   Auto-split from the original single-file index.html. Behavior is
   unchanged; this is a pure modularization refactor.
   ============================================================ */
import { connectGlobalHub, disconnectGlobalHub, hub } from './network.js';
import { MAX_FLOOR, state } from './player.js';
import { updateHUD } from './ui.js';
import { camState, clearWorld, interactables, makeCapsuleMesh, makeCrystalShard, makeGate, makeGround, makePillar, mulberry32, player, props, regionFor, setAtmosphere, worldGroup } from './world.js';

export function makeHouse(x,z,rotY,theme){
  const grp = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({color:0x3a3428, roughness:0.9});
  const roofMat = new THREE.MeshStandardMaterial({color:0x6a2020, roughness:0.8});
  const w = 3.2 + Math.random()*1.4, d = 2.8 + Math.random()*1.2, h = 2.4;
  const base = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), wallMat);
  base.position.y = h/2;
  grp.add(base);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*0.8, 1.6, 4), roofMat);
  roof.position.y = h + 0.6;
  roof.rotation.y = Math.PI/4;
  grp.add(roof);
  const doorMat = new THREE.MeshStandardMaterial({color:0x1a1410, roughness:0.7});
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.7,1.3,0.1), doorMat);
  door.position.set(0, 0.65, d/2+0.05);
  grp.add(door);
  const winMat = new THREE.MeshStandardMaterial({color:theme.accent, emissive:theme.accent, emissiveIntensity:0.6});
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.5), winMat);
  win.position.set(w/3, 1.5, d/2+0.05);
  grp.add(win);
  grp.position.set(x,0,z);
  grp.rotation.y = rotY;
  worldGroup.add(grp);
  props.push(grp);
  return grp;
}

export function makeFountain(x,z,theme){
  const grp = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({color:0x555560, roughness:0.6, metalness:0.2});
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.4,0.5,20), baseMat);
  rim.position.y = 0.25;
  grp.add(rim);
  const waterMat = new THREE.MeshStandardMaterial({color:theme.accent, emissive:theme.accent, emissiveIntensity:0.4, transparent:true, opacity:0.75});
  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.0,2.0,0.15,20), waterMat);
  water.position.y = 0.42;
  grp.add(water);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.35,1.6,10), baseMat);
  pillar.position.y = 1.0;
  grp.add(pillar);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.35,10,10), waterMat);
  top.position.y = 1.9;
  grp.add(top);
  grp.position.set(x,0,z);
  worldGroup.add(grp);
  props.push(grp);
  return grp;
}

export function makeLantern(x,z,theme){
  const grp = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.08,2.2,6), new THREE.MeshStandardMaterial({color:0x1c1c1c, roughness:0.5, metalness:0.6}));
  pole.position.y = 1.1;
  grp.add(pole);
  const lampMat = new THREE.MeshStandardMaterial({color:theme.accent, emissive:theme.accent, emissiveIntensity:1.1});
  const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.22,0), lampMat);
  lamp.position.y = 2.3;
  grp.add(lamp);
  const glow = new THREE.PointLight(theme.accent, 0.6, 6);
  glow.position.y = 2.3;
  grp.add(glow);
  grp.position.set(x,0,z);
  worldGroup.add(grp);
  props.push(grp);
  return grp;
}

export function makeNPC(x,z,theme,robeColor,markerColor){
  const grp = new THREE.Group();
  const robe = makeCapsuleMesh(
    0.42, 1.15,
    new THREE.MeshStandardMaterial({color:robeColor, roughness:0.7, metalness:0.1})
  );
  robe.position.y = 1.0;
  grp.add(robe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28,10,10), new THREE.MeshStandardMaterial({color:0xd8b98a, roughness:0.8}));
  head.position.y = 1.85;
  grp.add(head);
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.18,0), new THREE.MeshBasicMaterial({color:markerColor}));
  marker.position.y = 2.5;
  marker.userData.floatBase = 2.5;
  marker.userData.floatSpeed = 1.4;
  grp.add(marker);
  props.push(marker);
  grp.position.set(x,0,z);
  worldGroup.add(grp);
  return grp;
}

export function buildTown(floorNum){
  clearWorld();
  const theme = regionFor(floorNum);
  setAtmosphere(theme);
  makeGround(theme, 30);

  const rng = mulberry32(floorNum*7+1);
  // ring of pillars
  for(let i=0;i<10;i++){
    const a = (i/10)*Math.PI*2;
    makePillar(Math.cos(a)*14, Math.sin(a)*14, 4+rng()*2, theme, true);
  }
  for(let i=0;i<14;i++){
    makeCrystalShard((rng()-0.5)*26, 4+rng()*6, (rng()-0.5)*26, 0.6+rng()*0.8, theme);
  }

  // Town life: houses ringing the plaza, a central fountain, lanterns lighting the paths
  for(let i=0;i<7;i++){
    const a = (i/7)*Math.PI*2 + 0.3;
    const r = 20 + rng()*3;
    makeHouse(Math.cos(a)*r, Math.sin(a)*r, -a + Math.PI, theme);
  }
  makeFountain(0, 3, theme);
  const lanternSpots = [[4,-6],[-4,-6],[4,1],[-4,1],[10,-9],[-10,-9]];
  lanternSpots.forEach(([lx,lz])=>makeLantern(lx,lz,theme));

  // Field gate
  const fieldGate = makeGate(0, -12, theme, 'FIELD', true);
  interactables.push({obj:fieldGate, type:'fieldGate', range:3.2});

  // Floor map crystal (always accessible)
  const mapCrystal = makeCrystalShard(8, 1.4, 6, 1.8, theme);
  interactables.push({obj:mapCrystal, type:'mapCrystal', range:2.6});

  // NPCs
  const shopNpc = makeNPC(6, -3, theme, 0x2a5a7a, 0xffd76a);
  interactables.push({obj:shopNpc, type:'shopNpc', range:2.8});
  const questNpc = makeNPC(-6, -3, theme, 0x5a2a4a, 0x7fff8a);
  interactables.push({obj:questNpc, type:'questNpc', range:2.8});

  // Next-floor stairs (only if this floor already cleared)
  if(state.clearedFloors.has(floorNum) && floorNum < MAX_FLOOR){
    const stairs = makeGate(-8, 6, theme, 'NEXT FLOOR', true);
    interactables.push({obj:stairs, type:'nextFloor', range:3.2});
  }

  player.pos.set(0, 1.7, 8);
  camState.yaw = Math.PI;
  state.area = 'town';
  updateHUD();

  if(floorNum === 1){
    connectGlobalHub();
  } else if(hub.connected){
    disconnectGlobalHub();
  }
}

export function getShopStock(){
  const rng = mulberry32(state.floor*31+5);
  const stock = [];
  const rarities = ['common','rare','epic'];
  for(let i=0;i<4;i++){
    const rarity = rarities[Math.min(2, Math.floor(rng()*3))];
    const mult = {common:1, rare:1.8, epic:2.8}[rarity];
    const scale = 1 + (state.floor-1)*0.08;
    const isWeapon = i%2===0;
    const item = isWeapon
      ? {type:'weapon', name:`${rarity[0].toUpperCase()+rarity.slice(1)} Blade`, atk: Math.round((3+state.floor*0.4)*mult*scale), rarity}
      : {type:'armor', name:`${rarity[0].toUpperCase()+rarity.slice(1)} Armor`, def: Math.round((2+state.floor*0.3)*mult*scale), atkBonus:0, rarity};
    const cost = Math.round((isWeapon?item.atk:item.def) * {common:6, rare:9, epic:14}[rarity]);
    stock.push({item, cost});
  }
  return stock;
}
