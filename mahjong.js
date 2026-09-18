(function(){
  'use strict';
  let runtime=null, loading=null;
  const BASE='./';
  const V='2.5.3';
  const URLS={
    jq:'https://esm.sh/jquery@3.7.1',
    core:'https://esm.sh/@kobalab/majiang-core@1.3.5',
    ai:'https://esm.sh/@kobalab/majiang-ai@1.2.0',
    ui:'https://esm.sh/@kobalab/majiang-ui@1.6.1'
  };
  function html(){
    const p=[
      ['m1','イーワン'],['m2','リャンワン'],['m3','サンワン'],['m4','スーワン'],['m5','ウーワン'],['m6','ローワン'],['m7','チーワン'],['m8','パーワン'],['m9','キューワン'],['m0','赤ウーワン'],
      ['p1','イーピン'],['p2','リャンピン'],['p3','サンピン'],['p4','スーピン'],['p5','ウーピン'],['p6','ローピン'],['p7','チーピン'],['p8','パーピン'],['p9','キューピン'],['p0','赤ウーピン'],
      ['s1','イーソー'],['s2','リャンソー'],['s3','サンソー'],['s4','スーソー'],['s5','ウーソー'],['s6','ローソー'],['s7','チーソー'],['s8','パーソー'],['s9','キューソー'],['s0','赤ウーソー'],
      ['z1','トン'],['z2','ナン'],['z3','シャー'],['z4','ペー'],['z5','ハク'],['z6','ハツ'],['z7','チュン'],['_','']
    ];
    const imgs=p.map(([id,alt])=>`<img class="pai" data-pai="${id}" src="${BASE}${id==='_'?'pai':id}.gif" alt="${alt}">`).join('');
    const audio=[['dapai','dahai11.wav'],['chi','chii.wav'],['peng','pon.wav'],['gang','kan.wav'],['rong','ron.wav'],['zimo','tsumo.wav'],['lizhi','richi.wav'],['gong','nc43994.wav'],['beep','beep.wav']].map(([n,f])=>`<audio data-name="${n}" src="${BASE}${f}" preload></audio>`).join('');
    return `<div id="fnMahjongRoot" class="fn-mahjong-root"><div id="space"></div><div id="board"><div class="board">
      <div class="score"><div class="juchang"><div class="jushu"></div><div class="jicun"><img class="chouma" src="${BASE}100.gif" alt="本場"> : <span class="changbang"></span><br><img class="chouma" src="${BASE}1000.gif" alt="供託"> : <span class="lizhibang"></span></div></div><div class="shan"><div class="baopai"></div><div>牌数: <span class="paishu"></span></div></div><div class="defen"><div class="main"></div><div class="xiajia"></div><div class="duimian"></div><div class="shangjia"></div></div></div>
      <div class="timer hide"></div><div class="player-button hide"><span class="button cansel">×</span><span class="button daopai">ノー聴</span><span class="button chi">チー</span><span class="button peng">ポン</span><span class="button gang">カン</span><span class="button lizhi">リーチ</span><span class="button rong">ロン</span><span class="button zimo">ツモ</span><span class="button pingju">流局</span></div><div class="select-mianzi hide"></div>
      <div class="player main"></div><div class="shoupai main"><div class="bingpai"></div><div class="fulou"></div></div><div class="he main"><div class="lizhi"><img class="chouma hide" src="${BASE}1000.gif"></div><div class="dapai"></div></div><div class="say main"></div>
      <div class="player xiajia"></div><div class="shoupai xiajia"><div class="bingpai"></div><div class="fulou"></div></div><div class="he xiajia"><div class="lizhi"><img class="chouma hide" src="${BASE}1000.gif"></div><div class="dapai"></div></div><div class="say xiajia"></div>
      <div class="player duimian"></div><div class="shoupai duimian"><div class="bingpai"></div><div class="fulou"></div></div><div class="he duimian"><div class="lizhi"><img class="chouma hide" src="${BASE}1000.gif"></div><div class="dapai"></div></div><div class="say duimian"></div>
      <div class="player shangjia"></div><div class="shoupai shangjia"><div class="bingpai"></div><div class="fulou"></div></div><div class="he shangjia"><div class="lizhi"><img class="chouma hide" src="${BASE}1000.gif"></div><div class="dapai"></div></div><div class="say shangjia"></div>
      <div class="hule-dialog hide"><div><div><div class="hule"><div class="shan baopai"><span class="baopai"></span></div><div class="shan fubaopai"><span class="fubaopai"></span></div><div class="shoupai"><div class="bingpai"></div><div class="fulou"></div></div><table class="hupai"><tr class="r_hupai"><td class="name"></td><td class="fanshu"></td></tr><tr class="r_defen"><td class="defen" colspan="2"></td></tr></table><div class="jicun"><img class="chouma" src="${BASE}100.gif" alt="本場"> : <span class="changbang"></span> <img class="chouma" src="${BASE}1000.gif" alt="供託"> : <span class="lizhibang"></span></div></div><div class="pingju"></div><div class="fenpei"><div class="main"><span class="feng"></span> : <span class="player"></span><span class="defen"></span><span class="diff"></span></div><div class="xiajia"><span class="feng"></span> : <span class="player"></span><span class="defen"></span><span class="diff"></span></div><div class="duimian"><span class="feng"></span> : <span class="player"></span><span class="defen"></span><span class="diff"></span></div><div class="shangjia"><span class="feng"></span> : <span class="player"></span><span class="defen"></span><span class="diff"></span></div></div></div></div></div>
      <div class="summary"><div><div><table><thead><tr class="r_player"><td colspan="3"></td><th class="player"></th><th class="player"></th><th class="player"></th><th class="player"></th></tr></thead><tbody class="body"><tr class="r_diff"><th class="jushu"></th><th class="changbang"></th><th class="last"></th><td class="back"><span class="diff"></span><span class="lizhi"></span></td><td class="back"><span class="diff"></span><span class="lizhi"></span></td><td class="back"><span class="diff"></span><span class="lizhi"></span></td><td class="back"><span class="diff"></span><span class="lizhi"></span></td></tr></tbody><tfoot><tr class="r_defen"><td colspan="3"></td><td class="defen"></td><td class="defen"></td><td class="defen"></td><td class="defen"></td></tr><tr class="r_point"><td colspan="3"></td><td class="point"></td><td class="point"></td><td class="point"></td><td class="point"></td></tr></tfoot></table></div></div></div>
      <div class="kaiju"><div><div class="title"></div><div class="player"><div class="main"></div><div class="xiajia"></div><div class="duimian"></div><div class="shangjia"></div></div></div></div>
      <div class="suspend hide"></div><div class="tenhou-dialog hide"><form><textarea rows="5" disabled></textarea><div class="button"><input type="button" value="閉じる"><input type="submit" value="コピー"></div></form></div>
    </div><div class="analyzer"></div><div class="download hide"></div><div class="controller"><img class="exit" src="${BASE}icon-exit.png"><img class="summary" src="${BASE}icon-list.png"><img class="sound on" src="${BASE}icon-volume-up.png"><img class="sound off" src="${BASE}icon-mutealt.png"><img class="analyzer" src="${BASE}icon-lightbulb-idea.png"><img class="export" src="${BASE}icon-export.png"><div></div><img class="first" src="${BASE}icon-step-backward.png"><img class="prev" src="${BASE}icon-backward.png"><img class="play on" src="${BASE}icon-play.png"><img class="play off" src="${BASE}icon-pause.png"><img class="next" src="${BASE}icon-forward.png"><img class="last" src="${BASE}icon-step-forward.png"><div class="speed"><img class="minus" src="${BASE}icon-minus-sign.png"><span></span><span></span><span></span><span></span><span></span><img class="plus" src="${BASE}icon-plus-sign.png"></div></div></div></div><div id="loaddata" class="fn-mahjong-assets">${imgs}<br>${audio}</div></div>`;
  }
  async function load(){
    if(loading)return loading;
    loading=(async()=>{
      const jqmod=await import(URLS.jq); const $=jqmod.default||jqmod.jQuery||jqmod; window.jQuery=$; window.$=$;
      const [core,ai,ui]=await Promise.all([import(URLS.core),import(URLS.ai),import(URLS.ui)]);
      const Majiang=core.default||core; Majiang.AI=ai.default||ai; Majiang.UI=ui.default||ui;
      return {Majiang,$};
    })();
    return loading;
  }
  function fit(){const root=document.getElementById('fnMahjongRoot'),board=document.querySelector('#fnMahjongRoot #board');if(!root||!board)return;const w=root.clientWidth||innerWidth,h=root.clientHeight||innerHeight,s=Math.min(w/800,h/450);board.style.transform=`scale(${s})`;board.style.left=`${Math.max(0,(w-800*s)/2/s)}px`;board.style.top=`${Math.max(0,(h-450*s)/2/s)}px`;}
  async function start(){
    if(runtime)return runtime;
    const host=document.getElementById('modalContent'); if(!host)throw new Error('FORTUNE NOIR modalContent not found'); host.innerHTML=html();
    const {Majiang,$}=await load(); const root=$('#fnMahjongRoot'), board=$('#board',root), assets=$('#loaddata',root);
    const pai=p=>{const key=String(p).slice(0,2),node=assets.find(`.pai[data-pai="${key}"]`).get(0);if(!node)throw new Error('Missing Mahjong tile asset: '+key);return $(node).clone();};
    const audio=name=>{const files={dapai:'dahai11.wav',chi:'chii.wav',peng:'pon.wav',gang:'kan.wav',rong:'ron.wav',zimo:'tsumo.wav',lizhi:'richi.wav',gong:'nc43994.wav',beep:'beep.wav'};const el=document.createElement('audio');el.src=BASE+files[name];el.preload='auto';el.volume=name==='gong'?1:.2;return el;};
    const players=[new Majiang.UI.Player(board,pai,audio),new Majiang.AI(),new Majiang.AI(),new Majiang.AI()];
    const rule=Majiang.rule({});
    const end=paipu=>{if(runtime)runtime.paipu=paipu||null;window.dispatchEvent(new CustomEvent('fn-mahjong-end',{detail:{paipu:paipu||null}}));};
    const game=new Majiang.Game(players,end,rule); game.view=new Majiang.UI.Board($('.board',board),pai,audio,game.model);
    runtime={game,players,view:game.view,paipu:null}; runtime.resize=fit; window.addEventListener('resize',fit,{passive:true}); fit();
    game.kaiju(0);
    // Use Kobalab's own kaiju click handler. No Player prototype override and no forced qipai.
    setTimeout(()=>{try{const n=$('.kaiju',board); if(game._status==='kaiju'&&n.length)n.trigger('click');}catch(e){console.error('[FORTUNE NOIR] Mahjong start click',e);}},50);
    return runtime;
  }
  window.FN_MAHJONG_START=()=>start().catch(err=>{console.error('[FORTUNE NOIR] Mahjong start failed',err);const host=document.getElementById('modalContent');if(host)host.innerHTML='<div class="fn-mj-error"><h2>MAHJONG LOAD ERROR</h2><pre>'+String(err.stack||err).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</pre></div>';});
  window.FN_MAHJONG_STOP=()=>{if(!runtime)return;try{runtime.game.stop&&runtime.game.stop()}catch(_){}window.removeEventListener('resize',runtime.resize);runtime=null;};
})();
