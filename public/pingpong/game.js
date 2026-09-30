// The heart of SPIN: the ball physics, your paddle (VR controller or mouse),
// haptics, and the visual effects. The match rules and ORBIT the opponent live
// in rules.js and are mixed in below.
//
// Physics runs in small fixed steps (240 per second) so a fast ball can never
// pass through the paddle between two frames.
// Tip: open pingpong.html?tilt=20 to tilt the paddle in your hand by 20 degrees.

(() => {
  const THREE = AFRAME.THREE;
  const T = PP.TABLE;
  const G = 9.81;
  const R = 0.02;             // a 40 mm ball
  const BLADE_R = 0.079;      // paddle blade radius
  const BLADE_HALF = 0.011;   // half the blade thickness, with rubber
  const BLADE_OFFSET = 0.13;  // from your grip to the centre of the blade
  const STEP = 1 / 240;
  const DESK_Z = -0.32;       // on a desktop the paddle moves on this plane
  const UP = new THREE.Vector3(0, 1, 0);
  const Z = new THREE.Vector3(0, 0, 1);

  const core = {
    dependencies: ['pp-arena'],

    init: function () {
      this.root = new THREE.Group();
      this.el.object3D.add(this.root);
      this.arena = this.el.components['pp-arena'];
      this.ui = PPUI(this.root);

      this.state = 'loading';
      this.stateT = 0;
      this.vr = false;
      this.assist = true;
      this.level = null;
      this.score = { player: 0, ai: 0 };
      this.stats = { best: 0, fastest: 0, smashes: 0 };
      this.rally = { hitter: null, opp: 0, hits: 0, timer: 0 };
      try { this.allTimeBest = parseInt(localStorage.getItem('spin-best-rally'), 10) || 0; } catch (e) { this.allTimeBest = 0; }

      this.AI_Z = T.far - 0.32;
      this.servePos = new THREE.Vector3(0.1, T.top + 0.32, T.near - 0.12);
      this.tmp = new THREE.Vector3();
      this.tmpA = new THREE.Vector3();
      this.tmpB = new THREE.Vector3();
      this.tmpQ = new THREE.Quaternion();

      this.buildBall();
      this.buildPaddle();
      this.buildOpponent();
      this.buildEffects();
      this.setupInput();

      const fonts = Promise.race([
        Promise.all([
          document.fonts.load(`800 80px ${PP.fonts.display}`),
          document.fonts.load(`700 40px ${PP.fonts.display}`),
          document.fonts.load(`600 40px ${PP.fonts.ui}`),
          document.fonts.load(`400 40px ${PP.fonts.ui}`),
        ]),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]).catch(() => {});
      fonts.then(() => this.showMenu('main'));

      window.SPIN = this; // handy for testing from the browser console
    },

    // ---------------------------------------------------------------- building
    buildBall: function () {
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(R, 24, 16),
        new THREE.MeshStandardMaterial({ color: '#fff4e6', emissive: '#ff8a3d', emissiveIntensity: 0.25, roughness: 0.35 })
      );
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: PP.dotTexture(), color: 0xffb46b, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.set(0.12, 0.12, 1);
      ball.add(glow);
      this.root.add(ball);

      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.09, 0.09),
        new THREE.MeshBasicMaterial({ map: PP.dotTexture(), color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false })
      );
      shadow.rotation.x = -Math.PI / 2;
      this.root.add(shadow);

      this.ball = {
        mesh: ball, glow, shadow,
        pos: new THREE.Vector3(0, -5, 0), vel: new THREE.Vector3(),
        mode: 'hidden', netCords: 0, dead: false, lastDn: null,
      };
    },

    resetBall: function () {
      const b = this.ball;
      b.vel.set(0, 0, 0);
      b.netCords = 0;
      b.dead = false;
      b.lastDn = null;
      this.trail.length = 0;
    },

    // A paddle: grip at the origin, blade above it along +Y, faces pointing ±Z
    makePaddle: function (front, back) {
      const g = new THREE.Group();
      const disc = (radius, depth, color, z) => {
        const geo = new THREE.CylinderGeometry(radius, radius, depth, 48);
        geo.rotateX(Math.PI / 2);
        const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: color === '#c9a26b' ? 0.6 : 0.85 }));
        m.position.set(0, BLADE_OFFSET, z);
        g.add(m);
      };
      disc(BLADE_R + 0.002, 0.007, '#c9a26b', 0);
      disc(BLADE_R, 0.003, front, 0.005);
      disc(BLADE_R, 0.003, back, -0.005);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.11, 0.024), new THREE.MeshStandardMaterial({ color: '#8a5a33', roughness: 0.55 }));
      handle.position.y = 0.01;
      g.add(handle);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.026), new THREE.MeshStandardMaterial({ color: '#39e4ff', emissive: '#39e4ff', emissiveIntensity: 0.6 }));
      cap.position.y = -0.045;
      g.add(cap);
      return g;
    },

    buildPaddle: function () {
      this.paddle = this.makePaddle('#d7263d', '#15161a');
      this.root.add(this.paddle);
      this.pad = {
        blade: new THREE.Vector3(0, 1.1, DESK_Z), prevBlade: new THREE.Vector3(0, 1.1, DESK_Z),
        quat: new THREE.Quaternion(), prevQuat: new THREE.Quaternion(),
        vel: new THREE.Vector3(), cooldown: 0, fresh: true,
        c: new THREE.Vector3(), q: new THREE.Quaternion(), n: new THREE.Vector3(),
        d: new THREE.Vector3(), rel: new THREE.Vector3(), raw: new THREE.Vector3(),
      };
      // How the paddle sits in your hand: the handle runs through your fist
      // (the controller's -Z axis) and the rubber faces point sideways (±X).
      const tilt = parseFloat(new URLSearchParams(location.search).get('tilt')) || 0;
      this.gripOffset = new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(-90 + tilt), Math.PI / 2, 0, 'XYZ'));
      this.hand = 'right';

      // A small glowing orb shows your other hand in VR
      this.offHand = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), new THREE.MeshBasicMaterial({ color: '#39e4ff', transparent: true, opacity: 0.7 }));
      this.offHand.visible = false;
      this.root.add(this.offHand);
    },

    // ORBIT: a floating robot with a glowing visor, and its paddle
    buildOpponent: function () {
      const o = new THREE.Group();
      const shell = new THREE.MeshStandardMaterial({ color: '#dfe6f2', roughness: 0.25, metalness: 0.4 });
      const darkM = new THREE.MeshStandardMaterial({ color: '#12151d', roughness: 0.3, metalness: 0.6 });
      const glowM = new THREE.MeshBasicMaterial({ color: '#39e4ff' });

      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.32, 6, 20), shell);
      torso.position.y = 1.15;
      const core = new THREE.Mesh(new THREE.CircleGeometry(0.055, 24), glowM);
      core.position.set(0, 1.2, 0.2);
      const head = new THREE.Group();
      head.position.y = 1.62;
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.16, 28, 20), darkM);
      const visor = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.022, 10, 40, Math.PI * 0.7), glowM);
      visor.rotation.set(0, 0, Math.PI * 0.15);
      visor.position.z = 0.02;
      visor.rotation.x = 0;
      const visorWrap = new THREE.Group();
      visorWrap.rotation.set(-Math.PI / 2, 0, Math.PI);
      visorWrap.add(visor);
      head.add(skull, visorWrap);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 10, 40), glowM);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.68;
      [-1, 1].forEach((s) => {
        const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), darkM);
        shoulder.position.set(s * 0.26, 1.36, 0);
        o.add(shoulder);
      });
      o.add(torso, core, head, ring);
      o.position.set(0, 0, this.AI_Z - 0.55);
      o.visible = false;
      o.userData = { head, visor: { material: glowM }, ring, celebrate: 0 };
      this.opponent = o;
      this.root.add(o);

      this.aiPaddle = this.makePaddle('#15161a', '#d7263d');
      this.root.add(this.aiPaddle);
      this.ai = {
        blade: new THREE.Vector3(0, T.top + 0.38, this.AI_Z), idle: new THREE.Vector3(), delta: new THREE.Vector3(),
        swing: 1, plan: null, serveX: 0,
      };
    },

    buildEffects: function () {
      // A short glowing trail behind the ball
      this.trail = [];
      this.trailMesh = new THREE.InstancedMesh(
        new THREE.SphereGeometry(R, 10, 8),
        new THREE.MeshBasicMaterial({ color: '#ffae5c', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
        18
      );
      this.trailMesh.count = 0;
      this.trailMesh.frustumCulled = false;
      this.root.add(this.trailMesh);
      this.dummy = new THREE.Object3D();

      // Sparks when the ball is hit
      const n = 80;
      this.sparkData = Array.from({ length: n }, () => ({ v: new THREE.Vector3(), life: 0 }));
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3).fill(-10), 3));
      this.sparkPoints = new THREE.Points(geo, new THREE.PointsMaterial({ map: PP.dotTexture(), size: 0.025, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.sparkPoints.frustumCulled = false;
      this.root.add(this.sparkPoints);
      this.sparkNext = 0;

      // Ripples on the table where the ball lands
      this.ripples = [0, 1, 2].map(() => {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.04, 32), new THREE.MeshBasicMaterial({ color: '#9ff3ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
        m.rotation.x = -Math.PI / 2;
        this.root.add(m);
        return { mesh: m, life: 1 };
      });
      this.rippleNext = 0;
    },

    sparks: function (pos, color, count) {
      this.sparkPoints.material.color.set(color);
      for (let i = 0; i < count; i++) {
        const s = this.sparkData[this.sparkNext];
        this.sparkNext = (this.sparkNext + 1) % this.sparkData.length;
        s.life = 0.3 + Math.random() * 0.25;
        s.v.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(0.6 + Math.random() * 1.6);
        s.p = s.p || new THREE.Vector3();
        s.p.copy(pos);
      }
    },

    ripple: function (pos) {
      const r = this.ripples[this.rippleNext];
      this.rippleNext = (this.rippleNext + 1) % this.ripples.length;
      r.mesh.position.set(pos.x, T.top + 0.002, pos.z);
      r.life = 0;
    },

    // ---------------------------------------------------------------- input
    setupInput: function () {
      this.pointer = new THREE.Vector2(0, -0.1);
      this.raycaster = new THREE.Raycaster();
      this.deskPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -DESK_Z);
      this.deskTarget = new THREE.Vector3(0, 1.05, DESK_Z);
      this.swingT = -1;
      this.hoverButton = null;

      const toNdc = (e) => {
        const canvas = this.el.canvas;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      };
      window.addEventListener('pointermove', (e) => {
        toNdc(e);
        if (this.vr) return;
        this.raycaster.setFromCamera(this.pointer, this.el.camera);
        const b = this.ui.buttonAtRay(this.raycaster);
        this.ui.setHover(b);
        document.body.style.cursor = b ? 'pointer' : '';
      });
      window.addEventListener('pointerdown', (e) => {
        PPAudio.start();
        if (this.vr || (e.target.closest && e.target.closest('.a-enter-vr, .hud'))) return;
        toNdc(e);
        this.raycaster.setFromCamera(this.pointer, this.el.camera);
        const b = this.ui.buttonAtRay(this.raycaster);
        if (b) this.press(b);
        else this.swing();
      });
      window.addEventListener('keydown', (e) => {
        PPAudio.start();
        if (e.code === 'Space') { e.preventDefault(); this.swing(); }
        if (e.code === 'KeyM') this.toggleMusic();
        if (e.code === 'Escape' && this.state !== 'menu') this.showMenu('main');
      });

      this.el.addEventListener('enter-vr', () => {
        PPAudio.start();
        this.vr = true;
        document.body.classList.add('in-vr');
        this.offHand.visible = true;
        if (this.state === 'menu' || this.state === 'over') this.showMenu(this.state === 'over' ? 'over' : 'main');
      });
      this.el.addEventListener('exit-vr', () => {
        this.vr = false;
        document.body.classList.remove('in-vr');
        this.offHand.visible = false;
        this.pad.fresh = true;
      });
    },

    press: function (button) {
      PPAudio.start();
      PPAudio.click();
      this.pulse(0.4, 40);
      button.onPress();
    },

    swing: function () {
      if (!this.vr && this.swingT < 0) this.swingT = 0;
    },

    pulse: function (intensity, ms) {
      const src = this.handSource;
      const act = src && src.gamepad && src.gamepad.hapticActuators && src.gamepad.hapticActuators[0];
      try {
        if (act && act.pulse) act.pulse(intensity, ms);
        else if (act && act.playEffect) act.playEffect('dual-rumble', { duration: ms, strongMagnitude: intensity, weakMagnitude: intensity });
      } catch (e) { /* no haptics on this device */ }
    },

    // Where is the paddle this frame? Sets pad.blade (blade centre) and pad.quat.
    readPaddle: function (dt) {
      const pad = this.pad;
      pad.prevBlade.copy(pad.blade);
      pad.prevQuat.copy(pad.quat);

      if (this.vr) this.readController();
      else this.readMouse(dt);

      pad.quat.copy(this.paddle.quaternion);
      pad.blade.set(0, BLADE_OFFSET, 0).applyQuaternion(pad.quat).add(this.paddle.position);
      if (pad.fresh) {
        pad.prevBlade.copy(pad.blade);
        pad.prevQuat.copy(pad.quat);
        pad.fresh = false;
      }
      pad.raw.subVectors(pad.blade, pad.prevBlade).divideScalar(Math.max(dt, 1 / 144));
      pad.vel.lerp(pad.raw, 0.7);
      pad.cooldown -= dt;
    },

    // In VR we read the controllers straight from the WebXR frame
    readController: function () {
      const scene = this.el;
      const frame = scene.frame;
      const session = scene.renderer.xr.getSession && scene.renderer.xr.getSession();
      const ref = scene.renderer.xr.getReferenceSpace();
      if (!frame || !session || !ref) return;
      const hands = {};
      for (const src of session.inputSources) {
        if (!src.gripSpace) continue;
        let pose = null;
        try { pose = frame.getPose(src.gripSpace, ref); } catch (e) { pose = null; }
        if (pose) hands[src.handedness] = { src, pose };
        // Pull the trigger on the other hand to switch the paddle over
        const trigger = src.gamepad && src.gamepad.buttons[0] && src.gamepad.buttons[0].pressed;
        const key = `trig-${src.handedness}`;
        if (trigger && !this[key] && src.handedness !== this.hand && (src.handedness === 'left' || src.handedness === 'right')) {
          this.hand = src.handedness;
          this.pad.fresh = true;
          PPAudio.click();
        }
        this[key] = trigger;
      }
      const main = hands[this.hand] || hands.right || hands.left;
      if (!main) return;
      this.handSource = main.src;
      const p = main.pose.transform.position;
      const o = main.pose.transform.orientation;
      this.paddle.position.set(p.x, p.y, p.z);
      this.paddle.quaternion.set(o.x, o.y, o.z, o.w).multiply(this.gripOffset);

      const off = hands[this.hand === 'right' ? 'left' : 'right'];
      this.offHand.visible = !!off;
      if (off) this.offHand.position.set(off.pose.transform.position.x, off.pose.transform.position.y, off.pose.transform.position.z);
    },

    // On a desktop the mouse moves the paddle across a plane; click (or the
    // ball arriving near the paddle) makes it swing forward.
    readMouse: function (dt) {
      this.raycaster.setFromCamera(this.pointer, this.el.camera);
      if (this.raycaster.ray.intersectPlane(this.deskPlane, this.tmp)) {
        this.tmp.x = Math.max(-0.95, Math.min(0.95, this.tmp.x));
        this.tmp.y = Math.max(T.top + 0.06, Math.min(1.65, this.tmp.y));
        this.deskTarget.lerp(this.tmp, 1 - Math.exp(-dt * 30));
      }
      const b = this.ball;
      const pad = this.pad;
      // Auto-swing when the ball comes to the paddle
      if (this.swingT < 0 && b.mode === 'live' && b.vel.z > 0 && b.pos.z > DESK_Z - 0.5 && b.pos.z < DESK_Z &&
          Math.hypot(b.pos.x - pad.blade.x, b.pos.y - pad.blade.y) < 0.24) this.swingT = 0;

      let z = DESK_Z + 0.07, pitch = 0;
      if (this.swingT >= 0) {
        this.swingT += dt;
        const s = this.swingT;
        if (s < 0.1) { const k = s / 0.1; z -= 0.38 * (1 - (1 - k) * (1 - k)); pitch = -0.5 * k; }
        else if (s < 0.34) { const k = (s - 0.1) / 0.24; z -= 0.38 * (1 - k); pitch = -0.5 * (1 - k); }
        else this.swingT = -1;
      }
      const lean = Math.max(-0.5, Math.min(0.5, -this.deskTarget.x * 0.45));
      this.paddle.quaternion.setFromEuler(new THREE.Euler(-0.12 + pitch, 0, lean, 'XYZ'));
      this.tmp.set(0, BLADE_OFFSET, 0).applyQuaternion(this.paddle.quaternion);
      this.paddle.position.set(this.deskTarget.x, this.deskTarget.y, z).sub(this.tmp);
    },

    // In VR you press menu buttons by tapping them with the paddle
    pokeButtons: function (dt) {
      if (!this.vr) return;
      const b = this.ui.buttonAtPoint(this.pad.blade);
      this.ui.setHover(b);
      this.pokeCool = (this.pokeCool || 0) - dt;
      if (b && this.pokeCool <= 0 && !this.pokeLatch) {
        this.pokeLatch = true;
        this.pokeCool = 0.5;
        this.press(b);
      }
      if (!b) this.pokeLatch = false;
    },

    // ---------------------------------------------------------------- physics
    stepBall: function (h, alpha) {
      const b = this.ball;
      if (b.mode === 'hover') { this.collidePaddle(alpha); return; }
      if (b.mode !== 'live') return;

      const prevZ = b.pos.z;
      b.vel.y -= G * h;
      b.vel.multiplyScalar(1 - 0.03 * h); // a little air drag
      b.pos.addScaledVector(b.vel, h);

      // The table top
      if (b.vel.y < 0 && b.pos.y < T.top + R && b.pos.y > T.top - 0.05 &&
          Math.abs(b.pos.x) <= T.width / 2 + 0.005 && b.pos.z <= T.near && b.pos.z >= T.far) {
        const impact = -b.vel.y;
        b.pos.y = T.top + R;
        b.vel.y = impact * 0.88;
        b.vel.x *= 0.97;
        b.vel.z *= 0.97;
        PPAudio.table(b.pos, impact / 5);
        this.ripple(b.pos);
        this.onBounce(b.pos.z > T.cz ? 'player' : 'ai');
      }

      // The net
      if ((prevZ - T.cz) * (b.pos.z - T.cz) < 0 && Math.abs(b.pos.x) < T.netHalf + R &&
          b.pos.y < T.top + T.netH + R && b.pos.y > T.top) {
        const side = Math.sign(prevZ - T.cz);
        PPAudio.net(b.pos);
        if (b.pos.y > T.top + T.netH - R * 0.3 && b.netCords < 1) {
          // Clipped the top of the net: it trickles over
          b.netCords++;
          b.vel.z *= 0.35;
          b.vel.x *= 0.6;
          b.vel.y = Math.abs(b.vel.y) * 0.3 + 0.7;
          if (this.state === 'rally') this.ui.popup('NET CORD', PP.colors.gold, this.tmp.set(b.pos.x, b.pos.y + 0.25, b.pos.z));
        } else {
          b.pos.z = T.cz + side * (R + 0.002);
          b.vel.z = -b.vel.z * 0.12;
          b.vel.x *= 0.4;
          b.vel.y *= 0.4;
        }
      }

      // The floor
      if (b.pos.y < R) {
        b.pos.y = R;
        b.vel.y = Math.abs(b.vel.y) * 0.55;
        b.vel.x *= 0.85;
        b.vel.z *= 0.85;
        if (!b.dead) {
          b.dead = true;
          PPAudio.floor(b.pos);
          this.onBallDead();
        }
      }

      this.collidePaddle(alpha);
    },

    // Does the ball touch your paddle? The paddle's pose is blended between
    // last frame and this frame so its movement is smooth inside the frame.
    collidePaddle: function (alpha) {
      const b = this.ball;
      const pad = this.pad;
      const playable = this.state === 'rally' || this.state === 'serve-player';
      if (!playable || pad.cooldown > 0) { b.lastDn = null; return; }
      if (this.state === 'rally' && this.rally.hitter === 'player' && this.rally.opp === 0 && this.rally.hits > 0) return;

      pad.c.lerpVectors(pad.prevBlade, pad.blade, alpha);
      pad.q.slerpQuaternions(pad.prevQuat, pad.quat, alpha);
      pad.n.copy(Z).applyQuaternion(pad.q);
      pad.d.subVectors(b.pos, pad.c);
      const dn = pad.d.dot(pad.n);
      const lastDn = b.lastDn;
      b.lastDn = dn;
      const inPlane = this.tmpA.copy(pad.d).addScaledVector(pad.n, -dn);
      if (inPlane.length() > BLADE_R + R * 0.6) return;

      const touching = Math.abs(dn) < R + BLADE_HALF;
      const crossed = lastDn !== null && Math.sign(dn) !== Math.sign(lastDn) && Math.abs(lastDn) < 0.12;
      if (!touching && !crossed) return;
      const side = crossed ? Math.sign(lastDn) || 1 : Math.sign(dn) || 1;
      pad.rel.subVectors(b.vel, pad.vel);
      const vn = pad.rel.dot(pad.n);
      if (vn * side >= 0 && !crossed) return; // already moving apart

      // Bounce off the rubber: the normal part reflects, the sideways part is gripped a little
      const outN = Math.max(Math.abs(vn) * 0.82, 0.6) * side;
      pad.rel.addScaledVector(pad.n, -vn).multiplyScalar(0.7).addScaledVector(pad.n, outN);
      b.vel.copy(pad.rel).add(pad.vel);
      b.pos.copy(pad.c).add(inPlane).addScaledVector(pad.n, side * (R + BLADE_HALF + 0.002));
      b.lastDn = null;
      this.onPlayerHit();
    },

    onPlayerHit: function () {
      const b = this.ball;
      const pad = this.pad;
      pad.cooldown = 0.2;
      if (this.state === 'serve-player') {
        this.setState('rally');
        this.ui.hint('');
      }
      b.mode = 'live';
      b.netCords = 0;
      this.applyAssist();
      if (b.vel.length() > 30) b.vel.setLength(30);

      const r = this.rally;
      r.hitter = 'player';
      r.opp = 0;
      r.hits++;
      r.timer = 0;
      this.ai.plan = null;

      const swing = pad.vel.length();
      const kmh = Math.round(b.vel.length() * 3.6);
      const smash = kmh > 45 || (swing > 5 && kmh > 32);
      this.lastSpeed = kmh;
      this.stats.fastest = Math.max(this.stats.fastest, kmh);
      PPAudio.paddle(b.pos, Math.min(1, b.vel.length() / 14));
      this.pulse(Math.min(1, 0.45 + swing / 6), smash ? 60 : 30);
      this.sparks(b.pos, smash ? 0xffc94d : 0x9ff3ff, smash ? 40 : 16);
      const above = this.tmp.set(b.pos.x, b.pos.y + 0.22, b.pos.z - 0.1);
      if (smash) {
        this.stats.smashes++;
        PPAudio.whoosh(b.pos);
        PPAudio.ooh();
        this.arena.cheer(0.35);
        this.ui.popup(`SMASH  ${kmh} km/h`, PP.colors.gold, above);
      } else {
        this.ui.popup(`${kmh} km/h`, PP.colors.accent, above);
      }
      PPAudio.tension(r.hits / 16);
      this.drawScore();
    },

    // ---------------------------------------------------------------- every frame
    tick: function (time, delta) {
      if (this.state === 'loading') return;
      const dt = Math.min(delta, 50) / 1000;
      const b = this.ball;

      this.updateListener();
      this.readPaddle(dt);
      this.pokeButtons(dt);

      if (b.mode === 'hover') {
        b.pos.copy(this.servePos);
        b.pos.y += Math.sin(time / 400) * 0.015;
      }
      const steps = Math.max(1, Math.ceil(dt / STEP));
      for (let i = 0; i < steps; i++) this.stepBall(dt / steps, (i + 1) / steps);

      this.updateAI(dt);
      this.updateFlow(dt);
      this.render(dt, time / 1000);
    },

    updateListener: function () {
      const cam = this.el.camera;
      if (!cam) return;
      cam.getWorldPosition(this.tmpA);
      cam.getWorldDirection(this.tmpB);
      this.camPos = this.camPos || new THREE.Vector3();
      this.camPos.copy(this.tmpA);
      PPAudio.setListener(this.tmpA, this.tmpB, UP);
    },

    render: function (dt, t) {
      const b = this.ball;
      const showBall = b.mode !== 'hidden';
      b.mesh.visible = showBall;
      b.shadow.visible = showBall;
      b.mesh.position.copy(b.pos);
      b.glow.material.opacity = b.mode === 'hover' ? 0.55 + Math.sin(t * 5) * 0.25 : 0.35;

      // The shadow sits on the table or the floor, softer the higher the ball is
      const overTable = Math.abs(b.pos.x) < T.width / 2 && b.pos.z < T.near && b.pos.z > T.far && b.pos.y > T.top;
      const ground = overTable ? T.top + 0.002 : 0.01;
      const height = Math.max(0, b.pos.y - ground);
      b.shadow.position.set(b.pos.x, ground, b.pos.z);
      b.shadow.scale.setScalar(1 + height * 1.6);
      b.shadow.material.opacity = 0.6 / (1 + height * 3);

      // Trail
      if (b.mode === 'live' && b.vel.lengthSq() > 4) {
        this.trail.unshift(b.pos.clone());
        if (this.trail.length > 18) this.trail.pop();
      } else if (this.trail.length) this.trail.pop();
      this.trail.forEach((p, i) => {
        this.dummy.position.copy(p);
        this.dummy.scale.setScalar(1 - i / 18);
        this.dummy.updateMatrix();
        this.trailMesh.setMatrixAt(i, this.dummy.matrix);
      });
      this.trailMesh.count = this.trail.length;
      this.trailMesh.instanceMatrix.needsUpdate = true;

      // Sparks
      const arr = this.sparkPoints.geometry.attributes.position.array;
      this.sparkData.forEach((s, i) => {
        if (s.life > 0) {
          s.life -= dt;
          s.v.y -= 4 * dt;
          s.p.addScaledVector(s.v, dt);
          arr[i * 3] = s.p.x; arr[i * 3 + 1] = s.p.y; arr[i * 3 + 2] = s.p.z;
        } else arr[i * 3 + 1] = -10;
      });
      this.sparkPoints.geometry.attributes.position.needsUpdate = true;

      this.ripples.forEach((r) => {
        if (r.life >= 1) return;
        r.life = Math.min(1, r.life + dt / 0.4);
        r.mesh.scale.setScalar(1 + r.life * 3.5);
        r.mesh.material.opacity = 0.8 * (1 - r.life);
      });

      // On a desktop the paddle is see-through so it never hides the ball,
      // and it steps aside while the menu is open so you can read the buttons
      const see = this.vr ? 1 : 0.6;
      if (this.paddleSee !== see) {
        this.paddleSee = see;
        this.paddle.traverse((m) => { if (m.material) { m.material.transparent = see < 1; m.material.opacity = see; } });
      }
      this.paddle.visible = this.vr || (this.state !== 'menu' && this.state !== 'over');

      // ORBIT and its paddle
      const ai = this.ai;
      const o = this.opponent;
      const swing = Math.sin(Math.min(1, ai.swing) * Math.PI);
      this.aiPaddle.visible = o.visible;
      this.aiPaddle.quaternion.setFromEuler(new THREE.Euler(0.25 + swing * 0.7, 0, -ai.blade.x * 0.4));
      this.tmp.set(0, BLADE_OFFSET, 0).applyQuaternion(this.aiPaddle.quaternion);
      this.aiPaddle.position.copy(ai.blade).sub(this.tmp);
      this.aiPaddle.position.z += swing * 0.12;
      o.position.x += (ai.blade.x - 0.3 - o.position.x) * Math.min(1, dt * 4);
      const cheer = this.state === 'over' && this.score.ai > this.score.player;
      o.position.y = Math.sin(t * 2.2) * 0.03 + (cheer ? Math.abs(Math.sin(t * 7)) * 0.15 : 0);
      o.rotation.z = (ai.blade.x - 0.3 - o.position.x) * -0.3;
      o.userData.head.lookAt(b.mode === 'hidden' ? this.camPos || this.tmp.set(0, 1.5, 0) : b.pos);
      o.userData.ring.scale.setScalar(1 + Math.sin(t * 4) * 0.06);

      this.ui.tick(dt, this.camPos);
    },
  };

  AFRAME.registerComponent('ping-pong', Object.assign(core, window.PPRules));
})();
