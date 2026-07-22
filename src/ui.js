/* ============================================================
   THE RISE OF ILJANOR — ui.js
   Auto-split from the original single-file index.html. Behavior is
   unchanged; this is a pure modularization refactor.
   ============================================================ */
import { currentAtk, currentDef } from './combat.js';
import { renderHubModal, renderTeamModal } from './network.js';
import { MAX_FLOOR, SKILL_DEFS, gainXP, state, useSkill } from './player.js';
import { saveGame } from './save.js';
import { getShopStock } from './town.js';
import { getFloorTheme, goToTown, tryInteract } from './world.js';

export function handleKeyPress(code){
  if(code==='Digit1') useSkill('power');
  if(code==='Digit2') useSkill('dash');
  if(code==='Digit3') useSkill('heal');
  if(code==='Digit4') useSkill('storm');
  if(code==='KeyI') toggleModal('invModal');
  if(code==='KeyK') toggleModal('skillModal');
  if(code==='KeyM') toggleModal('mapModal');
  if(code==='KeyT') toggleModal('teamModal');
  if(code==='KeyH') toggleModal('hubModal');
  if(code==='KeyE') tryInteract();
  if(code==='Escape'){
    ALL_MODALS.forEach(id=>document.getElementById(id).style.display='none');
  }
}

export const ALL_MODALS = ['skillModal','invModal','mapModal','shopModal','questModal','teamModal','hubModal'];
document.querySelectorAll('.modalCloseBtn').forEach(el=>{
  el.addEventListener('click', ()=>{ ALL_MODALS.forEach(id=>document.getElementById(id).style.display='none'); });
});

export function toggleModal(id){
  const el = document.getElementById(id);
  const opening = el.style.display !== 'block';
  ALL_MODALS.forEach(m=>document.getElementById(m).style.display='none');
  if(opening){
    el.style.display='block';
    if(id==='skillModal') renderSkillModal();
    if(id==='invModal') renderInvModal();
    if(id==='mapModal') renderMapModal();
    if(id==='shopModal') renderShopModal();
    if(id==='questModal') renderQuestModal();
    if(id==='teamModal') renderTeamModal();
    if(id==='hubModal') renderHubModal();
  }
}

export function renderSkillModal(){
  document.getElementById('skillPoints').textContent = state.skillPoints;
  const list = document.getElementById('skillList');
  list.innerHTML = '';
  Object.keys(SKILL_DEFS).forEach(key=>{
    const def = SKILL_DEFS[key];
    const unlocked = state.skills[key];
    const canUnlock = !unlocked && state.skillPoints>=def.cost && state.level>=def.req;
    const row = document.createElement('div');
    row.className='skillRow';
    row.innerHTML = `<div class="info"><b>${def.name}</b> ${unlocked?'✅':''}<br>${def.desc}<br><span style="color:#789">Req Lv.${def.req} · Cost ${def.cost} pt</span></div>`;
    const btn = document.createElement('button');
    btn.textContent = unlocked ? 'Unlocked' : 'Unlock';
    btn.disabled = unlocked || !canUnlock;
    btn.onclick = ()=>{
      state.skills[key]=true;
      state.skillPoints -= def.cost;
      renderSkillModal();
      updateHUD();
      saveGame();
    };
    row.appendChild(btn);
    list.appendChild(row);
  });
}

export function renderInvModal(){
  document.getElementById('eqWeapon').textContent = state.weapon.name + (state.weapon.atk?` (+${state.weapon.atk} ATK)`:'');
  document.getElementById('eqArmor').textContent = state.armor ? `${state.armor.name} (+${state.armor.def} DEF)` : 'None';
  const list = document.getElementById('itemList');
  list.innerHTML = '';
  if(state.inventory.length===0){
    list.innerHTML = '<div class="hint">No items yet — defeat monsters in the Field for drops.</div>';
    return;
  }
  state.inventory.forEach((item,idx)=>{
    const row = document.createElement('div');
    row.className='itemRow';
    const statTxt = item.type==='weapon' ? `+${item.atk} ATK` : `+${item.def} DEF`;
    row.innerHTML = `<div class="info rarity-${item.rarity}"><b>${item.name}</b><br>${statTxt} · ${item.type}</div>`;
    const btn = document.createElement('button');
    btn.textContent = 'Equip';
    btn.onclick = ()=>{
      if(item.type==='weapon') state.weapon = item;
      else state.armor = item;
      state.inventory.splice(idx,1);
      renderInvModal();
      updateHUD();
      saveGame();
    };
    row.appendChild(btn);
    list.appendChild(row);
  });
}

export function renderMapModal(){
  document.getElementById('clearedCount').textContent = state.clearedFloors.size;
  const grid = document.getElementById('mapGrid');
  grid.innerHTML='';
  for(let f=1; f<=MAX_FLOOR; f++){
    const cell = document.createElement('div');
    const unlocked = f <= state.maxUnlocked;
    cell.className = 'floorCell' + (unlocked?' unlocked':'') + (f===state.floor?' current':'');
    cell.textContent = f;
    if(unlocked){
      cell.onclick = ()=>{ goToTown(f); toggleModal('mapModal'); };
    }
    grid.appendChild(cell);
  }
}

export function renderShopModal(){
  document.getElementById('shopGold').textContent = state.gold;
  const list = document.getElementById('shopList');
  list.innerHTML = '';
  const stock = getShopStock();
  stock.forEach(({item, cost})=>{
    const statTxt = item.type==='weapon' ? `+${item.atk} ATK` : `+${item.def} DEF`;
    const row = document.createElement('div');
    row.className='itemRow';
    row.innerHTML = `<div class="info rarity-${item.rarity}"><b>${item.name}</b><br>${statTxt} · ${item.type} · <span style="color:#ffd76a">${cost} G</span></div>`;
    const btn = document.createElement('button');
    btn.textContent = 'Buy';
    btn.disabled = state.gold < cost;
    btn.onclick = ()=>{
      if(state.gold < cost) return;
      state.gold -= cost;
      state.inventory.push(Object.assign({}, item));
      showToast(`Bought ${item.name}`);
      renderShopModal();
      updateHUD();
      saveGame();
    };
    row.appendChild(btn);
    list.appendChild(row);
  });
}

export function renderQuestModal(){
  const body = document.getElementById('questBody');
  const f = state.floor;
  const accepted = state.questAcceptedFloor === f;
  const claimed = state.questClaimedFloors.has(f);
  const bossDown = state.clearedFloors.has(f);
  const rewardGold = 15 + f*3;
  const rewardXp = 10 + f*2;

  if(claimed){
    body.innerHTML = `<div class="skillRow"><div class="info">Quest for Floor ${f} already claimed. Come back after ascending to a new floor for another one.</div></div>`;
    return;
  }
  if(!accepted){
    body.innerHTML = `<div class="skillRow"><div class="info"><b>Defeat the Floor ${f} Boss</b><br>Reward: ${rewardGold} G + ${rewardXp} XP bonus</div></div>`;
    const row = document.createElement('div');
    row.className='skillRow';
    const btn = document.createElement('button');
    btn.textContent = 'Accept Quest';
    btn.onclick = ()=>{ state.questAcceptedFloor = f; renderQuestModal(); };
    row.appendChild(btn);
    body.appendChild(row);
  } else if(!bossDown){
    body.innerHTML = `<div class="skillRow"><div class="info">Quest active — defeat the Floor ${f} Boss in the Field to unlock your reward.</div></div>`;
  } else {
    body.innerHTML = `<div class="skillRow"><div class="info"><b>Quest complete!</b><br>Reward: ${rewardGold} G + ${rewardXp} XP</div></div>`;
    const row = document.createElement('div');
    row.className='skillRow';
    const btn = document.createElement('button');
    btn.textContent = 'Claim Reward';
    btn.onclick = ()=>{
      state.gold += rewardGold;
      gainXP(rewardXp);
      state.questClaimedFloors.add(f);
      showToast(`Quest reward claimed: +${rewardGold} G, +${rewardXp} XP`);
      renderQuestModal();
      updateHUD();
    };
    row.appendChild(btn);
    body.appendChild(row);
  }
}

export function updateHUD(){
  document.getElementById('lvl').textContent = state.level;
  document.getElementById('hpText').textContent = `${Math.max(0,Math.round(state.hp))}/${state.maxHp}`;
  document.getElementById('hpFill').style.width = Math.max(0,(state.hp/state.maxHp*100))+'%';
  document.getElementById('xpText').textContent = `${state.xp}/${state.xpNext}`;
  document.getElementById('xpFill').style.width = (state.xp/state.xpNext*100)+'%';
  document.getElementById('atkVal').textContent = currentAtk();
  document.getElementById('defVal').textContent = currentDef();
  document.getElementById('goldVal').textContent = state.gold + ' G';
  document.getElementById('floorNum').textContent = state.floor;
  document.getElementById('areaTag').textContent = (state.area==='town' ? 'TOWN — ' : 'FIELD — ') + getFloorTheme(state.floor).toUpperCase();

  ['power','dash','heal','storm'].forEach((k,i)=>{
    const slot = document.querySelectorAll('.slot')[i];
    slot.style.opacity = state.skills[k] ? '1' : '0.35';
  });
}

export function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display='block';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>{ t.style.display='none'; }, 2800);
}
