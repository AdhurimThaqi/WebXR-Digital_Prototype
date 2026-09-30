// The match for SPIN: menus, serving, scoring, the announcer and ORBIT,
// the AI opponent. These methods are mixed into the 'ping-pong' component
// in game.js, so `this` is that component.
//
// Rules (a friendly version of table tennis):
//  - after you hit, the ball must bounce on the other side of the net
//  - if it bounces on your own side, or misses the table, you lose the point
//  - if it bounces twice on the other side, or the other player misses, you win it
//  - serves may go straight over the net; the serve changes every 2 points
//  - first to 7 wins, but you must be 2 points ahead (at deuce, 10 points wins outright)

window.PP_LEVELS = {
  rookie: { id: 'rookie', name: 'ROOKIE', speed: 2.3, react: 0.28, miss: 0.2, flight: [0.62, 0.72], spread: 0.35, smash: 0.0, color: '#6dffb0' },
  pro: { id: 'pro', name: 'PRO', speed: 3.4, react: 0.17, miss: 0.09, flight: [0.52, 0.62], spread: 0.52, smash: 0.2, color: '#39e4ff' },
  legend: { id: 'legend', name: 'LEGEND', speed: 5.2, react: 0.08, miss: 0.035, flight: [0.42, 0.52], spread: 0.62, smash: 0.4, color: '#ff4f7b' },
};

window.PPRules = (() => {
  const T = PP.TABLE;
  const G = 9.81;
  const R = 0.02;
  const TARGET = 7;
  const rand = (a, b) => a + Math.random() * (b - a);
  const other = (who) => (who === 'player' ? 'ai' : 'player');

  return {
    // ---------------------------------------------------------------- menus
    showMenu: function (kind) {
      const ui = this.ui;
      const C = PP.colors;
      this.state = kind === 'over' ? 'over' : 'menu';
      this.ball.mode = 'hidden';
      ui.menu.visible = true;
      ui.hint('');
      const how = this.vr ? 'Tap a button with your paddle' : 'Click a button · or press Enter VR for the full experience';

      if (kind === 'over') {
        const won = this.score.player > this.score.ai;
        ui.drawTitle({
          kicker: won ? 'GAME, SET AND MATCH' : `ORBIT · ${this.level.name} WINS`,
          title: won ? 'VICTORY' : 'DEFEAT',
          sub: `${this.score.player}  :  ${this.score.ai}`,
          body: [
            `Longest rally ${this.stats.best} · Fastest shot ${this.stats.fastest} km/h · Smashes ${this.stats.smashes}`,
            `All-time best rally: ${this.allTimeBest}`,
          ],
        });
        ui.setButtons([
          { id: 'again', label: 'REMATCH', sub: `vs ${this.level.name}`, x: -0.19, y: 1.18, w: 0.34, h: 0.15, color: this.level.color, onPress: () => this.startGame(this.level.id) },
          { id: 'menu', label: 'MENU', sub: 'change opponent', x: 0.19, y: 1.18, w: 0.34, h: 0.15, color: C.ink, onPress: () => this.showMenu('main') },
        ]);
        return;
      }

      this.drawScore();
      ui.drawTitle({
        kicker: 'HSLU · WEBXR PROTOTYPE',
        title: 'SPIN',
        sub: 'VR Table Tennis in the Night Arena',
        body: ['Choose your opponent to start', how],
      });
      const L = window.PP_LEVELS;
      ui.setButtons([
        { id: 'rookie', label: 'ROOKIE', sub: 'relaxed rallies', x: -0.36, y: 1.2, w: 0.33, h: 0.15, color: L.rookie.color, onPress: () => this.startGame('rookie') },
        { id: 'pro', label: 'PRO', sub: 'quick and tricky', x: 0, y: 1.2, w: 0.33, h: 0.15, color: L.pro.color, onPress: () => this.startGame('pro') },
        { id: 'legend', label: 'LEGEND', sub: 'good luck', x: 0.36, y: 1.2, w: 0.33, h: 0.15, color: L.legend.color, onPress: () => this.startGame('legend') },
        { id: 'assist', label: this.assistLabel(), x: -0.19, y: 1.03, z: -0.44, w: 0.34, h: 0.085, color: C.gold, onPress: () => this.toggleAssist() },
        { id: 'music', label: this.musicLabel(), x: 0.19, y: 1.03, z: -0.44, w: 0.34, h: 0.085, color: C.gold, onPress: () => this.toggleMusic() },
      ]);
    },

    assistLabel: function () { return `AIM ASSIST · ${this.assist ? 'ON' : 'OFF'}`; },
    musicLabel: function () { return `MUSIC · ${PPAudio.musicOn ? 'ON' : 'OFF'}`; },
    toggleAssist: function () { this.assist = !this.assist; this.ui.relabel('assist', this.assistLabel()); },
    toggleMusic: function () { PPAudio.setMusic(!PPAudio.musicOn); this.ui.relabel('music', this.musicLabel()); },

    // ---------------------------------------------------------------- the match
    startGame: function (levelId) {
      this.level = window.PP_LEVELS[levelId];
      this.score = { player: 0, ai: 0 };
      this.stats = { best: 0, fastest: 0, smashes: 0 };
      this.lastSpeed = 0;
      this.ui.menu.visible = false;
      this.ui.setButtons([]);
      this.opponent.visible = true;
      this.opponent.userData.visor.material.color.set(this.level.color);
      PPAudio.chime('start');
      PPAudio.speak(`${this.level.name.toLowerCase()} level. First to ${TARGET}. You serve.`);
      this.ui.banner('GAME ON', `vs ORBIT · ${this.level.name}`, this.level.color, 1.6);
      this.arena.cheer(0.7);
      PPAudio.cheer(0.6);
      this.rally = { hitter: null, opp: 0, hits: 0, timer: 0 };
      this.drawScore();
      this.setState('pre');
    },

    setState: function (state) {
      this.state = state;
      this.stateT = 0;
    },

    server: function () {
      const total = this.score.player + this.score.ai;
      const deuce = this.score.player >= TARGET - 1 && this.score.ai >= TARGET - 1;
      const turn = deuce ? total : Math.floor(total / 2);
      return turn % 2 === 0 ? 'player' : 'ai';
    },

    nextServe: function () {
      this.rally = { hitter: null, opp: 0, hits: 0, timer: 0 };
      this.resetBall();
      PPAudio.tension(0);
      if (this.server() === 'player') {
        this.setState('serve-player');
        this.ball.mode = 'hover';
        this.ball.pos.copy(this.servePos);
        this.ui.hint(this.vr ? 'Your serve · swing through the floating ball' : 'Your serve · move onto the ball and click');
      } else {
        this.setState('serve-ai');
        this.ball.mode = 'held';
        this.ai.serveX = rand(-0.45, 0.45);
        this.ui.hint('ORBIT serves · get ready');
      }
      this.drawScore();
    },

    drawScore: function () {
      this.ui.drawScore({
        you: this.score.player, ai: this.score.ai, aiName: 'ORBIT',
        server: this.level && this.state !== 'over' ? this.server() : null,
        rally: this.rally ? this.rally.hits : 0,
        lastSpeed: this.lastSpeed, best: this.stats.best, target: TARGET,
      });
    },

    // ---------------------------------------------------------------- rule events
    onBounce: function (side) {
      if (this.state !== 'rally' || !this.rally.hitter) return;
      const r = this.rally;
      if (side === r.hitter && r.hits === 1 && r.opp === 0 && !r.serveBounce) {
        r.serveBounce = true; // a proper serve: first on your own side, then over the net
        return;
      }
      if (side === r.hitter) {
        this.point(other(r.hitter), r.hitter === 'player' ? 'Bounced on your side' : 'ORBIT hit its own side');
      } else {
        r.opp++;
        if (r.opp === 2) this.point(r.hitter, r.hitter === 'player' ? 'Unreturnable!' : 'Too fast to return');
      }
    },

    // The ball touched the floor, or flew off into the stands
    onBallDead: function () {
      if (this.state !== 'rally' || !this.rally.hitter) return;
      const r = this.rally;
      if (r.opp >= 1) this.point(r.hitter, r.hitter === 'player' ? 'ORBIT missed' : 'You missed it');
      else this.point(other(r.hitter), r.hitter === 'player' ? 'Out' : 'ORBIT hit it out');
    },

    point: function (winner, reason) {
      this.setState('point');
      this.score[winner]++;
      const hits = this.rally.hits;
      this.stats.best = Math.max(this.stats.best, hits);
      if (this.stats.best > this.allTimeBest) {
        this.allTimeBest = this.stats.best;
        try { localStorage.setItem('spin-best-rally', String(this.allTimeBest)); } catch (e) { /* private mode */ }
      }
      PPAudio.tension(0);
      const excitement = Math.min(1, 0.45 + hits / 12);
      if (winner === 'player') {
        this.ui.banner('POINT!', reason, PP.colors.accent, 1.5);
        PPAudio.chime('point');
        PPAudio.cheer(excitement);
        this.arena.cheer(excitement);
      } else {
        this.ui.banner('ORBIT SCORES', reason, PP.colors.hot, 1.5);
        PPAudio.chime('lose');
        PPAudio.groan();
        this.arena.cheer(0.12);
      }
      this.drawScore();

      // The announcer reads the score, the server's score first
      const p = this.score.player, a = this.score.ai;
      const done = (p >= TARGET || a >= TARGET) && (Math.abs(p - a) >= 2 || Math.max(p, a) >= TARGET + 3);
      if (!done) {
        const s = this.server();
        let call = s === 'player' ? `${p}, ${a}` : `${a}, ${p}`;
        if (p === a && p >= TARGET - 1) call = 'Deuce';
        else if ((p >= TARGET - 1 && p > a) || (a >= TARGET - 1 && a > p)) call += p > a ? '. Match point' : '. Match point, ORBIT';
        setTimeout(() => PPAudio.speak(call), 700);
      }
      this.matchOver = done;
    },

    endGame: function () {
      const won = this.score.player > this.score.ai;
      this.opponent.userData.celebrate = won ? 0 : 1;
      if (won) {
        PPAudio.chime('win');
        PPAudio.cheer(1);
        this.arena.cheer(1);
        PPAudio.speak('Game, set and match. You win!');
      } else {
        PPAudio.groan();
        PPAudio.speak(`ORBIT wins, ${this.score.ai} to ${this.score.player}.`);
      }
      this.showMenu('over');
      this.drawScore();
    },

    // Timed steps between points
    updateFlow: function (dt) {
      this.stateT += dt;
      if (this.state === 'pre' && this.stateT > 1.9) this.nextServe();
      if (this.state === 'point' && this.stateT > 2.3) {
        if (this.matchOver) this.endGame();
        else this.nextServe();
      }
      if (this.state === 'rally') {
        this.rally.timer += dt;
        const b = this.ball.pos;
        const flewAway = b.z > 3 || b.z < T.cz - 5.5 || Math.abs(b.x) > 3.3;
        if (flewAway || this.rally.timer > 4.5) this.onBallDead();
      }
    },

    // ---------------------------------------------------------------- shots
    // The velocity that carries the ball from `from` to (tx, tz) on the table in
    // about t seconds, raised into a higher arc until it clears the net.
    solveShot: function (from, tx, tz, t, out) {
      for (let k = 0; k < 16; k++) {
        out.set((tx - from.x) / t, (T.top + R - from.y + 0.5 * G * t * t) / t, (tz - from.z) / t);
        const tn = (T.cz - from.z) / out.z;
        if (!(tn > 0 && tn < t)) break;
        const yn = from.y + out.y * tn - 0.5 * G * tn * tn;
        if (yn > T.top + T.netH + 0.05) break;
        t *= 1.08;
      }
      return out;
    },

    // Aim assist: keep the direction and pace of your swing, but make sure the
    // ball clears the net and lands on ORBIT's side.
    applyAssist: function () {
      if (!this.assist) return;
      const b = this.ball;
      const v = b.vel;
      if (v.z > -1.5) v.z = -1.5 - Math.random() * 0.8; // a push that went backwards still goes over
      // Where would the ball come down with no help?
      const h = T.top + R - b.pos.y;
      const disc = v.y * v.y - 2 * G * h;
      const tLand = disc > 0 ? (v.y + Math.sqrt(disc)) / G : 0.5;
      const tx = Math.max(-0.62, Math.min(0.62, b.pos.x + v.x * tLand));
      let tz = Math.max(T.far + 0.16, Math.min(T.cz - 0.3, b.pos.z + v.z * tLand));
      let pace = Math.max(3.2, Math.min(12, Math.hypot(v.x, v.z)));
      if (!this.vr) {
        // A mouse can't swing like an arm, so desktop shots get extra pace and depth
        pace = Math.max(pace, 6 + Math.min(3, Math.abs(this.pad.vel.x) + Math.abs(this.pad.vel.y)));
        tz = Math.min(tz, T.cz - 0.6);
      }
      const t = Math.max(0.3, Math.min(1.3, Math.hypot(tx - b.pos.x, tz - b.pos.z) / pace));
      this.solveShot(b.pos, tx, tz, t, v);
    },

    aiShoot: function (serve) {
      const L = this.level;
      const b = this.ball;
      const tx = Math.max(-0.62, Math.min(0.62, rand(-1, 1) * L.spread));
      const tz = Math.min(T.near - 0.12, T.cz + (serve ? rand(0.45, 1.0) : rand(0.35, 1.2)));
      let t = serve ? rand(0.6, 0.7) : rand(L.flight[0], L.flight[1]);
      const smash = !serve && b.pos.y > T.top + 0.42 && Math.random() < L.smash;
      if (smash) t *= 0.62;
      this.solveShot(b.pos, tx, tz, t, b.vel);
      b.mode = 'live';
      b.netCords = 0;
      const r = this.rally;
      r.hitter = 'ai';
      r.opp = 0;
      r.hits++;
      r.timer = 0;
      this.ai.swing = 0;
      this.ai.plan = null;
      PPAudio.paddle(b.pos, smash ? 0.95 : 0.55);
      this.sparks(b.pos, smash ? 0xff4f7b : 0xffffff, smash ? 40 : 14);
      if (smash) {
        PPAudio.whoosh(b.pos);
        this.ui.popup('SMASH!', PP.colors.hot, this.tmp.set(b.pos.x, b.pos.y + 0.25, b.pos.z));
      }
      PPAudio.tension(r.hits / 16);
      this.drawScore();
    },

    // ---------------------------------------------------------------- ORBIT, the opponent
    updateAI: function (dt) {
      const ai = this.ai;
      const L = this.level;
      const b = this.ball;
      const blade = ai.blade;
      ai.swing = Math.min(1, ai.swing + dt / 0.3);

      let target = ai.idle.set(b.mode === 'live' ? b.pos.x * 0.35 : 0, T.top + 0.38, this.AI_Z);

      if (this.state === 'serve-ai') {
        const t = this.stateT;
        target = ai.idle.set(ai.serveX + 0.1, T.top + 0.2, T.far - 0.18);
        const hand = this.tmp.set(ai.serveX - 0.05, T.top + 0.14, T.far - 0.14);
        if (t < 1.1) {
          b.pos.copy(hand);
        } else {
          const tt = t - 1.1; // the toss: straight up and down again
          b.pos.set(hand.x, hand.y + 2.4 * tt - 0.5 * G * tt * tt, hand.z);
          if (tt > 0.4) {
            this.setState('rally');
            this.ui.hint('');
            this.aiShoot(true);
          }
        }
      } else if (this.state === 'rally' && L) {
        const r = this.rally;
        // Read your shot after a short reaction time, then run to where the ball will be
        if (r.hitter === 'player' && !ai.plan && r.timer > L.react) ai.plan = this.planIntercept();
        const plan = ai.plan;
        if (plan && !plan.skip) {
          target = plan.point;
          if (!plan.done && b.vel.z < 0 && b.pos.z <= plan.point.z + 0.03) {
            plan.done = true;
            const reach = blade.distanceTo(b.pos);
            if (!plan.miss && reach < 0.4 && r.opp === 1) this.aiShoot(false);
            else ai.swing = 0; // swings and misses
          }
        }
      }

      // Move the paddle, no faster than this level allows
      const step = L ? L.speed * dt : 3 * dt;
      ai.delta.subVectors(target, blade);
      if (ai.delta.length() > step) ai.delta.setLength(step);
      blade.add(ai.delta);
    },

    // Look ahead: where can ORBIT meet the ball after it bounces on its side?
    planIntercept: function () {
      const L = this.level;
      const p = this.tmpA.copy(this.ball.pos);
      const v = this.tmpB.copy(this.ball.vel);
      let bounced = false;
      const h = 1 / 120;
      for (let t = 0; t < 3; t += h) {
        v.y -= G * h;
        p.addScaledVector(v, h);
        if (!bounced && v.y < 0 && p.y <= T.top + R && Math.abs(p.x) <= T.width / 2 && p.z <= T.near && p.z >= T.far) {
          if (p.z > T.cz) return { skip: true }; // it will land on the player's own side
          bounced = true;
          p.y = T.top + R;
          v.y = -v.y * 0.88;
        }
        if (!bounced && (p.z < T.far - 0.3 || p.y < T.top)) return { skip: true }; // going out: let it go
        if (bounced && ((v.y < 0 && p.y < T.top + 0.36) || p.z < this.AI_Z)) {
          const point = p.clone();
          point.z = Math.max(point.z, this.AI_Z - 0.4);
          const need = this.ai.blade.distanceTo(point) / Math.max(0.12, t); // t = time left until the ball arrives
          const fast = this.ball.vel.length() > 13 ? 0.15 : 0;
          const miss = Math.random() < L.miss + fast || need > L.speed * 1.25;
          if (miss) point.x += (Math.random() < 0.5 ? -1 : 1) * 0.28; // arrives a little off
          return { point, miss, done: false };
        }
      }
      return { skip: true };
    },
  };
})();
