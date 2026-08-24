/* FORTUNE NOIR v1.10.0 - login gate / admin-only diagnostics
 * Upload this file beside index.html, app.js and style.css.
 * Existing game logic is intentionally untouched.
 */
(function(){
  'use strict';

  const API='https://fortune-noir-admin-api.alunia1225.workers.dev';
  const ADMIN_ID='391x';
  const K={player:'FN_PLAYER_TOKEN',admin:'FN_ADMIN_TOKEN',pid:'FN_SERVER_PLAYER_ID',role:'FN_ROLE',name:'FN_LOGIN_NAME'};
  let role=localStorage.getItem(K.role)||'';
  let busy=false;

  function hideDebug(){
    ['debugToggle','debugEmergency','debugEmergencyPanel','debugPanel'].forEach(id=>{
      const e=document.getElementById(id); if(e)e.style.display='none';
    });
    document.documentElement.classList.add('fn-nonadmin');
  }
  function showDebug(){
    document.documentElement.classList.remove('fn-nonadmin');
    ['debugToggle','debugEmergency'].forEach(id=>{
      const e=document.getElementById(id); if(e)e.style.display='';
    });
  }
  function setRole(r,name){
    role=r; localStorage.setItem(K.role,r); if(name)localStorage.setItem(K.name,name);
    if(r==='admin')showDebug(); else hideDebug();
  }

  async function api(path,options,token){
    const headers=Object.assign({'content-type':'application/json'},(options&&options.headers)||{});
    if(token)headers.Authorization='Bearer '+token;
    const r=await fetch(API+path,Object.assign({},options||{},{headers,cache:'no-store'}));
    let d={}; try{d=await r.json()}catch(_){ }
    if(!r.ok)throw new Error(d.error||'API_ERROR');
    return d;
  }

  function ensureUI(){
    if(document.getElementById('fnLoginOverlay'))return;
    const o=document.createElement('div');
    o.id='fnLoginOverlay';
    o.innerHTML=`
      <div class="fn-login-card">
        <div class="fn-login-kicker">FORTUNE NOIR / SECURE ACCESS</div>
        <h1>LOGIN</h1>
        <p class="fn-login-sub">Enter your player name to enter the casino.</p>
        <label>PLAYER NAME</label>
        <input id="fnLoginName" maxlength="32" autocomplete="username" placeholder="PLAYER">
        <label>PASSWORD <small>(391x ADMIN ONLY)</small></label>
        <input id="fnLoginPassword" type="password" autocomplete="current-password" placeholder="••••••••">
        <button id="fnLoginButton" type="button">ENTER FORTUNE NOIR</button>
        <div id="fnLoginStatus">SERVER AUTHENTICATION</div>
      </div>`;
    document.body.appendChild(o);
    const n=o.querySelector('#fnLoginName');
    const p=o.querySelector('#fnLoginPassword');
    const b=o.querySelector('#fnLoginButton');
    n.value=localStorage.getItem(K.name)||'';
    b.onclick=()=>login(n.value.trim(),p.value);
    [n,p].forEach(x=>x.addEventListener('keydown',e=>{if(e.key==='Enter')login(n.value.trim(),p.value)}));
  }

  async function login(name,password){
    if(busy)return;
    name=(name||'').trim();
    const status=document.getElementById('fnLoginStatus');
    const button=document.getElementById('fnLoginButton');
    if(!name){status.textContent='PLAYER NAME REQUIRED';return;}
    busy=true;button.disabled=true;status.textContent='AUTHENTICATING...';
    try{
      if(name.toLowerCase()===ADMIN_ID.toLowerCase()){
        if(!password){status.textContent='ADMIN PASSWORD REQUIRED';throw new Error('ADMIN_PASSWORD_REQUIRED');}
        const d=await api('/auth/login',{method:'POST',body:JSON.stringify({username:ADMIN_ID,password})});
        localStorage.setItem(K.admin,d.token);
        localStorage.removeItem(K.player);
        setRole('admin',ADMIN_ID);
        window.__FN_PROFILE_NAME=ADMIN_ID;
        status.textContent='ADMIN AUTHENTICATED';
      }else{
        let pid=localStorage.getItem(K.pid)||'';
        if(!/^[a-f0-9-]{20,80}$/i.test(pid)){
          pid=crypto.randomUUID();localStorage.setItem(K.pid,pid);
        }
        const d=await api('/player/session',{method:'POST',body:JSON.stringify({playerId:pid,name})});
        localStorage.setItem(K.player,d.token);
        setRole('player',name);
        window.__FN_PROFILE_NAME=name;
        status.textContent='PLAYER AUTHENTICATED';
      }
      document.getElementById('fnLoginOverlay').classList.add('hidden');
      if(typeof window.__FN_AUTH_COMPLETE==='function')window.__FN_AUTH_COMPLETE();
    }catch(e){
      status.textContent=e.message==='INVALID_CREDENTIALS'?'INVALID ADMIN PASSWORD':'LOGIN FAILED';
      if(name.toLowerCase()===ADMIN_ID.toLowerCase()){localStorage.removeItem(K.admin);setRole('player',name)}
    }finally{busy=false;button.disabled=false;}
  }

  async function restore(){
    ensureUI();
    const at=localStorage.getItem(K.admin);
    if(at){
      try{const d=await api('/auth/me',{},at);if(d.role==='admin'){setRole('admin',ADMIN_ID);window.__FN_PROFILE_NAME=ADMIN_ID;document.getElementById('fnLoginOverlay').classList.add('hidden');return true;}}catch(_){}
      localStorage.removeItem(K.admin);
    }
    const pt=localStorage.getItem(K.player);
    if(pt){
      try{const d=await api('/balance',{},pt);if(d&&d.playerId){setRole('player',localStorage.getItem(K.name)||d.name||'PLAYER');window.__FN_PROFILE_NAME=localStorage.getItem(K.name)||d.name||'PLAYER';document.getElementById('fnLoginOverlay').classList.add('hidden');return true;}}catch(_){}
      localStorage.removeItem(K.player);
    }
    setRole('player','');
    return false;
  }

  // Make the existing debug functions admin-only. This is in addition to hiding the UI.
  const originalToggle=window.toggleDebug;
  window.toggleDebug=function(){if(role!=='admin')return;return originalToggle&&originalToggle();};
  const originalCopy=window.copyDebug;
  window.copyDebug=function(){if(role!=='admin')return;return originalCopy&&originalCopy();};
  const originalClear=window.clearDebug;
  window.clearDebug=function(){if(role!=='admin')return;return originalClear&&originalClear();};

  function installStartGate(){
    const button=document.getElementById('tapStart');
    if(!button||button.__fnAuthGate)return;
    button.__fnAuthGate=true;
    button.addEventListener('click',async function(e){
      e.preventDefault();e.stopImmediatePropagation();
      if(role==='admin'||role==='player'){
        if(typeof window.GB_START_APP==='function')window.GB_START_APP();
        return;
      }
      document.getElementById('fnLoginOverlay').classList.remove('hidden');
    },true);
    button.addEventListener('touchend',async function(e){e.preventDefault();e.stopImmediatePropagation();},true);
  }

  document.addEventListener('DOMContentLoaded',async function(){
    ensureUI();
    hideDebug();
    await restore();
    installStartGate();
    // Existing DOM listeners may have been installed already; use a capture gate on the button.
    window.__FN_AUTH_COMPLETE=function(){
      installStartGate();
      if(typeof window.GB_START_APP==='function')window.GB_START_APP();
    };
  });
})();
