/* FORTUNE NOIR AUTH v3.0.0
 * Built against the supplied app.js v1.10.0.
 * Single auth gate. No PROFILE dependency. No duplicate tap handler.
 */
(function(){
  'use strict';
  const API='https://fortune-noir-admin-api.alunia1225.workers.dev';
  // Keep the existing app.js API client on the exact same Worker endpoint.
  window.FN_ADMIN_API_URL=API;
  const ADMIN_ID='391x';
  const K={admin:'FN_ADMIN_TOKEN',player:'FN_PLAYER_TOKEN',pid:'FN_SERVER_PLAYER_ID',role:'FN_ROLE',name:'FN_LOGIN_NAME'};
  let role='';
  let busy=false;

  function setRole(next,name){
    role=next||'';
    if(role) localStorage.setItem(K.role,role); else localStorage.removeItem(K.role);
    if(name) localStorage.setItem(K.name,name); else localStorage.removeItem(K.name);
    if(role==='admin'){
      localStorage.removeItem(K.player);
      syncProfile(ADMIN_ID);
      showDebug();
      window.__FN_PROFILE_NAME=ADMIN_ID;
    }else if(role==='player'){
      syncProfile(name||'PLAYER');
      hideDebug();
      window.__FN_PROFILE_NAME=name||'PLAYER';
    }else{
      hideDebug();
    }
  }

  function syncProfile(name){
    try{
      const key='gb_profile_v2';
      let p={name:'PLAYER',avatar:'FN',games:0,wins:0};
      try{p=JSON.parse(localStorage.getItem(key)||'null')||p}catch(_){ }
      p.name=String(name||'PLAYER').trim()||'PLAYER';
      p.avatar=(p.name===ADMIN_ID?'391':'FN');
      localStorage.setItem(key,JSON.stringify(p));
      const n=document.getElementById('playerName'); if(n)n.textContent=p.name;
      const a=document.getElementById('avatarText'); if(a)a.textContent=p.avatar;
      const m=document.getElementById('profileMeta'); if(m)m.textContent=p.name+' • LV.'+(Math.floor((p.games||0)/10)+1);
    }catch(_){ }
  }

  function hideDebug(){
    document.documentElement.classList.add('fn-nonadmin');
    ['debugToggle','debugEmergency','debugEmergencyPanel','debugPanel','lobbyDebugBtn'].forEach(id=>{
      const e=document.getElementById(id); if(e)e.style.display='none';
    });
  }
  function showDebug(){
    document.documentElement.classList.remove('fn-nonadmin');
    ['debugToggle','debugEmergency','lobbyDebugBtn'].forEach(id=>{
      const e=document.getElementById(id); if(e)e.style.display='';
    });
    let b=document.getElementById('fnAuthAdminDebug');
    if(!b){
      b=document.createElement('button'); b.id='fnAuthAdminDebug'; b.type='button'; b.textContent='ADMIN DEBUG';
      b.onclick=function(){ if(role==='admin' && typeof window.toggleDebug==='function') window.toggleDebug(); };
      document.body.appendChild(b);
    }
    b.style.display='block';
  }

  function api(path,options,token){
    const opts=Object.assign({},options||{});
    const headers=Object.assign({'content-type':'application/json'},opts.headers||{});
    if(token) headers.Authorization='Bearer '+token;
    opts.headers=headers; opts.cache='no-store'; opts.credentials='omit';
    return fetch(API+path,opts).then(async r=>{
      let d={}; try{d=await r.json()}catch(_){ }
      if(!r.ok){const e=new Error(d.error||('HTTP_'+r.status));e.status=r.status;e.detail=d;throw e;}
      return d;
    });
  }

  function ensureUI(){
    if(document.getElementById('fnLoginOverlay')) return;
    const o=document.createElement('div'); o.id='fnLoginOverlay';
    o.innerHTML='<div class="fn-login-card">'
      +'<div class="fn-login-kicker">FORTUNE NOIR / SECURE ACCESS</div>'
      +'<h1>LOGIN</h1>'
      +'<p class="fn-login-sub">391x uses the admin password. Other names enter as players.</p>'
      +'<label>PLAYER NAME</label><input id="fnLoginName" maxlength="32" autocomplete="username" placeholder="PLAYER">'
      +'<label>PASSWORD <small>391x ONLY</small></label><input id="fnLoginPassword" type="password" autocomplete="current-password" placeholder="••••••••">'
      +'<button id="fnLoginButton" type="button">ENTER FORTUNE NOIR</button>'
      +'<div id="fnLoginStatus">SERVER AUTHENTICATION</div>'
      +'</div>';
    document.body.appendChild(o);
    const n=o.querySelector('#fnLoginName'), p=o.querySelector('#fnLoginPassword'), b=o.querySelector('#fnLoginButton');
    n.value=''; p.value='';
    b.addEventListener('click',()=>login(n.value,p.value));
    p.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();login(n.value,p.value)}});
    n.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();p.focus()}});
  }
  function showLogin(prefillAdmin){
    ensureUI();
    const o=document.getElementById('fnLoginOverlay'); if(o)o.classList.remove('hidden');
    const n=document.getElementById('fnLoginName'), p=document.getElementById('fnLoginPassword');
    if(prefillAdmin){n.value=ADMIN_ID;n.readOnly=true}else{n.readOnly=false;if(!n.value)n.value='';}
    p.value='';
    setTimeout(()=>{if(prefillAdmin)p.focus();else n.focus();},0);
  }
  function hideLogin(){document.getElementById('fnLoginOverlay')?.classList.add('hidden');}

  async function login(rawName,rawPass){
    if(busy)return false;
    const name=String(rawName||'').trim();
    const pass=String(rawPass||'');
    const st=document.getElementById('fnLoginStatus'), b=document.getElementById('fnLoginButton');
    if(!name){st.textContent='PLAYER NAME REQUIRED';return false;}
    if(name.toLowerCase()===ADMIN_ID.toLowerCase() && !pass){st.textContent='ADMIN PASSWORD REQUIRED';return false;}
    busy=true; if(b)b.disabled=true; st.textContent='AUTHENTICATING...';
    try{
      if(name.toLowerCase()===ADMIN_ID.toLowerCase()){
        const d=await api('/auth/login',{method:'POST',body:JSON.stringify({username:ADMIN_ID,password:pass})});
        localStorage.setItem(K.admin,d.token); localStorage.removeItem(K.player); localStorage.removeItem(K.role);
        setRole('admin',ADMIN_ID); hideLogin(); window.__FN_AUTHENTICATED=true; window.__FN_AUTH_COMPLETE=true;
        st.textContent='ADMIN AUTHENTICATED';
        // Let the existing app.js TAP TO ENTER handler run exactly once.
        setTimeout(()=>document.getElementById('tapStart')?.click(),0);
        return true;
      }
      let pid=localStorage.getItem(K.pid)||'';
      if(!/^[a-f0-9-]{20,80}$/i.test(pid)){pid=crypto.randomUUID();localStorage.setItem(K.pid,pid)}
      const d=await api('/player/session',{method:'POST',body:JSON.stringify({playerId:pid,name})});
      localStorage.setItem(K.player,d.token); localStorage.removeItem(K.admin);
      setRole('player',name); hideLogin(); window.__FN_AUTHENTICATED=true; window.__FN_AUTH_COMPLETE=true;
      st.textContent='PLAYER AUTHENTICATED';
      setTimeout(()=>document.getElementById('tapStart')?.click(),0);
      return true;
    }catch(e){
      const detail=e.detail&&e.detail.error?(' '+e.detail.error):'';
      st.textContent='LOGIN FAILED '+(e.status||'')+(e.message?(' '+e.message):'')+detail;
      if(name.toLowerCase()===ADMIN_ID.toLowerCase()){localStorage.removeItem(K.admin);setRole('',name)}
      return false;
    }finally{busy=false;if(b)b.disabled=false;}
  }

  async function restore(){
    ensureUI(); hideDebug();
    // Only auto-restore a valid admin session. Player sessions intentionally require login again
    // so a player session can never block the 391x admin login screen.
    const at=localStorage.getItem(K.admin);
    if(at){
      try{const d=await api('/auth/me',{},at);if(d.role==='admin'){setRole('admin',ADMIN_ID);hideLogin();window.__FN_AUTHENTICATED=true;return true}}catch(_){ }
      localStorage.removeItem(K.admin);
    }
    localStorage.removeItem(K.role);
    window.__FN_AUTHENTICATED=false;
    showLogin(false);
    return false;
  }

  function installStartGate(){
    const b=document.getElementById('tapStart'); if(!b||b.__fnAuthGate)return; b.__fnAuthGate=true;
    // Capture only while unauthenticated. After auth this listener is transparent.
    b.addEventListener('click',function(e){if(role)return;e.preventDefault();e.stopImmediatePropagation();showLogin(false)},true);
    b.addEventListener('touchend',function(e){if(role)return;e.preventDefault();e.stopImmediatePropagation();showLogin(false)},true);
  }

  document.addEventListener('DOMContentLoaded',async function(){
    ensureUI();
    await restore();
    installStartGate();
    // Keep API config visible to the existing app runtime after it loads.
    window.FN_ADMIN_API_URL=API;
  });
})();
