/* ============================================================
   AINCRAD — game.js
   Auto-split from the original single-file index.html. Behavior is
   unchanged; this is a pure modularization refactor.
   ============================================================ */
import { combatTimers, updatePopups } from './combat.js';
import { updateEnemies } from './monsters.js';
import { hub, hubBroadcast, netBroadcast, sendHubChat, team, updateHubPlayers, updateRemotePlayers } from './network.js';
import { state } from './player.js';
import { initGoogleSignIn, saveGame } from './save.js';
import { toggleModal } from './ui.js';
import { camState, camera, clock, enemies, init3D, isTouchDevice, player, renderer, scene, updateInteractPrompt, updateMovement, updateProps } from './world.js';

let posBroadcastTimer = 0;

let hubPosBroadcastTimer = 0;

let autoSaveTicker = 0;

export function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.getElapsedTime();

  updateMovement(dt);
  updateEnemies(dt);
  updateProps(t);
  updatePopups(dt);
  updateInteractPrompt();
  updateRemotePlayers(dt);
  updateHubPlayers(dt);

  autoSaveTicker += dt;
  if(autoSaveTicker > 20){
    autoSaveTicker = 0;
    saveGame();
  }

  if(team.inTeam){
    posBroadcastTimer += dt;
    if(posBroadcastTimer > 0.12){
      posBroadcastTimer = 0;
      netBroadcast({type:'pos', id:team.myPeerId, x:player.pos.x, z:player.pos.z, yaw: camState.yaw, hp:state.hp, maxHp:state.maxHp, level:state.level, floor:state.floor, area:state.area});
    }
  }
  if(hub.connected){
    hubPosBroadcastTimer += dt;
    if(hubPosBroadcastTimer > 0.15){
      hubPosBroadcastTimer = 0;
      hubBroadcast({type:'pos', id:hub.myPeerId, x:player.pos.x, z:player.pos.z, yaw: camState.yaw});
    }
  }

  if(combatTimers.attackCooldown>0) combatTimers.attackCooldown -= dt;
  Object.keys(state.cooldowns).forEach(k=>{ if(state.cooldowns[k]>0) state.cooldowns[k]-=dt; });

  renderer.render(scene, camera);
}

/* ============================= MULTIPLAYER NETWORKING (PeerJS, star topology) ============================= */

document.getElementById('hubWidget').addEventListener('click', ()=>toggleModal('hubModal'));
document.getElementById('manualSaveBtn').addEventListener('click', e=>{
  e.stopPropagation();
  saveGame(true);
});

/* ============================= VOICE CHANGER (Web Audio) ============================= */

document.getElementById('teamWidget').addEventListener('click', ()=>toggleModal('teamModal'));

/* ============================= START ============================= */
document.getElementById('btnHubSend').addEventListener('click', ()=>{
  const inp = document.getElementById('hubChatInput');
  sendHubChat(inp.value);
  inp.value = '';
});
document.getElementById('hubChatInput').addEventListener('keydown', e=>{
  e.stopPropagation();
  if(e.key === 'Enter'){
    sendHubChat(e.target.value);
    e.target.value = '';
  }
});

/* ============================= GOOGLE SIGN-IN & SAVE SYSTEM =============================
   Set your own OAuth Client ID below (console.cloud.google.com/apis/credentials).
   Must be served over http/https (not file://) with that origin added to
   "Authorized JavaScript origins" for sign-in to work. Leave blank to run guest-only. */

document.getElementById('signOutBtn').addEventListener('click', ()=>{
  if(window.google && google.accounts) google.accounts.id.disableAutoSelect();
  state.myId = null; state.myEmail = null; state.myPicture = null; state.isGuest = true;
  document.getElementById('signedInBox').style.display = 'none';
  document.getElementById('googleSignInBox').style.display = 'block';
  document.getElementById('startBtn').textContent = 'ENTER AS GUEST';
});

window.addEventListener('beforeunload', saveGame);
// beforeunload is unreliable on mobile browsers (often never fires when the user
// hits the system back button or closes the app) — these two events are the
// mobile-safe way to catch "the player is leaving" and force a save.
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState === 'hidden') saveGame(); });
window.addEventListener('pagehide', saveGame);

document.getElementById('startBtn').addEventListener('click', ()=>{
  if(state.isGuest){
    const nm = document.getElementById('nameInput').value.trim();
    state.myName = nm ? nm.slice(0,14) : 'Guest'+Math.floor(Math.random()*900+100);
  }
  document.getElementById('startScreen').style.display='none';
  if(isTouchDevice){
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
    Promise.resolve(req ? req.call(el) : null).catch(()=>{}).finally(()=>{
      if(screen.orientation && screen.orientation.lock){
        screen.orientation.lock('landscape').catch(()=>{ /* device/browser doesn't allow it — user can rotate manually */ });
      }
    });
  }
  init3D();
});

initGoogleSignIn();

if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('./sw.js').catch(()=>{ /* not served over http(s) — skip silently */ });
  });
}

/* ============================= BUG REPORT TOOL ============================= */
// Works even if the game itself failed to load/crashed — that's the whole point of it,
// so every game-state read below is wrapped defensively.

function generateBugReport(){
  const desc = document.getElementById('bugDescInput').value.trim() || '(no description given)';
  const lines = [];
  lines.push('=== AINCRAD BUG REPORT ===');
  lines.push('Time: ' + new Date().toString());
  lines.push('Description: ' + desc);
  lines.push('');
  lines.push('--- Device / Browser ---');
  lines.push('User agent: ' + navigator.userAgent);
  lines.push('Screen: ' + window.screen.width + 'x' + window.screen.height + ' | Viewport: ' + window.innerWidth + 'x' + window.innerHeight);
  try{ lines.push('Touch device: ' + isTouchDevice); }catch(e){ lines.push('Touch device: unknown'); }
  lines.push('URL: ' + location.href);
  lines.push('');
  lines.push('--- Game State ---');
  try{
    lines.push('Floor: ' + state.floor + ' | Area: ' + state.area);
    lines.push('Level: ' + state.level + ' | HP: ' + Math.round(state.hp) + '/' + state.maxHp + ' | Gold: ' + state.gold);
    lines.push('Guest mode: ' + state.isGuest);
  }catch(e){ lines.push('(game state unavailable — game may have crashed before starting)'); }
  try{ lines.push('In team: ' + team.inTeam + (team.inTeam ? (' (host: ' + team.isHost + ')') : '')); }catch(e){}
  try{ lines.push('Town Hub connected: ' + hub.connected); }catch(e){}
  try{ lines.push('Enemies currently loaded: ' + enemies.length); }catch(e){}
  try{ lines.push('Renderer initialized: ' + (typeof renderer !== 'undefined' && !!renderer)); }catch(e){ lines.push('Renderer initialized: false'); }
  lines.push('');
  const errCount = (window.__bugLog && window.__bugLog.length) || 0;
  lines.push('--- Captured JS Errors (' + errCount + ') ---');
  if(errCount){
    window.__bugLog.forEach(l=>lines.push(l));
  } else {
    lines.push('(none captured — if the problem is visual/behavioral rather than a crash, describe it above)');
  }
  lines.push('=== END REPORT ===');
  return lines.join('\n');
}

document.getElementById('bugFab').addEventListener('click', ()=>{
  document.getElementById('bugModal').style.display = 'block';
});
document.getElementById('bugGenerateBtn').addEventListener('click', ()=>{
  const report = generateBugReport();
  document.getElementById('bugReportOutput').value = report;
  document.getElementById('bugReportOutputWrap').style.display = 'block';
});
document.getElementById('bugCopyBtn').addEventListener('click', async ()=>{
  const text = document.getElementById('bugReportOutput').value;
  const statusEl = document.getElementById('bugCopyStatus');
  try{
    await navigator.clipboard.writeText(text);
    statusEl.textContent = '✓ Copied! Ab Claude chat me paste kar do.';
  }catch(err){
    const ta = document.getElementById('bugReportOutput');
    ta.focus(); ta.select();
    try{
      document.execCommand('copy');
      statusEl.textContent = '✓ Copied! Ab Claude chat me paste kar do.';
    }catch(err2){
      statusEl.textContent = 'Auto-copy nahi hua — text select karke manually copy karo.';
    }
  }
  setTimeout(()=>{ statusEl.textContent=''; }, 4000);
});
