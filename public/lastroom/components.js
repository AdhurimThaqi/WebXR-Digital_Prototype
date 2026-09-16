// A-Frame components for The Last Room VR.
// Everything is built from simple shapes and textures drawn in code.

(() => {
const LR = (window.LR = {});
const THREE = AFRAME.THREE;

LR.fonts = {
  display: '"Playfair Display", Georgia, serif',
  body: '"EB Garamond", Georgia, serif',
  ui: 'Georgia, serif',
};
LR.gold = (alpha) => `rgba(201,151,58,${alpha})`;

// ------------------------------------------------------------------ helpers
LR.canvasTexture = (canvas, repeat) => {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
};

LR.canvas = (width, height, draw) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  return canvas;
};

// Runs fn once A-Frame has created the entity's mesh and material
LR.whenLoaded = (el, fn) => {
  if (el.hasLoaded) fn();
  else el.addEventListener('loaded', fn, { once: true });
};

// Splits text into lines that fit maxWidth
LR.wrap = (ctx, text, maxWidth) => {
  const lines = [];
  text.split('\n').forEach((paragraph) => {
    let line = '';
    paragraph.split(' ').forEach((word) => {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    lines.push(line);
  });
  return lines;
};

LR.text = (ctx, text, x, y, { font, color, align = 'center', maxWidth = 10000, lineHeight = 40, spacing = 0 }) => {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = spacing + 'px';
  const lines = LR.wrap(ctx, text, maxWidth);
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  return y + lines.length * lineHeight;
};

LR.makeMaterial = (color, options = {}) =>
  new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.9, metalness: 0 }, options));

// Wood floorboards, 1 texture tile = 1 m
LR.boardsTexture = (color) => LR.canvasTexture(LR.canvas(512, 512, (ctx) => {
  const base = new THREE.Color(color);
  const boards = 6;
  for (let b = 0; b < boards; b++) {
    const shade = base.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.06);
    ctx.fillStyle = '#' + shade.getHexString();
    ctx.fillRect(0, (b * 512) / boards, 512, 512 / boards);
    ctx.globalAlpha = 0.08;
    for (let g = 0; g < 14; g++) {
      ctx.fillStyle = Math.random() < 0.5 ? '#000' : '#fff';
      ctx.fillRect(0, (b * 512) / boards + Math.random() * (512 / boards), 512, 1 + Math.random() * 2);
    }
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, (b * 512) / boards, 512, 2);
    const seam = Math.random() * 512;
    ctx.fillRect(seam, (b * 512) / boards, 2, 512 / boards);
    ctx.globalAlpha = 1;
  }
}), true);

// Checked kitchen tiles, 1 tile = 1 m
LR.tilesTexture = (color) => LR.canvasTexture(LR.canvas(256, 256, (ctx) => {
  const light = new THREE.Color(color);
  const dark = light.clone().offsetHSL(0, 0, -0.08);
  for (let x = 0; x < 4; x++) {
    for (let y = 0; y < 4; y++) {
      ctx.fillStyle = '#' + ((x + y) % 2 ? dark : light).getHexString();
      ctx.fillRect(x * 64, y * 64, 64, 64);
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(256, i * 64); ctx.stroke();
  }
}), true);

// Faded striped wallpaper, 1 tile = 1 m
LR.wallpaperTexture = (color) => LR.canvasTexture(LR.canvas(256, 256, (ctx) => {
  const base = new THREE.Color(color);
  ctx.fillStyle = '#' + base.getHexString();
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#' + base.clone().offsetHSL(0, 0, 0.03).getHexString();
  for (let x = 0; x < 256; x += 32) ctx.fillRect(x, 0, 12, 256);
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 300; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? '#000' : '#fff';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
}), true);

LR.knitTexture = (color) => LR.canvasTexture(LR.canvas(128, 128, (ctx) => {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let x = 0; x < 128; x += 8) ctx.fillRect(x, 0, 3, 128);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < 128; y += 6) ctx.fillRect(0, y, 128, 1);
}), true);

// Sets the UVs of a plane so a repeating texture keeps real-world scale
LR.worldUVs = (geometry, width, height, offsetU = 0, offsetV = 0) => {
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, offsetU + uv.getX(i) * width, offsetV + uv.getY(i) * height);
  }
  uv.needsUpdate = true;
  return geometry;
};

// Merges several simple geometries into one (fewer draw calls on the headset)
LR.merge = (geometries) => {
  const parts = geometries.map((g) => g.index ? g.toNonIndexed() : g);
  const count = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const position = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);
  let offset = 0;
  parts.forEach((g) => {
    position.set(g.attributes.position.array, offset * 3);
    normal.set(g.attributes.normal.array, offset * 3);
    offset += g.attributes.position.count;
  });
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  return merged;
};

LR.dotTexture = null;
LR.getDot = () => {
  if (!LR.dotTexture) {
    LR.dotTexture = new THREE.CanvasTexture(LR.canvas(64, 64, (ctx) => {
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.3, 'rgba(255,255,255,0.8)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
    }));
  }
  return LR.dotTexture;
};

// ------------------------------------------------------------------ small components

// Vertical colour gradient on a sky or a backdrop plane (top colour first)
AFRAME.registerComponent('sky-gradient', {
  schema: { colors: { type: 'array', default: ['#000000', '#ffffff'] } },
  init: function () {
    const colors = this.data.colors;
    const texture = LR.canvasTexture(LR.canvas(8, 512, (ctx) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, 512);
      colors.forEach((c, i) => gradient.addColorStop(i / (colors.length - 1), c));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 8, 512);
    }));
    LR.whenLoaded(this.el, () => {
      const material = this.el.getObject3D('mesh').material;
      material.map = texture;
      material.color.set('#ffffff');
      material.needsUpdate = true;
    });
  }
});

AFRAME.registerComponent('render-order', {
  schema: { default: 0 },
  init: function () {
    LR.whenLoaded(this.el, () => this.el.object3D.traverse((o) => { o.renderOrder = this.data; }));
  }
});

// Knitted wool look (the cardigan)
AFRAME.registerComponent('knit', {
  schema: { color: { type: 'color', default: '#5a7a4a' } },
  init: function () {
    const texture = LR.knitTexture(this.data.color);
    texture.repeat.set(3, 4);
    LR.whenLoaded(this.el, () => {
      const material = this.el.getObject3D('mesh').material;
      material.map = texture;
      material.color.set('#ffffff');
      material.needsUpdate = true;
    });
  }
});

// Plays an animation when the story sends an event to this element, and
// puts the value back when the experience restarts.
//   memory-fx="property: light.intensity; to: 2; dur: 1500"
//   on: memory-on (default, when the object's memory unlocks) or scene-start
AFRAME.registerComponent('memory-fx', {
  multiple: true,
  schema: {
    on: { default: 'memory-on' },
    property: { default: '' },
    to: { default: '' },
    dur: { default: 1500 },
    delay: { default: 0 },
    easing: { default: 'easeInOutSine' }
  },
  init: function () {
    this.animationName = 'animation__fx_' + (this.id || 'main');
    // (not called "play": that name is reserved by A-Frame and runs on page load)
    this.start = this.start.bind(this);
    this.reset = this.reset.bind(this);
    this.el.addEventListener(this.data.on, this.start);
    this.el.addEventListener('memory-reset', this.reset);
  },
  read: function () {
    const { property } = this.data;
    const value = property === 'visible'
      ? this.el.getAttribute('visible')
      : AFRAME.utils.entity.getComponentProperty(this.el, property);
    return value && typeof value === 'object' ? Object.assign({}, value) : value;
  },
  start: function (evt) {
    if (!evt || evt.target !== this.el) return;
    const { property, to, dur, delay, easing } = this.data;
    if (this.initial === undefined) this.initial = this.read();
    if (property === 'visible') {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.el.setAttribute('visible', to === 'true'), delay);
      return;
    }
    this.el.setAttribute(this.animationName, { property, to, dur, delay, easing, loop: false, autoplay: true });
  },
  reset: function (evt) {
    if (evt && evt.target !== this.el) return;
    clearTimeout(this.timer);
    if (this.initial === undefined) return;
    this.el.removeAttribute(this.animationName);
    if (this.data.property === 'visible') this.el.setAttribute('visible', this.initial);
    else AFRAME.utils.entity.setComponentProperty(this.el, this.data.property, this.initial);
    this.initial = undefined;
  }
});

// ------------------------------------------------------------------ text panels

// A flat panel whose picture is drawn with the 2D canvas API.
// Other code calls el.components['canvas-panel'].draw((ctx, w, h) => { ... }).
AFRAME.registerComponent('canvas-panel', {
  schema: {
    width: { default: 1 },
    height: { default: 0.5 },
    resolution: { default: 1024 }, // canvas pixels across the width
    startHidden: { default: true }
  },
  init: function () {
    const { width, height, resolution } = this.data;
    this.canvas = document.createElement('canvas');
    this.canvas.width = resolution;
    this.canvas.height = Math.round((resolution * height) / width);
    this.ctx = this.canvas.getContext('2d');
    this.texture = LR.canvasTexture(this.canvas);
    this.material = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, opacity: 0 });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.material);
    this.el.setObject3D('mesh', this.mesh);
    this.opacity = 0;
    this.target = this.data.startHidden ? 0 : 1;
    this.el.object3D.visible = !this.data.startHidden;
  },
  draw: function (fn) {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    fn(ctx, canvas.width, canvas.height);
    ctx.restore();
    this.texture.needsUpdate = true;
  },
  show: function () { this.target = 1; this.el.object3D.visible = true; },
  hide: function () { this.target = 0; },
  tick: function (time, delta) {
    if (this.opacity === this.target) return;
    const step = (delta || 16) / 450;
    this.opacity = this.target > this.opacity ? Math.min(this.target, this.opacity + step) : Math.max(this.target, this.opacity - step);
    this.material.opacity = this.opacity;
    const scale = 0.94 + 0.06 * this.opacity;
    this.mesh.scale.set(scale, scale, 1);
    if (this.opacity === 0) this.el.object3D.visible = false;
  },
  remove: function () {
    this.texture.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
});

// Text painted onto an object: the FOR SALE sign, a name on an envelope...
AFRAME.registerComponent('sign', {
  schema: {
    text: { default: '' },
    width: { default: 0.5 },
    height: { default: 0.25 },
    color: { default: '#ffffff' },
    background: { default: '' }, // empty = see-through
    font: { default: 'ui', oneOf: ['ui', 'display', 'body'] },
    style: { default: '400' },   // e.g. "italic 400" or "700"
    size: { default: 0.55 },     // text height as a share of the sign height
    envelope: { default: false } // draws an envelope flap behind the text
  },
  init: function () {
    const d = this.data;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = Math.round((512 * d.height) / d.width);
    this.texture = LR.canvasTexture(this.canvas);
    const material = LR.makeMaterial('#ffffff', { map: this.texture, transparent: !d.background, roughness: 0.9 });
    this.el.setObject3D('mesh', new THREE.Mesh(new THREE.PlaneGeometry(d.width, d.height), material));
    const font = `${d.style} ${Math.round(this.canvas.height * d.size)}px ${LR.fonts[d.font]}`;
    this.draw(font);
    document.fonts.load(font).then(() => this.draw(font)).catch(() => {});
  },
  draw: function (font) {
    const d = this.data;
    const ctx = this.canvas.getContext('2d');
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (d.background) {
      ctx.fillStyle = d.background;
      ctx.fillRect(0, 0, w, h);
    }
    if (d.envelope) {
      ctx.strokeStyle = 'rgba(120,95,60,0.45)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(8, 8);
      ctx.lineTo(w / 2, h * 0.55);
      ctx.lineTo(w - 8, 8);
      ctx.stroke();
    }
    LR.text(ctx, d.text, w / 2, d.envelope ? h * 0.72 : h / 2, { font, color: d.color });
    this.texture.needsUpdate = true;
  }
});

// A button you point at and click (controller trigger or mouse)
AFRAME.registerComponent('vr-button', {
  dependencies: ['canvas-panel'],
  schema: { label: { default: 'Continue' } },
  init: function () {
    this.panel = this.el.components['canvas-panel'];
    this.hovered = false;
    // Buttons draw on top of the room so furniture can never hide them
    this.panel.material.depthTest = false;
    this.panel.mesh.renderOrder = 1000;
    this.el.addEventListener('mouseenter', () => {
      if (!this.el.classList.contains('interactive')) return;
      this.hovered = true;
      LRAudio.hover();
      this.redraw();
    });
    this.el.addEventListener('mouseleave', () => { this.hovered = false; this.redraw(); });
    this.el.addEventListener('click', () => {
      if (!this.el.classList.contains('interactive') || this.panel.target === 0) return;
      LRAudio.start();
      LRAudio.click();
      this.el.emit('press', null, true);
    });
    this.redraw();
  },
  update: function () { this.redraw(); },
  redraw: function () {
    if (!this.panel) return;
    const label = this.data.label;
    this.panel.draw((ctx, w, h) => {
      ctx.fillStyle = this.hovered ? 'rgba(201,151,58,0.22)' : 'rgba(13,12,10,0.72)';
      ctx.strokeStyle = this.hovered ? LR.gold(0.95) : LR.gold(0.55);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(4, 4, w - 8, h - 8, 6);
      ctx.fill();
      ctx.stroke();
      LR.text(ctx, label.toUpperCase(), w / 2, h / 2 + 2, {
        font: `600 ${Math.round(h * 0.3)}px ${LR.fonts.display}`,
        color: this.hovered ? '#f3dca0' : LR.gold(0.95),
        spacing: Math.round(h * 0.06)
      });
    });
  },
  show: function () { this.el.classList.add('interactive'); this.panel.show(); },
  hide: function () { this.el.classList.remove('interactive'); this.panel.hide(); this.hovered = false; this.redraw(); }
});

// ------------------------------------------------------------------ hold to remember

// Point at the object and hold the trigger (or mouse button) until the ring fills.
AFRAME.registerComponent('hold-to-activate', {
  schema: {
    duration: { default: 1200 },
    hitSize: { type: 'vec3', default: { x: 0.5, y: 0.5, z: 0.5 } },
    hitOffset: { type: 'vec3', default: { x: 0, y: 0, z: 0 } },
    glowRadius: { default: 0.35 }
  },
  init: function () {
    this.progress = 0;
    this.holding = false;
    this.hovered = false;
    this.done = false;

    // Invisible box around the whole object: the laser always hits this
    // first, so moving between small parts doesn't cancel the hold.
    const { hitSize, hitOffset, glowRadius } = this.data;
    this.hitBox = new THREE.Mesh(new THREE.BoxGeometry(hitSize.x, hitSize.y, hitSize.z), new THREE.MeshBasicMaterial({ visible: false }));
    this.hitBox.position.copy(hitOffset);
    // registered with setObject3D so A-Frame's raycaster (laser / mouse) tests it
    this.el.setObject3D('hitbox', this.hitBox);

    // Soft pulsing glow so you can find the object
    this.glow = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 12),
      new THREE.MeshBasicMaterial({ color: '#e8c870', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.glow.scale.setScalar(glowRadius);
    this.glow.position.copy(hitOffset);
    this.glow.raycast = () => {};
    this.el.object3D.add(this.glow);

    this.onEnter = () => {
      if (!this.isActive()) return;
      this.hovered = true;
      LRAudio.hover();
    };
    this.onLeave = () => { this.hovered = false; this.cancel(); };
    this.onDown = () => {
      if (!this.isActive()) return;
      LRAudio.start();
      this.holding = true;
      this.el.emit('hold-start', null, true);
    };
    this.onUp = () => this.cancel();
    this.el.addEventListener('mouseenter', this.onEnter);
    this.el.addEventListener('mouseleave', this.onLeave);
    this.el.addEventListener('mousedown', this.onDown);
    this.el.addEventListener('mouseup', this.onUp);
    this.el.addEventListener('memory-reset', (evt) => { if (evt.target === this.el) this.reset(); });
  },
  isActive: function () {
    return this.el.classList.contains('interactive') && !this.done;
  },
  cancel: function () {
    if (!this.holding || this.done) return;
    this.holding = false;
    this.progress = 0;
    this.el.emit('hold-progress', { progress: 0, holding: false }, true);
    this.el.emit('hold-cancel', null, true);
  },
  reset: function () {
    this.done = false;
    this.holding = false;
    this.hovered = false;
    this.progress = 0;
    this.setEmissive(0);
  },
  setEmissive: function (amount) {
    if (this.lastEmissive === amount) return;
    this.lastEmissive = amount;
    this.el.object3D.traverse((node) => {
      if (!node.isMesh || node === this.glow || !node.material || !node.material.emissive) return;
      node.material.emissive.setRGB(0.9 * amount, 0.65 * amount, 0.25 * amount);
    });
  },
  tick: function (time, delta) {
    const active = this.isActive();
    if (this.holding && active) {
      this.progress = Math.min(1, this.progress + delta / this.data.duration);
      this.el.emit('hold-progress', { progress: this.progress, holding: true }, true);
      if (this.progress >= 1) {
        this.done = true;
        this.doneAt = time;
        this.holding = false;
        this.el.emit('hold-complete', null, true);
      }
    }
    const pulse = 0.5 + 0.5 * Math.sin(time / 450);
    this.glow.visible = active || this.holding;
    this.glow.material.opacity = 0.035 + 0.05 * pulse + (this.hovered ? 0.05 : 0) + 0.22 * this.progress;
    this.glow.scale.setScalar(this.data.glowRadius * (1 + 0.08 * pulse + 0.2 * this.progress));
    if (this.done) {
      // bright flash when unlocked, fading away over 2.5 s
      const fade = Math.max(0, 1 - (time - this.doneAt) / 2500);
      this.setEmissive(Math.round(0.5 * fade * 50) / 50);
    } else if (active) {
      this.setEmissive(Math.round(((this.hovered ? 0.12 : 0.04 * pulse) + 0.5 * this.progress) * 50) / 50);
    } else {
      this.setEmissive(0);
    }
  }
});

// ------------------------------------------------------------------ rooms

// Floor, walls and ceiling of a room, with optional openings (windows/doors)
//   openings: "front 0 1 1.6 1.2" = wall, centre along the wall, bottom, width, height
//   walls are front (-z), back (+z), left (-x), right (+x), seen from the middle
AFRAME.registerComponent('room-shell', {
  schema: {
    width: { default: 4 },
    depth: { default: 4 },
    height: { default: 2.7 },
    wallColor: { default: '#d4ccc0' },
    floorColor: { default: '#9a9080' },
    ceilingColor: { default: '#cfc7bb' },
    floorStyle: { default: 'boards', oneOf: ['boards', 'tiles'] },
    openings: { default: '' },
    frameMarks: { default: 0 } // pale patches where pictures used to hang
  },
  init: function () {
    const d = this.data;
    const group = new THREE.Group();
    const wallTexture = LR.wallpaperTexture(d.wallColor);
    const wallMaterial = LR.makeMaterial('#ffffff', { map: wallTexture });
    const floorTexture = d.floorStyle === 'tiles' ? LR.tilesTexture(d.floorColor) : LR.boardsTexture(d.floorColor);
    const floorMaterial = LR.makeMaterial('#ffffff', { map: floorTexture, roughness: 0.8 });
    const ceilingMaterial = LR.makeMaterial(d.ceilingColor);
    const trimMaterial = LR.makeMaterial(new THREE.Color(d.wallColor).offsetHSL(0, -0.05, -0.18));

    const floor = new THREE.Mesh(LR.worldUVs(new THREE.PlaneGeometry(d.width, d.depth), d.width, d.depth), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    group.add(floor);

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(d.width, d.depth), ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = d.height;
    group.add(ceiling);

    const openings = {};
    d.openings.split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => {
      const [wall, u, v, w, h] = s.split(/\s+/);
      openings[wall] = { u: +u, v: +v, w: +w, h: +h };
    });

    const walls = {
      front: { length: d.width, position: [0, 0, -d.depth / 2], rotationY: 0 },
      back: { length: d.width, position: [0, 0, d.depth / 2], rotationY: Math.PI },
      left: { length: d.depth, position: [-d.width / 2, 0, 0], rotationY: Math.PI / 2 },
      right: { length: d.depth, position: [d.width / 2, 0, 0], rotationY: -Math.PI / 2 },
    };

    Object.entries(walls).forEach(([name, wall]) => {
      const wallGroup = new THREE.Group();
      wallGroup.position.set(...wall.position);
      wallGroup.rotation.y = wall.rotationY;
      group.add(wallGroup);

      const L = wall.length;
      const H = d.height;
      const hole = openings[name];
      // Rectangles in wall space: [left edge from -L/2, bottom, width, height]
      const pieces = hole
        ? [
            [-L / 2, 0, L / 2 + hole.u - hole.w / 2, H],
            [hole.u + hole.w / 2, 0, L / 2 - hole.u - hole.w / 2, H],
            [hole.u - hole.w / 2, 0, hole.w, hole.v],
            [hole.u - hole.w / 2, hole.v + hole.h, hole.w, H - hole.v - hole.h],
          ]
        : [[-L / 2, 0, L, H]];
      pieces.forEach(([x, y, w, h]) => {
        if (w <= 0.001 || h <= 0.001) return;
        const geometry = LR.worldUVs(new THREE.PlaneGeometry(w, h), w, h, x + L / 2, y);
        const piece = new THREE.Mesh(geometry, wallMaterial);
        piece.position.set(x + w / 2, y + h / 2, 0);
        wallGroup.add(piece);
      });

      // Skirting board (not across doorways)
      const skirtPieces = hole && hole.v < 0.05
        ? [[-L / 2, L / 2 + hole.u - hole.w / 2], [hole.u + hole.w / 2, L / 2 - hole.u - hole.w / 2]]
        : [[-L / 2, L]];
      skirtPieces.forEach(([x, w]) => {
        if (w <= 0.001) return;
        const skirt = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.02), trimMaterial);
        skirt.position.set(x + w / 2, 0.05, 0.01);
        wallGroup.add(skirt);
      });

      // Pale rectangles where frames used to hang
      if (d.frameMarks && (name === 'left' || name === 'right')) {
        const markMaterial = LR.makeMaterial(new THREE.Color(d.wallColor).offsetHSL(0, 0.02, 0.06));
        for (let i = 0; i < d.frameMarks; i++) {
          const w = 0.35 + Math.random() * 0.3;
          const h = 0.3 + Math.random() * 0.35;
          const x = -L / 2 + (L * (i + 0.5)) / d.frameMarks + (Math.random() - 0.5) * 0.3;
          if (hole && Math.abs(x - hole.u) < hole.w / 2 + w / 2) continue;
          const mark = new THREE.Mesh(new THREE.PlaneGeometry(w, h), markMaterial);
          mark.position.set(x, 1.5 + (Math.random() - 0.5) * 0.3, 0.004);
          wallGroup.add(mark);
          const nail = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), trimMaterial);
          nail.position.set(x, 1.5 + h / 2 + 0.06, 0.006);
          wallGroup.add(nail);
        }
      }
    });

    this.el.setObject3D('mesh', group);
  }
});

// Grandparent's house: day or evening version
AFRAME.registerComponent('cottage', {
  schema: { mode: { default: 'day', oneOf: ['day', 'night'] } },
  init: function () {
    const night = this.data.mode === 'night';
    const palette = night
      ? { wall: '#1c1c2a', roof: '#101018', frame: '#15151f', window: '#f0c060', inner: '#6a4a28', base: '#141420' }
      : { wall: '#c8b99a', roof: '#7a6652', frame: '#8b7355', window: '#e8d5a3', inner: '#e0b070', base: '#8a7a64' };
    const wall = LR.makeMaterial(palette.wall, { map: LR.wallpaperTexture(palette.wall) });
    wall.map.repeat.set(1, 1);
    const roof = LR.makeMaterial(palette.roof, { flatShading: true });
    const frame = LR.makeMaterial(palette.frame);
    const base = LR.makeMaterial(palette.base);
    const windowMaterial = night
      ? new THREE.MeshBasicMaterial({ color: palette.window, transparent: true, opacity: 0.85 })
      : LR.makeMaterial(palette.window, { roughness: 0.3, emissive: '#3a2a10' });
    const inner = LR.makeMaterial(palette.inner, { side: THREE.BackSide, emissive: palette.inner, emissiveIntensity: night ? 0.4 : 0.55 });

    const group = new THREE.Group();
    const box = (w, h, d, x, y, z, material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      group.add(mesh);
      return mesh;
    };

    // Walls (front face at z = 0) with a door opening 1.1 x 2.1 m
    const W = 7, H = 4, D = 6;
    box((W - 1.1) / 2, H, 0.2, -(1.1 / 2 + (W - 1.1) / 4), H / 2, -0.1, wall);
    box((W - 1.1) / 2, H, 0.2, 1.1 / 2 + (W - 1.1) / 4, H / 2, -0.1, wall);
    box(1.1, H - 2.1, 0.2, 0, 2.1 + (H - 2.1) / 2, -0.1, wall);
    box(0.2, H, D, -W / 2 + 0.1, H / 2, -D / 2, wall);
    box(0.2, H, D, W / 2 - 0.1, H / 2, -D / 2, wall);
    box(W, H, 0.2, 0, H / 2, -D + 0.1, wall);
    box(W + 0.2, 0.3, D + 0.2, 0, 0.15, -D / 2, base);

    // Warm lit hall behind the door
    box(1.8, 2.4, 2.4, 0, 1.2, -1.4, inner);

    // Gable triangles and roof
    const gable = new THREE.BufferGeometry();
    gable.setAttribute('position', new THREE.Float32BufferAttribute([-W / 2, H, 0, W / 2, H, 0, 0, H + 2.3, 0], 3));
    gable.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
    gable.computeVertexNormals();
    const front = new THREE.Mesh(gable, wall);
    group.add(front);
    const back = new THREE.Mesh(gable, wall);
    back.position.z = -D;
    back.rotation.y = Math.PI;
    group.add(back);

    const halfSpan = W / 2 + 0.35;
    const angle = Math.atan2(2.3, W / 2);
    const slope = halfSpan / Math.cos(angle);
    [-1, 1].forEach((side) => {
      const plane = box(slope, 0.18, D + 0.7, (side * halfSpan) / 2, H + 2.3 - (halfSpan / 2) * Math.tan(angle) + 0.05, -D / 2, roof);
      plane.rotation.z = -side * angle;
    });
    box(0.6, 1.6, 0.6, 1.9, H + 2.2, -D * 0.7, base);

    // Windows with frames
    [-2.2, 2.2].forEach((x) => {
      box(1.3, 1.3, 0.04, x, 2.55, 0.02, windowMaterial);
      box(1.42, 0.08, 0.08, x, 3.24, 0.04, frame);
      box(1.42, 0.08, 0.08, x, 1.86, 0.04, frame);
      box(0.08, 1.42, 0.08, x - 0.69, 2.55, 0.04, frame);
      box(0.08, 1.42, 0.08, x + 0.69, 2.55, 0.04, frame);
      box(0.05, 1.3, 0.06, x, 2.55, 0.05, frame);
      box(1.3, 0.05, 0.06, x, 2.55, 0.05, frame);
    });

    // Door frame and step
    box(0.1, 2.2, 0.12, -0.6, 1.1, 0.02, frame);
    box(0.1, 2.2, 0.12, 0.6, 1.1, 0.02, frame);
    box(1.3, 0.1, 0.12, 0, 2.15, 0.02, frame);
    box(1.6, 0.15, 0.6, 0, 0.075, 0.3, base);

    this.el.setObject3D('mesh', group);
  }
});

// Lots of grass tufts in one draw call
AFRAME.registerComponent('grass-tufts', {
  schema: {
    count: { default: 600 },
    width: { default: 10 },
    depth: { default: 10 },
    minHeight: { default: 0.15 },
    maxHeight: { default: 0.5 },
    color: { type: 'color', default: '#4a6b3a' },
    memoryColor: { type: 'color', default: '' },
    exclude: { default: '' } // "x1 z1 x2 z2, ..." rectangles without grass
  },
  init: function () {
    const d = this.data;
    const blades = [];
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.ConeGeometry(0.025, 1, 3);
      blade.translate(0, 0.5, 0);
      blade.rotateZ((i - 1) * 0.35);
      blade.rotateY((i * Math.PI * 2) / 3);
      blades.push(blade);
    }
    const geometry = LR.merge(blades);
    this.material = LR.makeMaterial(d.color, { flatShading: true });
    const exclude = d.exclude.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.split(/\s+/).map(Number));
    const mesh = new THREE.InstancedMesh(geometry, this.material, d.count);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    let placed = 0;
    for (let tries = 0; placed < d.count && tries < d.count * 5; tries++) {
      const x = (Math.random() - 0.5) * d.width;
      const z = (Math.random() - 0.5) * d.depth;
      if (exclude.some(([x1, z1, x2, z2]) => x > x1 && x < x2 && z > z1 && z < z2)) continue;
      const h = d.minHeight + Math.random() * (d.maxHeight - d.minHeight);
      euler.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.3);
      quaternion.setFromEuler(euler);
      matrix.compose(new THREE.Vector3(x, 0, z), quaternion, new THREE.Vector3(1, h, 1));
      mesh.setMatrixAt(placed++, matrix);
    }
    mesh.count = placed;
    this.el.setObject3D('mesh', mesh);

    this.from = new THREE.Color(d.color);
    this.to = d.memoryColor ? new THREE.Color(d.memoryColor) : this.from;
    this.blend = 0;
    this.blendTarget = 0;
    this.el.addEventListener('memory-on', (evt) => { if (evt.target === this.el) this.blendTarget = 1; });
    this.el.addEventListener('memory-reset', (evt) => { if (evt.target === this.el) { this.blendTarget = 0; this.blend = 0; this.material.color.copy(this.from); } });
  },
  tick: function (time, delta) {
    if (this.blend === this.blendTarget) return;
    this.blend = Math.min(this.blendTarget, this.blend + delta / 2000);
    this.material.color.copy(this.from).lerp(this.to, this.blend);
  }
});

// Slowly drifting specks: dust in sunlight, fireflies, stars
AFRAME.registerComponent('drifting-motes', {
  schema: {
    count: { default: 150 },
    size: { type: 'vec3', default: { x: 4, y: 2.5, z: 4 } },
    color: { type: 'color', default: '#ffe2a0' },
    particleSize: { default: 0.02 },
    speed: { default: 0.03 },
    opacity: { default: 0.7 }
  },
  init: function () {
    const d = this.data;
    this.positions = new Float32Array(d.count * 3);
    this.seeds = new Float32Array(d.count);
    for (let i = 0; i < d.count; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * d.size.x;
      this.positions[i * 3 + 1] = Math.random() * d.size.y;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * d.size.z;
      this.seeds[i] = Math.random() * 1000;
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.material = new THREE.PointsMaterial({
      color: d.color, size: d.particleSize, map: LR.getDot(), transparent: true,
      opacity: d.opacity, depthWrite: false, blending: THREE.AdditiveBlending
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.el.setObject3D('mesh', this.points);
  },
  tick: function (time, delta) {
    if (!this.el.object3D.visible || !delta) return;
    const d = this.data;
    const p = this.positions;
    const step = (d.speed * delta) / 1000;
    for (let i = 0; i < d.count; i++) {
      const s = this.seeds[i];
      p[i * 3] += Math.sin(time / 3000 + s) * step;
      p[i * 3 + 1] += (0.3 + Math.cos(time / 4000 + s) * 0.7) * step;
      p[i * 3 + 2] += Math.cos(time / 3500 + s * 2) * step;
      if (p[i * 3 + 1] > d.size.y) p[i * 3 + 1] = 0;
    }
    this.geometry.attributes.position.needsUpdate = true;
  }
});

AFRAME.registerComponent('night-stars', {
  schema: { count: { default: 700 }, radius: { default: 300 } },
  init: function () {
    const positions = [];
    const v = new THREE.Vector3();
    while (positions.length < this.data.count * 3) {
      v.randomDirection();
      if (v.y < 0.12) continue;
      v.multiplyScalar(this.data.radius);
      positions.push(v.x, v.y, v.z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.material = new THREE.PointsMaterial({ size: 2.2, map: LR.getDot(), transparent: true, depthWrite: false, color: '#ffffff' });
    this.el.setObject3D('mesh', new THREE.Points(geometry, this.material));
  },
  tick: function (time) {
    this.material.opacity = 0.65 + 0.25 * Math.sin(time / 1300);
  }
});

// ------------------------------------------------------------------ memory figures

// A glowing, see-through person that fades in when a memory unlocks.
//   pose: arms-open | stove | sitting | running
AFRAME.registerComponent('memory-figure', {
  schema: {
    height: { default: 1.65 },
    clothes: { type: 'color', default: '#e8c890' },
    glow: { type: 'color', default: '#ffe6b0' },
    pose: { default: 'stove' },
    delay: { default: 600 },
    opacity: { default: 0.55 }
  },
  init: function () {
    const d = this.data;
    const s = d.height / 1.7;
    const make = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });
    this.materials = [make(d.glow), make(d.clothes), make(new THREE.Color(d.clothes).offsetHSL(0, -0.1, -0.12))];
    const [skin, clothes, legs] = this.materials;

    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const capsule = (radius, length, material) => new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 6, 12), material);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11 * s, 20, 14), skin);
    head.position.y = 1.62 * s;
    body.add(head);
    const torso = capsule(0.16 * s, 0.38 * s, clothes);
    torso.position.y = 1.15 * s;
    body.add(torso);

    this.arms = [-1, 1].map((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.2 * s, 1.42 * s, 0);
      const arm = capsule(0.05 * s, 0.5 * s, clothes);
      arm.position.y = -0.3 * s;
      pivot.add(arm);
      body.add(pivot);
      return pivot;
    });
    this.legs = [-1, 1].map((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.09 * s, 0.85 * s, 0);
      const leg = capsule(0.065 * s, 0.68 * s, legs);
      leg.position.y = -0.42 * s;
      pivot.add(leg);
      body.add(pivot);
      return pivot;
    });

    // soft halo
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.55 * s, 16, 10),
      new THREE.MeshBasicMaterial({ color: d.glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    halo.position.y = 1.1 * s;
    halo.scale.y = 1.7;
    body.add(halo);
    this.halo = halo;

    if (d.pose === 'sitting') {
      body.position.y = 0.47 - 0.85 * s;
      this.legs.forEach((leg) => { leg.rotation.x = -1.35; });
      this.arms.forEach((arm, i) => { arm.rotation.x = -0.5; arm.rotation.z = (i ? 1 : -1) * 0.1; });
    }

    this.body = body;
    this.opacity = 0;
    this.target = 0;
    this.startedAt = null;
    root.visible = false;
    this.el.setObject3D('mesh', root);

    this.el.addEventListener('memory-on', (evt) => {
      if (evt.target !== this.el) return;
      this.timer = setTimeout(() => { this.target = 1; this.startedAt = null; root.visible = true; }, d.delay);
    });
    this.el.addEventListener('memory-reset', (evt) => {
      if (evt.target !== this.el) return;
      clearTimeout(this.timer);
      this.target = 0;
      this.opacity = 0;
      root.visible = false;
      this.applyOpacity();
    });
  },
  applyOpacity: function () {
    const o = this.opacity * this.data.opacity;
    this.materials.forEach((m) => { m.opacity = o; });
    this.halo.material.opacity = this.opacity * 0.05;
  },
  tick: function (time, delta) {
    if (this.target === 0 && this.opacity === 0) return;
    if (this.opacity < this.target) {
      this.opacity = Math.min(1, this.opacity + delta / 2200);
      this.applyOpacity();
    }
    if (this.startedAt === null) this.startedAt = time;
    const t = (time - this.startedAt) / 1000;
    const pose = this.data.pose;

    if (pose === 'arms-open') {
      const open = Math.min(1, t / 2.5);
      const ease = open * open * (3 - 2 * open);
      this.arms.forEach((arm, i) => {
        const side = i ? 1 : -1;
        arm.rotation.z = side * (0.12 + 1.05 * ease);
        arm.rotation.x = -0.55 * ease;
      });
      this.body.position.y = Math.sin(t * 1.4) * 0.01;
    } else if (pose === 'stove') {
      this.body.rotation.z = Math.sin(t * 0.9) * 0.035;
      this.arms[1].rotation.x = -0.7 + Math.sin(t * 1.6) * 0.15;
      this.arms[0].rotation.x = -0.4;
    } else if (pose === 'sitting') {
      this.body.rotation.y = Math.sin(t * 0.35) * 0.25;
    } else if (pose === 'running') {
      const swing = Math.sin(t * 9);
      this.legs[0].rotation.x = swing * 0.7;
      this.legs[1].rotation.x = -swing * 0.7;
      this.arms[0].rotation.x = -swing * 0.6;
      this.arms[1].rotation.x = swing * 0.6;
      this.body.position.y = Math.abs(Math.sin(t * 9)) * 0.06;
    }
  }
});

// ------------------------------------------------------------------ audio listener

// Keeps the 3D audio "ears" on your head
AFRAME.registerComponent('audio-listener', {
  tick: function () {
    if (this.el.sceneEl.camera) LRAudio.updateListener(this.el.sceneEl.camera);
  }
});
})();
