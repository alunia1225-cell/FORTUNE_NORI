(() => {
  "use strict";

  // Mahjong engine: Kobalab core with a lightweight mobile-safe CPU and a custom Mahjong Soul-style table UI.
  const CORE_URL = "https://esm.sh/@kobalab/majiang-core@1.3.5?bundle&target=es2020";

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
      this.selectedDiscardIndex = null;
      this.message = "";
      this.renderTimer = null;
      this._visualFuluCount = 0;
      this._visualFuluSeen = null;
      this._visualRiverSeen = [0,0,0,0];
      this._visualLastDiscard = "";
      this._cutinTimer = null;
      this._resizeHandler = null;
      this._decisionUntil = 0;

      root.innerHTML = `
        <div class="fnmj-shell">
          <div class="fnmj-arena">
            <div class="fnmj-table-felt"></div>
            <div class="fnmj-wall fnmj-wall-top" id="fnmjWallTop"></div>
            <div class="fnmj-wall fnmj-wall-right" id="fnmjWallRight"></div>
            <div class="fnmj-wall fnmj-wall-bottom" id="fnmjWallBottom"></div>
            <div class="fnmj-wall fnmj-wall-left" id="fnmjWallLeft"></div>

            <section class="fnmj-player fnmj-player-top" data-seat="top">
              <div class="fnmj-player-info">
                <i class="fnmj-avatar" id="fnmjAvatar2">南</i>
                <span id="fnmjWind2">南</span><b id="fnmjName2">AI 2</b><strong id="fnmjScore2">25,000</strong>
              </div>
              <div class="fnmj-seat-hand fnmj-seat-hand-top" id="fnmjSeatHand2"></div>
              <div class="fnmj-seat-melds fnmj-seat-melds-top" id="fnmjMelds2"></div>
              <div class="fnmj-river river-top" id="fnmjRiver2"></div>
            </section>

            <section class="fnmj-player fnmj-player-left" data-seat="left">
              <div class="fnmj-player-info">
                <i class="fnmj-avatar" id="fnmjAvatar3">西</i>
                <span id="fnmjWind3">西</span><b id="fnmjName3">AI 3</b><strong id="fnmjScore3">25,000</strong>
              </div>
              <div class="fnmj-seat-hand fnmj-seat-hand-left" id="fnmjSeatHand3"></div>
              <div class="fnmj-seat-melds fnmj-seat-melds-left" id="fnmjMelds3"></div>
              <div class="fnmj-river river-left" id="fnmjRiver3"></div>
            </section>

            <section class="fnmj-player fnmj-player-right" data-seat="right">
              <div class="fnmj-player-info">
                <i class="fnmj-avatar" id="fnmjAvatar1">北</i>
                <span id="fnmjWind1">北</span><b id="fnmjName1">AI 1</b><strong id="fnmjScore1">25,000</strong>
              </div>
              <div class="fnmj-seat-hand fnmj-seat-hand-right" id="fnmjSeatHand1"></div>
              <div class="fnmj-seat-melds fnmj-seat-melds-right" id="fnmjMelds1"></div>
              <div class="fnmj-river river-right" id="fnmjRiver1"></div>
            </section>

            <section class="fnmj-player fnmj-player-bottom" data-seat="bottom">
              <div class="fnmj-river river-bottom" id="fnmjRiver0"></div>
              <div class="fnmj-seat-melds fnmj-seat-melds-bottom" id="fnmjMelds0"></div>
              <div class="fnmj-seat-hand fnmj-seat-hand-bottom" id="fnmjSeatHand0"></div>
              <div class="fnmj-player-info">
                <i class="fnmj-avatar fnmj-avatar-you" id="fnmjAvatar0">自</i>
                <span id="fnmjWind0">東</span><b id="fnmjName0">YOU</b><strong id="fnmjScore0">25,000</strong>
              </div>
            </section>

            <div class="fnmj-center" aria-label="卓中央">
              <div class="fnmj-center-round" id="fnmjCenterRound">東1局</div>
              <div class="fnmj-center-honba" id="fnmjCenterHonba">0本場</div>
              <div class="fnmj-center-dora-label">ドラ表示牌</div>
              <div class="fnmj-dora" id="fnmjDora"></div>
              <div class="fnmj-center-stick" id="fnmjCenterStick">供託 0　積棒 0</div>
              <div class="fnmj-center-wall" id="fnmjCenterWall">残り70枚</div>
            </div>

            <div class="fnmj-actions" id="fnmjActions"></div>
            <div class="fnmj-timer" id="fnmjTimer" aria-hidden="true"></div>
            <div class="fnmj-cutin hidden" id="fnmjCutin" aria-live="polite">
              <div class="fnmj-cutin-label" id="fnmjCutinLabel"></div>
              <div class="fnmj-cutin-sub" id="fnmjCutinSub"></div>
            </div>
          </div>
          <div class="fnmj-result hidden" id="fnmjResult">
            <div class="fnmj-result-card">
              <h2 id="fnmjResultTitle"></h2><pre id="fnmjResultText"></pre><button id="fnmjResultClose">閉じる</button>
            </div>
          </div>
        </div>`;

      this.root.querySelector("#fnmjResultClose").addEventListener("click", () => {
        this.root.querySelector("#fnmjResult").classList.add("hidden");
      });

      // iOS/Safari-safe delegated tile input. IMPORTANT: use exactly one
      // pointer event path. Listening to pointerup + touchend + click at once
      // causes a single physical tap to be delivered multiple times on iOS.
      const tileTap = (ev) => {
        const node = ev.target && ev.target.closest ? ev.target.closest(".fnmj-tile-wrap[data-raw]") : null;
        if (!node || !this.root.contains(node)) return;
        if (!this.discardChoices || !node.classList.contains("fnmj-selectable")) return;
        ev.preventDefault();
        ev.stopPropagation();
        this.handleDiscardTile(node);
      };
      this._tileTap = tileTap;
      if (window.PointerEvent) this.root.addEventListener("pointerup", tileTap, {passive:false});
      else this.root.addEventListener("touchend", tileTap, {passive:false});
    }

    bind(game, human) {
      this.game = game;
      this.human = human;
      this._resizeHandler = () => this.fitArena();
      window.addEventListener("resize", this._resizeHandler, {passive:true});
      if (window.visualViewport) window.visualViewport.addEventListener("resize", this._resizeHandler, {passive:true});
      this.renderTimer = setInterval(() => this.render(), 100);
      this.fitArena();
      this.render();
    }

    stop() {
      if (this.renderTimer) clearInterval(this.renderTimer);
      this.renderTimer = null;
      if (this._resizeHandler) {
        window.removeEventListener("resize", this._resizeHandler);
        if (window.visualViewport) window.visualViewport.removeEventListener("resize", this._resizeHandler);
      }
      this._resizeHandler = null;
      this._visualFuluCount = 0;
      this._visualFuluSeen = null;
      this._visualRiverSeen = [0,0,0,0];
      this._visualLastDiscard = "";
      this._cutinTimer = null;
      this._decisionUntil = 0;
      this.clearActions();
      this.discardChoices = null;
      this.riichiSelecting = false;
      this.selectedDiscardIndex = null;
    }

    fitArena() {
      const arena = this.root.querySelector(".fnmj-arena");
      if (!arena) return;
      // The arena has its real responsive 16:9 CSS size. Do not apply a
      // second transform scale; that was the source of the off-screen table.
      arena.style.removeProperty("--fnmj-scale");
    }

    startDecisionTimer(seconds = 20) {
      this._decisionUntil = performance.now() + seconds * 1000;
    }

    clearDecisionTimer() {
      this._decisionUntil = 0;
    }

    clearActions() {
      this.clearDecisionTimer();
      this.actions = [];
      const box = this.root.querySelector("#fnmjActions");
      if (box) box.innerHTML = "";
    }

    addAction(label, fn, cls = "") {
      this.actions.push({label, fn, cls});
    }

    respond(player, payload = {}) {
      const cb = player && player._callback;
      if (typeof cb !== "function") return false;
      // The Player.action() callback belongs to this one engine wait state.
      // Clear the callback before invoking it so a second UI event cannot
      // answer the same state twice, while the next Player.action() installs
      // a fresh callback for the next state.
      player._callback = null;
      player.__fnResponded = true;
      cb(payload || {});
      return true;
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
        this.addAction("ツモ", () => { this.clearActions(); play("zimo"); this.respond(player, {hule:"-"}); }, "primary");
      }
      if (!gangzimo && player.allow_pingju(sp)) {
        this.addAction("九種九牌", () => { this.clearActions(); this.respond(player, {daopai:"-"}); }, "secondary");
      }
      for (const m of (player.get_gang_mianzi(sp, null) || [])) {
        this.addAction(`カン ${m}`, () => { this.clearActions(); play("gang"); this.respond(player, {gang:m}); }, "call");
      }

      const riichi = player.allow_lizhi(sp);
      if (riichi) {
        const riichiDapai = Array.isArray(riichi) ? riichi : player.get_dapai(sp);
        this.addAction("リーチ", () => this.selectDiscard(player, riichiDapai, true), "riichi");
      }
      this.discardChoices = { player, tiles: normalDapai.map(tileKey) };
      this.riichiSelecting = false;
      this.selectedDiscardIndex = null;
      this.message = gangzimo ? "槓の嶺上牌" : (afterFulou ? "鳴いた後の打牌" : "");
      this.startDecisionTimer(20);
      this.render();
    }

    selectDiscard(player, tiles, riichi) {
      this.discardChoices = { player, tiles: (tiles || []).map(tileKey) };
      this.riichiSelecting = !!riichi;
      this.selectedDiscardIndex = null;
      this.render();
    }

    handleDiscardTile(node) {
      if (!this.discardChoices) return;
      const player = this.discardChoices.player;
      const raw = node.dataset.raw;
      const index = Number(node.dataset.index);
      if (!raw || !Number.isInteger(index)) return;
      if (!this.discardChoices.tiles.includes(tileKey(raw))) return;

      // Match Mahjong Soul's mobile input: first tap selects/lifts the tile,
      // second tap on that same tile confirms the discard.
      if (this.selectedDiscardIndex !== index) {
        this.selectedDiscardIndex = index;
        this.message = "もう一度タップで打牌";
        this.render();
        return;
      }

      const engineTile = raw.endsWith("_") ? raw : raw;
      const p = this.riichiSelecting ? `${engineTile.replace(/_$/, "")}*` : engineTile;
      this.discardChoices = null;
      this.riichiSelecting = false;
      this.selectedDiscardIndex = null;
      this.clearDecisionTimer();
      this.clearActions();
      play("dapai");

      try {
        this.respond(player, {dapai:p});
      } catch (e) {
        console.error("[FORTUNE NOIR] discard callback failed", e);
        this.message = "打牌処理エラー";
        this.render();
      }
    }

    opponentDiscard(player, d) {
      this.clearActions();
      this.discardChoices = null;
      this.riichiSelecting = false;
      this.selectedDiscardIndex = null;
      this.startDecisionTimer(8);

      // Kobalab requires reaction tiles to carry the relative seat marker
      // (+/=/-). Passing bare "m5" etc. is invalid and throws inside
      // Shoupai.get_peng_mianzi/get_chi_mianzi, which was the actual reason
      // the browser stopped on the next player's discard.
      const dir = ["", "+", "=", "-"][(4 + d.l - player._menfeng) % 4];
      const reaction = d.p.slice(0, 2) + dir;
      const sp = player.shoupai;
      let canCall = false;

      try {
        if (player.allow_hule(sp, reaction, false)) {
          canCall = true;
          this.addAction("ロン", () => {
            this.clearActions();
            play("rong");
            this.respond(player, {hule:"-"});
          }, "danger");
        }

        for (const m of (player.get_peng_mianzi(sp, reaction) || [])) {
          canCall = true;
          this.addAction("ポン", () => {
            this.clearActions();
            play("peng");
            this.respond(player, {fulou:m});
          }, "call");
        }

        for (const m of (player.get_gang_mianzi(sp, reaction) || [])) {
          canCall = true;
          this.addAction("カン", () => {
            this.clearActions();
            play("gang");
            this.respond(player, {fulou:m});
          }, "call");
        }

        const canChi = player._menfeng === ((d.l + 1) % 4);
        if (canChi) {
          for (const m of (player.get_chi_mianzi(sp, reaction) || [])) {
            canCall = true;
            this.addAction("チー", () => {
              this.clearActions();
              play("chi");
              this.respond(player, {fulou:m});
            }, "call");
          }
        }
      } catch (e) {
        // A malformed reaction must never deadlock the table. Treat it as a
        // pass while logging the actual engine error for debugging.
        console.error("[FORTUNE NOIR] reaction check failed", e);
        canCall = false;
        this.actions = [];
      }

      this.message = `${TILE_NAME[tileKey(d.p)] || d.p} を捨てました`;

      // No legal reaction = automatic skip, exactly as a real four-player
      // table must behave. Never wait for a meaningless Pass button.
      if (!canCall) {
        this.respond(player, {});
        this.clearActions();
        this.render();
        return;
      }

      this.addAction("パス", () => {
        this.clearActions();
        this.respond(player, {});
      }, "secondary");
      this.render();
    }

    render() {
      if (!this.game) return;
      const m = this.game.model;
      if (!m) return;

      const round = `${WIND[m.zhuangfeng] || "東"}${(m.jushu || 0) + 1}局`;
      const wall = m.shan ? m.shan.paishu : 70;
      const turnSeat = m.lunban >= 0 ? m.player_id[m.lunban] : -1;
      const turnCount = Math.max(0, ...(m.he || []).map(h => h?._pai?.length || 0));

      this.root.querySelector("#fnmjCenterRound").textContent = round;
      this.root.querySelector("#fnmjCenterHonba").textContent = `${m.changbang || 0}本場`;
      const centerWall = this.root.querySelector("#fnmjCenterWall");
      if (centerWall) centerWall.textContent = `残り ${wall}`;
      const centerStick = this.root.querySelector("#fnmjCenterStick");
      if (centerStick) centerStick.textContent = `供託 ${Number(m.lizhibang || 0)}　積棒 ${Number(m.changbang || 0)}`;
      const timer = this.root.querySelector("#fnmjTimer");
      if (timer) {
        const left = this._decisionUntil ? Math.max(0, Math.ceil((this._decisionUntil - performance.now()) / 1000)) : 0;
        timer.textContent = left ? String(left) : "";
        timer.classList.toggle("active", left > 0);
      }
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
        const relativeSeat = seatClassForPlayer(id, this.seat);
        const seatRoot = this.root.querySelector(`.fnmj-player-${relativeSeat}`);
        const hand = this.root.querySelector(`#fnmjSeatHand${id}`);
        const meldBox = this.root.querySelector(`#fnmjMelds${id}`);
        if (hand) {
          hand.innerHTML = id === this.seat ? renderHand(player, true) : renderOpponentHand(player);
          hand.classList.toggle("is-turn", id === turnSeat);
          if (id === this.seat && this.discardChoices && this.discardChoices.player === this.human) {
            hand.querySelectorAll(".fnmj-tile-wrap[data-raw]").forEach(node => {
              const raw = node.dataset.raw;
              if (this.discardChoices.tiles.includes(tileKey(raw))) {
                node.classList.add("fnmj-selectable");
                if (this.selectedDiscardIndex === Number(node.dataset.index)) node.classList.add("fnmj-selected");
                node.setAttribute("role", "button");
                node.setAttribute("tabindex", "0");
              }
            });
          }
        }
        if (meldBox) {
          meldBox.innerHTML = renderMelds(player);
          meldBox.classList.toggle("has-meld", !!(player?._fulou?.length));
        }

        const river = this.root.querySelector(`#fnmjRiver${id}`);
        river.innerHTML = renderRiver(m.he[l]);
        river.classList.toggle("is-turn", id === turnSeat);

        if (seatRoot) {
          seatRoot.classList.toggle("active-seat", id === turnSeat);
          seatRoot.classList.toggle("is-current-turn", id === turnSeat);
        }
      }

      this.detectVisualEvent(m);
      this.drawActions();
    }

    showCallCutin(f) {
      const meld = f?.m || "";
      const actor = Number.isInteger(f?.l) ? f.l : this.seat;
      const label = /^[mpsz]\d{4}/.test(meld) ? "カン！" : (meld.includes("-") ? "チー！" : "ポン！");
      const wind = WIND[actor] || "";
      this.showCutin(label, `${wind}家`);
    }

    showCutin(label, sub = "") {
      const box = this.root.querySelector("#fnmjCutin");
      if (!box) return;
      const title = this.root.querySelector("#fnmjCutinLabel");
      const desc = this.root.querySelector("#fnmjCutinSub");
      if (title) title.textContent = label;
      if (desc) desc.textContent = sub;
      box.classList.remove("hidden", "show");
      void box.offsetWidth;
      box.classList.add("show");
      clearTimeout(this._cutinTimer);
      this._cutinTimer = setTimeout(() => box.classList.add("hidden"), 760);
    }

    detectVisualEvent(m) {
      const counts = (m.shoupai || []).map(sp => (sp?._fulou || []).length);
      const rivers = (m.he || []).map(h => h?._pai?.length || 0);

      if (this._visualFuluSeen == null) {
        this._visualFuluSeen = counts.slice();
        this._visualRiverSeen = rivers.slice();
        return;
      }

      for (let l = 0; l < 4; l++) {
        if (counts[l] > (this._visualFuluSeen[l] || 0)) {
          const meld = m.shoupai?.[l]?._fulou?.slice(-1)[0] || "";
          const label = /^[mpsz]\d{4}[+=-]?$/.test(meld) ? "カン！"
                      : meld.includes("-") ? "チー！"
                      : "ポン！";
          this.showCutin(label, `${WIND[l]}家`);
          break;
        }
      }

      for (let l = 0; l < 4; l++) {
        if (rivers[l] > (this._visualRiverSeen[l] || 0)) {
          const p = m.he?.[l]?._pai?.slice(-1)[0] || "";
          if (p.endsWith("*")) this.showCutin("リーチ！", `${WIND[l]}家`);
        }
      }

      this._visualFuluSeen = counts.slice();
      this._visualRiverSeen = rivers.slice();
      this._visualFuluCount = counts.reduce((a,b) => a + b, 0);
      const latest = (m.he || []).map(h => h?._pai?.slice(-1)[0] || "").filter(Boolean).pop() || "";
      this._visualLastDiscard = latest || this._visualLastDiscard;
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

  function concealedTiles(sp, includeZimo = false) {
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
    if (includeZimo && sp._zimo && sp._zimo.length === 2 && sp._zimo !== "_") out.push(tileKey(sp._zimo));
    return out;
  }

  function renderMeld(m) {
    if (!m) return "";
    const digits = m.match(/\d/g) || [];
    const suit = m[0];
    const calledIndex = digits.length ? digits.length - 1 : -1;
    const open = /[+=-]$/.test(m);
    const ankan = digits.length === 4 && !open;
    const openKan = digits.length === 4 && open;

    if (ankan) {
      return `<span class="fnmj-meld ankan">${digits.map((n,i) =>
        (i === 0 || i === 3) ? '<i class="fnmj-meld-back"></i>' : tileImg(suit+n)
      ).join("")}</span>`;
    }

    return `<span class="fnmj-meld ${openKan ? "open-kan" : ""}">${digits.map((n,i) => {
      const called = open && i === calledIndex;
      return `<span class="fnmj-meld-tile${called ? " called" : ""}">${tileImg(suit+n)}</span>`;
    }).join("")}</span>`;
  }

  function renderMelds(sp) {
    return (sp?._fulou || []).map(renderMeld).join("");
  }

  function renderHand(sp, selectable) {
    if (!sp) return "";
    const concealed = concealedTiles(sp, false);
    const zimo = sp._zimo && sp._zimo !== "_" ? tileKey(sp._zimo) : "";
    const body = concealed.map((p, i) =>
      `<span class="fnmj-tile-wrap" data-raw="${p}" data-index="${i}">${tileImg(p)}</span>`
    ).join("");
    const zimoHtml = zimo
      ? `<span class="fnmj-zimo-gap" aria-hidden="true"></span><span class="fnmj-tile-wrap zimo-tile" data-raw="${zimo}" data-index="${concealed.length}">${tileImg(zimo)}</span>`
      : "";
    return `<span class="fnmj-concealed">${body}</span>${zimoHtml}`;
  }

  function renderOpponentHand(sp) {
    const meldCount = (sp?._fulou || []).reduce((n,m) => n + (m.match(/[0-9]/g) || []).length, 0);
    const total = countVisibleTiles(sp);
    const closed = Math.max(0, total - meldCount);
    const backCount = Math.min(14, closed);
    return `<span class="fnmj-opponent-backs">${Array.from({length:backCount}, () => '<i class="fnmj-opponent-back"></i>').join("")}</span>`;
  }

  function renderRiver(he) {
    if (!he?._pai) return "";
    return he._pai.map(p => {
      const riichi = /\*$/.test(p);
      const called = /[+=-]$/.test(p);
      const raw = p.replace(/[+=*\-]$/, "");
      return `<span class="fnmj-river-tile${called ? " called" : ""}${riichi ? " riichi" : ""}">${tileImg(raw)}</span>`;
    }).join("");
  }

  function countVisibleTiles(sp) {
    if (!sp) return 13;
    let n = concealedTiles(sp, false).length;
    if (sp._zimo && sp._zimo.length === 2 && sp._zimo !== "_") n += 1;
    for (const m of sp._fulou || []) n += (m.match(/[0-9]/g) || []).length;
    return n;
  }

  async function load() {
    if (loading) return loading;
    loading = import(CORE_URL).then(core => {
      const Majiang = core.default || core;
      if (!Majiang.Game || !Majiang.Player || !Majiang.rule) throw new Error("Kobalab Majiang core のロードに失敗しました");
      return Majiang;
    });
    return loading;
  }

  // Lightweight mobile-safe CPU.  Kobalab AI performs a deep hand evaluation
  // on every draw, which can block Safari/iPhone for a long time.  The game
  // rules, legal move generation and scoring remain Kobalab core; only the
  // decision policy is intentionally bounded for realtime web play.
  function makeCpuClass(Majiang) {
    class Cpu extends Majiang.Player {
      action(msg, callback) {
        this.__fnResponded = false;
        this._cpu_timer && clearTimeout(this._cpu_timer);
        this._cpu_timer = setTimeout(() => {
          if (typeof this._callback === "function") {
            console.error("[FORTUNE NOIR] CPU callback watchdog released a stalled action", msg);
            this._safeReply({});
          }
        }, 3500);
        super.action(msg, callback);
      }

      _safeReply(payload = {}) {
        this._cpu_timer && clearTimeout(this._cpu_timer);
        this._cpu_timer = null;
        const cb = this._callback;
        if (typeof cb !== "function" || this.__fnResponded) return;
        this.__fnResponded = true;
        this._callback = null;
        cb(payload || {});
      }

      action_kaiju() { this._safeReply({}); }
      action_qipai() { this._safeReply({}); }

      action_zimo(z, gangzimo) {
        if (z.l !== this._menfeng) return this._safeReply({});
        try {
          if (this.allow_hule(this.shoupai, null, !!gangzimo)) {
            return this._safeReply({ hule: "-" });
          }
          const dapai = this.get_dapai(this.shoupai) || [];
          if (!dapai.length) return this._safeReply({});
          // Preserve xiangting first; tie-break toward honors/terminals.
          const base = Majiang.Util.xiangting(this.shoupai);
          let best = dapai[0], bestScore = Infinity;
          for (const p of dapai) {
            const next = this.shoupai.clone().dapai(p);
            const x = Majiang.Util.xiangting(next);
            const honorPenalty = p[0] === "z" ? 0.25 : 0;
            const edgePenalty = p[0] !== "z" && (p[1] === "1" || p[1] === "9") ? 0.12 : 0;
            const score = x * 10 + honorPenalty + edgePenalty;
            if (x < base || score < bestScore) { bestScore = score; best = p; }
          }
          this._safeReply({ dapai: best });
        } catch (e) {
          console.error("[FORTUNE NOIR] CPU zimo error", e);
          try {
            const d = this.get_dapai(this.shoupai) || [];
            this._safeReply(d.length ? { dapai: d[d.length - 1] } : {});
          } catch (_) { this._safeReply({}); }
        }
      }

      action_dapai(d) {
        if (d.l === this._menfeng) return this._safeReply({});
        try {
          const dir = ["", "+", "=", "-"][(4 + d.l - this._menfeng) % 4];
          const reaction = d.p.slice(0, 2) + dir;
          if (this.allow_hule(this.shoupai, reaction, false)) {
            return this._safeReply({ hule: "-" });
          }

          const current = Majiang.Util.xiangting(this.shoupai);
          let bestCall = null, bestX = current;
          for (const m of (this.get_peng_mianzi(this.shoupai, reaction) || [])) {
            const x = Majiang.Util.xiangting(this.shoupai.clone().fulou(m));
            if (x < bestX) { bestX = x; bestCall = m; }
          }
          const canChi = this._menfeng === ((d.l + 1) % 4);
          if (canChi) {
            for (const m of (this.get_chi_mianzi(this.shoupai, reaction) || [])) {
              const x = Majiang.Util.xiangting(this.shoupai.clone().fulou(m));
              if (x < bestX) { bestX = x; bestCall = m; }
            }
          }
          if (bestCall) return this._safeReply({ fulou: bestCall });
          this._safeReply({});
        } catch (e) {
          console.error("[FORTUNE NOIR] CPU reaction error", e);
          this._safeReply({});
        }
      }

      action_fulou(f) {
        if (f.l !== this._menfeng || f.m.match(/^[mpsz]\d{4}/)) return this._safeReply({});
        try {
          const d = this.get_dapai(this.shoupai) || [];
          this._safeReply(d.length ? { dapai: d[d.length - 1] } : {});
        } catch (_) { this._safeReply({}); }
      }
      action_gang() { this._safeReply({}); }
      action_hule() { this._safeReply({}); }
      action_pingju() { this._safeReply({}); }
      action_jieju() { this._safeReply({}); }
    }
    return Cpu;
  }

  function makeHumanClass(Majiang, ui) {
    class Human extends Majiang.Player {
      action_kaiju() { this.__fnResponded = false; ui.respond(this, {}); }
      action_qipai() { this.__fnResponded = false; ui.respond(this, {}); }
      action_zimo(z, gangzimo) {
        this.__fnResponded = false;
        if (z.l === this._menfeng) ui.humanTurn(this, !!gangzimo, false);
        else ui.respond(this, {});
      }
      action_dapai(d) {
        this.__fnResponded = false;
        if (d.l === this._menfeng) {
          ui.discardChoices = null;
          ui.riichiSelecting = false;
          ui.selectedDiscardIndex = null;
          ui.clearActions();
          ui.respond(this, {});
        }
        else ui.opponentDiscard(this, d);
      }
      action_fulou(f) {
        this.__fnResponded = false;
        if (f.l === this._menfeng) ui.humanTurn(this, false, true);
        else ui.respond(this, {});
      }
      action_gang(g) {
        this.__fnResponded = false;
        ui.showCutin("カン！", `${WIND[this._menfeng]}家`);
        // After a kan declaration the engine must proceed to the replacement draw.
        ui.respond(this, {});
      }
      action_hule(h) {
        this.__fnResponded = false;
        ui.showResult("和了", h);
        ui.respond(this, {});
      }
      action_pingju(p) {
        this.__fnResponded = false;
        ui.showResult(p?.name || "流局", p);
        ui.respond(this, {});
      }
      action_jieju(p) {
        this.__fnResponded = false;
        ui.showResult("対局終了", p);
        ui.respond(this, {});
      }
    }
    return Human;
  }


  async function start() {
    if (runtime) return runtime;
    const STYLE_BUILD = "20260925-jantama-table-rebuild-01";
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      try {
        const href = link.getAttribute("href") || "";
        if (href.includes("mahjong.css")) {
          link.setAttribute("href", `./mahjong.css?v=${STYLE_BUILD}`);
        }
      } catch (_) {}
    });
    const host = document.getElementById("modalContent");
    if (!host) throw new Error("modalContent が見つかりません");
    host.style.width = "100%";
    host.style.height = "100%";
    host.style.minHeight = "0";
    host.style.overflow = "hidden";
    host.innerHTML = `<div id="fnMahjongRoot" class="fn-mahjong-root"></div>`;

    const Majiang = await load();
    const ui = new TableUI(host.querySelector("#fnMahjongRoot"), Majiang);
    const Human = makeHumanClass(Majiang, ui);
    const CpuPlayer = makeCpuClass(Majiang);
    const human = new Human();
    const players = [human, new CpuPlayer(), new CpuPlayer(), new CpuPlayer()];
    const FN_MAHJONG_RULE = Majiang.rule({
      "配給原点": 25000,
      "順位点": ["15","5","-5","-15"],
      "赤牌": { m: 1, p: 1, s: 1 },
      "クイタンあり": true,
      "喰い替え許可レベル": 0,
      "場数": 2,
      "途中流局あり": true,
      "流し満貫あり": true,
      "ノーテン宣言あり": false,
      "ノーテン罰あり": true,
      "最大同時和了数": 3,
      "連荘方式": 2,
      "トビ終了あり": true,
      "オーラス止めあり": true,
      "延長戦方式": 1,
      "一発あり": true,
      "裏ドラあり": true,
      "カンドラあり": true,
      "カン裏あり": true,
      "カンドラ後乗せ": true,
      "ツモ番なしリーチあり": false,
      "リーチ後暗槓許可レベル": 2,
      "役満の複合あり": true,
      "ダブル役満あり": true,
      "数え役満あり": true,
      "役満パオあり": true,
      "切り上げ満貫あり": false
    });
    const game = new Majiang.Game(players, paipu => ui.showResult("対局終了", paipu), FN_MAHJONG_RULE, "FORTUNE NOIR 4 PLAYER MAHJONG");
    game.view = null;
    game.speed = 0;
    game.dwell = 0;

    runtime = {game,human,ui};
    ui.bind(game,human);

    // Deterministic Kobalab boot: run only the initial kaiju/qipai/zimo
    // handshake synchronously.  We stop exactly when the human's first
    // zimo response is waiting, then return Game to normal async mode.
    // This avoids Safari/iPhone timing races where the opening hand could
    // remain stuck on "配牌中".
    try {
      game._sync = true;
      game.kaiju(0);
      for (let guard = 0; guard < 8; guard++) {
        if (!game._reply || game._reply.filter(x => x).length < 4) break;
        if (game._status === "zimo") break;
        game.next();
      }
      game._sync = false;
      // If the human callback was already satisfied during boot, let the
      // normal asynchronous state machine take the next step.
      if (game._reply && game._reply.filter(x => x).length === 4) {
        setTimeout(() => { try { game.next(); } catch (e) { console.error(e); } }, 0);
      }
    } catch (e) {
      game._sync = false;
      throw e;
    }
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
