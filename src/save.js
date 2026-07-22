/* ============================================================
   THE RISE OF ILJANOR — save.js
   Auto-split from the original single-file index.html. Behavior is
   unchanged; this is a pure modularization refactor.
   ============================================================ */
import { state } from './player.js';
import { showToast } from './ui.js';

export const GOOGLE_CLIENT_ID = '594292821086-kpuj59a9ushf9aitvh81vdfvesudj8pd.apps.googleusercontent.com'; // <-- paste your Client ID here, e.g. '123abc.apps.googleusercontent.com'


export function decodeJwt(token){
  try{
    const payload = token.split('.')[1];
    const json = decodeURIComponent(atob(payload.replace(/-/g,'+').replace(/_/g,'/')).split('').map(c=>
      '%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(json);
  }catch(err){ return null; }
}

export function initGoogleSignIn(){
  if(!GOOGLE_CLIENT_ID){
    document.getElementById('googleConfigWarning').style.display = 'block';
    return;
  }
  if(!window.google || !window.google.accounts){
    setTimeout(initGoogleSignIn, 300); // GIS script still loading
    return;
  }
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: onGoogleSignIn,
    auto_select: false,
  });
  google.accounts.id.renderButton(document.getElementById('googleSignInBox'), {
    theme:'filled_black', size:'large', text:'signin_with', shape:'pill'
  });
}

export function onGoogleSignIn(response){
  const payload = decodeJwt(response.credential);
  if(!payload){ showStartToast('Sign-in failed — try again.'); return; }
  state.myId = payload.sub;          // unique per Gmail account
  state.myEmail = payload.email;
  state.myName = (payload.name || payload.email || 'Swordsman').slice(0,14);
  state.myPicture = payload.picture;
  state.isGuest = false;

  document.getElementById('gProfilePic').src = payload.picture;
  document.getElementById('gProfileName').textContent = payload.name || payload.email;
  document.getElementById('signedInBox').style.display = 'flex';
  document.getElementById('googleSignInBox').style.display = 'none';

  const loaded = loadSave(state.myId);
  document.getElementById('gSaveStatus').textContent = loaded
    ? `Saved progress loaded — Lv.${state.level}, Floor ${state.floor}`
    : 'Naya account — pehli baar khel rahe ho';

  document.getElementById('startBtn').textContent = 'CONTINUE AS ' + state.myName.toUpperCase();
}

export function showStartToast(msg){
  const w = document.getElementById('googleConfigWarning');
  w.textContent = msg; w.style.color = '#ff8a8a'; w.style.display = 'block';
}

export const SAVE_PREFIX = 'aincrad_save_';

export function saveKeyFor(id){ return SAVE_PREFIX + id; }


export function serializeState(){
  return JSON.stringify({
    level: state.level, xp: state.xp, xpNext: state.xpNext,
    hp: state.hp, maxHp: state.maxHp, atk: state.atk, def: state.def,
    skillPoints: state.skillPoints, skills: state.skills,
    weapon: state.weapon, armor: state.armor, inventory: state.inventory,
    gold: state.gold, floor: state.floor, maxUnlocked: state.maxUnlocked,
    clearedFloors: Array.from(state.clearedFloors),
    questAcceptedFloor: state.questAcceptedFloor,
    questClaimedFloors: Array.from(state.questClaimedFloors),
    myName: state.myName,
  });
}

export function saveGame(showConfirm){
  if(state.isGuest || !state.myId) { if(showConfirm) showToast('Guest mode me progress save nahi hota — Google se sign in karo'); return; }
  try{
    localStorage.setItem(saveKeyFor(state.myId), serializeState());
    if(showConfirm) showToast('✓ Progress saved');
  }catch(err){
    if(showConfirm) showToast('Save fail ho gaya — browser storage full/blocked ho sakta hai');
  }
}

export function loadSave(id){
  try{
    const raw = localStorage.getItem(saveKeyFor(id));
    if(!raw) return false;
    const d = JSON.parse(raw);
    Object.assign(state, {
      level:d.level, xp:d.xp, xpNext:d.xpNext, hp:d.hp, maxHp:d.maxHp, atk:d.atk, def:d.def,
      skillPoints:d.skillPoints, skills:d.skills, weapon:d.weapon, armor:d.armor,
      inventory:d.inventory||[], gold:d.gold, floor:d.floor||1, maxUnlocked:d.maxUnlocked||1,
      questAcceptedFloor:d.questAcceptedFloor,
    });
    state.clearedFloors = new Set(d.clearedFloors||[]);
    state.questClaimedFloors = new Set(d.questClaimedFloors||[]);
    return true;
  }catch(err){ return false; }
}
