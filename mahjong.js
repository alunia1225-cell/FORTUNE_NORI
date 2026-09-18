(function(){
  'use strict';
  let runtime=null, loading=null;
  const BASE='./';
  const URLS={
    jq:'jquery',
    core:'@kobalab/majiang-core',
    ai:'@kobalab/majiang-ai',
    ui:'@kobalab/majiang-ui'
  };
  async function load(){
    if(loading)return loading;
    loading=(async()=>{
      // Load jQuery first so the official majiang-ui selector helpers
      // see the same global jQuery instance from their first invocation.
      const jqmod=await import(URLS.jq);
      const $=jqmod.default||jqmod.jQuery||jqmod;
      window.jQuery=$; window.$=$;
      const [core,ai,ui]=await Promise.all([
        import(URLS.core), import(URLS.ai), import(URLS.ui)
      ]);
      const Majiang=core.default||core;
      Majiang.AI=ai.default||ai;
      Majiang.UI=ui.default||ui;
      return {Majiang,$};
    })();
    return loading;
  }
  function fit(){
    const root=document.getElementById('fnMahjongRoot'),board=document.querySelector('#fnMahjongRoot #board');
    if(!root||!board)return;
    const w=root.clientWidth||innerWidth,h=root.clientHeight||innerHeight;
    const s=Math.min(w/800,h/450);
    board.style.transform=`scale(${s})`;
    board.style.left=`${Math.max(0,(w-800*s)/2/s)}px`;
    board.style.top=`${Math.max(0,(h-450*s)/2/s)}px`;
  }
  async function start(){
    if(runtime)return runtime;
    const host=document.getElementById('modalContent');
    if(!host)throw new Error('FORTUNE NOIR modalContent not found');
    host.innerHTML=html();
    const {Majiang,$}=await load();
    const root=$('#fnMahjongRoot');
    const board=$('#board',root);
    const assetRoot=$('#loaddata',root);
    const pai=Majiang.UI.pai(assetRoot);
    const audio=Majiang.UI.audio(assetRoot);
    const players=[new Majiang.UI.Player(board,pai,audio),new Majiang.AI(),new Majiang.AI(),new Majiang.AI()];
    const rule=Majiang.rule({});
    const end=paipu=>{if(runtime)runtime.paipu=paipu||null;window.dispatchEvent(new CustomEvent('fn-mahjong-end',{detail:{paipu:paipu||null}}));};
    const game=new Majiang.Game(players,end,rule);
    game.view=new Majiang.UI.Board($('.board',board),pai,audio,game.model);
    new Majiang.UI.GameCtl(board,'Majiang.pref',game,game.view);
    runtime={game,players,view:game.view,paipu:null};
    const resize=fit;runtime.resize=resize;window.addEventListener('resize',resize,{passive:true});fit();game.kaiju();
    return runtime;
  }
  window.FN_MAHJONG_START=()=>start().catch(err=>{console.error('[FORTUNE NOIR] Mahjong 4P start failed',err);const host=document.getElementById('modalContent');if(host)host.innerHTML='<div class="fn-mj-error"><h2>MAHJONG LOAD ERROR</h2><pre>'+String(err.stack||err).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</pre></div>';});
  window.FN_MAHJONG_STOP=()=>{if(!runtime)return;try{runtime.game.stop&&runtime.game.stop()}catch(_){}window.removeEventListener('resize',runtime.resize);runtime=null;};
})();
