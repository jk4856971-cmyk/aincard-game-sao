/* ============================================================
   AINCRAD — player.js
   Auto-split from the original single-file index.html. Behavior is
   unchanged; this is a pure modularization refactor.
   ============================================================ */
import { currentAtk, dealDamage, playLevelUpSfx } from './combat.js';
import { saveGame } from './save.js';
import { showToast, updateHUD } from './ui.js';
import { camState, enemies, player } from './world.js';

export const MAX_FLOOR = 100;

export const state = {
  floor: 1,
  maxUnlocked: 1,
  area: 'town', // 'town' | 'field'
  clearedFloors: new Set(),
  level: 1, xp: 0, xpNext: 50,
  hp: 100, maxHp: 100, atk: 10, def: 5,
  skillPoints: 0,
  skills: { power:false, dash:false, heal:false, storm:false },
  cooldowns: { power:0, dash:0, heal:0, storm:0 },
  weapon: {name:'Basic Sword', atk:0, rarity:'common'},
  armor: null,
  inventory: [],
  fieldCleared: false,
  bossAlive: true,
  bossSpawned: false,
  killCount: 0,
  killTarget: 4,
  gold: 20,
  questAcceptedFloor: null,
  questClaimedFloors: new Set(),
  myId: null,
  myName: 'Swordsman',
  myEmail: null,
  myPicture: null,
  isGuest: true,
};

export const SKILL_DEFS = {
  power: {name:'Power Strike', desc:'Heavy hit, 2.2x damage', cost:1, req:1, cd:4},
  dash:  {name:'Blade Dash', desc:'Dash forward, hits enemies in path', cost:1, req:3, cd:6},
  heal:  {name:'Battle Heal', desc:'Restore 30% max HP', cost:2, req:5, cd:20},
  storm: {name:'Blade Storm', desc:'AOE hit around you, 1.5x dmg all nearby', cost:2, req:8, cd:12},
};

export function gainXP(amount){
  state.xp += amount;
  while(state.xp >= state.xpNext){
    state.xp -= state.xpNext;
    levelUp();
  }
  updateHUD();
}

export function levelUp(){
  state.level++;
  state.xpNext = Math.round(50 * Math.pow(1.22, state.level-1));
  state.maxHp += 14;
  state.hp = state.maxHp;
  state.atk += 2;
  state.def += 1;
  state.skillPoints++;
  showToast(`LEVEL UP! Now Lv.${state.level} — +1 Skill Point`);
  playLevelUpSfx();
  saveGame();
}

export function useSkill(key){
  const def = SKILL_DEFS[key];
  if(!state.skills[key]) { showToast(`${def.name} not unlocked yet (press K)`); return; }
  if(state.cooldowns[key] > 0) return;
  if(state.area !== 'field') { showToast('Skills only usable in Field'); return; }
  state.cooldowns[key] = def.cd;

  const dir = new THREE.Vector3(Math.sin(camState.yaw), 0, Math.cos(camState.yaw));
  if(key==='power'){
    enemies.forEach(e=>{
      if(e.hp<=0) return;
      const toE = new THREE.Vector3().subVectors(e.mesh.position, player.pos);
      if(toE.length()<3.4 && toE.normalize().dot(dir)>0.4){
        dealDamage(e, Math.round((currentAtk()-e.def)*2.2));
      }
    });
    showToast('Power Strike!');
  } else if(key==='dash'){
    player.pos.addScaledVector(dir, 4.5);
    enemies.forEach(e=>{
      const d = e.mesh.position.distanceTo(player.pos);
      if(d<3) dealDamage(e, Math.round((currentAtk()-e.def)*1.4));
    });
    showToast('Blade Dash!');
  } else if(key==='heal'){
    state.hp = Math.min(state.maxHp, state.hp + Math.round(state.maxHp*0.3));
    showToast('Battle Heal!');
  } else if(key==='storm'){
    enemies.forEach(e=>{
      if(e.hp<=0) return;
      const d = e.mesh.position.distanceTo(player.pos);
      if(d<5.5) dealDamage(e, Math.round((currentAtk()-e.def)*1.5));
    });
    showToast('Blade Storm!');
  }
  updateHUD();
}
