/* ============================================================
   THE RISE OF ILJANOR — monsters.js
   Auto-split from the original single-file index.html. Behavior is
   unchanged; this is a pure modularization refactor.
   ============================================================ */
import { enemyAttackPlayer, playBossRoarSfx, showBanner } from './combat.js';
import { state } from './player.js';
import { showToast } from './ui.js';
import { enemies, getFloorBossName, makeCapsuleMesh, player, regionFor, worldGroup } from './world.js';

export function spawnEnemyMesh(theme, elite, floorScale, boss){
  const grp = new THREE.Group();
  const bodyColor = boss ? 0xff1a3d : (elite ? 0xff6a1a : 0xd6342f);
  const size = boss ? 1.9 : (elite ? 1.25 : 1);
  const body = makeCapsuleMesh(
    0.45*size, 1.1*size,
    new THREE.MeshStandardMaterial({color:bodyColor, emissive:bodyColor, emissiveIntensity: boss?0.85:(elite?0.65:0.5), roughness:0.5})
  );
  body.position.y = 1.0*size;
  grp.add(body);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13*size,8,8), new THREE.MeshBasicMaterial({color:0xffff00}));
  eye.position.set(0, 1.5*size, 0.4*size);
  grp.add(eye);
  // ground marker ring so enemies are spottable even from a distance / behind foliage
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55*size, 0.7*size, 20),
    new THREE.MeshBasicMaterial({color:bodyColor, transparent:true, opacity:0.7, side:THREE.DoubleSide})
  );
  ring.rotation.x = -Math.PI/2;
  ring.position.y = 0.05;
  grp.add(ring);
  return grp;
}

export function spawnEnemy(x,z,theme,floorScale,elite,boss){
  const mesh = spawnEnemyMesh(theme, elite, floorScale, boss);
  mesh.position.set(x,0,z);
  worldGroup.add(mesh);
  const baseHp = boss ? 140 : (elite ? 55 : 28);
  const baseAtk = boss ? 16 : (elite ? 9 : 5);
  const e = {
    mesh, boss, elite,
    netIdx: enemies.length,
    hp: Math.round(baseHp*floorScale), maxHp: Math.round(baseHp*floorScale),
    atk: Math.round(baseAtk*floorScale), def: Math.round((boss?6:elite?3:1)*floorScale),
    speed: boss?2.6:(elite?3.2:2.8),
    state:'idle', target:null, attackCd:0,
    xp: boss ? (60+floorScale*20) : (elite?18:8),
  };
  mesh.userData.enemyRef = e;
  enemies.push(e);
  return e;
}

export function spawnFloorBoss(){
  state.bossSpawned = true;
  const theme = regionFor(state.floor);
  const floorScale = 1 + (state.floor-1)*0.12;
  const boss = spawnEnemy(0,-20,theme,floorScale,false,true);
  showBanner(`FLOOR ${state.floor} BOSS`, milestoneBossName(state.floor));
  playBossRoarSfx();
}

export function milestoneBossName(floor){
  return getFloorBossName(floor);
}

export const RARITY_WEIGHTS = [['common',0.6],['rare',0.32],['epic',0.08]];

export function rollRarity(){
  const r = Math.random(); let acc=0;
  for(const [name,w] of RARITY_WEIGHTS){ acc+=w; if(r<=acc) return name; }
  return 'common';
}

export function maybeDropLoot(e){
  const chance = e.boss ? 1 : (e.elite ? 0.6 : 0.28);
  if(Math.random() > chance) return;
  const rarity = e.boss ? (Math.random()<0.5?'epic':'rare') : rollRarity();
  const isWeapon = Math.random() > 0.5;
  const mult = {common:1, rare:1.8, epic:2.8}[rarity];
  const scale = 1 + (state.floor-1)*0.08;
  const item = isWeapon
    ? {type:'weapon', name:`${rarity[0].toUpperCase()+rarity.slice(1)} Blade`, atk: Math.round((3+state.floor*0.4)*mult*scale), rarity}
    : {type:'armor', name:`${rarity[0].toUpperCase()+rarity.slice(1)} Armor`, def: Math.round((2+state.floor*0.3)*mult*scale), atkBonus:0, rarity};
  state.inventory.push(item);
  showToast(`Loot: ${item.name} (${rarity})`);
}

export function updateEnemies(dt){
  enemies.forEach(e=>{
    if(e.hp<=0) return;
    const d = e.mesh.position.distanceTo(player.pos);
    const aggroRange = e.boss ? 16 : 9;
    if(d < aggroRange){
      const dir = new THREE.Vector3().subVectors(player.pos, e.mesh.position);
      dir.y = 0;
      const dist = dir.length();
      if(dist > 1.6){
        dir.normalize();
        e.mesh.position.addScaledVector(dir, e.speed*dt);
        e.mesh.lookAt(player.pos.x, e.mesh.position.y, player.pos.z);
      } else {
        e.attackCd -= dt;
        if(e.attackCd <= 0){
          e.attackCd = e.boss ? 1.3 : 1.6;
          enemyAttackPlayer(e, e.atk);
        }
      }
    }
  });
}
