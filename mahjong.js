(() => {
  "use strict";

  // Mahjong engine: Kobalab core + AI.  UI is intentionally custom.
  const CORE_URL = "https://esm.sh/@kobalab/majiang-core@1.3.5?bundle&target=es2020";
  const AI_URL   = "https://esm.sh/@kobalab/majiang-ai@1.2.0?bundle&target=es2020";

  const WIND = ["東", "南", "西", "北"];
  const TILE_NAME = {
    m1:"一萬",m2:"二萬",m3:"三萬",m4:"四萬",m5:"五萬",m6:"六萬",m7:"七萬",m8:"八萬",m9:"九萬",m0:"赤五萬",
    p1:"一筒",p2:"二筒",p3:"三筒",p4:"四筒",p5:"五筒",p6:"六筒",p7:"七筒",p8:"八筒",p9:"九筒",p0:"赤五筒",
    s1:"一索",s2:"二索",s3:"三索",s4:"四索",s5:"五索",s6:"六索",s7:"七索",s8:"八索",s9:"九索",s0:"赤五索",
    z1:"東",z2:"南",z3:"西",z4:"北",z5:"白",z6:"發",z7:"中"
  };

  let loading = null;
  let runtime = null;

  function tileKey(p) {
    if (!p) return "";
    return p[0] + (p[1] === "0" ? "0" : p[1]);
  }

  function tileFile(p) {
    const k = tileKey(p);
    return k ? `./${k}.gif` : "";
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  }

  function tileImg(p, cls = "") {
    const k = tileKey(p);
    if (!k) return "";
    return `<img class="fnmj-tile ${cls}" src="${tileFile(k)}" alt="${esc(TILE_NAME[k] || k)}" data-tile="${k}">`;
  }

  function backTiles(count, cls = "") {
    const n = Math.max(0, count | 0);
    return `<span class="fnmj-back-group ${cls}">${Array.from({length:n}, () => '<i class="fnmj-back"></i>').join("")}</span>`;
  }

  function play(name) {
    const map = {
      dapai:"dahai11.wav", chi:"chii.wav", peng:"pon.wav", gang:"kan.wav",
      rong:"ron.wav", zimo:"tsumo.wav", lizhi:"richi.wav"
    };
    const src = map[name];
    if (!src) return;
    try {
      const a = new Audio(`./${src}`);
      a.volume = 0.2;
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch (_) {}
  }

  class TableUI {
    constructor(root, Majiang) {
      this.root = root;
      this.Majiang = Majiang;
      this.game = null;
      this.human = null;
      this.seat = 0;
      this.actions = [];
      this.discardChoices = null;
      this.riichiSelecting = false;
      this.message = "";
      this.renderTimer = null;

      root.innerHTML = `
        <div class="fnmj-shell">
          <div class="fnmj-header">
            <div class="fnmj-title"><b>FORTUNE NOIR</b><span>MAHJONG</span></div>
            <div class="fnmj-round-box"><strong id="fnmjRound">東1局</strong><span id="fnmjHonba">0本場</span></div>
            <div class="fnmj-wall-box">残り <b id="fnmjWall">70</b> 枚</div>
          </div>

          <div class="fnmj-arena">
            <div class="fnmj-table-felt"></div>
            <div class="fnmj-wall fnmj-wall-top" id="fnmjWallTop"></div>
            <div class="fnmj-wall fnmj-wall-right" id="fnmjWallRight"></div>
            <div class="fnmj-wall fnmj-wall-bottom" id="fnmjWallBottom"></div>
            <div class="fnmj-wall fnmj-wall-left" id="fnmjWallLeft"></div>

            <section class="fnmj-player fnmj-player-top" data-seat="top">
              <div class="fnmj-player-info"><span id="fnmjWind2">南</span><b id="fnmjName2">AI 2</b><strong id="fnmjScore2">25000</strong></div>
              <div class="fnmj-hand opponent-hand" id="fnmjHand2"></div>
              <div class="fnmj-river river-top" id="fnmjRiver2"></div>
            </section>

            <section class="fnmj-player fnmj-player-left" data-seat="left">
              <div class="fnmj-player-info"><span id="fnmjWind3">西</span><b id="fnmjName3">AI 3</b><strong id="fnmjScore3">25000</strong></div>
              <div class="fnmj-hand opponent-hand" id="fnmjHand3"></div>
              <div class="fnmj-river river-left" id="fnmjRiver3"></div>
            </section>

            <section class="fnmj-player fnmj-player-right" data-seat="right">
              <div class="fnmj-player-info"><span id="fnmjWind1">北</span><b id="fnmjName1">AI 1</b><strong id="fnmjScore1">25000</strong></div>
              <div class="fnmj-hand opponent-hand" id="fnmjHand1"></div>
              <div class="fnmj-river river-right" id="fnmjRiver1"></div>
            </section>

            <section class="fnmj-player fnmj-player-bottom" data-seat="bottom">
              <div class="fnmj-river river-bottom" id="fnmjRiver0"></div>
              <div class="fnmj-hand my-hand" id="fnmjHand0"></div>
              <div class="fnmj-player-info"><span id="fnmjWind0">東</span><b id="fnmjName0">YOU</b><strong id="fnmjScore0">25000</strong></div>
            </section>

            <div class="fnmj-center" aria-label="卓中央">
              <div class="fnmj-center-top">
                <div class="fnmj-center-round" id="fnmjCenterRound">東1局</div>
                <div class="fnmj-center-honba" id="fnmjCenterHonba">0本場</div>
              </div>
              <div class="fnmj-center-dora-label">ドラ表示牌</div>
              <div class="fnmj-dora" id="fnmjDora"></div>
              <div class="fnmj-center-score" id="fnmjCenterScore">25000</div>
              <div class="fnmj-turn" id="fnmjTurn">配牌中</div>
              <div class="fnmj-status" id="fnmjStatus"></div>
            </div>
          </div>

          <div class="fnmj-actions" id="fnmjActions"></div>
          <div class="fnmj-result hidden" id="fnmjResult">
            <div class="fnmj-result-card">
              <h2 id="fnmjResultTitle"></h2>
              <pre id="fnmjResultText"></pre>
              <button id="fnmjResultClose">閉じる</button>
            </div>
          </div>
        </div>`;

      this.root.querySelector("#fnmjResultClose").addEventListener("click", () => {
        this.root.querySelector("#fnmjResult").classList.add("hidden");
      });
    }

    bind(game, human) {
      this.game = game;
      this.human = human;
      this.renderTimer = setInterval(() => this.render(), 100);
      this.render();
    }

    stop() {
      if (this.renderTimer) clearInterval(this.renderTimer);
      this.renderTimer = null;
      this.clearActions();
      this.discardChoices = null;
      this.riichiSelecting = false;
    }

    clearActions() {
      this.actions = [];
      const box = this.root.querySelector("#fnmjActions");
      if (box) box.innerHTML = "";
    }

    addAction(label, fn, cls = "") {
      this.actions.push({label, fn, cls});
    }

    drawActions() {
      const box = this.root.querySelector("#fnmjActions");
      if (!box) return;
      box.innerHTML = this.actions.map((a,i) => `<button class="${a.cls}" data-action="${i}">${esc(a.label)}</button>`).join("");
      box.querySelectorAll("button").forEach((b,i) => b.addEventListener("click", () => this.actions[i]?.fn()));
    }

    humanTurn(player, gangzimo = false, afterFulou = false) {
      this.clearActions();
      const sp = player.shoupai;
      const normalDapai = player.get_dapai(sp);

      if (player.allow_hule(sp, null, gangzimo)) {
        this.addAction("ツモ", () => { play("zimo"); player.callback({hule:"-"}); this.clearActions(); }, "primary");
      }
      if (!gangzimo && player.allow_pingju(sp)) {
        this.addAction("九種九牌", () => player.callback({daopai:"-"}), "secondary");
      }
      for (const m of (player.get_gang_mianzi(sp, null) || [])) {
        this.addAction(`カン ${m}`, () => { play("gang"); player.callback({gang:m}); this.clearActions(); }, "call");
      }

      const riichi = player.allow_lizhi(sp);
      if (riichi) {
        const riichiDapai = Array.isArray(riichi) ? riichi : player.get_dapai(sp);
        this.addAction("リーチ", () => this.selectDiscard(player, riichiDapai, true), "riichi");
      }
      this.discardChoices = { player, tiles: normalDapai.map(tileKey) };
      this.riichiSelecting = false;
      this.message = gangzimo ? "槓の嶺上牌" : (afterFulou ? "鳴いた後の打牌" : "あなたのツモ");
      this.render();
    }

    selectDiscard(player, tiles, riichi) {
      this.discardChoices = { player, tiles: (tiles || []).map(tileKey) };
      this.riichiSelecting = !!riichi;
      this.render();
    }

    handleDiscardTile(node) {
      if (!this.discardChoices) return;
      const player = this.discardChoices.player;
      const raw = node.dataset.raw;
      if (!raw) return;
      if (!this.discardChoices.tiles.includes(tileKey(raw))) return;
      const p = this.riichiSelecting ? `${raw.replace(/\*$/, "")}*` : raw;
      play("dapai");
      this.discardChoices = null;
      this.riichiSelecting = false;
      this.clearActions();
      player.callback({dapai:p});
    }

    opponentDiscard(player, d) {
      this.clearActions();
      this.discardChoices = null;
      this.riichiSelecting = false;
      const sp = player.shoupai;
      if (player.allow_hule(sp, d.p, false)) {
        this.addAction("ロン", () => { play("rong"); player.callback({hule:"-"}); this.clearActions(); }, "danger");
      }
      for (const m of (player.get_peng_mianzi(sp, d.p) || [])) {
        this.addAction("ポン", () => { play("peng"); player.callback({fulou:m}); this.clearActions(); }, "call");
      }
      for (const m of (player.get_gang_mianzi(sp, d.p) || [])) {
        this.addAction("カン", () => { play("gang"); player.callback({fulou:m}); this.clearActions(); }, "call");
      }
      const chi = d.l === (player._menfeng + 3) % 4 ? (player.get_chi_mianzi(sp, d.p) || []) : [];
      for (const m of chi) {
        this.addAction("チー", () => { play("chi"); player.callback({fulou:m}); this.clearActions(); }, "call");
      }
      this.addAction("パス", () => { player.callback({}); this.clearActions(); }, "secondary");
      this.message = `${TILE_NAME[tileKey(d.p)] || d.p} を捨てました`;
      this.drawActions();
      this.render();
    }

    render() {
      if (!this.game) return;
      const m = this.game.model;
      if (!m) return;

      const round = `${WIND[m.zhuangfeng] || "東"}${(m.jushu || 0) + 1}局`;
      const wall = m.shan ? m.shan.paishu : 70;
      const turnSeat = m.lunban >= 0 ? m.player_id[m.lunban] : -1;

      this.root.querySelector("#fnmjRound").textContent = round;
      this.root.querySelector("#fnmjCenterRound").textContent = round;
      this.root.querySelector("#fnmjWall").textContent = wall;
      this.root.querySelector("#fnmjHonba").textContent = `${m.changbang || 0}本場`;
      this.root.querySelector("#fnmjCenterHonba").textContent = `${m.changbang || 0}本場`;
      this.root.querySelector("#fnmjTurn").textContent = turnSeat >= 0 ? `${WIND[this.seatWind(m, turnSeat)]}家の番` : "配牌中";
      this.root.querySelector("#fnmjStatus").textContent = this.message || "";
      this.root.querySelector("#fnmjCenterScore").textContent = (m.defen[this.seat] ?? 0).toLocaleString();

      const dora = m.shan?.baopai || [];
      this.root.querySelector("#fnmjDora").innerHTML = dora.map(p => tileImg(p)).join("");

      this.renderWalls(wall);

      for (let l = 0; l < 4; l++) {
        const id = m.player_id[l];
        const infoWind = WIND[l];
        const score = (m.defen[id] ?? 0).toLocaleString();
        this.root.querySelector(`#fnmjScore${id}`).textContent = score;
        this.root.querySelector(`#fnmjName${id}`).textContent = id === this.seat ? "YOU" : `AI ${id}`;
        this.root.querySelector(`#fnmjWind${id}`).textContent = infoWind;

        const player = m.shoupai[l];
        const hand = this.root.querySelector(`#fnmjHand${id}`);
        if (id === this.seat) {
          hand.innerHTML = renderHand(player, true);
          if (this.discardChoices && this.discardChoices.player === this.human) {
            hand.querySelectorAll(".fnmj-tile-wrap[data-raw]").forEach(node => {
              const raw = node.dataset.raw;
              if (this.discardChoices.tiles.includes(tileKey(raw))) {
                node.classList.add("fnmj-selectable");
                node.onclick = () => this.handleDiscardTile(node);
              }
            });
          }
        } else {
          hand.innerHTML = renderOpponentHand(player);
        }
        hand.classList.toggle("is-turn", id === turnSeat);

        const river = this.root.querySelector(`#fnmjRiver${id}`);
        river.innerHTML = renderRiver(m.he[l]);
        river.classList.toggle("is-turn", id === turnSeat);

        const seat = this.root.querySelector(`[data-seat="${seatClassForPlayer(id, this.seat)}"]`);
        if (seat) seat.classList.toggle("active-seat", id === turnSeat);
      }

      this.drawActions();
    }

    seatWind(model, playerId) {
      const idx = model.player_id.indexOf(playerId);
      return idx < 0 ? 0 : idx;
    }

    renderWalls(count) {
      // The core exposes the number of drawable tiles, not the physical wall coordinates.
      // Keep four complete visual walls and mark the remaining live wall proportionally.
      const live = Math.max(0, Math.min(70, count));
      const used = 70 - live;
      const activeStacks = Math.ceil((live + 14) / 4);
      const usedStacks = Math.max(0, Math.ceil(used / 4));
      for (const id of ["fnmjWallTop","fnmjWallBottom","fnmjWallLeft","fnmjWallRight"]) {
        const box = this.root.querySelector(`#${id}`);
        box.innerHTML = Array.from({length:17}, (_,i) => {
          const dead = i >= activeStacks;
          const dim = !dead && i < usedStacks ? " used" : "";
          return `<i class="fnmj-wall-stack${dead ? " dead" : ""}${dim}"><b></b><b></b></i>`;
        }).join("");
      }
    }

    showResult(title, data) {
      this.root.querySelector("#fnmjResultTitle").textContent = title;
      this.root.querySelector("#fnmjResultText").textContent = data?.name || "局が終了しました。";
      this.root.querySelector("#fnmjResult").classList.remove("hidden");
      this.message = title;
      this.render();
    }
  }

  function seatClassForPlayer(id, humanSeat) {
    // Relative to the human: bottom = self, right = next, top = opposite, left = previous.
    const d = (id - humanSeat + 4) % 4;
    return d === 0 ? "bottom" : d === 1 ? "right" : d === 2 ? "top" : "left";
  }

  function concealedTiles(sp) {
    const out = [];
    if (!sp) return out;
    for (const suit of ["m","p","s","z"]) {
      const a = sp._bingpai?.[suit];
      if (!a) continue;
      for (let n = 1; n < a.length; n++) {
        let c = a[n] || 0;
        if (n === 5 && suit !== "z") {
          const red = a[0] || 0;
          for (let i = 0; i < red; i++) out.push(`${suit}0`);
          c -= red;
        }
        for (let i = 0; i < c; i++) out.push(`${suit}${n}`);
      }
    }
    // IMPORTANT: _zimo is separate from _bingpai in Kobalab. Do not remove a matching
    // tile from _bingpai here; doing so produces the old 12-tile display bug.
    if (sp._zimo && sp._zimo !== "_") out.push(tileKey(sp._zimo));
    return out;
  }

  function renderMeld(m) {
    const nums = m.match(/[0-9]/g) || [];
    const suit = m[0];
    if (/^[mpsz]\d{4}$/.test(m)) {
      const backs = nums.map((n, i) => (i === 0 || i === 3)
        ? '<i class="fnmj-meld-back"></i>'
        : tileImg(suit + n)).join("");
      return `<span class="fnmj-meld ankan">${backs}</span>`;
    }
    return `<span class="fnmj-meld">${nums.map(n => tileImg(suit + n)).join("")}</span>`;
  }

  function renderHand(sp, selectable) {
    if (!sp) return "";
    const concealed = concealedTiles(sp);
    const zimo = sp._zimo && sp._zimo !== "_" ? tileKey(sp._zimo) : "";
    const melds = (sp._fulou || []).map(renderMeld).join("");
    const body = concealed.map((p, i) => {
      const isZimo = zimo && i === concealed.length - 1;
      return `<span class="fnmj-tile-wrap${isZimo ? " zimo-tile" : ""}" data-raw="${p}">${tileImg(p)}</span>`;
    }).join("");
    return `<span class="fnmj-concealed">${body}</span>${melds}`;
  }

  function countVisibleTiles(sp) {
    if (!sp) return 13;
    let n = concealedTiles(sp).length;
    for (const m of sp._fulou || []) n += (m.match(/[0-9]/g) || []).length;
    return n;
  }

  function renderOpponentHand(sp) {
    const total = countVisibleTiles(sp);
    const closed = total - (sp?._fulou || []).reduce((n,m) => n + (m.match(/[0-9]/g)||[]).length, 0);
    const melds = (sp?._fulou || []).map(renderMeld).join("");
    return `${backTiles(closed)}${melds}`;
  }

  function renderRiver(he) {
    if (!he?._pai) return "";
    return he._pai.map(p => {
      const called = /[+=-]$/.test(p);
      const raw = p.replace(/[+=-]$/, "");
      return `<span class="fnmj-river-tile${called ? " called" : ""}">${tileImg(raw)}</span>`;
    }).join("");
  }

  async function load() {
    if (loading) return loading;
    loading = Promise.all([import(CORE_URL), import(AI_URL)]).then(([core, ai]) => {
      const Majiang = core.default || core;
      Majiang.AI = ai.default || ai;
      if (!Majiang.Game || !Majiang.Player || !Majiang.rule) throw new Error("Kobalab Majiang core のロードに失敗しました");
      return Majiang;
    });
    return loading;
  }

  function makeHumanClass(Majiang, ui) {
    class Human extends Majiang.Player {
      action_kaiju() { this._callback({}); }
      action_qipai(q) { this._callback({}); }
      action_zimo(z, gangzimo) {
        if (z.l === this._menfeng) ui.humanTurn(this, !!gangzimo, false);
        else this._callback({});
      }
      action_dapai(d) {
        if (d.l === this._menfeng) { ui.discardChoices = null; ui.riichiSelecting = false; this._callback({}); }
        else ui.opponentDiscard(this, d);
      }
      action_fulou(f) {
        if (f.l === this._menfeng) ui.humanTurn(this, false, true);
        else this._callback({});
      }
      action_gang(g) {
        // After a kan declaration the engine must proceed to the replacement draw.
        this._callback({});
      }
      action_hule(h) {
        ui.showResult("和了", h);
        this._callback({});
      }
      action_pingju(p) {
        ui.showResult(p?.name || "流局", p);
        this._callback({});
      }
      action_jieju(p) {
        ui.showResult("対局終了", p);
        this._callback({});
      }
    }
    return Human;
  }


  async function start() {
    if (runtime) return runtime;
    const host = document.getElementById("modalContent");
    if (!host) throw new Error("modalContent が見つかりません");
    host.style.width = "100%";
    host.style.height = "100%";
    host.style.minHeight = "600px";
    host.style.overflow = "hidden";
    host.innerHTML = `<div id="fnMahjongRoot" class="fn-mahjong-root"></div>`;

    const Majiang = await load();
    const ui = new TableUI(host.querySelector("#fnMahjongRoot"), Majiang);
    const Human = makeHumanClass(Majiang, ui);
    const human = new Human();
    const players = [human, new Majiang.AI(), new Majiang.AI(), new Majiang.AI()];
    const game = new Majiang.Game(players, paipu => ui.showResult("対局終了", paipu), Majiang.rule({}), "FORTUNE NOIR 4 PLAYER MAHJONG");
    game.view = null;
    game.speed = 0;
    game.dwell = 0;

    runtime = {game,human,ui};
    ui.bind(game,human);
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
    if (host) host.innerHTML = `<div class="fnmj-fatal"><h2>MAHJONG LOAD ERROR</h2><pre>${esc(err.stack || err)}</pre></div>`;
  });
  window.FN_MAHJONG_STOP = stop;
})();
