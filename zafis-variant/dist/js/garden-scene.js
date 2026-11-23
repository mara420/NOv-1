/**
 * Zafis — a garden in balance.
 * Original procedural geometry and rendering for this Zafis variant.
 * Conceptually adapted from NOv-1 / app/components/TScene.vue (Prismic,
 * Copyright 2013–2025, Apache-2.0): one persistent floating scene, scroll-led
 * rotation, chapter-led changes and gentle motion. The film models, textures,
 * commerce integration and original component implementation are not copied.
 * Modified concept: a living garden section with water, planting and light.
 */
import * as THREE from './vendor/three.module.js';

const stage = document.getElementById('scene-stage');

if (stage) {
  try {
    createGarden(stage);
  } catch (error) {
    stage.dataset.error = 'true';
    stage.dataset.ready = 'false';
    import('./garden-fallback.js').catch(() => {
      window.dispatchEvent(new CustomEvent('garden-error', {
        detail: { message: error instanceof Error ? error.message : 'WebGL unavailable' },
      }));
    });
  }
}

function createGarden(container) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'high-performance' });
  if (!context) throw new Error('WebGL2 unavailable; switching to Canvas2D garden');
  const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none;';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 70);
  const target = new THREE.Vector3(0, 0.42, 0);
  const viewDirection = new THREE.Vector3(7.7, 7.3, 9.8).normalize();
  const root = new THREE.Group();
  scene.add(root);

  const random = seededRandom(43017);
  const textures = new Set();
  const geometries = new Set();
  const materials = new Set();
  const registerGeometry = (geometry) => { geometries.add(geometry); return geometry; };
  const registerMaterial = (material) => { materials.add(material); return material; };
  const makeMesh = (geometry, material, parent = root) => {
    registerGeometry(geometry);
    registerMaterial(material);
    const mesh = new THREE.Mesh(geometry, material);
    parent.add(mesh);
    return mesh;
  };

  function makeTexture(draw, size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    draw(ctx, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    textures.add(texture);
    return texture;
  }

  const turfTexture = makeTexture((ctx, size) => {
    ctx.fillStyle = '#476b32';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 46000; i++) {
      const x = random() * size;
      const y = random() * size;
      const light = random();
      ctx.strokeStyle = light > 0.53 ? `rgba(132,157,73,${0.08 + random() * 0.24})` : `rgba(16,49,22,${0.08 + random() * 0.3})`;
      ctx.lineWidth = 0.6 + random();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (random() - 0.5) * 5, y - 2 - random() * 7);
      ctx.stroke();
    }
  }, 1024);
  const stoneTexture = makeTexture((ctx, size) => {
    ctx.fillStyle = '#c2bfb2';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 11000; i++) {
      const a = 0.025 + random() * 0.09;
      ctx.fillStyle = random() > 0.55 ? `rgba(255,255,244,${a})` : `rgba(67,65,56,${a})`;
      ctx.fillRect(random() * size, random() * size, 0.5 + random() * 3, 0.5 + random() * 3);
    }
  });
  const soilTexture = makeTexture((ctx, size) => {
    ctx.fillStyle = '#b6a48a';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 13000; i++) {
      ctx.fillStyle = random() > 0.5 ? `rgba(188,149,93,${random() * 0.21})` : `rgba(18,14,12,${random() * 0.34})`;
      ctx.beginPath();
      ctx.ellipse(random() * size, random() * size, 0.5 + random() * 3.8, 0.5 + random() * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 95; i++) {
      const x = random() * size;
      ctx.strokeStyle = `rgba(208,179,120,${0.1 + random() * 0.2})`;
      ctx.lineWidth = 0.45 + random() * 0.65;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x - 12, size * 0.1, x + 22, size * 0.13, x + (random() - 0.5) * 50, size * (0.2 + random() * 0.55));
      ctx.stroke();
    }
  });

  // A rounded, slightly irregular section of earth, rather than a rectilinear box.
  const islandWidth = 6.8;
  const islandDepth = 4.55;
  const perimeter = 128;
  const exponent = 3.5;
  function contour(angle, scale = 1) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const variation = 1 + 0.009 * Math.sin(angle * 3 + 0.7) + 0.006 * Math.cos(angle * 7);
    return [
      Math.sign(c) * Math.pow(Math.abs(c), 2 / exponent) * islandWidth * 0.5 * scale * variation,
      Math.sign(s) * Math.pow(Math.abs(s), 2 / exponent) * islandDepth * 0.5 * scale * variation,
    ];
  }
  function insideIsland(x, z, margin = 0.94) {
    return Math.pow(Math.abs(x) / (islandWidth * 0.5), exponent) + Math.pow(Math.abs(z) / (islandDepth * 0.5), exponent) < margin;
  }
  function makeEarthGeometry() {
    const rings = [
      { y: -0.56, scale: 0.954, color: '#2e251c' },
      { y: -0.51, scale: 0.986, color: '#42301f' },
      { y: -0.29, scale: 0.998, color: '#523c28' },
      { y: -0.22, scale: 1.001, color: '#635037' },
      { y: -0.09, scale: 1.0, color: '#3c3020' },
      { y: -0.015, scale: 0.996, color: '#304224' },
    ];
    const positions = [], uv = [], colors = [], indices = [];
    rings.forEach((ring, row) => {
      const color = new THREE.Color(ring.color);
      for (let i = 0; i <= perimeter; i++) {
        const angle = i / perimeter * Math.PI * 2;
        const [x, z] = contour(angle, ring.scale);
        const irregularity = row === rings.length - 1 ? 0 : Math.sin(angle * 11 + row * 1.8) * 0.012;
        positions.push(x, ring.y + irregularity, z);
        uv.push(i / perimeter * 5, 1 - row / (rings.length - 1));
        colors.push(color.r * 1.5, color.g * 1.5, color.b * 1.5);
      }
    });
    for (let row = 0; row < rings.length - 1; row++) {
      for (let i = 0; i < perimeter; i++) {
        const a = row * (perimeter + 1) + i;
        const b = a + perimeter + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
  if (soilTexture) soilTexture.wrapS = soilTexture.wrapT = THREE.RepeatWrapping;
  const earth = makeMesh(makeEarthGeometry(), new THREE.MeshStandardMaterial({
    color: 0xffffff, map: soilTexture, vertexColors: true, roughness: 1, side: THREE.DoubleSide,
  }));
  earth.castShadow = true;
  earth.receiveShadow = true;

  const topPositions = [0, 0, 0];
  const topUV = [0.5, 0.5];
  const topIndices = [];
  for (let i = 0; i <= perimeter; i++) {
    const [x, z] = contour(i / perimeter * Math.PI * 2, 0.996);
    topPositions.push(x, 0, z);
    topUV.push(x / islandWidth + 0.5, z / islandDepth + 0.5);
    if (i < perimeter) topIndices.push(0, i + 2, i + 1);
  }
  const topGeometry = new THREE.BufferGeometry();
  topGeometry.setAttribute('position', new THREE.Float32BufferAttribute(topPositions, 3));
  topGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(topUV, 2));
  topGeometry.setIndex(topIndices);
  topGeometry.computeVertexNormals();
  const lawn = makeMesh(topGeometry, new THREE.MeshStandardMaterial({ map: turfTexture, color: 0xa6b783, roughness: 0.97 }));
  lawn.receiveShadow = true;
  lawn.castShadow = true;

  // Pale limestone stepping stones, with softly eased edges and varied alignment.
  const stones = [
    { x: -2.0, z: 1.3, w: 0.9, d: 0.61, a: -0.08 },
    { x: -1.13, z: 0.78, w: 0.9, d: 0.64, a: 0.035 },
    { x: -0.23, z: 0.23, w: 0.92, d: 0.65, a: -0.065 },
    { x: 0.68, z: -0.32, w: 0.9, d: 0.62, a: 0.04 },
    { x: 1.56, z: -0.87, w: 0.86, d: 0.62, a: -0.07 },
  ];
  const stoneMaterial = registerMaterial(new THREE.MeshStandardMaterial({ color: 0xdfdac9, map: stoneTexture, roughness: 0.82 }));
  function roundedShape(w, h, r) {
    const shape = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + h - r);
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shape.lineTo(x + r, y + h);
    shape.quadraticCurveTo(x, y + h, x, y + h - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
    return shape;
  }
  for (const stone of stones) {
    const geometry = new THREE.ExtrudeGeometry(roundedShape(stone.w, stone.d, 0.075), {
      depth: 0.065, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.023, bevelSegments: 3, steps: 1, curveSegments: 8,
    });
    geometry.rotateX(-Math.PI / 2);
    const mesh = makeMesh(geometry, stoneMaterial);
    mesh.position.set(stone.x, 0.035, stone.z);
    mesh.rotation.y = stone.a;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  function onPath(x, z) {
    return stones.some((stone) => {
      const dx = x - stone.x, dz = z - stone.z;
      const localX = dx * Math.cos(stone.a) - dz * Math.sin(stone.a);
      const localZ = dx * Math.sin(stone.a) + dz * Math.cos(stone.a);
      return Math.abs(localX) < stone.w / 2 + 0.075 && Math.abs(localZ) < stone.d / 2 + 0.075;
    });
  }

  const shrubSpecs = [
    { x: -2.25, z: -0.9, r: 0.58, h: 0.66, leaves: 420 },
    { x: -0.86, z: -1.54, r: 0.39, h: 0.43, leaves: 250 },
    { x: 2.54, z: -0.86, r: 0.47, h: 0.53, leaves: 350 },
  ];
  function inPlant(x, z) {
    return shrubSpecs.some((plant) => Math.hypot(x - plant.x, z - plant.z) < plant.r * 0.86);
  }

  // Thousands of crossed, curved grass blades share one geometry and draw call.
  function makeTuftGeometry() {
    const positions = [], colors = [], indices = [];
    for (let blade = 0; blade < 5; blade++) {
      const angle = blade * Math.PI * 0.4 + 0.21;
      const height = 0.095 + (blade % 3) * 0.029;
      const bend = 0.04 + (blade % 2) * 0.025;
      const base = positions.length / 3;
      for (let row = 0; row < 5; row++) {
        const t = row / 4;
        const width = (1 - t) * 0.014 + 0.0004;
        const centerX = Math.sin(angle) * (t * t * bend + blade * 0.003);
        const centerZ = Math.cos(angle) * (t * t * bend + blade * 0.003);
        for (const side of [-1, 1]) {
          positions.push(centerX + Math.cos(angle) * width * side, t * height, centerZ - Math.sin(angle) * width * side);
          const shade = 0.46 + t * 0.54;
          colors.push(shade, shade, shade * 0.83);
        }
        if (row < 4) {
          const a = base + row * 2;
          indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
  const grassCount = 3400;
  const grassGeometry = registerGeometry(makeTuftGeometry());
  const grassMaterial = registerMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, roughness: 0.95 }));
  const grass = new THREE.InstancedMesh(grassGeometry, grassMaterial, grassCount);
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  let grassIndex = 0;
  while (grassIndex < grassCount) {
    const x = (random() - 0.5) * islandWidth;
    const z = (random() - 0.5) * islandDepth;
    if (!insideIsland(x, z) || onPath(x, z) || inPlant(x, z)) continue;
    dummy.position.set(x, 0.008, z);
    dummy.rotation.set(0, random() * Math.PI * 2, 0);
    const scale = 0.72 + random() * 0.63;
    dummy.scale.set(scale, 0.64 + random() * 0.8, scale);
    dummy.updateMatrix();
    grass.setMatrixAt(grassIndex, dummy.matrix);
    tint.setHSL(0.235 + random() * 0.045, 0.35 + random() * 0.2, 0.29 + random() * 0.13);
    grass.setColorAt(grassIndex, tint);
    grassIndex++;
  }
  grass.receiveShadow = true;
  root.add(grass);

  function leafGeometry(width = 0.3, length = 1, bend = 0.14) {
    const positions = [], uv = [], indices = [];
    const steps = 9;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const half = Math.pow(Math.sin(t * Math.PI), 0.8) * width * 0.5;
      const curve = Math.sin(t * Math.PI * 0.9) * bend;
      positions.push(-half, t * length, curve, 0, t * length, curve + half * 0.18, half, t * length, curve);
      uv.push(0, t, 0.5, t, 1, t);
      if (i < steps) {
        const a = i * 3;
        indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
  const foliageGeometry = registerGeometry(leafGeometry(0.076, 0.19, 0.032));
  const foliageMaterial = registerMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.7 }));
  const leafCount = shrubSpecs.reduce((sum, plant) => sum + plant.leaves, 0);
  const foliage = new THREE.InstancedMesh(foliageGeometry, foliageMaterial, leafCount);
  const leafDirection = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let leafIndex = 0;
  for (const plant of shrubSpecs) {
    const core = makeMesh(new THREE.SphereGeometry(1, 12, 9), new THREE.MeshStandardMaterial({ color: 0x244429, roughness: 1 }));
    core.position.set(plant.x, plant.h * 0.48, plant.z);
    core.scale.set(plant.r * 0.7, plant.h * 0.43, plant.r * 0.7);
    core.castShadow = core.receiveShadow = true;
    for (let i = 0; i < plant.leaves; i++) {
      const theta = random() * Math.PI * 2;
      const cosPhi = random() * 1.72 - 0.72;
      const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
      const ring = 0.8 + random() * 0.22;
      const nx = sinPhi * Math.cos(theta), nz = sinPhi * Math.sin(theta);
      dummy.position.set(plant.x + nx * plant.r * ring, plant.h * 0.48 + cosPhi * plant.h * 0.48 * ring, plant.z + nz * plant.r * ring);
      leafDirection.set(nx * 0.7, 0.45 + cosPhi * 0.45, nz * 0.7).normalize();
      dummy.quaternion.setFromUnitVectors(up, leafDirection);
      dummy.rotateY(random() * Math.PI * 2);
      const scale = 0.7 + random() * 0.75;
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      foliage.setMatrixAt(leafIndex, dummy.matrix);
      tint.setHSL(0.27 + random() * 0.055, 0.27 + random() * 0.17, 0.16 + random() * 0.16);
      foliage.setColorAt(leafIndex, tint);
      leafIndex++;
    }
  }
  foliage.castShadow = foliage.receiveShadow = true;
  root.add(foliage);

  // A small airy tuft gives the planting a different silhouette.
  const ornamentalMaterial = registerMaterial(new THREE.MeshStandardMaterial({ color: 0x788a4d, roughness: 0.9, side: THREE.DoubleSide }));
  const ornamental = new THREE.InstancedMesh(registerGeometry(leafGeometry(0.024, 0.63, 0.15)), ornamentalMaterial, 58);
  for (let i = 0; i < 58; i++) {
    const a = random() * Math.PI * 2;
    dummy.position.set(1.28 + Math.cos(a) * random() * 0.16, 0.015, 1.46 + Math.sin(a) * random() * 0.16);
    dummy.rotation.set((random() - 0.5) * 0.65, a, (random() - 0.5) * 0.65);
    dummy.scale.set(0.7 + random() * 0.6, 0.65 + random() * 0.55, 1);
    dummy.updateMatrix();
    ornamental.setMatrixAt(i, dummy.matrix);
  }
  ornamental.castShadow = true;
  root.add(ornamental);

  const metalMaterial = registerMaterial(new THREE.MeshStandardMaterial({ color: 0x202723, metalness: 0.64, roughness: 0.32 }));
  const rubberMaterial = registerMaterial(new THREE.MeshStandardMaterial({ color: 0x17231b, roughness: 0.9 }));
  const sprinkler = new THREE.Group();
  sprinkler.position.set(-0.56, 0.015, 1.33);
  root.add(sprinkler);
  const headBase = makeMesh(new THREE.CylinderGeometry(0.14, 0.145, 0.043, 28), rubberMaterial, sprinkler);
  headBase.position.y = 0.025;
  const headStem = makeMesh(new THREE.CylinderGeometry(0.067, 0.07, 0.19, 24), metalMaterial, sprinkler);
  headStem.position.y = 0.12;
  const headCap = makeMesh(new THREE.CylinderGeometry(0.09, 0.077, 0.038, 28), rubberMaterial, sprinkler);
  headCap.position.y = 0.225;
  const nozzle = makeMesh(new THREE.TorusGeometry(0.072, 0.009, 6, 24), new THREE.MeshStandardMaterial({ color: 0x597f49, metalness: 0.15, roughness: 0.58 }), sprinkler);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.y = 0.246;
  sprinkler.traverse((object) => { if (object.isMesh) object.castShadow = true; });

  const waterGroup = new THREE.Group();
  root.add(waterGroup);
  const waterMaterial = registerMaterial(new THREE.MeshPhysicalMaterial({ color: 0xaadce1, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.29, depthWrite: false, clearcoat: 1 }));
  const waterCurves = [];
  for (let i = 0; i < 9; i++) {
    const angle = -Math.PI / 2 + (i - 4) * 0.155;
    const reach = 1.9 + (i % 3) * 0.17;
    const start = new THREE.Vector3(-0.56, 0.267, 1.33);
    const end = new THREE.Vector3(start.x + Math.cos(angle) * reach, 0.045, start.z + Math.sin(angle) * reach);
    const mid = start.clone().lerp(end, 0.52);
    mid.y = 1.38 + (i % 3) * 0.08;
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    waterCurves.push(curve);
    makeMesh(new THREE.TubeGeometry(curve, 36, 0.0065, 4, false), waterMaterial, waterGroup);
  }
  const dropletMaterial = registerMaterial(new THREE.MeshStandardMaterial({ color: 0xb9e8ed, roughness: 0.13, metalness: 0.12, transparent: true, opacity: 0.82, emissive: 0x16474f, emissiveIntensity: 0.23 }));
  const sprayCount = 126;
  const spray = new THREE.InstancedMesh(registerGeometry(new THREE.SphereGeometry(1, 6, 4)), dropletMaterial, sprayCount);
  spray.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  waterGroup.add(spray);
  const sprayOffsets = Array.from({ length: sprayCount }, () => random());
  const sprayPoint = new THREE.Vector3();
  const sprayTangent = new THREE.Vector3();
  function updateSpray(time) {
    for (let i = 0; i < sprayCount; i++) {
      const curve = waterCurves[i % waterCurves.length];
      const t = (sprayOffsets[i] + time * 0.47) % 1;
      curve.getPoint(t, sprayPoint);
      curve.getTangent(t, sprayTangent);
      dummy.position.copy(sprayPoint);
      dummy.quaternion.setFromUnitVectors(up, sprayTangent);
      const scale = 0.012 + (i % 5) * 0.002;
      dummy.scale.set(scale, scale * 1.8, scale);
      dummy.updateMatrix();
      spray.setMatrixAt(i, dummy.matrix);
    }
    spray.instanceMatrix.needsUpdate = true;
  }
  updateSpray(0);

  // One restrained black bollard; the warm pool becomes a chapter change at dusk.
  const lamp = new THREE.Group();
  lamp.position.set(2.38, 0.035, 0.94);
  root.add(lamp);
  const lampFoot = makeMesh(new THREE.CylinderGeometry(0.095, 0.11, 0.033, 24), metalMaterial, lamp);
  lampFoot.position.y = 0.012;
  const lampStem = makeMesh(new THREE.CylinderGeometry(0.032, 0.04, 0.86, 20), metalMaterial, lamp);
  lampStem.position.y = 0.43;
  const lampCap = makeMesh(new THREE.CylinderGeometry(0.15, 0.16, 0.055, 32), metalMaterial, lamp);
  lampCap.position.y = 0.91;
  const lampGlowMaterial = registerMaterial(new THREE.MeshStandardMaterial({ color: 0xffecd0, emissive: 0xffbd6e, emissiveIntensity: 0.18, roughness: 0.3 }));
  const lampGlow = makeMesh(new THREE.CylinderGeometry(0.112, 0.112, 0.036, 28), lampGlowMaterial, lamp);
  lampGlow.position.y = 0.869;
  lamp.traverse((object) => { if (object.isMesh) object.castShadow = true; });
  const pointLight = new THREE.PointLight(0xffbd70, 0.08, 4.4, 2);
  pointLight.position.set(2.38, 0.86, 0.94);
  root.add(pointLight);
  const glowTexture = makeTexture((ctx, size) => {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,223,169,1)');
    gradient.addColorStop(0.3, 'rgba(255,191,101,0.5)');
    gradient.addColorStop(1, 'rgba(255,166,68,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }, 128);
  const poolMaterial = registerMaterial(new THREE.MeshBasicMaterial({ color: 0xffba64, map: glowTexture, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  const pool = makeMesh(new THREE.PlaneGeometry(1.75, 1.75), poolMaterial);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(2.25, 0.038, 0.95);

  // Two light secondary forms echo the floating paired objects of the source.
  const dropProfile = [
    [0, -0.38], [0.13, -0.37], [0.23, -0.27], [0.27, -0.1],
    [0.255, 0.07], [0.2, 0.23], [0.1, 0.43], [0, 0.65],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const accentDropMaterial = registerMaterial(new THREE.MeshPhysicalMaterial({ color: 0x72b4ba, roughness: 0.12, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, transparent: true, opacity: 0.8 }));
  const accentDrop = makeMesh(new THREE.LatheGeometry(dropProfile, 48), accentDropMaterial);
  accentDrop.position.set(-3.06, 1.4, 0.86);
  accentDrop.rotation.z = -0.24;
  accentDrop.scale.setScalar(0.72);
  accentDrop.castShadow = true;

  const accentLeafMaterial = registerMaterial(new THREE.MeshStandardMaterial({ color: 0x477544, side: THREE.DoubleSide, roughness: 0.43, metalness: 0.03 }));
  const accentLeaf = makeMesh(leafGeometry(0.36, 0.94, 0.16), accentLeafMaterial);
  accentLeaf.position.set(2.83, 1.16, -0.18);
  accentLeaf.rotation.set(0.45, -0.6, -0.55);
  accentLeaf.castShadow = true;
  const veinCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0.005), new THREE.Vector3(0, 0.53, 0.23), new THREE.Vector3(0, 0.94, 0.055));
  const vein = makeMesh(new THREE.TubeGeometry(veinCurve, 18, 0.004, 4, false), new THREE.MeshStandardMaterial({ color: 0x9daf6c, roughness: 0.8 }), accentLeaf);
  vein.position.z = 0.006;

  const hemisphere = new THREE.HemisphereLight(0xe4efdf, 0x756148, 2.15);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xfff2dc, 3.05);
  sun.position.set(-4.3, 8, 5.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -6;
  sun.shadow.camera.right = sun.shadow.camera.top = 6;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 25;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 4;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xe5f1fa, 1.2);
  rim.position.set(4.5, 4, -6);
  scene.add(rim);
  const shadowMaterial = registerMaterial(new THREE.ShadowMaterial({ opacity: 0.16, depthWrite: false }));
  const ground = makeMesh(new THREE.PlaneGeometry(24, 24), shadowMaterial, scene);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.94;
  ground.receiveShadow = true;

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let requestedMotion = true;
  let motionEnabled = !motionQuery.matches;
  let disposed = false;
  let dirty = true;
  let raf = 0;
  let lastTime = performance.now();
  let ambientTime = 0;
  const state = { mode: 'intro', rotation: 0, visibility: 1 };
  const current = { rotation: 0, visibility: 1, evening: 0, water: 0.6 };
  const modeOptions = {
    intro: { evening: 0, water: 0.6 },
    water: { evening: 0, water: 1 },
    life: { evening: 0, water: 0.04 },
    light: { evening: 1, water: 0 },
  };
  const daySun = new THREE.Color(0xfff2dc), duskSun = new THREE.Color(0xffc990);
  const daySky = new THREE.Color(0xe4efdf), duskSky = new THREE.Color(0x8ea6bd);
  const dayRim = new THREE.Color(0xe5f1fa), duskRim = new THREE.Color(0xc1d5ed);

  function setState(next = {}) {
    if (disposed) return;
    if (Object.prototype.hasOwnProperty.call(modeOptions, next.mode)) {
      state.mode = next.mode;
      container.dataset.sceneMode = next.mode;
    }
    if (Number.isFinite(next.rotation)) state.rotation = next.rotation;
    if (Number.isFinite(next.visibility)) state.visibility = THREE.MathUtils.clamp(next.visibility, 0, 1);
    dirty = true;
  }
  function setMotion(enabled) {
    requestedMotion = Boolean(enabled);
    motionEnabled = requestedMotion && !motionQuery.matches;
    dirty = true;
  }
  function onMotionChange() {
    motionEnabled = requestedMotion && !motionQuery.matches;
    dirty = true;
  }
  motionQuery.addEventListener('change', onMotionChange);

  function resize() {
    if (disposed) return;
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const mobile = window.innerWidth < 760;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.8));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const viewHeight = Math.max(mobile ? 6.5 : 6.8, 8.25 / camera.aspect);
    const distance = viewHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)));
    camera.position.copy(viewDirection).multiplyScalar(distance).add(target);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    dirty = true;
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  window.addEventListener('resize', resize, { passive: true });
  resize();

  function render(now) {
    if (disposed) return;
    const delta = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    const options = modeOptions[state.mode];
    const damping = motionEnabled ? 1 - Math.exp(-delta * 5.5) : 1;
    current.rotation = THREE.MathUtils.lerp(current.rotation, state.rotation, damping);
    current.visibility = THREE.MathUtils.lerp(current.visibility, state.visibility, damping);
    current.evening = THREE.MathUtils.lerp(current.evening, options.evening, damping);
    current.water = THREE.MathUtils.lerp(current.water, options.water, damping);
    const changing = Math.abs(current.rotation - state.rotation) + Math.abs(current.visibility - state.visibility)
      + Math.abs(current.evening - options.evening) + Math.abs(current.water - options.water) > 0.001;
    if (motionEnabled && current.visibility > 0.005) ambientTime += delta;
    if (dirty || changing || (motionEnabled && current.visibility > 0.005)) {
      root.rotation.y = -0.18 + current.rotation;
      root.position.y = 0.18 + (motionEnabled ? Math.sin(ambientTime * 0.68) * 0.038 : 0);
      accentDrop.position.y = 1.4 + (motionEnabled ? Math.sin(ambientTime * 0.85 + 1.5) * 0.095 : 0);
      accentDrop.rotation.y = motionEnabled ? Math.sin(ambientTime * 0.4) * 0.25 : 0;
      accentDropMaterial.opacity = 0.14 + current.water * 0.7;
      accentDrop.visible = current.water > 0.08;
      accentLeaf.position.y = 1.16 + (motionEnabled ? Math.sin(ambientTime * 0.72 + 2.8) * 0.075 : 0);
      accentLeaf.rotation.y = -0.6 + (motionEnabled ? Math.sin(ambientTime * 0.3) * 0.15 : 0);
      waterGroup.visible = current.water > 0.025;
      waterMaterial.opacity = 0.31 * current.water;
      dropletMaterial.opacity = 0.84 * current.water;
      if (waterGroup.visible) updateSpray(motionEnabled ? ambientTime : 0);
      const dusk = current.evening;
      sun.color.copy(daySun).lerp(duskSun, dusk);
      sun.intensity = THREE.MathUtils.lerp(3.05, 0.65, dusk);
      hemisphere.color.copy(daySky).lerp(duskSky, dusk);
      hemisphere.intensity = THREE.MathUtils.lerp(2.15, 0.74, dusk);
      rim.color.copy(dayRim).lerp(duskRim, dusk);
      rim.intensity = THREE.MathUtils.lerp(1.2, 0.82, dusk);
      lampGlowMaterial.emissiveIntensity = THREE.MathUtils.lerp(0.18, 3.3, dusk);
      pointLight.intensity = THREE.MathUtils.lerp(0.08, 15, dusk);
      poolMaterial.opacity = dusk * 0.4;
      shadowMaterial.opacity = THREE.MathUtils.lerp(0.16, 0.13, dusk);
      renderer.domElement.style.opacity = String(current.visibility);
      if (current.visibility > 0.001) renderer.render(scene, camera);
      dirty = false;
    }
    raf = requestAnimationFrame(render);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    window.removeEventListener('resize', resize);
    motionQuery.removeEventListener('change', onMotionChange);
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    sun.shadow.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    container.dataset.ready = 'false';
    if (window.gardenScene === api) delete window.gardenScene;
  }
  const api = { setState, setMotion, dispose };
  window.gardenScene = api;
  renderer.render(scene, camera);
  container.dataset.ready = 'true';
  container.dataset.sceneMode = 'intro';
  container.dataset.error = 'false';
  window.dispatchEvent(new CustomEvent('garden-ready', { detail: api }));
  raf = requestAnimationFrame(render);
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(1664525, value) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
