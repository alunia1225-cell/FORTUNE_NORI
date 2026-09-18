(function(){
  'use strict';
  let runtime=null, loading=null;
  const BASE='./';
  const URLS={
    jq:'jquery',
    core:'@kobalab/majiang-core',
    ai:'@kobalab/majiang-ai',
    uiPlayer:'@kobalab/majiang-ui/lib/player.js',
    uiBoard:'@kobalab/majiang-ui/lib/board.js',
  };
  function html(){
    const p=[
      ['m1','イーワン'],['m2','リャンワン'],['m3','サンワン'],['m4','スーワン'],['m5','ウーワン'],['m6','ローワン'],['m7','チーワン'],['m8','パーワン'],['m9','キューワン'],['m0','赤ウーワン'],
      ['p1','イーピン'],['p2','リャンピン'],['p3','サンピン'],['p4','スーピン'],['p5','ウーピン'],['p6','ローピン'],['p7','チーピン'],['p8','パーピン'],['p9','キューピン'],['p0','赤ウーピン'],
      ['s1','イーソー'],['s2','リャンソー'],['s3','サンソー'],['s4','スーソー'],['s5','ウーソー'],['s6','ローソー'],['s7','チーソー'],['s8','パーソー'],['s9','キューソー'],['s0','赤ウーソー'],
      ['z1','トン'],['z2','ナン'],['z3','シャー'],['z4','ペー'],['z5','ハク'],['z6','ハツ'],['z7','チュン'],['_','']
    ];
    const imgs=p.map(([id,alt])=>`<img class="pai" data-pai="${id}" src="${BASE}${id==='_'?'pai':id}.gif" alt="${alt}">`).join('');
    const audio=[['dapai','dahai11.wav',.2],['chi','chii.wav',.2],['peng','pon.wav',.2],['gang','kan.wav',.2],['rong','ron.wav',.2],['zimo','tsumo.wav',.2],['lizhi','richi.wav',.2],['gong','nc43994.wav',1],['beep','beep.wav',.2]].map(([n,f,v])=>`<audio data-name="${n}" src="${BASE}${f}" volume="${v}" preload></audio>`).join('');
    return `<div id="fnMahjongRoot" class="fn-mahjong-root"><div id="space"></div><div id="board"><div class="board">
      <div class="score"><div class="juchang"><div class="jushu"></div><div class="jicun"><img class="chouma" src="${BASE}100.gif" alt="本場"> : <span class="changbang"></span><br><img class="chouma" src="${BASE}1000.gif" alt="供託"> : <span class="lizhibang"></span></div></div><div class="shan"><div class="baopai"></div><div>牌数: <span class="paishu"></span></div></div><div class="defen"><div class="main"></div><div class="xiajia"></div><div class="duimian"></div><div class="shangjia"></div></div></div>
      <div class="timer hide"></div><div class="player-button hide"><span class="button cansel" aria-label="キャンセル">×</span><span class="button daopai">ノー聴</span><span class="button chi">チー</span><span class="button peng">ポン</span><span class="button gang">カン</span><span class="button lizhi">リーチ</span><span class="button rong">ロン</span><span class="button zimo">ツモ</span><span class="button pingju">流局</span></div><div class="select-mianzi hide"></div>
      <div class="player main"></div><div class="shoupai main"><div class="bingpai"></div><div class="fulou"></div></div><div class="he main"><div class="lizhi"><img class="chouma hide" src="${BASE}1000.gif"></div><div class="dapai"></div></div><div class="say main"></div>
      <div class="player xiajia"></div><div class="shoupai xiajia"><div class="bingpai"></div><div class="fulou"></div></div><div class="he xiajia"><div class="lizhi"><img class="chouma hide" src="${BASE}1000.gif"></div><div class="dapai"></div></div><div class="say xiajia"></div>
      <div class="player duimian"></div><div class="shoupai duimian"><div class="bingpai"></div><div class="fulou"></div></div><div class="he duimian"><div class="lizhi"><img class="chouma hide" src="${BASE}1000.gif"></div><div class="dapai"></div></div><div class="say duimian"></div>
      <div class="player shangjia"></div><div class="shoupai shangjia"><div class="bingpai"></div><div class="fulou"></div></div><div class="he shangjia"><div class="lizhi"><img class="chouma hide" src="${BASE}1000.gif"></div><div class="dapai"></div></div><div class="say shangjia"></div>
      <div class="hule-dialog hide"><div><div><div class="hule"><div class="shan baopai"><span class="baopai"></span></div><div class="shan fubaopai"><span class="fubaopai"></span></div><div class="shoupai"><div class="bingpai"></div><div class="fulou"></div></div><table class="hupai"><tr class="r_hupai"><td class="name"></td><td class="fanshu"></td></tr><tr class="r_defen"><td class="defen" colspan="2"></td></tr></table><div class="jicun"><img class="chouma" src="${BASE}100.gif" alt="本場"> : <span class="changbang"></span> <img class="chouma" src="${BASE}1000.gif" alt="供託"> : <span class="lizhibang"></span></div></div><div class="pingju"></div><div class="fenpei"><div class="main"><span class="feng"></span> : <span class="player"></span><span class="defen"></span><span class="diff"></span></div><div class="xiajia"><span class="feng"></span> : <span class="player"></span><span class="defen"></span><span class="diff"></span></div><div class="duimian"><span class="feng"></span> : <span class="player"></span><span class="defen"></span><span class="diff"></span></div><div class="shangjia"><span class="feng"></span> : <span class="player"></span><span class="defen"></span><span class="diff"></span></div></div></div></div></div>
      <div class="summary"><div><div><table><thead><tr class="r_player"><td colspan="3"></td><th class="player"></th><th class="player"></th><th class="player"></th><th class="player"></th></tr></thead><tbody class="body"><tr class="r_diff"><th class="jushu"></th><th class="changbang"></th><th class="last"></th><td class="back"><span class="diff"></span><span class="lizhi"></span></td><td class="back"><span class="diff"></span><span class="lizhi"></span></td><td class="back"><span class="diff"></span><span class="lizhi"></span></td><td class="back"><span class="diff"></span><span class="lizhi"></span></td></tr></tbody><tfoot><tr class="r_defen"><td colspan="3"></td><td class="defen"></td><td class="defen"></td><td class="defen"></td><td class="defen"></td></tr><tr class="r_point"><td colspan="3"></td><td class="point"></td><td class="point"></td><td class="point"></td><td class="point"></td></tr></tfoot></table></div></div></div>
      <div class="kaiju"><div><div class="title"></div><div class="player"><div class="main"></div><div class="xiajia"></div><div class="duimian"></div><div class="shangjia"></div></div></div></div><div class="suspend hide"></div><div class="tenhou-dialog hide"><form><ul><li><label><input name="type" type="radio" value="URL" checked>URL形式</label></li><li><label><input name="type" type="radio" value="JSON">JSON形式</label></li><li><label><input name="limited" type="checkbox" value="1">この局のみ</label></li></ul><textarea rows="5" disabled></textarea><div class="button"><input type="button" value="閉じる"><input type="submit" value="コピー"></div></form></div>
    </div><div class="analyzer"></div><div class="download hide"></div><div class="controller"><img class="exit" src="${BASE}icon-exit.png" title="終了 [q]"><img class="summary" src="${BASE}icon-list.png" title="集計表示 [?]"><img class="sound on" src="${BASE}icon-volume-up.png" title="音声OFF [a]"><img class="sound off" src="${BASE}icon-mutealt.png" title="音声ON [a]"><img class="analyzer" src="${BASE}icon-lightbulb-idea.png" title="検討ON/OFF [i]"><img class="export" src="${BASE}icon-export.png" title="天鳳牌譜 [t]"><div></div><img class="first" src="${BASE}icon-step-backward.png" title="配牌/前局 [←]"><img class="prev" src="${BASE}icon-backward.png" title="戻る [↑]"><img class="play on" src="${BASE}icon-play.png" title="再開 [space]"><img class="play off" src="${BASE}icon-pause.png" title="停止 [space]"><img class="next" src="${BASE}icon-forward.png" title="進む [↓]"><img class="last" src="${BASE}icon-step-forward.png" title="結果/次局 [→]"><div class="speed"><img class="minus" src="${BASE}icon-minus-sign.png" title="速度- [-]"><span></span><span></span><span></span><span></span><span></span><img class="plus" src="${BASE}icon-plus-sign.png" title="速度+ [+]"></div></div></div></div><div id="loaddata" class="fn-mahjong-assets">${imgs}<br>${audio}</div></div>`;
  }
  async function load(){
    if(loading)return loading;
    loading=(async()=>{
      const jqmod=await import(URLS.jq);
      const $=jqmod.default||jqmod.jQuery||jqmod;
      window.jQuery=$; window.$=$;
      const [core,ai,uiPlayer,uiBoard,uiGameCtl]=await Promise.all([
        import(URLS.core),
        import(URLS.ai),
        import(URLS.uiPlayer),
        import(URLS.uiBoard),
      ]);
      const Majiang=core.default||core;
      Majiang.AI=ai.default||ai;
      Majiang.UI={
        Player: uiPlayer.default||uiPlayer,
        Board: uiBoard.default||uiBoard
      };
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

  class SafeGameCtl{
    constructor(root, storage, game, ...view){
      this.$=window.jQuery||window.$;
      if(!this.$) throw new Error('Mahjong jQuery instance not initialized');
      this._node={
        controller:this.$('.controller',root),
        download:this.$('.download',root)
      };
      this._root=root;
      this._game=game;
      this._view=view;
      this._pref={sound_on:true,speed:3};
      try{
        const raw=window.localStorage && window.localStorage.getItem(storage);
        if(raw){
          const parsed=JSON.parse(raw);
          if(parsed && typeof parsed==='object') this._pref=Object.assign(this._pref,parsed);
        }
      }catch(_){}
      if(game) game._view.no_player_name=true;
      this.redraw();
    }
    save(){
      try{ window.localStorage.setItem('Majiang.pref',JSON.stringify(this._pref)); }catch(_){}
    }
    redraw(){
      this.$('.speed span',this._node.controller).css('visibility','visible');
      this.sound(this._pref.sound_on);
      this.speed(this._pref.speed);
      this.set_handler();
    }
    speed(speed){
      if(!this._game)return false;
      speed=Math.max(1,Math.min(5,Number(speed)||3));
      this._game.speed=speed;
      this.$('.speed span',this._node.controller).each((i,n)=>{
        this.$(n).css('visibility',i<speed?'visible':'hidden');
      });
      this._pref.speed=speed;
      this.save();
      return false;
    }
    sound(on){
      on=!!on;
      this._view.forEach(v=>v.sound_on=on);
      if(on){
        hide(this.$('.sound.off',this._node.controller));
        show(this.$('.sound.on',this._node.controller));
      }else{
        hide(this.$('.sound.on',this._node.controller));
        show(this.$('.sound.off',this._node.controller));
      }
      this._pref.sound_on=on;
      this.save();
      return false;
    }
    set_handler(){
      this.clear_handler();
      const ctl=this._node.controller;
      this.$('.sound',ctl).on('click',()=>this.sound(!this._pref.sound_on));
      this.$('.minus',ctl).on('click',()=>this.speed(this._game.speed-1));
      this.$('.plus',ctl).on('click',()=>this.speed(this._game.speed+1));
      this.$(window).on('keyup.controler',ev=>{
        if(ev.key==='a')this.sound(!this._pref.sound_on);
        else if(ev.key==='-')this.speed(this._game.speed-1);
        else if(ev.key==='+')this.speed(this._game.speed+1);
      });
    }
    clear_handler(){
      this.$('.sound, .minus, .plus',this._node.controller).off('click');
      this.$(window).off('.controler');
    }
    stop(){
      this._game.stop();
      let blob=new Blob([JSON.stringify(this._game._paipu)],{type:'application/json'});
      this.$('a',this._node.download).attr('href',URL.createObjectURL(blob)).attr('download','牌譜.json');
      show(this._node.download);
      this.stoped=true;
    }
    start(){
      this.stoped=false;
      hide(this._node.download);
      this._game.start();
    }
    shoupai(){
      const game=this._game;
      if(game._status==='hule'||game._status==='pingju'||game._status==='jieju')return true;
      game._view.open_shoupai=!game._view.open_shoupai;
      game._view.redraw();
      return false;
    }
    he(){
      const game=this._game;
      if(game._status==='hule'||game._status==='pingju'||game._status==='jieju')return true;
      game._view.open_he=!game._view.open_he;
      game._view.redraw();
      return false;
    }
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
    // Use the exact DOM/jQuery instance created by this page for assets.
    // The esm.sh-transformed UI audio helper can receive a different jQuery
    // realm on Safari, so keep the asset adapters local and dependency-free.
    const pai=(p)=>{
      const key=String(p).slice(0,2);
      const node=assetRoot.find(`.pai[data-pai=\"${key}\"]`).get(0);
      if(!node) throw new Error(`Missing Mahjong tile asset: ${key}`);
      return $(node).clone();
    };
    const audio=(name)=>{
      // Do not depend on a jQuery lookup for audio on Safari.  The official
      // Player/Board classes only require an HTMLAudioElement, so construct
      // one directly from the same local asset names used by the UI.
      const files={
        dapai:'dahai11.wav',
        chi:'chii.wav',
        peng:'pon.wav',
        gang:'kan.wav',
        rong:'ron.wav',
        zimo:'tsumo.wav',
        lizhi:'richi.wav',
        gong:'nc43994.wav',
        beep:'beep.wav'
      };
      const volumes={dapai:.2,chi:.2,peng:.2,gang:.2,rong:.2,zimo:.2,lizhi:.2,gong:1,beep:.2};
      const file=files[name];
      if(!file) throw new Error(`Unknown Mahjong audio asset: ${name}`);
      const el=document.createElement('audio');
      el.src=BASE+file;
      el.preload='auto';
      el.volume=volumes[name] ?? 1;
      return el;
    };
    const players=[new Majiang.UI.Player(board,pai,audio),new Majiang.AI(),new Majiang.AI(),new Majiang.AI()];
    const rule=Majiang.rule({});
    const end=paipu=>{if(runtime)runtime.paipu=paipu||null;window.dispatchEvent(new CustomEvent('fn-mahjong-end',{detail:{paipu:paipu||null}}));};
    const game=new Majiang.Game(players,end,rule);
    game.view=new Majiang.UI.Board($('.board',board),pai,audio,game.model);
    new SafeGameCtl(board,'Majiang.pref',game,game.view);
    runtime={game,players,view:game.view,paipu:null};
    const resize=fit;runtime.resize=resize;window.addEventListener('resize',resize,{passive:true});fit();game.kaiju();
    return runtime;
  }
  window.FN_MAHJONG_START=()=>start().catch(err=>{console.error('[FORTUNE NOIR] Mahjong 4P start failed',err);const host=document.getElementById('modalContent');if(host)host.innerHTML='<div class="fn-mj-error"><h2>MAHJONG LOAD ERROR</h2><pre>'+String(err.stack||err).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</pre></div>';});
  window.FN_MAHJONG_STOP=()=>{if(!runtime)return;try{runtime.game.stop&&runtime.game.stop()}catch(_){}window.removeEventListener('resize',runtime.resize);runtime=null;};
})();
