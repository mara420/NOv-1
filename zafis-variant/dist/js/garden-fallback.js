/**
 * Zafis garden — Canvas2D renderer for browsers without WebGL.
 * Original procedural artwork. Conceptually inspired by the persistent,
 * scroll-rotated scene in Prismic's NOv-1 / TScene.vue (Apache-2.0).
 * Shares the WebGL scene's public API; no external images or libraries.
 */
const stage = document.getElementById('scene-stage');
if (stage) createCanvasGarden(stage);

function createCanvasGarden(container) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    container.dataset.error = 'true';
    return;
  }
  for (const previous of container.querySelectorAll('canvas')) previous.remove();
  canvas.dataset.gardenFallback = 'true';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none;';
  container.appendChild(canvas);
  const random = seeded(142606);
  let width = 1, height = 1, dpr = 1, scale = 1;
  let disposed = false, raf = 0, dirty = true;
  let last = performance.now(), elapsed = 0;
  let rotationCos = 1, rotationSin = 0, floatY = 0;
  const pitch = 0.68, pitchSin = Math.sin(pitch), pitchCos = Math.cos(pitch);
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let requestedMotion = true;
  let motion = !motionQuery.matches;
  const state = { mode: 'intro', rotation: 0, visibility: 1 };
  const current = { rotation: 0, visibility: 1, dusk: 0, water: 0.65, growth: 1 };
  const modes = {
    intro: { dusk: 0, water: 0.65, growth: 1 },
    water: { dusk: 0, water: 1, growth: 1 },
    life: { dusk: 0, water: 0.015, growth: 1.13 },
    light: { dusk: 1, water: 0, growth: 1 },
  };
  const drawQueue = [];
  const leafSprites = new Map();
  const stones = [
    { x: -2.04, z: 1.22, w: 0.9, d: 0.65, a: -0.08 },
    { x: -1.14, z: 0.72, w: 0.9, d: 0.65, a: 0.025 },
    { x: -0.22, z: 0.22, w: 0.91, d: 0.65, a: -0.06 },
    { x: 0.69, z: -0.28, w: 0.9, d: 0.64, a: 0.04 },
    { x: 1.57, z: -0.8, w: 0.87, d: 0.64, a: -0.07 },
  ];
  const shrubs = [
    { x: -2.22, z: -0.8, r: 0.61, h: 0.81, count: 150 },
    { x: -0.77, z: -1.48, r: 0.42, h: 0.53, count: 105 },
    { x: 2.48, z: -0.72, r: 0.5, h: 0.65, count: 130 },
  ];
  const outline = Array.from({ length: 96 }, (_, i) => {
    const a = i / 96 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const vary = 1 + 0.009 * Math.sin(a * 3 + 0.7) + 0.005 * Math.cos(a * 7);
    return { x: Math.sign(c) * Math.pow(Math.abs(c), 2 / 3.5) * 3.4 * vary, z: Math.sign(s) * Math.pow(Math.abs(s), 2 / 3.5) * 2.26 * vary };
  });
  const groundDots = [], grass = [], foliage = [], soilRoots = [];
  function inLawn(x, z) {
    return Math.pow(Math.abs(x) / 3.4, 3.5) + Math.pow(Math.abs(z) / 2.26, 3.5) < 0.94;
  }
  function clearPlanting(x, z) {
    if (shrubs.some((p) => Math.hypot(x - p.x, z - p.z) < p.r * 0.8)) return false;
    return !stones.some((p) => {
      const dx = x - p.x, dz = z - p.z;
      return Math.abs(dx * Math.cos(p.a) - dz * Math.sin(p.a)) < p.w / 2 + 0.08
        && Math.abs(dx * Math.sin(p.a) + dz * Math.cos(p.a)) < p.d / 2 + 0.08;
    });
  }
  for (let i = 0; i < 1500; i++) {
    const x = (random() - 0.5) * 6.8, z = (random() - 0.5) * 4.52;
    if (!inLawn(x, z)) continue;
    groundDots.push({ x, z, size: 0.008 + random() * 0.022, tone: random() });
    if (i % 3 === 0 && clearPlanting(x, z)) grass.push({ x, z, h: 0.055 + random() * 0.09, lean: (random() - 0.5) * 0.065, tone: random() });
  }
  shrubs.forEach((shrub, index) => {
    for (let i = 0; i < shrub.count; i++) {
      const a = random() * Math.PI * 2;
      const v = random() * 1.8 - 0.8;
      const ring = Math.sqrt(1 - v * v);
      const radial = 0.8 + random() * 0.2;
      foliage.push({
        x: shrub.x + Math.cos(a) * ring * shrub.r * radial,
        z: shrub.z + Math.sin(a) * ring * shrub.r * radial,
        y: shrub.h * 0.5 + v * shrub.h * 0.48,
        r: 0.077 + random() * 0.063,
        tone: Math.floor(random() * 4), angle: random() * Math.PI,
        plant: index,
      });
    }
  });
  for (let i = 0; i < 96; i++) soilRoots.push({ i, spread: random(), length: 0.1 + random() * 0.29 });
  const spray = Array.from({ length: 82 }, (_, i) => ({ line: i % 8, phase: random(), size: 0.013 + random() * 0.008 }));

  function project(x, y, z, floating = true) {
    const rx = x * rotationCos + z * rotationSin;
    const rz = -x * rotationSin + z * rotationCos;
    const ry = y + (floating ? floatY : 0) - 0.35;
    const depth = rz * pitchCos + ry * pitchSin;
    const perspective = 14 / (14 - depth);
    return {
      x: width * 0.5 + rx * scale * perspective,
      y: height * 0.5 + (rz * pitchSin - ry * pitchCos) * scale * perspective,
      depth, s: scale * perspective,
    };
  }
  function path(points, close = true) {
    if (!points.length) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    if (close) ctx.closePath();
  }
  function enqueue(x, y, z, paint, adjustment = 0) {
    drawQueue.push({ depth: project(x, y, z).depth + adjustment, paint });
  }
  function circlePoints(x, y, z, radius, count = 24) {
    return Array.from({ length: count }, (_, i) => project(x + Math.cos(i / count * Math.PI * 2) * radius, y, z + Math.sin(i / count * Math.PI * 2) * radius));
  }
  function paintShadow() {
    const p = project(0.1, -0.94, 0.15, false);
    const px = project(4.15, -0.94, 0.15, false);
    const pz = project(0.1, -0.94, 3.07, false);
    ctx.save();
    ctx.transform(px.x - p.x, px.y - p.y, pz.x - p.x, pz.y - p.y, p.x, p.y);
    const gradient = ctx.createRadialGradient(0, 0, 0.1, 0, 0, 1);
    gradient.addColorStop(0, 'rgba(30,36,25,0.19)');
    gradient.addColorStop(0.48, 'rgba(40,42,30,0.115)');
    gradient.addColorStop(0.8, 'rgba(40,42,30,0.035)');
    gradient.addColorStop(1, 'rgba(40,42,30,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function paintEarth() {
    const bands = [
      { top: -0.012, bottom: -0.12, topScale: 1, bottomScale: 1, color: [62, 63, 37] },
      { top: -0.12, bottom: -0.28, topScale: 1, bottomScale: 1.001, color: [92, 75, 49] },
      { top: -0.28, bottom: -0.45, topScale: 1.001, bottomScale: 0.987, color: [70, 54, 38] },
      { top: -0.45, bottom: -0.56, topScale: 0.987, bottomScale: 0.95, color: [48, 39, 30] },
    ];
    const faces = [];
    bands.forEach((band) => {
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i], b = outline[(i + 1) % outline.length];
        const midX = (a.x + b.x) * 0.5, midZ = (a.z + b.z) * 0.5;
        const nx = midX / 3.4, nz = midZ / 2.26;
        const rotatedNormalZ = -nx * rotationSin + nz * rotationCos;
        if (rotatedNormalZ < -0.15) continue;
        const light = 0.77 + (0.5 - (nx * rotationCos + nz * rotationSin) * 0.5) * 0.37;
        faces.push({
          depth: project(midX, band.bottom, midZ).depth,
          points: [project(a.x * band.topScale, band.top, a.z * band.topScale), project(b.x * band.topScale, band.top, b.z * band.topScale), project(b.x * band.bottomScale, band.bottom, b.z * band.bottomScale), project(a.x * band.bottomScale, band.bottom, a.z * band.bottomScale)],
          color: color(band.color, light * (1 - current.dusk * 0.31)),
        });
      }
    });
    faces.sort((a, b) => a.depth - b.depth);
    for (const face of faces) { path(face.points); ctx.fillStyle = face.color; ctx.fill(); ctx.strokeStyle = face.color; ctx.lineWidth = 0.5; ctx.stroke(); }
    for (const root of soilRoots) {
      const a = outline[root.i];
      const rz = -a.x / 3.4 * rotationSin + a.z / 2.26 * rotationCos;
      if (rz < 0) continue;
      const p = project(a.x, -0.045, a.z);
      const q = project(a.x * (0.998 - root.length * 0.03), -0.045 - root.length, a.z * (0.998 - root.length * 0.03));
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x + (root.spread - 0.5) * 6, p.y + (q.y - p.y) * 0.65, q.x, q.y);
      ctx.strokeStyle = `rgba(173,150,103,${0.12 * (1 - current.dusk * 0.4)})`;
      ctx.lineWidth = 0.65; ctx.stroke();
    }
  }
  function paintLawn() {
    const edge = outline.map((p) => project(p.x, 0, p.z));
    path(edge);
    const gradient = ctx.createLinearGradient(width * 0.23, height * 0.24, width * 0.77, height * 0.78);
    gradient.addColorStop(0, mix([111, 143, 73], [49, 75, 54], current.dusk));
    gradient.addColorStop(0.5, mix([72, 112, 53], [34, 62, 43], current.dusk));
    gradient.addColorStop(1, mix([48, 85, 40], [23, 47, 35], current.dusk));
    ctx.fillStyle = gradient; ctx.fill();
    ctx.strokeStyle = mix([82, 115, 54], [40, 63, 40], current.dusk); ctx.lineWidth = Math.max(1.2, scale * 0.025); ctx.stroke();
    ctx.save(); path(edge); ctx.clip();
    for (const dot of groundDots) {
      const p = project(dot.x, 0.015, dot.z);
      ctx.fillStyle = dot.tone > 0.55 ? `rgba(181,199,108,${0.18 * (1 - current.dusk * 0.65)})` : 'rgba(22,53,29,0.18)';
      ctx.fillRect(p.x, p.y, Math.max(0.5, dot.size * p.s), Math.max(0.4, dot.size * p.s * 0.45));
    }
    if (current.dusk > 0.005) paintLightPool();
    ctx.restore();
  }
  function paintLightPool() {
    const p = project(2.22, 0.02, 0.95), px = project(3.25, 0.02, 0.95), pz = project(2.22, 0.02, 1.98);
    ctx.save();
    ctx.transform(px.x - p.x, px.y - p.y, pz.x - p.x, pz.y - p.y, p.x, p.y);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, `rgba(255,205,112,${current.dusk * 0.53})`);
    g.addColorStop(0.3, `rgba(255,185,82,${current.dusk * 0.24})`);
    g.addColorStop(1, 'rgba(255,180,71,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function roundedStone(stone, y) {
    const result = [];
    const r = 0.075;
    const corners = [[stone.w / 2 - r, stone.d / 2 - r, 0], [-stone.w / 2 + r, stone.d / 2 - r, Math.PI / 2], [-stone.w / 2 + r, -stone.d / 2 + r, Math.PI], [stone.w / 2 - r, -stone.d / 2 + r, Math.PI * 1.5]];
    for (const [x, z, angle] of corners) {
      for (let j = 0; j <= 4; j++) {
        const a = angle + j / 4 * Math.PI / 2;
        const localX = x + Math.cos(a) * r, localZ = z + Math.sin(a) * r;
        result.push(project(stone.x + localX * Math.cos(stone.a) + localZ * Math.sin(stone.a), y, stone.z - localX * Math.sin(stone.a) + localZ * Math.cos(stone.a)));
      }
    }
    return result;
  }
  function paintStone(stone) {
    const top = roundedStone(stone, 0.09), bottom = roundedStone(stone, 0.018);
    for (let i = 0; i < top.length; i++) {
      const j = (i + 1) % top.length;
      path([top[i], top[j], bottom[j], bottom[i]]); ctx.fillStyle = mix([139, 136, 120], [74, 81, 73], current.dusk); ctx.fill();
    }
    path(top);
    const p = project(stone.x, 0.09, stone.z);
    const g = ctx.createLinearGradient(p.x - p.s * 0.4, p.y - p.s * 0.3, p.x + p.s * 0.4, p.y + p.s * 0.3);
    g.addColorStop(0, mix([222, 220, 204], [153, 160, 146], current.dusk));
    g.addColorStop(1, mix([182, 184, 165], [104, 121, 109], current.dusk));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = `rgba(241,237,215,${0.36 * (1 - current.dusk)})`; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.save(); path(top); ctx.clip();
    ctx.fillStyle = 'rgba(62,71,54,0.12)';
    for (let i = 0; i < 22; i++) {
      const dx = Math.sin(i * 7.13 + stone.x) * stone.w * 0.4;
      const dz = Math.cos(i * 3.83 + stone.z) * stone.d * 0.4;
      const q = project(stone.x + dx, 0.094, stone.z + dz);
      ctx.fillRect(q.x, q.y, 0.7, 0.7);
    }
    ctx.restore();
  }
  function foliageSprite(tone) {
    const duskLevel = Math.round(current.dusk * 12);
    const key = `${tone}:${duskLevel}`;
    if (leafSprites.has(key)) return leafSprites.get(key);
    const sprite = document.createElement('canvas'); sprite.width = sprite.height = 64;
    const c = sprite.getContext('2d');
    const palettes = [[55, 92, 49], [67, 105, 54], [79, 117, 62], [46, 80, 44]];
    const base = palettes[tone];
    const dusk = duskLevel / 12;
    const gradient = c.createRadialGradient(23, 18, 2, 32, 32, 30);
    gradient.addColorStop(0, mix(base.map((v) => Math.min(255, v * 1.45)), [67, 89, 65], dusk));
    gradient.addColorStop(0.6, mix(base, [35, 60, 43], dusk));
    gradient.addColorStop(1, mix(base.map((v) => v * 0.7), [20, 39, 29], dusk));
    c.fillStyle = gradient;
    c.beginPath();
    c.moveTo(32, 4); c.bezierCurveTo(48, 3, 49, 12, 56, 22); c.bezierCurveTo(65, 37, 53, 54, 41, 58); c.bezierCurveTo(20, 66, 4, 52, 6, 33); c.bezierCurveTo(1, 19, 14, 5, 32, 4); c.fill();
    c.fillStyle = `rgba(186,203,134,${0.18 * (1 - dusk * 0.6)})`;
    for (let i = 0; i < 6; i++) {
      c.beginPath(); c.ellipse(17 + (i % 3) * 12, 16 + Math.floor(i / 3) * 14, 3.1, 6.1, i * 0.7, 0, Math.PI * 2); c.fill();
    }
    leafSprites.set(key, sprite); return sprite;
  }
  function paintLeafCluster(leaf) {
    const p = project(leaf.x, leaf.y * current.growth, leaf.z);
    const r = leaf.r * p.s * (0.95 + (current.growth - 1) * 0.6);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(leaf.angle);
    ctx.drawImage(foliageSprite(leaf.tone), -r, -r, r * 2, r * 2); ctx.restore();
  }
  function paintGrass(blade) {
    const p = project(blade.x, 0.012, blade.z);
    const sway = motion ? Math.sin(elapsed * 1.2 + blade.x * 3 + blade.z * 5) * 0.009 : 0;
    ctx.strokeStyle = blade.tone > 0.54 ? mix([137, 163, 85], [69, 97, 62], current.dusk) : mix([44, 83, 40], [26, 56, 39], current.dusk);
    ctx.lineWidth = Math.max(0.6, p.s * 0.01);
    ctx.lineCap = 'round'; ctx.beginPath();
    for (let i = -1; i <= 1; i++) {
      const q = project(blade.x + blade.lean * i + sway, blade.h * (i === 0 ? 1.15 : 0.8), blade.z + i * 0.02);
      ctx.moveTo(p.x + i * 0.4, p.y); ctx.quadraticCurveTo(p.x + i * 1.3, q.y + (p.y - q.y) * 0.4, q.x, q.y);
    }
    ctx.stroke();
  }
  function paintOrnamental() {
    const base = project(1.26, 0.015, 1.44);
    for (let i = 0; i < 34; i++) {
      const a = i * 2.39996, reach = 0.13 + (i % 5) * 0.036;
      const end = project(1.26 + Math.cos(a) * reach, 0.4 + (i % 7) * 0.036, 1.44 + Math.sin(a) * reach);
      const middle = project(1.26 + Math.cos(a) * reach * 0.2, 0.33, 1.44 + Math.sin(a) * reach * 0.2);
      ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.quadraticCurveTo(middle.x, middle.y, end.x, end.y);
      ctx.strokeStyle = i % 3 ? mix([123, 141, 78], [63, 86, 59], current.dusk) : mix([174, 181, 111], [94, 109, 75], current.dusk);
      ctx.lineWidth = Math.max(0.7, scale * 0.014); ctx.stroke();
    }
  }
  function cylinder(x, z, bottomY, topY, radius, topColor, bodyColor) {
    const top = circlePoints(x, topY, z, radius), bottom = circlePoints(x, bottomY, z, radius);
    const faces = top.map((point, i) => {
      const j = (i + 1) % top.length;
      return { points: [point, top[j], bottom[j], bottom[i]], depth: (point.depth + top[j].depth) * 0.5 };
    }).sort((a, b) => a.depth - b.depth);
    ctx.fillStyle = bodyColor;
    for (const face of faces) { path(face.points); ctx.fill(); }
    path(top); ctx.fillStyle = topColor; ctx.fill();
  }
  function paintSprinkler() {
    cylinder(-0.55, 1.3, 0.01, 0.045, 0.135, '#344736', '#233126');
    cylinder(-0.55, 1.3, 0.035, 0.23, 0.055, '#4e6255', '#26332c');
    cylinder(-0.55, 1.3, 0.225, 0.26, 0.087, '#5a7753', '#233629');
    const p = project(-0.55, 0.265, 1.3); ctx.fillStyle = '#b6c0a4'; ctx.fillRect(p.x - 0.7, p.y - 0.5, 1.4, 1);
  }
  function paintLamp() {
    const base = project(2.34, 0.03, 0.94), top = project(2.34, 0.92, 0.94);
    cylinder(2.34, 0.94, 0.015, 0.043, 0.09, '#37413b', '#1d2821');
    ctx.strokeStyle = '#222d27'; ctx.lineWidth = Math.max(2.2, top.s * 0.056); ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(139,157,139,0.38)'; ctx.lineWidth = Math.max(0.6, top.s * 0.009);
    ctx.beginPath(); ctx.moveTo(base.x - 1, base.y); ctx.lineTo(top.x - 1, top.y); ctx.stroke();
    const glow = project(2.34, 0.87, 0.94);
    if (current.dusk > 0.01) {
      const halo = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, top.s * 0.45);
      halo.addColorStop(0, `rgba(255,205,125,${0.22 * current.dusk})`); halo.addColorStop(1, 'rgba(255,192,96,0)');
      ctx.fillStyle = halo; ctx.fillRect(glow.x - top.s * 0.45, glow.y - top.s * 0.45, top.s * 0.9, top.s * 0.9);
    }
    cylinder(2.34, 0.94, 0.852, 0.888, 0.112, mix([224, 222, 193], [255, 228, 174], current.dusk), mix([195, 198, 169], [255, 209, 126], current.dusk));
    cylinder(2.34, 0.94, 0.894, 0.945, 0.16, '#38423a', '#202b24');
  }
  function waterPoint(line, t) {
    const angle = -Math.PI / 2 + (line - 3.5) * 0.17;
    const distance = 1.95 + (line % 3) * 0.1;
    return { x: -0.55 + Math.cos(angle) * distance * t, z: 1.3 + Math.sin(angle) * distance * t, y: 0.267 * (1 - t) + 0.035 * t + Math.sin(t * Math.PI) * (0.78 + (line % 3) * 0.04) };
  }
  function addWater() {
    if (current.water < 0.025) return;
    for (let line = 0; line < 8; line++) {
      for (let segment = 0; segment < 21; segment++) {
        const a = waterPoint(line, segment / 21), b = waterPoint(line, (segment + 1) / 21);
        enqueue((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, () => {
          const p = project(a.x, a.y, a.z), q = project(b.x, b.y, b.z);
          ctx.strokeStyle = `rgba(158,201,206,${current.water * 0.43})`; ctx.lineWidth = Math.max(0.6, scale * 0.009);
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        });
      }
    }
    for (const drop of spray) {
      const p3 = waterPoint(drop.line, (drop.phase + (motion ? elapsed * 0.42 : 0)) % 1);
      enqueue(p3.x, p3.y, p3.z, () => {
        const p = project(p3.x, p3.y, p3.z);
        ctx.fillStyle = `rgba(203,231,228,${current.water * 0.85})`;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, Math.max(0.7, drop.size * p.s * 0.62), Math.max(1, drop.size * p.s), -0.25, 0, Math.PI * 2); ctx.fill();
      });
    }
  }
  function paintAccentDrop() {
    if (current.water < 0.05) return;
    const p = project(-3.02, 1.47 + (motion ? Math.sin(elapsed * 0.85 + 1.4) * 0.08 : 0), 0.76);
    const s = p.s * 0.72;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-0.23); ctx.globalAlpha = Math.min(1, current.water + 0.15);
    const g = ctx.createLinearGradient(-s * 0.18, -s * 0.5, s * 0.24, s * 0.34);
    g.addColorStop(0, '#b4d4ce'); g.addColorStop(0.38, '#83b4b0'); g.addColorStop(0.77, '#407f85'); g.addColorStop(1, '#326775');
    ctx.beginPath(); ctx.moveTo(0, -s * 0.58); ctx.bezierCurveTo(s * 0.12, -s * 0.22, s * 0.28, -s * 0.05, s * 0.25, s * 0.15); ctx.bezierCurveTo(s * 0.23, s * 0.47, -s * 0.23, s * 0.47, -s * 0.25, s * 0.15); ctx.bezierCurveTo(-s * 0.28, -s * 0.05, -s * 0.12, -s * 0.22, 0, -s * 0.58); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(239,253,246,0.64)'; ctx.lineWidth = Math.max(1, s * 0.024); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-s * 0.12, -s * 0.05); ctx.quadraticCurveTo(-s * 0.19, s * 0.11, -s * 0.12, s * 0.21); ctx.stroke(); ctx.restore();
  }
  function paintAccentLeaf() {
    const p = project(2.82, 1.55 + (motion ? Math.sin(elapsed * 0.72 + 2.8) * 0.075 : 0), -0.27);
    const s = p.s * 0.84;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(0.55 + (motion ? Math.sin(elapsed * 0.35) * 0.06 : 0));
    const g = ctx.createLinearGradient(-s * 0.2, -s * 0.3, s * 0.25, s * 0.2);
    g.addColorStop(0, mix([128, 157, 90], [71, 103, 64], current.dusk)); g.addColorStop(0.5, mix([73, 114, 57], [44, 76, 48], current.dusk)); g.addColorStop(1, mix([36, 77, 40], [29, 57, 40], current.dusk));
    ctx.beginPath(); ctx.moveTo(0, -s * 0.55); ctx.bezierCurveTo(s * 0.36, -s * 0.22, s * 0.29, s * 0.23, 0, s * 0.48); ctx.bezierCurveTo(-s * 0.3, s * 0.2, -s * 0.28, -s * 0.22, 0, -s * 0.55); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = mix([169, 185, 114], [103, 129, 82], current.dusk); ctx.lineWidth = Math.max(0.7, s * 0.014); ctx.beginPath(); ctx.moveTo(0, s * 0.48); ctx.quadraticCurveTo(s * 0.025, 0, 0, -s * 0.49); ctx.stroke();
    ctx.globalAlpha = 0.3; ctx.lineWidth *= 0.7;
    for (let i = 0; i < 5; i++) { const y = (-0.3 + i * 0.14) * s; ctx.beginPath(); ctx.moveTo(0, y + s * 0.04); ctx.lineTo(s * 0.15, y - s * 0.09); ctx.moveTo(0, y + s * 0.04); ctx.lineTo(-s * 0.15, y - s * 0.09); ctx.stroke(); }
    ctx.restore();
  }
  function paint() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    rotationCos = Math.cos(0.55 + current.rotation); rotationSin = Math.sin(0.55 + current.rotation);
    floatY = 0.14 + (motion ? Math.sin(elapsed * 0.65) * 0.034 : 0);
    paintShadow(); paintEarth(); paintLawn();
    drawQueue.length = 0;
    for (const stone of stones) enqueue(stone.x, 0.045, stone.z, () => paintStone(stone));
    for (const blade of grass) enqueue(blade.x, blade.h * 0.35, blade.z, () => paintGrass(blade));
    // The under-canopy shadows anchor the small leaves into distinct shrubs.
    for (const shrub of shrubs) {
      enqueue(shrub.x, 0.025, shrub.z, () => {
        path(circlePoints(shrub.x, 0.025, shrub.z, shrub.r * 0.78)); ctx.fillStyle = 'rgba(18,43,25,0.3)'; ctx.fill();
      }, -0.08);
    }
    for (const leaf of foliage) enqueue(leaf.x, leaf.y * current.growth, leaf.z, () => paintLeafCluster(leaf));
    enqueue(1.26, 0.24, 1.44, paintOrnamental);
    enqueue(-0.55, 0.15, 1.3, paintSprinkler);
    enqueue(2.34, 0.49, 0.94, paintLamp);
    enqueue(-3.02, 1.47, 0.76, paintAccentDrop);
    enqueue(2.82, 1.55, -0.27, paintAccentLeaf);
    addWater();
    drawQueue.sort((a, b) => a.depth - b.depth);
    for (const item of drawQueue) item.paint();
  }
  function resize() {
    if (disposed) return;
    const rect = container.getBoundingClientRect();
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    dpr = Math.min(devicePixelRatio || 1, innerWidth < 760 ? 1.5 : 1.8);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    scale = Math.min(width / 8.8, height / 5.9) * 1.08;
    dirty = true;
  }
  function setState(next = {}) {
    if (disposed) return;
    if (Object.prototype.hasOwnProperty.call(modes, next.mode)) { state.mode = next.mode; container.dataset.sceneMode = next.mode; }
    if (Number.isFinite(next.rotation)) state.rotation = next.rotation;
    if (Number.isFinite(next.visibility)) state.visibility = Math.max(0, Math.min(1, next.visibility));
    dirty = true;
  }
  function setMotion(enabled) { requestedMotion = Boolean(enabled); motion = requestedMotion && !motionQuery.matches; dirty = true; }
  function motionChanged() { motion = requestedMotion && !motionQuery.matches; dirty = true; }
  function frame(now) {
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const mode = modes[state.mode];
    const t = motion ? 1 - Math.exp(-dt * 5.5) : 1;
    const desired = { rotation: state.rotation, visibility: state.visibility, dusk: mode.dusk, water: mode.water, growth: mode.growth };
    let moving = false;
    for (const key of Object.keys(current)) { current[key] += (desired[key] - current[key]) * t; if (Math.abs(desired[key] - current[key]) > 0.001) moving = true; }
    if (motion && current.visibility > 0.005) elapsed += dt;
    canvas.style.opacity = String(current.visibility);
    if (current.visibility > 0.001 && (dirty || moving || motion)) { paint(); dirty = false; }
    raf = requestAnimationFrame(frame);
  }
  const observer = new ResizeObserver(resize); observer.observe(container);
  addEventListener('resize', resize, { passive: true }); motionQuery.addEventListener('change', motionChanged);
  function dispose() {
    if (disposed) return; disposed = true; cancelAnimationFrame(raf); observer.disconnect();
    removeEventListener('resize', resize); motionQuery.removeEventListener('change', motionChanged);
    leafSprites.clear(); canvas.remove(); container.dataset.ready = 'false';
    if (window.gardenScene === api) delete window.gardenScene;
  }
  const api = { setState, setMotion, dispose };
  window.gardenScene = api;
  resize(); paint();
  container.dataset.ready = 'true'; container.dataset.error = 'false'; container.dataset.renderer = 'canvas2d'; container.dataset.sceneMode = 'intro';
  dispatchEvent(new CustomEvent('garden-ready', { detail: api }));
  raf = requestAnimationFrame(frame);
}

function seeded(seed) {
  let n = seed >>> 0;
  return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
}
function color(rgb, factor = 1) { return `rgb(${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v * factor)))).join(',')})`; }
function mix(a, b, t) { return color(a.map((v, i) => v + (b[i] - v) * t)); }
