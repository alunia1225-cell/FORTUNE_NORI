(function(){
  'use strict';
  // FORTUNE NOIR Mahjong — 4-player rebuild.
  // Game state/rules are delegated to Kobalab Majiang. No Sanma engine.
  let runtime=null, loading=null;
  const BASE='./';
  // Browser-safe package loader. The official packages are CommonJS; do not import
  // individual CJS files through jsDelivr +esm (that leaves require() unresolved).
  // esm.unpkg performs the CommonJS -> browser-module conversion and rewrites the
  // package dependency graph as one coherent module graph.
  // Browser runtime: use esm.sh bundle endpoints so CommonJS dependencies are
  // resolved server-side. GameCtl is intentionally NOT loaded; it was the source
  // of the previous runtime failure shown in the browser stack trace.
  const PKG={
    core:'https://esm.sh/@kobalab/majiang-core@1.3.5?bundle',
    ai:'https://esm.sh/@kobalab/majiang-ai@1.2.0?bundle',
    pai:'https://esm.sh/@kobalab/majiang-ui@1.6.1/lib/pai.js?bundle',
    board:'https://esm.sh/@kobalab/majiang-ui@1.6.1/lib/board.js?bundle',
    player:'https://esm.sh/@kobalab/majiang-ui@1.6.1/lib/player.js?bundle'
  };
  const tiles=['m0','m1','m2','m3','m4','m5','m6','m7','m8','m9','p0','p1','p2','p3','p4','p5','p6','p7','p8','p9','s0','s1','s2','s3','s4','s5','s6','s7','s8','s9','z1','z2','z3','z4','z5','z6','z7','pai'];
  const sounds=[['dapai','dahai11.wav'],['chi','chii.wav'],['peng','pon.wav'],['gang','kan.wav'],['rong','ron.wav'],['zimo','tsumo.wav'],['lizhi','richi.wav'],['gong','nc43994.wav'],['beep','beep.wav']];
  function boardHTML(){
    const t=tiles.map(x=>`<img class="pai" data-pai="${x}" src="${BASE}${x}.gif" alt="">`).join('');
    const a=sounds.map(([n,f])=>`<audio data-name="${n}" src="${BASE}${f}" preload></audio>`).join('');
    return `<div id="fnMahjongRoot" class="fn-mahjong-root"><div class="mj-landscape-warning"><div><b>MAHJONG</b><span>LANDSCAPE ONLY</span></div></div><div id="space"></div><div id="board"><div class="board">
      <div class="score"><div class="juchang"><div class="jushu"></div><div class="jicun"><img class="chouma" src="${BASE}100.gif" alt="本場"> : <span class="changbang"></span><br><img class="chouma" src="${BASE}1000.gif" alt="供託"> : <span class="lizhibang"></span></div></div><div class="shan"><div class="baopai"></div><div>牌数: <span class="paishu"></span></div></div><div class="defen"><div class="main"></div><div class="xiajia"></div><div class="duimian"></div><div class="shangjia"></div></div></div>
      <div class="timer hide"></div><div class="player-button hide"><span class="button cansel">×</span><span class="button daopai">ノー聴</span><span class="button chi">チー</span><span class="button peng">ポン</span><span class="button gang">カン</span><span class="button lizhi">リーチ</span><span class="button rong">ロン</span><span class="button zimo">ツモ</span><span class="button pingju">流局</span></div><div class="select-mianzi hide"></div>
      <div class="player main"></div><div class="shoupai main"><div class="bingpai"></div><div class="fulou"></div></div><div class="he main"><div class="lizhi"><img class="chouma hide" src="${BASE}1000.gif"></div><div class="dapai"></div></div><div class="say main"></div>
      <div class="player xiajia"></div><div class="shoupai xiajia"><div class="bingpai"></div><div class="fulou"></div></div><div class="he xiajia"><div class="lizhi"><img class="chouma hide" src="${BASE}1000.gif"></div><div class="dapai"></div></div><div class="say xiajia"></div>
      <div class="player duimian"></div><div class="shoupai duimian"><div class="bingpai"></div><div class="fulou"></div></div><div class="he duimian"><div class="lizhi"><img class="chouma hide" src="${BASE}1000.gif"></div><div class="dapai"></div></div><div class="say duimian"></div>
      <div class="player shangjia"></div><div class="shoupai shangjia"><div class="bingpai"></div><div class="fulou"></div></div><div class="he shangjia"><div class="lizhi"><img class="chouma hide" src="${BASE}1000.gif"></div><div class="dapai"></div></div><div class="say shangjia"></div>
      <div class="hule-dialog hide"><div><div><div class="hule"><div class="shan baopai"><span class="baopai"></span></div><div class="shan fubaopai"><span class="fubaopai"></span></div><div class="shoupai"><div class="bingpai"></div><div class="fulou"></div></div><table class="hupai"><tr class="r_hupai"><td class="name"></td><td class="fanshu"></td></tr><tr class="r_defen"><td class="defen" colspan="2"></td></tr></table><div class="jicun"><img class="chouma" src="${BASE}100.gif" alt="本場"> : <span class="changbang"></span> <img class="chouma" src="${BASE}1000.gif" alt="供託"> : <span class="lizhibang"></span></div></div><div class="pingju"></div><div class="fenpei"><div class="main"><span class="feng"></span> : <span class="player"></span><span class="defen"></span><span class="diff"></span></div><div class="xiajia"><span class="feng"></span> : <span class="player"></span><span class="defen"></span><span class="diff"></span></div><div class="duimian"><span class="feng"></span> : <span class="player"></span><span class="defen"></span><span class="diff"></span></div><div class="shangjia"><span class="feng"></span> : <span class="player"></span><span class="defen"></span><span class="diff"></span></div></div></div></div></div>
      <div class="summary"><div><div><table><thead><tr class="r_player"><td colspan="3"></td><th class="player"></th><th class="player"></th><th class="player"></th><th class="player"></th></tr></thead><tbody class="body"><tr class="r_diff"><th class="jushu"></th><th class="changbang"></th><th class="last"></th><td class="back"><span class="diff"></span><span class="lizhi"></span></td><td class="back"><span class="diff"></span><span class="lizhi"></span></td><td class="back"><span class="diff"></span><span class="lizhi"></span></td><td class="back"><span class="diff"></span><span class="lizhi"></span></td></tr></tbody><tfoot><tr class="r_defen"><td colspan="3"></td><td class="defen"></td><td class="defen"></td><td class="defen"></td><td class="defen"></td></tr><tr class="r_point"><td colspan="3"></td><td class="point"></td><td class="point"></td><td class="point"></td><td class="point"></td></tr></tfoot></table></div></div></div>
      <div class="kaiju"><div><div class="title"></div><div class="player"><div class="main"></div><div class="xiajia"></div><div class="duimian"></div><div class="shangjia"></div></div></div></div><div class="suspend hide"></div></div>
      <div class="controller"><img class="exit" src=""><img class="summary" src=""><img class="sound on" src=""><img class="sound off" src=""><img class="analyzer" src=""><img class="export" src=""><div></div><img class="first" src=""><img class="prev" src=""><img class="play on" src=""><img class="play off" src=""><img class="next" src=""><img class="last" src=""><div class="speed"><img class="minus" src=""><span></span><span></span><span></span><span></span><span></span><img class="plus" src=""></div></div></div></div><div id="loaddata" class="fn-mahjong-assets">${t}${a}</div></div>`;
  }
  async function loadStack(){
    if(loading)return loading;
    loading=(async()=>{
      const [core,ai,pai,board,player]=await Promise.all([
        import(PKG.core),import(PKG.ai),import(PKG.pai),import(PKG.board),import(PKG.player)
      ]);
      const Majiang=core.default||core;
      const AI=ai.default||ai;
      const paiFn=pai.default||pai;
      const Board=board.default||board;
      const Player=player.default||player;
      return {Majiang,AI,pai:paiFn,Board,Player};
    })();
    return loading;
  }
  function fit(){const b=document.querySelector('#fnMahjongRoot #board'),h=document.getElementById('modalContent');if(!b||!h)return;const w=h.clientWidth||innerWidth,hh=h.clientHeight||innerHeight,s=Math.min(w/800,hh/450);b.style.width='800px';b.style.height='450px';b.style.transformOrigin='0 0';b.style.transform=`scale(${s})`;b.style.left=`${(w-800*s)/2/s}px`;b.style.top=`${(hh-450*s)/2/s}px`;}
  async function start(){
    if(runtime)return runtime;
    const host=document.getElementById('modalContent');if(!host)throw new Error('FORTUNE NOIR modalContent not found');
    host.innerHTML=boardHTML();
    const {Majiang,AI,pai,Board,Player}=await loadStack();
    const board=host.querySelector('#board');
    const boardInner=host.querySelector('#board .board');
    const assetRoot=host.querySelector('#loaddata');
    const paiView=pai(assetRoot);
    const audioView=name=>assetRoot.querySelector(`audio[data-name="${name}"]`)||new Audio();
    const players=[new Player(board,paiView,audioView),new AI(),new AI(),new AI()];
    const rule=Majiang.rule({});
    const end=paipu=>{if(runtime)runtime.paipu=paipu||null;window.dispatchEvent(new CustomEvent('fn-mahjong-end',{detail:{paipu:paipu||null}}));};
    const game=new Majiang.Game(players,end,rule);game.view=new Board(boardInner,paiView,audioView,game.model);
    runtime={game,players,view:game.view,paipu:null,resizeHandler:fit};window.addEventListener('resize',fit,{passive:true});fit();game.kaiju();return runtime;
  }
  window.FN_MAHJONG_START=()=>start().catch(err=>{console.error('[FORTUNE NOIR] Mahjong 4P start failed',err);const host=document.getElementById('modalContent');if(host)host.innerHTML='<div class="fn-mj-error"><h2>MAHJONG LOAD ERROR</h2><pre>'+String(err.stack||err).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</pre></div>';});
  window.FN_MAHJONG_STOP=()=>{if(!runtime)return;try{runtime.game.stop&&runtime.game.stop()}catch(_){}window.removeEventListener('resize',runtime.resizeHandler);runtime=null;};
})();
