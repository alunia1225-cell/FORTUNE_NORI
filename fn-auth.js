/* FORTUNE NOIR unified authentication gate v1.25.0 */
(function(){
  'use strict';
  const API='https://fortune-noir-admin-api.alunia1225.workers.dev';
  const ADMIN_ID='391x';
  const K={admin:'FN_ADMIN_TOKEN',player:'FN_PLAYER_TOKEN',pid:'FN_SERVER_PLAYER_ID',role:'FN_ROLE',name:'FN_LOGIN_NAME'};
  window.FN_ADMIN_API_URL=API; window.FN_GAME_API_URL=API;
  window.__FN_AUTH_ROLE='';
  window.__FN_AUTHENTICATED=false;
  window.FN_ADMIN_TOKEN=localStorage.getItem(K.admin)||'';
  const $=id=>document.getElementById(id);
  const validPid=id=>/^[a-f0-9-]{20,80}$/i.test(String(id||''));

  function setRole(role,name){
    window.__FN_AUTH_ROLE=role||'';
    window.__FN_AUTHENTICATED=!!role;
    if(role) localStorage.setItem(K.role,role); else localStorage.removeItem(K.role);
    if(name) localStorage.setItem(K.name,name); else localStorage.removeItem(K.name);
    if(role==='admin'){ localStorage.removeItem(K.player); localStorage.setItem(K.admin,window.FN_ADMIN_TOKEN||''); syncProfile(ADMIN_ID); }
    else if(role==='player'){ localStorage.removeItem(K.admin); syncProfile(name||'PLAYER'); }
    enforceDebug();
    window.dispatchEvent(new CustomEvent('fn-auth-changed',{detail:{role:window.__FN_AUTH_ROLE}}));
  }

  function syncProfile(name){
    try{
      const key='gb_profile_v2';
      let p={name:'PLAYER',avatar:'FN',games:0,wins:0};
      try{p=JSON.parse(localStorage.getItem(key)||'null')||p}catch(_){ }
      p.name=String(name||'PLAYER').trim()||'PLAYER';
      p.icon=p.icon||'♠';p.frame=p.frame||'classic';
      localStorage.setItem(key,JSON.stringify(p));
      const n=$('playerName'),a=$('avatarText'),m=$('profileMeta');
      if(n)n.textContent=p.name; if(a)a.textContent=p.icon||'♠'; if(m)m.textContent=p.name+' • LV.'+(Math.floor((p.games||0)/10)+1);
    }catch(_){ }
  }

  function enforceDebug(){
    const admin=window.__FN_AUTH_ROLE==='admin';
    document.documentElement.classList.toggle('fn-nonadmin',!admin);
    ['debugToggle','debugEmergency','debugEmergencyPanel','debugPanel','lobbyDebugBtn'].forEach(id=>{
      const e=$(id); if(e)e.style.setProperty('display',admin?'':'none','important');
    });
    // DEBUG is accessed from the ADMIN CENTER / lobby SYSTEM button.
    // Do not create a fixed ADMIN DEBUG overlay because it can sit over the
    // mobile ADMIN CONTROL button and steal pointer events.
    const b=$('fnAuthAdminDebug');
    if(b) b.remove();
  }
  window.FN_ENFORCE_DEBUG_ACCESS=enforceDebug;

  async function api(path,opts={},token){
    const o=Object.assign({},opts,{cache:'no-store',credentials:'omit'});
    const headers=Object.assign({},o.headers||{});
    if(o.body && !headers['Content-Type'] && !headers['content-type']) headers['Content-Type']='application/json';
    if(token) headers.Authorization='Bearer '+token;
    o.headers=headers;
    const r=await fetch(API+path,o);
    let d={}; try{d=await r.json()}catch(_){ }
    if(!r.ok){ const e=new Error(d.error||('HTTP_'+r.status)); e.status=r.status; e.data=d; throw e; }
    return d;
  }

  function ensureUI(){
    if($('fnLoginOverlay')) return;
    const o=document.createElement('div'); o.id='fnLoginOverlay';
    o.innerHTML='<div class="fn-login-card">'
      +'<div class="fn-login-kicker">FORTUNE NOIR / SECURE ACCESS</div>'
      +'<h1>ENTER FORTUNE NOIR</h1><p class="fn-login-sub">Player names are saved on the server.</p>'
      +'<label>PLAYER NAME</label><input id="fnLoginName" maxlength="16" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="PLAYER">'
      +'<div id="fnAdminPasswordWrap" class="fn-admin-password-wrap" hidden><label>ADMIN PASSWORD</label><div class="fn-password-row"><input id="fnLoginPassword" type="password" inputmode="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="••••••••"><button id="fnShowPassword" type="button">SHOW</button></div></div>'
      +'<button id="fnLoginButton" type="button">ENTER</button><div id="fnLoginStatus">NAME REGISTRATION READY</div></div>';
    document.body.appendChild(o);
    const n=$('fnLoginName'),p=$('fnLoginPassword'),b=$('fnLoginButton'),sp=$('fnShowPassword'),wrap=$('fnAdminPasswordWrap');
    const syncAdminField=()=>{const isAdmin=n.value.trim().toLowerCase()===ADMIN_ID.toLowerCase();wrap.hidden=!isAdmin;if(!isAdmin){p.value='';p.type='password';if(sp)sp.textContent='SHOW';} b.textContent=isAdmin?'VERIFY ADMIN':'ENTER';};
    n.addEventListener('input',()=>{n.classList.remove('fn-auth-invalid');syncAdminField()}); n.addEventListener('change',syncAdminField); syncAdminField();
    sp?.addEventListener('click',()=>{p.type=p.type==='password'?'text':'password';sp.textContent=p.type==='password'?'SHOW':'HIDE';});
    b.addEventListener('click',()=>login(n.value,p.value));
    p.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();login(n.value,p.value)}});
    n.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();p.focus()}});
  }
  function hideLogin(){ $('fnLoginOverlay')?.classList.add('hidden'); }
  function showLogin(){ ensureUI(); $('fnLoginOverlay')?.classList.remove('hidden'); enforceDebug(); setTimeout(()=>$('fnLoginName')?.focus(),0); }

  async function login(rawName,rawPass){
    const name=String(rawName||'').trim();
    const pass=String(rawPass==null?'':rawPass); // NEVER trim/normalize password
    const status=$('fnLoginStatus'),button=$('fnLoginButton'),nameInput=$('fnLoginName');
    if(!name){status.textContent='PLAYER NAME REQUIRED';nameInput?.classList.add('fn-auth-invalid');return false;}
    nameInput?.classList.remove('fn-auth-invalid');
    if(name.toLowerCase()===ADMIN_ID && pass.length===0){status.textContent='ENTER ADMIN PASSWORD';return false;}
    button.disabled=true; status.textContent='AUTHENTICATING...';
    try{
      if(name.toLowerCase()===ADMIN_ID.toLowerCase()){
        const passwordB64=btoa(unescape(encodeURIComponent(pass))); const d=await api('/auth/login',{method:'POST',body:JSON.stringify({username:ADMIN_ID,password:pass,password_b64:passwordB64})});
        if(!d.token || d.role!=='admin') throw new Error('INVALID_ADMIN_RESPONSE');
        window.FN_ADMIN_TOKEN=d.token; localStorage.setItem(K.admin,d.token); localStorage.removeItem(K.player); localStorage.setItem(K.role,'admin'); localStorage.setItem(K.name,ADMIN_ID);
        setRole('admin',ADMIN_ID); hideLogin(); status.textContent='ADMIN AUTHENTICATED'; return true;
      }
      const d=await api('/player/session',{method:'POST',body:JSON.stringify({name})});
      if(!d.token) throw new Error('INVALID_PLAYER_RESPONSE');
      localStorage.setItem(K.player,d.token); localStorage.removeItem(K.admin); localStorage.setItem(K.role,'player'); localStorage.setItem(K.name,d.name||name); localStorage.setItem(K.pid,String(d.playerId||''));
      setRole('player',name); hideLogin(); status.textContent='PLAYER AUTHENTICATED'; return true;
    }catch(e){
      if(name.toLowerCase()!==ADMIN_ID.toLowerCase() && (String(e.message||'').toUpperCase()==='PLAYER_NAME_ALREADY_USED' || String(e.message||'').toUpperCase()==='INVALID_PLAYER_NAME')){
        status.textContent='このプレイヤー名は既に使用されています';
        nameInput?.classList.add('fn-auth-invalid');
        nameInput?.focus();
      }else if(name.toLowerCase()===ADMIN_ID.toLowerCase()){
        status.textContent='LOGIN FAILED ['+(e.status||'NETWORK')+'] '+(e.message||'UNKNOWN_ERROR')+' — RAW PASSWORD LENGTH '+pass.length;
      }else if(String(e.message||'').toUpperCase()==='RESERVED_PLAYER_NAME'){
        status.textContent='このプレイヤー名は使用できません';
        nameInput?.classList.add('fn-auth-invalid');
      }else{
        status.textContent='LOGIN FAILED ['+(e.status||'NETWORK')+'] '+(e.message||'UNKNOWN_ERROR');
        nameInput?.classList.remove('fn-auth-invalid');
      }
      if(name.toLowerCase()===ADMIN_ID.toLowerCase()){window.FN_ADMIN_TOKEN='';localStorage.removeItem(K.admin);localStorage.removeItem(K.role);window.__FN_AUTH_ROLE='';window.__FN_AUTHENTICATED=false;enforceDebug();}
      return false;
    }finally{button.disabled=false;}
  }

  async function restore(){
    ensureUI(); enforceDebug();
    const at=localStorage.getItem(K.admin);
    if(at){
      try{const d=await api('/auth/me',{},at); if(d.role==='admin'){window.FN_ADMIN_TOKEN=at;setRole('admin',ADMIN_ID);hideLogin();return true;}}catch(_){ }
      localStorage.removeItem(K.admin); window.FN_ADMIN_TOKEN='';
    }
    const pt=localStorage.getItem(K.player);
    if(pt){
      try{const d=await api('/auth/me',{},pt); if(d.role==='player'){setRole('player',localStorage.getItem(K.name)||'PLAYER');hideLogin();return true;}}catch(_){ }
      localStorage.removeItem(K.player);
    }
    setRole('',''); showLogin(); return false;
  }

  function gateTap(){
    const b=$('tapStart'); if(!b||b.__fnAuthGate)return; b.__fnAuthGate=true;
    b.addEventListener('click',e=>{ if(window.__FN_AUTHENTICATED)return; e.preventDefault(); e.stopImmediatePropagation(); showLogin(); },true);
    b.addEventListener('touchend',e=>{ if(window.__FN_AUTHENTICATED)return; e.preventDefault(); e.stopImmediatePropagation(); showLogin(); },true);
  }
  async function refreshPlayerSession(name){
    const clean=String(name||'').trim();
    if(!clean || clean.toLowerCase()===ADMIN_ID.toLowerCase())throw new Error('INVALID_PLAYER_SESSION');
    const d=await api('/player/session',{method:'POST',body:JSON.stringify({name:clean})});
    if(!d.token)throw new Error('INVALID_PLAYER_RESPONSE');
    localStorage.setItem(K.player,d.token);
    localStorage.setItem(K.pid,String(d.playerId||''));
    localStorage.setItem(K.name,d.name||clean);
    localStorage.setItem(K.role,'player');
    window.__FN_AUTH_ROLE='player'; window.__FN_AUTHENTICATED=true;
    return d;
  }
  window.FN_REFRESH_PLAYER_SESSION=refreshPlayerSession;
  window.FN_API_REQUEST=api; window.FN_AUTH_LOGIN=login; window.FN_AUTH_RESTORE=restore; window.FN_AUTH_LOGOUT=async()=>{const pt=localStorage.getItem(K.player)||'';try{if(pt)await api('/auth/logout',{method:'POST'},pt)}catch(_){} [K.player,K.admin,K.role,K.name,K.pid].forEach(k=>localStorage.removeItem(k));window.FN_ADMIN_TOKEN='';window.__FN_AUTH_ROLE='';window.__FN_AUTHENTICATED=false;enforceDebug();showLogin();}; window.FN_AUTH_ROLE=()=>window.__FN_AUTH_ROLE; window.FN_AUTHENTICATED=()=>window.__FN_AUTHENTICATED===true;

  document.addEventListener('DOMContentLoaded',async()=>{
    ensureUI(); gateTap();
    await restore(); enforceDebug();
  });
})();
