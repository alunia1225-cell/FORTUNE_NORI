(() => {
  "use strict";

  const CORE_URL = "https://esm.sh/@kobalab/majiang-core@1.3.5?bundle&target=es2020";
  const AI_URL   = "https://esm.sh/@kobalab/majiang-ai@1.2.0?bundle&target=es2020";

  let loading = null;
  let runtime = null;

  const TILE_NAME = {
    m1:"一萬",m2:"二萬",m3:"三萬",m4:"四萬",m5:"五萬",m6:"六萬",m7:"七萬",m8:"八萬",m9:"九萬",m0:"赤五萬",
    p1:"一筒",p2:"二筒",p3:"三筒",p4:"四筒",p5:"五筒",p6:"六筒",p7:"七筒",p8:"八筒",p9:"九筒",p0:"赤五筒",
    s1:"一索",s2:"二索",s3:"三索",s4:"四索",s5:"五索",s6:"六索",s7:"七索",s8:"八索",s9:"九索",s0:"赤五索",
    z1:"東",z2:"南",z3:"西",z4:"北",z5:"白",z6:"發",z7:"中"
  };

  function tileKey(p) {
    if (!p) return "";
    return p[0] + (p[1] === "0" ? "0" : p[1]);
  }

  function tileFile(p) {
    const k = tileKey(p);
    return k ? `./${k}.gif` : "";
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"
    }[c]));
  }

  function tileImg(p, cls = "") {
    const k = tileKey(p);
    if (!k) return "";
    return `<img class="fnmj-tile ${cls}" src="${tileFile(k)}" alt="${esc(TILE_NAME[k] || k)}" data-tile="${k}">`;
  }

  function hiddenTile(count = 1, cls = "") {
    return `<span class="fnmj-back-row ${cls}">${Array.from({length: count}, () => '<i class="fnmj-back"></i>').join("")}</span>`;
  }

  function audio(name, volume = 0.22) {
    const map = {
      dapai:"dahai11.wav", chi:"chii.wav", peng:"pon.wav", gang:"kan.wav",
      rong:"ron.wav", zimo:"tsumo.wav", lizhi:"richi.wav", beep:"beep.wav"
    };
    const src = map[name];
    if (!src) return null;
    const a = new Audio(`./${src}`);
    a.preload = "auto";
    a.volume = volume;
    return a;
  }

  function play(name) {
    try {
      const a = audio(name);
      if (a) { a.currentTime = 0; a.play().catch(() => {}); }
    } catch (_) {}
  }

  function makeHumanClass(Majiang, ui) {
    class Human extends Majiang.Player {}
    const base = Majiang.Player.prototype;

    Human.prototype.kaiju = function(k) {
      base.kaiju.call(this, k);
      if (this._callback) this.action_kaiju(k);
    };
    Human.prototype.qipai = function(q) {
      base.qipai.call(this, q);
      if (this._callback) this.action_qipai(q);
    };
    Human.prototype.zimo = function(z, g) {
      base.zimo.call(this, z, g);
      if (this._callback) this.action_zimo(z, g);
    };
    Human.prototype.dapai = function(d) {
      base.dapai.call(this, d);
      if (this._callback) this.action_dapai(d);
    };
    Human.prototype.fulou = function(f) {
      base.fulou.call(this, f);
      if (this._callback) this.action_fulou(f);
    };
    Human.prototype.gang = function(g) {
      base.gang.call(this, g);
      if (this._callback) this.action_gang(g);
    };
    Human.prototype.kaigang = function(k) { base.kaigang.call(this, k); };
    Human.prototype.hule = function(h) { base.hule.call(this, h); this.action_hule(h); };
    Human.prototype.pingju = function(p) { base.pingju.call(this, p); this.action_pingju(p); };
    Human.prototype.jieju = function(p) { base.jieju.call(this, p); this.action_jieju(p); };

    Human.prototype.action_kaiju = function() { this._callback(); };
    Human.prototype.action_qipai = function() { this._callback(); };

    Human.prototype.action_zimo = function(z, gangzimo) {
      if (z.l !== this._menfeng) return this._callback();
      ui.humanTurn(this, gangzimo);
    };

    Human.prototype.action_dapai = function(d) {
      if (d.l === this._menfeng) return this._callback();
      ui.opponentDiscard(this, d);
    };

    Human.prototype.action_fulou = function(f) {
      if (f.l !== this._menfeng) return this._callback();
      ui.humanTurn(this, false, true);
    };

    Human.prototype.action_gang = function(g) {
      if (g.l !== this._menfeng) return this._callback();
      ui.humanTurn(this, true);
    };

    Human.prototype.action_hule = function() {
      ui.showResult("和了", null);
      this._callback();
    };
    Human.prototype.action_pingju = function(p) {
      ui.showResult(p?.name || "流局", p);
      this._callback();
    };
    Human.prototype.action_jieju = function(p) {
      ui.showResult("対局終了", p);
      this._callback();
    };

    return Human;
  }

  class TableUI {
    constructor(root, Majiang) {
      this.root = root;
      this.Majiang = Majiang;
      this.game = null;
      this.human = null;
      this.message = "";
      this.actions = [];
      this.seat = 0;
      this.timer = null;
      this.renderTimer = null;
      root.innerHTML = `
        <div class="fnmj-shell">
          <div class="fnmj-topbar">
            <div class="fnmj-brand"><small>FORTUNE NOIR</small><strong>4 PLAYER MAHJONG</strong></div>
            <div class="fnmj-round" id="fnmjRound">東1局</div>
            <div class="fnmj-wall-count">残り <b id="fnmjWall">--</b></div>
          </div>
          <div class="fnmj-table">
            <div class="fnmj-wall fnmj-wall-top" id="fnmjWallTop"></div>
            <div class="fnmj-wall fnmj-wall-right" id="fnmjWallRight"></div>
            <div class="fnmj-wall fnmj-wall-bottom" id="fnmjWallBottom"></div>
            <div class="fnmj-wall fnmj-wall-left" id="fnmjWallLeft"></div>

            <div class="fnmj-seat fnmj-seat-top">
              <div class="fnmj-player-card"><span class="name" id="fnmjName2">AI 2</span><span class="wind" id="fnmjWind2">南</span><span class="score" id="fnmjScore2">25000</span></div>
              <div class="hand hidden-hand" id="fnmjHand2"></div><div class="river" id="fnmjRiver2"></div>
            </div>
            <div class="fnmj-seat fnmj-seat-left">
              <div class="fnmj-player-card"><span class="name" id="fnmjName3">AI 3</span><span class="wind" id="fnmjWind3">北</span><span class="score" id="fnmjScore3">25000</span></div>
              <div class="hand hidden-hand" id="fnmjHand3"></div><div class="river" id="fnmjRiver3"></div>
            </div>
            <div class="fnmj-seat fnmj-seat-right">
              <div class="fnmj-player-card"><span class="name" id="fnmjName1">AI 1</span><span class="wind" id="fnmjWind1">西</span><span class="score" id="fnmjScore1">25000</span></div>
              <div class="hand hidden-hand" id="fnmjHand1"></div><div class="river" id="fnmjRiver1"></div>
            </div>
            <div class="fnmj-seat fnmj-seat-bottom">
              <div class="river" id="fnmjRiver0"></div>
              <div class="hand my-hand" id="fnmjHand0"></div>
              <div class="fnmj-player-card"><span class="name" id="fnmjName0">YOU</span><span class="wind" id="fnmjWind0">東</span><span class="score" id="fnmjScore0">25000</span></div>
            </div>

            <div class="fnmj-center">
              <div class="fnmj-center-board">
                <div class="fnmj-dora-title">ドラ表示</div>
                <div class="fnmj-dora" id="fnmjDora"></div>
                <div class="fnmj-center-score">
                  <div><span id="fnmjCenterWind">東</span><span id="fnmjTurn">東家</span></div>
                  <strong id="fnmjCenterScore">25000</strong><small id="fnmjHonba">0本場</small>
                </div>
                <div class="fnmj-status" id="fnmjStatus">対局開始中…</div>
              </div>
            </div>
          </div>
          <div class="fnmj-actions" id="fnmjActions"></div>
          <div class="fnmj-result hidden" id="fnmjResult"><div><strong id="fnmjResultTitle"></strong><pre id="fnmjResultText"></pre><button id="fnmjResultClose">CONTINUE</button></div></div>
        </div>`;
      this.resultClose = root.querySelector("#fnmjResultClose");
      this.resultClose.addEventListener("click", () => {
        this.root.querySelector("#fnmjResult").classList.add("hidden");
        if (this.game && this.game._status === "jieju") this.stop();
      });
    }

    setSeat(seat) { this.seat = seat; }

    bind(game, human) {
      this.game = game;
      this.human = human;
      this.renderTimer = setInterval(() => this.render(), 120);
      this.render();
    }

    stop() {
      if (this.renderTimer) clearInterval(this.renderTimer);
      this.renderTimer = null;
      this.clearActions();
    }

    clearActions() {
      this.actions = [];
      const a = this.root.querySelector("#fnmjActions");
      if (a) a.innerHTML = "";
    }

    actionButton(label, fn, cls = "") {
      this.actions.push({label, fn, cls});
    }

    drawActions() {
      const box = this.root.querySelector("#fnmjActions");
      box.innerHTML = this.actions.map((a,i) => `<button class="${a.cls}" data-action="${i}">${esc(a.label)}</button>`).join("");
      box.querySelectorAll("button").forEach((b,i) => b.addEventListener("click", () => this.actions[i].fn()));
    }

    humanTurn(player, gangzimo = false, afterFulou = false) {
      this.clearActions();
      const sp = player.shoupai;
      if (player.allow_hule(null, gangzimo)) this.actionButton("ツモ", () => { play("zimo"); player.callback({hule:"-"}); });
      if (player.allow_pingju(sp)) this.actionButton("九種九牌", () => player.callback({daopai:"-"}));
      const gangs = player.get_gang_mianzi();
      gangs.forEach(m => this.actionButton(`カン ${m}`, () => { play("gang"); player.callback({gang:m}); }));
      const riichi = player.allow_lizhi();
      if (riichi) {
        this.actionButton("リーチ", () => this.selectDiscard(player, riichi, true), "primary");
      }
      if (afterFulou) {
        this.selectDiscard(player, player.get_dapai(), false);
      } else if (!riichi) {
        this.selectDiscard(player, player.get_dapai(), false);
      }
      this.message = "あなたのツモ";
      this.drawActions();
      this.render();
    }

    selectDiscard(player, tiles, riichi) {
      this.root.querySelectorAll(".fnmj-selectable").forEach(e => e.classList.remove("fnmj-selectable"));
      const hand = this.root.querySelector("#fnmjHand0");
      const nodes = [...hand.querySelectorAll(".fnmj-tile-wrap[data-raw]")];
      const wanted = new Set(tiles.map(tileKey));
      nodes.forEach(n => {
        const tile = tileKey(n.dataset.raw);
        if (wanted.has(tile)) {
          n.classList.add("fnmj-selectable");
          n.onclick = () => {
            const raw = n.dataset.raw;
            const p = riichi ? `${raw.replace(/_$/, "")}*` : raw;
            player.callback({dapai: p});
            this.clearActions();
          };
        }
      });
      this.drawActions();
    }

    opponentDiscard(player, d) {
      this.clearActions();
      const p = d.p;
      if (player.allow_hule(p)) this.actionButton("ロン", () => { play("rong"); player.callback({hule:"-"}); }, "danger");
      const peng = player.get_peng_mianzi(p);
      peng.forEach(m => this.actionButton(`ポン ${m}`, () => { play("peng"); player.callback({fulou:m}); }));
      const gang = player.get_gang_mianzi(p);
      gang.forEach(m => this.actionButton(`カン ${m}`, () => { play("gang"); player.callback({fulou:m}); }));
      const chi = d.l === (player._menfeng + 3) % 4 ? player.get_chi_mianzi(p) : [];
      chi.forEach(m => this.actionButton(`チー ${m}`, () => { play("chi"); player.callback({fulou:m}); }));
      this.actionButton("パス", () => player.callback({}), "secondary");
      this.message = `${TILE_NAME[tileKey(p)] || p} が捨てられました`;
      this.drawActions();
      this.render();
    }

    render() {
      if (!this.game) return;
      const m = this.game.model;
      const root = this.root;
      const wind = ["東","南","西","北"];
      root.querySelector("#fnmjRound").textContent = `${wind[m.zhuangfeng]}${m.jushu + 1}局`;
      root.querySelector("#fnmjWall").textContent = m.shan ? m.shan.paishu : "--";
      root.querySelector("#fnmjHonba").textContent = `${m.changbang}本場`;
      root.querySelector("#fnmjTurn").textContent = m.lunban >= 0 ? `${wind[m.player_id[m.lunban]]}家の番` : "配牌";
      root.querySelector("#fnmjCenterWind").textContent = wind[m.zhuangfeng];
      root.querySelector("#fnmjCenterScore").textContent = (m.defen[this.seat] ?? 0).toLocaleString();
      root.querySelector("#fnmjStatus").textContent = this.message || (m.lunban >= 0 ? `${wind[m.player_id[m.lunban]]}家の番` : "配牌中…");

      const dora = m.shan?.baopai || [];
      root.querySelector("#fnmjDora").innerHTML = dora.map(p => tileImg(p)).join("");
      const wallHtml = renderWall(m.shan ? m.shan.paishu : 70);
      root.querySelector("#fnmjWallTop").innerHTML = wallHtml;
      root.querySelector("#fnmjWallBottom").innerHTML = wallHtml;
      root.querySelector("#fnmjWallLeft").innerHTML = wallHtml;
      root.querySelector("#fnmjWallRight").innerHTML = wallHtml;

      for (let l=0;l<4;l++) {
        const id = m.player_id[l];
        root.querySelector(`#fnmjScore${id}`).textContent = (m.defen[id] ?? 0).toLocaleString();
        root.querySelector(`#fnmjName${id}`).textContent = id === this.seat ? "YOU" : `AI ${id}`;
        root.querySelector(`#fnmjWind${id}`).textContent = wind[l];
        const hand = root.querySelector(`#fnmjHand${id}`);
        if (id === this.seat) {
          const sp = m.shoupai[l];
          if (sp) hand.innerHTML = renderOpenHand(sp);
        } else {
          const sp = m.shoupai[l];
          const count = sp ? countTiles(sp) : 13;
          hand.innerHTML = hiddenTile(Math.max(0, count), "");
        }
        const river = root.querySelector(`#fnmjRiver${id}`);
        river.innerHTML = renderRiver(m.he[l]);
      }
      this.drawActions();
    }

    showResult(title, data) {
      this.root.querySelector("#fnmjResultTitle").textContent = title;
      this.root.querySelector("#fnmjResultText").textContent =
        data?.name ? data.name : "局が終了しました。";
      this.root.querySelector("#fnmjResult").classList.remove("hidden");
      this.message = title;
      this.render();
    }
  }

  function countTiles(sp) {
    if (!sp) return 0;
    let n = 0;
    for (const suit of ["m","p","s","z"]) {
      const a = sp._bingpai?.[suit];
      if (!a) continue;
      for (let i=1;i<a.length;i++) n += a[i] || 0;
    }
    return n + (sp._fulou || []).length * 3;
  }

  function concealedTiles(sp) {
    const out=[];
    if (!sp) return out;
    for (const suit of ["m","p","s","z"]) {
      const a=sp._bingpai?.[suit];
      if (!a) continue;
      for (let n=1;n<a.length;n++) {
        let c=a[n]||0;
        if (n===5 && suit!=="z") {
          const red=a[0]||0;
          for(let i=0;i<red;i++) out.push(suit+"0");
          c-=red;
        }
        for(let i=0;i<c;i++) out.push(suit+n);
      }
    }
    const z=sp._zimo;
    if(z && z.length<=2 && z!=="_"){
      const k=tileKey(z);
      const i=out.findIndex(p=>tileKey(p)===k);
      if(i>=0) out.splice(i,1);
      out.push(k);
    }
    return out;
  }

  function renderOpenHand(sp) {
    if(!sp) return "";
    const tiles=concealedTiles(sp);
    const z=sp._zimo;
    const zk=z && z.length<=2 ? tileKey(z) : "";
    const concealed=tiles.map((p,i)=>{
      const sep=zk && i===tiles.length-1 ? " zimo-tile" : "";
      return `<span class="fnmj-tile-wrap${sep}" data-raw="${p}">${tileImg(p)}</span>`;
    }).join("");
    const melds=(sp._fulou||[]).map(m=>{
      const suit=m[0], nums=m.match(/\d/g)||[];
      return `<span class="fnmj-meld">${nums.map(n=>tileImg(suit+n)).join("")}</span>`;
    }).join("");
    return `<span class="fnmj-concealed">${concealed}</span>${melds}`;
  }

  function renderRiver(he) {
    if(!he || !he._pai) return "";
    return he._pai.map(p=>{
      const raw=p.replace(/[\+\=\-]$/,"");
      const called=/[\+\=\-]$/.test(p) ? " fnmj-called-discard" : "";
      return `<span class="fnmj-river-tile${called}">${tileImg(raw)}</span>`;
    }).join("");
  }

  function renderWall(count) {
    const n=Math.max(0,Math.min(17,Math.ceil((count+14)/8)));
    return Array.from({length:n},()=>'<i class="fnmj-wall-tile"></i>').join("");
  }

  async function load() {
    if (loading) return loading;
    loading = (async () => {
      const [coreMod, aiMod] = await Promise.all([import(CORE_URL), import(AI_URL)]);
      const Majiang = coreMod.default || coreMod;
      Majiang.AI = aiMod.default || aiMod;
      if (!Majiang.Game || !Majiang.Player || !Majiang.rule) {
        throw new Error("Kobalab Majiang core のロードに失敗しました");
      }
      return Majiang;
    })();
    return loading;
  }

  async function start() {
    if (runtime) return runtime;
    const host = document.getElementById("modalContent");
    if (!host) throw new Error("modalContent が見つかりません");

    host.style.width = "100%";
    host.style.height = "100%";
    host.style.minHeight = "560px";
    host.style.overflow = "hidden";
    host.innerHTML = `<div id="fnMahjongRoot" class="fn-mahjong-root"></div>`;
    const Majiang = await load();
    const ui = new TableUI(host.querySelector("#fnMahjongRoot"), Majiang);
    const Human = makeHumanClass(Majiang, ui);
    const human = new Human();
    const players = [human, new Majiang.AI(), new Majiang.AI(), new Majiang.AI()];
    const rule = Majiang.rule({});
    const game = new Majiang.Game(
      players,
      paipu => {
        ui.showResult("対局終了", paipu);
      },
      rule,
      "FORTUNE NOIR 4 PLAYER MAHJONG"
    );

    // UIは独自実装。KobalabのGame / Player / AI / ルールエンジンだけを使用し、
    // 旧majiang-uiのBoard/Player/kaiju画面は一切ロードしない。
    game.view = null;
    game.speed = 0;
    game.dwell = 0;

    runtime = { game, human, ui };
    ui.bind(game, human);
    game.kaiju(0);
    return runtime;
  }

  function stop() {
    if (!runtime) return;
    try { runtime.game.stop(); } catch (_) {}
    runtime.ui.stop();
    runtime = null;
  }

  window.FN_MAHJONG_START = () => start().catch(err => {
    console.error("[FORTUNE NOIR] Mahjong start failed", err);
    const host = document.getElementById("modalContent");
    if (host) {
      host.innerHTML = `<div class="fnmj-fatal"><h2>MAHJONG LOAD ERROR</h2><pre>${esc(err.stack || err)}</pre></div>`;
    }
  });

  window.FN_MAHJONG_STOP = stop;
})();
