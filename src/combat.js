/* ============================================================
   THE RISE OF ILJANOR — combat.js
   Auto-split from the original single-file index.html. Behavior is
   unchanged; this is a pure modularization refactor.
   ============================================================ */
import { maybeDropLoot, spawnFloorBoss } from './monsters.js';
import { netBroadcast, team } from './network.js';
import { gainXP, state } from './player.js';
import { buildTown } from './town.js';
import { showToast, updateHUD } from './ui.js';
import { camState, camera, clock, enemies, player, tryUnlockNextFloor, worldGroup } from './world.js';

export const combatTimers = { attackCooldown: 0, lastAttackFlashTime: -10 };

export function currentAtk(){
  return state.atk + state.weapon.atk + (state.armor && state.armor.atkBonus ? state.armor.atkBonus : 0);
}

export function currentDef(){
  return state.def + (state.armor ? state.armor.def : 0);
}

export let sfxCtx = null;

export function ensureSfxCtx(){
  if(!sfxCtx){
    try{ sfxCtx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ return null; }
  }
  if(sfxCtx.state === 'suspended') sfxCtx.resume().catch(()=>{});
  return sfxCtx;
}

export function playTone(freq, dur, type, gainAmt, sweepTo){
  const ctx = ensureSfxCtx();
  if(!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if(sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + dur);
  gain.gain.setValueAtTime(gainAmt||0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + dur);
}

export function playSwingSfx(){ playTone(280, 0.13, 'sawtooth', 0.08, 900); }

export function playHitSfx(){ playTone(120, 0.09, 'square', 0.12, 60); }

export function playLevelUpSfx(){
  [523,659,784].forEach((f,i)=> setTimeout(()=>playTone(f, 0.22, 'triangle', 0.14), i*90));
}

export function playBossRoarSfx(){ playTone(80, 0.6, 'sawtooth', 0.18, 40); }


export function spawnSlashEffect(){
  const dir = new THREE.Vector3(Math.sin(camState.yaw), 0, Math.cos(camState.yaw));
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0)).normalize();
  const geo = new THREE.RingGeometry(0.9, 1.15, 16, 1, 0, Math.PI*0.75);
  const mat = new THREE.MeshBasicMaterial({color:0x9fe8ff, transparent:true, opacity:0.9, side:THREE.DoubleSide});
  const slash = new THREE.Mesh(geo, mat);
  slash.position.copy(player.pos).addScaledVector(dir, 1.4);
  slash.position.y -= 0.1;
  slash.lookAt(slash.position.clone().add(right));
  slash.rotation.z = Math.PI/2;
  worldGroup.add(slash);
  const start = performance.now();
  function animateSlash(){
    const t = (performance.now()-start)/180;
    if(t >= 1){ worldGroup.remove(slash); return; }
    slash.material.opacity = 0.9*(1-t);
    slash.scale.setScalar(1 + t*0.6);
    requestAnimationFrame(animateSlash);
  }
  animateSlash();
}

export function doAttack(){
  if(state.area !== 'field') return;
  if(combatTimers.attackCooldown > 0) return;
  combatTimers.attackCooldown = 0.45;
  spawnSlashEffect();
  playSwingSfx();
  const dir = new THREE.Vector3(Math.sin(camState.yaw), 0, Math.cos(camState.yaw));
  let hitAny = false;
  enemies.forEach(e=>{
    if(e.hp<=0) return;
    const toE = new THREE.Vector3().subVectors(e.mesh.position, player.pos);
    const dist = toE.length();
    if(dist < 4.2){
      toE.normalize();
      const dot = toE.dot(dir);
      if(dot > 0.15){
        hitAny = true;
        const dmg = Math.max(1, Math.round(currentAtk() - e.def + (Math.random()*4-2)));
        dealDamage(e, dmg);
      }
    }
  });
  if(hitAny) playHitSfx();
  combatTimers.lastAttackFlashTime = clock.getElapsedTime();
}

export function dealDamage(e, dmg){
  damageEnemy(e, dmg);
  if(team.inTeam){
    netBroadcast({type:'hit', enemyIdx:e.netIdx, dmg});
  }
}

export function damageEnemy(e, dmg){
  e.hp -= dmg;
  spawnDamagePopup(e.mesh.position, dmg, false);
  flashMesh(e.mesh);
  if(e.hp <= 0 && !e.dead){
    e.dead = true;
    killEnemy(e);
  }
}

export function killEnemy(e){
  worldGroup.remove(e.mesh);
  gainXP(e.xp);
  maybeDropLoot(e);
  const goldGain = Math.round((e.boss ? 25+state.floor*2 : (e.elite?6:3)) * (1+(state.floor-1)*0.05));
  state.gold += goldGain;
  if(team.inTeam){
    netBroadcast({type:'death', enemyIdx:e.netIdx});
  }
  if(e.boss){
    state.bossAlive = false;
    onBossDefeated();
  } else {
    state.killCount++;
    if(state.killCount >= state.killTarget && !state.bossSpawned){
      spawnFloorBoss();
    }
  }
  updateHUD();
}

export function onBossDefeated(){
  tryUnlockNextFloor();
  showBanner('BOSS DEFEATED', `Floor ${state.floor} cleared`);
  let msg = `Floor ${state.floor} cleared! Stairs unlocked in Town.`;
  if(state.questAcceptedFloor === state.floor && !state.questClaimedFloors.has(state.floor)){
    msg += ' Quest complete — collect your reward from the Quest Giver!';
  }
  showToast(msg);
}

export function showBanner(title, sub){
  const b = document.getElementById('banner');
  const s = document.getElementById('bannerSub');
  b.childNodes[0].nodeValue = title;
  s.textContent = sub || '';
  b.style.display = 'block';
  clearTimeout(showBanner._t);
  showBanner._t = setTimeout(()=>{ b.style.display='none'; }, 2600);
}

export function enemyAttackPlayer(e, dmg){
  const def = currentDef();
  const actual = Math.max(1, Math.round(dmg - def*0.6));
  state.hp -= actual;
  spawnDamagePopup(player.pos, actual, true);
  if(state.hp <= 0){
    state.hp = state.maxHp;
    showToast('You were defeated — respawned in Town.');
    state.floor = state.floor; // stay on same floor number
    buildTown(state.floor); // personal respawn, doesn't force teammates back
  }
  updateHUD();
}

export const popups = [];

export function spawnDamagePopup(pos3, amount, isPlayer){
  const div = document.createElement('div');
  div.textContent = (isPlayer?'-':'-') + amount;
  div.style.position='fixed';
  div.style.color = isPlayer ? '#ff5566' : '#ffd76a';
  div.style.fontSize='13px';
  div.style.fontWeight='bold';
  div.style.pointerEvents='none';
  div.style.textShadow='0 0 4px rgba(0,0,0,0.8)';
  document.body.appendChild(div);
  popups.push({div, pos:pos3.clone().add(new THREE.Vector3(0,2,0)), life:0.9});
}

export function updatePopups(dt){
  for(let i=popups.length-1;i>=0;i--){
    const p = popups[i];
    p.life -= dt;
    p.pos.y += dt*0.8;
    const v = p.pos.clone().project(camera);
    const x = (v.x*0.5+0.5)*window.innerWidth;
    const y = (-v.y*0.5+0.5)*window.innerHeight;
    p.div.style.left = x+'px'; p.div.style.top = y+'px';
    p.div.style.opacity = Math.max(0,p.life/0.9);
    if(p.life<=0){ p.div.remove(); popups.splice(i,1); }
  }
}

export function flashMesh(mesh){
  mesh.traverse(c=>{
    if(c.material && c.material.emissive){
      c.userData._origEmissive = c.userData._origEmissive || c.material.emissiveIntensity;
      c.material.emissiveIntensity = 1.2;
      setTimeout(()=>{ if(c.material) c.material.emissiveIntensity = c.userData._origEmissive; }, 120);
    }
  });
}
