// The arena for SPIN: a regulation table, the net, the court, the stands with
// an animated crowd, a lighting rig with light beams and scrolling LED boards.
// Everything is built in code from simple shapes: no 3D models or images.

const PP = window.PP = {
  // A regulation table: 2.74 m long, 1.525 m wide, the top 76 cm above the floor.
  // You stand at z = 0, the table stretches away from you along -z.
  TABLE: { top: 0.76, length: 2.74, width: 1.525, cz: -1.75, netH: 0.1525, netHalf: 0.915 },
  fonts: { ui: '"Inter", system-ui, sans-serif', display: '"Oxanium", "Inter", sans-serif' },
  colors: { accent: '#39e4ff', hot: '#ff4f7b', gold: '#ffc94d', ink: '#e9f1ff', dim: '#8ea0bf' },
};
PP.TABLE.near = PP.TABLE.cz + PP.TABLE.length / 2;
PP.TABLE.far = PP.TABLE.cz - PP.TABLE.length / 2;

// A flat panel with a <canvas> as its picture, used for every sign and screen.
PP.panel = function (width, height, pxPerMetre) {
  const THREE = AFRAME.THREE;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * (pxPerMetre || 800));
  canvas.height = Math.round(height * (pxPerMetre || 800));
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, fog: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  return { mesh, canvas, ctx, texture, W: canvas.width, H: canvas.height, update: () => { texture.needsUpdate = true; } };
};

PP.roundRect = function (ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

// A soft round dot, used for glows, flashes and dust
PP.dotTexture = function () {
  const THREE = AFRAME.THREE;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
};

AFRAME.registerComponent('pp-arena', {
  init: function () {
    const THREE = AFRAME.THREE;
    this.THREE = THREE;
    this.root = new THREE.Group();
    this.el.object3D.add(this.root);
    this.cheerLevel = 0;
    this.time = 0;

    this.buildLights();
    this.buildCourt();
    this.buildTable();
    this.buildBoards();
    this.buildStands();
    this.buildRig();
    this.buildDust();
  },

  mat: function (color, roughness, metalness, extra) {
    return new this.THREE.MeshStandardMaterial(Object.assign({ color, roughness: roughness ?? 0.7, metalness: metalness ?? 0 }, extra || {}));
  },

  box: function (w, h, d, material, x, y, z, parent) {
    const m = new this.THREE.Mesh(new this.THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    (parent || this.root).add(m);
    return m;
  },

  // ---------------------------------------------------------------- lights
  buildLights: function () {
    const THREE = this.THREE;
    const T = PP.TABLE;
    this.root.add(new THREE.HemisphereLight(0x9fb4ff, 0x2a1418, 1.1));
    const key = new THREE.DirectionalLight(0xfff4e6, 2.6);
    key.position.set(0.8, 8, T.cz + 1.5);
    key.target.position.set(0, 0, T.cz);
    this.root.add(key, key.target);
    const rim = new THREE.DirectionalLight(0x6fb8ff, 0.9);
    rim.position.set(-4, 3, T.cz - 6);
    this.root.add(rim);
  },

  // ---------------------------------------------------------------- floor & court
  buildCourt: function () {
    const THREE = this.THREE;
    const T = PP.TABLE;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), this.mat('#07080c', 0.9, 0.1));
    floor.rotation.x = -Math.PI / 2;
    this.root.add(floor);

    // The playing surface, a red sports floor with a thin border line
    const court = new THREE.Mesh(new THREE.PlaneGeometry(7, 12), this.mat('#6b1b29', 0.55, 0.05));
    court.rotation.x = -Math.PI / 2;
    court.position.set(0, 0.004, T.cz);
    this.root.add(court);
    const line = this.mat('#e9eef7', 0.6);
    [[-3.45, 0.06, 12], [3.45, 0.06, 12]].forEach(([x, w, d]) => this.box(w, 0.002, d, line, x, 0.006, T.cz));
    [[-5.95], [5.95]].forEach(([dz]) => this.box(6.96, 0.002, 0.06, line, 0, 0.006, T.cz + dz));
  },

  // ---------------------------------------------------------------- table
  buildTable: function () {
    const THREE = this.THREE;
    const T = PP.TABLE;
    const g = new THREE.Group();
    g.position.set(0, 0, T.cz);
    this.root.add(g);

    const top = this.mat('#1c4d94', 0.42, 0.05);
    const white = this.mat('#f4f7fb', 0.5);
    const dark = this.mat('#15181f', 0.6, 0.4);

    this.box(T.width, 0.03, T.length, top, 0, T.top - 0.015, 0, g);
    this.box(T.width + 0.01, 0.02, T.length + 0.01, dark, 0, T.top - 0.04, 0, g); // apron
    // The white lines: 2 cm edges and a 3 mm centre line
    const y = T.top + 0.0008;
    this.box(0.02, 0.001, T.length, white, -T.width / 2 + 0.01, y, 0, g);
    this.box(0.02, 0.001, T.length, white, T.width / 2 - 0.01, y, 0, g);
    this.box(T.width, 0.001, 0.02, white, 0, y, T.length / 2 - 0.01, g);
    this.box(T.width, 0.001, 0.02, white, 0, y, -T.length / 2 + 0.01, g);
    this.box(0.003, 0.001, T.length, white, 0, y, 0, g);

    // Legs and under-frame
    [[-0.62, -1.1], [0.62, -1.1], [-0.62, 1.1], [0.62, 1.1]].forEach(([x, z]) => {
      this.box(0.05, T.top - 0.05, 0.05, dark, x, (T.top - 0.05) / 2, z, g);
      this.box(0.14, 0.03, 0.14, dark, x, 0.015, z, g);
    });
    this.box(1.3, 0.04, 0.04, dark, 0, 0.35, -1.1, g);
    this.box(1.3, 0.04, 0.04, dark, 0, 0.35, 1.1, g);
    this.box(0.04, 0.04, 2.2, dark, 0, 0.35, 0, g);

    // The net: a see-through mesh texture with a white tape on top
    const c = document.createElement('canvas');
    c.width = 512; c.height = 48;
    const n = c.getContext('2d');
    n.strokeStyle = 'rgba(20,24,32,0.95)';
    n.lineWidth = 2;
    for (let x = 0; x <= 512; x += 8) { n.beginPath(); n.moveTo(x, 0); n.lineTo(x, 48); n.stroke(); }
    for (let yy = 0; yy <= 48; yy += 8) { n.beginPath(); n.moveTo(0, yy); n.lineTo(512, yy); n.stroke(); }
    const netTex = new THREE.CanvasTexture(c);
    const net = new THREE.Mesh(
      new THREE.PlaneGeometry(T.netHalf * 2, T.netH),
      new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false })
    );
    net.position.set(0, T.top + T.netH / 2, 0);
    g.add(net);
    this.box(T.netHalf * 2, 0.015, 0.006, white, 0, T.top + T.netH - 0.007, 0, g);
    [-1, 1].forEach((s) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, T.netH + 0.02, 10), dark);
      post.position.set(s * T.netHalf, T.top + T.netH / 2, 0);
      g.add(post);
      this.box(0.05, 0.03, 0.08, dark, s * (T.netHalf - 0.08), T.top + 0.015, 0, g);
    });

    // A soft dark shadow under the table so it sits on the floor
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(T.width + 0.9, T.length + 0.9),
      new THREE.MeshBasicMaterial({ map: PP.dotTexture(), color: 0x000000, transparent: true, opacity: 0.75, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.008;
    g.add(shadow);
  },

  // ---------------------------------------------------------------- LED boards
  buildBoards: function () {
    const THREE = this.THREE;
    const T = PP.TABLE;
    const c = document.createElement('canvas');
    c.width = 2048; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#05060a';
    g.fillRect(0, 0, 2048, 128);
    const words = ['SPIN', 'VR TABLE TENNIS', 'HSLU · WEBXR', 'BUILT WITH A-FRAME', 'PLAY IN YOUR BROWSER'];
    let x = 30;
    g.textBaseline = 'middle';
    g.font = `700 64px ${PP.fonts.display}`;
    words.forEach((w, i) => {
      g.fillStyle = i % 2 ? PP.colors.hot : PP.colors.accent;
      g.shadowColor = g.fillStyle;
      g.shadowBlur = 18;
      g.fillText(w, x, 68);
      x += g.measureText(w).width + 60;
      g.fillStyle = '#ffffff';
      g.fillText('•', x - 42, 66);
    });
    this.boardTexture = new THREE.CanvasTexture(c);
    this.boardTexture.colorSpace = THREE.SRGBColorSpace;
    this.boardTexture.wrapS = THREE.RepeatWrapping;
    this.boardCanvas = c;

    const face = new THREE.MeshBasicMaterial({ map: this.boardTexture });
    const back = this.mat('#101219', 0.6, 0.3);
    const h = 0.72;
    const make = (len, x, z, rotY) => {
      const grp = new THREE.Group();
      grp.position.set(x, 0, z);
      grp.rotation.y = rotY;
      this.box(len, h, 0.08, back, 0, h / 2, 0, grp);
      const tex = this.boardTexture.clone();
      tex.needsUpdate = true;
      tex.repeat.x = len / 11.5;
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.04, h - 0.1), face.clone());
      scr.material.map = tex;
      scr.position.set(0, h / 2, 0.045);
      grp.add(scr);
      this.root.add(grp);
      this.boards.push(tex);
    };
    this.boards = [];
    make(7, 0, T.cz - 6, 0);            // far end, facing you
    make(12, -3.5, T.cz, Math.PI / 2);  // left side
    make(12, 3.5, T.cz, -Math.PI / 2);  // right side
    make(7, 0, T.cz + 6, Math.PI);      // behind you
  },

  // ---------------------------------------------------------------- stands & crowd
  buildStands: function () {
    const THREE = this.THREE;
    const T = PP.TABLE;
    const step = this.mat('#161923', 0.8, 0.1);
    const seats = [];
    // Four stands around the court. Each row is a step: 0.9 m back, 0.45 m up.
    const sides = [
      { cx: 0, cz: T.cz - 7.4, len: 11, dir: [0, -1], rot: 0, rows: 7 },
      { cx: -5.2, cz: T.cz, len: 13, dir: [-1, 0], rot: Math.PI / 2, rows: 7 },
      { cx: 5.2, cz: T.cz, len: 13, dir: [1, 0], rot: -Math.PI / 2, rows: 7 },
      { cx: 0, cz: T.cz + 7.4, len: 11, dir: [0, 1], rot: Math.PI, rows: 5 },
    ];
    sides.forEach((s) => {
      for (let r = 0; r < s.rows; r++) {
        const off = r * 0.9;
        const x = s.cx + s.dir[0] * off;
        const z = s.cz + s.dir[1] * off;
        const y = 0.3 + r * 0.45;
        const along = s.dir[0] === 0;
        this.box(along ? s.len : 0.9, y, along ? 0.9 : s.len, step, x, y / 2, z);
        const count = Math.floor(s.len / 0.62);
        for (let i = 0; i < count; i++) {
          if (Math.random() < 0.12) continue; // a few empty seats look more natural
          const t = -s.len / 2 + 0.31 + i * 0.62 + (Math.random() - 0.5) * 0.12;
          seats.push({
            x: along ? x + t : x, y, z: along ? z : z + t, rot: s.rot,
            phase: Math.random() * Math.PI * 2, jump: 0.12 + Math.random() * 0.25, speed: 9 + Math.random() * 6,
          });
        }
      }
    });
    this.seats = seats;

    const bodyGeo = new THREE.CapsuleGeometry(0.19, 0.34, 3, 8);
    const headGeo = new THREE.SphereGeometry(0.12, 10, 8);
    this.bodies = new THREE.InstancedMesh(bodyGeo, this.mat('#ffffff', 0.85), seats.length);
    this.heads = new THREE.InstancedMesh(headGeo, this.mat('#ffffff', 0.7), seats.length);
    const shirts = ['#23324f', '#2e2e38', '#3a1f2b', '#1f3b3a', '#39e4ff', '#ff4f7b', '#e8e8ee', '#2a2f45', '#ffc94d', '#1b2233'];
    const skins = ['#f1c7a5', '#d9a07a', '#a86b49', '#6e4630', '#e6b894', '#8a5a3c'];
    const col = new THREE.Color();
    seats.forEach((s, i) => {
      this.heads.setColorAt(i, col.set(skins[i % skins.length]));
      this.bodies.setColorAt(i, col.set(shirts[Math.floor(Math.random() * shirts.length)]));
    });
    this.dummy = new THREE.Object3D();
    this.placeCrowd(0);
    this.root.add(this.bodies, this.heads);

    // Camera flashes from the stands when someone scores
    const dot = PP.dotTexture();
    this.flashes = [];
    for (let i = 0; i < 26; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, opacity: 0, depthWrite: false, fog: false }));
      sp.scale.set(0.9, 0.9, 1);
      this.root.add(sp);
      this.flashes.push({ sprite: sp, life: 0 });
    }
  },

  placeCrowd: function (time) {
    const d = this.dummy;
    const k = this.cheerLevel;
    this.seats.forEach((s, i) => {
      const hop = k > 0.01 ? Math.abs(Math.sin(time * s.speed + s.phase)) * s.jump * k : 0;
      const sway = Math.sin(time * 0.8 + s.phase) * 0.02;
      d.position.set(s.x + sway, s.y + 0.45 + hop, s.z);
      d.rotation.set(0, s.rot, 0);
      d.updateMatrix();
      this.bodies.setMatrixAt(i, d.matrix);
      d.position.y += 0.43;
      d.updateMatrix();
      this.heads.setMatrixAt(i, d.matrix);
    });
    this.bodies.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
  },

  // Called by the game: amount 0..1
  cheer: function (amount) {
    this.cheerLevel = Math.max(this.cheerLevel, amount);
    const n = Math.floor(6 + amount * 14);
    for (let i = 0; i < n; i++) {
      const f = this.flashes[Math.floor(Math.random() * this.flashes.length)];
      const s = this.seats[Math.floor(Math.random() * this.seats.length)];
      f.sprite.position.set(s.x, s.y + 1.1, s.z);
      f.life = -Math.random() * 1.2; // start at a random moment in the next second
    }
  },

  // ---------------------------------------------------------------- lighting rig
  buildRig: function () {
    const THREE = this.THREE;
    const T = PP.TABLE;
    const metal = this.mat('#2a2e38', 0.5, 0.7);
    const H = 7;
    this.box(4.2, 0.12, 0.12, metal, 0, H, T.cz - 2);
    this.box(4.2, 0.12, 0.12, metal, 0, H, T.cz + 2);
    this.box(0.12, 0.12, 4.2, metal, -2, H, T.cz);
    this.box(0.12, 0.12, 4.2, metal, 2, H, T.cz);

    // Beam texture: bright at the top, fading out towards the floor
    const c = document.createElement('canvas');
    c.width = 4; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
    const beamTex = new THREE.CanvasTexture(c);

    this.beams = [];
    [[-1.3, -1.1], [1.3, -1.1], [-1.3, 1.1], [1.3, 1.1]].forEach(([x, z], i) => {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 16), metal);
      lamp.position.set(x, H - 0.2, T.cz + z);
      this.root.add(lamp);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20), new THREE.MeshBasicMaterial({ color: 0xfff3dd, fog: false }));
      lens.rotation.x = Math.PI / 2;
      lens.position.set(x, H - 0.36, T.cz + z);
      this.root.add(lens);

      const beam = new THREE.Mesh(
        new THREE.ConeGeometry(1.25, H - 0.4, 32, 1, true),
        new THREE.MeshBasicMaterial({ map: beamTex, color: i % 2 ? 0xcfe6ff : 0xfff0d8, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })
      );
      beam.position.set(x, (H - 0.4) / 2, T.cz + z); // the cone's tip sits in the lamp
      this.root.add(beam);
      this.beams.push(beam);
    });
  },

  // ---------------------------------------------------------------- dust in the light
  buildDust: function () {
    const THREE = this.THREE;
    const T = PP.TABLE;
    const count = 350;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 5;
      pos[i * 3 + 1] = 0.5 + Math.random() * 6;
      pos[i * 3 + 2] = T.cz + (Math.random() - 0.5) * 5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({
      map: PP.dotTexture(), size: 0.03, color: 0xfff1d6, transparent: true, opacity: 0.45,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.root.add(this.dust);
  },

  tick: function (time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    this.time += dt;
    const t = this.time;

    this.boards.forEach((tex) => { tex.offset.x = (tex.offset.x + dt * 0.035) % 1; });
    this.dust.rotation.y = t * 0.01;
    this.beams.forEach((b, i) => { b.material.opacity = 0.085 + Math.sin(t * 0.7 + i) * 0.015 + this.cheerLevel * 0.05; });

    // The crowd jumps while they cheer, then settles down again
    if (this.cheerLevel > 0.005 || !this.settled) {
      this.placeCrowd(t);
      this.settled = this.cheerLevel <= 0.005;
      this.cheerLevel *= Math.pow(0.35, dt);
    } else if (Math.floor(t * 4) !== this.lastSway) {
      this.lastSway = Math.floor(t * 4);
      this.placeCrowd(t); // a gentle idle sway, a few times per second is plenty
    }

    this.flashes.forEach((f) => {
      if (f.life < 0) { f.life += dt; if (f.life >= 0) f.life = 0.001; f.sprite.material.opacity = 0; return; }
      if (f.life > 0) {
        f.life += dt;
        f.sprite.material.opacity = Math.max(0, 1 - f.life / 0.12);
        if (f.life > 0.12) f.life = 0;
      }
    });
  },
});
