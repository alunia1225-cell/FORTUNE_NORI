/* FORTUNE NOIR v1.10.0 - login gate / admin-only diagnostics
 * Fixed against the current app.js title/lobby lifecycle.
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
    ['debugToggle','debugEmergency','lobbyDebugBtn'].forEach(id=>{
      const e=document.getElementById(id); if(e)e.style.display='';
    });
    ensureAdminDebugButton();
  }

  function syncGameProfile(name){
    try{
      const key='gb_profile_v2';
      let p={name:'PLAYER',avatar:'FN',games:0,wins:0};
      try{p=JSON.parse(localStorage.getItem(key)||'null')||p}catch(_){}
      p.name=String(name||'PLAYER').trim()||'PLAYER';
      p.avatar=(p.name==='391x'?'391':'FN').slice(0,3).toUpperCase();
      localStorage.setItem(key,JSON.stringify(p));
      const n=document.getElementById('playerName'); if(n)n.textContent=p.name;
      const a=document.getElementById('avatarText'); if(a)a.textContent=p.avatar;
      const m=document.getElementById('profileMeta'); if(m)m.textContent=p.name+' • LV.'+(Math.floor((p.games||0)/10)+1);
    }catch(_){}
  }

  function ensureAdminDebugButton(){
    if(role!=='admin')return;
    let b=document.getElementById('fnAuthAdminDebug');
    if(!b){
      b=document.createElement('button');
      b.id='fnAuthAdminDebug';
      b.type='button';
      b.textContent='ADMIN DEBUG';
      b.onclick=()=>{try{window.toggleDebug&&window.toggleDebug()}catch(_){}};
      document.body.appendChild(b);
    }
    b.style.display='block';
  }

  function removeAdminDebugButton(){
    const b=document.getElementById('fnAuthAdminDebug');
    if(b)b.style.display='none';
  }

  function setRole(r,name){
    role=r||'';
    if(r) localStorage.setItem(K.role,r);
    else localStorage.removeItem(K.role);
    if(name) localStorage.setItem(K.name,name);
    if(r==='admin'){
      showDebug();
      syncGameProfile(name||ADMIN_ID);
    }else{
      hideDebug();
      removeAdminDebugButton();
      if(r==='player') syncGameProfile(name||'PLAYER');
    }
  }

  async function api(path,options={},token){
    const headers=Object.assign({'content-type':'application/json'},options.headers||{});
    if(token) headers.Authorization='Bearer '+token;
    const r=await fetch(API+path,Object.assign({},options,{headers,cache:'no-store'}));
    let d={};
    try{d=await r.json()}catch(_){ }
    if(!r.ok){ const err=new Error(d.error||'API_ERROR'); err.status=r.status; throw err; }
    return d;
  }

  function ensureUI(){
    if(document.getElementById('fnLoginOverlay')) return;
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
    [n,p].forEach(x=>x.addEventListener('keydown',e=>{
      if(e.key==='Enter') login(n.value.trim(),p.value);
    }));
  }

  function hideLogin(){
    const o=document.getElementById('fnLoginOverlay');
    if(o) o.classList.add('hidden');
  }

  function showLogin(){
    ensureUI();
    const o=document.getElementById('fnLoginOverlay');
    if(o) o.classList.remove('hidden');
    const n=document.getElementById('fnLoginName');
    if(n){n.focus();n.select();}
  }

  async function login(name,password){
    if(busy) return false;
    name=(name||'').trim();
    const status=document.getElementById('fnLoginStatus');
    const button=document.getElementById('fnLoginButton');
    if(!name){ if(status)status.textContent='PLAYER NAME REQUIRED'; return false; }

    busy=true;
    if(button) button.disabled=true;
    if(status) status.textContent='AUTHENTICATING...';

    try{
      if(name.toLowerCase()===ADMIN_ID.toLowerCase()){
        if(!password){ if(status)status.textContent='ADMIN PASSWORD REQUIRED'; return false; }
        const d=await api('/auth/login',{
          method:'POST',
          body:JSON.stringify({username:ADMIN_ID,password})
        });
        localStorage.setItem(K.admin,d.token);
        localStorage.removeItem(K.player);
        setRole('admin',ADMIN_ID);
        syncGameProfile(ADMIN_ID);
        window.__FN_PROFILE_NAME=ADMIN_ID;
        ensureAdminDebugButton();
        if(status) status.textContent='ADMIN AUTHENTICATED';
      }else{
        let pid=localStorage.getItem(K.pid)||'';
        if(!/^[a-f0-9-]{20,80}$/i.test(pid)){
          pid=crypto.randomUUID();
          localStorage.setItem(K.pid,pid);
        }
        const d=await api('/player/session',{
          method:'POST',
          body:JSON.stringify({playerId:pid,name})
        });
        localStorage.setItem(K.player,d.token);
        localStorage.removeItem(K.admin);
        setRole('player',name);
        syncGameProfile(name);
        window.__FN_PROFILE_NAME=name;
        if(status) status.textContent='PLAYER AUTHENTICATED';

        // Keep the existing app.js player session/name in sync without changing its game logic.
        try{
          if(typeof window.fnEnsureOnlinePlayer==='function'){
            await window.fnEnsureOnlinePlayer();
          }
        }catch(_){ }
      }

      hideLogin();
      window.__FN_AUTHENTICATED=true;
      window.__FN_AUTH_COMPLETE=true;
      return true;
    }catch(e){
      if(status){
        status.textContent=
          e.message==='INVALID_CREDENTIALS' ? 'INVALID ADMIN PASSWORD' : ('LOGIN FAILED '+(e.status||'')+' '+e.message).trim();
      }
      if(name.toLowerCase()===ADMIN_ID.toLowerCase()){
        localStorage.removeItem(K.admin);
        setRole('', '');
      }
      return false;
    }finally{
      busy=false;
      if(button)button.disabled=false;
    }
  }

  async function restore(){
    ensureUI();

    const at=localStorage.getItem(K.admin);
    if(at){
      try{
        const d=await api('/auth/me',{},at);
        if(d.role==='admin'){
          setRole('admin',ADMIN_ID);
          syncGameProfile(ADMIN_ID);
          window.__FN_PROFILE_NAME=ADMIN_ID;
          ensureAdminDebugButton();
          hideLogin();
          window.__FN_AUTHENTICATED=true;
          return true;
        }
      }catch(_){ }
      localStorage.removeItem(K.admin);
    }

    const pt=localStorage.getItem(K.player);
    if(pt){
      try{
        const d=await api('/balance',{},pt);
        if(d&&d.playerId){
          const name=localStorage.getItem(K.name)||d.name||'PLAYER';
          setRole('player',name);
          syncGameProfile(name);
          window.__FN_PROFILE_NAME=name;
          hideLogin();
          window.__FN_AUTHENTICATED=true;
          return true;
        }
      }catch(_){ }
      localStorage.removeItem(K.player);
    }

    // No valid session: remain unauthenticated. Do NOT treat this as player.
    setRole('', '');
    window.__FN_AUTHENTICATED=false;
    showLogin();
    return false;
  }

  // Existing debug functions become admin-only in addition to visual hiding.
  const originalToggle=window.toggleDebug;
  window.toggleDebug=function(){
    if(role!=='admin')return;
    return originalToggle&&originalToggle();
  };
  const originalCopy=window.copyDebug;
  window.copyDebug=function(){
    if(role!=='admin')return;
    return originalCopy&&originalCopy();
  };
  const originalClear=window.clearDebug;
  window.clearDebug=function(){
    if(role!=='admin')return;
    return originalClear&&originalClear();
  };

  function installStartGate(){
    const button=document.getElementById('tapStart');
    if(!button||button.__fnAuthGate)return;
    button.__fnAuthGate=true;

    // IMPORTANT: when authenticated, do nothing here. The current app.js
    // click handler must receive the event and run its real start() function.
    button.addEventListener('click',function(e){
      if(role==='admin'||role==='player'){
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      showLogin();
    },true);

    button.addEventListener('touchend',function(e){
      if(role==='admin'||role==='player'){
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      showLogin();
    },true);
  }

  function injectProfileAdminLogin(){
    if(role==='admin') return;
    const panel=document.getElementById('socialPanel');
    if(!panel || panel.dataset.fnAdminInjected==='1') return;
    if(!/PROFILE/i.test(panel.querySelector('h2')?.textContent||'')) return;
    panel.dataset.fnAdminInjected='1';
    const box=document.createElement('div');
    box.className='fn-profile-admin-entry';
    box.innerHTML='<button type="button" id="fnProfileAdminLogin">ADMIN LOGIN</button>';
    panel.insertBefore(box,panel.firstChild?.nextSibling||panel.firstChild);
    const btn=box.querySelector('#fnProfileAdminLogin');
    if(btn) btn.onclick=()=>{
      const o=document.getElementById('socialOverlay'); if(o)o.classList.add('hidden');
      showLogin();
      const n=document.getElementById('fnLoginName'); if(n){n.value=ADMIN_ID;n.readOnly=true;}
      const p=document.getElementById('fnLoginPassword'); if(p){p.value='';p.focus();}
    };
  }

  function forceOpenProfile(){
    const o=document.getElementById('socialOverlay');
    const p=document.getElementById('socialPanel');
    if(!o||!p)return false;
    o.classList.remove('hidden');
    const x={name:localStorage.getItem(K.name)||localStorage.getItem('gb_profile_v2') ? (function(){try{return JSON.parse(localStorage.getItem('gb_profile_v2')||'{}').name||localStorage.getItem(K.name)||'PLAYER'}catch(_){return localStorage.getItem(K.name)||'PLAYER'}})() : 'PLAYER',avatar:'FN'};
    try{const q=JSON.parse(localStorage.getItem('gb_profile_v2')||'{}');x.avatar=q.avatar||'FN';x.games=q.games||0;}catch(_){}
    p.innerHTML='<h2>PROFILE</h2>'+(role==='admin'?'':'<div class=\"fn-profile-admin-entry\"><button type=\"button\" id=\"fnProfileAdminLogin\">ADMIN LOGIN</button></div>')+'<label>PLAYER NAME</label><input id=\"pname\" maxlength=\"16\" value=\"'+String(x.name).replace(/\"/g,'&quot;')+'\"><label>AVATAR TAG</label><input id=\"pavatar\" maxlength=\"3\" value=\"'+String(x.avatar).replace(/\"/g,'&quot;')+'\"><div class=\"socialActions\"><button class=\"primary\" id=\"saveP\">SAVE</button><button id=\"closeP\">CLOSE</button></div>';
    const adminBtn=p.querySelector('#fnProfileAdminLogin');
    if(adminBtn)adminBtn.onclick=()=>{o.classList.add('hidden');showLogin();const n=document.getElementById('fnLoginName');if(n){n.value=ADMIN_ID;n.readOnly=true}const pw=document.getElementById('fnLoginPassword');if(pw){pw.value='';pw.focus()}};
    const close=p.querySelector('#closeP');if(close)close.onclick=()=>o.classList.add('hidden');
    const save=p.querySelector('#saveP');if(save)save.onclick=()=>{const name=(p.querySelector('#pname').value||'PLAYER').trim()||'PLAYER';const av=(p.querySelector('#pavatar').value||'FN').trim().slice(0,3).toUpperCase()||'FN';try{const q=JSON.parse(localStorage.getItem('gb_profile_v2')||'{}');q.name=name;q.avatar=av;localStorage.setItem('gb_profile_v2',JSON.stringify(q));localStorage.setItem(K.name,name)}catch(_){};syncGameProfile(name);o.classList.add('hidden')};
    return true;
  }

  document.addEventListener('click',function(e){
    const t=e.target.closest?.('#profileBtn,#profileCard');
    if(t){
      e.preventDefault();
      e.stopImmediatePropagation();
      forceOpenProfile();
    }
  },true);

  document.addEventListener('DOMContentLoaded',async function(){
    ensureUI();
    hideDebug();
    await restore();
    installStartGate();
  });
})();
