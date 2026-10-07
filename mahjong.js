(()=>{
'use strict';

/* FORTUNE NOIR / Mahjong
 * Four-player riichi mahjong.  Rules are modeled on Mahjong Soul's ranked-game rule family.
 * This file is self-contained so the existing FORTUNE NOIR page needs no external library.
 */

const SUITS=['m','p','s'];
const WINDS=['東','南','西','北'];
const TYPES=[];
for(const s of SUITS)for(let n=1;n<=9;n++)TYPES.push(s+n);
for(let n=1;n<=7;n++)TYPES.push('z'+n);
const RED={m0:'m5',p0:'p5',s0:'s5'};
const REDS=new Set(Object.keys(RED));
const LABEL={
 m1:'一萬',m2:'二萬',m3:'三萬',m4:'四萬',m5:'五萬',m6:'六萬',m7:'七萬',m8:'八萬',m9:'九萬',m0:'赤五萬',
 p1:'一筒',p2:'二筒',p3:'三筒',p4:'四筒',p5:'五筒',p6:'六筒',p7:'七筒',p8:'八筒',p9:'九筒',p0:'赤五筒',
 s1:'一索',s2:'二索',s3:'三索',s4:'四索',s5:'五索',s6:'六索',s7:'七索',s8:'八索',s9:'九索',s0:'赤五索',
 z1:'東',z2:'南',z3:'西',z4:'北',z5:'白',z6:'發',z7:'中'
};
const RULES=Object.freeze({
 startPoints:25000,returnPoints:25000,firstRequiredPoints:30000,
 uma:[15,5,-5,-15],riichiCost:1000,honbaRon:300,honbaTsumo:100,notenTotal:3000,
 kuitan:true,atozuke:true,red:[1,1,1],multipleRon:true,nagashiMangan:true,abortiveDraws:true,
 tobi:true,maxKan:4,maxRound:11,riichiMinWall:4
});
const $=(root,sel)=>root.querySelector(sel);
const tileBase=t=>RED[t]||t;
const idOf=t=>{const b=tileBase(t);if(b[0]==='z')return 27+(+b[1]-1);return (b[0]==='m'?0:b[0]==='p'?9:18)+(+b[1]-1)};
const tileOf=id=>id<9?`m${id+1}`:id<18?`p${id-8}`:id<27?`s${id-17}`:`z${id-26}`;
const isHonor=t=>tileBase(t)[0]==='z';
const isTerminal=t=>!isHonor(t)&&(['1','9'].includes(tileBase(t)[1]));
const isSimple=t=>!isHonor(t)&&!isTerminal(t);
const isYao=t=>isHonor(t)||isTerminal(t);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Math.round(Number(n)||0).toLocaleString('ja-JP');
const uniq=a=>[...new Set(a)];
const waitKey=a=>uniq(a.map(tileBase)).sort((a,b)=>idOf(a)-idOf(b)).join(',');
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function counts(tiles){const c=new Array(34).fill(0);for(const t of tiles){const id=idOf(t);if(id>=0&&id<34)c[id]++}return c}
function sortTiles(tiles){return [...tiles].sort((a,b)=>idOf(a)-idOf(b)||(REDS.has(a)?1:0)-(REDS.has(b)?1:0))}
function doraNext(t){const id=idOf(t);if(id<27){const suit=Math.floor(id/9),n=id%9;return tileOf(suit*9+(n===8?0:n+1))}if(id<31)return tileOf(27+((id-27+1)%4));if(id<34)return tileOf(31+((id-31+1)%3));return t}
function imageTile(t,cls='',extra=''){return `<img class="fnm-tile ${cls}" src="./assets/images/${t}.gif" alt="${esc(LABEL[t]||t)}" draggable="false" ${extra}>`}
function backTile(cls=''){return `<span class="fnm-back ${cls}" aria-hidden="true"></span>`}
function removeTiles(hand,targets){const src=hand.slice();for(const wanted of targets){const i=src.findIndex(x=>tileBase(x)===tileBase(wanted));if(i<0)return null;src.splice(i,1)}return src}
function takeMatching(hand,target,n){const out=[];for(const t of hand)if(tileBase(t)===tileBase(target)){out.push(t);if(out.length===n)break}return out}
function calledSlot(seat,from){const d=(from-seat+4)%4;return d===3?0:d===2?1:2}

function decomposeStandard(tiles,needSets=4){
  const out=[],c=counts(tiles);
  function walk(cc,sets,pair){
    const i=cc.findIndex(v=>v>0);
    if(i<0){if(sets.length===needSets&&pair!==null)out.push({pair,sets:sets.map(x=>x.slice())});return;}
    if(pair===null&&cc[i]>=2){cc[i]-=2;walk(cc,sets,i);cc[i]+=2}
    if(sets.length>=needSets)return;
    if(cc[i]>=3){cc[i]-=3;walk(cc,[...sets,[i,i,i]],pair);cc[i]+=3}
    if(i<27&&i%9<=6&&cc[i+1]&&cc[i+2]){cc[i]--;cc[i+1]--;cc[i+2]--;walk(cc,[...sets,[i,i+1,i+2]],pair);cc[i]++;cc[i+1]++;cc[i+2]++}
  }
  walk(c,[],null);return out;
}
function isChiitoi(tiles){const c=counts(tiles);let p=0;for(const v of c){if(v===2)p++;else if(v!==0)return false}return tiles.length===14&&p===7}
function isKokushi(tiles){if(tiles.length!==14)return false;const ya=[0,8,9,17,18,26,27,28,29,30,31,32,33],c=counts(tiles);let types=0,dup=false;for(const id of ya){if(c[id])types++;if(c[id]>=2)dup=true}return types===13&&dup}
function meldTileCount(melds){return melds.reduce((n,m)=>n+m.tiles.length,0)}
function completeConcealed(tiles,melds){
  const meldTiles=meldTileCount(melds);
  const kans=melds.filter(m=>m.type==='ankan'||m.type==='daiminkan'||m.type==='kakan').length;
  const needTiles=14+kans-meldTiles,needSets=4-melds.length;
  if(tiles.length!==needTiles||needSets<0)return {ok:false};
  if(!melds.length&&(isChiitoi(tiles)||isKokushi(tiles)))return {ok:true,special:isChiitoi(tiles)?'chiitoi':'kokushi'};
  const comps=decomposeStandard(tiles,needSets);return comps.length?{ok:true,comps}:{ok:false};
}
function waitsFor(player){
  const waits=[];
  const kans=player.melds.filter(m=>m.type==='ankan'||m.type==='daiminkan'||m.type==='kakan').length;
  const need=13+kans-meldTileCount(player.melds);
  if(player.hand.length!==need)return waits;
  for(const t of TYPES)if(completeConcealed([...player.hand,t],player.melds).ok)waits.push(t);
  if(waits.length===1&&counts(player.hand)[idOf(waits[0])]===4)return [];
  return waits;
}
function isTenpai(p){return waitsFor(p).length>0}
function handWithWin(p,win,tsumo){return [...p.hand,...(!tsumo&&win?[win]:[]),...p.melds.flatMap(m=>m.tiles)]}
function closedHand(p){return p.melds.every(m=>m.type==='ankan')}
function groupHasYao(ids){return ids.some(id=>id>=27||id%9===0||id%9===8)}
function sequence(ids){return ids.length===3&&ids[0]<27&&ids[1]===ids[0]+1&&ids[2]===ids[0]+2}
function triplet(ids){return ids.length>=3&&ids.every(id=>id===ids[0])}
function groupContainsWin(g,winId){return g.includes(winId)}
function waitType(comp,winId){
  if(comp.pair===winId)return 'tanki';
  for(const s of comp.sets){
    if(!sequence(s)||!groupContainsWin(s,winId))continue;
    const pos=s.indexOf(winId);
    if(pos===1)return 'kanchan';
    if(pos===0)return s[0]%9===0?'penchan':'ryanmen';
    return s[2]%9===8?'penchan':'ryanmen';
  }
  return 'shanpon';
}
function regularGroups(player,comp){
  const groups=[];
  for(const m of player.melds)groups.push({ids:m.tiles.map(idOf),source:'meld',meld:m});
  for(const s of comp.sets)groups.push({ids:s.slice(),source:'concealed',meld:null});
  return groups;
}
function concealedTriplet(group,player,winId,tsumo){
  if(group.meld?.type==='ankan')return true;
  if(group.source!=='concealed')return false;
  return !!tsumo||!group.ids.includes(winId);
}
function windIds(){return [27,28,29,30]}
function roleName(id,p){if(id>=31)return '役牌';const seat=27+p.wind,round=27+p.roundWind;if(id===seat&&id===round)return '役牌（連風牌）';if(id===seat)return '役牌（自風）';if(id===round)return '役牌（場風）';return null}

function evaluateYaku(p,win,ctx,comp){
  const all=handWithWin(p,win,!!ctx.tsumo),ids=all.map(idOf),c=counts(all),g=comp?regularGroups(p,comp):[];
  const y=[],add=(name,han)=>y.push({name,han}),yak=[];const isClosed=closedHand(p);
  const winId=idOf(win);
  if(ctx.kokushi){yak.push({name:ctx.kokushi13?'国士無双十三面':'国士無双',multiplier:ctx.kokushi13?2:1});return {yaku:yak,han:13*yak.reduce((s,x)=>s+x.multiplier,0),yakuman:yak.reduce((s,x)=>s+x.multiplier,0)};}
  if(ctx.chiitoi)add('七対子',2);
  if(RULES.kuitan&&ids.every(t=>isSimple(tileOf(t))))add('断么九',1);
  if(p.riichi)add(p.doubleRiichi?'ダブル立直':'立直',p.doubleRiichi?2:1);
  if(p.ippatsu&&p.riichi)add('一発',1);
  if(ctx.tsumo&&isClosed)add('門前清自摸和',1);
  if(ctx.haitei)add('海底摸月',1);
  if(ctx.houtei)add('河底撈魚',1);
  if(ctx.rinshan)add('嶺上開花',1);
  if(ctx.chankan)add('槍槓',1);
  if(!ctx.chiitoi){
    for(const id of uniq([31,32,33,27+p.wind,27+p.roundWind]))if(id<34&&c[id]>=3){const han=(id===27+p.wind&&id===27+p.roundWind)?2:1;const n=roleName(id,p)||'役牌';add(n,han)}
  }
  if(ctx.chiitoi){
    const suits=new Set(ids.map(id=>id>=27?'z':Math.floor(id/9)));
    if(ids.every(id=>id>=27||id%9===0||id%9===8))add('混老頭',2);
    if(suits.size===2&&suits.has('z'))add('混一色',isClosed?3:2);
    if(suits.size===1&&!suits.has('z'))add('清一色',isClosed?6:5);
  }
  if(g.length){
    const seqs=g.filter(x=>sequence(x.ids)),trips=g.filter(x=>triplet(x.ids));
    const pair=comp.pair;
    if(seqs.length===4&&trips.length===0&&isClosed&&![31,32,33,27+p.wind,27+p.roundWind].includes(pair)&&waitType(comp,winId)==='ryanmen')add('平和',1);
    const seqKeys={};for(const q of seqs){const s=Math.floor(q.ids[0]/9),n=q.ids[0]%9+1,k=`${s}:${n}`;seqKeys[k]=(seqKeys[k]||0)+1}
    const dupPairs=Object.values(seqKeys).filter(v=>v>=2).length;
    if(isClosed&&dupPairs>=2)add('二盃口',3);else if(isClosed&&dupPairs>=1)add('一盃口',1);
    if(seqs.length<4&&trips.length===4)add('対々和',2);
    const dark=trips.filter(x=>concealedTriplet(x,p,winId,!!ctx.tsumo)).length;
    if(dark>=3)add('三暗刻',2);
    const kans=p.melds.filter(m=>m.type==='ankan'||m.type==='daiminkan'||m.type==='kakan').length;
    if(kans>=3)add('三槓子',2);
    const d=[31,32,33].filter(id=>c[id]>=3);const w=windIds().filter(id=>c[id]>=3);
    if(d.length===2&&d.every(id=>c[id]>=3)&&[31,32,33].some(id=>c[id]===2))add('小三元',2);
    if(d.length===3)yak.push({name:'大三元',multiplier:1});
    if(w.length===4)yak.push({name:'大四喜',multiplier:2});else if(w.length===3&&w.some(id=>c[id]===2))yak.push({name:'小四喜',multiplier:1});
    const allYao=ids.every(t=>t>=27||t%9===0||t%9===8),hasHonors=ids.some(t=>t>=27);
    if(allYao&&hasHonors) add('混老頭',2);
    if(allYao&&!hasHonors)yak.push({name:'清老頭',multiplier:1});
    if(ids.every(t=>t>=27))yak.push({name:'字一色',multiplier:1});
    if(ids.every(t=>[19,20,21,23,25,32].includes(t)))yak.push({name:'緑一色',multiplier:1});
    if(kans>=4)yak.push({name:'四槓子',multiplier:1});
    if(dark===4&&isClosed){yak.push({name:waitType(comp,winId)==='tanki'?'四暗刻単騎':'四暗刻',multiplier:waitType(comp,winId)==='tanki'?2:1});}
    const suitSet=new Set(ids.map(id=>id>=27?'z':Math.floor(id/9)));
    const numeral=[...suitSet].filter(x=>x!=='z');
    if(numeral.length===1&&suitSet.has('z'))add('混一色',isClosed?3:2);
    else if(numeral.length===1&&!suitSet.has('z'))add('清一色',isClosed?6:5);
    for(let s=0;s<3;s++){const need=[s*9,s*9+3,s*9+6];if(need.every(x=>seqs.some(q=>q.ids[0]===x)))add('一気通貫',isClosed?2:1)}
    for(let n=0;n<=6;n++){if([0,1,2].every(s=>seqs.some(q=>q.ids[0]===s*9+n)))add('三色同順',isClosed?2:1);}
    for(let n=0;n<9;n++){if([0,1,2].every(s=>trips.some(q=>q.ids[0]===s*9+n)))add('三色同刻',2)}
    const allGroups=g.map(x=>x.ids);
    const hasSeq=seqs.length>0;
    const groupYao=allGroups.every(set=>groupHasYao(set))&& (pair>=27||pair%9===0||pair%9===8);
    const hasHonor=ids.some(id=>id>=27);
    if(groupYao&&hasSeq)add(hasHonor?'混全帯么九':'純全帯么九',isClosed?(hasHonor?2:3):(hasHonor?1:2));
    // Special hands / other yakuman
    if(ids.length===14&&isClosed){
      const suitOnly=new Set(ids.map(id=>Math.floor(id/9)));
      if(suitOnly.size===1){
        const base=[...suitOnly][0]*9,need=[3,1,1,1,1,1,1,1,3],after=c.slice();
        if(ids.every(id=>id>=base&&id<=base+8)&&need.every((n,i)=>after[base+i]>=n)){
          const tmp=after.slice();tmp[winId]--;
          let pure=true;for(let i=0;i<34;i++){const want=(i>=base&&i<base+9)?need[i-base]:0;if(tmp[i]!==want){pure=false;break}}
          yak.push({name:pure?'純正九蓮宝燈':'九蓮宝燈',multiplier:pure?2:1});
        }
      }
    }
  }
  if(ctx.tenhou)yak.push({name:'天和',multiplier:1});
  if(ctx.chihou)yak.push({name:'地和',multiplier:1});
  if(yak.length){return {yaku:yak.map(x=>({name:x.name,han:13*x.multiplier,yakuman:x.multiplier})),han:13*yak.reduce((s,x)=>s+x.multiplier,0),yakuman:yak.reduce((s,x)=>s+x.multiplier,0)};}
  const dora=countDora(all,ctx.doraIndicators||[]),ura=p.riichi?countDora(all,ctx.uraIndicators||[]):0,red=all.filter(t=>REDS.has(t)).length;
  if(dora)add('ドラ',dora);if(ura)add('裏ドラ',ura);if(red)add('赤ドラ',red);
  return {yaku:y,han:y.reduce((s,x)=>s+x.han,0),yakuman:0};
}
function countDora(tiles,indicators){const vals=new Set(indicators.map(doraNext).map(tileBase));return tiles.reduce((n,t)=>n+(vals.has(tileBase(t))?1:0),0)}
function fuFor(p,win,ctx,comp,yaku){
  if(yaku.some(x=>x.name==='七対子'))return 25;
  let fu=20;const closed=closedHand(p);
  if(ctx.tsumo&&!yaku.some(x=>x.name==='平和'))fu+=2;
  if(!ctx.tsumo&&closed)fu+=10;
  const pair=comp?.pair;
  if(pair!=null){if(pair>=31)fu+=2;if(pair===27+p.wind)fu+=2;if(pair===27+p.roundWind)fu+=2}
  const winId=idOf(win);
  for(const group of regularGroups(p,comp||{sets:[]}).filter(x=>triplet(x.ids))){
    const yao=group.ids[0]>=27||group.ids[0]%9===0||group.ids[0]%9===8;
    if(group.source==='concealed'){const closedTrip=ctx.tsumo||!group.ids.includes(winId);fu+=closedTrip?(yao?8:4):(yao?4:2)}
    else if(group.meld?.type==='ankan'){fu+=yao?32:16}
    else if(group.meld?.type==='pon'){fu+=yao?4:2}
    else if(group.meld?.type==='kakan'||group.meld?.type==='daiminkan'){fu+=yao?16:8}
  }
  if(comp){const wt=waitType(comp,winId);if(['tanki','kanchan','penchan'].includes(wt))fu+=2}
  if(yaku.some(x=>x.name==='平和')&&ctx.tsumo)fu=20;
  if(!ctx.tsumo&&fu===20&&!closed)fu=30;
  return Math.ceil(fu/10)*10;
}
function limitBase(han,fu){
  if(han>=13)return {base:8000,limit:'役満'};
  if(han>=11)return {base:6000,limit:'三倍満'};
  if(han>=8)return {base:4000,limit:'倍満'};
  if(han>=6)return {base:3000,limit:'跳満'};
  if(han>=5)return {base:2000,limit:'満貫'};
  const raw=fu*Math.pow(2,han+2);return {base:Math.min(2000,raw),limit:raw>2000?'満貫':''};
}
function calcWin(p,win,ctx){
  const concealed=[...p.hand,...(!ctx.tsumo&&win?[win]:[])],shape=completeConcealed(concealed,p.melds);
  if(!shape.ok)return {valid:false,reason:'形が完成していません'};
  const variants=[];
  if(!p.melds.length&&isChiitoi(concealed))variants.push({chiitoi:true});
  if(!p.melds.length&&isKokushi(concealed)){const c=counts(concealed),w=idOf(win),ya=[0,8,9,17,18,26,27,28,29,30,31,32,33],kokushi13=c[w]===2&&ya.every(id=>c[id]===(id===w?2:1));variants.push({kokushi:true,kokushi13})}
  if(shape.comps)for(const comp of shape.comps)variants.push({comp});
  let best=null;
  for(const v of variants){
    const e=evaluateYaku(p,win,{...ctx,chiitoi:!!v.chiitoi,kokushi:!!v.kokushi,kokushi13:!!v.kokushi13},v.comp||null);
    const trueYaku=e.yaku.filter(y=>!['ドラ','裏ドラ','赤ドラ'].includes(y.name));
    if(!trueYaku.length)continue;
    const fu=v.chiitoi?25:v.kokushi?0:fuFor(p,win,ctx,v.comp,e.yaku);
    const bp=e.yakuman?{base:8000*e.yakuman,limit:e.yakuman===1?'役満':`${e.yakuman}倍役満`}:limitBase(e.han,fu);
    const paoSeat=e.yakuman?(e.yaku.some(y=>y.name==='大三元')?p.paoDaisangen:e.yaku.some(y=>y.name==='大四喜')?p.paoDaisuushii:null):null;
    const paoYakuman=paoSeat!=null?e.yaku.filter(y=>['大三元','大四喜'].includes(y.name)).reduce((n,y)=>n+(y.yakuman||1),0):0;
    const score={valid:true,yaku:e.yaku,han:e.han,fu,base:bp.base,limit:bp.limit,yakuman:e.yakuman||0,pao:paoSeat,paoYakuman};
    if(!best||score.yakuman>best.yakuman||(score.yakuman===best.yakuman&&(score.han>best.han||(score.han===best.han&&score.base>best.base))))best=score;
  }
  return best||{valid:false,reason:'役がありません'};
}
function legalPon(p,t){return !p.riichi&&takeMatching(p.hand,t,2).length===2}
function legalDaiminkan(p,t){return !p.riichi&&takeMatching(p.hand,t,3).length===3}
function chiOptions(hand,discard){
  const b=tileBase(discard);if(isHonor(b))return [];const n=+b[1],s=b[0],out=[];
  const c=counts(hand);
  const add=(a,bn)=>{if(c[idOf(a)]>0&&c[idOf(bn)]>0)out.push([a,bn])};
  if(n>=3)add(`${s}${n-2}`,`${s}${n-1}`);
  if(n>=2&&n<=8)add(`${s}${n-1}`,`${s}${n+1}`);
  if(n<=7)add(`${s}${n+1}`,`${s}${n+2}`);
  return out;
}


/* ---- AI hand efficiency ------------------------------------------------- */
function standardShanten(tiles,meldCount=0){
  const c=counts(tiles);let best=8;
  function dfs(i,m,t,pair){
    while(i<34&&c[i]===0)i++;
    if(i>=34){
      const mm=Math.min(4,m+meldCount),tt=Math.min(t,4-mm);
      best=Math.min(best,8-2*mm-tt-(pair?1:0));
      return;
    }
    // Skip this tile entirely.
    c[i]--;dfs(i,m,t,pair);c[i]++;
    // Complete triplet.
    if(c[i]>=2){c[i]-=2;dfs(i,m+1,t,pair);c[i]+=2}
    // Complete sequence.
    if(i<27&&i%9<=6&&c[i+1]>0&&c[i+2]>0){
      c[i]--;c[i+1]--;c[i+2]--;dfs(i,m+1,t,pair);c[i]++;c[i+1]++;c[i+2]++;
    }
    // Pair as head.
    if(!pair&&c[i]>=2){c[i]-=2;dfs(i,m,t,1);c[i]+=2}
    // Incomplete pair (taatsu).
    if(c[i]>=2){c[i]-=2;dfs(i,m,t+1,pair);c[i]+=2}
    // Ryanmen / kanchan taatsu.
    if(i<27&&i%9<=7&&c[i+1]>0){c[i]--;c[i+1]--;dfs(i,m,t+1,pair);c[i]++;c[i+1]++}
    if(i<27&&i%9<=6&&c[i+2]>0){c[i]--;c[i+2]--;dfs(i,m,t+1,pair);c[i]++;c[i+2]++}
  }
  dfs(0,0,0,0);return best;
}
function chiitoiShanten(tiles){
  if(tiles.length<1)return 6;
  const c=counts(tiles),pairs=c.filter(v=>v>=2).length,distinct=c.filter(v=>v>0).length;
  return 6-pairs+Math.max(0,7-distinct);
}
function kokushiShanten(tiles){
  const ya=[0,8,9,17,18,26,27,28,29,30,31,32,33],c=counts(tiles);
  let unique=0,pair=0;for(const id of ya){if(c[id]>0)unique++;if(c[id]>=2)pair=1}
  return 13-unique-pair;
}
function playerShanten(p,hand=p.hand){
  let n=standardShanten(hand,p.melds?.length||0);
  if(!(p.melds?.length)){
    n=Math.min(n,chiitoiShanten(hand),kokushiShanten(hand));
  }
  return n;
}
function aiKnownCounts(game,p){
  const c=new Array(34).fill(0);
  for(const t of p.hand)c[idOf(t)]++;
  for(const m of p.melds)for(const t of m.tiles)c[idOf(t)]++;
  for(const q of game.players){
    for(const r of q.river)c[idOf(r.tile)]++;
    for(const m of q.melds)if(q!==p)for(const t of m.tiles)c[idOf(t)]++;
  }
  for(const t of game.doraIndicators)c[idOf(t)]++;
  return c;
}
function aiUkeire(game,p,hand=p.hand){
  const now=playerShanten(p,hand);if(now<0)return 0;
  const known=aiKnownCounts(game,{...p,hand});let total=0;
  for(const t of TYPES){
    const id=idOf(t),remain=4-known[id];
    if(remain<=0)continue;
    const next=playerShanten({...p,hand:[...hand,t]},[...hand,t]);
    if(next<now)total+=remain;
  }
  return total;
}
function aiYakuPotential(game,p){
  const waits=waitsFor(p);if(!waits.length)return {valid:false,han:0};
  let best=0;
  for(const t of waits){
    const drawP={...p,hand:sortTiles([...p.hand,t]),lastDraw:t};
    const w=calcWin(drawP,t,{
      tsumo:true,seatWind:p.wind,roundWind:p.roundWind,
      doraIndicators:game.doraIndicators,uraIndicators:game.uraIndicators,
      rinshan:false,haitei:false
    });
    if(w.valid)best=Math.max(best,w.han||0);
  }
  return {valid:best>0,han:best};
}
function aiRiichiDanger(game,p,tile){
  const b=tileBase(tile),id=idOf(b);
  for(const q of game.players){
    if(q===p||!q.riichi)continue;
    if(q.river.some(r=>tileBase(r.tile)===b))return 0;
    // Simple suji protection for riichi defense.
    if(id<27){
      const n=id%9+1,s=Math.floor(id/9);
      const SUJI={1:[4,7],2:[5,8],3:[6,9],4:[1,7],5:[2,8],6:[3,9],7:[1,4],8:[2,5],9:[3,6]};
      const pairs=SUJI[n];
      const saw=pairs.some(x=>x>=1&&x<=9&&q.river.some(r=>{
        const ri=idOf(tileBase(r.tile));return ri<27&&Math.floor(ri/9)===s&&(ri%9+1)===x;
      }));
      if(saw)return 0.2;
    }
  }
  return 1;
}
function aiTileShape(hand,tile){
  const id=idOf(tile),c=counts(hand),n=id<27?id%9+1:-1,s=id<27?Math.floor(id/9):-1;
  if(id>=27)return c[id]>=2?3:0;
  let v=0;if(c[id]>=2)v+=3;
  if(n>1&&c[s*9+n-2])v+=2;if(n<9&&c[s*9+n])v+=2;
  if(n>2&&c[s*9+n-3])v+=1;if(n<8&&c[s*9+n+1])v+=1;
  return v;
}
function aiBestDiscard(game,p){
  const hand=p.hand.slice();
  const base=playerShanten(p,hand);let best=null;
  for(const tile of hand){
    if(p.forbidden.includes(tileBase(tile)))continue;
    const next=removeTiles(hand,[tile]);if(!next)continue;
    const q={...p,hand:sortTiles(next)};
    const sh=playerShanten(q),uke=aiUkeire(game,q,q.hand);
    const danger=aiRiichiDanger(game,p,tile);
    const dora=countDora(q.hand,game.doraIndicators)+(REDS.has(tile)?0:0);
    const shape=aiTileShape(hand,tile);
    const terminalHonor=isYao(tile)?1:0;
    // Primary target: shanten -> acceptance. Then keep value/shape; defend against riichi when possible.
    let score=sh*10000-uke*18-dora*45-shape*7;
    if(game.players.some(q=>q.riichi&&q!==p))score+=danger*700+(danger<0.5? -300:0);
    if(terminalHonor&&base<=1)score+=80;
    if(best===null||score<best.score)best={tile,score,sh,uke};
  }
  return best||{tile:hand[hand.length-1],score:0,sh:base,uke:0};
}
function aiOpenYakuPaths(game,p){
  const ids=[...p.hand,...p.melds.flatMap(m=>m.tiles)].map(idOf);
  const c=counts([...p.hand,...p.melds.flatMap(m=>m.tiles)]);
  const paths=[];
  const numerals=ids.filter(id=>id<27);
  const suits=new Set(numerals.map(id=>Math.floor(id/9)));
  const hasHonor=ids.some(id=>id>=27);
  const allSimple=ids.length>0&&ids.every(id=>id<27&&id%9>=1&&id%9<=7);
  if(RULES.kuitan&&allSimple)paths.push('tanyao');
  if(numerals.length&&suits.size===1&&hasHonor)paths.push('honitsu');
  if(numerals.length&&suits.size===1&&!hasHonor)paths.push('chinitsu');
  const valued=[31,32,33,27+p.wind,27+p.roundWind];
  const valueHonor=valued.some(id=>c[id]>=3);
  if(valueHonor)paths.push('yakuhai');
  let trip=0,seq=0;
  const cc=c.slice();
  for(let i=0;i<34;i++){
    if(cc[i]>=3)trip++;
  }
  for(let base=0;base<27;base++){
    if(base%9<=6&&cc[base]&&cc[base+1]&&cc[base+2])seq++;
  }
  if(trip>=2&&trip>seq)paths.push('toitoi-route');
  if(ids.length&&ids.every(id=>id>=27||id%9===0||id%9===8))paths.push('honroutou');
  return {paths,strong:paths.some(x=>['yakuhai','honitsu','chinitsu','toitoi-route','honroutou'].includes(x))};
}

function aiCallEvaluation(game,p,type,used,called){
  const rest=removeTiles(p.hand,used);if(!rest)return {accept:false,score:-Infinity};
  const from=game.lastActor;
  const meld={type,tiles:[...used,called],from,calledAt:calledSlot(p.seat,from),calledTile:called};
  const sim={...p,hand:sortTiles(rest),melds:[...p.melds,meld],called:true};
  const baseSh=playerShanten(p),baseUke=aiUkeire(game,p,p.hand);
  const path=aiOpenYakuPaths(game,sim);
  const doraCall=countDora([called],game.doraIndicators);
  let best=null;
  for(const discard of sim.hand){
    const h=removeTiles(sim.hand,[discard]);if(!h)continue;
    const q={...sim,hand:sortTiles(h)};
    const sh=playerShanten(q),uke=aiUkeire(game,q,q.hand),yp=aiYakuPotential(game,q);
    const dora=countDora(q.hand,game.doraIndicators),danger=aiRiichiDanger(game,p,discard);
    const nextPath=aiOpenYakuPaths(game,q);
    // Treat hand progress as the primary objective. Value routes and ukeire break close ties;
    // opening a hand without a credible yaku route is strongly penalized.
    let score=sh*10000-uke*42-(yp.valid?yp.han*700:0)-dora*55-danger*220;
    if(nextPath.strong)score-=240;
    if(!nextPath.paths.length)score+=1800;
    if(type==='chi')score+=260;
    if(sh>baseSh)score+=1800;
    if(uke<baseUke)score+=400;
    if(best===null||score<best.score)best={score,sh,uke,yp,discard,q,nextPath};
  }
  if(!best)return {accept:false,score:-Infinity};

  const hasYakuRoute=best.yp.valid||best.nextPath.paths.length>0;
  const improving=best.sh<baseSh||best.uke>=baseUke+3;
  const valueCall=path.strong||doraCall>0||best.yp.han>=2;
  const safeEnough=!game.players.some(q=>q!==p&&q.riichi) || aiRiichiDanger(game,p,best.discard)<=0.2 || best.sh<=1;
  let accept=hasYakuRoute&&best.sh<=baseSh&&(improving||valueCall)&&safeEnough;
  // A chi is the easiest call to overuse, so require a concrete open-hand route.
  if(type==='chi')accept=accept&&path.paths.some(x=>['tanyao','honitsu','chinitsu'].includes(x))&&best.sh<baseSh||
    (accept&&path.paths.includes('toitoi-route')&&best.uke>=baseUke+4);
  // A pon is only taken when it creates a value route or materially improves the hand.
  if(type==='pon')accept=accept&&(path.strong||doraCall>0||best.sh<baseSh&&best.uke>=baseUke+2);
  if(type==='pon'&&isHonor(called)&&[31,32,33,27+p.wind,27+p.roundWind].includes(idOf(called)))accept=true;
  return {...best,accept,path,baseSh,baseUke};
}
function discardLeavesTenpai(p,tile){const h=p.hand.slice(),i=h.findIndex(x=>x===tile);if(i<0)return false;h.splice(i,1);return waitsFor({...p,hand:h}).length>0}
function canRiichiTile(p,tile,game){
  if(p.riichi||!closedHand(p)||p.score<1000||game.wall.length<RULES.riichiMinWall)return false;
  return discardLeavesTenpai(p,tile);
}
function riichiWaitsAfterDiscard(p,tile){
  const h=removeTiles(p.hand,[tile]);
  if(!h)return [];
  return waitsFor({...p,hand:sortTiles(h)});
}
function formatWaits(waits){
  return waits.map(t=>LABEL[t]||t).join('・');
}
const MAHJONG_AUDIO_POOL=Object.create(null);
const MAHJONG_AUDIO_TIMERS=new Set();
let MAHJONG_AUDIO_UNLOCKED=false;
function mahjongAudioPool(name){
  if(MAHJONG_AUDIO_POOL[name])return MAHJONG_AUDIO_POOL[name];
  const file=`./assets/audio/${name}.wav`;
  const pool=[];
  for(let i=0;i<3;i++){
    try{const a=new Audio(file);a.preload='auto';a.volume=.72;pool.push(a)}catch(_){}
  }
  MAHJONG_AUDIO_POOL[name]=pool;
  return pool;
}
function unlockMahjongAudio(){
  // iOS/Safari: do NOT call play() for every sound during the first gesture.
  // Doing so causes the entire sound bank to be heard at game start.
  // Only create/preload the pools here; the actual game action owns playback.
  if(MAHJONG_AUDIO_UNLOCKED)return;
  try{if(typeof S!=='undefined'&&!S.sound)return}catch(_){ }
  MAHJONG_AUDIO_UNLOCKED=true;
  for(const name of ['dahai11','pon','chii','kan','richi','ron','tsumo','puchun']){
    const pool=mahjongAudioPool(name);
    for(const a of pool){try{a.load()}catch(_){} }
  }
}
function cancelMahjongAudioTimers(){
  for(const id of MAHJONG_AUDIO_TIMERS)clearTimeout(id);
  MAHJONG_AUDIO_TIMERS.clear();
}
function mahjongAudioLater(name,delay=0){
  const id=setTimeout(()=>{
    MAHJONG_AUDIO_TIMERS.delete(id);
    mahjongAudio(name);
  },Math.max(0,Number(delay)||0));
  MAHJONG_AUDIO_TIMERS.add(id);
  return id;
}

function mahjongAudio(name){
  try{if(typeof S!=='undefined'&&!S.sound)return false}catch(_){}
  const pool=mahjongAudioPool(name);
  const a=pool.find(x=>x.paused||x.ended)||pool[0];
  if(!a)return false;
  try{a.currentTime=0}catch(_){}
  try{const p=a.play();if(p&&typeof p.catch==='function')p.catch(()=>{});return true}catch(_){return false}
}
function waitImages(waits){
  return waits.map(t=>imageTile(t,'fnm-wait-tile')).join('');
}

// Furiten is a restriction on Ron, not on tenpai itself.
// Permanent furiten: at least one of the player's current winning tile types
// is already in that player's river. Temporary/riichi furiten blocks Ron on
// every wait until the corresponding state is cleared.
function furitenStatus(player, waits){
  const bases=new Set((waits||[]).map(tileBase));
  const riverFuriten=player.river.some(r=>bases.has(tileBase(r.tile)));
  const temporary=!!player.temporaryFuriten;
  const riichi=!!player.riichiFuriten;
  return {
    furiten:riverFuriten||temporary||riichi,
    river:riverFuriten,
    temporary,
    riichi
  };
}
function furitenLabel(status){
  return status?.furiten ? '<b class="fnm-furiten-label">フリテン</b>' : '';
}
function kanPreservesWaits(game,seat,target){
  const p=game.players[seat];if(!p.riichi)return true;
  const before=waitsFor(p);
  const reduced=p.hand.slice();let removed=0;for(let i=reduced.length-1;i>=0;i--)if(tileBase(reduced[i])===tileBase(target)){reduced.splice(i,1);if(++removed===4)break}
  if(removed!==4||!before.length)return false;
  // After ankan, the player's concealed tile count rises by one after rinshan draw.
  reduced.push(game.rinshan[0]);
  for(const t of uniq(reduced.map(tileBase))){const h=reduced.slice(),i=h.findIndex(x=>tileBase(x)===t);if(i<0)continue;h.splice(i,1);const w=waitsFor({...p,hand:h,melds:[...p.melds,{type:'ankan',tiles:takeMatching(p.hand,target,4)}]});if(waitKey(w)===waitKey(before))return true}
  return false;
}

class Game{
  constructor(){this.reset()}
  reset(){
    this.players=[];this.wall=[];this.dead=[];this.rinshan=[];this.doraIndicators=[];this.uraIndicators=[];
    this.roundIndex=0;this.dealer=0;this.startDealer=0;this.honba=0;this.riichiSticks=0;this.current=0;this.phase='idle';this.lastDiscard=null;this.lastActor=null;this.pending=null;
    this.turnNo=0;this.anyCall=false;this.firstDiscards=[];this.kanCount=0;this.kanOwners=new Set();this._advance=0;this.ended=false;this.discardSerial=0;this.kanAbortPending=false;this.pendingKanDora=false;this.callSeq=0;this.lastCall=null;this.reactionPassed=new Set();
  }
  start(){
    this.players=Array.from({length:4},(_,seat)=>({
      seat,name:seat===0?'YOU':`AI ${seat}`,score:RULES.startPoints,wind:0,roundWind:0,hand:[],melds:[],river:[],paoDaisangen:null,paoDaisuushii:null,
      riichi:false,doubleRiichi:false,ippatsu:false,temporaryFuriten:false,riichiFuriten:false,forbidden:[],lastDraw:null,rinshanDraw:false,called:false
    }));
    this.startDealer=this.dealer;
    this.startHand(true);
  }
  startHand(first=false){
    if(!first){
      this.roundIndex+=this._advance;
      if(this.roundIndex>RULES.maxRound){this.endSession('西4局終了');return}
      // Reaching South 4 / West 4 is handled after the completed hand, not before repeated dealer hands.
      if(this.players.some(p=>p.score<0)){this.endSession('飛び終了');return}
    }
    this.wall=[];for(const t of TYPES)for(let i=0;i<4;i++)this.wall.push(t);
    for(const [r,b] of Object.entries(RED)){const i=this.wall.indexOf(b);if(i>=0)this.wall[i]=r}
    shuffle(this.wall);this.dead=this.wall.splice(-14);this.rinshan=this.dead.slice(0,4);this.doraIndicators=[this.dead[4]];this.uraIndicators=[this.dead[5]];
    this.current=this.dealer;this.turnNo=0;this.lastDiscard=null;this.lastActor=null;this.pending=null;this.phase='discard';this.anyCall=false;this.firstDiscards=[];this.kanCount=0;this.kanOwners=new Set();this.kanAbortPending=false;this.pendingKanDora=false;this.callSeq=0;this.lastCall=null;this.reactionPassed=new Set();
    for(let s=0;s<4;s++){
      const p=this.players[s];p.wind=(s-this.dealer+4)%4;p.roundWind=Math.min(3,Math.floor(this.roundIndex/4));p.hand=[];p.melds=[];p.river=[];p.riichi=false;p.doubleRiichi=false;p.ippatsu=false;p.temporaryFuriten=false;p.riichiFuriten=false;p.forbidden=[];p.lastDraw=null;p.rinshanDraw=false;p.called=false;p.paoDaisangen=null;p.paoDaisuushii=null;
    }
    for(let i=0;i<13;i++)for(let s=0;s<4;s++)this.players[s].hand.push(this.wall.shift());
    for(const p of this.players)p.hand=sortTiles(p.hand);
    this.draw(this.dealer);
  }
  draw(seat,rinshan=false){
    const p=this.players[seat];
    let t;
    if(rinshan){
      t=this.rinshan.shift();
      if(t&&this.wall.length)this.rinshan.push(this.wall.shift());
    }else t=this.wall.shift();
    if(!t){this.exhaustive();return null}
    p.hand.push(t);p.hand=sortTiles(p.hand);p.lastDraw=t;p.rinshanDraw=!!rinshan;p.temporaryFuriten=false;this.current=seat;this.phase='discard';this.turnNo++;
    if(rinshan&&this.kanAbortPending){
      const w=calcWin(p,t,{tsumo:true,seatWind:p.wind,roundWind:p.roundWind,doraIndicators:this.doraIndicators,uraIndicators:this.uraIndicators,rinshan:true,haitei:false});
      if(w.valid){this.phase='win';this.pending={winners:[{seat,tile:t,tsumo:true,score:w,from:seat}],ctx:{tsumo:true,rinshan:true}};this.kanAbortPending=false;}
    }
    return t;
  }
  discard(seat,tile,declareRiichi=false){
    if(this.phase!=='discard'||seat!==this.current)return null;
    const p=this.players[seat];
    if(p.riichi)tile=p.lastDraw;
    if(!tile)return null;
    if(p.forbidden.includes(tileBase(tile)))return null;
    if(declareRiichi&&!canRiichiTile(p,tile,this))return null;
    const idx=p.hand.findIndex(t=>t===tile);if(idx<0)return null;
    if(declareRiichi){p.riichi=true;p.doubleRiichi=!this.anyCall&&p.river.length===0;p.ippatsu=true;p.score-=RULES.riichiCost;this.riichiSticks++;mahjongAudio('richi')}
    const out=p.hand.splice(idx,1)[0];
    p.hand=sortTiles(p.hand);
    p.lastDraw=null;
    p.rinshanDraw=false;
    const discard={id:++this.discardSerial,tile:out,riichi:declareRiichi,seat};
    p.river.push(discard);
    if(this.pendingKanDora){this.revealKanDora();this.pendingKanDora=false;}
    p.forbidden=[];
    if(p.riichi&&!declareRiichi)p.ippatsu=false;
    if(p.river.length===1)this.firstDiscards.push(out);
    // Every discard starts a fresh reaction window.  A previous pass must never
    // suppress Pon/Ron/Chi on a later discard; reactionPassed is per-discard state.
    this.reactionPassed=new Set();
    this.lastDiscard=out;this.lastActor=seat;this.phase='reaction';this.pending=null;
    // The declaration sound can be consumed by the host audio manager if both sounds
    // are fired in the same frame. Keep the discard sound explicitly after richi.
    if(declareRiichi)mahjongAudioLater('dahai11',260);
    else mahjongAudio('dahai11');
    return out;
  }
  nextAfterNoCall(){const next=(this.lastActor+1)%4;this.draw(next);}
  lastRiverId(){const p=this.players[this.lastActor];return p?.river?.[p.river.length-1]?.id??null}
  ronScore(seat){
    if(this.phase!=='reaction'||this.lastDiscard==null||this.lastActor==null)return null;
    const p=this.players[seat];
    if(!p||seat===this.lastActor||this.reactionPassed.has(seat))return null;
    if(p.temporaryFuriten||p.riichiFuriten)return null;
    // Permanent furiten: a player cannot Ron on a tile type already present in their river.
    if(p.river.some(r=>tileBase(r.tile)===tileBase(this.lastDiscard)))return null;
    const score=calcWin(p,this.lastDiscard,{
      tsumo:false,
      seatWind:p.wind,
      roundWind:p.roundWind,
      doraIndicators:this.doraIndicators,
      uraIndicators:this.uraIndicators,
      houtei:this.wall.length===0
    });
    // Ron must have a real yaku. Dora/red-dora alone are not a yaku and cannot enable a Ron.
    const hasYaku=!!score?.valid&&Array.isArray(score.yaku)&&score.yaku.some(y=>!['ドラ','裏ドラ','赤ドラ'].includes(y.name));
    return score?.valid&&hasYaku?score:null;
  }
  ronCandidates(){
    if(this.phase!=='reaction'||this.lastDiscard==null||this.lastActor==null)return [];
    const out=[];
    for(let d=1;d<=3;d++){
      const seat=(this.lastActor+d)%4;
      const score=this.ronScore(seat);
      if(score)out.push({seat,distance:d,score});
    }
    return out;
  }
  actionOptions(seat){
    if(this.phase!=='reaction'||this.lastDiscard==null)return {ron:false,pon:false,daiminkan:false,chi:[]};
    const p=this.players[seat],t=this.lastDiscard;if(!p||seat===this.lastActor)return {ron:false,pon:false,daiminkan:false,chi:[]};
    const selfRon=!!this.ronScore(seat);
    const allRons=this.ronCandidates();
    // Ron is the only reaction that outranks every call.  Otherwise the caller's
    // legal Pon/Chi/Kan options must remain available until that caller passes.
    if(selfRon||allRons.length)return {ron:selfRon,pon:false,daiminkan:false,chi:[]};
    if(this.abortiveReason())return {ron:false,pon:false,daiminkan:false,chi:[]};
    if(p.riichi||this.kanCount>=RULES.maxKan)return {ron:false,pon:false,daiminkan:false,chi:[]};
    const pon=legalPon(p,t),daiminkan=legalDaiminkan(p,t);
    const chi=seat===(this.lastActor+1)%4?chiOptions(p.hand,t):[];
    return {ron:false,pon,daiminkan,chi};
  }
  pass(seat){
    if(this.phase!=='reaction')return false;
    const p=this.players[seat],opts=this.actionOptions(seat);
    if(opts.ron){if(p.riichi)p.riichiFuriten=true;else p.temporaryFuriten=true}
    this.reactionPassed.add(seat);
    return true;
  }
  updatePaoAfterCall(p,meld){
    if(!['pon','daiminkan'].includes(meld.type))return;
    const calledId=idOf(meld.calledTile);
    const hasSet=id=>p.melds.some(m=>triplet(m.tiles.map(idOf))&&m.tiles.length>=3&&idOf(m.tiles[0])===id);
    if([31,32,33].includes(calledId)&&[31,32,33].every(hasSet)&&p.paoDaisangen==null)p.paoDaisangen=meld.from;
    if(calledId>=27&&calledId<=30&&[27,28,29,30].every(hasSet)&&p.paoDaisuushii==null)p.paoDaisuushii=meld.from;
  }
  removeClaimedDiscard(from,riverId){
    if(from==null||riverId==null)return false;
    const q=this.players[from];if(!q?.river?.length)return false;
    const i=q.river.findIndex(r=>r.id===riverId);
    if(i<0)return false;
    q.river.splice(i,1);
    return true;
  }
  callMeld(seat,type,used){
    if(this.phase!=='reaction'||seat===this.lastActor)return false;
    const higherRon=this.ronCandidates().filter(x=>x.seat!==seat);
    if(higherRon.length)return false;
    const p=this.players[seat],called=this.lastDiscard,from=this.lastActor;
    const riverId=this.lastRiverId();
    if(!p||p.riichi)return false;
    if(type==='pon'){
      if(!legalPon(p,called)||used.length!==2||used.some(x=>tileBase(x)!==tileBase(called)))return false;
      const rest=removeTiles(p.hand,used);if(!rest)return false;p.hand=sortTiles(rest);
      const meld={type:'pon',tiles:[...used,called],from,calledAt:calledSlot(seat,from),calledTile:called,calledRiverId:riverId};
      p.melds.push(meld);
      this.removeClaimedDiscard(from,riverId);this.updatePaoAfterCall(p,meld);
      p.called=true;p.forbidden=[tileBase(called)];
      this.lastCall={id:++this.callSeq,seat,type:'pon',from,tile:called,tiles:meld.tiles.slice()};
    }else if(type==='chi'){
      if(seat!==(from+1)%4||used.length!==2||!chiOptions(p.hand,called).some(o=>waitKey([...o,called])===waitKey([...used,called])))return false;
      const rest=removeTiles(p.hand,used);if(!rest)return false;p.hand=sortTiles(rest);
      const meld={type:'chi',tiles:[...used,called],from,calledAt:calledSlot(seat,from),calledTile:called,calledRiverId:riverId};
      p.melds.push(meld);
      this.removeClaimedDiscard(from,riverId);
      p.called=true;p.forbidden=this.forbiddenAfterChi(used,called);
      this.lastCall={id:++this.callSeq,seat,type:'chi',from,tile:called,tiles:meld.tiles.slice()};
    }else return false;
    this.finishCall(seat,type);return true;
  }
  forbiddenAfterChi(used,called){
    const ids=[...used.map(idOf),idOf(called)].sort((a,b)=>a-b),out=new Set([tileBase(called)]);
    for(const x of [ids[0]-1,ids[2]+1]){
      if(x<0||x>=27)continue;
      const test=[...used.map(idOf),x].sort((a,b)=>a-b);if(test.length===3&&test[1]===test[0]+1&&test[2]===test[0]+2)out.add(tileOf(x));
    }
    return [...out];
  }
  finishCall(seat,type){this.anyCall=true;for(const q of this.players)if(q.riichi)q.ippatsu=false;this.current=seat;this.phase='discard';this.lastDiscard=null;this.lastActor=null;this.pending=null;this.players[seat].lastDraw=null;mahjongAudio(type==='pon'?'pon':'chii')}
  kanOptions(seat){
    const p=this.players[seat];if(!p)return [];
    const c=counts(p.hand),out=[];
    for(const t of TYPES){if(c[idOf(t)]===4&&(!p.riichi||kanPreservesWaits(this,seat,t)))out.push({type:'ankan',tile:t})}
    if(!p.riichi)for(const m of p.melds.filter(m=>m.type==='pon')){const t=tileBase(m.tiles[0]);if(takeMatching(p.hand,t,1).length===1)out.push({type:'kakan',tile:t})}
    return uniq(out.map(x=>`${x.type}:${x.tile}`)).map(k=>{const [type,tile]=k.split(':');return {type,tile}});
  }
  performKan(seat,type,tile){
    const p=this.players[seat],target=tileBase(tile);if(!p||this.kanCount>=RULES.maxKan)return false;
    if(type==='daiminkan'){
      if(this.phase!=='reaction'||seat===this.lastActor||p.riichi||target!==tileBase(this.lastDiscard))return false;
      const actual=takeMatching(p.hand,target,3);if(actual.length!==3)return false;
      const from=this.lastActor,called=this.lastDiscard,riverId=this.lastRiverId();
      p.hand=removeTiles(p.hand,actual);
      const meld={type:'daiminkan',tiles:[...actual,called],from,calledAt:calledSlot(seat,from),calledTile:called,calledRiverId:riverId};
      p.melds.push(meld);
      this.removeClaimedDiscard(from,riverId);this.updatePaoAfterCall(p,meld);
      this.lastCall={id:++this.callSeq,seat,type:'daiminkan',from,tile:called,tiles:meld.tiles.slice()};
      this.lastDiscard=null;this.lastActor=seat;this.finishKan(seat,'daiminkan');return true;
    }
    if(this.phase!=='discard'||seat!==this.current)return false;
    if(type==='ankan'){
      const candidates=[];
      for(let d=1;d<=3;d++){
        const s=(seat+d)%4,q=this.players[s];
        const score=calcWin(q,target,{tsumo:false,chankan:true,seatWind:q.wind,roundWind:q.roundWind,doraIndicators:this.doraIndicators,uraIndicators:this.uraIndicators,houtei:false});
        if(score.valid&&score.yaku.some(y=>String(y.name).startsWith('国士無双')))candidates.push({seat:s,distance:d,score});
      }
      if(candidates.length){
        this.phase='win';
        this.pending={winners:candidates.map(x=>({seat:x.seat,tile:target,tsumo:false,score:x.score,distance:x.distance,from:seat})),ctx:{chankan:true}};
        return true;
      }
      const actual=takeMatching(p.hand,target,4);if(actual.length!==4)return false;if(p.riichi&&!kanPreservesWaits(this,seat,target))return false;
      p.hand=removeTiles(p.hand,actual);
      p.melds.push({type:'ankan',tiles:actual,from:seat,calledAt:null});
      this.lastCall={id:++this.callSeq,seat,type:'ankan',from:seat,tile:actual[0],tiles:actual.slice()};
    }else if(type==='kakan'){
      if(p.riichi)return false;
      const m=p.melds.find(m=>m.type==='pon'&&tileBase(m.tiles[0])===target),actual=takeMatching(p.hand,target,1);if(!m||actual.length!==1)return false;
      const candidates=[];for(let d=1;d<=3;d++){const s=(seat+d)%4,q=this.players[s],score=calcWin(q,actual[0],{tsumo:false,chankan:true,seatWind:q.wind,roundWind:q.roundWind,doraIndicators:this.doraIndicators,uraIndicators:this.uraIndicators,houtei:false});if(score.valid)candidates.push({seat:s,distance:d,score})}
      if(candidates.length){this.phase='win';this.pending={winners:candidates.map(x=>({seat:x.seat,tile:actual[0],tsumo:false,score:x.score,distance:x.distance,from:seat})),ctx:{chankan:true}};return true;}
      p.hand=removeTiles(p.hand,actual);m.type='kakan';m.addedIndex=3;m.tiles.push(actual[0]);
      this.lastCall={id:++this.callSeq,seat,type:'kakan',from:seat,tile:actual[0],tiles:m.tiles.slice()};
    }else return false;
    this.finishKan(seat,type);return true;
  }
  revealKanDora(){
    const doraIndex=4+2*this.kanCount,uraIndex=5+2*this.kanCount;
    if(this.dead[doraIndex])this.doraIndicators.push(this.dead[doraIndex]);
    if(this.dead[uraIndex])this.uraIndicators.push(this.dead[uraIndex]);
  }
  finishKan(seat,type){
    this.kanCount++;
    this.kanOwners.add(seat);
    this.anyCall=true;
    for(const q of this.players)if(q.riichi)q.ippatsu=false;
    const p=this.players[seat];
    if(type!=='ankan')p.called=true;
    p.lastDraw=null;
    p.forbidden=[];
    if(type==='ankan')this.revealKanDora();
    else this.pendingKanDora=true;
    mahjongAudio('kan');
    this.kanAbortPending=this.kanCount===4&&this.kanOwners.size>1;
    // Four-kan abort is declared immediately after the fourth kan; no rinshan draw
    // or settlement occurs in this case.
    if(this.kanAbortPending){
      this.phase='abortive';
      this.pending={reason:'四槓散了'};
      return;
    }
    this.draw(seat,true);
  }
  kyuushukyuhai(seat){const p=this.players[seat];if(!p||p.called||p.river.length||this.anyCall||this.turnNo>4)return false;return new Set(p.hand.filter(isYao).map(tileBase)).size>=9}
  abortiveReason(){
    if(this.phase==='abortive')return this.pending?.reason||'途中流局';
    if(!RULES.abortiveDraws)return null;
    if(this.kanAbortPending)return '四槓散了';
    if(this.firstDiscards.length===4&&!this.anyCall){const b=tileBase(this.firstDiscards[0]);if(['z1','z2','z3','z4'].includes(b)&&this.firstDiscards.every(t=>tileBase(t)===b))return '四風連打';}
    if(this.players.length===4&&this.players.every(p=>p.riichi))return '四家立直';
    return null;
  }
  exhaustive(){
    const tenpai=[];for(const p of this.players)if(isTenpai(p))tenpai.push(p.seat);
    const claimedRiverIds=new Set();
    for(const q of this.players)for(const m of q.melds)if(m.calledRiverId!=null)claimedRiverIds.add(m.calledRiverId);
    const nagashi=[];if(RULES.nagashiMangan)for(const p of this.players){if(!p.river.length||p.called)continue;if(!p.river.every(r=>isYao(r.tile)))continue;if(p.river.every(r=>!claimedRiverIds.has(r.id)))nagashi.push(p.seat)}
    this.phase='drawEnd';this.pending={tenpai:tenpai,nagashi};return {tenpai,nagashi};
  }
  endSession(reason){
    if(this.phase==='sessionEnd')return;
    this.phase='sessionEnd';this.ended=true;this.pending=null;
    if(this.riichiSticks){
      const first=[...this.players].sort((a,b)=>b.score-a.score||a.wind-b.wind)[0];
      if(first){first.score+=this.riichiSticks*1000;this.riichiSticks=0;}
    }
    const ordered=[...this.players].sort((a,b)=>b.score-a.score||((a.seat-this.startDealer+4)%4)-((b.seat-this.startDealer+4)%4));
    this.sessionResult={reason,players:ordered.map((p,i)=>({seat:p.seat,name:p.name,score:p.score,uma:RULES.uma[i],final:+(((p.score-RULES.returnPoints)/1000)+RULES.uma[i]).toFixed(1)}))};
  }
}

class MahjongUI{
  constructor(host){
    this.host=host;
    this.game=new Game();
    this.running=false;
    this.timer=null;
    this.resizeObserver=null;
    this.riichiMode=false;
    this.callBound=false;
    this.resizeBound=false;
    this.callTimer=null;
    this.lastCallId=0;
    this.suppressClickUntil=0;
    this.suppressClickTarget=null;
    this.winEffectKey=null;
    this.winEffectPlaying=false;
    this.winSoundKey=null;
    this.winEffectTimers=new Set();
    this.hostHandlers=null;
    this.lastActionKey='';
    this.lastActionAt=0;
    this.mount();
  }

  mount(){
    this.host.innerHTML=`
      <div class="fnm-root">
        <div class="fnm-arena">
          <div class="fnm-table"></div>
          <div class="fnm-inner"></div>

          <div class="fnm-wall fnm-wall-top" id="wallTop"></div>
          <div class="fnm-wall fnm-wall-right" id="wallRight"></div>
          <div class="fnm-wall fnm-wall-bottom" id="wallBottom"></div>
          <div class="fnm-wall fnm-wall-left" id="wallLeft"></div>

          <section class="fnm-seat fnm-seat-top">
            <div class="fnm-card" id="card2"><i>西</i><b id="name2">AI 2</b><strong id="score2">25,000</strong><em class="fnm-card-riichi" hidden>リーチ</em></div>
            <div class="fnm-hand opp-top" id="hand2"></div>
            <div class="fnm-river river-top" id="river2"></div>
            <div class="fnm-meld meld-top" id="meld2"></div>
          </section>

          <section class="fnm-seat fnm-seat-left">
            <div class="fnm-card" id="card3"><i>北</i><b id="name3">AI 3</b><strong id="score3">25,000</strong><em class="fnm-card-riichi" hidden>リーチ</em></div>
            <div class="fnm-hand opp-left" id="hand3"></div>
            <div class="fnm-river river-left" id="river3"></div>
            <div class="fnm-meld meld-left" id="meld3"></div>
          </section>

          <section class="fnm-seat fnm-seat-right">
            <div class="fnm-card" id="card1"><i>南</i><b id="name1">AI 1</b><strong id="score1">25,000</strong><em class="fnm-card-riichi" hidden>リーチ</em></div>
            <div class="fnm-hand opp-right" id="hand1"></div>
            <div class="fnm-river river-right" id="river1"></div>
            <div class="fnm-meld meld-right" id="meld1"></div>
          </section>

          <section class="fnm-seat fnm-seat-bottom">
            <div class="fnm-river river-bottom" id="river0"></div>
            <div class="fnm-meld meld-bottom" id="meld0"></div>
            <div class="fnm-self-hand" id="hand0"></div>
          </section>

          <div class="fnm-center" id="center">
            <div class="fnm-center-topline">
              <div class="fnm-round-info">
                <strong id="roundText">東1局</strong>
                <span id="honbaText">0本場</span>
              </div>
              <span class="fnm-kyotaku"><span class="fnm-stick-label">供託</span><b id="kyotakuCount">0</b></span>
            </div>
            <div class="fnm-center-meta">
              <div class="fnm-remain"><span>残り牌</span><b id="remainText">70</b></div>
              <div class="fnm-honba"><span id="honbaStickArea"></span></div>
            </div>
            <div class="fnm-scoregrid">
              <div class="fnm-scoreitem" data-center-seat="2"><span class="fnm-score-riichi-stick" aria-hidden="true"></span><i id="centerWind2">西</i><b id="centerScore2">25,000</b></div>
              <div class="fnm-scoreitem" data-center-seat="3"><span class="fnm-score-riichi-stick" aria-hidden="true"></span><i id="centerWind3">北</i><b id="centerScore3">25,000</b></div>
              <div class="fnm-scoreitem" data-center-seat="0"><span class="fnm-score-riichi-stick" aria-hidden="true"></span><i id="centerWind0">東</i><b id="centerScore0">25,000</b></div>
              <div class="fnm-scoreitem" data-center-seat="1"><span class="fnm-score-riichi-stick" aria-hidden="true"></span><i id="centerWind1">南</i><b id="centerScore1">25,000</b></div>
            </div>
            <div class="fnm-dora-block"><span>ドラ表示牌</span><div class="fnm-dora" id="doraArea"></div></div>
          </div>

          <div class="fnm-callcutin hidden" id="callCutin"></div>
          <div class="fnm-ops" id="ops"></div>
          <div class="fnm-prompt" id="prompt"></div>
          <div class="fnm-overlay hidden" id="overlay"></div>
        </div>
      </div>`;
    this.bind();
  }

  bind(){
    if(!this.callBound){
      // Keep stable function references so stop() can remove every listener.
      // Native touch/pointer/click paths are de-duplicated before dispatch.
      this.hostHandlers={
        touchstart:()=>unlockMahjongAudio(),
        pointerdown:e=>{if(e.pointerType==='touch'||e.pointerType==='mouse')unlockMahjongAudio()},
        touchend:e=>this.onTouchEnd(e),
        pointerup:e=>this.onPointerUp(e),
        click:e=>this.onClick(e)
      };
      this.host.addEventListener('touchstart',this.hostHandlers.touchstart,{passive:true,capture:true});
      this.host.addEventListener('pointerdown',this.hostHandlers.pointerdown,{passive:true,capture:true});
      this.host.addEventListener('touchend',this.hostHandlers.touchend,{passive:false,capture:true});
      this.host.addEventListener('pointerup',this.hostHandlers.pointerup,{passive:false,capture:true});
      this.host.addEventListener('click',this.hostHandlers.click);
      this.callBound=true;
    }
    if(!this.resizeBound){
      this.resizeHandler=()=>this.fit();
      window.addEventListener('resize',this.resizeHandler,{passive:true});
      window.addEventListener('orientationchange',this.resizeHandler,{passive:true});
      if(window.visualViewport)window.visualViewport.addEventListener('resize',this.resizeHandler,{passive:true});
      this.resizeBound=true;
    }
    if(window.ResizeObserver&&!this.resizeObserver){
      this.resizeObserver=new ResizeObserver(()=>this.fit());
      this.resizeObserver.observe(this.host);
    }
    this.fit();
  }

  fit(){
    const arena=$(this.host,'.fnm-arena');
    if(!arena)return;
    const vv=window.visualViewport;
    const r=this.host.getBoundingClientRect();
    const w=Math.max(1, vv?.width || r.width || window.innerWidth || 1);
    const h=Math.max(1, vv?.height || r.height || window.innerHeight || 1);
    const scale=Math.min(w/1280,h/720);
    arena.style.setProperty('--scale',String(Math.max(.35,scale)));
    arena.style.setProperty('--viewport-width',String(w));
    arena.style.setProperty('--viewport-height',String(h));
  }

  start(){
    cancelMahjongAudioTimers();
    this.running=true;
    this.game.reset();
    this.game.start();
    this.riichiMode=false;
    this.winEffectKey=null;
    this.winEffectPlaying=false;
    this.winSoundKey=null;
    for(const id of this.winEffectTimers)clearTimeout(id);
    this.winEffectTimers.clear();
    this.lastCallId=0;
    this.lastActionKey='';
    this.lastActionAt=0;
    this.render();
    this.schedule();
  }

  stop(){
    cancelMahjongAudioTimers();
    this.running=false;
    if(this.timer){clearTimeout(this.timer);this.timer=null}
    if(this.callTimer){clearTimeout(this.callTimer);this.callTimer=null}
    for(const id of this.winEffectTimers)clearTimeout(id);
    this.winEffectTimers.clear();
    if(this.callBound&&this.hostHandlers){
      this.host.removeEventListener('touchstart',this.hostHandlers.touchstart,{capture:true});
      this.host.removeEventListener('pointerdown',this.hostHandlers.pointerdown,{capture:true});
      this.host.removeEventListener('touchend',this.hostHandlers.touchend,{capture:true});
      this.host.removeEventListener('pointerup',this.hostHandlers.pointerup,{capture:true});
      this.host.removeEventListener('click',this.hostHandlers.click);
      this.hostHandlers=null;
      this.callBound=false;
    }
    const effectVideo=$(this.host,'.fnm-yakuman-video');
    if(effectVideo){try{effectVideo.pause()}catch(_){}try{effectVideo.removeAttribute('src');effectVideo.load()}catch(_){}}
    if(this.resizeObserver){this.resizeObserver.disconnect();this.resizeObserver=null}
    if(this.resizeBound){
      window.removeEventListener('resize',this.resizeHandler);
      window.removeEventListener('orientationchange',this.resizeHandler);
      if(window.visualViewport)window.visualViewport.removeEventListener('resize',this.resizeHandler);
      this.resizeBound=false;
    }
    this.riichiMode=false;
    this.winEffectKey=null;
    this.winEffectPlaying=false;
    this.winSoundKey=null;
    this.lastActionKey='';
    this.lastActionAt=0;
  }

  schedule(){
    if(!this.running)return;
    if(this.timer)clearTimeout(this.timer);
    const g=this.game;
    // All CPU decisions/reactions use one fixed 2-second cadence.
    const delay=(g.phase==='reaction'||(g.phase==='discard'&&g.current!==0))?2000:250;
    this.timer=setTimeout(()=>{
      if(!this.running)return;
      try{this.stepAI()}
      catch(err){console.error('[FORTUNE NOIR Mahjong]',err);this.showRuntimeError(err)}
      if(this.running)this.schedule();
    },delay);
  }

  stepAI(){
    const g=this.game;
    if(!this.running||g.phase==='sessionEnd')return;

    if(g.phase==='discard'&&g.current===0){
      const p=g.players[0];
      if(p.riichi&&p.lastDraw!=null){
        const ctx={
          tsumo:true,seatWind:p.wind,roundWind:p.roundWind,
          doraIndicators:g.doraIndicators,uraIndicators:g.uraIndicators,
          rinshan:p.rinshanDraw,haitei:g.wall.length===0
        };
        const win=calcWin(p,p.lastDraw,ctx);
        const ankan=g.kanOptions(0).some(k=>k.type==='ankan');
        if(win.valid||ankan){
          this.render();
          return;
        }
        g.discard(0,p.lastDraw,false);
        this.resolveAIReactions();
        this.render();
        return;
      }
    }

    if(g.phase==='discard'&&g.current!==0){
      const p=g.players[g.current];
      const draw=p.lastDraw;
      if(draw){
        const win=calcWin(p,draw,{
          tsumo:true,seatWind:p.wind,roundWind:p.roundWind,
          doraIndicators:g.doraIndicators,uraIndicators:g.uraIndicators,
          rinshan:p.rinshanDraw,haitei:g.wall.length===0,
          tenhou:p.seat===g.dealer&&g.turnNo===1,
          chihou:p.seat!==g.dealer&&g.turnNo<=4&&!g.anyCall
        });
        if(win.valid){
          g.phase='win';
          g.pending={winners:[{seat:p.seat,tile:draw,tsumo:true,score:win,from:p.seat}],ctx:{tsumo:true}};
          this.render();
          return;
        }
      }
      const hand=sortTiles(p.hand);
      let tile=p.riichi?p.lastDraw:(aiBestDiscard(g,p).tile||hand.find(t=>!p.forbidden.includes(tileBase(t)))||hand[hand.length-1]);
      if(!p.riichi){
        const normal=aiBestDiscard(g,p);
        const riichiCandidates=hand.filter(t=>canRiichiTile(p,t,g)&&!p.forbidden.includes(tileBase(t)));
        let reachTile=null,reachScore=Infinity;
        for(const t of riichiCandidates){
          const h=removeTiles(hand,[t]);if(!h)continue;
          const q={...p,hand:sortTiles(h)};
          const sh=playerShanten(q),uke=aiUkeire(g,q,q.hand);
          const score=sh*10000-uke*22;
          if(score<reachScore){reachScore=score;reachTile=t;}
        }
        if(reachTile!=null&&reachScore<=normal.score+450)g.discard(p.seat,reachTile,true);
        else g.discard(p.seat,normal.tile,false);
      }else{
        g.discard(p.seat,tile,false);
      }
      this.resolveAIReactions();
      this.render();
      return;
    }

    if(g.phase==='reaction'){
      const human=this.humanActions();
      if(g.reactionPassed?.has(0)){
        this.resolveAIReactions();
        this.render();
        return;
      }
      if(!human.length){
        g.pass(0);
        this.resolveAIReactions();
        this.render();
      }else{
        // Keep the reaction window open for the human. AI may only proceed when its
        // reaction has higher priority than the player's legal choice.
        this.resolveAIReactions();
        this.render();
      }
    }
  }

  resolveAIReactions(){
    const g=this.game;
    if(g.phase!=='reaction')return false;

    // Human reaction has to be resolved before automatic AI calls whenever the human
    // has a legal action at the current reaction priority. This is what prevents the
    // CPU from stealing a legal player pon/chi window.
    const humanOpts=g.actionOptions(0);
    const humanRon=!!humanOpts.ron;
    if(!g.reactionPassed.has(0)){
      if(humanRon)return false;
      // Keep a legal human call window open until the player chooses it or passes.
      // Pon is legal against a discard from ANY other seat, including honors.
      if(humanOpts.pon||humanOpts.daiminkan||humanOpts.chi.length)return false;
    }

    const rons=g.ronCandidates();
    const aiRons=rons.filter(x=>x.seat!==0);
    if(aiRons.length){
      g.phase='win';
      g.pending={winners:aiRons.map(x=>({
        seat:x.seat,tile:g.lastDiscard,tsumo:false,score:x.score,
        distance:x.distance,from:g.lastActor
      })),ctx:{tsumo:false}};
      return true;
    }

    if(g.abortiveReason()){
      g.phase='abortive';g.pending={reason:g.abortiveReason()};return true;
    }

    const candidates=[];
    for(const seat of [1,2,3]){
      if(g.reactionPassed.has(seat))continue;
      const p=g.players[seat],o=g.actionOptions(seat);
      if(o.daiminkan){
        const used=takeMatching(p.hand,g.lastDiscard,3);
        const ev=aiCallEvaluation(g,p,'pon',used,g.lastDiscard);
        if(ev.accept)candidates.push({seat,prio:3,type:'daiminkan',score:ev.score,distance:(seat-g.lastActor+4)%4});
      }
      if(o.pon){
        const used=takeMatching(p.hand,g.lastDiscard,2);
        const ev=aiCallEvaluation(g,p,'pon',used,g.lastDiscard);
        if(ev.accept)candidates.push({seat,prio:3,type:'pon',score:ev.score,distance:(seat-g.lastActor+4)%4});
      }
      if(o.chi.length){
        let bestChi=null;
        for(const opt of o.chi){
          const ev=aiCallEvaluation(g,p,'chi',opt,g.lastDiscard);
          if(ev.accept&&(!bestChi||ev.score<bestChi.score))bestChi={opt,score:ev.score};
        }
        if(bestChi)candidates.push({seat,prio:2,type:'chi',opt:bestChi.opt,score:bestChi.score,distance:(seat-g.lastActor+4)%4});
      }
    }

    candidates.sort((a,b)=>b.prio-a.prio||a.distance-b.distance||a.score-b.score);
    const bestAI=candidates[0]||null;

    if(!g.reactionPassed.has(0)){
      const humanHasPon=humanOpts.pon||humanOpts.daiminkan;
      const humanHasChi=humanOpts.chi.length>0;
      // Human pon/kan beats AI chi. Among pon/kan, the player closest to the discarder wins.
      if(humanOpts.ron||humanHasPon||humanHasChi){
        if(!bestAI)return false;
        if(humanHasPon && bestAI.prio<3)return false;
        if(humanHasChi && bestAI.prio<2)return false;
        const humanDist=(0-g.lastActor+4)%4;
        // A human player's legal Pon/kan window must remain selectable.
        // Do not let an AI of the same call priority steal the player's call
        // merely because its seat is closer to the discarder. AI calls are
        // evaluated only after the human passes. Ron still retains absolute
        // priority through actionOptions()/ronCandidates().
        if(humanHasPon&&bestAI.prio===3)return false;
        if(humanHasChi&&bestAI.prio===2)return false;
        // The AI has the higher-priority call, so it may proceed.
      }
    }

    if(bestAI){
      if(bestAI.type==='pon'){
        const used=takeMatching(g.players[bestAI.seat].hand,g.lastDiscard,2);
        if(used.length===2&&g.callMeld(bestAI.seat,'pon',used))return true;
      }else if(bestAI.type==='daiminkan'){
        if(g.performKan(bestAI.seat,'daiminkan',g.lastDiscard))return true;
      }else if(bestAI.type==='chi'){
        if(g.callMeld(bestAI.seat,'chi',bestAI.opt))return true;
      }
    }

    // Everyone who could act has either passed or no legal action exists.
    g.nextAfterNoCall();
    return true;
  }

  claimActionInput(t){
    const action=String(t?.dataset?.action||'');
    const key=action+'|'+String(t?.dataset?.handIndex??t?.dataset?.chooseIndex??t?.id??'');
    const now=typeof performance!=='undefined'?performance.now():Date.now();
    if(this.lastActionKey===key&&now-this.lastActionAt<900)return false;
    this.lastActionKey=key;
    this.lastActionAt=now;
    return true;
  }

  onTouchEnd(e){
    const t=e.target?.closest?.('#ops [data-action]');
    if(!t||!this.host.contains(t))return;
    if(!this.claimActionInput(t))return;
    e.preventDefault();
    e.stopPropagation();
    this.suppressClickTarget=t;
    this.suppressClickUntil=(typeof performance!=='undefined'?performance.now():Date.now())+900;
    this.handleAction(t.dataset.action);
  }

  onPointerUp(e){
    // Pointer is a secondary path for desktop/touch browsers that expose PointerEvent.
    // Do not double-fire after a native touchend.
    if(e.pointerType==='touch'){
      const now=typeof performance!=='undefined'?performance.now():Date.now();
      if(this.suppressClickUntil&&now<this.suppressClickUntil)return;
    }
    const t=e.target?.closest?.('#ops [data-action]');
    if(!t||!this.host.contains(t))return;
    if(!this.claimActionInput(t))return;
    e.preventDefault();
    e.stopPropagation();
    this.suppressClickTarget=t;
    this.suppressClickUntil=(typeof performance!=='undefined'?performance.now():Date.now())+900;
    this.handleAction(t.dataset.action);
  }

  onClick(e){
    const t=e.target?.closest?.('[data-action],[data-hand-index],[data-riichi-cancel],[data-next],[data-close],[data-choose-index]');
    if(!t||!this.host.contains(t))return;
    const now=typeof performance!=='undefined'?performance.now():Date.now();
    if(t.dataset.action&&this.suppressClickTarget===t&&now<this.suppressClickUntil){
      this.suppressClickTarget=null;
      this.suppressClickUntil=0;
      e.preventDefault();
      return;
    }
    e.preventDefault();
    if(t.dataset.action){if(!this.claimActionInput(t))return;this.handleAction(t.dataset.action);return}
    if(t.dataset.handIndex!=null){this.handleTile(Number(t.dataset.handIndex));return}
    if(t.dataset.chooseIndex!=null){this.handleRiichiTile(Number(t.dataset.chooseIndex));return}
    if(t.hasAttribute('data-riichi-cancel')){this.riichiMode=false;this.render();return}
    if(t.hasAttribute('data-next')){this.advanceAfterResult();return}
    if(t.hasAttribute('data-close')){try{window.closeGame?.()}catch(_){}}
  }

  handleAction(action){
    const g=this.game;
    if(!this.running)return;
    if(action==='pass'){
      g.pass(0);
      this.resolveAIReactions();
      this.render();
      return;
    }
    if(action==='ron'){
      const humanRon=g.ronScore(0);
      if(humanRon){
        const human={seat:0,tile:g.lastDiscard,tsumo:false,score:humanRon,distance:(0-g.lastActor+4)%4,from:g.lastActor};
        const others=g.ronCandidates().filter(x=>x.seat!==0).map(x=>({
          seat:x.seat,tile:g.lastDiscard,tsumo:false,score:x.score,
          distance:x.distance,from:g.lastActor
        }));
        const winners=[human,...others].sort((a,b)=>(a.distance??0)-(b.distance??0));
        g.phase='win';
        g.pending={winners,ctx:{tsumo:false}};
        this.render();
      }
      return;
    }
    if(action==='pon'){
      // Re-check the player's own legal Pon at click time.  This prevents a stale
      // rendered action row from silently turning into a pass after a reaction update.
      if(g.phase!=='reaction'||g.lastDiscard==null||g.lastActor===0)return;
      const p=g.players[0];
      if(!p||p.riichi||g.reactionPassed.has(0)||g.abortiveReason())return;
      if(g.ronCandidates().length)return;
      const used=takeMatching(p.hand,g.lastDiscard,2);
      if(used.length!==2||!legalPon(p,g.lastDiscard))return;
      if(g.callMeld(0,'pon',used))this.render();
      return;
    }
    if(action==='daiminkan'){
      if(g.performKan(0,'daiminkan',g.lastDiscard))this.render();
      return;
    }
    if(action.startsWith('chi:')){
      try{
        const opt=JSON.parse(action.slice(4));
        if(g.callMeld(0,'chi',opt))this.render();
      }catch(_){}
      return;
    }
    if(action==='tsumo'){
      const p=g.players[0];
      if(!p.lastDraw)return;
      const ctx={
        tsumo:true,seatWind:p.wind,roundWind:p.roundWind,
        doraIndicators:g.doraIndicators,uraIndicators:g.uraIndicators,
        rinshan:p.rinshanDraw,haitei:g.wall.length===0,
        tenhou:p.seat===g.dealer&&g.turnNo===1,
        chihou:p.seat!==g.dealer&&g.turnNo<=4&&!g.anyCall
      };
      const w=calcWin(p,p.lastDraw,ctx);
      if(w.valid){
        g.phase='win';
        g.pending={winners:[{seat:0,tile:p.lastDraw,tsumo:true,score:w,from:0}],ctx};
        this.render();
      }
      return;
    }
    if(action==='kyuushukyuhai'){
      if(g.kyuushukyuhai(0)){g.phase='abortive';g.pending={reason:'九種九牌'};this.render()}
      return;
    }
    if(action==='riichi'){
      this.riichiMode=true;
      this.render();
      return;
    }
    if(action.startsWith('ankan:')){
      if(g.performKan(0,'ankan',action.slice(6)))this.render();
      return;
    }
    if(action.startsWith('kakan:')){
      if(g.performKan(0,'kakan',action.slice(6)))this.render();
    }
  }

  handleTile(index){
    const g=this.game,p=g.players[0];
    if(g.phase!=='discard'||g.current!==0||this.riichiMode||p.riichi)return;
    {
      const t=p.hand[index];
      if(!t||p.forbidden.includes(tileBase(t)))return;
      g.discard(0,t,false);
    }
    this.resolveAIReactions();
    this.render();
    this.schedule();
  }

  handleRiichiTile(index){
    const g=this.game,p=g.players[0];
    if(!this.riichiMode||g.phase!=='discard'||g.current!==0)return;
    const t=p.hand[index];
    if(!t||!canRiichiTile(p,t,g))return;
    if(g.discard(0,t,true)){
      this.riichiMode=false;
      this.resolveAIReactions();
      this.render();
      this.schedule();
    }
  }

  humanActions(){
    const g=this.game,p=g.players[0],a=[];
    if(g.phase==='discard'&&g.current===0){
      if(p.lastDraw){
        const ctx={
          tsumo:true,seatWind:p.wind,roundWind:p.roundWind,
          doraIndicators:g.doraIndicators,uraIndicators:g.uraIndicators,
          rinshan:p.rinshanDraw,haitei:g.wall.length===0,
          tenhou:p.seat===g.dealer&&g.turnNo===1,
          chihou:p.seat!==g.dealer&&g.turnNo<=4&&!g.anyCall
        };
        const w=calcWin(p,p.lastDraw,ctx);
        if(w?.valid===true&&Array.isArray(w.yaku))a.push({id:'tsumo',label:'ツモ',primary:true});
      }
      if(!p.riichi&&g.kyuushukyuhai(0))a.push({id:'kyuushukyuhai',label:'九種九牌'});
      for(const k of g.kanOptions(0)){
        if(p.riichi&&k.type!=='ankan')continue;
        a.push({id:`${k.type}:${k.tile}`,label:k.type==='ankan'?`暗槓 ${LABEL[k.tile]}`:`加槓 ${LABEL[k.tile]}`});
      }
      if(!p.riichi){
        const ri=sortTiles(p.hand).some(t=>canRiichiTile(p,t,g));
        if(ri)a.push({id:'riichi',label:'立直',primary:true});
      }
    }else if(g.phase==='reaction'){
      if(g.reactionPassed?.has(0))return a;
      const o=g.actionOptions(0);
      const humanRon=!!g.ronScore(0);
      if(humanRon)o.ron=true;
      if(humanRon)a.push({id:'ron',label:'ロン',danger:true});
      if(o.daiminkan)a.push({id:'daiminkan',label:'大明槓'});
      // Pon is re-evaluated directly from the player's hand.  This intentionally
      // covers honors and every discard source; actionOptions still enforces Ron priority.
      const directPon=!humanRon&&o.pon&&legalPon(p,g.lastDiscard);
      if(directPon)a.push({id:'pon',label:'ポン'});
      o.chi.forEach(opt=>a.push({id:`chi:${JSON.stringify(opt)}`,label:`チー ${opt.map(t=>LABEL[t]).join('・')}`}));
      if(o.ron||o.daiminkan||directPon||o.chi.length)a.push({id:'pass',label:'パス'});
    }
    return a;
  }

  render(){
    if(!this.running)return;
    this.renderWalls();
    this.renderSeats();
    this.renderCenter();
    this.renderActions();
    this.renderPrompt();
    this.renderCallCutin();

    const ov=$(this.host,'#overlay');
    if(this.riichiMode){
      ov.classList.remove('hidden');
      const p=this.game.players[0],hand=p.hand;
      ov.innerHTML=`<div class="fnm-choose"><b>立直</b><span>宣言牌を選択</span><div class="fnm-choose-hand">${hand.map((t,i)=>{
        const waits=canRiichiTile(p,t,this.game)?riichiWaitsAfterDiscard(p,t):[];
        const waitText=waits.length?formatWaits(waits):'';
        const status=waits.length?furitenStatus({...p,river:p.river},waits):null;
        const waitMarkup=waits.length?`<span class="fnm-riichi-waits">${waitImages(waits)}${furitenLabel(status)}</span>`:'';
        return `<button class="fnm-riichi-choice${waits.length?' has-wait':''}" data-choose-index="${i}" aria-label="${esc(waits.length?`待ち ${waitText}${status?.furiten?' フリテン':''}`:'立直不可')}">${waitMarkup}${imageTile(t)}</button>`;
      }).join('')}</div><button data-riichi-cancel>キャンセル</button></div>`;
    }else if(this.game.phase!=='win'&&this.game.phase!=='drawEnd'&&this.game.phase!=='abortive'&&this.game.phase!=='sessionEnd'){
      ov.classList.add('hidden');
      ov.innerHTML='';
    }

    if(this.game.phase==='win')this.showWin();
    else if(this.game.phase==='drawEnd')this.showDraw();
    else if(this.game.phase==='abortive')this.showAbortive();
    else if(this.game.phase==='sessionEnd')this.showSessionEnd();
  }

  renderWalls(){
    const g=this.game;
    const make=(el,side)=>{
      const stacks=Array.from({length:17},(_,i)=>`<span class="fnm-stack${i<g.kanCount?' used':''}"><i></i><i></i></span>`).join('');
      el.className=`fnm-wall fnm-wall-${side}`;
      el.innerHTML=stacks;
    };
    make($(this.host,'#wallTop'),'top');
    make($(this.host,'#wallRight'),'right');
    make($(this.host,'#wallBottom'),'bottom');
    make($(this.host,'#wallLeft'),'left');
  }

  renderSeats(){
    const g=this.game;
    for(let s=0;s<4;s++){
      const p=g.players[s];
      const card=$(this.host,`#card${s}`);
      if(card){
        card.classList.toggle('active',g.current===s);
        card.classList.toggle('riichi',p.riichi);
        card.querySelector('i').textContent=WINDS[p.wind];
        card.querySelector('b').textContent=p.name;
        card.querySelector('strong').textContent=fmt(p.score);
      }

      const hand=$(this.host,`#hand${s}`);
      const meld=$(this.host,`#meld${s}`);
      const river=$(this.host,`#river${s}`);
      const seatEl=card?.closest('.fnm-seat') || hand?.closest('.fnm-seat');
      seatEl?.classList.toggle('has-melds',p.melds.length>0);
      seatEl?.style.setProperty('--meld-count',String(p.melds.length));
      seatEl?.style.setProperty('--meld-shift',`${Math.min(155,40+(p.melds.length*38))}px`);
      meld.innerHTML=p.melds.map(m=>this.renderMeld(m,s)).join('');
      river.innerHTML=p.river.map((r,i)=>{
        const pos=this.riverGridPosition(s,i);
        return `<span class="fnm-river-tile${r.riichi?' riichi-discard':''}${r.id===g.discardSerial?' last':''}" style="grid-column:${pos.col};grid-row:${pos.row}">${imageTile(r.tile)}</span>`;
      }).join('');

      if(s===0 && g.phase!=='drawEnd'){
        const entries=p.hand.map((t,i)=>({t,i}));
        const drawIndex=p.lastDraw==null?-1:[...entries].map((x)=>x.t===p.lastDraw?x.i:-1).filter(i=>i>=0).pop()??-1;
        const riichiWaits=waitsFor(p);
        const waitStatus=riichiWaits.length?furitenStatus(p,riichiWaits):null;
        const waitBanner=riichiWaits.length
          ? `<div class="fnm-riichi-wait-banner"><span>待ち</span><div class="fnm-wait-tiles">${waitImages(riichiWaits)}</div>${furitenLabel(waitStatus)}</div>`
          : '';
        hand.innerHTML=waitBanner+entries.filter(x=>x.i!==drawIndex).map(({t,i})=>
          `<button class="fnm-hand-tile${p.forbidden.includes(tileBase(t))?' disabled':''}" data-hand-index="${i}">${imageTile(t)}</button>`
        ).join('');
        if(drawIndex>=0){
          const t=p.hand[drawIndex];
          hand.innerHTML+=`<button class="fnm-hand-tile fnm-tsumo" data-hand-index="${drawIndex}">${imageTile(t)}</button>`;
        }
      }else{
        const reveal= g.phase==='drawEnd' && (g.pending?.tenpai||[]).includes(s);
        hand.innerHTML=reveal
          ? p.hand.map(t=>imageTile(t)).join('')
          : Array.from({length:p.hand.length},()=>backTile()).join('');
      }
    }
  }


  riverGridPosition(s,i){
    const n=Math.min(17,Math.max(0,i));
    const row=Math.floor(n/6),col=n%6;
    // Every player gets the same local river order: left -> right, then next row.
    // The entire river grid is rotated by CSS into that player's physical view.
    return {col:col+1,row:row+1};
  }

  renderMeld(m,s){
    const raw=m.tiles.slice();
    const calledTile=m.calledTile!=null?tileBase(m.calledTile):null;
    const calledIndex=m.type==='ankan'?-1:(m.calledAt??calledSlot(s,m.from??s));
    const addedIndex=m.addedIndex??-1;
    let slots=raw.slice();

    if(m.type!=='ankan'&&calledTile!=null){
      const actualIndex=raw.findIndex(t=>tileBase(t)===calledTile);
      const called=actualIndex>=0?raw[actualIndex]:raw[raw.length-1];
      const rest=raw.slice();
      const idx=rest.indexOf(called);
      if(idx>=0)rest.splice(idx,1);
      rest.sort((a,b)=>idOf(a)-idOf(b));
      const pos=Math.max(0,Math.min(raw.length-1,calledIndex>=0?calledIndex:raw.length-1));
      slots=[];
      for(let i=0;i<raw.length;i++)slots.push(i===pos?called:rest.shift());
    }

    return `<span class="fnm-meld-group ${esc(m.type)}">${slots.map((t,i)=>{
      const pos=Math.max(0,Math.min(raw.length-1,calledIndex>=0?calledIndex:raw.length-1));
      const isCalled=m.type!=='ankan'&&calledTile!=null&&i===pos;
      const isAdded=i===addedIndex;
      const face=(m.type==='ankan'&&(i===0||i===raw.length-1))?backTile():imageTile(t);
      return `<span class="fnm-meld-tile${isCalled?' is-called':''}${isAdded?' is-added':''}">${face}</span>`;
    }).join('')}</span>`;
  }

  renderCenter(){
    const g=this.game;
    const wind=g.roundIndex<4?'東':g.roundIndex<8?'南':'西';
    const num=(g.roundIndex%4)+1;
    $(this.host,'#roundText').textContent=`${wind}${num}局`;
    $(this.host,'#honbaText').textContent=g.honba>0?`${g.honba}本場`:'0本場';
    $(this.host,'#remainText').textContent=fmt(g.wall.length);

    const kyotakuCount=$(this.host,'#kyotakuCount');
    if(kyotakuCount)kyotakuCount.textContent=String(g.riichiSticks);
    const honbaArea=$(this.host,'#honbaStickArea');
    if(honbaArea){
      honbaArea.innerHTML=Array.from({length:g.honba},()=>'<img class="fnm-point-stick honba-stick" src="./assets/images/100.gif" alt="" draggable="false">').join('');
    }
    $(this.host,'#doraArea').innerHTML=g.doraIndicators.map(t=>imageTile(t)).join('');

    for(let s=0;s<4;s++){
      const p=g.players[s];
      const item=$(this.host,`[data-center-seat="${s}"]`);
      const w=$(this.host,`#centerWind${s}`);
      const score=$(this.host,`#centerScore${s}`);
      if(item){
        item.classList.toggle('is-self',s===0);
        item.classList.toggle('is-active',g.current===s);
        item.classList.toggle('is-riichi',p.riichi);
      }
      if(w)w.textContent=WINDS[p.wind];
      if(score)score.textContent=fmt(p.score);
      const riichiStick=item?.querySelector('.fnm-score-riichi-stick');
      if(riichiStick){
        riichiStick.innerHTML=p.riichi?'<img class="fnm-point-stick riichi-stick" src="./assets/images/1000.gif" alt="" draggable="false">':'';
        riichiStick.hidden=!p.riichi;
      }
      const card=$(this.host,`#card${s}`);
      if(card){
        const badge=card.querySelector('.fnm-card-riichi');
        if(badge)badge.hidden=!p.riichi;
      }
    }
  }

  renderActions(){
    const el=$(this.host,'#ops');
    el.innerHTML=this.humanActions().map(a=>
      `<button type="button" data-action="${esc(a.id)}" class="${a.primary?'primary':''}${a.danger?' danger':''}">${esc(a.label)}</button>`
    ).join('');
  }

  renderPrompt(){
    const el=$(this.host,'#prompt');
    el.textContent=this.riichiMode?'立直：宣言牌を選択':'';
  }

  renderCallCutin(){
    const box=$(this.host,'#callCutin');
    const ev=this.game.lastCall;
    if(!ev||ev.id===this.lastCallId)return;
    this.lastCallId=ev.id;

    const label={pon:'ポン',chi:'チー',daiminkan:'大明槓',ankan:'暗槓',kakan:'加槓'}[ev.type]||ev.type;
    const tiles=ev.tiles.map(imageTile).join('');
    box.className=`fnm-callcutin seat-${ev.seat}`;
    box.innerHTML=`<b class="fnm-call-label">${label}</b><span class="fnm-cut-tiles">${tiles}</span>`;
    box.classList.remove('hidden');
    if(this.callTimer)clearTimeout(this.callTimer);
    this.callTimer=setTimeout(()=>box.classList.add('hidden'),1600);
  }

  showRuntimeError(err){
    const ov=$(this.host,'#overlay');
    if(!ov)return;
    ov.classList.remove('hidden');
    ov.innerHTML=`<div class="fnm-result fnm-error"><small>対局エラー</small><h2>対局を停止しました</h2><p>${esc(err?.stack||err?.message||String(err))}</p></div>`;
  }

  playYakumanTsumoEffect(key,done){
    const ov=$(this.host,'#overlay');
    if(!ov)return;
    try{if(typeof S!=='undefined'&&!S.sound){this.winEffectPlaying=false;done?.();return}}catch(_){ }
    this.winEffectPlaying=true;
    ov.classList.remove('hidden');
    ov.innerHTML=`<div class="fnm-yakuman-effect"><video class="fnm-yakuman-video" playsinline webkit-playsinline preload="auto"></video></div>`;
    const video=$(this.host,'.fnm-yakuman-video');
    if(!video){this.winEffectPlaying=false;done?.();return}
    video.src='./assets/video/puchun_effect.mp4';
    video.muted=false;
    video.volume=1;
    let finished=false;
    const clearEffectTimers=()=>{
      for(const id of this.winEffectTimers)clearTimeout(id);
      this.winEffectTimers.clear();
    };
    const scheduleEffectFinish=ms=>{
      const id=setTimeout(()=>{this.winEffectTimers.delete(id);finish()},ms);
      this.winEffectTimers.add(id);
    };
    const finish=()=>{
      if(finished)return;
      finished=true;
      clearEffectTimers();
      try{video.pause()}catch(_){ }
      try{video.removeAttribute('src');video.load()}catch(_){ }
      this.winEffectPlaying=false;
      mahjongAudio('tsumo');
      done?.();
    };
    video.addEventListener('ended',finish,{once:true});
    video.addEventListener('error',()=>{
      if(finished)return;
      try{mahjongAudio('puchun')}catch(_){ }
      scheduleEffectFinish(1700);
    },{once:true});
    scheduleEffectFinish(2100);
    try{
      const play=video.play();
      if(play&&typeof play.catch==='function'){
        play.catch(()=>{
          try{video.muted=true;const retry=video.play();if(retry&&typeof retry.catch==='function')retry.catch(()=>{ })}catch(_){ }
          try{mahjongAudio('puchun')}catch(_){ }
        });
      }
    }catch(_){
      try{mahjongAudio('puchun')}catch(_){ }
    }
  }


  showWin(){
    const g=this.game,w=g.pending?.winners||[],ov=$(this.host,'#overlay');
    if(!w.length)return;
    const names=w.map(x=>g.players[x.seat].name).join('・');
    const winKey=`${g.roundIndex}:${g.discardSerial}:${w.map(x=>`${x.seat}-${x.tile}-${x.tsumo?'T':'R'}`).join(',')}`;
    const selfYakumanTsumo=w.length===1&&w[0].seat===0&&w[0].tsumo&&!!w[0].score?.yakuman;
    if(selfYakumanTsumo&&this.winEffectKey!==winKey){
      this.winEffectKey=winKey;
      this.playYakumanTsumoEffect(winKey,()=>this.render());
      return;
    }
    if(!selfYakumanTsumo&&this.winSoundKey!==winKey){
      this.winSoundKey=winKey;
      mahjongAudio(w[0].tsumo?'tsumo':'ron');
    }
    ov.classList.remove('hidden');
    ov.innerHTML=`<div class="fnm-result fnm-win-result"><small>${w[0].tsumo?'ツモ':'ロン'}${w.length>1?' / '+(w.length===2?'ダブル':'トリプル')+'ロン':''}</small>
      <h2>${esc(names)}<span>和了</span></h2>
      ${w.map(x=>`<section class="fnm-win-player"><b>${esc(g.players[x.seat].name)}</b>
        <div class="fnm-yaku fnm-win-yaku">${x.score.yaku.map(y=>`<span>${esc(y.name)}${y.yakuman?'・役満':'・'+y.han+'翻'}</span>`).join('')}</div>
        <div class="fnm-win-hanfu">${x.score.yakuman?x.score.limit:(x.score.han+'翻 '+x.score.fu+'符')}</div>
        <strong class="fnm-win-score">${esc(this.paymentText(x))}</strong>
      </section>`).join('')}
      <button data-next>次へ</button></div>`;
  }

  showDraw(){
    const g=this.game,r=g.pending||{},ov=$(this.host,'#overlay');
    ov.classList.remove('hidden');
    const ten=(r.tenpai||[]).map(s=>g.players[s].name).join('・')||'なし';
    ov.innerHTML=`<div class="fnm-result"><small>流局</small><h2>荒牌平局</h2><p>聴牌: ${esc(ten)}</p>
      ${r.nagashi?.length?`<p>流し満貫: ${r.nagashi.map(s=>esc(g.players[s].name)).join('・')}</p>`:''}
      <button data-next>次へ</button></div>`;
  }

  showAbortive(){
    const g=this.game,ov=$(this.host,'#overlay');
    ov.classList.remove('hidden');
    ov.innerHTML=`<div class="fnm-result"><small>途中流局</small><h2>${esc(g.pending?.reason||'途中流局')}</h2><p>親継続・本場加算</p><button data-next>次へ</button></div>`;
  }

  showSessionEnd(){
    const g=this.game,ov=$(this.host,'#overlay'),rows=g.sessionResult?.players||[];
    ov.classList.remove('hidden');
    ov.innerHTML=`<div class="fnm-result"><small>対局終了</small><h2>${esc(g.sessionResult?.reason||'終局')}</h2>
      ${rows.map((p,i)=>`<section><b>${i+1}位　${esc(p.name)}</b><strong>${fmt(p.score)}点</strong><p>精算 ${p.final>=0?'+':''}${p.final.toFixed(1)}</p></section>`).join('')}
    </div>`;
  }

  paymentText(w){
    const g=this.game,p=g.players[w.seat],base=w.score.base,h=g.honba;
    if(w.tsumo){
      if(p.wind===0){
        const each=Math.ceil(base*2/100)*100+h*RULES.honbaTsumo;
        return `子各 ${fmt(each)}点`;
      }
      const ko=Math.ceil(base/100)*100+h*RULES.honbaTsumo;
      const dealer=Math.ceil(base*2/100)*100+h*RULES.honbaTsumo;
      return `親 ${fmt(dealer)}点 / 子 ${fmt(ko)}点`;
    }
    const pay=(p.wind===0?Math.ceil(base*6/100)*100:Math.ceil(base*4/100)*100)+h*RULES.honbaRon;
    return `${fmt(pay)}点`;
  }

  advanceAfterResult(){
    const g=this.game;
    if(g.phase==='sessionEnd')return;
    if(g.phase==='win')this.applyWin();
    else if(g.phase==='drawEnd'||g.phase==='abortive')this.applyDraw();
    if(g.phase==='sessionEnd'){this.render();return}
    g.startHand(false);
    if(g.phase==='sessionEnd'){this.render();return}
    this.riichiMode=false;
    this.winEffectKey=null;
    this.winEffectPlaying=false;
    this.winSoundKey=null;
    const ov=$(this.host,'#overlay');
    ov.classList.add('hidden');
    this.render();
  }

  applyWin(){
    const g=this.game,winners=g.pending?.winners||[];
    if(!winners.length)return;
    const sticks=g.riichiSticks*1000;
    this.applyPayments(winners);
    if(g.players.some(p=>p.score<0)){g.endSession('飛び終了');return}
    const dealerWin=winners.some(w=>w.seat===g.dealer);
    const leader=Math.max(...g.players.map(p=>p.score));
    const south4=g.roundIndex===7,west4=g.roundIndex===11;
    if(south4&&dealerWin&&g.players[g.dealer].score>=RULES.firstRequiredPoints){g.endSession('あがりやめ');return}
    if((south4||g.roundIndex>7)&&leader>=RULES.firstRequiredPoints&&!dealerWin){g.endSession(south4?'オーラス終了':'サドンデス終了');return}
    if(west4){g.endSession('西4局終了');return}
    if(sticks){
      const head=[...winners].sort((a,b)=>(a.distance??0)-(b.distance??0))[0];
      if(head)g.players[head.seat].score+=sticks;
      g.riichiSticks=0;
    }
    if(dealerWin){g.honba++;g._advance=0}
    else{g.honba=0;g.dealer=(g.dealer+1)%4;g._advance=1}
  }

  applyPayments(winners){
    const g=this.game;
    const rounded=(base,n)=>Math.ceil(base*n/100)*100;
    if(winners[0].tsumo){
      const w=winners[0],p=g.players[w.seat],allBase=w.score.base,paoBase=8000*(w.score.paoYakuman||0),normalBase=allBase-paoBase;
      const honbaT=g.honba*RULES.honbaTsumo,honbaR=g.honba*RULES.honbaRon;
      const normalHonba=paoBase?0:honbaT;
      if(paoBase&&w.score.pao!=null){
        const liable=g.players[w.score.pao];
        const paoTotal=(p.wind===0?paoBase*6:paoBase*4)+honbaR;
        liable.score-=paoTotal;p.score+=paoTotal;
      }
      if(normalBase>0){
        if(p.wind===0){
          const each=rounded(normalBase,2)+normalHonba;
          for(const q of g.players)if(q.seat!==p.seat)q.score-=each;
          p.score+=each*3;
        }else{
          const dp=rounded(normalBase,2)+normalHonba,cp=rounded(normalBase,1)+normalHonba;
          for(const q of g.players)if(q.seat!==p.seat)q.score-=q.wind===0?dp:cp;
          p.score+=dp+cp*2;
        }
      }
    }else{
      const head=winners[0];
      const p=g.players[head.seat],base=head.score.base,honba=g.honba*RULES.honbaRon;
      const pay=(p.wind===0?rounded(base,6):rounded(base,4))+honba;
      const losers=winners.map(w=>w.seat);
      // Simultaneous ron: pay each winning hand separately, but the same discarder's payment is split by winner.
      const winnerSeats=new Set(winners.map(w=>w.seat));
      const discarder=head.from;
      const targetLosers=[...g.players].filter(q=>q.seat===discarder&&!winnerSeats.has(q.seat));
      if(discarder!=null&&targetLosers.length){
        for(const w of winners){
          const wp=g.players[w.seat],fee=(wp.wind===0?rounded(w.score.base,6):rounded(w.score.base,4))+honba;
          wp.score+=fee;
          g.players[discarder].score-=fee;
        }
      }else{
        for(const w of winners){
          const wp=g.players[w.seat],fee=(wp.wind===0?rounded(w.score.base,6):rounded(w.score.base,4))+honba;
          wp.score+=fee;
        }
      }
    }
  }

  applyDraw(){
    const g=this.game,r=g.pending||{},nagashi=[...(r.nagashi||[])],nagashiSet=new Set(nagashi),ten=new Set(r.tenpai||[]);
    if(nagashi.length){
      for(const seat of nagashi){
        const p=g.players[seat];
        if(p.wind===0){
          const pay=4000;
          for(const q of g.players)if(q.seat!==seat&&!nagashiSet.has(q.seat)){q.score-=pay;p.score+=pay}
        }else{
          const childPay=2000,dealerPay=4000;
          for(const q of g.players){
            if(q.seat===seat||nagashiSet.has(q.seat))continue;
            const pay=q.wind===0?dealerPay:childPay;
            q.score-=pay;p.score+=pay;
          }
        }
      }
    }else{
      const n=ten.size;
      if(n&&n<4){
        const gain=RULES.notenTotal/n,loss=RULES.notenTotal/(4-n);
        for(const p of g.players)p.score+=ten.has(p.seat)?gain:-loss;
      }
    }
    if(g.players.some(p=>p.score<0)){g.endSession('飛び終了');return}
    const dealerTen=ten.has(g.dealer)||nagashiSet.has(g.dealer);
    const leader=Math.max(...g.players.map(p=>p.score));
    const south4=g.roundIndex===7,west4=g.roundIndex===11;
    if(south4&&dealerTen&&g.players[g.dealer].score>=RULES.firstRequiredPoints){g.endSession('テンパイやめ');return}
    if((south4||g.roundIndex>7)&&leader>=RULES.firstRequiredPoints){g.endSession(south4?'オーラス終了':'サドンデス終了');return}
    if(west4){g.endSession('西4局終了');return}
    g.honba++;
    if(dealerTen)g._advance=0;
    else{g.dealer=(g.dealer+1)%4;g._advance=1}
  }
}
function pTxt(p){if(p.riichi)return '立直中';if(p.forbidden.length)return '牌を選んで打牌（食い替え禁止）';return '牌を選んで打牌'}

function safeStart(){
  const host=document.getElementById('modalContent');if(!host)throw new Error('modalContent が見つかりません');
  if(window.__FN_MJ_UI){try{window.__FN_MJ_UI.stop()}catch(_){} }
  host.classList.add('fn-mahjong-host');
  const ui=new MahjongUI(host);window.__FN_MJ_UI=ui;ui.start();
}
function safeStop(){const host=document.getElementById('modalContent');if(window.__FN_MJ_UI){try{window.__FN_MJ_UI.stop()}catch(_){}window.__FN_MJ_UI=null}host?.classList.remove('fn-mahjong-host')}
window.FN_MAHJONG_START=safeStart;window.FN_MAHJONG_STOP=safeStop;
})();
