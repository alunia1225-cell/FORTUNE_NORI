(function(){
  'use strict';

  /*
   * FORTUNE NOIR / MAHJONG
   * Local client-only 3-player mahjong adapter using assets from Majiang-master.
   * No network/API calls are made by this module.
   */
  const ROOT = './';
  const AUDIO = './';
  const TILE_TYPES = [
    'm1','m9',
    'p1','p2','p3','p4','p5','p6','p7','p8','p9',
    's1','s2','s3','s4','s5','s6','s7','s8','s9',
    'z1','z2','z3','z4','z5','z6','z7'
  ];
  const HONORS = new Set(['z1','z2','z3','z4','z5','z6','z7']);
  const RED_BASE = {p5:'p0', s5:'s0'};
  const TILE_ORDER = new Map(TILE_TYPES.map((t,i)=>[t,i]));
  const audioCache = Object.create(null);
  let autoTimer = null;

  const state = {
    players: [
      mkPlayer('YOU','東家'),
      mkPlayer('CPU 南','南家'),
      mkPlayer('CPU 西','西家')
    ],
    wall: [], dead: [], dora: [],
    turn: 0, dealer: 0, round:'東1', honba:0, kyotaku:0,
    phase:'lobby', drawn:null, pending:null, selected:null,
    riichiSelect:false, lastDiscard:null, message:'ルーム準備中',
    result:null, cpuCount:2
  };

  function mkPlayer(name,wind){
    return {name,wind,score:35000,hand:[],melds:[],discards:[],nuki:0,riichi:false,ippatsu:false,riichiStick:false};
  }
  function tileFile(t){ return t + '.gif'; }
  function tileImg(t,cls=''){ return `<img class="mj-tile-img ${cls}" src="${ROOT+tileFile(t)}" draggable="false" alt="">`; }
  function backImg(cls=''){ return `<img class="mj-tile-img ${cls}" src="${ROOT}pai.gif" draggable="false" alt="">`; }
  function baseTile(t){return t==='p0'?'p5':t==='s0'?'s5':t;}
  function suit(t){return t[0]}
  function num(t){return (t==='p0'||t==='s0')?5:Number(t.slice(1))}
  function isHonor(t){return HONORS.has(baseTile(t))}
  function tileKey(t){return baseTile(t)}
  function sortHand(a){return a.slice().sort((x,y)=>(TILE_ORDER.get(tileKey(x))??99)-(TILE_ORDER.get(tileKey(y))??99));}
  function counts(tiles){const c=Object.create(null);for(const t of tiles){const b=baseTile(t);c[b]=(c[b]||0)+1}return c}
  function clone(a){return a.map(x=>x)}
  function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
  function sfx(name){try{audioCache[name] ||= new Audio(AUDIO+name+'.wav');audioCache[name].currentTime=0;audioCache[name].play().catch(()=>{})}catch(_){}}

  function buildWall(){
    const w=[];
    for(const t of TILE_TYPES){for(let i=0;i<4;i++)w.push(t)}
    const pi=w.indexOf('p5'); if(pi>=0)w[pi]='p0';
    const si=w.indexOf('s5'); if(si>=0)w[si]='s0';
    return shuffle(w);
  }

  function standardWin(tiles,openMelds=0){
    const all=sortHand(tiles.map(baseTile));
    if(all.length!==14-openMelds*3)return false;
    const c=counts(all);
    const keys=Object.keys(c);
    for(const pair of keys){
      if(c[pair]<2)continue;
      c[pair]-=2;
      if(takeMelds(c)){c[pair]+=2;return true}
      c[pair]+=2;
    }
    return false;
  }
  function takeMelds(c){
    const ks=Object.keys(c).filter(k=>c[k]>0).sort((a,b)=>(TILE_ORDER.get(a)??99)-(TILE_ORDER.get(b)??99));
    if(!ks.length)return true;
    const first=ks[0];
    if(c[first]>=3){c[first]-=3;if(takeMelds(c)){c[first]+=3;return true}c[first]+=3}
    if(!isHonor(first)){
      const n=num(first),s=suit(first); if(n<=7){const a=s+n,b=s+(n+1),d=s+(n+2);if(c[a]>0&&c[b]>0&&c[d]>0){c[a]--;c[b]--;c[d]--;if(takeMelds(c)){c[a]++;c[b]++;c[d]++;return true}c[a]++;c[b]++;c[d]++}}
    }
    return false;
  }
  function chiitoi(tiles){const c=counts(tiles);return tiles.length===14&&Object.values(c).filter(v=>v===2).length===7&&Object.values(c).every(v=>v===2)}
  function kokushi(tiles){
    if(tiles.length!==14)return false;
    const need=['m1','m9','p1','p9','s1','s9','z1','z2','z3','z4','z5','z6','z7'],c=counts(tiles);
    return need.every(t=>(c[t]||0)>=1)&&need.some(t=>(c[t]||0)>=2);
  }
  function isWinning(tiles,openMelds=0){return standardWin(tiles,openMelds)||chiitoi(tiles)||kokushi(tiles)}
  function isTanyao(tiles){return tiles.every(t=>!isHonor(t)&&num(t)>=2&&num(t)<=8)}
  function hasYakuhai(tiles){const c=counts(tiles);return ['z1','z2','z3','z4','z5','z6','z7'].some(t=>(c[t]||0)>=3)}
  function isToitoi(tiles){const c=counts(tiles);let trip=0;for(const n of Object.values(c))if(n>=3)trip++;return trip>=4}
  function yaku(tiles,p,winType){
    const n=[];let han=0;
    if(p.riichi){n.push('リーチ');han++}
    if(winType==='tsumo'){n.push('メンゼンツモ');han++}
    if(isTanyao(tiles)){n.push('タンヤオ');han++}
    if(hasYakuhai(tiles)){n.push('役牌');han++}
    if(isToitoi(tiles)){n.push('トイトイ');han+=2}
    if(chiitoi(tiles)){n.push('チートイツ');han+=2}
    if(kokushi(tiles)){n.push('コクシムソウ');han=13}
    const suits=new Set(tiles.map(t=>isHonor(t)?'z':suit(t))),non=[...suits].filter(x=>x!=='z');
    if(non.length===1&&suits.has('z')){n.push('ホンイツ');han+=3}
    if(non.length===1&&!suits.has('z')){n.push('チンイツ');han+=6}
    const d=tiles.reduce((v,t)=>v+(['p5','s5'].includes(baseTile(t))?1:0),0)+p.nuki;
    if(d){n.push(`ドラ${d}`);han+=d}
    return {names:n,han};
  }
  function canRon(tile,from){
    if(from===0)return false;
    const p=state.players[0]; const hand=p.hand.concat(tile);
    return isWinning(hand,p.melds.length)&&yaku(hand,p,'ron').han>0;
  }
  function canTsumo(){
    const p=state.players[0],h=p.hand.concat(state.drawn||[]);
    return !!state.drawn&&isWinning(h,p.melds.length)&&yaku(h,p,'tsumo').han>0;
  }
  function waitingTiles(hand,p){
    const waits=[];for(const t of TILE_TYPES){const h=hand.concat(t);if(isWinning(h,p.melds.length)&&yaku(h,p,'ron').han>0)waits.push(t)}return waits;
  }
  function canRiichi(){
    const p=state.players[0];if(p.riichi||p.melds.length||p.nuki)return false;
    const h=p.hand.concat(state.drawn||[]);if(h.length!==14)return false;
    for(let i=0;i<h.length;i++){const x=h.slice();x.splice(i,1);if(waitingTiles(x,p).length)return true}
    return false;
  }
  function canAnkan(){
    const p=state.players[0],c=counts(p.hand.concat(state.drawn||[]));return Object.values(c).some(v=>v===4);
  }
  function canOpenKan(t){const p=state.players[0],c=counts(p.hand);return (c[baseTile(t)]||0)>=3}
  function canPon(t){const p=state.players[0],c=counts(p.hand);return (c[baseTile(t)]||0)>=2}
  function legalRiichiDiscardIndices(){
    const p=state.players[0],h=p.hand.concat(state.drawn||[]),out=[];
    for(let i=0;i<h.length;i++){const x=h.slice();x.splice(i,1);if(waitingTiles(x,p).length)out.push(i)}
    return out;
  }
  function clearAuto(){if(autoTimer){clearTimeout(autoTimer);autoTimer=null}}

  function setupDeal(){
    clearAuto(); state.wall=buildWall();state.dead=state.wall.splice(-14);state.dora=[state.dead[4]];
    state.players.forEach((p,i)=>{p.hand=[];p.melds=[];p.discards=[];p.nuki=0;p.riichi=false;p.ippatsu=false;p.riichiStick=false;p.score=35000;p.name=i===0?'YOU':i===1?'CPU 南':'CPU 西'});
    for(let i=0;i<13;i++)for(let s=0;s<3;s++)state.players[s].hand.push(state.wall.pop());
    state.players.forEach(p=>p.hand=sortHand(p.hand));
    state.turn=state.dealer;state.drawn=null;state.pending=null;state.selected=null;state.riichiSelect=false;state.phase='playing';state.result=null;state.message='配牌完了';state.lastDiscard=null;state.kyotaku=0;
    drawForTurn(true);
  }
  function drawForTurn(initial=false){
    clearAuto();
    if(state.wall.length===0){endDraw();return}
    const p=state.players[state.turn]; state.drawn=state.wall.pop();state.selected=null;state.pending=null;
    state.message=`${p.name} ツモ`;render();
    if(state.turn===0){
      playAnim('draw',()=>{
        if(p.riichi){
          if(canTsumo()||canAnkan()) { renderActions(); }
          if(!canTsumo()) autoTimer=setTimeout(()=>{ if(state.phase==='playing'&&state.turn===0&&state.drawn&&!p.riichiSelect){discardDrawn()} }, 900);
        }
      });
    }else autoTimer=setTimeout(cpuTurn,560);
  }
  function cpuTurn(){
    clearAuto();if(state.phase!=='playing')return;const p=state.players[state.turn];
    if(p.riichi){
      const t=state.drawn;p.hand=p.hand.concat(t?[]:[]); // preserve drawn separately
      const all=p.hand.concat(state.drawn||[]);state.drawn=null;p.hand=sortHand(all.slice(0,-1));const discard=all[all.length-1];p.discards.push(discard);state.lastDiscard={seat:state.turn,index:p.discards.length-1};state.message=`${p.name} ツモ切り`;sfx('dahai11');
      resolveCpuDiscard(state.turn,discard);return;
    }
    let all=p.hand.concat(state.drawn||[]);let discard;
    if(all.includes('z4')&&Math.random()<.22){const idx=all.indexOf('z4');all.splice(idx,1);p.nuki++;p.hand=sortHand(all);state.drawn=null;state.message=`${p.name} 北抜き`;sfx('pon');playAnim('nuki',()=>drawForTurn());return}
    const honors=all.filter(isHonor);discard=(honors[0]&&Math.random()<.72)?honors[0]:all[Math.floor(Math.random()*all.length)];
    all.splice(all.indexOf(discard),1);p.hand=sortHand(all);state.drawn=null;p.discards.push(discard);state.lastDiscard={seat:state.turn,index:p.discards.length-1};state.message=`${p.name} 打牌`;sfx('dahai11');
    resolveCpuDiscard(state.turn,discard);
  }
  function resolveCpuDiscard(from,tile){
    playAnim('discard',()=>{
      // Human ron has priority over calls.
      if(canRon(tile,from)){state.pending={type:'response',tile,from,ron:true,pon:canPon(tile),kan:canOpenKan(tile)};state.message='ロンできます';render();return}
      // Human can call PON/KAN.
      const pon=canPon(tile),kan=canOpenKan(tile);if(from!==0&&(pon||kan)){state.pending={type:'response',tile,from,pon,kan};state.message='鳴きの選択';render();return}
      // CPUs may claim a win first.
      for(let i=1;i<3;i++){
        const cp=state.players[i]; if(isWinning(cp.hand.concat(tile),cp.melds.length)&&yaku(cp.hand.concat(tile),cp,'ron').han>0){winCpuRon(i,tile,from);return}
      }
      // CPU automatic calls are intentionally conservative.
      for(let i=1;i<3;i++){
        const cp=state.players[i],c=counts(cp.hand);if((c[baseTile(tile)]||0)>=3&&Math.random()<.12){cpuDaiminkan(i,tile);return}
        if((c[baseTile(tile)]||0)>=2&&Math.random()<.16){cpuPon(i,tile);return}
      }
      state.pending=null;nextTurn();
    });
  }
  function nextTurn(){state.lastDiscard=null;state.turn=(state.turn+1)%3;state.drawn=null;drawForTurn()}
  function discardIndex(idx){
    const p=state.players[0];if(state.phase!=='playing'||state.turn!==0)return;
    if(p.riichi&&!state.riichiSelect)return;
    const all=p.hand.concat(state.drawn||[]);if(idx<0||idx>=all.length)return;
    const t=all[idx];all.splice(idx,1);p.hand=sortHand(all.slice(0,all.length));state.drawn=null;
    p.discards.push(t);state.lastDiscard={seat:0,index:p.discards.length-1};state.selected=null;
    if(state.riichiSelect){p.riichi=true;p.ippatsu=true;p.riichiStick=true;p.riichiSelect=false;state.kyotaku++;state.message='リーチ';sfx('richi')}
    else state.message='打牌';
    sfx('dahai11');render();playAnim('discard',()=>resolveUserDiscard(t));
  }
  function discardDrawn(){
    const p=state.players[0];if(state.phase!=='playing'||state.turn!==0||!state.drawn)return;
    if(canTsumo())return;const t=state.drawn;state.drawn=null;p.discards.push(t);state.lastDiscard={seat:0,index:p.discards.length-1};state.message=p.riichi?'ツモ切り':'打牌';sfx('dahai11');render();playAnim('discard',()=>resolveUserDiscard(t));
  }
  function resolveUserDiscard(tile){
    if(state.pending)return;
    for(let i=1;i<3;i++){const cp=state.players[i];if(isWinning(cp.hand.concat(tile),cp.melds.length)&&yaku(cp.hand.concat(tile),cp,'ron').han>0){winCpuRon(i,tile,0);return}}
    for(let i=1;i<3;i++){const cp=state.players[i],c=counts(cp.hand);if((c[baseTile(tile)]||0)>=3&&Math.random()<.10){cpuDaiminkan(i,tile);return}}
    for(let i=1;i<3;i++){const cp=state.players[i],c=counts(cp.hand);if((c[baseTile(tile)]||0)>=2&&Math.random()<.14){cpuPon(i,tile);return}}
    nextTurn();
  }
  function declareRiichi(){if(!canRiichi())return;state.riichiSelect=true;state.message='リーチする牌を選択';render();}
  function riichiDiscardAny(idx){if(state.riichiSelect)discardIndex(idx)}
  function nuki(){
    const p=state.players[0];if(p.riichi)return;let idx=p.hand.indexOf('z4');
    if(idx<0&&state.drawn==='z4'){state.drawn=null;p.nuki++;state.message='北抜き';sfx('pon');playAnim('nuki',()=>drawForTurn());return}
    if(idx<0)return;p.hand.splice(idx,1);p.nuki++;state.message='北抜き';sfx('pon');render();playAnim('nuki',()=>{state.drawn=null;drawForTurn()});
  }
  function ankan(){
    const p=state.players[0],all=p.hand.concat(state.drawn||[]),c=counts(all),t=Object.keys(c).find(k=>c[k]===4);if(!t)return;
    let removed=0;const keep=[];for(const x of all){if(baseTile(x)===t&&removed<4){removed++;continue}keep.push(x)}
    p.hand=sortHand(keep);p.melds.push({type:'ankan',tiles:[t,t,t,t]});state.drawn=null;state.message='カン';sfx('kan');render();playAnim('discard',()=>drawKang())
  }
  function daiminkan(tile){
    const p=state.players[0],b=baseTile(tile);let need=3,keep=[];for(const x of p.hand){if(baseTile(x)===b&&need){need--;continue}keep.push(x)}
    if(need)return;p.hand=sortHand(keep);state.drawn=null;p.melds.push({type:'daiminkan',tiles:[tile,tile,tile,tile]});state.pending=null;state.message='カン';sfx('kan');render();drawKang();
  }
  function pon(tile){
    const p=state.players[0],b=baseTile(tile);let need=2,keep=[];for(const x of p.hand){if(baseTile(x)===b&&need){need--;continue}keep.push(x)}
    if(need)return;p.hand=sortHand(keep);state.drawn=null;p.melds.push({type:'pon',tiles:[tile,tile,tile]});state.pending=null;state.message='ポン';sfx('pon');render();
  }
  function cpuPon(i,tile){const p=state.players[i],b=baseTile(tile);let need=2,keep=[];for(const x of p.hand){if(baseTile(x)===b&&need){need--;continue}keep.push(x)}if(need)return;p.hand=sortHand(keep);p.melds.push({type:'pon',tiles:[tile,tile,tile]});state.turn=i;state.drawn=null;state.message=`${p.name} ポン`;sfx('pon');render();autoTimer=setTimeout(cpuTurn,520)}
  function cpuDaiminkan(i,tile){const p=state.players[i],b=baseTile(tile);let need=3,keep=[];for(const x of p.hand){if(baseTile(x)===b&&need){need--;continue}keep.push(x)}if(need)return;p.hand=sortHand(keep);p.melds.push({type:'daiminkan',tiles:[tile,tile,tile,tile]});state.turn=i;state.drawn=null;state.message=`${p.name} カン`;sfx('kan');render();drawKang()}
  function drawKang(){if(state.dead.length===0){endDraw();return}state.drawn=state.dead.shift();state.dora=[state.dead[4]||state.dora[0]];state.message='嶺上ツモ';render();if(state.turn===0){if(canTsumo())return; if(state.players[0].riichi)autoTimer=setTimeout(discardDrawn,900)}else autoTimer=setTimeout(cpuTurn,520)}
  function winTsumo(){if(!canTsumo())return;const p=state.players[0],h=p.hand.concat(state.drawn||[]),y=yaku(h,p,'tsumo');finishWin(0,'ツモ',y,Math.min(32000,Math.max(1000,y.han>=13?32000:y.han*2000)))}
  function winRon(){if(!state.pending?.ron||!canRon(state.pending.tile,state.pending.from))return;const p=state.players[0],h=p.hand.concat(state.pending.tile),y=yaku(h,p,'ron');finishWin(0,'ロン',y,Math.min(32000,Math.max(1000,y.han>=13?32000:y.han*2000)),state.pending.from)}
  function winCpuRon(i,tile,from){const p=state.players[i],h=p.hand.concat(tile),y=yaku(h,p,'ron');finishWin(i,'ロン',y,Math.min(32000,Math.max(1000,y.han>=13?32000:y.han*2000)),from)}
  function finishWin(i,type,y,score,from=null){clearAuto();state.phase='result';state.result={winner:i,type,yaku:y.names,han:y.han,score,from};state.message=`${state.players[i].name} ${type}`;if(type==='ツモ')sfx('tsumo');else sfx('ron');render();playAnim('win')}
  function endDraw(){clearAuto();state.phase='result';state.result={type:'流局',yaku:[],han:0,score:0};state.message='流局';render()}

  function render(){
    const el=document.getElementById('fnMahjongRoot');if(!el)return;
    const r=el.querySelector('#mjRound'),w=el.querySelector('#mjWallCount'),k=el.querySelector('#mjKyotaku'),d=el.querySelector('#mjDoraTile');
    if(r)r.textContent=`${state.round}局 ${state.honba}本場`;if(w)w.textContent=`${state.wall.length}`;if(k)k.textContent=`リーチ棒 ${state.kyotaku}`;if(d)d.innerHTML=tileImg(state.dora[0]||'z5');const stack=el.querySelector('#mjStickStack');if(stack)stack.innerHTML=Array.from({length:Math.max(0,state.kyotaku)},()=>'<span class=\"mj-riichi-stick\"></span>').join('');
    state.players.forEach((p,i)=>{const n=el.querySelector(`#mjName${i}`),s=el.querySelector(`#mjScore${i}`),rh=el.querySelector(`#mjRiichi${i}`);if(n)n.textContent=p.name;if(s)s.textContent=p.score.toLocaleString();if(rh)rh.hidden=!p.riichiStick});
    renderOpponents(el);renderRivers(el);renderHand(el);renderMelds(el);renderActions(el);
    const msg=el.querySelector('#mjMessage');if(msg)msg.textContent=state.message;
    if(state.phase==='result')renderResult(el);else{const rr=el.querySelector('#mjResult');if(rr)rr.hidden=true}
  }
  function renderOpponents(el){
    [1,2].forEach(i=>{const box=el.querySelector(`#mjHand${i}`);if(!box)return;box.innerHTML='';for(let n=0;n<state.players[i].hand.length;n++)box.insertAdjacentHTML('beforeend',backImg('opponent-tile'));});
  }
  function renderHand(el){
    const box=el.querySelector('#mjHandSelf');if(!box)return;box.innerHTML='';const p=state.players[0];
    p.hand.forEach((t,idx)=>{const b=document.createElement('button');b.type='button';b.className='mj-hand-tile';b.dataset.index=String(idx);b.innerHTML=tileImg(t);if(state.riichiSelect&&legalRiichiDiscardIndices().includes(idx))b.classList.add('riichi-choice');b.addEventListener('click',()=>{if(state.phase!=='playing'||state.turn!==0)return;if(state.riichiSelect){riichiDiscardAny(idx);return}if(p.riichi)return;if(state.drawn===null&&p.melds.length===0){discardIndex(idx);return}discardIndex(idx)});box.appendChild(b)});
    if(state.drawn){const gap=document.createElement('span');gap.className='mj-drawn-gap';box.appendChild(gap);const b=document.createElement('button');b.type='button';b.className='mj-hand-tile mj-drawn-tile';b.innerHTML=tileImg(state.drawn);b.addEventListener('click',()=>{if(state.riichiSelect){const all=p.hand.concat(state.drawn);riichiDiscardAny(all.length-1);return}if(!p.riichi)discardDrawn()});box.appendChild(b)}
  }
  function renderMelds(el){
    const p=state.players[0],box=el.querySelector('#mjMeldsSelf');if(!box)return;box.innerHTML='';for(const m of p.melds){const w=document.createElement('span');w.className='mj-meld';w.innerHTML=m.tiles.map(t=>tileImg(t)).join('');box.appendChild(w)}
    [1,2].forEach(i=>{const b=el.querySelector(`#mjMelds${i}`);if(!b)return;b.innerHTML='';for(const m of state.players[i].melds){const w=document.createElement('span');w.className='mj-meld';w.innerHTML=m.tiles.map(t=>tileImg(t)).join('');b.appendChild(w)}})
  }
  function renderRivers(el){
    [[0,'mjRiverSelf'],[1,'mjRiverSouth'],[2,'mjRiverWest']].forEach(([i,id])=>{const box=el.querySelector('#'+id);if(!box)return;box.innerHTML='';state.players[i].discards.forEach((t,n)=>{const d=document.createElement('span');d.className='mj-discard-tile';if(state.lastDiscard&&state.lastDiscard.seat===i&&state.lastDiscard.index===n)d.classList.add('last');d.innerHTML=tileImg(t);box.appendChild(d)})})
  }
  function renderActions(el){
    const a=el.querySelector('#mjActions');if(!a)return;a.innerHTML='';const p=state.players[0];
    if(state.phase!=='playing'){a.hidden=true;return}
    a.hidden=state.turn!==0;
    if(state.turn!==0)return;
    const add=(label,fn,cls='')=>{const b=document.createElement('button');b.type='button';b.className='mj-action '+cls;b.textContent=label;b.addEventListener('click',fn);a.appendChild(b)};
    if(state.pending?.type==='response'){
      if(state.pending.ron&&canRon(state.pending.tile,state.pending.from))add('ロン',winRon,'gold');
      if(!p.riichi&&state.pending.pon)add('ポン',()=>pon(state.pending.tile),'gold');
      if(!p.riichi&&state.pending.kan)add('カン',()=>daiminkan(state.pending.tile),'dark');
      return;
    }
    if(p.riichi){
      if(canTsumo())add('ツモ',winTsumo,'gold');
      if(canAnkan())add('カン',ankan,'dark');
      if(state.drawn&&!canTsumo())el.querySelector('#mjStatusAuto')?.removeAttribute('hidden');
      return;
    }
    if(canTsumo())add('ツモ',winTsumo,'gold');
    if(canRiichi())add('リーチ',declareRiichi,'gold');
    if(p.hand.includes('z4')||state.drawn==='z4')add('北抜き',nuki,'dark');
    if(canAnkan())add('カン',ankan,'dark');
  }
  function renderResult(el){const r=state.result||{},box=el.querySelector('#mjResult');if(!box)return;box.hidden=false;el.querySelector('#mjResultTitle').textContent=r.type||'';el.querySelector('#mjResultSub').textContent=r.yaku?.join(' ・ ')||'牌局終了';el.querySelector('#mjResultScore').textContent=r.score?`${r.score.toLocaleString()}点`:'-'}
  function playAnim(type,done){const r=document.getElementById('fnMahjongRoot');if(!r){done&&done();return}r.classList.remove('draw-anim','discard-anim','nuki-anim','win-anim');void r.offsetWidth;r.classList.add(type+'-anim');setTimeout(()=>{r.classList.remove(type+'-anim');done&&done()},280)}
  function nextHand(){setupDeal();render()}

  function template(){
    return `<div id="fnMahjongRoot" class="fn-mahjong-root">
      <div class="mj-landscape-warning"><div><b>MAHJONG</b><span>横画面でプレイしてください</span></div></div>
      <div class="mj-topbar"><div><b>MAHJONG</b><span>FORTUNE NOIR / SANMA</span></div><div class="mj-top-info"><span id="mjRound">東1局 0本場</span><span>残り <strong id="mjWallCount">0</strong></span><span id="mjKyotaku">リーチ棒 0</span></div><button class="mj-close" id="mjClose" type="button">×</button></div>
      <div class="mj-table">
        <div class="mj-seat mj-seat-south"><div class="mj-player-label"><b id="mjName1">CPU 南</b><span id="mjScore1">35,000</span><i id="mjRiichi1" class="riichi-mini" hidden>RIICHI</i></div><div id="mjHand1" class="mj-opponent-hand"></div><div id="mjMelds1" class="mj-melds"></div><div id="mjRiverSouth" class="mj-river mj-river-top"></div></div>
        <div class="mj-seat mj-seat-west"><div class="mj-player-label"><b id="mjName2">CPU 西</b><span id="mjScore2">35,000</span><i id="mjRiichi2" class="riichi-mini" hidden>RIICHI</i></div><div id="mjHand2" class="mj-opponent-hand vertical"></div><div id="mjMelds2" class="mj-melds vertical-melds"></div><div id="mjRiverWest" class="mj-river mj-river-left"></div></div>
        <div class="mj-center">
          <div class="mj-center-round" id="mjRoundCenter">東1局 0本場</div>
          <div class="mj-center-meta"><span>残り <b id="mjWallCenter">0</b></span><span>親 YOU</span></div>
          <div class="mj-dora"><small>ドラ</small><span id="mjDoraTile"></span></div>
          <div id="mjStickStack" class="mj-stick-stack"></div>
        </div>
        <div class="mj-seat mj-seat-self"><div class="mj-player-label"><b id="mjName0">YOU</b><span id="mjScore0">35,000</span><i id="mjRiichi0" class="riichi-mini" hidden>RIICHI</i></div><div id="mjRiverSelf" class="mj-river mj-river-self"></div><div id="mjMeldsSelf" class="mj-melds self-melds"></div><div class="mj-hand-wrap"><div id="mjHandSelf" class="mj-hand"></div></div><div id="mjActions" class="mj-actions"></div></div>
        <div class="mj-status"><span id="mjMessage">配牌完了</span><small id="mjStatusAuto" hidden>ツモ切り中</small></div>
      </div>
      <div id="mjResult" class="mj-result" hidden><div class="mj-result-card"><small>GAME RESULT</small><h2 id="mjResultTitle">ツモ</h2><p id="mjResultSub">-</p><strong id="mjResultScore">-</strong><button id="mjNextHand" type="button">次局</button></div></div>
    </div>`
  }
  function start(){
    document.body.classList.add('fn-mahjong-active');const modal=document.getElementById('modal');modal.classList.remove('hidden');modal.querySelector('.tabletop').classList.add('fn-mahjong-modal');modal.querySelector('#modalContent').innerHTML=template();state.token++;setupDeal();
    document.getElementById('mjClose').addEventListener('click',()=>stop(true));document.getElementById('mjNextHand').addEventListener('click',nextHand);render();
  }
  function stop(closeModal){clearAuto();document.body.classList.remove('fn-mahjong-active');const modal=document.getElementById('modal');modal.querySelector('.tabletop').classList.remove('fn-mahjong-modal');if(closeModal)window.closeGame()}
  window.FN_MAHJONG_START=start;window.FN_MAHJONG_STOP=()=>stop(false);
})();
