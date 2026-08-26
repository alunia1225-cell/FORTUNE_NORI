
/* ===== GAME RUNTIME LIFECYCLE v1.10.0 ===== */
window.GB_RUNTIME=window.GB_RUNTIME||{active:false,epoch:0,timeouts:new Set(),intervals:new Set(),rafs:new Set(),game:null};
(function(){
 const R=window.GB_RUNTIME,_st=window.setTimeout,_ct=window.clearTimeout,_si=window.setInterval,_ci=window.clearInterval;
 const _raf=window.requestAnimationFrame||function(fn){return _st(()=>fn(performance.now()),16)},_caf=window.cancelAnimationFrame||_ct;
 window.setTimeout=function(fn,ms,...args){const id=_st(function(...aa){R.timeouts.delete(id);fn(...aa)},ms,...args);if(R.active)R.timeouts.add(id);return id};
 window.clearTimeout=function(id){R.timeouts.delete(id);return _ct(id)};
 window.setInterval=function(fn,ms,...args){const id=_si(fn,ms,...args);if(R.active)R.intervals.add(id);return id};
 window.clearInterval=function(id){R.intervals.delete(id);return _ci(id)};
 window.requestAnimationFrame=function(fn){const id=_raf(function(t){R.rafs.delete(id);fn(t)});if(R.active)R.rafs.add(id);return id};
 window.cancelAnimationFrame=function(id){R.rafs.delete(id);return _caf(id)};
 window.GB_stopGameRuntime=function(){R.timeouts.forEach(_ct);R.intervals.forEach(_ci);R.rafs.forEach(_caf);R.timeouts.clear();R.intervals.clear();R.rafs.clear();R.active=false;R.epoch++;};
 window.GB_startGameRuntime=function(name){window.GB_stopGameRuntime();R.active=true;R.epoch++;R.game=name;debugLog("RUNTIME","START",{game:name,epoch:R.epoch});return R.epoch};
})();

/* ===== SAFE RUNTIME / DEBUG BOOT ===== */
/* ===== SECURE ONLINE BALANCE / ADMIN API ===== */
const FN_API_URL = (window.FN_ADMIN_API_URL || "").replace(/\/$/, "");
let FN_PLAYER_TOKEN = localStorage.getItem("FN_PLAYER_TOKEN") || "";
let FN_ADMIN_TOKEN = localStorage.getItem("FN_ADMIN_TOKEN") || "";
let FN_SERVER_PLAYER_ID = localStorage.getItem("FN_SERVER_PLAYER_ID") || "";
let FN_SERVER_BALANCE = null;
let FN_SERVER_SYNCING = false;
function fnApi(path, options={}, tokenOverride=null){
  if(!FN_API_URL) return Promise.reject(new Error("FN_ADMIN_API_URL_NOT_CONFIGURED"));
  const headers=Object.assign({"content-type":"application/json"},options.headers||{});
  const tok=tokenOverride===null?FN_PLAYER_TOKEN:tokenOverride;
  if(tok) headers.Authorization="Bearer "+tok;
  return fetch(FN_API_URL+path,Object.assign({},options,{headers,cache:"no-store"})).then(async r=>{let d={};try{d=await r.json()}catch(_){} if(!r.ok)throw Object.assign(new Error(d.error||"API_ERROR"),{status:r.status,data:d});return d;});
}
function fnPlayerId(){
  let id=FN_SERVER_PLAYER_ID;
  if(!/^[a-f0-9-]{20,80}$/i.test(id)){
    id=(crypto.randomUUID?crypto.randomUUID():([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16)));
    FN_SERVER_PLAYER_ID=id; localStorage.setItem("FN_SERVER_PLAYER_ID",id);
  }
  return id;
}
async function fnEnsureOnlinePlayer(){
  if(!FN_API_URL)return false;
  try{
    const d=await fnApi("/player/session",{method:"POST",body:JSON.stringify({playerId:fnPlayerId(),name:(window.__FN_PROFILE_NAME||"PLAYER")})});
    FN_PLAYER_TOKEN=d.token; localStorage.setItem("FN_PLAYER_TOKEN",FN_PLAYER_TOKEN);
    FN_SERVER_PLAYER_ID=d.playerId; localStorage.setItem("FN_SERVER_PLAYER_ID",d.playerId);
    FN_SERVER_BALANCE=Number(d.balance);
    S.coins=FN_SERVER_BALANCE; localStorage.setItem(KEY,JSON.stringify(S)); render();
    return true;
  }catch(e){debugLog("WARN","ONLINE BALANCE OFFLINE",{error:String(e)});return false}
}
async function fnSyncServerBalance(){
  if(!FN_API_URL||FN_SERVER_SYNCING)return false;
  FN_SERVER_SYNCING=true;
  try{
    const role=window.__FN_AUTH_ROLE||'';
    let d;
    if(role==='admin'){
      const tok=localStorage.getItem('FN_ADMIN_TOKEN')||'';
      d=await fnApi('/admin/player?'+new URLSearchParams({playerId:'391x'}),{method:'GET'},tok);
      d={balance:Number(d.player?.balance||0)};
    }else{
      if(!FN_PLAYER_TOKEN)return false;
      d=await fnApi('/balance',{method:'GET'});
    }
    FN_SERVER_BALANCE=Number(d.balance);S.coins=FN_SERVER_BALANCE;localStorage.setItem(KEY,JSON.stringify(S));render();return true;
  }catch(e){debugLog("WARN","BALANCE SYNC FAILED",{error:String(e)});return false}finally{FN_SERVER_SYNCING=false}
}
window.FN_SYNC_SERVER_BALANCE=fnSyncServerBalance;
async function fnCommitBalanceDelta(delta, reason){
  if(!FN_API_URL||!FN_PLAYER_TOKEN||!Number.isSafeInteger(delta)||delta===0)return false;
  try{
    const txId=(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random());
    const d=await fnApi("/player/adjust",{method:"POST",body:JSON.stringify({delta,reason:String(reason||"GAME").slice(0,80),txId})});
    FN_SERVER_BALANCE=Number(d.balance); S.coins=FN_SERVER_BALANCE; return true;
  }catch(e){debugLog("ERROR","ONLINE BALANCE COMMIT FAILED",{error:String(e),delta,reason});await fnSyncServerBalance();return false}
}
window.__GB_DEBUG_LINES=window.__GB_DEBUG_LINES||[];
window.__GB_DEBUG_COUNT=window.__GB_DEBUG_COUNT||0;

function syncBalanceBar(){
 const v=Number(S?.coins ?? window.coins ?? window.GB_COINS ?? 0);
 const els=[
   document.getElementById("coins"),
   document.getElementById("coinCount"),
   document.getElementById("balance"),
   document.getElementById("balanceValue"),
   document.querySelector(".balance-value"),
   document.querySelector(".coins-value"),
   document.getElementById("gameCoins")
 ].filter(Boolean);
 els.forEach(el=>{el.textContent=v.toLocaleString("ja-JP");});
 const bars=document.querySelectorAll(".balance-bar,.coins-bar,.top-balance,.hud-balance");
 bars.forEach(bar=>{
   let b=bar.querySelector(".balance-bottom-value");
   if(!b){b=document.createElement("div");b.className="balance-bottom-value";bar.appendChild(b)}
   b.textContent=`所持金 ${v.toLocaleString("ja-JP")}`;
 });
}

function debugLog(level,msg,data){
  try{
    const now=new Date();
    const time=now.toLocaleTimeString();
    let extra="";
    try{extra=data===undefined?"":" "+JSON.stringify(data)}catch(e){extra=" {data_serialization_error:"+String(e)+"}";}
    const line=`[${time}] [${level}] ${msg}${extra}`;
    if(!Array.isArray(window.__GB_DEBUG_LINES))window.__GB_DEBUG_LINES=[];
    window.__GB_DEBUG_LINES.push(line);
    if(window.__GB_DEBUG_LINES.length>2000)window.__GB_DEBUG_LINES.splice(0,window.__GB_DEBUG_LINES.length-2000);
    window.__GB_DEBUG_COUNT=window.__GB_DEBUG_LINES.length;
    try{localStorage.setItem("GB_DEBUG_LOG",window.__GB_DEBUG_LINES.join("\n"));}catch(e){}
    try{
      const body=document.getElementById("debugBody");if(body)body.textContent=window.__GB_DEBUG_LINES.join("\n");
      const count=document.getElementById("debugCount");if(count)count.textContent=window.__GB_DEBUG_COUNT;
      const ev=document.getElementById("dbgEvents");if(ev)ev.textContent=window.__GB_DEBUG_COUNT; const lc=document.getElementById("debugCountLobby");if(lc)lc.textContent=window.__GB_DEBUG_COUNT;
      const err=document.getElementById("dbgErrors");if(err&&level==="ERROR")err.textContent=Number(err.textContent||0)+1;
    }catch(uiErr){try{console.error("[FORTUNE NOIR][DEBUG UI ERROR]",uiErr)}catch(e){}}
    try{console.log("[FORTUNE NOIR]",line)}catch(e){}
  }catch(e){try{console.error("[FORTUNE NOIR][LOGGER FAILURE]",e)}catch(x){}}
}

/* 1.10.0 PERSISTENT DIAGNOSTICS — capture failures before game code can swallow them */
window.addEventListener("error",function(ev){
  debugLog("ERROR","UNCAUGHT ERROR",{
    message:ev.message||"unknown",
    source:ev.filename||"",
    line:ev.lineno||0,
    col:ev.colno||0,
    stack:ev.error&&ev.error.stack?ev.error.stack:""
  });
});
window.addEventListener("unhandledrejection",function(ev){
  const reason=ev.reason;
  debugLog("ERROR","UNHANDLED PROMISE REJECTION",{
    message:reason&&reason.message?reason.message:String(reason),
    stack:reason&&reason.stack?reason.stack:""
  });
});
window.addEventListener("beforeunload",function(){
  try{localStorage.setItem("GB_DEBUG_LOG",window.__GB_DEBUG_LINES.join("\n"));}catch(e){}
});
try{
  const old=localStorage.getItem("GB_DEBUG_LOG");
  if(old)window.__GB_DEBUG_LINES=old.split("\n").filter(Boolean);
}catch(e){}

function toggleDebug(){const p=document.getElementById("debugPanel");if(p)p.classList.toggle("hidden")}
function clearDebug(){
  window.__GB_DEBUG_LINES=[];
  window.__GB_DEBUG_COUNT=0;
  try{localStorage.removeItem("GB_DEBUG_LOG")}catch(e){}
  const b=document.getElementById("debugBody");if(b)b.textContent="";
  const n=document.getElementById("debugCount");if(n)n.textContent="0";
  const e=document.getElementById("dbgErrors");if(e)e.textContent="0";
  const g=document.getElementById("dbgGames");if(g)g.textContent="0";
  const ev=document.getElementById("dbgEvents");if(ev)ev.textContent="0";
}
async function copyDebug(){const text=(window.__GB_DEBUG_LINES||[]).join("\n")||"NO DEBUG LOGS";try{await navigator.clipboard.writeText(text);debugLog("SYSTEM","DEBUG COPIED")}catch(e){const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove();}}
window.addEventListener("DOMContentLoaded",()=>{
  const t=document.getElementById("debugToggle");
  if(t)t.addEventListener("click",e=>{if(window.__FN_AUTH_ROLE!=="admin"){e.preventDefault();return}toggleDebug()},{once:true});
  debugLog("BOOT","DEBUG RUNTIME ONLINE",{version:"1.10.0"});
});

const KEY="gb3_save";
const S=JSON.parse(localStorage.getItem(KEY)||'{"coins":0,"wagered":0,"profit":0,"wins":0,"maxwin":0,"history":[],"lastDaily":0,"items":[],"sound":true}');
const $=id=>document.getElementById(id); let audioCtx=null,lastBet=0,timer=null,multi=1;
const ROULETTE_HISTORY_KEY="gb_roulette_history_v1";
let rouletteHistory=[];
try{rouletteHistory=JSON.parse(localStorage.getItem(ROULETTE_HISTORY_KEY)||"[]");if(!Array.isArray(rouletteHistory))rouletteHistory=[]}catch(e){rouletteHistory=[]}
function saveRouletteHistory(){try{localStorage.setItem(ROULETTE_HISTORY_KEY,JSON.stringify(rouletteHistory.slice(0,20)))}catch(e){}}
function rouletteHistoryColor(n){
 const red=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
 return n===0?"green":red.includes(Number(n))?"red":"black";
}
function renderRouletteHistory(){
 const el=$("rouletteHistory");if(!el)return;
 const list=rouletteHistory.slice(0,10);
 el.innerHTML=list.length
   ? list.map((x,i)=>`<span class="roulette-history-number ${rouletteHistoryColor(x)}" title="${x}">${x}</span>`).join("")
   : `<small>NO HISTORY</small>`;
}





function puchun(){
  const e=$("blackout");
  if(e){
    e.classList.add("puchun-active");
    e.style.display="flex";
  }
  // The supplied 2.68s announcement is the only Puchun sound.
  try{
    const au=new Audio("puchun_notice.mp3?v=4.2");
    au.volume=.9;
    au.currentTime=0;
    au.play().catch(()=>{});
    au.addEventListener("ended",()=>{
      if(e){e.classList.remove("puchun-active");e.style.display="none"}
    },{once:true});
    // Fallback in case mobile Safari does not fire ended.
    setTimeout(()=>{
      if(e){e.classList.remove("puchun-active");e.style.display="none"}
    },2900);
  }catch(err){
    if(e){setTimeout(()=>{e.classList.remove("puchun-active");e.style.display="none"},2900)}
  }
  debugLog&&debugLog("AUDIO","PUCHUN",{file:"puchun_notice.mp3",blackout:true});
}

const CRASH_HISTORY_KEY="gb_crash_history_v1";
let CRASH_HISTORY=[];
try{const saved=JSON.parse(localStorage.getItem(CRASH_HISTORY_KEY)||"[]");if(Array.isArray(saved))CRASH_HISTORY=saved.filter(v=>Number.isFinite(Number(v))).slice(0,5).map(Number)}catch(e){}
function saveCrashHistory(){try{localStorage.setItem(CRASH_HISTORY_KEY,JSON.stringify(CRASH_HISTORY.slice(0,5)))}catch(e){}}
function addCrashHistory(value){const n=Number(value);if(!Number.isFinite(n))return;CRASH_HISTORY.unshift(Number(n.toFixed(2)));CRASH_HISTORY=CRASH_HISTORY.slice(0,5);saveCrashHistory();renderCrashHistory()}
function renderCrashHistory(){const el=$("crashHistory");if(!el)return;el.innerHTML=CRASH_HISTORY.length?CRASH_HISTORY.map(v=>`<span class="crash-history-item ${v>=2?"hot":""}"><b>${Number(v).toFixed(2)}x</b></span>`).join(""):`<span class="crash-history-empty">NO HISTORY</span>`}

let CRASH={running:false,x:1,bet:0,t:0,raf:null,token:0,crashPoint:2,points:[]};
function crashPickPoint(){
 const r=Math.random();
 return Math.max(1.01,Math.min(100,1+(-Math.log(Math.max(.0001,1-r)))*2.25));
}
function crashStart(){
 if(CRASH.running)return;
 const b=wager($("bet")?.value);if(!b)return;
 const token=GB_GAME_TOKEN,path=$("crashLine"),area=$("crashArea"),dot=$("crashDot"),xEl=$("crashX"),res=$("res"),chart=$("crashChart");
 if(!path||!area||!dot||!xEl||!res||!chart){debugLog("ERROR","CRASH DOM MISSING",{path:!!path,area:!!area,dot:!!dot,x:!!xEl});return;}
 CRASH={running:true,x:1,bet:b,t:0,raf:null,token,crashPoint:crashPickPoint(),points:[],seed:Math.random()*1000};
 path.setAttribute("d","");area.setAttribute("d","");xEl.textContent="1.00x";res.textContent="FLYING…";chart.classList.remove("crash-hit","crash-cashed");sfx("click");
 const start=performance.now(),curveSpeed=.82,shape=Math.random()*.75+.72;
 const draw=now=>{
   if(!CRASH.running||!gbAlive(token)||CRASH.token!==token)return;
   const elapsed=(now-start)/1000;CRASH.t=elapsed;
   const visibleX=1+Math.exp(curveSpeed*elapsed)-1;
   CRASH.x=Math.min(CRASH.crashPoint,visibleX);xEl.textContent=CRASH.x.toFixed(2)+"x";
   const W=620,H=300,L=18,R=12,T=18,B=22,uw=W-L-R,uh=H-T-B;
   const px=L+uw*Math.min(.995,elapsed/8.5);
   const progress=1-Math.exp(-shape*elapsed/4.5);
   const noise=Math.sin(CRASH.seed+elapsed*2.1)*5+Math.sin(CRASH.seed*.43+elapsed*3.7)*3;
   const py=Math.max(T,H-B-uh*Math.min(.94,progress*.94)+noise);
   CRASH.points.push([px,py]);
   let d=`M ${CRASH.points[0][0].toFixed(1)} ${CRASH.points[0][1].toFixed(1)}`;
   for(let i=1;i<CRASH.points.length;i++)d+=` L ${CRASH.points[i][0].toFixed(1)} ${CRASH.points[i][1].toFixed(1)}`;
   path.setAttribute("d",d);area.setAttribute("d",d+` L ${px.toFixed(1)} ${H-B} L ${L} ${H-B} Z`);dot.setAttribute("cx",px);dot.setAttribute("cy",py);
   if(CRASH.x>=CRASH.crashPoint-.0001){
     CRASH.running=false;res.textContent=`CRASHED @ ${CRASH.x.toFixed(2)}x`;chart.classList.add("crash-hit");addCrashHistory(CRASH.x);settle(b,0,"CRASH");sfx("crash");return;
   }
   CRASH.raf=requestAnimationFrame(draw);
 };
 CRASH.raf=requestAnimationFrame(draw);
}
function crashCashout(){
 if(!CRASH.running)return;
 CRASH.running=false;cancelAnimationFrame(CRASH.raf);
 const payout=Math.floor(CRASH.bet*CRASH.x),res=$("res"),chart=$("crashChart");
 if(res)res.textContent=`CASH OUT @ ${CRASH.x.toFixed(2)}x  +${fmt(payout)}`;
 if(chart)chart.classList.add("crash-cashed");
 settle(CRASH.bet,payout,"CRASH");sfx("win");
}
function choHan(pick){
 if(window.GB_ACTION_BUSY)return;
 const b=wager($("bet").value);if(!b)return;
 window.GB_ACTION_BUSY=true;
 const a=$("diceA"),d=$("diceB"),res=$("res");
 res.innerHTML=`<b class="chc-rolling-text">DICE IN MOTION</b><small>NO MORE BETS</small>`;
 [a,d].forEach((el,i)=>{el.classList.remove("chc-roll","chc-land");el.style.setProperty("--delay",`${i*110}ms`);el.style.setProperty("--drift",i?"12px":"-12px");void el.offsetWidth;el.classList.add("chc-roll")});
 sfx("dice");
 let ticks=0;
 const timer=setInterval(()=>{
  setChcDie(a,1+Math.floor(Math.random()*6));setChcDie(d,1+Math.floor(Math.random()*6));
  if(++ticks>=10){
   clearInterval(timer);
   const av=1+Math.floor(Math.random()*6),dv=1+Math.floor(Math.random()*6),sum=av+dv;
   const side=sum%2===0?"cho":"han",win=side===pick;
   setChcDie(a,av);setChcDie(d,dv);
   [a,d].forEach(el=>{el.classList.remove("chc-roll");el.classList.add("chc-land")});
   res.innerHTML=`<div class="chc-total">${av} <em>+</em> ${dv} <em>=</em> <strong>${sum}</strong></div><div class="chc-result-side">${side==="cho"?"丁 • EVEN":"半 • ODD"} <b class="${win?"win":"lose"}">${win?"WIN":"LOSE"}</b></div>`;
   settle(b,win?b*2:0,"CHO-HAN");sfx(win?"win":"lose");
   setTimeout(()=>{[a,d].forEach(el=>el.classList.remove("chc-land"));window.GB_ACTION_BUSY=false},650);
  }
 },105);
}
function setChcDie(el,v){if(el)el.dataset.value=String(v)}
function hdSetDie(el,v){
 if(!el)return;el.dataset.value=String(v);const c=el.querySelector(".hd-cube");if(!c)return;
 const p={1:[[1,1]],2:[[0,0],[2,2]],3:[[0,0],[1,1],[2,2]],4:[[0,0],[0,2],[2,0],[2,2]],5:[[0,0],[0,2],[1,1],[2,0],[2,2]],6:[[0,0],[1,0],[2,0],[0,2],[1,2],[2,2]]}[v];
 c.innerHTML='<span class="hd-face">'+p.map(([r,col])=>`<i style="--r:${r};--c:${col}"></i>`).join("")+'</span>';
}
function playHighDice(){
 if(window.GB_ACTION_BUSY)return;const b=wager($("bet").value);if(!b)return;window.GB_ACTION_BUSY=true;
 const els=[$("hdP1"),$("hdP2"),$("hdD1"),$("hdD2")],res=$("hdResult");
 res.innerHTML='<b>ROLLING</b><small>NO MORE BETS</small>';
 els.forEach((e,i)=>{e.classList.remove("hd-roll","hd-land");e.style.setProperty("--delay",`${i*90}ms`);e.style.setProperty("--drift",i%2?"12px":"-12px");void e.offsetWidth;e.classList.add("hd-roll")});sfx("dice");let t=0;
 const timer=setInterval(()=>{els.forEach(e=>hdSetDie(e,1+Math.floor(Math.random()*6)));if(++t>=12){clearInterval(timer);const v=els.map(()=>1+Math.floor(Math.random()*6));v.forEach((n,i)=>hdSetDie(els[i],n));els.forEach(e=>{e.classList.remove("hd-roll");e.classList.add("hd-land")});const pt=v[0]+v[1],dt=v[2]+v[3],draw=pt===dt,win=pt>dt;$("hdPTotal").textContent=pt;$("hdDTotal").textContent=dt;res.innerHTML=`<div class="hd-final">${pt} <em>VS</em> ${dt}</div><div class="hd-outcome">${draw?"DRAW":win?"PLAYER WIN":"DEALER WIN"} <b class="${draw?"draw":win?"win":"lose"}">${draw?"BET RETURN":win?"×2":"×0"}</b></div>`;settle(b,draw?b:(win?b*2:0),"HIGH DICE");sfx(draw?"win":(win?"win":"lose"));setTimeout(()=>{els.forEach(e=>e.classList.remove("hd-land"));window.GB_ACTION_BUSY=false},650)}},100);
}
const COIN_HISTORY_KEY="fn_coin_history_v1";
function readCoinHistory(){
 try{const a=JSON.parse(localStorage.getItem(COIN_HISTORY_KEY)||"[]");return Array.isArray(a)?a.slice(0,5):[]}
 catch(_){return []}
}
function writeCoinHistory(r){
 const a=readCoinHistory();a.unshift({side:r.side,win:Boolean(r.win),t:r.t||new Date().toLocaleTimeString()});
 localStorage.setItem(COIN_HISTORY_KEY,JSON.stringify(a.slice(0,5)));
}
function renderCoinHistory(){
 const el=$("coinHistory");if(!el)return;
 const rows=readCoinHistory();
 el.innerHTML=rows.length?rows.map((x,i)=>`<div class="coin-history-row"><span>#${i+1} <small>${x.t||""}</small></span><b class="${x.win?"win":"lose"}">${String(x.side||"").toUpperCase()} • ${x.win?"WIN":"LOSE"}</b></div>`).join(""):`<div class="coin-history-empty">NO HISTORY</div>`;
}
function coinFlip(pick){
 if(window.GB_ACTION_BUSY)return;
 const b=wager($("bet")?.value);if(!b)return;
 const c=$("coin3d"),stage=$("coinFlipMotion"),res=$("res");
 if(!c||!stage||!res){window.GB_ACTION_BUSY=false;return}
 const head=c.querySelector(".coin-head"),tail=c.querySelector(".coin-tail");
 if(!head||!tail){window.GB_ACTION_BUSY=false;return}
 window.GB_ACTION_BUSY=true;
 const result=Math.random()<.5?"heads":"tails",win=result===pick;
 const headMark=head.querySelector("b"),headText=head.querySelector("small");
 const tailMark=tail.querySelector("b"),tailText=tail.querySelector("small");
 if(headMark)headMark.textContent="H"; if(headText)headText.textContent="HEADS";
 if(tailMark)tailMark.textContent="T"; if(tailText)tailText.textContent="TAILS";
 const setSettledFace=face=>{
   c.dataset.face=face;
   c.style.transform="rotateY(0deg)";
   c.style.removeProperty("opacity");
   head.style.transform="rotateY(0deg) translateZ(1px)";
   tail.style.transform="rotateY(0deg) translateZ(1px)";
   head.style.opacity=face==="heads"?"1":"0";
   tail.style.opacity=face==="tails"?"1":"0";
   head.style.visibility=face==="heads"?"visible":"hidden";
   tail.style.visibility=face==="tails"?"visible":"hidden";
 };
 c.dataset.face="flipping";
 head.style.transform="rotateY(0deg) translateZ(1px)";
 tail.style.transform="rotateY(180deg) translateZ(1px)";
 head.style.opacity="1";tail.style.opacity="1";
 head.style.visibility="visible";tail.style.visibility="visible";
 c.style.transform="rotateY(0deg)";
 stage.style.transform="translate3d(0,34px,0) scale(.92)";
 void stage.offsetWidth;
 res.textContent="FLIPPING…";
 const finalAngle=result==="tails"?2340:2160;
 const motion=stage.animate([
   {transform:"translate3d(0,34px,0) scale(.92)"},
   {transform:"translate3d(-34px,-20px,0) scale(1.02)"},
   {transform:"translate3d(28px,-104px,0) scale(1.12)"},
   {transform:"translate3d(-20px,-126px,0) scale(1.16)"},
   {transform:"translate3d(22px,-66px,0) scale(1.09)"},
   {transform:"translate3d(0,0,0) scale(1)"}
 ],{duration:2850,easing:"cubic-bezier(.15,.78,.17,1)",fill:"forwards"});
 const spin=c.animate([
   {transform:"rotateY(0deg) rotateZ(-8deg)"},
   {transform:"rotateY(720deg) rotateZ(8deg)"},
   {transform:"rotateY(1440deg) rotateZ(-6deg)"},
   {transform:`rotateY(${finalAngle}deg) rotateZ(0deg)`}
 ],{duration:2850,easing:"cubic-bezier(.15,.78,.17,1)",fill:"forwards"});
 sfx("flip");
 Promise.all([motion.finished,spin.finished]).then(()=>{
   motion.cancel();spin.cancel();
   setSettledFace(result);
   res.textContent=`${result.toUpperCase()} — ${win?"WIN":"LOSE"}`;
   writeCoinHistory({side:result,win});renderCoinHistory();
   settle(b,win?b*2:0,"COIN TOSS");sfx(win?"win":"lose");
   window.GB_ACTION_BUSY=false;
 }).catch(()=>{
   try{motion.cancel();spin.cancel()}catch(_){}
   setSettledFace("heads");
   window.GB_ACTION_BUSY=false;
 });
}

function pokerCard(c){return `<div class="poker-card">${c.r}${c.s}</div>`}
function flipHeroCard(i){H.heroRevealed[i]=!H.heroRevealed[i];sfx("card");hRender()}
function toggleHandFocus(){document.querySelector(".compact-poker").classList.toggle("hand-focused")}
function pokerCut(t){const e=$("hcut");if(!e)return;e.textContent=t;e.classList.remove("hidden");void e.offsetWidth;e.classList.add("show");setTimeout(()=>e.classList.add("hidden"),900)}
let FN_SAVE_CHAIN=Promise.resolve();
function save(){
  const previous=Number.isFinite(Number(FN_SERVER_BALANCE))?Number(FN_SERVER_BALANCE):null;
  const current=Number(S.coins)||0;
  localStorage.setItem(KEY,JSON.stringify(S)); render();
  if(FN_API_URL&&FN_PLAYER_TOKEN&&previous!==null&&current!==previous){
    const delta=current-previous; FN_SAVE_CHAIN=FN_SAVE_CHAIN.then(()=>fnCommitBalanceDelta(delta,"GAME")).then(()=>{FN_SERVER_BALANCE=Number(S.coins)}).catch(()=>{});
  }
}
function fmt(n){return Math.floor(n).toLocaleString()}
function audio(){if(!S.sound)return null; try{return audioCtx||(audioCtx=new (window.AudioContext||window.webkitAudioContext)())}catch(e){return null}}
function tone(freq,d=.08,type="sine",vol=.035,delay=0){let a=audio();if(!a)return;let o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(0.0001,a.currentTime+delay);g.gain.exponentialRampToValueAtTime(vol,a.currentTime+delay+.01);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+delay+d);o.connect(g);g.connect(a.destination);o.start(a.currentTime+delay);o.stop(a.currentTime+delay+d+.02)}

function audioFile(name){
  if(!S.sound) return;
  try{ const a=new Audio(name); a.volume=0.7; a.preload="auto"; a.play().catch(()=>{}); }catch(e){}
}

function sfx(name){if(!S.sound)return; const fileMap={click:"click.wav",chip:"chip.wav",card:"card.wav",win:"win.wav",lose:"lose.wav",spin:"spin.wav",dice:"dice.wav",roulette:"roulette.wav",crash:"crash.wav",jackpot:"jackpot.wav",flip:"flip.wav",deal:"card.wav"}; if(fileMap[name]) audioFile(fileMap[name]);
 const sets={click:[[180,.05]],chip:[[450,.05,"square"]],card:[[850,.045,"triangle"]],win:[[523,.08],[659,.08],[784,.16]],lose:[[180,.15],[120,.18]],spin:[[180,.05],[220,.05],[280,.05]],dice:[[220,.05],[330,.05],[180,.07]],roulette:[[260,.04],[320,.04],[390,.04],[460,.05]],crash:[[180,.15,"sawtooth"],[80,.35,"sawtooth"]],jackpot:[[392,.1],[523,.1],[659,.1],[1046,.3]],draw:[[392,.12],[392,.12],[330,.18]],flip:[[600,.08],[400,.08]],deal:[[700,.05],[900,.05]]};
 (sets[name]||sets.click).forEach((x,i)=>tone(x[0],x[1],x[2]||"sine",.035,i*.06));
}
function wager(v){
 syncBalanceBar();v=Number(v);if(!Number.isFinite(v)||v<10||v>S.coins)return 0;lastBet=v;S.coins-=v;S.wagered+=v;lastBet=v;syncBalanceBar();sfx("chip");return v}
function showOutcome(kind,game,amount,multiplier,net){
 const root=document.getElementById("modalContent");if(!root)return;
 const old=document.getElementById("gbOutcome");if(old)old.remove();
 const el=document.createElement("div");el.id="gbOutcome";el.className=`FN-outcome ${kind==="BIG WIN"?"big":kind==="DRAW"?"draw":kind.toLowerCase().replace(/\s+/g,"-")}`;
 const gross=Number(amount)||0, m=Number(multiplier)||0, n=Number(net)||0;
 const grossText=gross>0?`+${fmt(gross)} COIN RETURN`:`${fmt(Math.abs(gross))} COIN`;
 const multText=m>0?`×${m.toFixed(2).replace(/\.00$/,"")} PAYOUT`:"";
 const netText=n!==0?`NET ${n>0?"+":""}${fmt(n)}`:"NET ±0";
 const parts=String(game).split(" • ");
 const gameName=parts.shift()||"GAME";
 const roleName=parts.join(" • ");
 el.innerHTML=`<div class="FN-outcome-inner"><small>${gameName}</small><strong>${kind}</strong>${roleName?`<div class="FN-outcome-role">${roleName}</div>`:""}<b>${grossText}</b><i class="FN-outcome-mult">${multText}</i><em class="FN-outcome-net">${netText}</em></div>`;
 root.appendChild(el);
 requestAnimationFrame(()=>el.classList.add("show"));
 setTimeout(()=>{el.classList.remove("show");setTimeout(()=>el.remove(),300)},2000);
}
function settleDraw(b,g){
 S.coins+=b;
 S.profit+=0;
 S.history.unshift({g,net:0,t:new Date().toLocaleTimeString()});
 S.history=S.history.slice(0,20);
 save();
 showOutcome("DRAW",g,b,1,0);
 sfx("draw");
 return 0;
}
function settle(b,p,g){
 syncBalanceBar();
 let net=p-b;S.coins+=p;S.profit+=net;
 if(p>b){
   S.wins++;
   S.maxwin=Math.max(S.maxwin,net);
   const mult=b>0?p/b:0;
   showOutcome(p>=b*5?"BIG WIN":"WIN",g,p,mult,net);
 } else if(p===0){
   showOutcome("LOSE",g,0,0,-b);
 }
 S.history.unshift({g,net,t:new Date().toLocaleTimeString()});S.history=S.history.slice(0,20);save();return net;
}
function render(){$("coins").textContent=fmt(S.coins);$("coins2").textContent=fmt(S.coins);if($("welcomeCoins"))$("welcomeCoins").textContent=fmt(S.coins);$("profit").textContent=(S.profit>=0?"+":"")+fmt(S.profit);$("wagered").textContent=fmt(S.wagered);$("level").textContent=Math.floor(S.wagered/10000)+1;$("history").innerHTML=S.history.length?S.history.map(x=>`<div class="history-row"><span>${x.g}</span><b class="${x.net>=0?"win":"lose"}">${x.net>=0?"+":""}${fmt(x.net)}</b><small>${x.t}</small></div>`).join(""):"<div class='history-row'>NO DATA</div>";let names=["YOU","777_MASTER","BLACK_KING","LUCKY_ACE","HOUSE"];$("ranking").innerHTML=names.map((n,i)=>`<div class="rank-row"><span>#${i+1}　${n}</span><b>${fmt(i?250000-i*28000:S.maxwin)} COIN</b><small>${i?"ONLINE":"YOU"}</small></div>`).join("")}
 syncBalanceBar();

let GB_GAME_TOKEN=0;
function gbAlive(t){return t===GB_GAME_TOKEN&&window.GB_RUNTIME&&window.GB_RUNTIME.active}
function openGame(g){
 syncBalanceBar();
 debugLog("GAME","Launch requested",{game:g});
 GB_GAME_TOKEN++;
 const lobby=document.getElementById("appLobby");
 if(lobby)lobby.classList.add("hidden");
 window.GB_stopGameRuntime();window.GB_startGameRuntime(g);
 const token=GB_GAME_TOKEN;
 const title={slot:"ULTIMATE SLOTS",dice:"HIGH DICE",blackjack:"BLACKJACK",holdem:"TEXAS HOLD'EM",roulette:"ROULETTE",highlow:"HIGH & LOW",chohan:"丁半",coin:"COIN FLIP",lottery:"LOTTERY",multiplier:"CRASH ×",daily:"DAILY VAULT",shop:"CHIP SHOP"}[g]||g.toUpperCase();
 $("modalContent").innerHTML=`<div class="game"><div class="jackpot">FORTUNE NOIR / ${title}</div><h2>${title}</h2><div class="game-balance-hud" aria-label="CURRENT BALANCE"><img src="balance_icon.png" alt=""><span id="gameCoins">${fmt(S.coins)}</span><small>COIN</small></div><div id="gameBody"></div></div>`;
 $("modal").classList.remove("hidden");sfx("click");
 try{if(typeof games[g]!=="function")throw new Error("Unknown game: "+g);games[g]();debugLog("GAME","Launch success",{game:g,token})}
 catch(e){debugLog("ERROR","Game launch failed",{game:g,error:String(e),stack:e.stack});$("modalContent").innerHTML=`<div class="game"><h2>GAME ERROR</h2><pre class="debug-error">${String(e.stack||e)}</pre></div>`}
}
function closeGame(){GB_GAME_TOKEN++;debugLog("RUNTIME","STOP",{game:GB_RUNTIME.game});window.GB_stopGameRuntime();$("modal").classList.add("hidden");const lobby=document.getElementById("appLobby");if(lobby)lobby.classList.remove("hidden");sfx("click")}
function betbox(min=10,hideMax=false){
  const max=Math.max(min,S.coins||0);
  const step=max<=1000?10:max<=10000?100:500;
  const value=Math.min(max,Math.max(min,lastBet||min));
  return `<div class="bet-control${hideMax?" roulette-bet-control":""}">
    <div class="bet-control-head"><span>BET AMOUNT</span><strong id="betValue">${fmt(value)}</strong><small>COIN</small></div>
    <input id="bet" class="bet-slider" type="range" min="${Math.min(min,max)}" max="${Math.max(min,max)}" step="${step}" value="${value}" oninput="updateBetSlider(this.value)">
    <div class="bet-scale"><span>${fmt(Math.min(min,max))}</span><span class="bet-max-label">${fmt(max)}</span></div>
  </div>`;
}
function updateBetSlider(v){
  const n=Math.max(10,Math.min(Number(v)||10,S.coins||0));
  lastBet=n;
  const el=$("betValue");if(el)el.textContent=fmt(n);
  const slider=$("bet");if(slider){const min=Number(slider.min),max=Number(slider.max);const pct=max>min?((n-min)/(max-min))*100:100;slider.style.setProperty("--bet-progress",pct+"%")}
}
function scrollToGames(){$("games").scrollIntoView()}
function toggleSound(){S.sound=!S.sound;$("sound").textContent=S.sound?"🔊":"🔇";if(S.sound)sfx("win");save()}

function renderLotteryHistory(){
 const el=$("lotteryHistory");if(!el)return;
 const rows=(S.history||[]).filter(x=>x.g==="LOTTERY").slice(0,5);
 el.innerHTML=rows.length?rows.map(x=>{
   const label=x.result||"LOSE";
   const cls=/^(JP|GOLD|SILVER)/.test(label)?"win":"lose";
   return `<div class="lottery-history-row"><span>${x.t||""}</span><b class="${cls}">${label}</b></div>`;
 }).join(""):`<div class="lottery-history-empty">NO DRAWS YET</div>`;
}
const LOTTERY_SECTORS={
 LOSE:{start:0,end:90,angle:45},
 SILVER:{start:90,end:180,angle:135},
 GOLD:{start:180,end:270,angle:225},
 JP:{start:270,end:360,angle:315}
};
function pickLotteryOutcome(){
 const r=Math.random();
 if(r<0.0005)return "JP";
 if(r<0.0205)return "GOLD";
 if(r<0.15)return "SILVER";
 return "LOSE";
}
function lotteryReward(outcome){return outcome==="JP"?100000:outcome==="GOLD"?10000:outcome==="SILVER"?500:0}
function lotterySectorAtRotation(rotation){
 const a=(((-rotation)%360)+360)%360;
 for(const name of ["LOSE","SILVER","GOLD","JP"]){const q=LOTTERY_SECTORS[name];if(a>=q.start&&a<q.end)return name}
 return "LOSE";
}
function lotteryTargetForOutcome(outcome,current){
 const q=LOTTERY_SECTORS[outcome]||LOTTERY_SECTORS.LOSE;
 const sectorAngle=q.start+8+Math.random()*74;
 const desired=((360-sectorAngle)%360+360)%360;
 const currentNorm=((current%360)+360)%360;
 let delta=desired-currentNorm;if(delta<0)delta+=360;
 return current+(6+Math.floor(Math.random()*3))*360+delta;
}
function lotterySetActiveSector(wheel,name){
 if(!wheel)return;
 const q=LOTTERY_SECTORS[name]||LOTTERY_SECTORS.LOSE;
 wheel.style.setProperty("--active-start",`${q.start}deg`);
 wheel.dataset.active=name;
}

function lottery(){
 if(window.GB_LOTTERY_BUSY)return;
 const b=100,res=$("res"),btn=document.querySelector(".lottery-draw"),wheel=$("lotteryWheel"),valueEl=$("lotteryWheelValue");
 if(S.coins<b){if(res)res.textContent="NOT ENOUGH COINS";return}
 if(!wheel||!valueEl){if(res)res.textContent="LOTTERY ERROR";return}
 S.coins-=b;S.wagered+=b;save();render();
 window.GB_LOTTERY_BUSY=true;if(btn)btn.disabled=true;
 res.textContent="SPINNING…";valueEl.textContent="LOSE";lotterySetActiveSector(wheel,"LOSE");sfx("roulette");
 const outcome=pickLotteryOutcome(),reward=lotteryReward(outcome);
 const current=Number(wheel.dataset.angle||0),final=lotteryTargetForOutcome(outcome,current);
 const start=performance.now(),duration=6200+Math.floor(Math.random()*700);
 let lastLabel="";
 const tick=now=>{
   const p=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-p,4),rotation=current+(final-current)*ease;
   wheel.style.transform=`rotate(${rotation}deg)`;
   const liveOutcome=lotterySectorAtRotation(rotation);
   if(liveOutcome!==lastLabel){lastLabel=liveOutcome;valueEl.textContent=liveOutcome;lotterySetActiveSector(wheel,liveOutcome);}
   if(p<1){requestAnimationFrame(tick);return}
   wheel.style.transform=`rotate(${final}deg)`;wheel.dataset.angle=String(final);valueEl.textContent=outcome;lotterySetActiveSector(wheel,outcome);
   const label=outcome==="JP"?"JP • 100,000 COIN":outcome==="GOLD"?"GOLD • 10,000 COIN":outcome==="SILVER"?"SILVER • 500 COIN":"LOSE";
   if(reward){S.coins+=reward;S.profit+=reward-b;S.wins++;S.maxwin=Math.max(S.maxwin,reward-b);S.history.unshift({g:"LOTTERY",net:reward-b,bet:b,result:label,t:new Date().toLocaleTimeString()});S.history=S.history.slice(0,20);save();render();res.textContent=`${label} • WIN`;sfx(reward>=10000?"jackpot":"win");if(reward>=100000)puchun()}
   else{S.profit-=b;S.history.unshift({g:"LOTTERY",net:-b,bet:b,result:"LOSE",t:new Date().toLocaleTimeString()});S.history=S.history.slice(0,20);save();render();res.textContent="LOSE";sfx("lose")}
   renderLotteryHistory();window.GB_LOTTERY_BUSY=false;if(btn)btn.disabled=false;
 };
 requestAnimationFrame(tick);
}
async function daily(){
  const r=$("res");
  try{
    const d=await fnApi('/rewards/12h',{method:'POST'});
    if(d.balance!==undefined){FN_SERVER_BALANCE=Number(d.balance);S.coins=FN_SERVER_BALANCE;localStorage.setItem(KEY,JSON.stringify(S));render();}
    if(r)r.textContent='CLAIMED +5,000';
    sfx('win');
  }catch(e){
    if(r)r.textContent=e.message==='REWARD_COOLDOWN'?'VAULT LOCKED':'FAILED: '+(e.message||e);
  }
}
async function loadReward12h(){
  try{return await fnApi('/rewards/12h',{method:'GET'})}catch(_){return null}
}
function buy(name,cost){
  cost=Number(cost)||0;if(S.coins<cost){const r=$("res");if(r)r.textContent="NOT ENOUGH COINS";return false}
  S.coins-=cost;S.items=S.items||[];S.items.push(name);S.history.unshift({g:"SHOP",net:-cost,t:new Date().toLocaleTimeString()});S.history=S.history.slice(0,20);save();const r=$("res");if(r)r.textContent=`PURCHASED ${name}`;sfx("chip");return true;
}
const games={
slot(){
 $("gameBody").innerHTML=`<div class="anim-game slot-game">
  <div class="anim-title">GOLDEN REEL</div>
  <div class="slot-machine">
   <div class="slot-top">5 WIN LINES</div>
   <div class="slot-body">
    <div class="reels" id="slotReels">
     <div class="reel-window"><div id="reel1" class="reel">
       <div class="slot-cell seven"><img class="slot-symbol-img" src="${SLOT_ASSET_BASE}seven.png" alt="7"></div>
       <div class="slot-cell bar"><img class="slot-symbol-img" src="${SLOT_ASSET_BASE}bar.png" alt="BAR"></div>
       <div class="slot-cell bell"><img class="slot-symbol-img" src="${SLOT_ASSET_BASE}bell.png" alt="BELL"></div>
     </div></div>
     <div class="reel-window"><div id="reel2" class="reel">
       <div class="slot-cell cherry"><img class="slot-symbol-img" src="${SLOT_ASSET_BASE}cherry.png" alt="CHERRY"></div>
       <div class="slot-cell diamond"><img class="slot-symbol-img" src="${SLOT_ASSET_BASE}diamond.png" alt="DIAMOND"></div>
       <div class="slot-cell lemon"><img class="slot-symbol-img" src="${SLOT_ASSET_BASE}lemon.png" alt="LEMON"></div>
     </div></div>
     <div class="reel-window"><div id="reel3" class="reel">
       <div class="slot-cell blue-seven"><img class="slot-symbol-img" src="${SLOT_ASSET_BASE}blue7.png" alt="BLUE 7"></div>
       <div class="slot-cell grape"><img class="slot-symbol-img" src="${SLOT_ASSET_BASE}grape.png" alt="GRAPE"></div>
       <div class="slot-cell watermelon"><img class="slot-symbol-img" src="${SLOT_ASSET_BASE}watermelon.png" alt="WATERMELON"></div>
     </div></div>
     <div class="payline horizontal line-top"></div><div class="payline horizontal line-mid"></div><div class="payline horizontal line-bottom"></div><div class="payline diagonal down"></div><div class="payline diagonal up"></div>
    </div>
    <div class="slot-lever-wrap"><button id="slotLever" class="slot-lever" onclick="spinSlot()"><span class="lever-knob"></span><span class="lever-shaft"></span></button><small>PULL</small></div>
   </div>
   <button id="slotSpinBtn" class="slot-spin" onclick="spinSlot()">PULL LEVER</button>
  </div>
  <div class="slot-paytable">
   <div class="slot-paytitle">PAYOUT TABLE</div>
   <div class="slot-paygrid">
    <div><b><img class="slot-pay-icon" src="${SLOT_ASSET_BASE}seven.png" alt="7"></b><span>×50</span></div>
    <div><b><img class="slot-pay-icon" src="${SLOT_ASSET_BASE}bar.png" alt="BAR"></b><span>×12</span></div>
    <div><b><img class="slot-pay-icon" src="${SLOT_ASSET_BASE}diamond.png" alt="DIAMOND"></b><span>×8</span></div>
    <div><b><img class="slot-pay-icon" src="${SLOT_ASSET_BASE}bell.png" alt="BELL"></b><span>×5</span></div>
    <div><b><img class="slot-pay-icon" src="${SLOT_ASSET_BASE}cherry.png" alt="CHERRY"></b><span>×5</span></div>
    <div><b><img class="slot-pay-icon" src="${SLOT_ASSET_BASE}lemon.png" alt="LEMON"></b><span>×5</span></div>
    <div><b><img class="slot-pay-icon" src="${SLOT_ASSET_BASE}blue7.png" alt="BLUE 7"></b><span>×5</span></div>
    <div><b><img class="slot-pay-icon" src="${SLOT_ASSET_BASE}grape.png" alt="GRAPE"></b><span>×5</span></div>
    <div><b><img class="slot-pay-icon" src="${SLOT_ASSET_BASE}watermelon.png" alt="WATERMELON"></b><span>×5</span></div>
   </div>
  </div>
 </div>${betbox()}`;
},
dice(){$("gameBody").innerHTML=betbox()+`<div class="anim-game highdice-casino">
<div class="hd-head"><div class="hd-brand">HIGH DICE</div><div class="hd-sub">PLAYER VS DEALER • HIGHER TOTAL WINS</div></div>
<div class="hd-table"><div class="hd-glow"></div>
<section class="hd-side"><div class="hd-label">PLAYER</div><div class="hd-dice"><div class="hd-die" id="hdP1" data-value="1"><div class="hd-cube"></div></div><div class="hd-die" id="hdP2" data-value="1"><div class="hd-cube"></div></div></div><div class="hd-total" id="hdPTotal">—</div></section>
<div class="hd-vs">VS</div>
<section class="hd-side"><div class="hd-label">DEALER</div><div class="hd-dice"><div class="hd-die" id="hdD1" data-value="1"><div class="hd-cube"></div></div><div class="hd-die" id="hdD2" data-value="1"><div class="hd-cube"></div></div></div><div class="hd-total" id="hdDTotal">—</div></section>
</div><div class="hd-rule">HIGHER TOTAL WINS • DRAW RETURNS BET</div>
<div id="hdResult" class="hd-result"><b>PLACE YOUR BET</b><small>PLAYER 2 DICE VS DEALER 2 DICE</small></div>
<button class="hd-roll-btn" onclick="playHighDice()">ROLL DICE</button></div>`},
blackjack(){
  document.getElementById("gameBody").innerHTML=betbox(10)+`
  <div class="felt bj-felt">
    <div class="street">BLACKJACK TABLE</div>
    <div class="bj-zone"><div class="bj-label">DEALER <span id="bjDealerValue">0</span></div><div id="dealer" class="holdem-row"></div></div>
    <div class="pot">BET <span id="bjbet">0</span></div>
    <div class="bj-zone"><div class="bj-label">YOU <span id="bjPlayerValue">0</span></div><div id="player" class="holdem-row"></div></div>
    <div class="actions bj-actions"><button id="bjdeal" onclick="bjDeal()">DEAL</button><button id="bjhit" onclick="bjHit()" disabled>HIT</button><button id="bjstand" onclick="bjStand()" disabled>STAND</button><button id="bjdouble" onclick="bjDouble()" disabled>DOUBLE</button></div>
  </div>`;
},
holdem(){holdemInit()},
roulette(){
 const nums=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
 const red=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
 const cols=nums.map(n=>n===0?'green':red.includes(n)?'red':'black');
 window.ROULETTE_BET=null;
 const gridCols=[[3,6,9,12,15,18,21,24,27,30,33,36],[2,5,8,11,14,17,20,23,26,29,32,35],[1,4,7,10,13,16,19,22,25,28,31,34]];
 const cells=gridCols.flatMap(col=>col.map(n=>`<button type="button" class="roulette-cell ${red.includes(n)?'red':'black'}" onclick="rouletteNumberBet(${n})" aria-label="Bet ${n}"><span>${n}</span></button>`)).join('');
 const wheel=nums.map((n,i)=>`<button type="button" class="real-pocket ${cols[i]}" data-index="${i}" data-number="${n}" style="--i:${i};--a:${(i+0.5)*360/37}deg" aria-label="Bet ${n}" onclick="rouletteNumberBet(${n})"></button>`).join('');
 const wheelLabels=nums.map((n,i)=>`<span class="roulette-wheel-label ${cols[i]}" data-number="${n}" style="--i:${i};--a:${(i+0.5)*360/37}deg">${n}</span>`).join('');
 $("gameBody").innerHTML=`<div class="real-roulette roulette-redesign">
  <section class="roulette-wheel-card">
   <div class="roulette-wheel-title">
    <span>EUROPEAN WHEEL</span>
    <div class="roulette-history-box"><b>HISTORY</b><div id="rouletteHistory"></div></div>
   </div>
   <div class="real-wheel-wrap"><div id="rouletteWheel" class="real-wheel">${wheel}<div class="roulette-wheel-labels">${wheelLabels}</div><div class="real-hub">FN</div><div id="rouletteBall" class="real-ball"></div></div></div>
   <div class="roulette-readout"><span id="rouletteNumber">—</span><small id="rouletteColor">SELECT BET</small></div>
  </section>
  <section class="roulette-table-card">
   <div class="roulette-table-head"><b>ROULETTE TABLE</b><span>SELECT A BET</span></div>
   <div class="roulette-zero-row"><button type="button" class="roulette-zero-cell" onclick="rouletteTableBet('green')"><span>0</span><small>14×</small></button></div>
   <div class="roulette-grid">${cells}</div>
   <div class="roulette-outside">
    <button onclick="rouletteTableBet('low')"><b>1–18</b><span>2×</span></button>
    <button onclick="rouletteTableBet('even')"><b>EVEN</b><span>2×</span></button>
    <button onclick="rouletteTableBet('red')" class="red"><b>RED</b><span>2×</span></button>
    <button onclick="rouletteTableBet('black')" class="black"><b>BLACK</b><span>2×</span></button>
    <button onclick="rouletteTableBet('odd')"><b>ODD</b><span>2×</span></button>
    <button onclick="rouletteTableBet('high')"><b>19–36</b><span>2×</span></button>
   </div>
   <div class="roulette-dozens">
    <button onclick="rouletteTableBet('dozen1')"><b>1st 12</b><span>3×</span></button>
    <button onclick="rouletteTableBet('dozen2')"><b>2nd 12</b><span>3×</span></button>
    <button onclick="rouletteTableBet('dozen3')"><b>3rd 12</b><span>3×</span></button>
   </div>
  </section>
  <div class="roulette-action"><div><span id="rouletteBetLabel">NO BET</span><small>BET AMOUNT <span id="rouletteBetAmount">100</span></small></div><button id="rouletteNumberSpin" onclick="rouletteSpin(window.ROULETTE_BET)" disabled>SPIN <span id="rouletteSpinPayout">SELECT BET</span></button></div>
  <div id="rouletteBetPicker" class="roulette-bet-picker hidden"><div class="roulette-bet-picker-card"><div class="roulette-picker-title">SET YOUR BET</div>${betbox(10,true)}<button type="button" class="roulette-picker-confirm" onclick="rouletteConfirmBet()">BET SET</button></div></div>
 </div>`;
 renderRouletteHistory();
},highlow(){
 $("gameBody").innerHTML=betbox()+`<div class="hl-game">
  <div class="hl-head"><span>HIGH</span><b id="hlValue">+0.0</b><span>LOW</span></div>
  <div class="hl-chart" id="hlChart">
   <div class="hl-axis"><span>+100.0</span><span>0</span><span>-100.0</span></div>
   <div class="hl-zone high-zone"></div><div class="hl-zone low-zone"></div><div class="hl-center-line"></div>
   <svg viewBox="0 0 620 250" preserveAspectRatio="none"><path id="hlArea"></path><path id="hlLine"></path><circle id="hlDot" cx="12" cy="125" r="6"></circle></svg>
   <div id="hlDotValue" class="hl-dot-value hl-dot-draw">+0.0</div>
   <div class="hl-live">LIVE MARKET PATH</div>
  </div>
  <div class="hl-history"><div class="hl-history-head"><b>HIGH &amp; LOW HISTORY</b><small>LAST 10</small></div><div id="hlHistory"></div></div>
  <div class="choices hl-choices"><button onclick="hl('high')">HIGH</button><button onclick="hl('low')">LOW</button></div>
  <div id="res" class="result">CHOOSE A SIDE</div>
 </div>`;
 renderHighLowHistory();
},

chohan(){
 document.getElementById("gameBody").innerHTML=betbox()+`<div class="anim-game chohan-casino">
  <div class="chc-header">
   <div class="chc-brand">CHO-HAN</div><div class="chc-rule">DICE TABLE • EVEN / ODD</div>
  </div>
  <div class="chc-table">
   <div class="chc-spotlight"></div><div class="chc-ring"></div>
   <div class="chc-dice-pit"><div class="chc-die" id="diceA" data-value="1"><div class="chc-cube"><i class="chc-face f1"><span class="pips"><b class="pip p1"></b></span></i><i class="chc-face f6"><span class="pips"><b class="pip p1"></b><b class="pip p2"></b><b class="pip p3"></b><b class="pip p4"></b><b class="pip p5"></b><b class="pip p6"></b></span></i><i class="chc-face f3"><span class="pips"><b class="pip p1"></b><b class="pip p2"></b><b class="pip p3"></b></span></i><i class="chc-face f4"><span class="pips"><b class="pip p1"></b><b class="pip p2"></b><b class="pip p3"></b><b class="pip p4"></b></span></i><i class="chc-face f5"><span class="pips"><b class="pip p1"></b><b class="pip p2"></b><b class="pip p3"></b><b class="pip p4"></b><b class="pip p5"></b></span></i><i class="chc-face f2"><span class="pips"><b class="pip p1"></b><b class="pip p2"></b></span></i></div></div><div class="chc-die" id="diceB" data-value="1"><div class="chc-cube"><i class="chc-face f1"><span class="pips"><b class="pip p1"></b></span></i><i class="chc-face f6"><span class="pips"><b class="pip p1"></b><b class="pip p2"></b><b class="pip p3"></b><b class="pip p4"></b><b class="pip p5"></b><b class="pip p6"></b></span></i><i class="chc-face f3"><span class="pips"><b class="pip p1"></b><b class="pip p2"></b><b class="pip p3"></b></span></i><i class="chc-face f4"><span class="pips"><b class="pip p1"></b><b class="pip p2"></b><b class="pip p3"></b><b class="pip p4"></b></span></i><i class="chc-face f5"><span class="pips"><b class="pip p1"></b><b class="pip p2"></b><b class="pip p3"></b><b class="pip p4"></b><b class="pip p5"></b></span></i><i class="chc-face f2"><span class="pips"><b class="pip p1"></b><b class="pip p2"></b></span></i></div></div></div><div class="chc-shadow"></div>
  </div>
  <div class="chc-choice">
   <button class="chc-choice-btn" onclick="choHan('cho')"><span>丁</span><small>EVEN</small></button>
   <div class="chc-vs">VS</div>
   <button class="chc-choice-btn" onclick="choHan('han')"><span>半</span><small>ODD</small></button>
  </div>
  <div id="res" class="chc-result"><b>SELECT 丁 OR 半</b><small>PLACE YOUR BET TO BEGIN</small></div>
 </div>`;
},
coin(){
 $("gameBody").innerHTML=betbox()+`<div class="anim-game coin-game">
  <div class="anim-title">COIN TOSS</div>
  <div class="coin-stage"><div id="coinFlipMotion" class="coin-flip-motion"><div id="coin3d" class="coin3d" data-face="heads"><div class="coin-face coin-head" aria-label="HEADS"><b>H</b><small>HEADS</small></div><div class="coin-face coin-tail" aria-label="TAILS"><b>T</b><small>TAILS</small></div></div></div></div>
  <div class="coin-choices"><button onclick="coinFlip('heads')"><b>HEADS</b><small>GOLD SIDE</small></button><div class="coin-vs">VS</div><button onclick="coinFlip('tails')"><b>TAILS</b><small>BLACK SIDE</small></button></div>
  <div id="res" class="result coin-result">CHOOSE YOUR SIDE</div>
  <div class="coin-history"><div class="coin-history-head"><b>COIN FLIP HISTORY</b><small>LAST 5</small></div><div id="coinHistory"></div></div>
 </div>`;
 renderCoinHistory();
},
lottery(){
 const wheelStyle=`conic-gradient(from 0deg,#17191b 0deg 307.62deg,#a68a4f 307.62deg 352.62deg,#d1af55 352.62deg 359.82deg,#f0d77a 359.82deg 360deg)`;
 $("gameBody").innerHTML=`<div class="lottery-game">
  <div class="lottery-hero">ONE DRAW <b>100 COIN</b></div>
  <div class="lottery-prizes">
   <div class="lottery-prize jp"><b>100,000</b><small>JACKPOT / JP</small></div>
   <div class="lottery-prize gold"><b>10,000</b><small>GOLD</small></div>
   <div class="lottery-prize silver"><b>500</b><small>SILVER</small></div>
  </div>
  <div class="lottery-wheel-stage"><div class="lottery-pointer"></div><div id="lotteryWheel" class="lottery-wheel" data-angle="0" style="background:${wheelStyle}">
   <div class="lottery-sector-labels" aria-hidden="true"><span class="lottery-sector-label lose">LOSE</span><span class="lottery-sector-label silver">SILVER</span><span class="lottery-sector-label gold">GOLD</span><span class="lottery-sector-label jp">JP</span></div>
   <div class="lottery-wheel-center"><span id="lotteryWheelValue">LOSE</span></div>
  </div></div>
  <div class="lottery-history"><div class="lottery-history-head"><b>RECENT DRAWS</b><small>LAST 5</small></div><div id="lotteryHistory"></div></div>
  <button class="lottery-draw" onclick="lottery()">SPIN LOTTERY</button>
  <div id="res" class="result">READY</div>
 </div>`;
 renderLotteryHistory();
},
multiplier(){
 $("gameBody").innerHTML=betbox()+`<div class="crash-history-panel"><div class="crash-history-head"><span>HISTORY</span><small>LAST 5</small></div><div id="crashHistory" class="crash-history-list"></div></div><div class="crash-wrap">
 <div id="crashChart" class="crash-chart">
  <div class="crash-grid"></div><div id="crashX" class="crash-big">1.00x</div>
  <svg viewBox="0 0 620 300" preserveAspectRatio="none">
   <path id="crashArea" class="crash-area"></path><path id="crashLine" class="crash-line"></path>
   <circle id="crashDot" class="crash-dot" cx="18" cy="278" r="6"></circle>
  </svg>
  <div class="crash-axis-x">TIME</div><div class="crash-axis-y">MULTIPLIER</div>
 </div>
 <div id="res" class="result">READY</div>
 <div class="crash-controls"><button onclick="crashStart()">START</button><button onclick="crashCashout()">CASH OUT</button></div>
 </div>`;renderCrashHistory();
},
daily(){$("gameBody").innerHTML=`<p id="rewardStatus">CHECKING…</p><p>Every 12 hours: <b>+5,000 COIN</b></p><button id="claim12hBtn" onclick="daily()">CLAIM 5,000</button><div id="res" class="result"></div>`;loadReward12h().then(d=>{const st=$("rewardStatus"),btn=$("claim12hBtn");if(!d)return;if(d.claimable){st.textContent='VAULT READY';btn.disabled=false}else{st.textContent='VAULT LOCKED • NEXT CLAIM '+new Date(d.nextClaimAt).toLocaleString('ja-JP');btn.disabled=true}})} ,
shop(){$("gameBody").innerHTML=`<div class="shop-head"><small>CHIP BANK</small><h2>TABLE CHIPS</h2><p>Prepare your virtual stack before entering a table.</p></div><div class="chip-bank"><div><b>🪙 ${fmt(S.coins)}</b><small>AVAILABLE</small></div><button onclick="buy('100 CHIP STACK',100)">+100</button><button onclick="buy('500 CHIP STACK',500)">+500</button><button onclick="buy('1,000 CHIP STACK',1000)">+1,000</button></div><div class="shop-note">Chip stacks are virtual table markers. Your bankroll is synchronized with your server balance.</div><div id="res" class="result">READY</div>`}
};

let SLOT_BUSY=false;
const SLOT_ASSET_BASE="";
const SLOT_SYMBOLS=[
 {id:"seven",html:`<span class="slot-cell seven"><img class="slot-symbol-img" src="${SLOT_ASSET_BASE}seven.png" alt="7"></span>`},
 {id:"bar",html:`<span class="slot-cell bar"><img class="slot-symbol-img" src="${SLOT_ASSET_BASE}bar.png" alt="BAR"></span>`},
 {id:"bell",html:`<span class="slot-cell bell"><img class="slot-symbol-img" src="${SLOT_ASSET_BASE}bell.png" alt="BELL"></span>`},
 {id:"cherry",html:`<span class="slot-cell cherry"><img class="slot-symbol-img" src="${SLOT_ASSET_BASE}cherry.png" alt="CHERRY"></span>`},
 {id:"diamond",html:`<span class="slot-cell diamond"><img class="slot-symbol-img" src="${SLOT_ASSET_BASE}diamond.png" alt="DIAMOND"></span>`},
 {id:"lemon",html:`<span class="slot-cell lemon"><img class="slot-symbol-img" src="${SLOT_ASSET_BASE}lemon.png" alt="LEMON"></span>`},
 {id:"blue7",html:`<span class="slot-cell blue-seven"><img class="slot-symbol-img" src="${SLOT_ASSET_BASE}blue7.png" alt="BLUE 7"></span>`},
 {id:"grape",html:`<span class="slot-cell grape"><img class="slot-symbol-img" src="${SLOT_ASSET_BASE}grape.png" alt="GRAPE"></span>`},
 {id:"watermelon",html:`<span class="slot-cell watermelon"><img class="slot-symbol-img" src="${SLOT_ASSET_BASE}watermelon.png" alt="WATERMELON"></span>`}
];
function slotSetReel(el,rows){if(!el)return;el.innerHTML=rows.map(x=>SLOT_SYMBOLS.find(s=>s.id===x)?.html||SLOT_SYMBOLS[0].html).join("")}
function slotPick(){return SLOT_SYMBOLS[Math.floor(Math.random()*SLOT_SYMBOLS.length)].id}
function slotAudio(type){
 try{
  if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  const ctx=audioCtx,now=ctx.currentTime;
  const osc=ctx.createOscillator(),gain=ctx.createGain();osc.connect(gain);gain.connect(ctx.destination);
  if(type==="lever"){
   osc.type="square";osc.frequency.setValueAtTime(180,now);osc.frequency.exponentialRampToValueAtTime(72,now+.13);
   gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.13,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+.17);osc.start(now);osc.stop(now+.18);
  }else if(type==="reel"){
   osc.type="triangle";osc.frequency.setValueAtTime(95,now);osc.frequency.exponentialRampToValueAtTime(145,now+.035);
   gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.045,now+.004);gain.gain.exponentialRampToValueAtTime(.0001,now+.045);osc.start(now);osc.stop(now+.05);
  }else if(type==="stop"){
   osc.type="square";osc.frequency.setValueAtTime(420,now);osc.frequency.exponentialRampToValueAtTime(110,now+.075);
   gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.12,now+.006);gain.gain.exponentialRampToValueAtTime(.0001,now+.11);osc.start(now);osc.stop(now+.12);
  }else if(type==="line"){
   osc.type="sine";osc.frequency.setValueAtTime(520,now);osc.frequency.exponentialRampToValueAtTime(780,now+.16);
   gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.09,now+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+.2);osc.start(now);osc.stop(now+.21);
  }
 }catch(e){}
}
function slotMarkLines(lines){
 document.querySelectorAll(".slot-machine .payline").forEach(e=>e.classList.remove("hit"));
 lines.forEach(i=>{const el=document.querySelectorAll(".slot-machine .payline")[i];if(el)el.classList.add("hit")});
}
function spinSlot(){
 if(SLOT_BUSY)return;
 const b=wager($("bet")?.value);if(!b)return;
 const token=GB_GAME_TOKEN,res=$("res"),btn=$("slotSpinBtn"),lever=$("slotLever");
 const reels=[1,2,3].map(i=>$("reel"+i));
 SLOT_BUSY=true;if(btn)btn.disabled=true;if(lever)lever.classList.add("pulled");
 if(res)res.textContent="GOOD LUCK…";
 slotAudio("lever");sfx("click");
 setTimeout(()=>{if(lever)lever.classList.remove("pulled")},320);
 const final=[
   [slotPick(),slotPick(),slotPick()],
   [slotPick(),slotPick(),slotPick()],
   [slotPick(),slotPick(),slotPick()]
 ];
 // Bias only the visual frequency, never force a win. Winning lines remain genuinely random.
 const timers=[];
 reels.forEach((el,i)=>{
   if(!el)return;
   el.classList.add("reel-running");
   const iv=setInterval(()=>{if(!gbAlive(token)){clearInterval(iv);return}slotSetReel(el,[slotPick(),slotPick(),slotPick()]);slotAudio("reel")},72);
   timers.push(iv);
   setTimeout(()=>{
     clearInterval(iv);el.classList.remove("reel-running");slotSetReel(el,final[i]);slotAudio("stop");
     if(i===2){
       const lines=[];
       const paths=[[0,0,0],[1,1,1],[2,2,2],[0,1,2],[2,1,0]];
       paths.forEach((path,idx)=>{const ids=path.map((row,col)=>final[col][row]);if(ids[0]===ids[1]&&ids[1]===ids[2])lines.push(idx)});
       slotMarkLines(lines);
       let mult=0,hitName="";
       for(const li of lines){const ids=paths[li];const id=final[0][ids[0]];const v=id==="seven"?50:id==="bar"?12:id==="diamond"?8:5;if(v>mult){mult=v;hitName=id.toUpperCase()}}
       const winLines=lines.length;
       if(winLines){mult*=winLines>1?1.5:1;mult=Math.floor(mult);}
       SLOT_BUSY=false;if(btn)btn.disabled=false;
       if(res)res.textContent=winLines?`${hitName} • ${winLines} LINE${winLines>1?"S":""} • ×${mult}`:"";
       if(winLines){slotAudio("line");settle(b,Math.floor(b*mult),"ULTIMATE SLOTS");sfx(mult>=15?"jackpot":"win");if(mult>=15)puchun()}else{settle(b,0,"ULTIMATE SLOTS");sfx("lose")}
     }
   },1000+i*700);
 },
 );
}
let HL_BUSY=false;

const HL_HISTORY_KEY="fn_highlow_history_v1";
function readHighLowHistory(){
 try{const a=JSON.parse(localStorage.getItem(HL_HISTORY_KEY)||"[]");
  return Array.isArray(a)?a.filter(x=>x&&Number.isFinite(Number(x.value))).slice(0,10):[];
 }catch(_){return []}
}
function writeHighLowHistory(r){
 const a=readHighLowHistory();
 a.unshift({value:Number(Number(r.value).toFixed(1)),side:r.side,result:r.result,net:Number(r.net||0),t:r.t||new Date().toLocaleTimeString()});
 localStorage.setItem(HL_HISTORY_KEY,JSON.stringify(a.slice(0,10)));
}
function renderHighLowHistory(){
 const el=$("hlHistory");if(!el)return;
 const rows=readHighLowHistory();
 el.innerHTML=rows.length?rows.map((x,i)=>{
   const v=Number(x.value||0),side=x.side||(v>0?"high":v<0?"low":"draw");
   const label=side==="high"?"HIGH":side==="low"?"LOW":"DRAW";
   return `<div class="hl-history-row"><span>#${i+1} <small>${x.t||""}</small></span><b class="hl-${side}">${label} ${v>=0?"+":""}${v.toFixed(1)}</b></div>`;
 }).join(""):`<div class="hl-history-empty">NO HISTORY</div>`;
}
function hl(choice){
 if(window.GB_ACTION_BUSY)return;
 const b=wager($("bet")?.value);if(!b)return;
 const token=GB_GAME_TOKEN,line=$("hlLine"),area=$("hlArea"),dot=$("hlDot"),vEl=$("hlValue"),dotVal=$("hlDotValue"),res=$("res"),chart=$("hlChart");
 if(!line||!area||!dot||!vEl||!res||!chart){return}
 window.GB_ACTION_BUSY=true;
 const finalValue=Math.round((Math.random()*1998-999))/10;
 const side=finalValue>0?"high":finalValue<0?"low":"draw";
 const win=side==="draw"?!1:(choice===side);
 const start=performance.now(),duration=12000;
 const width=620,height=250,centerY=125;
 const mapValue=v=>Math.max(18,Math.min(232,centerY-(v/100)*107));
 const formatValue=v=>`${v>=0?"+":""}${v.toFixed(1)}`;
 const points=[];
 // Every round gets a fresh, wide path. The path is deliberately allowed to cross 0 several times before the final value.
 const swings=8+Math.floor(Math.random()*4),control=[{t:0,value:0}];
 for(let i=1;i<swings;i++)control.push({t:i/swings,value:Math.round((Math.random()*190-95)*10)/10});
 const negIndex=1;
 const posIndex=swings-2;
 control[negIndex].value=-Math.round((55+Math.random()*40)*10)/10;
 control[posIndex].value=Math.round((55+Math.random()*40)*10)/10;
 control.push({t:1,value:finalValue});
 const sampleCurve=p=>{
   if(p>=1)return finalValue;
   const u=p*swings;
   const i=Math.min(swings-1,Math.floor(u));
   const f=u-i;
   const a=control[i]?.value??0,bv=control[i+1]?.value??finalValue;
   const eased=f*f*(3-2*f);
   return a+(bv-a)*eased;
 };
 let lastRender=-Infinity;
 res.textContent="LIVE…";vEl.textContent="+0.0";chart.classList.remove("hl-high","hl-low","hl-wild");sfx("click");
 const tick=now=>{
   if(!gbAlive(token)){window.GB_ACTION_BUSY=false;return}
   const p=Math.min(1,(now-start)/duration);
   const liveValue=sampleCurve(p);
   const y=mapValue(liveValue);
   const x=12+(width-24)*p;
   points.push([x,y]);
   dot.setAttribute("cx",x.toFixed(1));dot.setAttribute("cy",y.toFixed(1));
   if(now-lastRender>=120||p>=1){
     lastRender=now;
     const displayValue=p>=1?finalValue:liveValue;
     vEl.textContent=formatValue(displayValue);
     if(dotVal){
       dotVal.textContent=formatValue(displayValue);
       dotVal.style.left=`${(x/width)*100}%`;
       dotVal.style.top=`${(y/height)*100}%`;
       dotVal.className=`hl-dot-value hl-dot-${displayValue>0?"high":displayValue<0?"low":"draw"}`;
     }
   }
   let d=`M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
   for(let i=1;i<points.length;i++)d+=` L ${points[i][0].toFixed(1)} ${points[i][1].toFixed(1)}`;
   line.setAttribute("d",d);area.setAttribute("d",d+` L ${x.toFixed(1)} ${height} L 12 ${height} Z`);
   if(p>=1){
     const result=side==="draw"?"DRAW":(win?"WIN":"LOSE");
     window.GB_ACTION_BUSY=false;
     chart.classList.remove("hl-high","hl-low","hl-wild");
     if(side!=="draw")chart.classList.add(side==="high"?"hl-high":"hl-low");
     vEl.textContent=formatValue(finalValue);
     if(dotVal){dotVal.textContent=formatValue(finalValue);dotVal.className=`hl-dot-value hl-dot-${side}`;}
     res.textContent=`${side==="high"?"HIGH":side==="low"?"LOW":"DRAW"} • ${result}`;
     const payout=side==="draw"?b:(win?Math.floor(b*2):0);
     if(side==="draw")settleDraw(b,"HIGH & LOW");else settle(b,payout,"HIGH & LOW");
     writeHighLowHistory({value:finalValue,side,result,net:side==="draw"?0:(payout-b)});
     renderHighLowHistory();
     sfx(side==="draw"?"draw":(win?"win":"lose"));
     return;
   }
   requestAnimationFrame(tick);
 };
 requestAnimationFrame(tick);
}
function dice(c){let b=wager($("bet").value);if(!b)return;sfx("dice");let d=1+Math.floor(Math.random()*6),ok=c==="exact"?d===6:c==="high"?d>=4:d<=3;$("res").textContent=`🎲 ${d} / ${ok?"WIN":"LOSE"}`;settle(b,ok?Math.floor(b*(c==="exact"?5:2)):0,"HIGH DICE");sfx(ok?"win":"lose");window.GB_ACTION_BUSY=false}
function deck(){let suits=["♠","♥","♦","♣"],ranks=["2","3","4","5","6","7","8","9","10","J","Q","K","A"],d=[];for(let s of suits)for(let r of ranks)d.push({s,r});return d.sort(()=>Math.random()-.5)}
function val(cards){let total=0,aces=0;cards.forEach(c=>{if(["J","Q","K"].includes(c.r))total+=10;else if(c.r==="A"){total+=11;aces++}else total+=+c.r});while(total>21&&aces--)total-=10;return total}
let BJ={hands:[],active:0,deck:[],d:[],bet:0,reveal:false,over:false,totalBet:0,split:false,splitHands:[]};
function bjValueText(cards){
  let hard=0,aces=0;
  for(const c of cards){
    if(["J","Q","K"].includes(c.r))hard+=10;
    else if(c.r==="A"){hard+=1;aces++}
    else hard+=Number(c.r);
  }
  const soft=hard+(aces?10:0);
  return aces && soft<=21 ? `${soft} or ${hard}` : `${hard}`;
}
function bjCard(c,hidden=false){if(hidden)return '<div class="card back">?</div>';return `<div class="card ${c.s==="♥"||c.s==="♦"?"red":""} dealt">${c.r}${c.s}</div>`}
function bjRender(){
 const hand=BJ.split?BJ.hands[BJ.active]:BJ.p;
 $("player").innerHTML=hand.map(c=>bjCard(c)).join("");
 $("dealer").innerHTML=BJ.d.map((c,i)=>bjCard(c,i===1&&!BJ.reveal)).join("");
 $("bjPlayerValue").textContent=bjValueText(hand);
 $("bjDealerValue").textContent=BJ.reveal?bjValueText(BJ.d):bjValueText([BJ.d[0]]);
 $("bjbet").textContent=fmt(BJ.bet);
}
function bjActions(on){["bjhit","bjstand","bjdouble"].forEach(id=>$(id).disabled=!on)}
function bjDeal(){
 const b=wager($("bet").value);if(!b)return;
 BJ={deck:deck(),p:[],d:[],bet:b,reveal:false,over:false,split:false,hands:[],active:0,totalBet:b};
 BJ.p=[BJ.deck.pop(),BJ.deck.pop()];BJ.d=[BJ.deck.pop(),BJ.deck.pop()];
 $("bjdeal").disabled=true;bjRender();sfx("deal");
 if(val(BJ.p)===21){BJ.reveal=true;BJ.over=true;bjRender();settle(BJ.bet,Math.floor(BJ.bet*2.5),"BLACKJACK");sfx("jackpot");puchun();bjActions(false);$("bjdeal").disabled=false;return}
 bjActions(true);
}
function bjHit(){if(BJ.over)return;const hand=BJ.split?BJ.hands[BJ.active]:BJ.p;hand.push(BJ.deck.pop());sfx("card");bjRender();if(val(hand)>21){BJ.reveal=true;BJ.over=true;bjRender();settle(BJ.bet,0,"BLACKJACK");sfx("lose");bjActions(false);$("bjdeal").disabled=false}else if(val(hand)===21)bjStand()}
function bjStand(){if(BJ.over)return;BJ.reveal=true;while(val(BJ.d)<17){BJ.d.push(BJ.deck.pop());sfx("card")}BJ.over=true;bjRender();bjResolve()}
function bjDouble(){if(BJ.over||S.coins<BJ.bet)return;S.coins-=BJ.bet;S.wagered+=BJ.bet;syncBalanceBar();BJ.bet*=2;BJ.p.push(BJ.deck.pop());sfx("chip");if(val(BJ.p)>21){BJ.reveal=true;BJ.over=true;bjRender();settle(BJ.bet,0,"BLACKJACK");sfx("lose");bjActions(false);$("bjdeal").disabled=false;return}bjStand()}
function bjResolve(){
 const pv=val(BJ.p),dv=val(BJ.d);
 if(pv===dv){
   settleDraw(BJ.bet,"BLACKJACK");
 }else{
   let payout=0;
   if(dv>21||pv>dv)payout=BJ.bet*2;
   settle(BJ.bet,payout,"BLACKJACK");
   sfx(payout>BJ.bet?"win":"lose");
 }
 bjActions(false);$("bjdeal").disabled=false;
}
let H={};
function pokerActionSound(action){try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const x=new C(),o=x.createOscillator(),g=x.createGain();o.type=action==="CHECK"?"triangle":"square";o.frequency.value=action==="CHECK"?165:930;g.gain.value=.03;o.connect(g);g.connect(x.destination);o.start();o.stop(x.currentTime+(action==="CHECK"?.11:.07));if(["BET","RAISE","CALL","ALL IN"].includes(action))sfx("chip")}catch(e){}}
function pokerTurnSound(){try{sfx("click")}catch(e){}}
const HE_N=3;
function holdemNames(){return["PLAYER","CPU_ACE","CPU_BOSS"];}
function holdemInit(){
 H={
 players:holdemNames().map((name,i)=>({name,stack:Number(S.coins||0),bet:0,total:0,folded:false,allin:false,cards:[],action:"",
   style:["TAG","LAG","TRICKSTER","CALLING"][i%4],bluff:0.06+(i%4)*0.045,confidence:.45,tilt:0,history:[]})),
 hero:0,button:Math.floor(Math.random()*HE_N),street:0,board:[],deck:deck(),pot:0,currentBet:0,turn:0,pending:new Set(),
 heroRevealed:[false,false],communityRevealed:[],over:false,timerId:null,advanceTimer:null,cpuTimer:null,token:GB_GAME_TOKEN,raiseCount:0,lastRaiseSize:100,streetAggro:0,heroAggro:0};
 document.getElementById("gameBody").innerHTML=`<div class="felt he-clean"><div class="he-head"><span id="heStreet">PRE-FLOP</span><b id="hePot">POT 0</b><span id="heButton"></span></div>
 <div class="he-stage"><div id="hePlayers" class="he-players"></div><div class="he-center"><div class="he-potline">POT <strong id="hePotCenter">0</strong></div><div id="heBoard" class="he-board"></div><div id="heStreetCenter" class="he-street-label">PRE-FLOP</div></div><div id="heHero" class="he-hero"></div></div>
 <div class="he-actions"><button id="heCheck" onclick="heAction('CHECK')">CHECK</button><button id="heBet" onclick="heOpenBet('BET')">BET</button><button id="heCall" onclick="heAction('CALL')">CALL</button><button id="heRaise" onclick="heOpenBet('RAISE')">RAISE</button><button id="heFold" onclick="heAction('FOLD')">FOLD</button></div>
 <div id="heBetBox" class="he-betbox hidden"><div><span id="heBetMode">BET</span> <b id="heBetValue">100</b></div><input id="heBetSlider" type="range" min="100" max="100000000" step="100" value="100" oninput="heSyncBet(this.value)"><button onclick="heConfirmBet()">CONFIRM</button></div>
 <div class="he-timer"><i id="heTimerBar"></i></div><div id="heCut" class="he-cut hidden"></div><div id="heStatus" class="he-status"></div><div id="heNext" class="he-next hidden"><span>HAND FINISHED</span><button onclick="heJoinNext()">JOIN NEXT HAND</button></div></div>`;
 heStart();
}
function heStart(){
 clearTimeout(H.advanceTimer);clearTimeout(H.cpuTimer);cancelAnimationFrame(H.timerId);H.cpuTimer=null;
 H.street=0;H.board=[];H.deck=deck();H.pot=0;H.currentBet=0;H.over=false;H.heroRevealed=[false,false];H.communityRevealed=[];H.raiseCount=0;H.lastRaiseSize=100;H.streetAggro=0;H.heroAggro=0;
 H.players.forEach((p,i)=>{p.stack=Math.max(0,Number(S.coins)||0);p.bet=0;p.total=0;p.folded=false;p.allin=false;p.action="";p.cards=[H.deck.pop(),H.deck.pop()];p.confidence=.45;p.tilt=Math.max(0,(p.tilt||0)*.8);p.history=[]});
 const sb=(H.button+1)%HE_N,bb=(H.button+2)%HE_N;
 hePut(sb,50,"SB");hePut(bb,100,"BB");H.currentBet=100;
 H.pending=new Set(H.players.map((_,i)=>i).filter(i=>!H.players[i].folded&&!H.players[i].allin));
 H.turn=(bb+1)%HE_N;heRender();heHero();
 if(H.turn===H.hero)heTimer();else heCpuLater();
}
function hePut(i,n,act){const p=H.players[i],v=Math.min(n,p.stack);p.stack-=v;p.bet+=v;p.total+=v;H.pot+=v;p.action=act;if(p.stack===0)p.allin=true}
function heCard(c){return`<span class="he-mini ${c.s==="♥"||c.s==="♦"?"red":""}">${c.r}${c.s}</span>`}
function heRender(){
 const s=["PRE-FLOP","FLOP","TURN","RIVER","SHOWDOWN"][H.street];
 $("heStreet").textContent=s;$("heStreetCenter").textContent=s;$("hePot").textContent=`POT ${fmt(H.pot)}`;$("hePotCenter").textContent=fmt(H.pot);$("heButton").textContent=`BUTTON ${H.players[H.button].name}`;
 const pos=["","tl","tr","tc"];
 $("hePlayers").innerHTML=H.players.map((p,i)=>{
   if(i===H.hero)return "";
   const act=p.action?`<span class="he-act ${["CHECK","CALL","SB","BB"].includes(p.action)?"passive":p.action==="FOLD"?"fold":"aggressive"}">${p.action}</span>`:"";
   const d=i===H.button?`<span class="he-d">D</span>`:"";
   const cards=H.over?p.cards.map(heCard).join(""):`<span class="he-mini back">FN</span><span class="he-mini back">FN</span>`;
   return`<div class="he-player ${pos[i]} ${H.turn===i&&!H.over?"turn":""}">${d}<div class="he-avatar">${p.name==="PLAYER"?"YOU":p.name.slice(4,7)}</div>${act}<b>${p.name}</b><small>🪙 ${fmt(p.stack)}</small><small class="he-bet">BET ${fmt(p.bet)}</small><div>${cards}</div></div>`;
 }).join("");
 $("heBoard").innerHTML=H.board.map((c,i)=>`<div class="he-community ${H.communityRevealed[i]?"open":""}"><div class="he-ci"><div class="he-back">FN</div><div class="he-front ${c.s==="♥"||c.s==="♦"?"red":""}">${c.r}${c.s}</div></div></div>`).join("");
 const active=H.turn===H.hero&&!H.over,call=heCall();
 $("heCheck").disabled=!active||call>0;$("heCall").disabled=!active||call<=0;$("heBet").disabled=!active||call>0;$("heRaise").disabled=!active||call<=0;$("heFold").disabled=!active;
}
function heHero(){const p=H.players[H.hero];$("heHero").innerHTML=`<div class="he-you">YOU • 🪙 ${fmt(p.stack)} • BET ${fmt(p.bet)}</div><div class="he-myhand">${p.cards.map((c,i)=>`<div class="he-card ${H.heroRevealed[i]?"open":""}" onclick="heFlip(${i})"><div class="front ${c.s==="♥"||c.s==="♦"?"red":""}">${c.r}${c.s}</div><div class="back">FN</div></div>`).join("")}</div>`}
function heFlip(i){H.heroRevealed[i]=!H.heroRevealed[i];heHero();sfx("card")}
function heCall(){return Math.max(0,H.currentBet-H.players[H.hero].bet)}
function heOpenBet(mode){
 if(H.over||H.turn!==H.hero)return;
 const sl=$("heBetSlider"),p=H.players[H.hero],call=heCall();
 if(mode==="BET"){sl.min=Math.max(100,p.bet+100);sl.max=Math.max(sl.min,p.bet+p.stack);sl.value=Math.min(sl.min,p.bet+p.stack)}
 else {const min=Math.min(p.bet+p.stack,H.currentBet+H.lastRaiseSize);sl.min=Math.min(min,p.bet+p.stack);sl.max=p.bet+p.stack;sl.value=min}
 $("heBetMode").textContent=mode;$("heBetValue").textContent=fmt(Number(sl.value)||0);$("heBetBox").classList.remove("hidden");
}
function heSyncBet(v){$("heBetValue").textContent=fmt(Number(v)||0)}
function heConfirmBet(){const v=Number($("heBetSlider").value)||100,m=$("heBetMode").textContent;$("heBetBox").classList.add("hidden");heAction(m,v)}
function heAfter(p,action){
 p.action=action;H.pending.delete(H.turn);heRender();heHero();heCut(action);
 setTimeout(()=>{if(gbAlive(H.token)){pokerTurnSound();heNext()}},520);
}
function heResetPending(except){
 H.pending=new Set(H.players.map((_,i)=>i).filter(i=>i!==except&&!H.players[i].folded&&!H.players[i].allin));
}
function heAction(action,amount=0){
 if(H.over||H.turn!==H.hero)return;
 const p=H.players[H.hero],call=heCall();

 if(action==="FOLD"){p.folded=true;p.action="FOLD";H.heroAggro=Math.max(0,H.heroAggro-.15);heFinish("YOU FOLD");return}
 if(action==="CHECK"){if(call>0)return;pokerActionSound("CHECK");heAfter(p,"CHECK");return}

 if(action==="CALL"){
   const v=Math.min(call,p.stack);p.stack-=v;p.bet+=v;p.total+=v;H.pot+=v;if(p.stack===0)p.allin=true;
   pokerActionSound(p.allin?"ALL IN":"CALL");heAfter(p,p.allin?"ALL IN":"CALL");return;
 }

 if(action==="BET"||action==="RAISE"){
   const target=Math.min(amount,p.bet+p.stack);
   const minTarget=action==="BET"?Math.max(100,p.bet+100):H.currentBet+H.lastRaiseSize;
   if(target<minTarget&&target<p.bet+p.stack)return;
   const v=Math.max(0,target-p.bet);if(v<=0)return;
   const old=H.currentBet;
   p.stack-=v;p.bet+=v;p.total+=v;H.pot+=v;H.currentBet=Math.max(H.currentBet,p.bet);p.allin=p.stack===0;
   if(H.currentBet>old)H.lastRaiseSize=H.currentBet-old;
   H.raiseCount++;H.streetAggro++;H.heroAggro++;
   pokerActionSound(p.allin?"ALL IN":action);
   heResetPending(H.hero);heAfter(p,p.allin?"ALL IN":(action==="BET"&&old===0?"BET":"RAISE"));
 }
}
function heCpuLater(){
 clearTimeout(H.cpuTimer);
 const token=H.token,turn=H.turn;
 const delay=2300+Math.floor(Math.random()*1500);
 H.cpuTimer=setTimeout(()=>{
   H.cpuTimer=null;
   if(!gbAlive(token)||H.over||H.turn!==turn)return;
   const p=H.players[turn];
   if(!p||p.folded||p.allin)return;
   heCpu();
 },delay);
}
function heRankValue(c){return c.r==="A"?14:c.r==="K"?13:c.r==="Q"?12:c.r==="J"?11:+c.r}
function hePreflopStrength(p){
 const a=heRankValue(p.cards[0]),b=heRankValue(p.cards[1]),hi=Math.max(a,b),lo=Math.min(a,b);
 let s=(hi+lo)/28;
 if(a===b)s+=.46+hi/50;
 if(p.cards[0].s===p.cards[1].s)s+=.10;
 if(hi-lo<=2)s+=.075;
 if(hi>=14&&lo>=12)s+=.12;
 if(hi===14&&lo>=10)s+=.07;
 if(hi>=13&&lo>=10)s+=.05;
 return Math.min(1,s);
}
function heBoardTexture(){
 const b=H.board;if(!b.length)return 0;
 const suits={};const vals=b.map(heRankValue).sort((x,y)=>x-y);
 b.forEach(c=>suits[c.s]=(suits[c.s]||0)+1);
 const flush=Math.max(...Object.values(suits||{0:0}))>=2;
 let near=0;
 for(let i=0;i<vals.length;i++)for(let j=i+1;j<vals.length;j++)if(Math.abs(vals[i]-vals[j])<=2)near++;
 return Math.min(1,(flush?.32:0)+(near*.08)+(b.length===5?.22:0));
}
function heEquity(p){
 if(!H.board.length)return hePreflopStrength(p);
 try{
   const known=new Set(H.board.concat(p.cards).map(c=>c.r+c.s));
   const pool=H.deck.filter(c=>!known.has(c.r+c.s));
   let wins=0,ties=0,trials=40;
   for(let t=0;t<trials;t++){
     const sample=pool.slice().sort(()=>Math.random()-.5),opps=[],heroIndex=H.players.indexOf(p);let cur=0;
     for(let k=0;k<HE_N;k++){
       if(k===heroIndex)continue;
       const op=H.players[k];
       if(op.folded||op.allin)continue;
       opps.push([sample[cur++],sample[cur++]]);
     }
     const board=H.board.slice();while(board.length<5)board.push(sample[cur++]);
     const me=best5(p.cards.concat(board)).score;let beaten=false,tie=true;
     for(const oc of opps){
       const sc=best5(oc.concat(board)).score;
       if(sc>me){beaten=true;break}
       if(sc!==me)tie=false;
     }
     if(!beaten){if(tie)ties++;else wins++}
   }
   return (wins+ties*.5)/trials;
 }catch(e){return hePreflopStrength(p)}
}
function heBluffChance(p,eq,call){
 const texture=heBoardTexture();
 const style=p.style==="TRICKSTER"?1.65:p.style==="LAG"?1.3:p.style==="TAG"?.85:.55;
 const position=H.turn===H.hero?0:1;
 const pressure=call/Math.max(1,p.stack);
 let chance=p.bluff*style + texture*.10 + (H.street>0?.035:0);
 if(position)chance+=.035;
 if(H.heroAggro>1)chance+=.045;
 if(eq<.30)chance*=1.1;
 if(pressure>.06)chance*=.65;
 return Math.min(.32,Math.max(.01,chance));
}
function heCpu(){
 H.cpuTimer=null;
 if(H.over||H.turn===H.hero||!gbAlive(H.token))return;
 const i=H.turn,p=H.players[i];
 if(!p||p.folded||p.allin)return;
 const call=Math.max(0,H.currentBet-p.bet),eq=heEquity(p),pressure=call/Math.max(1,p.stack),bluff=heBluffChance(p,eq,call);
 let action="CHECK",amount=0;

 // Strong hands: value bet / value raise.
 if(p.stack<=0){p.allin=true;action="ALL IN"}
 else if(call>0){
   const canBluffRaise=Math.random()<bluff && H.currentBet>0;
   if(eq<.23 && canBluffRaise){
     const raiseSize=Math.max(H.lastRaiseSize,Math.max(100,Math.floor(H.pot*.65/100)*100));
     amount=Math.min(p.bet+p.stack,H.currentBet+raiseSize);action="RAISE";
   }else if(eq<.25 && pressure>.028){
     action="FOLD";
   }else if(eq>.72 && Math.random()<.62){
     const raiseSize=Math.max(H.lastRaiseSize,Math.max(100,Math.floor(H.pot*.55/100)*100));
     amount=Math.min(p.bet+p.stack,H.currentBet+raiseSize);action="RAISE";
   }else if(eq>.48 || pressure<.055){
     action="CALL";
   }else if(eq>.35 && Math.random()<.22){
     action="CALL";
   }else{
     action="FOLD";
   }
 }else{
   const valueBet=eq>.70 && Math.random()<.66;
   const bluffBet=Math.random()<bluff;
   if(valueBet||bluffBet){
     const base=bluffBet&&!valueBet ? Math.max(100,Math.floor(H.pot*.5/100)*100)
       : Math.max(100,Math.floor(Math.max(H.pot*.62,H.lastRaiseSize)/100)*100);
     amount=Math.min(p.bet+p.stack,Math.max(base,p.bet+100));
     action="BET";
   }else if(eq>.55 && Math.random()<.25){
     // Delayed trap: strong-ish hands occasionally CHECK behind to induce.
     action="CHECK";
   }else{
     action="CHECK";
   }
 }

 if(action==="CALL"){
   const v=Math.min(call,p.stack);p.stack-=v;p.bet+=v;p.total+=v;H.pot+=v;p.allin=p.stack===0;
 }else if(action==="BET"||action==="RAISE"){
   const old=H.currentBet;
   const minTarget=action==="BET"?Math.max(100,p.bet+100):H.currentBet+H.lastRaiseSize;
   const target=Math.min(p.bet+p.stack,Math.max(minTarget,amount));
   const v=Math.max(0,target-p.bet);
   if(v<=0){action="CHECK"}
   else{
     p.stack-=v;p.bet+=v;p.total+=v;H.pot+=v;H.currentBet=Math.max(H.currentBet,p.bet);
     if(H.currentBet>old)H.lastRaiseSize=H.currentBet-old;
     p.allin=p.stack===0;H.streetAggro++;if(action==="RAISE")p.confidence=Math.min(1,p.confidence+.08);
     heResetPending(i);
   }
 }

 p.action=p.allin?"ALL IN":action;
 p.history.push(action);
 if(action==="FOLD")p.confidence=Math.max(0,p.confidence-.06);
 if(action==="FOLD")p.folded=true;
 H.pending.delete(i);
 pokerActionSound(p.action);heRender();heCut(`${p.name} • ${p.action}`);
 setTimeout(()=>{if(gbAlive(H.token))heNext()},p.action==="FOLD"||p.action==="ALL IN"?450:2200+Math.floor(Math.random()*1300));
}
function heNext(){
 clearTimeout(H.cpuTimer);H.cpuTimer=null;
 if(H.over||!gbAlive(H.token))return;
 const contenders=H.players.filter(p=>!p.folded),active=contenders.filter(p=>!p.allin);
 if(contenders.length<=1){heAwardUncontested();return}
 if(active.length===0){heRunoutAllIn();return}
 if(H.pending.size===0){if(H.street<3)heStreet();else heShowdown();return}
 let n=H.turn;for(let k=0;k<HE_N;k++){n=(n+1)%HE_N;if(H.pending.has(n)&&!H.players[n].folded&&!H.players[n].allin)break}
 H.turn=n;heRender();heHero();if(H.turn===H.hero)heTimer();else heCpuLater();
}
function heRunoutAllIn(){
 clearTimeout(H.cpuTimer);H.cpuTimer=null;cancelAnimationFrame(H.timerId);
 const st=$("heStatus");if(st)st.textContent="ALL-IN • RUNOUT";
 if(H.over||!gbAlive(H.token))return;
 if(H.street<3){heStreet();return}
 heShowdown();
}
function heStreet(){
 clearTimeout(H.cpuTimer);H.cpuTimer=null;
 const oldBoardCount=H.board.length;
 H.street++;H.burn=H.burn||[];H.burn.push(H.deck.pop());debugLog("POKER","STREET",{street:["","FLOP","TURN","RIVER"][H.street]||"SHOWDOWN",pot:H.pot});H.currentBet=0;H.raiseCount=0;H.lastRaiseSize=100;H.streetAggro=0;H.players.forEach(p=>p.bet=0);
 if(H.street===1)H.board=[H.deck.pop(),H.deck.pop(),H.deck.pop()];else H.board.push(H.deck.pop());
 H.communityRevealed=H.board.map((_,idx)=>idx<oldBoardCount);heRender();heCut(["","FLOP","TURN","RIVER"][H.street]);
 let i=oldBoardCount;const reveal=()=>{
   if(!gbAlive(H.token)||H.over)return;
   if(i<H.board.length){H.communityRevealed[i]=true;heRender();sfx("card");i++;H.advanceTimer=setTimeout(reveal,240);return}
   const live=H.players.map((p,idx)=>idx).filter(idx=>!pFold(idx));
   H.pending=new Set(live.filter(idx=>!H.players[idx].allin));
   // ALL-IN: no active player remains, so keep dealing TURN/RIVER until street 3.
   if(H.pending.size===0){
     if(H.street<3){heRunoutAllIn();return}
     heShowdown();return
   }
   H.turn=(H.button+1)%HE_N;while(!H.pending.has(H.turn))H.turn=(H.turn+1)%HE_N;
   heRender();if(H.turn===H.hero)heTimer();else heCpuLater();
 };
 H.advanceTimer=setTimeout(reveal,320);
}
function pFold(i){return H.players[i].folded||H.players[i].allin}
function heTimer(){
 cancelAnimationFrame(H.timerId);const token=H.token,start=performance.now(),el=$("heTimerBar");
 if(el)el.style.width="0%";
 const tick=()=>{if(H.over||H.turn!==H.hero||!gbAlive(token))return;const e=$("heTimerBar");if(!e)return;const pct=Math.min(100,(performance.now()-start)/7000*100);e.style.width=pct+"%";if(pct>=100){heAction("FOLD");return}H.timerId=requestAnimationFrame(tick)};
 H.timerId=requestAnimationFrame(tick);
}
function heAwardUncontested(){
 if(H.over)return;
 const winner=H.players.find(p=>!p.folded);
 if(!winner)return;
 winner.stack+=H.pot;H.pot=0;H.over=true;
 clearTimeout(H.cpuTimer);clearTimeout(H.advanceTimer);cancelAnimationFrame(H.timerId);
 const text=winner===H.players[H.hero]?"YOU WIN":`${winner.name} WINS`;
 heRender();heHero();heFinishOverlay(text);
}
function heShowdown(){
 clearTimeout(H.cpuTimer);H.cpuTimer=null;
 debugLog("POKER","SHOWDOWN",{pot:H.pot});
 H.over=true;cancelAnimationFrame(H.timerId);clearTimeout(H.advanceTimer);
 H.street=4;H.communityRevealed=H.board.map(()=>true);H.heroRevealed=[true,true];
 const live=H.players.filter(p=>!p.folded);
 const ranked=live.map(p=>({p,r:best5([...p.cards,...H.board])})).sort((a,b)=>b.r.score-a.r.score);
 const best=ranked[0].r.score;
 const winners=ranked.filter(x=>x.r.score===best);
 const share=Math.floor(H.pot/winners.length);
 const remainder=H.pot-share*winners.length;
 winners.forEach((x,i)=>x.p.stack+=share+(i===0?remainder:0));
 heRender();heHero();
 const hero=ranked.find(x=>x.p===H.players[H.hero]);
 const heroWin=winners.some(x=>x.p===H.players[H.hero]);
 const heroInvested=Math.max(0,hero?.p.total||0);
 if(winners.length>1){
   const payout=winners.some(x=>x.p===H.players[H.hero])?share+(winners[0].p===H.players[H.hero]?remainder:0):0;
   const detail=heroWin?`DRAW • ${hero.r.name}`:`DRAW • ${hero.r.name}`;
   heFinishOverlay({kind:"DRAW",detail,amount:payout,mult:payout&&heroInvested?payout/heroInvested:1,net:payout-heroInvested});
 }else if(heroWin){
   const payout=share+(winners[0].p===H.players[H.hero]?remainder:0);
   heFinishOverlay({kind:payout>=heroInvested*5?"BIG WIN":"WIN",detail:hero.r.name,amount:payout,mult:heroInvested?payout/heroInvested:0,net:payout-heroInvested});
 }else{
   const winner=winners[0];
   heFinishOverlay({kind:"LOSE",detail:`${hero.r.name} / ${winner.p.name} ${winner.r.name}`,amount:0,mult:0,net:-heroInvested});
 }
}
function heFinish(text){clearTimeout(H.cpuTimer);H.cpuTimer=null;H.over=true;cancelAnimationFrame(H.timerId);clearTimeout(H.advanceTimer);heRender();heHero();heFinishOverlay(text)}
function heFinishOverlay(text){
 $("heStatus").textContent=(typeof text==="object"?`${text.kind||"RESULT"} • ${text.detail||""}`:String(text));
 heCut(typeof text==="object"?`${text.kind||"RESULT"} • ${text.detail||""}`:String(text));
 let kind="LOSE",detail="UNCONTESTED",amount=0,mult=0,net=-Math.max(0,H.players[H.hero].total||0);
 if(typeof text==="object"){
   kind=text.kind||"LOSE";detail=text.detail||"UNCONTESTED";amount=Number(text.amount)||0;mult=Number(text.mult)||0;net=Number(text.net)||0;
 }else{
   const t=String(text);
   if(t==="DRAW"||t.indexOf("DRAW •")===0){kind="DRAW";detail=t.replace(/^DRAW\s*•?\s*/,"");amount=0;mult=1;net=0}
   else if(t==="YOU WIN"||t.indexOf("WIN •")===0||/WINS$/.test(t)){kind="WIN";detail=t.replace(/^WIN\s*•?\s*/,"").replace(/\s+WINS$/,"");amount=Math.max(0,H.pot);mult=1;net=amount-Math.max(0,H.players[H.hero].total||0)}
   else {kind="LOSE";detail=t.replace(/^LOSE\s*•?\s*/,"").replace(/^YOU\s+/,"");amount=0;mult=0;net=-Math.max(0,H.players[H.hero].total||0)}
 }
 if(kind==="DRAW")sfx("draw");else if(kind==="WIN"||kind==="BIG WIN")sfx("win");else sfx("lose");
 showOutcome(kind,"TEXAS HOLD'EM • "+detail,amount,mult,net);
 $("heNext").classList.remove("hidden")
}
function heJoinNext(){H.button=(H.button+1)%HE_N;$("heNext").classList.add("hidden");$("heStatus").textContent="";heStart()}
function heCut(t){const e=$("heCut");if(!e)return;e.textContent=t;e.classList.remove("hidden");void e.offsetWidth;e.classList.add("show");setTimeout(()=>e.classList.add("hidden"),900)}
function best5(cards){const out=[];function r(st,a){if(a.length===5){out.push(a.slice());return}for(let i=st;i<cards.length;i++){a.push(cards[i]);r(i+1,a);a.pop()}}r(0,[]);let b=null;for(const x of out){const q=handRank(x);if(!b||q.score>b.score)b=q}return b}
function handRank(cs){
 const val=c=>c.r==="A"?14:c.r==="K"?13:c.r==="Q"?12:c.r==="J"?11:Number(c.r);
 const vals=cs.map(val).sort((a,b)=>b-a);
 const counts={};vals.forEach(v=>counts[v]=(counts[v]||0)+1);
 const groups=Object.keys(counts).map(Number).sort((a,b)=>b-a);
 const flush=cs.every(c=>c.s===cs[0].s);
 const uniq=[...new Set(vals)];
 let straightHigh=0;
 if(uniq.includes(14)&&uniq.includes(5)&&uniq.includes(4)&&uniq.includes(3)&&uniq.includes(2))straightHigh=5;
 for(let i=0;i<=uniq.length-5;i++){
   if(uniq[i]-uniq[i+4]===4){straightHigh=Math.max(straightHigh,uniq[i]);break}
 }
 const pack=(cat,arr)=>{
   let score=cat;
   for(let i=0;i<5;i++)score=score*15+(arr[i]||0);
   return score;
 };
 const quads=groups.filter(v=>counts[v]===4);
 if(quads.length){
   const q=quads[0],k=groups.filter(v=>v!==q)[0]||0;
   return{score:pack(7,[q,k]),name:"FOUR OF A KIND"};
 }
 const trips=groups.filter(v=>counts[v]===3);
 const pairs=groups.filter(v=>counts[v]===2);
 if(trips.length&& (pairs.length||trips.length>1)){
   const t=trips[0],p=trips.length>1?trips[1]:pairs[0];
   return{score:pack(6,[t,p]),name:"FULL HOUSE"};
 }
 if(flush&&straightHigh)return{score:pack(8,[straightHigh]),name:"STRAIGHT FLUSH"};
 if(flush)return{score:pack(5,vals),name:"FLUSH"};
 if(straightHigh)return{score:pack(4,[straightHigh]),name:"STRAIGHT"};
 if(trips.length){
   const t=trips[0],ks=vals.filter(v=>v!==t);
   return{score:pack(3,[t,ks[0],ks[1]]),name:"THREE OF A KIND"};
 }
 if(pairs.length>=2){
   const p1=pairs[0],p2=pairs[1],k=vals.find(v=>v!==p1&&v!==p2)||0;
   return{score:pack(2,[p1,p2,k]),name:"TWO PAIR"};
 }
 if(pairs.length===1){
   const p=pairs[0],ks=vals.filter(v=>v!==p);
   return{score:pack(1,[p,ks[0],ks[1],ks[2]]),name:"ONE PAIR"};
 }
 return{score:pack(0,vals),name:"HIGH CARD"};
}
let GB_ROULETTE_BUSY=false;
/* 1.10.0 roulette: wheel sectors and labels share the same 37-step coordinate system. */
function rouletteNumberBet(number){
 if(GB_ROULETTE_BUSY)return;
 rouletteSelectBet({type:'number',value:Number(number),label:String(number),payout:36});
}
function rouletteTableBet(type){
 if(GB_ROULETTE_BUSY)return;
 const map={green:['ZERO','green',14],red:['RED','red',2],black:['BLACK','black',2],low:['1–18','low',2],high:['19–36','high',2],even:['EVEN','even',2],odd:['ODD','odd',2],dozen1:['1ST 12','dozen1',3],dozen2:['2ND 12','dozen2',3],dozen3:['3RD 12','dozen3',3]};
 const m=map[type];if(!m)return;
 rouletteSelectBet({type:m[1],value:m[1],label:m[0],payout:m[2]});
}
function rouletteSelectBet(bet){
 window.ROULETTE_BET={...bet}; // keep the selected wager for repeat SPINs
 const all=document.querySelectorAll('.real-pocket,.roulette-wheel-label,.roulette-cell,.roulette-zero-cell,.roulette-outside button,.roulette-dozens button');
 all.forEach(e=>e.classList.remove('bet-selected','bet-group-selected'));

 const nums=[...document.querySelectorAll('.roulette-cell')];
 const isRed=n=>[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(n);
 const matchesNumber=n=>{
   if(bet.type==='number') return n===Number(bet.value);
   if(bet.type==='red') return isRed(n);
   if(bet.type==='black') return n>0&&!isRed(n);
   if(bet.type==='green') return n===0;
   if(bet.type==='even') return n!==0&&n%2===0;
   if(bet.type==='odd') return n%2===1;
   if(bet.type==='low') return n>=1&&n<=18;
   if(bet.type==='high') return n>=19&&n<=36;
   if(bet.type==='dozen1') return n>=1&&n<=12;
   if(bet.type==='dozen2') return n>=13&&n<=24;
   if(bet.type==='dozen3') return n>=25&&n<=36;
   return false;
 };

 // Highlight every covered number in the numbered betting table.
 nums.forEach(el=>{
   const n=Number(el.getAttribute('aria-label')?.replace('Bet ',''));
   if(Number.isFinite(n)&&matchesNumber(n))el.classList.add('bet-selected');
 });

 // Bet selection is visualized ONLY on the betting-table buttons/cells.
 const outsideSelector=`[onclick="rouletteTableBet('${bet.type}')"]`;
 if(bet.type==='number'){
   document.querySelectorAll(`[aria-label="Bet ${bet.value}"]`).forEach(e=>e.classList.add('bet-selected'));
 }else{
   document.querySelectorAll(outsideSelector).forEach(e=>e.classList.add('bet-selected'));
   if(bet.type==='green')document.querySelectorAll('.roulette-zero-cell').forEach(e=>e.classList.add('bet-selected'));
 }

 const label=$('rouletteBetLabel'),pay=$('rouletteSpinPayout'),nr=$('rouletteNumber'),cr=$('rouletteColor'),spin=$('rouletteNumberSpin');
 if(label)label.textContent=bet.type==='number'?`NUMBER ${bet.value}`:bet.label;
 if(pay)pay.textContent=`${Number(bet.payout).toFixed(2).replace(/\.00$/,'')}× RETURN`;
 if(nr)nr.textContent=bet.type==='number'?String(bet.value):'—';
 if(cr)cr.textContent=bet.type==='number'?'STRAIGHT UP':bet.label;
 const amount=$('rouletteBetAmount');if(amount)amount.textContent=fmt(lastBet||100);
 if(spin)spin.disabled=false;

 // Bet amount picker is only needed the first time; once the bet is confirmed,
 // the same selection remains active and the player can press SPIN repeatedly.
 const picker=$('rouletteBetPicker');
 if(picker && picker.classList.contains('hidden')===false) {
   // already open: keep it open until BET SET
 } else if(picker && !window.ROULETTE_BET_CONFIRMED){
   picker.classList.remove('hidden');
 }
 window.ROULETTE_BET_CONFIRMED=false;
 debugLog('ROULETTE','BET SELECTED',bet);sfx('click');
}

function rouletteConfirmBet(){
 const picker=$('rouletteBetPicker');
 const amount=$('rouletteBetAmount');
 if(amount)amount.textContent=fmt(lastBet||100);
 if(picker)picker.classList.add('hidden');
 window.ROULETTE_BET_CONFIRMED=true;
 const spin=$('rouletteNumberSpin');if(spin&&window.ROULETTE_BET)spin.disabled=false;
 debugLog('ROULETTE','BET AMOUNT CONFIRMED',{amount:lastBet||100,bet:window.ROULETTE_BET});
 sfx('click');
}

function rouletteSpin(choice){
 try{
  if(GB_ROULETTE_BUSY){debugLog('ROULETTE','SPIN IGNORED',{reason:'BUSY'});return}
  const bet=choice&&typeof choice==='object'?choice:null;
  if(!bet){debugLog('ROULETTE','SPIN BLOCKED',{reason:'NO_BET'});return}
  const betEl=$('bet'),rawBet=betEl?Number(betEl.value):Number(lastBet||100),b=wager(rawBet);
  if(!b){debugLog('ROULETTE','SPIN BLOCKED',{reason:'INVALID_BET',rawBet,coins:S.coins});return}
  GB_ROULETTE_BUSY=true;
  const token=GB_GAME_TOKEN,w=$('rouletteWheel'),ball=$('rouletteBall'),numEl=$('rouletteNumber'),colEl=$('rouletteColor');
  if(!w||!ball){GB_ROULETTE_BUSY=false;debugLog('ERROR','ROULETTE DOM MISSING');return}

  // European wheel order. The ball is locked to the same 37-position coordinate
  // system as the pockets, so the visual stop and the reported number can never diverge.
  const pockets=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const red=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  const step=360/37;
  const idx=Math.floor(Math.random()*pockets.length);
  const n=pockets[idx];
  const color=n===0?'green':red.includes(n)?'red':'black';
  const currentWheel=Number(w.dataset.angle||0);
  const currentBall=Number(ball.dataset.angle||0);
  const norm=a=>((a%360)+360)%360;

  // Give every spin a different physical path. Wheel and ball use independent
  // lap counts/directions, then converge on the exact same pocket coordinate.
  const wheelDir=Math.random()<0.5?-1:1;
  const ballDir=Math.random()<0.5?-1:1;
  const wheelLaps=5+Math.floor(Math.random()*4); // 5–8 turns
  const ballLaps=8+Math.floor(Math.random()*5);  // 8–12 turns
  const wheelTargetMod=norm(-(idx*step));
  const wheelBase=norm(currentWheel);
  let wheelDelta=wheelTargetMod-wheelBase;
  if(wheelDir>0){if(wheelDelta<=0)wheelDelta+=360;}else{if(wheelDelta>=0)wheelDelta-=360;}
  const finalWheel=currentWheel + wheelDir*360*wheelLaps + wheelDelta;

  // Ball absolute angle must equal wheel angle + pocket angle at rest.
  // IMPORTANT: #rouletteBall is a child of #rouletteWheel.
  // Its angle is therefore LOCAL to the wheel. The selected pocket is at idx*step.
  const desiredBallMod=norm((idx+0.5)*step);
  let ballDelta=desiredBallMod-norm(currentBall);
  if(ballDir>0){if(ballDelta<=0)ballDelta+=360;}else{if(ballDelta>=0)ballDelta-=360;}
  const finalBall=currentBall + ballDir*360*ballLaps + ballDelta;

  if(numEl)numEl.textContent='—';
  if(colEl)colEl.textContent='SPINNING';
  const spin=$('rouletteNumberSpin');if(spin)spin.disabled=true;
  sfx('roulette');
  const radius=getComputedStyle(w).getPropertyValue('--ball-radius').trim()||'76px';
  const start=performance.now(),duration=6800+Math.floor(Math.random()*900);
  const tick=now=>{
   if(!gbAlive(token)){GB_ROULETTE_BUSY=false;return}
   const p=Math.min(1,(now-start)/duration);
   // Smooth deceleration with a tiny natural ease-out variation per spin.
   const ease=1-Math.pow(1-p,4);
   const wheelAngle=currentWheel+(finalWheel-currentWheel)*ease;
   const ballAngle=currentBall+(finalBall-currentBall)*ease;
   w.style.setProperty('transform',`translate(-50%,-50%) rotate(${wheelAngle}deg)`,'important');
   ball.style.setProperty('transform',`rotate(${ballAngle}deg) translateY(calc(-1 * ${radius}))`,'important');
   if(p<1){requestAnimationFrame(tick);return}

   // Final correction is calculated from the same wheel angle/idx pair.
   w.style.setProperty('transform',`translate(-50%,-50%) rotate(${finalWheel}deg)`,'important');
   // Local ball angle must equal the selected pocket angle.
   // Parent-wheel rotation then places both at the same physical pocket.
   const exactBall=(idx+0.5)*step;
   ball.style.setProperty('transform',`rotate(${exactBall}deg) translateY(calc(-1 * ${radius}))`,'important');
   w.dataset.angle=String(finalWheel);
   ball.dataset.angle=String(exactBall);

   if(numEl)numEl.textContent=String(n);
   if(colEl)colEl.textContent=color.toUpperCase();
   let win=false,payout=bet.payout;
   if(bet.type==='number')win=n===bet.value;
   else if(bet.type==='red'||bet.type==='black'||bet.type==='green')win=color===bet.type;
   else if(bet.type==='low')win=n>=1&&n<=18;
   else if(bet.type==='high')win=n>=19&&n<=36;
   else if(bet.type==='even')win=n!==0&&n%2===0;
   else if(bet.type==='odd')win=n%2===1;
   else if(bet.type==='dozen1')win=n>=1&&n<=12;
   else if(bet.type==='dozen2')win=n>=13&&n<=24;
   else if(bet.type==='dozen3')win=n>=25&&n<=36;
   debugLog('ROULETTE','SPIN RESULT',{
 number:n,color,bet,amount:b,win,payout,pocketIndex:idx,
 pocketAngle:(idx+0.5)*step,wheelStopAngle:finalWheel,
 ballLocalAngle:exactBall,visualScreenAngle:norm(finalWheel+exactBall)
});
   rouletteHistory.unshift(n);
   rouletteHistory=rouletteHistory.slice(0,20);
   saveRouletteHistory();
   renderRouletteHistory();
   settle(b,win?b*payout:0,'ROULETTE');
   sfx(win?'win':'lose');
   if(win&&color==='green')puchun();
   GB_ROULETTE_BUSY=false;
   const spinAgain=$('rouletteNumberSpin');if(spinAgain&&window.ROULETTE_BET)spinAgain.disabled=false;
  };
  requestAnimationFrame(tick);
 }catch(err){GB_ROULETTE_BUSY=false;debugLog('ERROR','ROULETTE SPIN FAILED',{error:String(err),stack:err&&err.stack})}
}
function roulette(c){return rouletteSpin(c)}

document.addEventListener("DOMContentLoaded",()=>{
  try{
    if(typeof render==="function")render();
    debugLog("BOOT","APPLICATION INITIALIZED",{coins:S.coins});
    if(window.__FN_AUTH_ROLE==="player" && FN_API_URL && localStorage.getItem("FN_PLAYER_TOKEN")) fnEnsureOnlinePlayer();
    if(window.__FN_AUTH_ROLE==="admin" && FN_API_URL && localStorage.getItem("FN_ADMIN_TOKEN")) setTimeout(()=>window.FN_SYNC_SERVER_BALANCE?.(),100);
    try{window.FN_ENFORCE_DEBUG_ACCESS?.()}catch(_){}
  }catch(e){debugLog("ERROR","INITIALIZATION FAILED",{error:String(e),stack:e.stack})}
});
window.addEventListener('fn-auth-changed',e=>{if(e.detail?.role==='admin')setTimeout(()=>window.FN_SYNC_SERVER_BALANCE?.(),120);if(e.detail?.role==='player')setTimeout(()=>fnSyncServerBalance(),120)});

(function(){
 document.addEventListener("pointerdown",function(e){
   const b=e.target.closest("button");
   if(b&&navigator.vibrate){try{navigator.vibrate(7)}catch(_){}}
 },{passive:true});
})();

/* ===== ADMIN PANEL: server-authoritative admin center ===== */
(function(){
  function el(tag,attrs,html){const e=document.createElement(tag);Object.entries(attrs||{}).forEach(([k,v])=>e.setAttribute(k,v));if(html!==undefined)e.innerHTML=html;return e}
  let currentTab='overview';
  function panel(){
    if(document.getElementById('fnAdminPanel'))return document.getElementById('fnAdminPanel');
    const p=el('div',{id:'fnAdminPanel',class:'fn-admin-panel hidden'});
    p.innerHTML='<div class="fn-admin-card fn-admin-center">'+
      '<div class="fn-admin-head"><div><small>FORTUNE NOIR / SECURE CONTROL</small><h2>ADMIN CENTER</h2></div><button id="fnAdminClose" type="button">×</button></div>'+ 
      '<div class="fn-admin-tabs">'+
      '<button data-tab="overview">OVERVIEW</button><button data-tab="players">PLAYERS</button><button data-tab="balance">BALANCE</button><button data-tab="items">ITEMS</button><button data-tab="logs">LOGS</button><button data-tab="games">GAME CONTROL</button><button data-tab="debug">DEBUG</button></div>'+ 
      '<div id="fnAdminContent"></div><button id="fnAdminLogout" class="fn-admin-logout" type="button">LOGOUT</button></div>';
    document.body.appendChild(p);
    p.querySelector('#fnAdminClose').onclick=()=>p.classList.add('hidden');
    p.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{currentTab=b.dataset.tab;renderTab()});
    p.querySelector('#fnAdminLogout').onclick=logout;
    return p;
  }
  async function apiAdmin(path,options={}){const token=localStorage.getItem('FN_ADMIN_TOKEN')||'';return fnApi(path,options,token)}
  function content(){return panel().querySelector('#fnAdminContent')}
  async function renderTab(){
    const c=content(); c.innerHTML='<div class="fn-admin-loading">LOADING…</div>';
    if(currentTab==='overview')return overview();
    if(currentTab==='players')return players();
    if(currentTab==='balance')return balance();
    if(currentTab==='items')return items();
    if(currentTab==='logs')return logs();
    if(currentTab==='games')return games();
    if(currentTab==='debug')return debugTab();
  }
  async function overview(){
    try{const d=await apiAdmin('/admin/stats');content().innerHTML=`<div class="fn-admin-grid"><div><b>PLAYERS</b><strong>${d.players}</strong></div><div><b>TOTAL BALANCE</b><strong>${d.totalBalance.toLocaleString('ja-JP')}</strong></div><div><b>LEDGER TX</b><strong>${d.ledgerCount}</strong></div><div><b>TODAY GRANTED</b><strong>+${d.todayGrant.toLocaleString('ja-JP')}</strong></div><div><b>TODAY REVOKED</b><strong>-${d.todayRevoke.toLocaleString('ja-JP')}</strong></div><div><b>MAINTENANCE</b><strong>${d.maintenance?'ON':'OFF'}</strong></div></div><div class="fn-admin-note">Server-authoritative admin center. All balance changes are recorded server-side.</div>`}catch(e){content().innerHTML='<div class="fn-admin-error">FAILED: '+(e.message||e)+'</div>'}
  }
  async function players(){
    content().innerHTML='<div class="fn-admin-row"><input id="fnPlayerSearch" placeholder="PLAYER ID / NAME"><button id="fnPlayerSearchBtn">SEARCH</button></div><div id="fnPlayersList"></div>';
    const load=async()=>{const q=content().querySelector('#fnPlayerSearch').value.trim();try{const d=await apiAdmin('/admin/players?'+new URLSearchParams({q}));content().querySelector('#fnPlayersList').innerHTML=(d.players||[]).map(x=>`<button class="fn-player-row" data-pid="${x.player_id}"><span>${x.name}</span><small>${x.player_id}</small><b>${Number(x.balance).toLocaleString('ja-JP')}</b></button>`).join('')||'<div class="fn-admin-note">NO PLAYERS</div>';content().querySelectorAll('.fn-player-row').forEach(b=>b.onclick=()=>playerDetail(b.dataset.pid))}catch(e){content().querySelector('#fnPlayersList').textContent='FAILED: '+e.message}};
    content().querySelector('#fnPlayerSearchBtn').onclick=load; content().querySelector('#fnPlayerSearch').onkeydown=e=>{if(e.key==='Enter')load()}; load();
  }
  async function playerDetail(pid){try{const d=await apiAdmin('/admin/player?'+new URLSearchParams({playerId:pid}));content().innerHTML=`<button id="fnBackPlayers">← PLAYERS</button><h3>${d.player.name}</h3><div class="fn-admin-note">${d.player.player_id}<br>BALANCE: ${Number(d.player.balance).toLocaleString('ja-JP')}<br>STATUS: ${d.player.status||'active'}</div><div class="fn-admin-actions"><button id="fnFreeze">${d.player.status==='frozen'?'UNFREEZE':'FREEZE'}</button><button id="fnForceLogout">FORCE LOGOUT</button><button id="fnDeletePlayer" class="danger">DELETE PLAYER</button></div><div class="fn-admin-table">${(d.transactions||[]).map(x=>`<div><span>${new Date(x.created_at).toLocaleString('ja-JP')}</span><b>${x.delta>0?'+':''}${x.delta}</b><small>${x.reason||''}</small></div>`).join('')||'NO TRANSACTIONS'}</div>`;content().querySelector('#fnBackPlayers').onclick=players;content().querySelector('#fnFreeze').onclick=async()=>{try{await apiAdmin('/admin/player/status',{method:'POST',body:JSON.stringify({playerId:pid,status:d.player.status==='frozen'?'active':'frozen'})});playerDetail(pid)}catch(e){alert(e.message)}};content().querySelector('#fnForceLogout').onclick=async()=>{try{await apiAdmin('/admin/player/logout',{method:'POST',body:JSON.stringify({playerId:pid})});content().querySelector('#fnForceLogout').textContent='LOGGED OUT'}catch(e){alert(e.message)}};const del=content().querySelector('#fnDeletePlayer');if(del){del.onclick=async()=>{if(pid==='391x'){alert('391x cannot be deleted');return}if(!confirm('DELETE PLAYER '+d.player.name+'?\nThis permanently removes the account and related social/session data.'))return;try{await apiAdmin('/admin/player/delete',{method:'POST',body:JSON.stringify({playerId:pid})});players()}catch(e){alert('DELETE FAILED: '+(e.message||e))}}}}catch(e){content().innerHTML='FAILED: '+e.message}}
  async function balance(){
    content().innerHTML='<h3>BALANCE CONTROL</h3><label>PLAYER NAME / ID</label><input id="fnAdminPlayer" placeholder="PLAYER NAME or PLAYER ID"><label>AMOUNT</label><input id="fnAdminAmount" type="number" step="1" placeholder="10000"><label>NOTE</label><input id="fnAdminNote" maxlength="120" placeholder="ADMIN GRANT"><div class="fn-admin-presets"><button data-a="1000">+1,000</button><button data-a="10000">+10,000</button><button data-a="50000">+50,000</button><button data-a="-1000">-1,000</button></div><button class="fn-admin-grant" id="fnAdminGrant">APPLY BALANCE</button><div id="fnAdminBalance"></div>';
    content().querySelectorAll('.fn-admin-presets button').forEach(b=>b.onclick=()=>content().querySelector('#fnAdminAmount').value=b.dataset.a);content().querySelector('#fnAdminGrant').onclick=grant;
  }
  async function grant(){const c=content(),playerId=c.querySelector('#fnAdminPlayer').value.trim(),amount=Number(c.querySelector('#fnAdminAmount').value),note=c.querySelector('#fnAdminNote').value.trim();if(!playerId||!Number.isSafeInteger(amount)||amount===0){c.querySelector('#fnAdminBalance').textContent='INVALID INPUT';return}try{const d=await apiAdmin('/admin/grant',{method:'POST',body:JSON.stringify({playerId,amount,note})});c.querySelector('#fnAdminBalance').textContent='SUCCESS • BALANCE '+Number(d.balance).toLocaleString('ja-JP');if(playerId===FN_SERVER_PLAYER_ID){FN_SERVER_BALANCE=Number(d.balance);S.coins=FN_SERVER_BALANCE;localStorage.setItem(KEY,JSON.stringify(S));render()}}catch(e){c.querySelector('#fnAdminBalance').textContent='FAILED: '+e.message}}
  async function items(){content().innerHTML='<h3>ITEM GRANT</h3><label>PLAYER NAME / ID</label><input id="fnItemPlayer" placeholder="PLAYER NAME or PLAYER ID"><label>ITEM</label><select id="fnItemId"><option value="frame:early_access">EARLY ACCESS FRAME</option><option value="frame:gold">GOLD FRAME</option><option value="frame:silver">SILVER FRAME</option><option value="frame:neon">NEON FRAME</option><option value="frame:royal">ROYAL FRAME</option></select><label>NOTE</label><input id="fnItemNote" maxlength="120" placeholder="EARLY ACCESS REWARD"><button class="fn-admin-grant" id="fnItemGrant">GRANT ITEM</button><div id="fnItemStatus"></div>';content().querySelector('#fnItemGrant').onclick=async()=>{const player=content().querySelector('#fnItemPlayer').value.trim(),itemId=content().querySelector('#fnItemId').value;if(!player){content().querySelector('#fnItemStatus').textContent='INVALID PLAYER';return}try{const d=await apiAdmin('/admin/item/grant',{method:'POST',body:JSON.stringify({playerId:player,itemId,note:content().querySelector('#fnItemNote').value.trim()})});content().querySelector('#fnItemStatus').textContent='SUCCESS • '+d.itemId+' → '+d.name}catch(e){content().querySelector('#fnItemStatus').textContent='FAILED: '+(e.message||e)}}}
  async function logs(){try{const d=await apiAdmin('/admin/logs');content().innerHTML='<h3>ADMIN LOGS</h3><pre class="fn-admin-logbox">'+((d.logs||[]).map(x=>new Date(x.created_at).toLocaleString('ja-JP')+'  '+x.target_player_id+'  '+(x.amount>0?'+':'')+x.amount+'  '+x.note).join('\n')||'NO ADMIN LOGS')+'</pre>'}catch(e){content().textContent='FAILED: '+e.message}}
  async function games(){try{const [g,m]=await Promise.all([apiAdmin('/admin/games'),apiAdmin('/admin/stats')]);content().innerHTML='<h3>GAME CONTROL</h3><div class="fn-admin-control danger"><span>GLOBAL MAINTENANCE / EMERGENCY</span><b>'+((m.maintenance)?'ON':'OFF')+'</b><button id="fnGlobalMaint">'+(m.maintenance?'RELEASE ALL':'STOP ALL')+'</button></div><div class="fn-admin-game-list">'+(g.games||[]).map(x=>'<div class="fn-admin-control"><span>'+String(x.game_type).toUpperCase()+'</span><small>ENABLED '+(x.enabled?'YES':'NO')+' • MAINT '+(x.maintenance?'ON':'OFF')+'</small><button data-game-toggle="'+x.game_type+'" data-enabled="'+(x.enabled?0:1)+'">'+(x.enabled?'DISABLE':'ENABLE')+'</button><button data-game-maint="'+x.game_type+'" data-maint="'+(x.maintenance?0:1)+'">'+(x.maintenance?'RELEASE':'MAINTENANCE')+'</button></div>').join('')+'</div><p class="fn-admin-note">Game state is server-authoritative. Poker online room base is Phase 1; the actual multiplayer poker engine is Phase 2.</p>';content().querySelector('#fnGlobalMaint').onclick=()=>toggleMaintenance(!m.maintenance);content().querySelectorAll('[data-game-toggle]').forEach(b=>b.onclick=()=>setGame(b.dataset.game,!!Number(b.dataset.enabled),null));content().querySelectorAll('[data-game-maint]').forEach(b=>b.onclick=()=>setGame(b.dataset.game,null,!!Number(b.dataset.maint)))}catch(e){content().textContent='FAILED: '+e.message}}
  async function setGame(gameType,enabled,maintenance){try{const cur=(await apiAdmin('/admin/games')).games.find(x=>x.game_type===gameType)||{};await apiAdmin('/admin/games',{method:'POST',body:JSON.stringify({gameType,enabled:enabled===null?!!cur.enabled:enabled,maintenance:maintenance===null?!!cur.maintenance:maintenance})});games()}catch(e){content().innerHTML='<div class="fn-admin-error">FAILED: '+(e.message||e)+'</div>'}}
  async function toggleMaintenance(enabled){try{await apiAdmin('/admin/maintenance',{method:'POST',body:JSON.stringify({enabled})});games()}catch(e){content().innerHTML='<div class="fn-admin-error">FAILED: '+e.message+'</div>'}}
  function debugTab(){content().innerHTML='<h3>DEBUG</h3><button id="fnOpenDebug">OPEN DEBUG PANEL</button><button id="fnClearDebug">CLEAR DEBUG LOG</button>';content().querySelector('#fnOpenDebug').onclick=()=>{if(window.__FN_AUTH_ROLE==='admin'&&typeof window.toggleDebug==='function')window.toggleDebug()};content().querySelector('#fnClearDebug').onclick=()=>window.clearDebug?.()}
  async function open(){if(window.__FN_AUTH_ROLE!=='admin'){window.FN_AUTH_LOGIN?.();return}const token=localStorage.getItem('FN_ADMIN_TOKEN')||'';if(!token){window.FN_AUTH_LOGIN?.();return}try{const me=await fnApi('/auth/me',{},token);if(me.role!=='admin')throw new Error('FORBIDDEN');panel().classList.remove('hidden');renderTab()}catch(e){localStorage.removeItem('FN_ADMIN_TOKEN');window.FN_ADMIN_TOKEN='';setAdminButton(false);window.FN_AUTH_LOGIN?.()}}
  async function logout(){const token=localStorage.getItem('FN_ADMIN_TOKEN')||'';try{if(token)await fnApi('/auth/logout',{method:'POST'},token)}catch(_){}localStorage.removeItem('FN_ADMIN_TOKEN');window.FN_ADMIN_TOKEN='';setAdminButton(false);document.getElementById('fnAdminPanel')?.classList.add('hidden');window.FN_AUTH_LOGOUT?.()}
  function setAdminButton(on){const b=document.getElementById('lobbyAdminBtn');if(!b)return;b.style.setProperty('display',on?'flex':'none','important');b.setAttribute('aria-hidden',on?'false':'true');}
  window.FN_ADMIN_OPEN=open;window.FN_ADMIN_LOGIN=()=>window.FN_AUTH_LOGIN?.();window.addEventListener('fn-auth-changed',e=>setAdminButton(e.detail?.role==='admin'));document.addEventListener('DOMContentLoaded',()=>{const b=document.getElementById('lobbyAdminBtn');if(b)b.onclick=open;setAdminButton(window.__FN_AUTH_ROLE==='admin')});
})();

/* ===== SHARED UI ESCAPE ===== */
function esc(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));}

/* ===== REAL APP TITLE / LOBBY SHELL ===== */
(function(){
  const profileKey='gb_profile_v2';
  const defaultProfile={name:'PLAYER',icon:'♠',frame:'classic',language:'ja',sound:true,notifications:true,onlineStatus:true,reducedMotion:false,games:0,wins:0};
  function prof(){try{return Object.assign({},defaultProfile,JSON.parse(localStorage.getItem(profileKey)||'{}'))}catch(e){return Object.assign({},defaultProfile)}}
  function saveProf(x){localStorage.setItem(profileKey,JSON.stringify(x))}
  async function syncProfileSettings(){
    if(typeof window.FN_API_REQUEST!=='function')return;
    const role=window.__FN_AUTH_ROLE||''; if(!role)return;
    const tok=role==='admin'?(localStorage.getItem('FN_ADMIN_TOKEN')||''):(localStorage.getItem('FN_PLAYER_TOKEN')||'');
    try{const d=await window.FN_API_REQUEST('/profile/settings',{},tok); if(d.settings){const x=Object.assign({},prof(),d.settings);saveProf(x);renderProfile();}}catch(_){}
  }
  function showLobby(){document.getElementById('appSplash')?.classList.add('hide');document.getElementById('appLobby')?.classList.remove('hidden');renderProfile();syncProfileSettings()}
  function renderProfile(){const p=prof();const n=document.getElementById('playerName'),a=document.getElementById('avatarText'),m=document.getElementById('profileMeta');if(n)n.textContent=p.name;if(a){a.textContent=p.icon||'♠';a.dataset.frame=p.frame||'classic';}const af=document.getElementById('avatarFrame');if(af){af.hidden=p.frame!=='early_access';af.src='early_access_frame.png';}if(m)m.textContent=p.name+' • LV.'+(Math.floor((p.games||0)/10)+1)}
  async function start(){if(window.__FN_LOADING)return;window.__FN_LOADING=true;const b=document.getElementById('tapStart'),box=document.getElementById('loadBox'),bar=document.getElementById('loadFill'),pct=document.getElementById('loadPct'),txt=document.getElementById('loadText'),detail=document.getElementById('loadDetail');b.disabled=true;b.classList.add('hidden');box.classList.remove('hidden');const assets=['style.css','app.js','click.wav','chip.wav','card.wav','spin.wav','roulette.wav','dice.wav','flip.wav','win.wav','lose.wav','jackpot.wav','crash.wav'];for(let i=0;i<assets.length;i++){txt.textContent=i<3?'INITIALIZING':i<assets.length-2?'LOADING ASSETS':'FINALIZING';detail.textContent='Loading '+assets[i];try{await fetch(assets[i],{cache:'no-store'})}catch(e){try{debugLog('WARN','ASSET LOAD WARNING',{asset:assets[i]})}catch(_){} }const q=Math.round((i+1)/assets.length*100);bar.style.width=q+'%';pct.textContent=q+'%';await new Promise(r=>setTimeout(r,55))}txt.textContent='READY';detail.textContent='GAME RUNTIME ONLINE';await new Promise(r=>setTimeout(r,350));showLobby()}
  async function fnApi(path,opts={}){
    if(typeof window.FN_API_REQUEST!=='function')throw new Error('AUTH_API_NOT_READY');
    let tok=(window.__FN_AUTH_ROLE==='admin' ? (localStorage.getItem('FN_ADMIN_TOKEN')||'') : (localStorage.getItem('FN_PLAYER_TOKEN')||''));
    try{return await window.FN_API_REQUEST(path,opts,tok)}
    catch(e){
      if(Number(e?.status)!==401)throw e;
      const name=localStorage.getItem('FN_LOGIN_NAME')||window.__FN_PROFILE_NAME||'';
      if(!name || name.toLowerCase()==='391x')throw e;
      // Recover a stale/mismatched player session once, then retry the original request.
      if(typeof window.FN_REFRESH_PLAYER_SESSION!=='function')throw e;
      const fresh=await window.FN_REFRESH_PLAYER_SESSION(name);
      if(!fresh?.token)throw e;
      tok=fresh.token;
      return await window.FN_API_REQUEST(path,opts,tok);
    }
  }
  async function openSocial(type){
    const o=document.getElementById('socialOverlay'),p=document.getElementById('socialPanel');
    o.classList.remove('hidden');
    if(type==='profile'){
      const x=prof();
      p.innerHTML='<h2>PROFILE & SETTINGS</h2><label>PLAYER NAME</label><input id="pname" maxlength="16" value="'+esc(x.name)+'" readonly><div class="fn-setting-grid"><label>ICON<select id="picon"><option>♠</option><option>♦</option><option>♣</option><option>♥</option><option>★</option><option>◆</option><option>●</option><option>♛</option></select></label><label>FRAME<select id="pframe"><option value="classic">CLASSIC</option><option value="gold">GOLD</option><option value="silver">SILVER</option><option value="neon">NEON</option><option value="royal">ROYAL</option></select></label><label>LANGUAGE<select id="plang"><option value="ja">日本語</option><option value="en">English</option></select></label></div><label class="fn-check"><input id="psound" type="checkbox"> SOUND</label><label class="fn-check"><input id="pnotify" type="checkbox"> NOTIFICATIONS</label><label class="fn-check"><input id="ponline" type="checkbox"> SHOW ONLINE STATUS</label><label class="fn-check"><input id="pmotion" type="checkbox"> REDUCED MOTION</label><div class="socialActions"><button class="primary" id="saveP">SAVE SETTINGS</button><button id="closeP">CLOSE</button></div><div id="profileStatus"></div>';
      const ownedFrames=Array.isArray(x.ownedFrames)?x.ownedFrames:[];if(ownedFrames.includes('early_access')){const sel=document.getElementById('pframe');const o=document.createElement('option');o.value='early_access';o.textContent='EARLY ACCESS';sel.appendChild(o);}document.getElementById('picon').value=x.icon||'♠';document.getElementById('pframe').value=x.frame||'classic';document.getElementById('plang').value=x.language||'ja';document.getElementById('psound').checked=x.sound!==false;document.getElementById('pnotify').checked=x.notifications!==false;document.getElementById('ponline').checked=x.onlineStatus!==false;document.getElementById('pmotion').checked=!!x.reducedMotion;
      document.getElementById('saveP').onclick=async()=>{x.icon=document.getElementById('picon').value;x.frame=document.getElementById('pframe').value;x.language=document.getElementById('plang').value;x.sound=document.getElementById('psound').checked;x.notifications=document.getElementById('pnotify').checked;x.onlineStatus=document.getElementById('ponline').checked;x.reducedMotion=document.getElementById('pmotion').checked;saveProf(x);renderProfile();try{const tok=(window.__FN_AUTH_ROLE==='admin'?(localStorage.getItem('FN_ADMIN_TOKEN')||''):(localStorage.getItem('FN_PLAYER_TOKEN')||''));await window.FN_API_REQUEST('/profile/settings',{method:'POST',body:JSON.stringify({icon:x.icon,frame:x.frame,language:x.language,sound:x.sound,notifications:x.notifications,onlineStatus:x.onlineStatus,reducedMotion:x.reducedMotion})},tok);document.getElementById('profileStatus').textContent='SAVED TO SERVER'}catch(e){document.getElementById('profileStatus').textContent='LOCAL SAVED • SERVER SYNC FAILED'} };
      document.getElementById('closeP').onclick=()=>o.classList.add('hidden');
    }else if(type==='friends'){
      let friends=[],requests={incoming:[],outgoing:[]};
      try{friends=(await fnApi('/friends/list')).friends||[];requests=await fnApi('/friends/requests')}catch(e){p.innerHTML='<h2>FRIENDS</h2><p>FAILED: '+esc(e.message||e)+'</p><button id="closeF">CLOSE</button>';document.getElementById('closeF').onclick=()=>o.classList.add('hidden');return}
      p.innerHTML='<h2>FRIENDS</h2><label>SEARCH PLAYER</label><div class="socialActions"><input id="friendSearch" maxlength="16" placeholder="PLAYER NAME"><button class="primary" id="searchFriend">SEARCH</button></div><div id="friendSearchStatus"></div><div id="friendSearchResults"></div><h3>FRIEND REQUESTS</h3><div id="friendRequests">'+(requests.incoming||[]).map(r=>'<div class="friend-row"><span>'+esc(r.name)+'</span><button data-rid="'+Number(r.id)+'" data-act="accept">ACCEPT</button><button data-rid="'+Number(r.id)+'" data-act="reject">REJECT</button></div>').join('')+(requests.incoming?.length?'':'<div class="fn-admin-note">NO PENDING REQUESTS</div>')+'</div><h3>FRIEND LIST</h3><div id="friendList">'+(friends.length?friends.map(f=>'<div class="friend-row"><span><i class="fn-presence-dot '+(f.online?'online':'offline')+'"></i>'+esc(f.name)+'</span><small>'+(f.online?'ONLINE':'OFFLINE')+'</small><button data-friend-remove="'+esc(f.player_id)+'">REMOVE</button></div>').join(''):'<div class="fn-admin-note">NO FRIENDS YET</div>')+'</div><div class="socialActions"><button id="closeF">CLOSE</button></div>';
      const search=async()=>{
        const q=document.getElementById('friendSearch').value.trim(),st=document.getElementById('friendSearchStatus'),res=document.getElementById('friendSearchResults');res.innerHTML='';
        if(!q){st.textContent='PLAYER NAMEを入力してください';return} st.textContent='SEARCHING...';
        try{const d=await fnApi('/players/search?'+new URLSearchParams({q})),rows=d.players||[];if(!rows.length){st.textContent='PLAYER NOT FOUND';return}st.textContent=rows.length+' PLAYER FOUND';res.innerHTML=rows.map(x=>'<div class="friend-row"><span>'+esc(x.name)+'</span><button class="primary" data-add-name="'+esc(x.name)+'">ADD FRIEND</button></div>').join('');
          res.querySelectorAll('[data-add-name]').forEach(btn=>btn.onclick=async()=>{const name=btn.getAttribute('data-add-name');btn.disabled=true;try{await fnApi('/friends/request',{method:'POST',body:JSON.stringify({targetName:name})});st.textContent='FRIEND REQUEST SENT: '+name;btn.textContent='SENT'}catch(e){st.textContent='FAILED: '+(e.message||e);btn.disabled=false}})
        }catch(e){st.textContent='SEARCH FAILED: '+(e.message||e)}
      };
      document.getElementById('searchFriend').onclick=search; document.getElementById('friendSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();search()}});
      p.querySelectorAll('[data-rid]').forEach(btn=>btn.onclick=async()=>{try{await fnApi('/friends/respond',{method:'POST',body:JSON.stringify({requestId:Number(btn.dataset.rid),action:btn.dataset.act})});openSocial('friends')}catch(e){alert(e.message)}});
      p.querySelectorAll('[data-friend-remove]').forEach(btn=>btn.onclick=async()=>{if(!confirm('REMOVE FRIEND?'))return;try{await fnApi('/friends/remove',{method:'POST',body:JSON.stringify({friendId:btn.dataset.friendRemove})});openSocial('friends')}catch(e){alert(e.message)}});
      document.getElementById('closeF').onclick=()=>o.classList.add('hidden');
    }else{
      let room=null;try{room=(await fnApi('/rooms/current')).room}catch(e){}
      if(!room){
        p.innerHTML='<h2>PRIVATE ROOM</h2><div class="socialActions"><button class="primary" id="createPokerRoom">CREATE POKER ROOM</button><button id="joinRoomBtn">JOIN ROOM</button><button id="closeR">CLOSE</button></div><div id="roomStatus"></div>';
        document.getElementById('createPokerRoom').onclick=async()=>{try{const d=await fnApi('/rooms/create',{method:'POST',body:JSON.stringify({gameType:'poker'})});renderRoom(d.room)}catch(e){if(e.data?.room){renderRoom(e.data.room)}else document.getElementById('roomStatus').textContent='FAILED: '+(e.message||e)}};
        document.getElementById('joinRoomBtn').onclick=()=>{p.innerHTML='<h2>JOIN ROOM</h2><input id="joinCode" inputmode="numeric" maxlength="4" placeholder="4-DIGIT CODE"><div class="socialActions"><button class="primary" id="joinNow">JOIN</button><button id="backRoom">BACK</button></div><div id="joinStatus"></div>';document.getElementById('joinNow').onclick=async()=>{try{const d=await fnApi('/rooms/join',{method:'POST',body:JSON.stringify({code:document.getElementById('joinCode').value})});renderRoom(d.room)}catch(e){document.getElementById('joinStatus').textContent='FAILED: '+(e.message||e)}};document.getElementById('backRoom').onclick=()=>openSocial('room')};
        document.getElementById('closeR').onclick=()=>o.classList.add('hidden');
      }else renderRoom(room);
    }
  }
  async function renderRoom(room){
    const o=document.getElementById('socialOverlay'),p=document.getElementById('socialPanel');
    if(!room){openSocial('room');return}
    const me=(window.__FN_AUTH_ROLE==='admin'?'391x':(localStorage.getItem('FN_SERVER_PLAYER_ID')||''));
    const host=room.host_player_id===me;
    const allReady=(room.members||[]).every(m=>!!m.ready);
    const minPlayers=room.game_type==='poker'?2:3;
    p.innerHTML='<h2>POKER ROOM</h2><div class="roomCode"><small>ROOM CODE</small><strong>'+esc(room.code)+'</strong></div><div><small>HOST: '+esc(room.members.find(m=>m.player_id===room.host_player_id)?.name||room.host_player_id)+'</small></div><div id="roomPlayers">'+(room.members||[]).map(m=>'<div class="friend-row"><span>'+esc(m.name)+'</span><small>'+ (m.ready?'READY':'WAITING') +'</small></div>').join('')+'</div><div class="socialActions"><button class="primary" id="readyRoom">READY</button>'+(host?'<button id="startRoom">START</button>':'')+'<button id="leaveRoom">LEAVE</button></div><div id="roomStatus" class="fn-admin-note">'+(room.status==='playing'?'ROOM STARTED':((room.members||[]).length+' / '+room.max_players+' PLAYERS • MIN '+minPlayers+(allReady?' • READY':' • WAITING')))+'</div><div id="roomInvites"></div>';
    document.getElementById('readyRoom').onclick=async()=>{try{const d=await fnApi('/rooms/ready',{method:'POST',body:JSON.stringify({ready:true})});renderRoom(d.room)}catch(e){alert(e.message)}};
    if(host)document.getElementById('startRoom').onclick=async()=>{try{const d=await fnApi('/rooms/start',{method:'POST'});renderRoom(d.room)}catch(e){document.getElementById('roomStatus').textContent='START FAILED: '+(e.message||e)}};
    document.getElementById('leaveRoom').onclick=async()=>{try{await fnApi('/rooms/leave',{method:'POST'});openSocial('room')}catch(e){alert(e.message)}};
    const refreshBtn=document.createElement('button');refreshBtn.id='refreshRoom';refreshBtn.textContent='REFRESH';refreshBtn.onclick=()=>openSocial('room');document.querySelector('.socialActions')?.prepend(refreshBtn);
    try{const f=(await fnApi('/friends/list')).friends||[];const inv=document.getElementById('roomInvites');if(host&&f.length){inv.innerHTML='<h3>INVITE FRIEND</h3>'+f.map(x=>'<div class="friend-row"><span>'+esc(x.name)+'</span><button data-invite="'+esc(x.player_id)+'">INVITE</button></div>').join('');inv.querySelectorAll('[data-invite]').forEach(b=>b.onclick=async()=>{try{await fnApi('/rooms/invite',{method:'POST',body:JSON.stringify({targetId:b.dataset.invite})});b.textContent='SENT';b.disabled=true}catch(e){b.textContent='FAILED'}})}}catch(_){ }
    try{const d=await fnApi('/rooms/invites');const invites=d.invites||[];if(invites.length){const box=document.createElement('div');box.className='fn-room-invites';box.innerHTML='<h3>ROOM INVITES</h3>'+invites.map(x=>'<div class="friend-row"><span>'+esc(x.name)+' • '+esc(x.code)+'</span><button data-invite-accept="'+Number(x.id)+'">JOIN</button><button data-invite-reject="'+Number(x.id)+'">REJECT</button></div>').join('');p.appendChild(box);box.querySelectorAll('[data-invite-accept]').forEach(b=>b.onclick=async()=>{try{const d=await fnApi('/rooms/invite/respond',{method:'POST',body:JSON.stringify({inviteId:Number(b.dataset.inviteAccept),action:'accept'})});renderRoom(d.room)}catch(e){alert(e.message)}});box.querySelectorAll('[data-invite-reject]').forEach(b=>b.onclick=async()=>{try{await fnApi('/rooms/invite/respond',{method:'POST',body:JSON.stringify({inviteId:Number(b.dataset.inviteReject),action:'reject'})});openSocial('room')}catch(e){alert(e.message)}})}}catch(_){ }
    if(room.status==='playing'){const box=document.createElement('div');box.className='socialActions';const btn=document.createElement('button');btn.className='primary';btn.textContent='OPEN ONLINE POKER';btn.onclick=async()=>{try{const d=await fnApi('/poker/state');const g=d.game;box.insertAdjacentHTML('afterend','<div class="fn-poker-online"><h3>ONLINE POKER</h3><div>STREET: '+esc(g.street)+'</div><div>POT: '+Number(g.pot).toLocaleString('ja-JP')+'</div><div>TURN: '+Number(g.turnIndex+1)+' / '+g.players.length+'</div><div class="socialActions"><button data-pa="CHECK">CHECK</button><button data-pa="CALL">CALL</button><button data-pa="FOLD">FOLD</button></div><div id="pokerOnlineStatus">SERVER SYNCHRONIZED • RECONNECT READY</div></div>');const wrap=p.querySelector('.fn-poker-online');wrap.querySelectorAll('[data-pa]').forEach(b=>b.onclick=async()=>{try{const a=await fnApi('/poker/action',{method:'POST',body:JSON.stringify({action:b.dataset.pa})});wrap.querySelector('#pokerOnlineStatus').textContent='ACTION '+a.action+' • POT '+a.pot}catch(e){wrap.querySelector('#pokerOnlineStatus').textContent='FAILED: '+(e.message||e)}})}catch(e){alert(e.message||e)}};box.appendChild(btn);p.appendChild(box)}
  }
  document.addEventListener('DOMContentLoaded',()=>{document.getElementById('tapStart')?.addEventListener('click',start);document.getElementById('profileBtn')?.addEventListener('click',()=>openSocial('profile'));document.getElementById('profileCard')?.addEventListener('click',()=>openSocial('profile'));document.getElementById('avatarText')?.addEventListener('click',()=>openSocial('profile'));document.getElementById('avatar')?.addEventListener('click',()=>openSocial('profile'));document.getElementById('avatar')?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openSocial('profile')}});document.getElementById('friendsBtn')?.addEventListener('click',()=>openSocial('friends'));document.getElementById('friendsCard')?.addEventListener('click',()=>openSocial('friends'));document.getElementById('lobbyDebugBtn')?.addEventListener('click',toggleDebug);const rb=document.getElementById('roomBtn');if(rb&&!rb.__fnRoomBound){rb.__fnRoomBound=true;rb.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openSocial('room')},true);rb.addEventListener('touchend',e=>{e.preventDefault();e.stopPropagation();openSocial('room')},{passive:false});}document.querySelectorAll('.lobbyGrid button').forEach(b=>b.addEventListener('click',()=>{const p=prof();p.games=(p.games||0)+1;saveProf(p);renderProfile();document.getElementById('appLobby').classList.add('hidden');openGame(b.dataset.game)}));document.querySelectorAll('#lobbyTabs button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('#lobbyTabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.lobbyGrid button').forEach(g=>g.style.display=b.dataset.cat==='all'||g.dataset.cat===b.dataset.cat?'flex':'none')}));});
})();

(function(){
  function syncEmergency(){
    var body=document.getElementById("debugEmergencyBody");
    if(body)body.textContent=(window.__GB_DEBUG_LINES||[]).join("\n");
  }
  document.addEventListener("DOMContentLoaded",function(){
    var b=document.getElementById("debugEmergency");
    var p=document.getElementById("debugEmergencyPanel");
    if(b)b.addEventListener("click",function(){syncEmergency();if(p)p.classList.remove("hidden");});
  });
})();

document.addEventListener("DOMContentLoaded",function(){
  const lb=document.getElementById("lobbyDebugBtn");
  const panel=document.getElementById("debugPanel");
  if(lb){
    lb.addEventListener("click",function(){
      if(panel)panel.classList.remove("hidden");
      try{
        const body=document.getElementById("debugBody");
        if(body)body.textContent=(window.__GB_DEBUG_LINES||[]).join("\n");
      }catch(e){}
    });
  }
});
