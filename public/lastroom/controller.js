// Runs the story: which room you are in, the hold-to-remember trigger,
// the memories, the letter, and the fades between rooms.
// Tip while building: open lastroom.html?scene=kitchen to jump straight to a room.

AFRAME.registerComponent('last-room', {
  init: function () {
    const story = window.LAST_ROOM;
    this.scenes = story.scenes;
    this.sceneById = Object.fromEntries(story.scenes.map((s) => [s.id, s]));
    this.current = null;
    this.busy = false;
    this.timers = [];

    const $ = (selector) => document.querySelector(selector);
    this.ui = {
      header: $('#ui-header'),
      label: $('#ui-label'),
      memory: $('#ui-memory'),
      letter: $('#ui-letter'),
      next: $('#ui-continue'),
      step: $('#ui-step'),
      title: $('#ui-title'),
      enter: $('#ui-enter'),
      end: $('#ui-end'),
      again: $('#ui-again'),
    };
    this.eye = new AFRAME.THREE.Vector3();
    this.forward = new AFRAME.THREE.Vector3();
    this.right = new AFRAME.THREE.Vector3();
    this.up = new AFRAME.THREE.Vector3();

    this.el.addEventListener('hold-start', () => LRAudio.chargeStart());
    this.el.addEventListener('hold-cancel', () => LRAudio.chargeStop());
    this.el.addEventListener('hold-progress', (evt) => {
      LRAudio.chargeUpdate(evt.detail.progress);
      this.drawLabel(evt.detail.progress, evt.detail.holding ? 'holding' : 'idle');
    });
    this.el.addEventListener('hold-complete', () => this.onTrigger());

    this.ui.enter.addEventListener('press', () => this.goTo('doorstep'));
    this.ui.next.addEventListener('press', () => this.onContinue());
    this.ui.step.addEventListener('press', () => this.goTo('end', 1600));
    this.ui.again.addEventListener('press', () => this.restart());

    // Audio may only start after a click; Enter VR counts as one.
    window.addEventListener('pointerdown', () => LRAudio.start());
    this.el.addEventListener('enter-vr', () => {
      LRAudio.start();
      this.el.setAttribute('raycaster', 'enabled', false); // controllers point in VR, not the mouse
      // re-centre the title / end screen in front of you once the headset pose is known
      this.later(() => { if (this.current && this.current.type && !this.busy) this.layoutUI(this.current); }, 500);
    });
    this.el.addEventListener('exit-vr', () => this.el.setAttribute('raycaster', 'enabled', true));

    const fontsReady = Promise.race([
      Promise.all([
        document.fonts.load(`700 80px ${LR.fonts.display}`),
        document.fonts.load(`600 80px ${LR.fonts.display}`),
        document.fonts.load(`italic 400 40px ${LR.fonts.display}`),
        document.fonts.load(`italic 400 40px ${LR.fonts.body}`),
        document.fonts.load(`400 40px ${LR.fonts.body}`),
      ]),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]).catch(() => {});

    const begin = () => fontsReady.then(() => {
      this.createFader();
      const requested = new URLSearchParams(location.search).get('scene');
      this.goTo(this.sceneById[requested] ? requested : 'intro', 0);
    });
    if (this.el.hasLoaded) begin();
    else this.el.addEventListener('loaded', begin);

    window.LR_DEBUG = this; // handy for testing from the browser console
  },

  // ---------------------------------------------------------------- scene flow
  goTo: async function (id, fadeMs = 700) {
    if (this.busy) return;
    this.busy = true;
    const scene = this.sceneById[id];
    const previous = this.current;

    this.hideUI();
    if (fadeMs) await this.fade(1, fadeMs);
    this.clearTimers();
    LRAudio.chargeStop();

    if (previous) document.querySelector(`#scene-${previous.id}`).setAttribute('visible', false);
    const root = document.querySelector(`#scene-${id}`);
    root.setAttribute('visible', true);
    this.current = scene;
    this.triggerDone = false;
    this.root = root;

    // Only the current room's trigger can be pointed at
    document.querySelectorAll('[hold-to-activate]').forEach((el) => el.classList.remove('interactive'));
    root.querySelectorAll('[hold-to-activate]').forEach((el) => el.classList.add('interactive'));
    this.refreshRaycasters();

    this.emitToRoom('scene-start');
    this.layoutUI(scene);
    LRAudio.setAmbience(id, scene.vr ? scene.vr.sounds : {});

    if (previous && ['hallway', 'kitchen', 'garden', 'bedroom', 'epilogue'].includes(id)) LRAudio.footsteps(4);
    if (id === 'epilogue') this.later(() => LRAudio.doorClose(scene.vr.sounds.door), 1400);
    if (id === 'end') this.later(() => LRAudio.playTune('end'), 900);

    await this.fade(0, fadeMs ? 1000 : 1500);
    this.busy = false;
  },

  onTrigger: function () {
    const scene = this.current;
    if (!scene || this.triggerDone) return;
    this.triggerDone = true;
    LRAudio.chargeStop();
    LRAudio.chime();
    this.drawLabel(1, 'done');
    this.later(() => this.ui.label.components['canvas-panel'].hide(), 1300);

    this.emitToRoom('memory-on');
    LRAudio.memoryAmbience();
    this.drawHeader(scene, false); // like the 2D version: the description goes once you act

    if (scene.id === 'doorstep') {
      LRAudio.creak(scene.vr.sounds.door);
      this.later(() => this.goTo(scene.nextScene), 1700);
    } else if (scene.memory) {
      this.later(() => this.showMemory(scene), 900);
    } else {
      this.later(() => this.goTo(scene.nextScene), 600);
    }
  },

  showMemory: function (scene) {
    const memory = scene.memory;
    const panel = (el) => el.components['canvas-panel'];
    panel(this.ui.header).hide();
    LRAudio.playTune(scene.tuneStage, scene.vr.sounds);

    if (!memory.isLetter) {
      this.drawMemory(memory);
      this.place(this.ui.memory, scene.vr.memoryPanel || scene.vr.panel, scene.vr.memoryScale || scene.vr.panelScale);
      panel(this.ui.memory).show();
      this.later(() => this.showContinue(this.ui.memory, 0, -0.72), 1400);
      return;
    }

    // The letter floats up in front of you and writes itself line by line
    LRAudio.paper();
    const position = this.inFront(1.45, -0.1);
    this.place(this.ui.letter, position, 1);
    let shown = 0;
    this.drawLetter(memory.lines, shown);
    panel(this.ui.letter).show();
    const next = () => {
      if (shown >= memory.lines.length) {
        this.showContinue(this.ui.letter, 0.88, -0.5);
        return;
      }
      const delay = memory.lines[shown] === '' ? 240 : 520;
      this.later(() => { shown++; this.drawLetter(memory.lines, shown); next(); }, delay);
    };
    this.later(next, 700);
  },

  onContinue: function () {
    const scene = this.current;
    this.ui.next.components['vr-button'].hide();
    this.ui.memory.components['canvas-panel'].hide();
    this.ui.letter.components['canvas-panel'].hide();
    LRAudio.stopTune(2.5);
    this.later(() => this.goTo(scene.nextScene, 900), 350);
  },

  restart: function () {
    LRAudio.stopTune(1.5);
    document.querySelectorAll('.reactive, [hold-to-activate]').forEach((el) => el.emit('memory-reset', null, false));
    this.goTo('intro', 1200);
  },

  // ---------------------------------------------------------------- UI
  layoutUI: function (scene) {
    if (scene.type === 'title') {
      this.drawTitle();
      const pos = this.inFront(2.6, 0.1);
      this.place(this.ui.title, pos, 1);
      this.ui.title.components['canvas-panel'].show();
      this.place(this.ui.enter, [pos[0], pos[1] - 0.95, pos[2]], 1);
      this.later(() => this.ui.enter.components['vr-button'].show(), 800);
      return;
    }
    if (scene.type === 'end') {
      this.drawEnd();
      const pos = this.inFront(2.6, 0.15);
      this.place(this.ui.end, pos, 1);
      this.ui.end.components['canvas-panel'].show();
      this.place(this.ui.again, [pos[0], pos[1] - 0.72, pos[2]], 1);
      this.later(() => this.ui.again.components['vr-button'].show(), 2500);
      return;
    }

    const { vr } = scene;
    this.drawHeader(scene, true);
    this.place(this.ui.header, vr.panel, vr.panelScale);
    this.later(() => this.ui.header.components['canvas-panel'].show(), 500);

    if (scene.triggerLabel) {
      this.lastLabel = null;
      this.drawLabel(0, 'idle');
      const distance = Math.hypot(vr.label[0], vr.label[1] - 1.6, vr.label[2]);
      this.place(this.ui.label, vr.label, Math.min(2.4, Math.max(0.6, distance * 0.42)));
      this.later(() => this.ui.label.components['canvas-panel'].show(), 1100);
    }
    if (scene.id === 'epilogue') {
      this.later(() => this.showContinue(this.ui.header, 0, -0.66, this.ui.step), 2600);
    }
  },

  hideUI: function () {
    ['header', 'label', 'memory', 'letter', 'title', 'end'].forEach((key) => this.ui[key].components['canvas-panel'].hide());
    ['next', 'step', 'enter', 'again'].forEach((key) => this.ui[key].components['vr-button'].hide());
  },

  // Puts a button next to a panel (offsets in the panel's own metres), facing you
  showContinue: function (panelEl, offsetX, offsetY, button = this.ui.next) {
    const o = panelEl.object3D;
    const scale = o.scale.x;
    this.right.set(1, 0, 0).applyQuaternion(o.quaternion);
    this.up.set(0, 1, 0).applyQuaternion(o.quaternion);
    const p = o.position.clone().addScaledVector(this.right, offsetX * scale).addScaledVector(this.up, offsetY * scale);
    this.place(button, [p.x, p.y, p.z], Math.max(0.7, scale));
    button.components['vr-button'].show();
    this.refreshRaycasters();
  },

  // Moves a UI element to a position and turns it towards your eyes
  place: function (el, position, scale) {
    const camera = this.el.sceneEl.camera;
    camera.getWorldPosition(this.eye);
    el.object3D.position.set(position[0], position[1], position[2]);
    el.object3D.scale.setScalar(scale);
    el.object3D.lookAt(this.eye);
  },

  // A point in front of where you are looking, at eye height
  inFront: function (distance, heightOffset) {
    const camera = this.el.sceneEl.camera;
    camera.getWorldPosition(this.eye);
    camera.getWorldDirection(this.forward);
    this.forward.y = 0;
    if (this.forward.lengthSq() < 0.001) this.forward.set(0, 0, -1);
    this.forward.normalize();
    const eyeY = this.el.sceneEl.is('vr-mode') ? this.eye.y : 1.6;
    return [this.eye.x + this.forward.x * distance, eyeY + heightOffset, this.eye.z + this.forward.z * distance];
  },

  // ---------------------------------------------------------------- drawing
  drawTitle: function () {
    this.ui.title.components['canvas-panel'].draw((ctx, w, h) => {
      const glow = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, w * 0.6);
      glow.addColorStop(0, 'rgba(26,20,8,0.92)');
      glow.addColorStop(1, 'rgba(13,12,10,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      LR.text(ctx, 'A NARRATIVE EXPERIENCE', w / 2, h * 0.12, { font: `400 26px ${LR.fonts.body}`, color: LR.gold(0.75), spacing: 11 });
      ctx.shadowColor = 'rgba(201,151,58,0.35)';
      ctx.shadowBlur = 40;
      LR.text(ctx, 'The Last Room', w / 2, h * 0.26, { font: `700 118px ${LR.fonts.display}`, color: '#f0e8d0' });
      ctx.shadowBlur = 0;
      ctx.fillStyle = LR.gold(0.5);
      ctx.fillRect(w / 2 - 50, h * 0.365, 100, 2);
      LR.text(ctx, "You are stepping back into your grandparent's home\nfor the last time. It is being sold.\nMost things are gone. But some rooms still remember.", w / 2, h * 0.45, {
        font: `italic 400 38px ${LR.fonts.body}`, color: 'rgba(212,192,158,0.92)', lineHeight: 58
      });
      LR.text(ctx, 'Point at the glowing object in each room and hold the trigger to unlock a memory', w / 2, h * 0.7, {
        font: `400 25px ${LR.fonts.ui}`, color: 'rgba(255,255,255,0.45)', maxWidth: w * 0.8, lineHeight: 36
      });
      LR.text(ctx, '🎧  Sound on', w / 2, h * 0.79, { font: `400 25px ${LR.fonts.ui}`, color: 'rgba(255,255,255,0.4)' });
      LR.text(ctx, 'CREALAB · HSLU · I.BA_LAB_INIS.F26 · DIGITAL PROTOTYPE', w / 2, h * 0.95, { font: `400 18px ${LR.fonts.ui}`, color: 'rgba(255,255,255,0.28)', spacing: 4 });
    });
  },

  drawEnd: function () {
    this.ui.end.components['canvas-panel'].draw((ctx, w, h) => {
      LR.text(ctx, '"You always knew where to find me.\nYou still do."', w / 2, h * 0.28, {
        font: `italic 400 58px ${LR.fonts.display}`, color: 'rgba(238,220,186,0.9)', lineHeight: 96
      });
      ctx.fillStyle = LR.gold(0.45);
      ctx.fillRect(w / 2 - 36, h * 0.62, 72, 2);
      LR.text(ctx, 'END OF EXPERIENCE', w / 2, h * 0.75, { font: `400 24px ${LR.fonts.ui}`, color: 'rgba(255,255,255,0.32)', spacing: 7 });
    });
  },

  drawHeader: function (scene, withDescription) {
    const index = this.scenes.filter((s) => s.sceneNum).indexOf(scene);
    const total = this.scenes.filter((s) => s.sceneNum).length;
    this.ui.header.components['canvas-panel'].draw((ctx, w, h) => {
      ctx.fillStyle = 'rgba(13,12,10,0.78)';
      ctx.strokeStyle = LR.gold(0.3);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(4, 4, w - 8, h - 8, 10);
      ctx.fill();
      ctx.stroke();

      LR.text(ctx, `SCENE ${scene.sceneNum} — ${scene.act.toUpperCase()}`, 60, 70, { font: `400 26px ${LR.fonts.ui}`, color: LR.gold(0.8), align: 'left', spacing: 6 });
      LR.text(ctx, scene.mood.toUpperCase(), w - 60, 70, { font: `400 22px ${LR.fonts.ui}`, color: 'rgba(255,255,255,0.35)', align: 'right', spacing: 5 });
      LR.text(ctx, scene.title, 60, 150, { font: `600 72px ${LR.fonts.display}`, color: 'rgba(240,232,210,0.96)', align: 'left' });
      ctx.fillStyle = LR.gold(0.45);
      ctx.fillRect(60, 208, 70, 2);

      if (withDescription) {
        LR.text(ctx, scene.description, 60, 268, {
          font: `italic 400 44px ${LR.fonts.body}`, color: 'rgba(214,198,170,0.95)', align: 'left', maxWidth: w - 120, lineHeight: 60
        });
      }
      if (scene.id === 'epilogue') {
        LR.text(ctx, 'The door closes softly behind you.', w / 2, h - 100, { font: `italic 400 36px ${LR.fonts.body}`, color: 'rgba(198,180,152,0.85)' });
      }
      for (let i = 0; i < total; i++) {
        ctx.fillStyle = i === index ? LR.gold(0.95) : 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.arc(w - 60 - (total - 1 - i) * 22, h - 40, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  },

  // The ring you fill by holding, with the object's name underneath
  drawLabel: function (progress, state) {
    const scene = this.current;
    if (!scene || !scene.triggerLabel) return;
    const key = state + Math.round(progress * 100);
    if (this.lastLabel === key) return;
    this.lastLabel = key;
    this.ui.label.components['canvas-panel'].draw((ctx, w, h) => {
      const cx = w / 2;
      const cy = 110;
      const r = 70;
      ctx.lineCap = 'round';
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      if (progress > 0) {
        ctx.strokeStyle = state === 'done' ? '#c9973a' : '#e8c870';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.stroke();
      }
      const dot = state === 'done' ? 26 : state === 'holding' ? 18 : 10;
      ctx.fillStyle = state === 'done' ? '#c9973a' : state === 'holding' ? 'rgba(232,210,130,0.95)' : 'rgba(255,255,255,0.6)';
      if (state === 'holding') { ctx.shadowColor = 'rgba(232,200,100,0.8)'; ctx.shadowBlur = 30; }
      ctx.beginPath();
      ctx.arc(cx, cy, dot, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 16;
      LR.text(ctx, state === 'done' ? '✓ Memory unlocked' : scene.triggerLabel, cx, 240, {
        font: `400 42px ${LR.fonts.display}`, color: state === 'done' ? 'rgba(201,151,58,0.95)' : 'rgba(255,255,255,0.92)'
      });
      if (state !== 'done') {
        LR.text(ctx, state === 'holding' ? 'Hold...' : scene.triggerHint, cx, 300, { font: `italic 400 34px ${LR.fonts.body}`, color: LR.gold(0.85) });
      }
    });
  },

  drawMemory: function (memory) {
    this.ui.memory.components['canvas-panel'].draw((ctx, w, h) => {
      const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
      bg.addColorStop(0, 'rgba(8,6,4,0.9)');
      bg.addColorStop(0.75, 'rgba(8,6,4,0.8)');
      bg.addColorStop(1, 'rgba(8,6,4,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = LR.gold(0.55);
      ctx.fillRect(w / 2 - 36, 80, 72, 2);
      const font = `italic 400 40px ${LR.fonts.display}`;
      ctx.font = font;
      const lines = LR.wrap(ctx, memory.text, w - 200);
      const lineHeight = 62;
      const top = h / 2 - ((lines.length - 1) * lineHeight) / 2 - 40;
      LR.text(ctx, memory.text, w / 2, top, { font, color: 'rgba(238,220,186,0.97)', maxWidth: w - 200, lineHeight });
      LR.text(ctx, memory.soundNote, w / 2, h - 130, { font: `italic 400 34px ${LR.fonts.ui}`, color: LR.gold(0.75) });
      ctx.fillStyle = LR.gold(0.55);
      ctx.fillRect(w / 2 - 36, h - 70, 72, 2);
    });
  },

  drawLetter: function (lines, count) {
    this.ui.letter.components['canvas-panel'].draw((ctx, w, h) => {
      LR.text(ctx, 'A LETTER FOR YOU', w / 2, 40, { font: `400 26px ${LR.fonts.ui}`, color: LR.gold(0.8), spacing: 8 });
      const top = 90;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 40;
      ctx.fillStyle = 'rgba(245,236,215,0.98)';
      ctx.fillRect(24, top, w - 48, h - top - 16);
      ctx.shadowBlur = 0;
      // Empty lines are short pauses, so they take less space
      let y = top + 80;
      lines.forEach((line, i) => {
        const first = i === 0;
        if (line !== '') {
          ctx.fillStyle = 'rgba(160,130,80,0.13)';
          ctx.fillRect(70, y + 30, w - 140, 2);
        }
        if (i < count) {
          LR.text(ctx, line, 76, y, {
            font: first ? `italic 400 48px ${LR.fonts.display}` : `400 38px ${LR.fonts.display}`,
            color: first ? '#3a2a10' : '#4a3820', align: 'left'
          });
        }
        y += first ? 70 : line === '' ? 26 : 58;
      });
    });
  },

  // ---------------------------------------------------------------- utilities

  // A black sphere around your head, used to fade between rooms. It is
  // attached to the real camera so it follows the headset in VR.
  createFader: function () {
    const THREE = AFRAME.THREE;
    this.fader = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#000000', side: THREE.BackSide, transparent: true, opacity: 1, depthTest: false, depthWrite: false })
    );
    this.fader.renderOrder = 10000;
    this.el.sceneEl.camera.add(this.fader);
  },

  fade: function (to, ms) {
    const material = this.fader.material;
    this.fader.visible = true;
    clearTimeout(this.fadeTimer);
    return new Promise((resolve) => {
      const from = material.opacity;
      const start = performance.now();
      // setTimeout instead of requestAnimationFrame, which doesn't run in VR
      const step = () => {
        const t = ms ? Math.min(1, (performance.now() - start) / ms) : 1;
        material.opacity = from + (to - from) * (t * t * (3 - 2 * t));
        if (t < 1) {
          this.fadeTimer = setTimeout(step, 16);
        } else {
          if (to === 0) this.fader.visible = false;
          resolve();
        }
      };
      step();
    });
  },

  emitToRoom: function (eventName) {
    this.root.querySelectorAll('.reactive').forEach((el) => el.emit(eventName, null, false));
  },

  refreshRaycasters: function () {
    document.querySelectorAll('[raycaster]').forEach((el) => {
      const raycaster = el.components.raycaster;
      if (raycaster) raycaster.refreshObjects();
    });
  },

  later: function (fn, ms) {
    this.timers.push(setTimeout(fn, ms));
  },

  clearTimers: function () {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
});
