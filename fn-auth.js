/* FORTUNE NOIR AUTH v6.0.0
 * Integrated with the supplied app.js v1.10.0.
 * Auth is established BEFORE the game runtime starts.
 * No PROFILE dependency. No programmatic TAP firing. No duplicate event binding.
 */
(function(){
  'use strict';
  const API='https://fortune-noir-admin-api.alunia1225.workers.dev';
  const INVISIBLE=/[\u200B-\u200D\uFEFF\u2060\u2061\u2062\u2063\u2064\u2065\u2066\u2067\u2068\u2069\u206A-\u206F]/g;
  const ADMIN_ID='391x';
  const K={admin:'FN_ADMIN_TOKEN',player:'FN_PLAYER_TOKEN',pid:'FN_SERVER_PLAYER_ID',role:'FN_ROLE',name:'FN_LOGIN_NAME'};
  window.FN_ADMIN_API_URL=API;
  window.__FN_AUTHENTICATED=false;
  window.__FN_AUTH_ROLE='';

  const $=id=>document.getElementById(id);
  const validPlayerId=id=>/^[a-f0-9-]{20,80}$/i.test(String(id||''));

  function emitAuthChanged(){try{window.dispatchEvent(new CustomEvent('fn-auth-changed',{detail:{role:window.__FN_AUTH_ROLE||''}}));}catch(_){} }

  function setRole(role,name){
    window.__FN_AUTH_ROLE=role||'';
    window.__FN_AUTHENTICATED=!!role;
    if(role) localStorage.setItem(K.role,role); else localStorage.removeItem(K.role);
    if(name) localStorage.setItem(K.name,name); else localStorage.removeItem(K.name);
    if(role==='admin'){
      localStorage.removeItem(K.player);
      syncProfile(ADMIN_ID);
      showDebug(true);
    }else if(role==='player'){
      syncProfile(name||'PLAYER');
      showDebug(false);
    }else{
      showDebug(false);
    }
    emitAuthChanged();
  }

  function syncProfile(name){
    try{
      const key='gb_profile_v2';
      let p={name:'PLAYER',avatar:'FN',games:0,wins:0};
      try{p=JSON.parse(localStorage.getItem(key)||'null')||p}catch(_){ }
      p.name=String(name||'PLAYER').trim()||'PLAYER';
      p.avatar=p.name===ADMIN_ID?'391':'FN';
      localStorage.setItem(key,JSON.stringify(p));
      const n=$('playerName');if(n)n.textContent=p.name;
      const a=$('avatarText');if(a)a.textContent=p.avatar;
      const m=$('profileMeta');if(m)m.textContent=p.name+' • LV.'+(Math.floor((p.games||0)/10)+1);
    }catch(_){ }
  }

  function showDebug(admin){
    document.documentElement.classList.toggle('fn-nonadmin',!admin);
    ['debugToggle','debugEmergency','debugEmergencyPanel','debugPanel','lobbyDebugBtn'].forEach(id=>{
      const e=$(id);if(e)e.style.setProperty('display',admin?'':'none','important');
    });
    let b=$('fnAuthAdminDebug');
    if(admin){
      if(!b){
        b=document.createElement('button');b.id='fnAuthAdminDebug';b.type='button';b.textContent='ADMIN DEBUG';
        b.addEventListener('click',()=>{if(window.__FN_AUTH_ROLE==='admin'&&typeof window.toggleDebug==='function')window.toggleDebug()},{once:false});
        document.body.appendChild(b);
      }
      b.style.setProperty('display','block','important');
    }else if(b){b.style.setProperty('display','none','important');}
  }

  function api(path,opts={},token){
    const o=Object.assign({},opts,{cache:'no-store',credentials:'omit'});
    const h=Object.assign({},o.headers||{});
    if(o.body && !h['content-type'] && !h['Content-Type'])h['content-type']='application/json';
    if(token)h.Authorization='Bearer '+token;
    o.headers=h;
    return fetch(API+path,o).then(async r=>{
      let d={};try{d=await r.json()}catch(_){ }
      if(!r.ok){const e=new Error(d.error||('HTTP_'+r.status));e.status=r.status;e.data=d;throw e;}
      return d;
    });
  }

  function ensureUI(){
    if($('fnLoginOverlay'))return;
    const o=document.createElement('div');o.id='fnLoginOverlay';
    o.innerHTML='<div class="fn-login-card">'
      +'<div class="fn-login-kicker">FORTUNE NOIR / SECURE ACCESS</div>'
      +'<h1>LOGIN</h1>'
      +'<p class="fn-login-sub">391x = administrator. Other names = player.</p>'
      +'<label>PLAYER NAME</label><input id="fnLoginName" maxlength="32" autocomplete="username" placeholder="PLAYER">'
      +'<label>PASSWORD <small>391x ONLY</small></label><div class="fn-password-row"><input id="fnLoginPassword" type="password" autocomplete="current-password" placeholder="••••••••"><button id="fnShowPassword" type="button" aria-label="Show password">SHOW</button></div>'
      +'<button id="fnLoginButton" type="button">LOGIN</button>'
      +'<div id="fnLoginStatus">WAITING FOR LOGIN</div>'
      +'</div>';
    document.body.appendChild(o);
    const n=$('fnLoginName'),p=$('fnLoginPassword'),b=$('fnLoginButton'),sp=$('fnShowPassword');
    if(sp)sp.addEventListener('click',()=>{p.type=p.type==='password'?'text':'password';sp.textContent=p.type==='password'?'SHOW':'HIDE';});
    b.addEventListener('click',()=>login(n.value,p.value));
    p.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();login(n.value,p.value)}});
    n.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();p.focus()}});
  }

  function hideLogin(){const o=$('fnLoginOverlay');if(o)o.classList.add('hidden');}
  function showLogin(){ensureUI();const o=$('fnLoginOverlay');if(o)o.classList.remove('hidden');setTimeout(()=>{$('fnLoginName')?.focus()},0);}

  function cleanPassword(v){
    return String(v==null?'':v).normalize('NFKC').replace(INVISIBLE,'').replace(/[\u0000-\u001F\u007F]/g,'').replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g,' ').trim();
  }

  async function login(rawName,rawPass){
    const name=String(rawName||'').trim();
    const pass=cleanPassword(rawPass);
    const status=$('fnLoginStatus'),button=$('fnLoginButton');
    if(!name){status.textContent='PLAYER NAME REQUIRED';return false;}
    if(name.toLowerCase()===ADMIN_ID.toLowerCase()&&!pass){status.textContent='ADMIN PASSWORD REQUIRED';return false;}
    button.disabled=true;status.textContent='AUTHENTICATING...';
    try{
      if(name.toLowerCase()===ADMIN_ID.toLowerCase()){
        let d;
        try{
          d=await api('/auth/login',{method:'POST',body:JSON.stringify({username:ADMIN_ID,password:pass})});
        }catch(first){
          // Retry once after removing only common invisible/copy-paste whitespace.
          const retryPass=pass.trim();
          if(first.status===401 && retryPass!==pass){
            d=await api('/auth/login',{method:'POST',body:JSON.stringify({username:ADMIN_ID,password:retryPass})});
          }else throw first;
        }
        if(!d.token||d.role!=='admin')throw new Error('INVALID_ADMIN_RESPONSE');
        localStorage.setItem(K.admin,d.token);localStorage.removeItem(K.player);localStorage.setItem(K.role,'admin');localStorage.setItem(K.name,ADMIN_ID);
        setRole('admin',ADMIN_ID);hideLogin();status.textContent='ADMIN AUTHENTICATED';
        return true;
      }
      let pid=localStorage.getItem(K.pid)||'';
      if(!validPlayerId(pid)){pid=(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(16).slice(2));localStorage.setItem(K.pid,pid)}
      const d=await api('/player/session',{method:'POST',body:JSON.stringify({playerId:pid,name})});
      if(!d.token||d.role&&d.role!=='player')throw new Error('INVALID_PLAYER_RESPONSE');
      localStorage.setItem(K.player,d.token);localStorage.removeItem(K.admin);localStorage.setItem(K.role,'player');localStorage.setItem(K.name,name);localStorage.setItem(K.pid,String(d.playerId||pid));
      setRole('player',name);hideLogin();status.textContent='PLAYER AUTHENTICATED';
      return true;
    }catch(e){
      const code=e.status||'NETWORK';
      status.textContent='LOGIN FAILED ['+code+'] '+(e.message||'UNKNOWN_ERROR');
      if(name.toLowerCase()===ADMIN_ID.toLowerCase() && code===401){
        status.textContent='LOGIN FAILED [401] INVALID_CREDENTIALS — Worker rejected the submitted password (length '+pass.length+', normalized)';
      }
      if(name.toLowerCase()===ADMIN_ID.toLowerCase()){localStorage.removeItem(K.admin);localStorage.removeItem(K.role);window.__FN_AUTH_ROLE='';window.__FN_AUTHENTICATED=false;showDebug(false);}
      return false;
    }finally{button.disabled=false;}
  }

  async function restore(){
    ensureUI();showDebug(false);
    const at=localStorage.getItem(K.admin);
    if(at){
      try{const d=await api('/auth/me',{},at);if(d.role==='admin'){setRole('admin',ADMIN_ID);hideLogin();return true;}}catch(_){ }
      localStorage.removeItem(K.admin);
    }
    const pt=localStorage.getItem(K.player);
    if(pt){
      try{const d=await api('/auth/me',{},pt);if(d.role==='player'){setRole('player',localStorage.getItem(K.name)||'PLAYER');hideLogin();return true;}}catch(_){ }
      localStorage.removeItem(K.player);
    }
    setRole('','');showLogin();return false;
  }

  function gateTap(){
    const b=$('tapStart');if(!b||b.__fnAuthGate)return;b.__fnAuthGate=true;
    b.addEventListener('click',e=>{if(window.__FN_AUTHENTICATED)return;e.preventDefault();e.stopImmediatePropagation();showLogin()},true);
    b.addEventListener('touchend',e=>{if(window.__FN_AUTHENTICATED)return;e.preventDefault();e.stopImmediatePropagation();showLogin()},true);
  }

  function enforceDebugAccess(){
    const admin=window.__FN_AUTH_ROLE==='admin';
    document.documentElement.classList.toggle('fn-nonadmin',!admin);
    ['debugToggle','debugEmergency','debugEmergencyPanel','debugPanel','lobbyDebugBtn'].forEach(id=>{
      const e=$(id); if(!e)return; e.style.setProperty('display',admin?'':'none','important'); e.setAttribute('aria-hidden',admin?'false':'true');
    });
    const b=$('fnAuthAdminDebug'); if(b)b.style.setProperty('display',admin?'block':'none','important');
  }

  window.FN_ENFORCE_DEBUG_ACCESS=enforceDebugAccess;

  window.FN_AUTH_LOGIN=login;
  window.FN_AUTH_RESTORE=restore;
  window.FN_AUTH_ROLE=()=>window.__FN_AUTH_ROLE;
  window.FN_AUTHENTICATED=()=>window.__FN_AUTHENTICATED===true;

  // This script is placed after the game DOM but BEFORE app.js.
  ensureUI();showDebug(false);enforceDebugAccess();gateTap();
  window.addEventListener('fn-auth-changed',enforceDebugAccess);
  document.addEventListener('DOMContentLoaded',async()=>{
    await restore();
    enforceDebugAccess();
    gateTap();
  },{once:true});
})();
