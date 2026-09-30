// The screens of SPIN: the big scoreboard, the floating menu with buttons,
// banners over the net ("POINT!", "NET"), shot-speed popups and a hint line.
// All of them are canvas panels (see PP.panel in world.js).
// In VR you press a button by tapping it with your paddle; on a desktop you click it.

window.PPUI = function (root) {
  const THREE = AFRAME.THREE;
  const T = PP.TABLE;
  const C = PP.colors;
  const F = PP.fonts;
  const ui = { buttons: [] };

  const text = (ctx, str, x, y, font, color, align, glow) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = glow ? color : 'transparent';
    ctx.shadowBlur = glow ? glow : 0;
    ctx.fillText(str, x, y);
    ctx.shadowBlur = 0;
  };

  // A dark glass card with a thin glowing edge
  const card = (p, accent) => {
    const { ctx, W, H } = p;
    ctx.clearRect(0, 0, W, H);
    PP.roundRect(ctx, 6, 6, W - 12, H - 12, Math.min(W, H) * 0.08);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(18,24,40,0.92)');
    grad.addColorStop(1, 'rgba(8,10,18,0.92)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = accent || 'rgba(57,228,255,0.55)';
    ctx.stroke();
  };

  // ---------------------------------------------------------------- scoreboard
  const board = PP.panel(3.2, 1.3, 400);
  board.mesh.position.set(0, 3.25, T.far - 3.0);
  board.mesh.rotation.x = 0.1;
  root.add(board.mesh);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(3.35, 1.45, 0.12), new THREE.MeshStandardMaterial({ color: '#0d0f16', roughness: 0.5, metalness: 0.6 }));
  frame.position.set(0, 3.25, T.far - 3.08);
  frame.rotation.x = 0.1;
  root.add(frame);

  ui.drawScore = (s) => {
    const { ctx, W, H } = board;
    card(board, 'rgba(57,228,255,0.35)');
    text(ctx, 'SPIN  ·  VR TABLE TENNIS', W / 2, 62, `600 34px ${F.ui}`, C.dim);
    // The two scores
    const col = [W * 0.26, W * 0.74];
    [['YOU', s.you, C.accent, s.server === 'player'], [s.aiName, s.ai, C.hot, s.server === 'ai']].forEach(([name, score, color, serving], i) => {
      text(ctx, name, col[i], 140, `700 44px ${F.display}`, color, 'center', 20);
      text(ctx, String(score), col[i], 280, `800 200px ${F.display}`, '#ffffff', 'center', 30);
      if (serving) {
        ctx.fillStyle = C.gold;
        ctx.shadowColor = C.gold;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(col[i] + (i ? -1 : 1) * 150, 140, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });
    text(ctx, ':', W / 2, 270, `700 150px ${F.display}`, 'rgba(255,255,255,0.35)');
    // The stats line along the bottom
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(40, H - 110, W - 80, 2);
    const stats = [
      ['RALLY', s.rally],
      ['LAST SHOT', s.lastSpeed ? `${s.lastSpeed} km/h` : '—'],
      ['BEST RALLY', s.best],
      ['FIRST TO', `${s.target}`],
    ];
    stats.forEach(([label, value], i) => {
      const x = (W / stats.length) * (i + 0.5);
      text(ctx, label, x, H - 76, `600 26px ${F.ui}`, C.dim);
      text(ctx, String(value), x, H - 38, `700 38px ${F.display}`, C.ink);
    });
    board.update();
  };

  // ---------------------------------------------------------------- banner over the net
  const banner = PP.panel(1.8, 0.5, 600);
  banner.mesh.position.set(0, T.top + 0.75, T.cz - 0.1);
  banner.mesh.visible = false;
  banner.mesh.material.depthTest = false; // always drawn on top, even over ORBIT
  banner.mesh.renderOrder = 10;
  root.add(banner.mesh);
  let bannerLife = 0, bannerDur = 0;

  ui.banner = (title, sub, color, seconds) => {
    const { ctx, W, H } = banner;
    ctx.clearRect(0, 0, W, H);
    ctx.font = `800 150px ${F.display}`;
    const w = Math.min(W - 12, Math.max(ctx.measureText(title).width, sub ? 700 : 0) + 140);
    PP.roundRect(ctx, (W - w) / 2, 8, w, H - 16, 48);
    ctx.fillStyle = 'rgba(6,8,14,0.78)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = color || '#ffffff';
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    text(ctx, title, W / 2, H * 0.4, `800 150px ${F.display}`, color || '#ffffff', 'center', 40);
    if (sub) text(ctx, sub, W / 2, H * 0.8, `600 50px ${F.ui}`, C.ink, 'center', 10);
    banner.update();
    banner.mesh.visible = true;
    bannerLife = 0;
    bannerDur = seconds || 1.6;
  };

  // ---------------------------------------------------------------- shot speed popup
  const pop = PP.panel(0.9, 0.16, 700);
  pop.mesh.visible = false;
  pop.mesh.material.depthTest = false;
  pop.mesh.renderOrder = 11;
  root.add(pop.mesh);
  let popLife = 0;
  ui.popup = (label, color, position) => {
    const { ctx, W, H } = pop;
    ctx.clearRect(0, 0, W, H);
    ctx.font = `800 72px ${F.display}`;
    const size = Math.min(72, Math.floor(72 * (W - 60) / ctx.measureText(label).width));
    text(ctx, label, W / 2, H / 2, `800 ${size}px ${F.display}`, color || C.gold, 'center', 22);
    pop.update();
    pop.mesh.position.copy(position);
    pop.mesh.visible = true;
    popLife = 0;
  };

  // ---------------------------------------------------------------- hint line on the table
  const hint = PP.panel(1.4, 0.12, 700);
  hint.mesh.position.set(0, T.top + 0.03, T.near - 0.3);
  hint.mesh.rotation.x = -1.0;
  root.add(hint.mesh);
  ui.hint = (str) => {
    const { ctx, W, H } = hint;
    ctx.clearRect(0, 0, W, H);
    if (str) {
      ctx.font = `600 44px ${F.ui}`;
      const w = ctx.measureText(str).width + 70;
      PP.roundRect(ctx, (W - w) / 2, 6, w, H - 12, (H - 12) / 2);
      ctx.fillStyle = 'rgba(8,10,18,0.72)';
      ctx.fill();
      text(ctx, str, W / 2, H / 2 + 2, `600 44px ${F.ui}`, C.ink);
    }
    hint.update();
  };

  // ---------------------------------------------------------------- menu
  const menu = new THREE.Group();
  root.add(menu);
  ui.menu = menu;
  const title = PP.panel(1.5, 0.66, 700);
  title.mesh.position.set(0, 1.66, -1.3);
  menu.add(title.mesh);

  ui.drawTitle = (lines) => {
    const { ctx, W, H } = title;
    card(title);
    text(ctx, lines.kicker, W / 2, 72, `700 34px ${F.ui}`, C.accent, 'center', 12);
    text(ctx, lines.title, W / 2, 190, `800 150px ${F.display}`, '#ffffff', 'center', 30);
    text(ctx, lines.sub, W / 2, 300, `600 40px ${F.ui}`, C.ink);
    (lines.body || []).forEach((l, i) => text(ctx, l, W / 2, 370 + i * 46, `400 32px ${F.ui}`, C.dim));
    title.update();
  };

  const drawButton = (b) => {
    const { ctx, W, H } = b.panel;
    ctx.clearRect(0, 0, W, H);
    const r = H * 0.22;
    PP.roundRect(ctx, 6, 6, W - 12, H - 12, r);
    ctx.fillStyle = b.hover ? b.color : 'rgba(12,16,28,0.9)';
    ctx.shadowColor = b.color;
    ctx.shadowBlur = b.hover ? 30 : 0;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 5;
    ctx.strokeStyle = b.color;
    ctx.stroke();
    const ink = b.hover ? '#05060a' : '#ffffff';
    if (b.sub) {
      text(ctx, b.label, W / 2, H * 0.4, `800 ${Math.round(H * 0.3)}px ${F.display}`, ink);
      text(ctx, b.sub, W / 2, H * 0.72, `500 ${Math.round(H * 0.15)}px ${F.ui}`, b.hover ? '#05060a' : C.dim);
    } else {
      text(ctx, b.label, W / 2, H / 2 + 2, `700 ${Math.round(H * 0.34)}px ${F.display}`, ink);
    }
    b.panel.update();
  };

  // defs: [{ id, label, sub, x, y, w, h, color, onPress }]
  ui.setButtons = (defs) => {
    ui.buttons.forEach((b) => { menu.remove(b.mesh); b.panel.texture.dispose(); b.mesh.geometry.dispose(); });
    ui.buttons = defs.map((d) => {
      const panel = PP.panel(d.w, d.h, 900);
      const b = Object.assign({ panel, mesh: panel.mesh, hover: false, color: d.color || C.accent }, d);
      panel.mesh.position.set(d.x, d.y, d.z ?? -0.5);
      panel.mesh.rotation.x = -0.35; // tilted towards you like a console
      panel.mesh.userData.button = b;
      menu.add(panel.mesh);
      drawButton(b);
      return b;
    });
  };

  ui.relabel = (id, label) => {
    const b = ui.buttons.find((x) => x.id === id);
    if (b) { b.label = label; drawButton(b); }
  };

  ui.setHover = (button) => {
    ui.buttons.forEach((b) => {
      const on = b === button;
      if (b.hover !== on) { b.hover = on; drawButton(b); }
    });
  };

  // Is this world point (the paddle's face) inside a button? Used for tapping in VR.
  const local = new THREE.Vector3();
  ui.buttonAtPoint = (point) => {
    if (!menu.visible) return null;
    return ui.buttons.find((b) => {
      local.copy(point);
      b.mesh.worldToLocal(local);
      return Math.abs(local.x) < b.w / 2 && Math.abs(local.y) < b.h / 2 && Math.abs(local.z) < 0.07;
    }) || null;
  };

  ui.buttonAtRay = (raycaster) => {
    if (!menu.visible) return null;
    const hit = raycaster.intersectObjects(ui.buttons.map((b) => b.mesh), false)[0];
    return hit ? hit.object.userData.button : null;
  };

  // ---------------------------------------------------------------- animation
  ui.tick = (dt, cameraPos) => {
    if (banner.mesh.visible) {
      bannerLife += dt;
      const inT = Math.min(1, bannerLife / 0.18);
      const s = 0.6 + 0.4 * (1 - Math.pow(1 - inT, 3));
      banner.mesh.scale.setScalar(s);
      banner.mesh.material.opacity = bannerLife > bannerDur ? Math.max(0, 1 - (bannerLife - bannerDur) / 0.35) : 1;
      if (bannerLife > bannerDur + 0.35) banner.mesh.visible = false;
    }
    if (pop.mesh.visible) {
      popLife += dt;
      pop.mesh.position.y += dt * 0.25;
      pop.mesh.material.opacity = Math.max(0, 1 - popLife / 1.1);
      if (cameraPos) pop.mesh.lookAt(cameraPos);
      if (popLife > 1.1) pop.mesh.visible = false;
    }
  };

  return ui;
};
