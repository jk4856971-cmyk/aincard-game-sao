/* ============================================================
   THE RISE OF ILJANOR — network.js
   Auto-split from the original single-file index.html. Behavior is
   unchanged; this is a pure modularization refactor.
   ============================================================ */
import { damageEnemy, killEnemy } from './combat.js';
import { state } from './player.js';
import { showToast } from './ui.js';
import { camState, enemies, goToField, goToTown, makeCapsuleMesh, player, remoteGroup } from './world.js';

export const team = {
  inTeam: false,
  isHost: false,
  roomCode: null,
  myPeerId: null, // this browser's actual PeerJS id on the TEAM network (independent of Google account id)
  members: {}, // id -> {name, x,z,yaw: camState.yaw, hp,maxHp, level, floor, area, mesh, nameSprite, isHost}
  connections: {}, // host only: id -> DataConnection
  hostConn: null,  // client only: DataConnection to host
};

export const HUB_ID = 'aincrad-sao-town-of-beginnings-hub-v1';

export const hub = {
  connected: false,
  isAnchor: false, // true if this browser is the fixed-ID anchor everyone else connects through
  myPeerId: null, // this browser's actual PeerJS id on the HUB network (independent of Google account id)
  members: {}, // id -> {name, x,z,yaw: camState.yaw, mesh}
  connections: {}, // anchor only: id -> DataConnection
  hostConn: null,  // non-anchor: DataConnection to anchor
};

export let peerObj = null;

export const mediaCalls = {};

export const remoteAudioEls = {};


export function setupVoiceCallHandler(){
  peerObj.on('call', call=>{
    ensureVoiceGraph();
    call.answer(voiceStreamDest.stream);
    call.on('stream', remoteStream=>attachRemoteAudio(call.peer, remoteStream));
    mediaCalls[call.peer] = call;
  });
}

export function createTeam(){
  team.isHost = true;
  team.inTeam = true;
  peerObj = new Peer();
  peerObj.on('open', id=>{
    team.myPeerId = id;
    team.roomCode = id;
    team.members[id] = {name:state.myName, isHost:true, x:player.pos.x, z:player.pos.z, yaw: camState.yaw, hp:state.hp, maxHp:state.maxHp, level:state.level, floor:state.floor, area:state.area};
    updateTeamWidget(); renderTeamModal();
    showToast('Team created — share code: '+id);
  });
  peerObj.on('connection', conn=>{
    conn.on('data', data=>{
      if(data.type==='hello'){
        team.members[conn.peer] = {name:data.name, isHost:false, x:0,z:0,yaw:0,hp:0,maxHp:0,level:1,floor:state.floor,area:state.area};
        team.connections[conn.peer] = conn;
        const rosterList = Object.entries(team.members).map(([mid,m])=>({id:mid,name:m.name,isHost:!!m.isHost}));
        conn.send({type:'roster', members:rosterList, floor:state.floor, area:state.area});
        hostRelay({type:'join', id:conn.peer, name:data.name}, conn.peer);
        spawnRemotePlayer(conn.peer, data.name);
        callPeerForVoice(conn.peer);
        showToast(data.name+' joined the team');
        renderTeamModal(); updateTeamWidget();
      } else {
        applyIncoming(data, conn.peer);
        hostRelay(data, conn.peer);
      }
    });
    conn.on('close', ()=>{
      const nm = team.members[conn.peer] ? team.members[conn.peer].name : 'A player';
      delete team.connections[conn.peer];
      removeRemotePlayer(conn.peer);
      delete team.members[conn.peer];
      hostRelay({type:'leave', id:conn.peer}, conn.peer);
      showToast(nm+' left the team');
      renderTeamModal(); updateTeamWidget();
    });
  });
  setupVoiceCallHandler();
  peerObj.on('error', err=>{ showToast('Network error: '+err.type); });
}

export function joinTeam(code){
  team.isHost = false;
  team.inTeam = true;
  team.roomCode = code;
  peerObj = new Peer();
  peerObj.on('open', id=>{
    team.myPeerId = id;
    const conn = peerObj.connect(code);
    team.hostConn = conn;
    conn.on('open', ()=>{
      conn.send({type:'hello', name:state.myName});
      team.members[id] = {name:state.myName, isHost:false, x:player.pos.x, z:player.pos.z, yaw: camState.yaw, hp:state.hp, maxHp:state.maxHp, level:state.level, floor:state.floor, area:state.area};
      updateTeamWidget(); renderTeamModal();
    });
    conn.on('data', data=>applyIncoming(data, 'host'));
    conn.on('close', ()=>{
      showToast('Team se disconnect ho gaye.');
      resetTeamLocal();
    });
    conn.on('error', ()=>{ showToast('Team se connect nahi ho paya — code check karo.'); resetTeamLocal(); });
  });
  setupVoiceCallHandler();
  peerObj.on('error', err=>{ showToast('Join fail: '+err.type); resetTeamLocal(); });
}

export function hostRelay(msg, excludeId){
  Object.entries(team.connections).forEach(([id,conn])=>{
    if(id!==excludeId && conn.open) conn.send(msg);
  });
}

export function netBroadcast(msg){
  if(!team.inTeam) return;
  if(team.isHost) hostRelay(msg, null);
  else if(team.hostConn && team.hostConn.open) team.hostConn.send(msg);
}

export function applyIncoming(msg, fromId){
  switch(msg.type){
    case 'roster':
      msg.members.forEach(m=>{
        if(m.id===team.myPeerId) return;
        if(!team.members[m.id]){
          team.members[m.id] = {name:m.name, isHost:m.isHost, x:0,z:0,yaw:0,hp:0,maxHp:0,level:1,floor:msg.floor,area:msg.area};
          spawnRemotePlayer(m.id, m.name);
        }
      });
      if(msg.floor && msg.area){
        if(msg.area==='town') goToTown(msg.floor, true); else goToField(msg.floor, true);
      }
      renderTeamModal();
      break;
    case 'join':
      if(!team.members[msg.id]){
        team.members[msg.id] = {name:msg.name, isHost:false, x:0,z:0,yaw:0,hp:0,maxHp:0,level:1,floor:state.floor,area:state.area};
        spawnRemotePlayer(msg.id, msg.name);
      }
      callPeerForVoice(msg.id);
      showToast(msg.name+' joined the team');
      renderTeamModal(); updateTeamWidget();
      break;
    case 'leave': {
      const nm = team.members[msg.id] ? team.members[msg.id].name : 'A player';
      removeRemotePlayer(msg.id);
      delete team.members[msg.id];
      showToast(nm+' left the team');
      renderTeamModal(); updateTeamWidget();
      break;
    }
    case 'pos':
      if(team.members[msg.id]){
        Object.assign(team.members[msg.id], {x:msg.x,z:msg.z,yaw:msg.yaw,hp:msg.hp,maxHp:msg.maxHp,level:msg.level,floor:msg.floor,area:msg.area});
      }
      break;
    case 'floorSync':
      if(msg.area==='town') goToTown(msg.floor, true); else goToField(msg.floor, true);
      break;
    case 'hit': {
      const e = enemies[msg.enemyIdx];
      if(e) damageEnemy(e, msg.dmg);
      break;
    }
    case 'death': {
      const e = enemies[msg.enemyIdx];
      if(e && !e.dead){ e.dead = true; e.hp = 0; killEnemy(e); }
      break;
    }
  }
}

export function resetTeamLocal(){
  Object.keys(team.members).forEach(id=>{ if(id!==team.myPeerId) removeRemotePlayer(id); });
  team.inTeam=false; team.isHost=false; team.roomCode=null;
  team.members={}; team.connections={}; team.hostConn=null;
  Object.values(mediaCalls).forEach(c=>{ try{c.close();}catch(err){} });
  Object.keys(mediaCalls).forEach(k=>delete mediaCalls[k]);
  Object.values(remoteAudioEls).forEach(a=>a.remove());
  Object.keys(remoteAudioEls).forEach(k=>delete remoteAudioEls[k]);
  if(peerObj){ try{peerObj.destroy();}catch(err){} peerObj=null; }
  updateTeamWidget(); renderTeamModal();
}

export function leaveTeam(){
  showToast('Team chhod di.');
  resetTeamLocal();
}

export function spawnRemotePlayer(id, name){
  if(team.members[id] && team.members[id].mesh) return;
  const grp = new THREE.Group();
  const body = makeCapsuleMesh(
    0.45, 1.1,
    new THREE.MeshStandardMaterial({color:0x2ad4ff, emissive:0x2ad4ff, emissiveIntensity:0.35, roughness:0.5})
  );
  body.position.y = 1.0;
  grp.add(body);
  const canvas = document.createElement('canvas');
  canvas.width=256; canvas.height=64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle='rgba(5,10,15,0.75)'; ctx.fillRect(0,0,256,64);
  ctx.fillStyle='#7fe3ff'; ctx.font='bold 30px monospace'; ctx.textAlign='center';
  ctx.fillText(name.slice(0,14), 128, 42);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthTest:false}));
  sprite.scale.set(2.2,0.55,1);
  sprite.position.y = 2.3;
  grp.add(sprite);
  remoteGroup.add(grp);
  if(!team.members[id]) team.members[id] = {name};
  team.members[id].mesh = grp;
}

export function removeRemotePlayer(id){
  if(team.members[id] && team.members[id].mesh){
    remoteGroup.remove(team.members[id].mesh);
  }
  if(remoteAudioEls[id]){ remoteAudioEls[id].remove(); delete remoteAudioEls[id]; }
  if(mediaCalls[id]){ try{mediaCalls[id].close();}catch(err){} delete mediaCalls[id]; }
}

export function updateRemotePlayers(dt){
  Object.entries(team.members).forEach(([id,m])=>{
    if(id===team.myPeerId || !m.mesh) return;
    const same = m.floor===state.floor && m.area===state.area;
    m.mesh.visible = same;
    if(same){
      m.mesh.position.lerp(new THREE.Vector3(m.x||0,0,m.z||0), Math.min(1, dt*10));
      m.mesh.rotation.y = m.yaw||0;
    }
  });
}

export function updateTeamWidget(){
  const ts = document.getElementById('teamStatus');
  if(team.inTeam){
    ts.textContent = (team.isHost?'👑 LEADER':'TEAM') + ' — ' + Object.keys(team.members).length + ' [T]';
  } else {
    ts.textContent = 'SOLO — [T] Team';
  }
  const vs = document.getElementById('voiceStatus');
  vs.textContent = micOn ? ('🎤 Live ('+voicePresetLabel()+')') : '🎤 Mic off';
  vs.style.color = micOn ? '#7fe3ff' : '#567';
}

export function renderTeamModal(){
  const body = document.getElementById('teamBody');
  if(!team.inTeam){
    body.innerHTML = `
      <div class="skillRow"><div class="info">Team banao aur code doston ko bhejo, ya kisi ka code daal ke join karo.</div></div>
      <div class="skillRow"><div class="info">Create a new team (aap Team Leader banoge)</div><button id="btnCreateTeam">Create Team</button></div>
      <div class="skillRow"><input id="joinCodeInput" placeholder="Paste room code" style="flex:1;background:#0a1216;border:1px solid #234;color:#bfe9f5;padding:6px;font-family:inherit;margin-right:8px;"><button id="btnJoinTeam">Join</button></div>
    `;
    document.getElementById('btnCreateTeam').onclick = ()=>{ createTeam(); };
    document.getElementById('btnJoinTeam').onclick = ()=>{
      const code = document.getElementById('joinCodeInput').value.trim();
      if(code) joinTeam(code);
    };
    return;
  }
  let html = `<div class="skillRow"><div class="info">Room Code<br><b style="color:#ffd76a;font-size:14px;">${team.roomCode}</b> — ${team.isHost?'aap Team Leader ho':'team member ho'}</div></div>`;
  html += `<div class="skillRow"><div class="info"><b>Members</b></div></div>`;
  Object.entries(team.members).forEach(([id,m])=>{
    html += `<div class="skillRow"><div class="info">${m.isHost?'👑 ':'⚔️ '}${m.name}${id===team.myPeerId?' (You)':''} — Lv.${m.level||1}</div></div>`;
  });
  html += `<div class="skillRow"><div class="info">Voice Changer Preset</div>
    <select id="voicePresetSelect">
      <option value="normal">Normal</option>
      <option value="deep">Deep (Heathcliff)</option>
      <option value="chipmunk">Chipmunk</option>
      <option value="robot">Robot</option>
      <option value="echo">Echo</option>
    </select></div>`;
  html += `<div class="skillRow"><div class="info">Mic ${micOn?'LIVE hai':'off hai'} — team join karte hi auto-connect hota hai</div><button id="btnMicToggle">${micOn?'Mic Band Karo':'Mic Chalu Karo'}</button></div>`;
  html += `<div class="skillRow"><div class="info"></div><button id="btnLeaveTeam">Leave Team</button></div>`;
  body.innerHTML = html;
  const sel = document.getElementById('voicePresetSelect');
  sel.value = voicePreset;
  sel.onchange = ()=>{ voicePreset = sel.value; if(micOn) buildVoiceChain(); updateTeamWidget(); };
  document.getElementById('btnMicToggle').onclick = ()=>{ toggleMic(); };
  document.getElementById('btnLeaveTeam').onclick = ()=>{ leaveTeam(); };
}

export function voicePresetLabel(){
  return {normal:'Normal',deep:'Deep',chipmunk:'Chipmunk',robot:'Robot',echo:'Echo'}[voicePreset] || 'Normal';
}

export let hubPeer = null;

export const hubMediaCalls = {};

export const hubAudioEls = {};

export const hubChatLines = [];


export function connectGlobalHub(){
  if(hub.connected || hubPeer) return;
  if(typeof Peer === 'undefined'){
    console.warn('PeerJS did not load — Global Hub unavailable this session.');
    return;
  }
  try{
    hubPeer = new Peer(HUB_ID);
  }catch(err){
    console.warn('Global Hub connection failed to start:', err);
    hubPeer = null;
    return;
  }
  hubPeer.on('open', id=>{
    // We successfully claimed the fixed hub address — we're the anchor everyone else connects through.
    hub.isAnchor = true;
    hub.connected = true;
    hub.members[id] = {name:state.myName, x:player.pos.x, z:player.pos.z, yaw: camState.yaw};
    hub.myPeerId = id;
    setupHubAnchorHandlers();
    setupHubVoiceCallHandler();
    updateHubWidget(); renderHubModal();
  });
  hubPeer.on('error', err=>{
    if(err.type === 'unavailable-id'){
      // Someone else is already the anchor — reconnect as a normal client with a random id.
      try{
        hubPeer.destroy();
        hubPeer = new Peer();
      }catch(e){ console.warn('Global Hub fallback connection failed:', e); hubPeer=null; return; }
      hubPeer.on('open', myId=>{
        hub.myPeerId = myId;
        const conn = hubPeer.connect(HUB_ID);
        hub.hostConn = conn;
        conn.on('open', ()=>{
          conn.send({type:'hello', name:state.myName});
          hub.connected = true;
          hub.members[hub.myPeerId] = {name:state.myName, x:player.pos.x, z:player.pos.z, yaw: camState.yaw};
          updateHubWidget(); renderHubModal();
        });
        conn.on('data', data=>applyHubIncoming(data));
        conn.on('close', ()=>{ resetHubLocal(); });
        conn.on('error', ()=>{ showToast('Town Hub se connect nahi ho paya.'); resetHubLocal(); });
      });
      setupHubVoiceCallHandler();
      hubPeer.on('error', e2=>{ /* give up quietly */ });
    }
  });
}

export function setupHubAnchorHandlers(){
  hubPeer.on('connection', conn=>{
    conn.on('data', data=>{
      if(data.type==='hello'){
        hub.members[conn.peer] = {name:data.name, x:0,z:0,yaw:0};
        hub.connections[conn.peer] = conn;
        const roster = Object.entries(hub.members).map(([mid,m])=>({id:mid,name:m.name}));
        conn.send({type:'roster', members:roster});
        hubHostRelay({type:'join', id:conn.peer, name:data.name}, conn.peer);
        spawnHubPlayer(conn.peer, data.name);
        callHubPeerForVoice(conn.peer);
        updateHubWidget(); renderHubModal();
      } else {
        applyHubIncoming(data, conn.peer);
        hubHostRelay(data, conn.peer);
      }
    });
    conn.on('close', ()=>{
      const nm = hub.members[conn.peer] ? hub.members[conn.peer].name : 'Someone';
      delete hub.connections[conn.peer];
      removeHubPlayer(conn.peer);
      delete hub.members[conn.peer];
      hubHostRelay({type:'leave', id:conn.peer}, conn.peer);
      updateHubWidget(); renderHubModal();
    });
  });
}

export function setupHubVoiceCallHandler(){
  hubPeer.on('call', call=>{
    ensureVoiceGraph();
    call.answer(voiceStreamDest.stream);
    call.on('stream', remoteStream=>attachHubAudio(call.peer, remoteStream));
    hubMediaCalls[call.peer] = call;
  });
}

export function hubHostRelay(msg, excludeId){
  Object.entries(hub.connections).forEach(([id,conn])=>{
    if(id!==excludeId && conn.open) conn.send(msg);
  });
}

export function hubBroadcast(msg){
  if(!hub.connected) return;
  if(hub.isAnchor) hubHostRelay(msg, null);
  else if(hub.hostConn && hub.hostConn.open) hub.hostConn.send(msg);
}

export function applyHubIncoming(msg, fromId){
  switch(msg.type){
    case 'roster':
      msg.members.forEach(m=>{
        if(m.id===hub.myPeerId || hub.members[m.id]) return;
        hub.members[m.id] = {name:m.name, x:0,z:0,yaw:0};
        spawnHubPlayer(m.id, m.name);
      });
      renderHubModal();
      break;
    case 'join':
      if(!hub.members[msg.id]){
        hub.members[msg.id] = {name:msg.name, x:0,z:0,yaw:0};
        spawnHubPlayer(msg.id, msg.name);
      }
      callHubPeerForVoice(msg.id);
      updateHubWidget(); renderHubModal();
      break;
    case 'leave':
      removeHubPlayer(msg.id);
      delete hub.members[msg.id];
      updateHubWidget(); renderHubModal();
      break;
    case 'pos':
      if(hub.members[msg.id]) Object.assign(hub.members[msg.id], {x:msg.x,z:msg.z,yaw:msg.yaw});
      break;
    case 'chat':
      addHubChatLine(msg.name, msg.text);
      break;
  }
}

export function resetHubLocal(){
  Object.keys(hub.members).forEach(id=>{ if(id!==hub.myPeerId) removeHubPlayer(id); });
  hub.connected=false; hub.isAnchor=false; hub.members={}; hub.connections={}; hub.hostConn=null;
  Object.values(hubMediaCalls).forEach(c=>{ try{c.close();}catch(err){} });
  Object.keys(hubMediaCalls).forEach(k=>delete hubMediaCalls[k]);
  Object.values(hubAudioEls).forEach(a=>a.remove());
  Object.keys(hubAudioEls).forEach(k=>delete hubAudioEls[k]);
  if(hubPeer){ try{hubPeer.destroy();}catch(err){} hubPeer=null; }
  updateHubWidget(); renderHubModal();
}

export function disconnectGlobalHub(){
  if(!hub.connected && !hubPeer) return;
  resetHubLocal();
}

export function spawnHubPlayer(id, name){
  if(hub.members[id] && hub.members[id].mesh) return;
  const grp = new THREE.Group();
  const body = makeCapsuleMesh(
    0.45, 1.1,
    new THREE.MeshStandardMaterial({color:0xffb84d, emissive:0xffb84d, emissiveIntensity:0.3, roughness:0.5})
  );
  body.position.y = 1.0;
  grp.add(body);
  const canvas = document.createElement('canvas');
  canvas.width=256; canvas.height=64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle='rgba(5,10,15,0.75)'; ctx.fillRect(0,0,256,64);
  ctx.fillStyle='#ffd9a0'; ctx.font='bold 30px monospace'; ctx.textAlign='center';
  ctx.fillText((name||'Player').slice(0,14), 128, 42);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthTest:false}));
  sprite.scale.set(2.2,0.55,1);
  sprite.position.y = 2.3;
  grp.add(sprite);
  remoteGroup.add(grp);
  if(!hub.members[id]) hub.members[id] = {name};
  hub.members[id].mesh = grp;
}

export function removeHubPlayer(id){
  if(hub.members[id] && hub.members[id].mesh) remoteGroup.remove(hub.members[id].mesh);
  if(hubAudioEls[id]){ hubAudioEls[id].remove(); delete hubAudioEls[id]; }
  if(hubMediaCalls[id]){ try{hubMediaCalls[id].close();}catch(err){} delete hubMediaCalls[id]; }
}

export function updateHubPlayers(dt){
  Object.entries(hub.members).forEach(([id,m])=>{
    if(id===hub.myPeerId || !m.mesh) return;
    const visible = state.floor===1 && state.area==='town';
    m.mesh.visible = visible;
    if(visible){
      m.mesh.position.lerp(new THREE.Vector3(m.x||0,0,m.z||0), Math.min(1, dt*10));
      m.mesh.rotation.y = m.yaw||0;
    }
  });
}

export function callHubPeerForVoice(id){
  if(!hubPeer || hubMediaCalls[id]) return;
  ensureVoiceGraph();
  const call = hubPeer.call(id, voiceStreamDest.stream);
  call.on('stream', remoteStream=>attachHubAudio(id, remoteStream));
  hubMediaCalls[id] = call;
}

export function attachHubAudio(id, stream){
  if(hubAudioEls[id]){ hubAudioEls[id].srcObject = stream; return; }
  const audio = document.createElement('audio');
  audio.autoplay = true;
  audio.srcObject = stream;
  audio.style.display = 'none';
  document.body.appendChild(audio);
  hubAudioEls[id] = audio;
}

export function sendHubChat(text){
  if(!text.trim()) return;
  addHubChatLine(state.myName, text);
  hubBroadcast({type:'chat', name:state.myName, text});
}

export function addHubChatLine(name, text){
  hubChatLines.push({name, text});
  if(hubChatLines.length > 60) hubChatLines.shift();
  const log = document.getElementById('hubChatLog');
  if(log){
    const div = document.createElement('div');
    div.style.marginBottom='4px';
    div.innerHTML = `<b style="color:#ffb84d;">${name}:</b> ${text.replace(/</g,'&lt;')}`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }
}

export function updateHubWidget(){
  const w = document.getElementById('hubWidget');
  const s = document.getElementById('hubStatus');
  if(hub.connected){
    w.style.display = 'block';
    s.textContent = '🌐 Town Hub: ' + Object.keys(hub.members).length + ' online';
  } else {
    w.style.display = 'none';
  }
}

export function renderHubModal(){
  const memDiv = document.getElementById('hubMembers');
  if(!memDiv) return;
  if(!hub.connected){
    memDiv.innerHTML = `<div class="skillRow"><div class="info">Town of Beginnings (Floor 1 Town) me jao — automatically yahan sabse connect ho jaaoge, koi team zaroori nahi.</div></div>`;
    return;
  }
  let html = `<div class="skillRow"><div class="info"><b>Online right now</b></div></div>`;
  Object.entries(hub.members).forEach(([id,m])=>{
    html += `<div class="skillRow"><div class="info">⚔️ ${m.name}${id===hub.myPeerId?' (You)':''}</div></div>`;
  });
  memDiv.innerHTML = html;
}

export let voiceCtx=null, voiceStreamDest=null, micStream=null, micOn=false, voicePreset='normal';

export let currentVoiceNodes = [];


export function ensureVoiceGraph(){
  if(voiceCtx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  voiceCtx = new AC();
  voiceStreamDest = voiceCtx.createMediaStreamDestination();
}

export function makePitchShifter(ctx, pitchRatio){
  const bufferSize = 4096;
  const grainSize = 1024;
  const node = ctx.createScriptProcessor(bufferSize,1,1);
  const ring = new Float32Array(bufferSize*4);
  let writeIdx = 0, readIdx = 0;
  node.onaudioprocess = function(ev){
    const input = ev.inputBuffer.getChannelData(0);
    const output = ev.outputBuffer.getChannelData(0);
    for(let i=0;i<input.length;i++){
      ring[writeIdx % ring.length] = input[i];
      writeIdx++;
    }
    for(let i=0;i<output.length;i++){
      const idx = Math.floor(readIdx) % ring.length;
      output[i] = ring[idx] || 0;
      readIdx += pitchRatio;
      if(readIdx > writeIdx - 4 || writeIdx - readIdx > ring.length - 8){
        readIdx = Math.max(0, writeIdx - grainSize);
      }
    }
  };
  return node;
}

export function makeDistortionCurve(amount){
  const k = amount, n = 256, curve = new Float32Array(n);
  for(let i=0;i<n;i++){
    const x = i*2/n - 1;
    curve[i] = (3+k)*x*20*(Math.PI/180) / (Math.PI + k*Math.abs(x));
  }
  return curve;
}

export function disconnectVoiceChain(){
  currentVoiceNodes.forEach(n=>{ try{ n.disconnect(); }catch(err){} });
  currentVoiceNodes = [];
}

export function buildVoiceChain(){
  if(!micStream || !voiceCtx) return;
  disconnectVoiceChain();
  const source = voiceCtx.createMediaStreamSource(micStream);
  currentVoiceNodes.push(source);
  let node = source;

  if(voicePreset==='deep'){
    const shifter = makePitchShifter(voiceCtx, 0.72);
    node.connect(shifter); currentVoiceNodes.push(shifter); node = shifter;
  } else if(voicePreset==='chipmunk'){
    const shifter = makePitchShifter(voiceCtx, 1.5);
    node.connect(shifter); currentVoiceNodes.push(shifter); node = shifter;
  } else if(voicePreset==='robot'){
    const shifter = makePitchShifter(voiceCtx, 0.88);
    node.connect(shifter); currentVoiceNodes.push(shifter);
    const shaper = voiceCtx.createWaveShaper();
    shaper.curve = makeDistortionCurve(18);
    shifter.connect(shaper); currentVoiceNodes.push(shaper);
    node = shaper;
  } else if(voicePreset==='echo'){
    const delay = voiceCtx.createDelay(); delay.delayTime.value = 0.18;
    const fb = voiceCtx.createGain(); fb.gain.value = 0.35;
    node.connect(delay); delay.connect(fb); fb.connect(delay);
    currentVoiceNodes.push(delay, fb);
    const mix = voiceCtx.createGain();
    node.connect(mix); delay.connect(mix);
    currentVoiceNodes.push(mix);
    node = mix;
  }
  const outGain = voiceCtx.createGain(); outGain.gain.value = 1.0;
  node.connect(outGain);
  currentVoiceNodes.push(outGain);
  outGain.connect(voiceStreamDest);
}

export async function toggleMic(){
  ensureVoiceGraph();
  if(micOn){
    micOn = false;
    disconnectVoiceChain();
    if(micStream){ micStream.getTracks().forEach(t=>t.stop()); micStream=null; }
    updateTeamWidget(); renderTeamModal();
    return;
  }
  try{
    micStream = await navigator.mediaDevices.getUserMedia({audio:true});
  }catch(err){
    showToast('Mic access nahi mila — browser permission check karo');
    return;
  }
  micOn = true;
  buildVoiceChain();
  updateTeamWidget(); renderTeamModal();
  Object.keys(team.members).forEach(id=>{ if(id!==team.myPeerId) callPeerForVoice(id); });
  Object.keys(hub.members).forEach(id=>{ if(id!==hub.myPeerId) callHubPeerForVoice(id); });
}

export function callPeerForVoice(id){
  if(!peerObj || mediaCalls[id]) return;
  ensureVoiceGraph();
  const call = peerObj.call(id, voiceStreamDest.stream);
  call.on('stream', remoteStream=>attachRemoteAudio(id, remoteStream));
  mediaCalls[id] = call;
}

export function attachRemoteAudio(id, stream){
  if(remoteAudioEls[id]){ remoteAudioEls[id].srcObject = stream; return; }
  const audio = document.createElement('audio');
  audio.autoplay = true;
  audio.srcObject = stream;
  audio.style.display = 'none';
  document.body.appendChild(audio);
  remoteAudioEls[id] = audio;
}
