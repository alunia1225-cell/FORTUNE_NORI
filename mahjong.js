(function(){
  'use strict';

  /*
   * FORTUNE NOIR Mahjong
   *
   * This module is deliberately an adapter around the real Majiang stack:
   *   @kobalab/majiang-core 1.3.5
   *   @kobalab/majiang-ai   1.2.0
   *   @kobalab/majiang-ui   1.6.1
   *
   * The game is client-side only. worker.js / the FORTUNE NOIR server are not
   * involved. Majiang's own Board, Player, Game and AI classes are used rather
   * than a second hand-written Mahjong engine.
   */

  let runtime = null;
  let loading = null;

  const BASE = './';
  const CDN = {
    core: 'https://esm.sh/@kobalab/majiang-core@1.3.5?bundle',
    ai:   'https://esm.sh/@kobalab/majiang-ai@1.2.0?bundle',
    ui:   'https://esm.sh/@kobalab/majiang-ui@1.6.1?bundle',
    jq:   'https://esm.sh/jquery@3.7.1'
  };

  const tileNames = [
    'm1','m2','m3','m4','m5','m6','m7','m8','m9','m0',
    'p1','p2','p3','p4','p5','p6','p7','p8','p9','p0',
    's1','s2','s3','s4','s5','s6','s7','s8','s9','s0',
    'z1','z2','z3','z4','z5','z6','z7','_'
  ];

  const audioNames = [
    ['dapai','dahai11.wav'], ['chi','chii.wav'], ['peng','pon.wav'],
    ['gang','kan.wav'], ['rong','ron.wav'], ['zimo','tsumo.wav'],
    ['lizhi','richi.wav'], ['gong','nc43994.wav'], ['beep','beep.wav']
  ];

  function el(html){
    const t=document.createElement('template');
    t.innerHTML=html.trim();
    return t.content.firstElementChild;
  }

  function boardHTML(){
    const tiles = tileNames.map(t =>
      `<img class="pai" data-pai="${t}" src="${BASE}${t === '_' ? 'pai' : t}.gif" alt="">`
    ).join('');
    const audio = audioNames.map(([name,file]) =>
      `<audio data-name="${name}" src="${BASE}${file}" preload></audio>`
    ).join('');

    return `<div class="fn-mahjong-root" id="fnMahjongRoot">
      <div id="space"></div>
      <div id="board">
        <div class="board">
          <div class="score">
            <div class="juchang"><div class="jushu"></div><div class="jicun">
              <img class="chouma" src="${BASE}100.gif" alt="本場"> : <span class="changbang"></span><br>
              <img class="chouma" src="${BASE}1000.gif" alt="供託"> : <span class="lizhibang"></span>
            </div></div>
            <div class="shan"><div class="baopai"></div><div>牌数: <span class="paishu"></span></div></div>
            <div class="defen"><div class="main"></div><div class="xiajia"></div><div class="duimian"></div><div class="shangjia"></div></div>
          </div>

          <div class="player main"></div><div class="player xiajia"></div>
          <div class="player duimian"></div><div class="player shangjia"></div>

          <div class="shoupai main"><div class="bingpai"></div><div class="fulou"></div></div>
          <div class="shoupai xiajia"><div class="bingpai"></div><div class="fulou"></div></div>
          <div class="shoupai duimian"><div class="bingpai"></div><div class="fulou"></div></div>
          <div class="shoupai shangjia"><div class="bingpai"></div><div class="fulou"></div></div>

          <div class="he main"><div class="lizhi"><img class="chouma hide" src="${BASE}1000.gif"></div><div class="dapai"></div></div>
          <div class="he xiajia"><div class="lizhi"><img class="chouma hide" src="${BASE}1000.gif"></div><div class="dapai"></div></div>
          <div class="he duimian"><div class="lizhi"><img class="chouma hide" src="${BASE}1000.gif"></div><div class="dapai"></div></div>
          <div class="he shangjia"><div class="lizhi"><img class="chouma hide" src="${BASE}1000.gif"></div><div class="dapai"></div></div>

          <div class="say main"></div><div class="say xiajia"></div><div class="say duimian"></div><div class="say shangjia"></div>

          <div class="timer hide"></div>
          <div class="player-button hide">
            <span class="button cansel">×</span><span class="button daopai">ノー聴</span>
            <span class="button chi">チー</span><span class="button peng">ポン</span>
            <span class="button gang">カン</span><span class="button lizhi">リーチ</span>
            <span class="button rong">ロン</span><span class="button zimo">ツモ</span>
            <span class="button pingju">流局</span>
          </div>
          <div class="select-mianzi hide"></div>

          <div class="hule-dialog hide">
            <div><div><div class="hule">
              <div class="shan baopai"><span class="baopai"></span></div>
              <div class="shan fubaopai"><span class="fubaopai"></span></div>
              <div class="shoupai"><div class="bingpai"></div><div class="fulou"></div></div>
              <table class="hupai"><tr class="r_hupai"><td class="name"></td><td class="fanshu"></td></tr>
                <tr class="r_defen"><td class="defen" colspan="2"></td></tr></table>
              <div class="jicun"><img class="chouma" src="${BASE}100.gif"> : <span class="changbang"></span>
                <img class="chouma" src="${BASE}1000.gif"> : <span class="lizhibang"></span></div>
            </div><div class="pingju"></div><div class="fenpei"></div></div></div>
          </div>

          <div class="summary"><div><div><table><tbody class="body"></tbody></table></div></div></div>
          <div class="kaiju"><div><div class="title"></div><div class="player"><div class="main"></div><div class="xiajia"></div><div class="duimian"></div><div class="shangjia"></div></div></div></div>
        </div>
      </div>
      <div id="loaddata" class="fn-mj-loaddata">${tiles}${audio}</div>
    </div>`;
  }

  function makeAudio($, root){
    const map={};
    $('audio[data-name]', root).each(function(){ map[this.dataset.name]=this; });
    return name => map[name] || new Audio();
  }

  async function loadStack(){
    if (loading) return loading;
    loading = Promise.all([
      import(CDN.core), import(CDN.ai), import(CDN.ui), import(CDN.jq)
    ]).then(([coreMod, aiMod, uiMod, jqMod])=>({
      Majiang: coreMod.default || coreMod,
      AI: aiMod.default || aiMod,
      UI: uiMod.default || uiMod,
      $: jqMod.default || jqMod
    }));
    return loading;
  }

  async function start(){
    if (runtime) return runtime;

    const host=document.getElementById('modalContent');
    if (!host) throw new Error('FORTUNE NOIR modalContent not found');
    host.innerHTML=boardHTML();

    const stack=await loadStack();
    const {Majiang,AI,UI,$}=stack;
    const root=$('#fnMahjongRoot');
    const boardRoot=$('#board .board',root);
    const pai=UI.pai($('#loaddata',root));
    const audio=makeAudio($,root);

    // Majiang's stock 4-player setup: one human + three AI players.
    const players=[new UI.Player($('#board',root),pai,audio)];
    for(let i=1;i<4;i++) players[i]=new AI();

    let ended=false;
    const end=(paipu)=>{
      if(ended) return;
      ended=true;
      if(runtime) runtime.paipu=paipu||null;
      const msg=paipu ? '局終了 — 牌譜生成済み' : '対局終了';
      const banner=document.createElement('div');
      banner.className='fn-mj-finished';
      banner.textContent=msg;
      host.appendChild(banner);
    };

    const rule=Majiang.rule({});
    const game=new Majiang.Game(players,end,rule);
    const view=new UI.Board(boardRoot,pai,audio,game.model);
    game.view=view;
    view.open_shoupai=true;
    view.open_he=true;
    view.no_player_name=false;
    view.dummy_name=0;
    view.redraw();
    game.kaiju();

    // Keep Majiang's real game flow, but fit its 800x450 tablet board to the
    // existing FORTUNE NOIR modal viewport.
    function fit(){
      const space=document.getElementById('space');
      const b=document.querySelector('#fnMahjongRoot #board');
      if(!b||!space)return;
      const w=Math.max(320,space.clientWidth||window.innerWidth);
      const h=Math.max(260,space.clientHeight||window.innerHeight);
      const scale=Math.min(w/800,h/450);
      b.style.transform=`scale(${scale})`;
      b.style.left=`${Math.max(0,(w-800*scale)/2)/scale}px`;
      b.style.top=`${Math.max(0,(h-450*scale)/2)/scale}px`;
    }
    fit();
    window.addEventListener('resize',fit);

    runtime={game,view,players,root,fit,resizeHandler:fit,paipu:null};
    return runtime;
  }

  window.FN_MAHJONG_START=function(){
    start().catch(err=>{
      console.error('[FORTUNE NOIR] Majiang start failed',err);
      const host=document.getElementById('modalContent');
      if(host) host.innerHTML=`<div class="game"><h2>MAHJONG LOAD ERROR</h2><pre class="debug-error">${String(err.stack||err)}</pre></div>`;
    });
  };

  window.FN_MAHJONG_STOP=function(){
    if(!runtime)return;
    try{ runtime.game.stop && runtime.game.stop(); }catch(e){}
    try{ window.removeEventListener('resize',runtime.resizeHandler); }catch(e){}
    runtime=null;
  };
})();
