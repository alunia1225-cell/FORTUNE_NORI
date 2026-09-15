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
  function sfx(name){return; /* voice/audio intentionally disabled for this client-only table */}

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
    const c=counts(all),keys=Object.keys(c);
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
  function chiitoi(tiles){const c=counts(tiles);return tiles.length===14&&Object.keys(c).length===7&&Object.values(c).every(v=>v===2)}
  function kokushi(tiles){
    if(tiles.length!==14)return false;
    const need=['m1','m9','p1','p9','s1','s9','z1','z2','z3','z4','z5','z6','z7'],c=counts(tiles);
    return need.every(t=>(c[t]||0)>=1)&&need.some(t=>(c[t]||0)>=2);
  }
  function isWinning(tiles,openMelds=0){return standardWin(tiles,openMelds)||chiitoi(tiles)||kokushi(tiles)}
  function allTiles(p,winTiles){
    const a=[];
    (p.melds||[]).forEach(m=>m.tiles.forEach(t=>a.push(baseTile(t))));
    winTiles.forEach(t=>a.push(baseTile(t)));
    return a;
  }
  function groupsFor(tiles, melds){
    const c=counts(tiles.map(baseTile)),out=[];
    for(const m of (melds||[])){
      const mt=m.tiles.map(baseTile); out.push({type:m.type==='ankan'?'kan':m.type==='pon'?'pon':'kan',tiles:mt,open:m.type!=='ankan'});
    }
    function rec(x,pair,groups){
      const keys=Object.keys(x).filter(k=>x[k]>0).sort((a,b)=>(TILE_ORDER.get(a)??99)-(TILE_ORDER.get(b)??99));
      if(!keys.length){if(pair)return groups.concat([{type:'pair',tiles:[pair,pair]}]);return groups}
      const k=keys[0];
      if(!pair&&x[k]>=2){x[k]-=2;const r=rec(x,k,groups);x[k]+=2;if(r)return r}
      if(x[k]>=3){x[k]-=3;const r=rec(x,pair,groups.concat([{type:'triplet',tiles:[k,k,k]}]));x[k]+=3;if(r)return r}
      if(!isHonor(k)){
        const n=num(k),s=suit(k),a=s+n,b=s+(n+1),d=s+(n+2);
        if(n<=7&&x[a]>0&&x[b]>0&&x[d]>0){x[a]--;x[b]--;x[d]--;const r=rec(x,pair,groups.concat([{type:'sequence',tiles:[a,b,d]}]));x[a]++;x[b]++;x[d]++;if(r)return r}
      }
      return null;
    }
    const r=rec(c,null,[]); return r||[];
  }
  function terminalsHonors(tiles){return tiles.some(t=>isHonor(t)||num(t)===1||num(t)===9)}
  function hasOnlySuit(tiles,s){return tiles.every(t=>isHonor(t)||suit(t)===s)}
  function hasNoHonors(tiles){return tiles.every(t=>!isHonor(t))}
  function isPinfu(tiles, melds){
    if((melds||[]).length)return false;
    const g=groupsFor(tiles,[]), seq=g.filter(x=>x.type==='sequence'), pair=g.find(x=>x.type==='pair');
    if(seq.length!==4||!pair)return false;
    const b=pair.tiles[0]; if(isHonor(b))return false;
    return true;
  }
  function sequenceCounts(tiles){
    const c=counts(tiles),out={};
    for(const s of ['m','p','s'])for(let n=1;n<=7;n++)if(c[`${s}${n}`]&&c[`${s}${n+1}`]&&c[`${s}${n+2}`])out[`${s}${n}`]=(out[`${s}${n}`]||0)+1;
    return out;
  }
  function yaku(tiles,p,winType){
    const hand=tiles.map(baseTile), melds=p.melds||[], full=allTiles(p,hand), n=[], add=(name,han)=>{n.push(name);return han};
    let han=0;
    const closed=melds.length===0;
    const g=groupsFor(hand,melds), sets=g.filter(x=>x.type!=='pair'), pair=g.find(x=>x.type==='pair');
    const c=counts(full), suits=new Set(full.map(t=>isHonor(t)?'z':suit(t))), non=[...suits].filter(x=>x!=='z');

    if(p.riichi){n.push('リーチ');han++}
    if(p.ippatsu&&p.riichi&&winType){n.push('一発');han++}
    if(winType==='tsumo'&&closed){n.push('門前清自摸和');han++}

    if(kokushi(hand)){n.push('国士無双');return {names:n,han:13}}
    if(chiitoi(hand)){n.push('七対子');han+=2}

    if(isTanyao(full)){n.push('断么九');han++}
    if(hasYakuhai(full)){n.push('役牌');han++}
    if(isPinfu(hand,melds)){n.push('平和');han++}

    if(sets.length){
      const trip=sets.filter(x=>x.type==='triplet'||x.type==='pon').length;
      const kans=sets.filter(x=>x.type==='kan').length;
      if(trip===4){n.push('対々和');han+=2}
      if(trip>=3&&sets.filter(x=>x.type==='triplet').length>=3){n.push('三暗刻');han+=2}
      if(kans===3){n.push('三槓子');han+=2}
      const seqs=sets.filter(x=>x.type==='sequence').map(x=>x.tiles.join(','));
      if(seqs.length>=2&&new Set(seqs).size<seqs.length&&closed){n.push('一盃口');han++}
      if(seqs.length>=4&&seqs.filter(x=>seqs.filter(y=>y===x).length>=2).length>=2&&closed){n.push('二盃口');han+=3}
      const byNum={}; for(const q of sets.filter(x=>x.type==='sequence')){const z=num(q.tiles[0]);byNum[z]=(byNum[z]||new Set());byNum[z].add(suit(q.tiles[0]))}
      if(Object.values(byNum).some(v=>v.size===3)){n.push('三色同順');han+=closed?2:1}
      const runs=sets.filter(x=>x.type==='sequence');
      if(['m','p','s'].some(s=>runs.some(x=>x.tiles[0]===s+'1')&&runs.some(x=>x.tiles[0]===s+'4')&&runs.some(x=>x.tiles[0]===s+'7'))){n.push('一気通貫');han+=closed?2:1}
    }

    const hasYao=terminalsHonors(full);
    const allSetsTerm=sets.length>0&&sets.every(x=>x.type==='triplet'||x.type==='pon'||x.type==='kan'? (isHonor(x.tiles[0])||num(x.tiles[0])===1||num(x.tiles[0])===9) : terminalsHonors(x.tiles));
    const hasSequence=sets.some(x=>x.type==='sequence');
    if(hasYao&&allSetsTerm&&!hasSequence){n.push('混老頭');han+=2}
    if(hasYao&&!hasNoHonors(full)&&hasSequence){n.push('混全帯么九');han+=closed?2:1}
    if(hasYao&&hasNoHonors(full)&&hasSequence){n.push('純全帯么九');han+=closed?3:2}
    if(non.length===1&&suits.has('z')){n.push('混一色');han+=closed?3:2}
    if(non.length===1&&!suits.has('z')){n.push('清一色');han+=closed?6:5}

    const dragons=['z5','z6','z7'].filter(t=>(c[t]||0)>=3).length;
    const winds=['z1','z2','z3','z4'].filter(t=>(c[t]||0)>=3).length;
    if(dragons===3){n.push('大三元');han=13}
    else if(dragons===2&&pair&&['z5','z6','z7'].includes(pair.tiles[0])){n.push('小三元');han+=2}
    if(winds===4){n.push('大四喜');han=13}
    else if(winds===3&&pair&&['z1','z2','z3','z4'].includes(pair.tiles[0])){n.push('小四喜');han=13}
    if(full.every(isHonor)){n.push('字一色');han=13}
    if(full.every(t=>!isHonor(t)&&[1,9].includes(num(t)))){n.push('清老頭');han=13}
    if((melds.length+sets.filter(x=>x.type==='kan').length)>=4&&sets.filter(x=>x.type==='kan').length===4){n.push('四槓子');han=13}
    if(winType==='tsumo'&&state.lastDiscard===null&&state.message==='嶺上ツモ'){n.push('嶺上開花');han++}
    if(winType==='ron'&&state.message==='槍槓'){n.push('槍槓');han++}
    if(winType==='tsumo'&&state.wall.length===0){n.push('海底撈月');han++}
    if(winType==='ron'&&state.wall.length===0){n.push('河底撈魚');han++}

    const quads=sets.filter(x=>x.type==='kan').length;
    const dragonTrip=dragons;
    if(closed&&full.length===14&&!n.includes('七対子')&&!n.includes('国士無双')){
      const suitCounts={m:0,p:0,s:0,z:0};full.forEach(t=>suitCounts[suit(t)]++);
      if(suitCounts.m===14||suitCounts.p===14||suitCounts.s===14){const cc=counts(full);if((cc.m1||0)>=3&&(cc.m9||0)>=3){}}
    }
    const dora=doraCount(full);
    if(dora){n.push(`ドラ${dora}`);han+=dora}
    return {names:n,han};
  }
  function canRon(tile,from){
    if(from===0)return false;
    const p=state.players[0],hand=p.hand.concat(tile);
    return isWinning(hand,p.melds.length)&&yaku(hand,p,'ron').han>0;
  }
  function canTsumo(){
    const p=state.players[0],h=p.hand.concat(state.drawn||[]);
    return !!state.drawn&&isWinning(h,p.melds.length)&&yaku(h,p,'tsumo').han>0;
  }
  function waitingTiles(hand,p){
    const waits=[];
    for(const t of TILE_TYPES){
      const h=hand.concat(t);
      if(isWinning(h,p.melds.length))waits.push(t);
    }
    return waits;
  }
  function canRiichi(){
    const p=state.players[0];if(p.riichi||p.melds.length||p.nuki)return false;
    const h=p.hand.concat(state.drawn||[]);if(h.length!==14)return false;
    return h.some((_,i)=>{const x=h.slice();x.splice(i,1);return waitingTiles(x,p).length>0});
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
  // Majiang-style Japanese scoring core, adapted to this client-only SANMA table.
  // Fu is calculated from the actual winning shape; payments use standard 100-point rounding.
  function nextDora(ind){
    const t=baseTile(ind); if(!t)return null;
    if(t[0]==='z') return 'z'+({1:2,2:3,3:4,4:1,5:6,6:7,7:5}[num(t)]||5);
    const n=num(t); return t[0]+(n===9?1:n+1);
  }
  function doraCount(full){
    let n=0; for(const ind of state.dora||[]){const d=nextDora(ind);if(d)n+=full.filter(t=>baseTile(t)===d).length}
    n+=(full.filter(t=>t==='p0'||t==='s0').length);
    return n+(state.players[0]?.nuki||0);
  }
  function isClosedHand(p){return !(p.melds||[]).some(m=>m.type!=='ankan')}
  function winningGroups(p,hand){return groupsFor(hand,p.melds||[])}
  function calcFu(p,hand,winType){
    if(chiitoi(hand))return 25;
    const g=winningGroups(p,hand), pair=g.find(x=>x.type==='pair'), closed=isClosedHand(p);
    if(isPinfu(hand,p.melds||[])&&winType==='tsumo')return 20;
    let fu=20;
    if(winType==='tsumo')fu+=2;
    if(winType==='ron'&&closed)fu+=10;
    if(pair){const b=pair.tiles[0];if(isHonor(b))fu+=([`z1`,`z2`,`z3`,`z4`].includes(b)?2:2)}
    const seatWind='z'+({東家:1,南家:2,西家:3}[p.wind]||1),roundWind='z'+(state.round==='東1'?1:state.round==='南1'?2:state.round==='西1'?3:4);
    if(pair&&(pair.tiles[0]===seatWind||pair.tiles[0]===roundWind))fu+=2;
    for(const x of g){if(x.type==='triplet'||x.type==='pon'||x.type==='kan'){
      const b=x.tiles[0],term=isHonor(b)||num(b)===1||num(b)===9, open=x.open;
      if(x.type==='kan')fu+=open?(term?16:8):(term?32:16);
      else fu+=open?(term?4:2):(term?8:4);
    }}
    if(fu===20&&winType==='ron'&&!closed)fu=30;
    return Math.ceil(fu/10)*10;
  }
  function limitBase(han,fu){
    if(han>=13)return 8000;
    if(han>=11)return 6000;
    if(han>=8)return 4000;
    if(han>=6)return 3000;
    if(han===5||han>=4&&fu>=40||han>=3&&fu>=70)return 2000;
    return Math.min(2000,fu*Math.pow(2,han+2));
  }
  function ceil100(x){return Math.ceil(x/100)*100}
  function calcScore(p,y,winType,from){
    const hand=p.hand.concat(winType==='tsumo'?(state.drawn||[]):(state.pending?.tile||''));
    const fu=calcFu(p,hand,winType),base=limitBase(y.han,fu);
    let points;
    if(winType==='ron') points=ceil100(base*(p.wind==='東家'?6:4));
    else if(p.wind==='東家') points=ceil100(base*2)*2; // two opponents each pay the dealer amount
    else points=ceil100(base*2)+ceil100(base); // dealer + non-dealer
    points=Math.max(100,points);
    return {fu,base,points};
  }
  function winTsumo(){if(!canTsumo())return;const p=state.players[0],h=p.hand.concat(state.drawn||[]),y=yaku(h,p,'tsumo'),sc=calcScore(p,y,'tsumo');finishWin(0,'ツモ',y,sc.points,null,sc)}
  function winRon(){if(!state.pending?.ron||!canRon(state.pending.tile,state.pending.from))return;const p=state.players[0],h=p.hand.concat(state.pending.tile),y=yaku(h,p,'ron'),sc=calcScore(p,y,'ron',state.pending.from);finishWin(0,'ロン',y,sc.points,state.pending.from,sc)}
  function winCpuRon(i,tile,from){const p=state.players[i],h=p.hand.concat(tile),y=yaku(h,p,'ron'),sc=calcScore(p,y,'ron',from);finishWin(i,'ロン',y,sc.points,from,sc)}
  function finishWin(i,type,y,score,from=null,sc=null){
    clearAuto();
    // Settle points immediately. This keeps the table state authoritative on the client
    // while preserving the three-player SANMA payment pattern.
    const honba=state.honba||0, kyotaku=state.kyotaku||0, w=state.players[i];
    if(type==='ロン'&&from!=null){
      const pay=score+honba*300; state.players[from].score-=pay; w.score+=pay+kyotaku*1000;
    } else if(type==='ツモ'){
      if(w.wind==='東家'){
        for(let j=0;j<3;j++)if(j!==i){const pay=score+honba*100;state.players[j].score-=pay;w.score+=pay}
      } else {
        for(let j=0;j<3;j++)if(j!==i){const basePay=state.players[j].wind==='東家'?Math.ceil((sc?.base||score/2)*2/100)*100:Math.ceil((sc?.base||score/2)/100)*100;const pay=basePay+honba*100;state.players[j].score-=pay;w.score+=pay}
      }
      w.score+=kyotaku*1000;
    }
    state.kyotaku=0;
    state.phase='result';state.result={winner:i,type,yaku:y.names,han:y.han,fu:sc?.fu||0,score,from};state.message=`${state.players[i].name} ${type}`;if(type==='ツモ')sfx('tsumo');else sfx('ron');render();playAnim('win')
  }
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
    // state.drawn is shared for the active seat; never render a CPU draw inside YOUR hand.
    if(state.turn===0 && state.drawn){const gap=document.createElement('span');gap.className='mj-drawn-gap';box.appendChild(gap);const b=document.createElement('button');b.type='button';b.className='mj-hand-tile mj-drawn-tile';b.innerHTML=tileImg(state.drawn);b.addEventListener('click',()=>{if(state.riichiSelect){const all=p.hand.concat(state.drawn);riichiDiscardAny(all.length-1);return}if(!p.riichi)discardDrawn()});box.appendChild(b)}
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
  function renderResult(el){const r=state.result||{},box=el.querySelector('#mjResult');if(!box)return;box.hidden=false;el.querySelector('#mjResultTitle').textContent=r.type||'';el.querySelector('#mjResultSub').textContent=(r.yaku?.join(' ・ ')||'牌局終了')+(r.fu?` / ${r.han}翻 ${r.fu}符`:r.han?` / ${r.han}翻`:'');el.querySelector('#mjResultScore').textContent=r.score?`${r.score.toLocaleString()}点`:'-'}
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
