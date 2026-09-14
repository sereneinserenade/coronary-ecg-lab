import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  SEG_NAME, STAGES, SCENARIOS, RR, MM_PER_S, MM_PER_MV,
  beat, ahaSegment, leadState,
  ANT_GROOVE, POST_GROOVE, RV_T0, RV_TIP, APEX_DIR, heartBasis, LA_POS, RA_POS, LAA, RAA,
  LV_TOP, LV_LEN,
  lvRadius, lvWall, lvSurfY, shellMesh,
  lvPoint, lvEndoPoint, rvPoint, rvInnerPoint, heightSampler, sampledPoint,
} from './heart-data.js';


/* ------------------------------------------------------------------ *
 * 2. STATE
 * ------------------------------------------------------------------ */

const state = {
  scenario: SCENARIOS[0],
  stage: 2,
  showArteries: true,
  showVeins: false,
  showChambers: true,
  wallOpacity: 0.7,
  spin: true,
  geometry: 'scanned',      // or 'procedural'
};

const $ = (sel) => document.querySelector(sel);

/* ------------------------------------------------------------------ *
 * 3. ECG
 * ------------------------------------------------------------------ */


// One beat, in mV, for a lead whose morphology has already been modified.

const ECG_ROWS = [
  ['I', 'aVR', 'V1', 'V4'],
  ['II', 'aVL', 'V2', 'V5'],
  ['III', 'aVF', 'V3', 'V6'],
];

function drawECG() {
  const canvas = $('#ecg');
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth;
  if (!cssW) return;                    // laid out at zero width (hidden tab); nothing to draw
  const cssH = Math.round(cssW * 0.46);
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  canvas.style.height = cssH + 'px';
  const c = canvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);

  const dark = document.documentElement.dataset.theme === 'dark'
    || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  const paper = dark ? '#191313' : '#fff8f7';
  const fine = dark ? '#3a2626' : '#f6d3cf';
  const bold = dark ? '#5a3434' : '#eda9a2';
  const ink = dark ? '#f0efe9' : '#16110f';

  c.fillStyle = paper;
  c.fillRect(0, 0, cssW, cssH);

  // 1 large box = 0.2 s = 5 mm. Scale so 4 beats-worth of strip fits the width.
  const rows = 4; // 3 lead rows + rhythm strip
  const pad = 6;
  const rowH = (cssH - pad * 2) / rows;
  const pxPerMm = Math.min(rowH / 13, (cssW - pad * 2) / (4 * MM_PER_S * RR + 4));
  const pxPerS = pxPerMm * MM_PER_S;
  const pxPerMv = pxPerMm * MM_PER_MV;

  // Grid
  const small = pxPerMm;
  c.lineWidth = 1;
  for (let i = 0; i * small < cssW; i++) {
    c.strokeStyle = i % 5 === 0 ? bold : fine;
    c.beginPath(); c.moveTo(i * small + 0.5, 0); c.lineTo(i * small + 0.5, cssH); c.stroke();
  }
  for (let j = 0; j * small < cssH; j++) {
    c.strokeStyle = j % 5 === 0 ? bold : fine;
    c.beginPath(); c.moveTo(0, j * small + 0.5); c.lineTo(cssW, j * small + 0.5); c.stroke();
  }

  const colW = (cssW - pad * 2) / 4;
  const trace = (lead, x0, width, baseY) => {
    const { m, offset } = leadState(lead, state.scenario, STAGES[state.stage]);
    c.strokeStyle = ink;
    c.lineWidth = 1.6;
    c.lineJoin = 'round';
    c.beginPath();
    const steps = Math.max(80, Math.round(width));
    for (let i = 0; i <= steps; i++) {
      const x = x0 + (i / steps) * width;
      const tAbs = (i / steps) * (width / pxPerS);
      const tIn = tAbs % RR;
      const y = baseY - beat(tIn, m, offset) * pxPerMv;
      i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();

    c.fillStyle = ink;
    c.font = `600 ${Math.max(9, pxPerMm * 2.6)}px ui-sans-serif, system-ui, sans-serif`;
    c.fillText(lead, x0 + 3, baseY - rowH * 0.36);

    // Flag the abnormal leads.
    const sc = state.scenario;
    if (STAGES[state.stage].id !== 0) {
      if (sc.elevate.includes(lead)) { c.fillStyle = '#d13b2e'; c.fillText('↑ST', x0 + width - pxPerMm * 9, baseY - rowH * 0.36); }
      else if (sc.depress.includes(lead)) { c.fillStyle = '#2f6fd0'; c.fillText('↓ST', x0 + width - pxPerMm * 9, baseY - rowH * 0.36); }
    }
  };

  ECG_ROWS.forEach((row, r) => {
    const baseY = pad + rowH * (r + 0.62);
    row.forEach((lead, col) => trace(lead, pad + col * colW, colW - 4, baseY));
  });
  // Rhythm strip, lead II, full width.
  trace('II', pad, cssW - pad * 2 - 4, pad + rowH * 3.62);

  c.fillStyle = ink;
  c.globalAlpha = 0.55;
  c.font = `${Math.max(8, pxPerMm * 2.2)}px ui-sans-serif, system-ui, sans-serif`;
  c.fillText('25 mm/s   10 mm/mV   HR 75', pad + 2, cssH - 4);
  c.globalAlpha = 1;
}

/* ------------------------------------------------------------------ *
 * 4. BULLSEYE (AHA 17-segment polar plot)
 * ------------------------------------------------------------------ */

function polar(cx, cy, r, deg) {
  const a = (-deg) * Math.PI / 180;          // screen y is down; negate so anterior sits at the top
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function ringPath(cx, cy, rIn, rOut, a0, a1) {
  const [x1, y1] = polar(cx, cy, rOut, a0);
  const [x2, y2] = polar(cx, cy, rOut, a1);
  const [x3, y3] = polar(cx, cy, rIn, a1);
  const [x4, y4] = polar(cx, cy, rIn, a0);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M${x1} ${y1}A${rOut} ${rOut} 0 ${large} 0 ${x2} ${y2}L${x3} ${y3}A${rIn} ${rIn} 0 ${large} 1 ${x4} ${y4}Z`;
}

// [segment, innerR, outerR, startDeg, endDeg]
const BULLSEYE = (() => {
  const out = [];
  const basal = [[1, 60, 120], [2, 120, 180], [3, 180, 240], [4, 240, 300], [5, 300, 360], [6, 0, 60]];
  const mid = [[7, 60, 120], [8, 120, 180], [9, 180, 240], [10, 240, 300], [11, 300, 360], [12, 0, 60]];
  const apical = [[13, 45, 135], [14, 135, 225], [15, 225, 315], [16, -45, 45]];
  basal.forEach(([s, a, b]) => out.push([s, 76, 100, a, b]));
  mid.forEach(([s, a, b]) => out.push([s, 52, 76, a, b]));
  apical.forEach(([s, a, b]) => out.push([s, 26, 52, a, b]));
  return out;
})();

function buildBullseye() {
  const svg = $('#bullseye');
  if (!svg) return;
  const cx = 120, cy = 120;
  let html = '';
  for (const [seg, rIn, rOut, a0, a1] of BULLSEYE) {
    html += `<path class="bs-seg" data-seg="${seg}" d="${ringPath(cx, cy, rIn, rOut, a0, a1)}"><title>${seg}. ${SEG_NAME[seg]}</title></path>`;
  }
  html += `<circle class="bs-seg" data-seg="17" cx="${cx}" cy="${cy}" r="26"><title>17. apex</title></circle>`;
  const lbl = (x, y, t) => `<text class="bs-label" x="${x}" y="${y}">${t}</text>`;
  html += lbl(cx, 14, 'ANTERIOR') + lbl(cx, 236, 'INFERIOR')
        + `<text class="bs-label" x="12" y="${cy + 4}" text-anchor="start">SEPTAL</text>`
        + `<text class="bs-label" x="228" y="${cy + 4}" text-anchor="end">LATERAL</text>`;
  svg.innerHTML = html;
}

function paintBullseye() {
  const segs = new Set(state.scenario.segs);
  const stage = STAGES[state.stage];
  document.querySelectorAll('.bs-seg').forEach((el) => {
    const hit = segs.has(Number(el.dataset.seg)) && stage.id !== 0;
    el.style.fill = hit ? infarctColour(stage).getStyle() : '';
    el.classList.toggle('is-hit', hit);
  });
}

/* ------------------------------------------------------------------ *
 * 5. 3D HEART
 *
 * Built in a local "cardiac" frame: +x patient's left, +z anterior,
 * -y towards the apex, theta measured from +x (0 lateral, 90 anterior,
 * 180 septal, 270 inferior). The whole group is then rotated so the apex
 * points anteriorly, inferiorly and to the left, the way the heart
 * actually lies in the chest. Keeping the build frame axis-aligned means
 * the AHA segment maths stays simple.
 * ------------------------------------------------------------------ */

// Swapped when the scanned geometry is loaded, so the coronaries lie on whichever
// surface is showing without any other code needing to know which that is.
let surf = (thetaDeg, t, off = 0) => new THREE.Vector3(...lvPoint(thetaDeg, t, off));
let rvSurf = (thetaDeg, t, off = 0) => new THREE.Vector3(...rvPoint(thetaDeg, t, off));

const HEALTHY = new THREE.Color('#a8443f');

function infarctColour(stage) {
  switch (stage.id) {
    case 0: return HEALTHY.clone();
    case 1: return new THREE.Color('#a8443f');   // nothing visible yet
    case 2: return new THREE.Color('#9c4340');
    case 3: return new THREE.Color('#6d3540');   // dark mottling
    case 4: return new THREE.Color('#5d2f3c');
    case 5: return new THREE.Color('#b08a4a');   // yellow-tan
    case 6: return new THREE.Color('#d3b264');   // maximally yellow, soft
    case 7: return new THREE.Color('#9c8a76');   // red-grey granulation
    case 8: return new THREE.Color('#c3bdb0');   // grey-white scar
    default: return new THREE.Color('#ded9cf');  // dense white scar
  }
}

let renderer, scene, camera, controls, lvMesh, rvMesh, group;
const vessels = new Map();
let lesionMarker;
let chamberExtras = [];

/* --- generic thick shell over a (theta, t) patch --------------------- */

function buildShell(spec) {
  const { positions, thetas, ts, index } = shellMesh(spec);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(positions.length), 3));
  g.userData.theta = thetas;
  g.userData.t = ts;
  return g;
}

/* --- chambers -------------------------------------------------------- */

function buildLV() {
  // Stop a hair short of the epicardial apex so the mesh caps cleanly instead of
  // collapsing to a degenerate point; floor the cavity for the same reason.
  const g = buildShell({
    a0: 0, a1: 360, wrap: true, t0: 0, t1: 0.995, nA: 108, nT: 64,
    outer: (th, t) => lvPoint(th, t),
    inner: (th, t) => lvEndoPoint(th, t, 0.02),
  });
  lvMesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.72, metalness: 0.02, side: THREE.DoubleSide,
  }));
  group.add(lvMesh);
}

function buildRV() {
  // A crescent moulded onto the LV: it vanishes at both interventricular grooves,
  // is thickest over the acute margin, and stops short of the LV apex.
  const g = buildShell({
    a0: ANT_GROOVE, a1: POST_GROOVE, wrap: false, t0: RV_T0, t1: RV_TIP, nA: 56, nT: 44,
    outer: (th, t) => rvPoint(th, t),
    inner: (th, t) => rvInnerPoint(th, t),
  });
  rvMesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
    color: '#8e5a52', roughness: 0.75, transparent: true, opacity: 0.72, side: THREE.DoubleSide,
  }));
  group.add(rvMesh);
}

function tube(points, r0, r1, material, radialSegs = 12) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.35);
  const n = Math.max(24, points.length * 10);
  const g = new THREE.TubeGeometry(curve, n, 1, radialSegs, false);
  // TubeGeometry has a constant radius; taper it by scaling each ring outward from the spine.
  if (r0 !== r1) {
    const pos = g.attributes.position, nor = g.attributes.normal;
    for (let i = 0; i <= n; i++) {
      const f = r0 + (r1 - r0) * (i / n);
      for (let j = 0; j <= radialSegs; j++) {
        const k = i * (radialSegs + 1) + j;
        pos.setXYZ(k,
          pos.getX(k) + nor.getX(k) * (f - 1),
          pos.getY(k) + nor.getY(k) * (f - 1),
          pos.getZ(k) + nor.getZ(k) * (f - 1));
      }
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
  } else if (r0 !== 1) {
    const pos = g.attributes.position, nor = g.attributes.normal;
    for (let k = 0; k < pos.count; k++) {
      pos.setXYZ(k, pos.getX(k) + nor.getX(k) * (r0 - 1),
                    pos.getY(k) + nor.getY(k) * (r0 - 1),
                    pos.getZ(k) + nor.getZ(k) * (r0 - 1));
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
  }
  return new THREE.Mesh(g, material);
}

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

function buildAtriaAndGreatVessels() {
  const out = [];
  const wall = new THREE.MeshStandardMaterial({
    color: '#9d6f66', roughness: 0.8, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
  });
  const arterial = new THREE.MeshStandardMaterial({
    color: '#c9b0a6', roughness: 0.55, transparent: true, opacity: 0.7, side: THREE.DoubleSide,
  });
  const venous = new THREE.MeshStandardMaterial({
    color: '#7d90ac', roughness: 0.6, transparent: true, opacity: 0.62, side: THREE.DoubleSide,
  });

  // Left atrium: the most posterior chamber, sitting on the base at T5-T8.
  const la = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), wall);
  la.scale.set(...LA_POS.r);
  la.position.set(...LA_POS.c);
  // Right atrium: forms the right border of the heart, anterior and to the right.
  const ra = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), wall);
  ra.scale.set(...RA_POS.r);
  ra.position.set(...RA_POS.c);
  la.userData.kind = 'atrium'; ra.userData.kind = 'atrium';
  out.push(la, ra);

  // Appendages, built as a chain of flattened lobes: the left a narrow finger, the
  // right a broad scalloped flap lying over the aortic root.
  const appendage = (spec, flatten) => {
    const seg = spec.path.length - 1, out2 = [];
    for (let k = 0; k <= 6; k++) {
      const f = k / 6, i = Math.min(seg - 1, Math.floor(f * seg)), u = f * seg - i;
      const c = [0, 1, 2].map((j) => spec.path[i][j] + (spec.path[i + 1][j] - spec.path[i][j]) * u);
      const r = spec.r[0] + (spec.r[1] - spec.r[0]) * f;
      const m = new THREE.Mesh(new THREE.SphereGeometry(r * (k % 2 ? 1.12 : 0.94), 16, 12), wall);
      m.position.set(c[0], c[1], c[2]);
      m.scale.set(1, flatten, 1.18);
      out2.push(m);
    }
    return out2;
  };
  const apps = [...appendage(LAA, 0.72), ...appendage(RAA, 0.62)];
  apps.forEach((m) => { m.userData.kind = 'atrium'; });
  out.push(...apps);

  // Ascending aorta: from the centre of the base, up, then arching posteriorly and left.
  out.push(tube([
    V3(-0.55, 3.30, -0.15), V3(-0.70, 5.0, 0.25), V3(-0.75, 6.6, 0.15),
    V3(-0.40, 7.75, -0.5), V3(0.65, 8.05, -1.2), V3(1.75, 7.45, -1.65),
  ], 1.05, 0.85, arterial, 20));

  // Right ventricular outflow tract: sweeps up, left and anterior, crossing in
  // FRONT of the aortic root to reach the pulmonary valve.
  out.push(tube([
    rvSurf(158, 0.13, 0.05), V3(-3.95, 3.1, 2.05), V3(-2.6, 4.0, 2.25),
    V3(-1.2, 4.45, 1.9), V3(0.1, 4.4, 1.35), V3(0.45, 4.35, 1.05),
  ], 1.12, 0.92, wall, 20));

  // Pulmonary trunk: arises anterior and LEFT of the aorta, then runs posteriorly
  // across it — the spiral relationship of the two great arteries.
  out.push(tube([
    V3(0.45, 4.35, 1.05), V3(0.95, 5.45, 0.7), V3(1.35, 6.25, 0.0), V3(1.7, 6.55, -0.85),
  ], 0.95, 0.85, arterial, 18));
  out.push(tube([V3(1.7, 6.55, -0.85), V3(2.9, 6.4, -1.35)], 0.62, 0.52, arterial, 14));
  out.push(tube([V3(1.55, 6.5, -0.9), V3(0.2, 6.45, -1.3), V3(-1.1, 6.3, -1.2)], 0.6, 0.5, arterial, 14));

  // Caval veins into the right atrium.
  out.push(tube([V3(-2.6, 5.5, 0.35), V3(-2.78, 7.1, 0.1), V3(-2.82, 8.2, 0.0)], 0.78, 0.7, venous, 14));
  out.push(tube([V3(-2.4, 2.9, -0.3), V3(-2.5, 1.7, -0.7)], 0.88, 0.8, venous, 14));

  // Four pulmonary veins entering the left atrium from behind.
  for (const [x, y] of [[-0.9, 5.05], [-0.8, 4.0], [1.6, 5.05], [1.5, 4.0]]) {
    const s = Math.sign(x) || 1;
    out.push(tube([V3(x, y, -2.55), V3(x + s * 1.15, y + 0.2, -3.25)], 0.42, 0.36, venous, 10));
  }

  out.forEach((m) => { m.userData.kind = m.userData.kind || 'vessel'; group.add(m); });
  return out;
}

/* --- coronary vessels ------------------------------------------------ */

function clearVessels() {
  for (const v of vessels.values()) {
    group.remove(v.mesh);
    v.mesh.geometry.dispose();
    v.material.dispose();
  }
  vessels.clear();
}

function buildVessels() {
  clearVessels();
  const A = (id, pts, r) => {
    const mat = new THREE.MeshStandardMaterial({ color: '#cf3b2f', roughness: 0.45, metalness: 0.05 });
    const mesh = tube(pts, r, r, mat, 8);
    group.add(mesh);
    vessels.set(id, { mesh, kind: 'artery', material: mat, base: mat.color.clone() });
  };
  const V = (id, pts, r) => {
    const mat = new THREE.MeshStandardMaterial({ color: '#3f6fb8', roughness: 0.5, metalness: 0.05 });
    const mesh = tube(pts, r, r, mat, 8);
    group.add(mesh);
    vessels.set(id, { mesh, kind: 'vein', material: mat, base: mat.color.clone() });
  };

  const leftSinus = V3(-0.15, 3.35, 0.6);
  const rightSinus = V3(-1.25, 3.3, -0.1);
  const G = ANT_GROOVE;      // 122
  const P = POST_GROOVE;     // 232

  // --- Left system: LM bifurcates into the LAD (anterior IV groove) and the LCx
  //     (left AV groove, sweeping the LV free wall towards the crux).
  A('LM', [leftSinus, surf(G + 12, 0.03, 0.22), surf(G + 4, 0.055, 0.2)], 0.13);
  A('LAD1', [surf(G + 4, 0.055, 0.2), surf(G, 0.16, 0.18), surf(G - 2, 0.28, 0.17)], 0.10);
  A('LAD2', [surf(G - 2, 0.28, 0.17), surf(G - 4, 0.42, 0.16), surf(G - 6, 0.58, 0.15)], 0.085);
  A('LAD3', [surf(G - 6, 0.58, 0.15), surf(G - 8, 0.74, 0.14), surf(G - 12, 0.88, 0.13),
             surf(170, 0.965, 0.12), surf(P - 20, 0.93, 0.12), surf(P - 16, 0.82, 0.13)], 0.07);
  A('D1', [surf(G - 2, 0.28, 0.17), surf(95, 0.34, 0.19), surf(68, 0.43, 0.19), surf(50, 0.53, 0.18)], 0.075);
  A('D2', [surf(G - 5, 0.50, 0.16), surf(96, 0.58, 0.17), surf(78, 0.68, 0.16)], 0.06);
  A('S1', [surf(G + 2, 0.20, 0.14), V3(-1.35, lvSurfY(160, 0.24), 0.5)], 0.05);
  A('S2', [surf(G - 3, 0.40, 0.13), V3(-1.0, lvSurfY(160, 0.44), 0.35)], 0.045);
  A('S3', [surf(G - 6, 0.62, 0.12), V3(-0.6, lvSurfY(160, 0.66), 0.2)], 0.04);
  A('LCX1', [surf(G + 10, 0.045, 0.22), surf(100, 0.04, 0.22), surf(62, 0.045, 0.22), surf(24, 0.06, 0.22)], 0.10);
  A('LCX2', [surf(24, 0.06, 0.22), surf(345, 0.07, 0.22), surf(310, 0.075, 0.22), surf(276, 0.08, 0.22)], 0.085);
  A('OM1', [surf(24, 0.06, 0.20), surf(8, 0.28, 0.19), surf(356, 0.46, 0.18), surf(350, 0.58, 0.17)], 0.07);
  A('OM2', [surf(330, 0.07, 0.20), surf(322, 0.30, 0.19), surf(318, 0.46, 0.18)], 0.06);

  // --- Right system: the RCA rides the right AV groove over the RV convexity to
  //     the crux, then gives the PDA down the posterior IV groove.
  A('RCA1', [rightSinus, rvSurf(142, 0.09, 0.16), rvSurf(165, 0.10, 0.18)], 0.115);
  A('RCA2', [rvSurf(165, 0.10, 0.18), rvSurf(190, 0.105, 0.18), rvSurf(212, 0.115, 0.17)], 0.10);
  A('RCA3', [rvSurf(212, 0.115, 0.17), rvSurf(224, 0.125, 0.16), surf(P, 0.13, 0.16)], 0.09);
  A('AM', [rvSurf(200, 0.11, 0.16), rvSurf(205, 0.28, 0.15), rvSurf(208, 0.5, 0.14), rvSurf(210, 0.7, 0.13)], 0.065);
  A('PDA', [surf(P, 0.13, 0.15), surf(P - 4, 0.32, 0.14), surf(P - 8, 0.54, 0.13),
            surf(P - 12, 0.76, 0.12), surf(P - 18, 0.88, 0.12)], 0.075);
  A('PLV', [surf(P, 0.13, 0.15), surf(262, 0.24, 0.15), surf(276, 0.38, 0.14)], 0.06);
  A('SAN', [rvSurf(150, 0.095, 0.16), V3(-3.0, 4.6, 0.5), V3(-2.6, 5.4, 0.35)], 0.05);
  A('AVN', [surf(P + 2, 0.13, 0.14), V3(-0.55, lvSurfY(200, 0.16), -0.7)], 0.045);

  // --- Venous system: every large vein accompanies an artery, and all but the
  //     anterior cardiac veins drain to the coronary sinus.
  V('CS', [surf(300, 0.075, 0.26), surf(276, 0.08, 0.28), surf(252, 0.09, 0.3),
           surf(P, 0.12, 0.32), V3(-2.1, 3.9, -1.3)], 0.125);
  V('GCV', [surf(G + 6, 0.86, 0.13), surf(G + 8, 0.6, 0.15), surf(G + 10, 0.34, 0.18),
            surf(G + 14, 0.1, 0.22), surf(104, 0.07, 0.24), surf(66, 0.07, 0.25),
            surf(28, 0.09, 0.26), surf(348, 0.09, 0.26), surf(316, 0.085, 0.26), surf(300, 0.075, 0.26)], 0.085);
  V('MCV', [surf(P - 14, 0.86, 0.12), surf(P - 10, 0.6, 0.14), surf(P - 6, 0.36, 0.17),
            surf(P - 2, 0.17, 0.24), surf(P, 0.125, 0.3), surf(252, 0.09, 0.3)], 0.08);
  V('SCV', [rvSurf(196, 0.52, 0.13), rvSurf(200, 0.3, 0.15), rvSurf(210, 0.12, 0.2),
            rvSurf(224, 0.115, 0.22), surf(P, 0.12, 0.32)], 0.06);
  V('PVLV', [surf(288, 0.5, 0.16), surf(290, 0.32, 0.2), surf(292, 0.15, 0.24), surf(288, 0.08, 0.26)], 0.055);
  V('ACV', [rvSurf(170, 0.42, 0.14), rvSurf(168, 0.2, 0.16), V3(-2.9, 4.0, 0.6)], 0.05);
}

/* --- scanned geometry (BodyParts3D) ------------------------------- */

const SCANNED_STYLE = {
  lv: { color: '#a8443f', vertexColours: true, opacity: 1 },
  rv: { color: '#8e5a52', vertexColours: false, opacity: 0.72 },
  la: { color: '#9d6f66', vertexColours: false, opacity: 0.55 },
  ra: { color: '#9d6f66', vertexColours: false, opacity: 0.55 },
};

let scanned = null;          // { group, meshes:{}, manifest }
let scannedLoading = null;

async function loadPart(file) {
  const buf = await (await fetch(`models/${file}`)).arrayBuffer();
  const head = new Uint32Array(buf, 0, 2);
  const nv = head[0], nf = head[1];
  const pos = new Float32Array(buf.slice(8, 8 + nv * 12));
  const idx = new Uint32Array(buf.slice(8 + nv * 12, 8 + nv * 12 + nf * 12));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}

async function loadScanned() {
  if (scanned) return scanned;
  if (scannedLoading) return scannedLoading;
  scannedLoading = (async () => {
    const manifest = await (await fetch('models/heart-meshes.json')).json();
    const holder = new THREE.Group();
    const meshes = {};
    for (const [key, style] of Object.entries(SCANNED_STYLE)) {
      const part = manifest.parts[key];
      if (!part) continue;
      const g = await loadPart(part.file);
      if (style.vertexColours) {
        g.setAttribute('color', new THREE.BufferAttribute(
          new Float32Array(g.attributes.position.count * 3), 3));
        // The mesh is already in the cardiac frame, so segment maths reads straight off it.
        const pos = g.attributes.position;
        const th = [], tt = [];
        for (let i = 0; i < pos.count; i++) {
          th.push(Math.atan2(pos.getZ(i), pos.getX(i)) * 180 / Math.PI);
          tt.push((LV_TOP - pos.getY(i)) / LV_LEN);
        }
        g.userData.theta = th;
        g.userData.t = tt;
      }
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
        color: style.color, roughness: 0.74, metalness: 0.02, side: THREE.DoubleSide,
        transparent: style.opacity < 1, opacity: style.opacity,
        vertexColors: !!style.vertexColours,
      }));
      holder.add(m);
      meshes[key] = m;
    }
    group.add(holder);
    scanned = { group: holder, meshes, manifest,
                lvSample: heightSampler(manifest.lvHeightMap),
                rvSample: heightSampler(manifest.rvHeightMap) };
    return scanned;
  })();
  return scannedLoading;
}

async function applyGeometry() {
  const useScan = state.geometry === 'scanned';
  const note = $('#geometry-note');
  if (useScan) {
    if (note) note.textContent = 'Loading scanned meshes...';
    let s;
    try {
      s = await loadScanned();
    } catch (err) {
      console.error('heart lab: scanned geometry failed to load', err);
      if (note) note.textContent = 'Scanned meshes could not be loaded; showing the procedural model.';
      state.geometry = 'procedural';
      $('#opt-scan').checked = false;
      return;
    }
    surf = (th, t, off = 0) => new THREE.Vector3(...sampledPoint(s.lvSample, th, t, off));
    rvSurf = (th, t, off = 0) => new THREE.Vector3(...sampledPoint(s.rvSample, th, t, off));
    if (note) note.textContent = `BodyParts3D scan · ${Object.values(s.manifest.parts)
      .reduce((a, p) => a + p.triangles, 0).toLocaleString()} triangles`;
  } else {
    surf = (th, t, off = 0) => new THREE.Vector3(...lvPoint(th, t, off));
    rvSurf = (th, t, off = 0) => new THREE.Vector3(...rvPoint(th, t, off));
    if (note) note.textContent = 'Procedural · generated from measured anatomy';
  }
  if (lvMesh) lvMesh.visible = !useScan;
  if (rvMesh) rvMesh.visible = !useScan && state.showChambers;
  if (scanned) scanned.group.visible = useScan;
  buildVessels();
  update();
}

/* --- orientation and framing ----------------------------------------- */

const APEX = new THREE.Vector3(...APEX_DIR).normalize();

// Orientation comes from heartBasis() in heart-data.js, so the renderer and the
// silhouette checks use one definition.
function orientHeart(g) {
  const { X, Y, Z } = heartBasis();
  const m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...X), new THREE.Vector3(...Y), new THREE.Vector3(...Z));
  g.quaternion.setFromRotationMatrix(m);
}

const VIEW_DIRS = {
  anterior: new THREE.Vector3(0, 0.18, 1),
  inferior: new THREE.Vector3(0, -1, -0.32),
  lateral: new THREE.Vector3(1, 0.12, 0.18),
  septal: new THREE.Vector3(-1, 0.12, 0.18),
  apex: null,                                  // filled in from the long axis
};

let heartCentre = new THREE.Vector3();
let heartRadius = 8;

function frameCamera(dirName, animate = false) {
  const dir = (dirName === 'apex' ? APEX.clone() : VIEW_DIRS[dirName].clone()).normalize();
  const dist = heartRadius / Math.sin((camera.fov * Math.PI / 180) / 2) * 0.95;
  camera.position.copy(heartCentre).addScaledVector(dir, dist);
  controls.target.copy(heartCentre);
  controls.update();
}

function initThree() {
  const host = $('#stage');
  if (!host) return false;
  if (!window.WebGLRenderingContext) return false;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    return false;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  host.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 400);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;

  scene.add(new THREE.HemisphereLight('#ffffff', '#40363a', 1.1));
  const key = new THREE.DirectionalLight('#fff4ec', 1.45);
  key.position.set(6, 9, 10);
  const rim = new THREE.DirectionalLight('#9fd8ff', 0.6);
  rim.position.set(-8, 1, -9);
  scene.add(key, rim);

  group = new THREE.Group();
  scene.add(group);

  buildLV();
  buildRV();
  chamberExtras = buildAtriaAndGreatVessels();
  buildVessels();

  lesionMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 20, 16),
    new THREE.MeshStandardMaterial({ color: '#1a1a1a', emissive: '#7a1f14', emissiveIntensity: 0.85, roughness: 0.3 })
  );
  lesionMarker.visible = false;
  group.add(lesionMarker);

  orientHeart(group);
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  heartCentre = sphere.center.clone();
  heartRadius = sphere.radius;
  controls.minDistance = heartRadius * 0.8;
  controls.maxDistance = heartRadius * 6;
  // Default: the anterolateral oblique you would use looking at a specimen on the table.
  VIEW_DIRS.anterolateral = new THREE.Vector3(0.5, 0.28, 1);
  frameCamera('anterolateral');

  new ResizeObserver(() => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }).observe(host);

  const spinAxis = APEX.clone().negate();
  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = (now - last) / 1000; last = now;
    // Spin about the heart's own long axis, not the world vertical.
    if (state.spin) group.rotateOnWorldAxis(spinAxis, dt * 0.22);
    if (lesionMarker.visible) lesionMarker.scale.setScalar(1 + Math.sin(now / 220) * 0.22);
    controls.update();
    renderer.render(scene, camera);
  });
  return true;
}

/* --- painting -------------------------------------------------------- */

function activeLV() {
  return state.geometry === 'scanned' && scanned ? scanned.meshes.lv : lvMesh;
}

function paintLV() {
  const mesh = activeLV();
  if (!mesh) return;
  const g = mesh.geometry;
  const col = g.attributes.color;
  const pos = g.attributes.position;
  const { theta, t: tArr } = g.userData;
  const segs = new Set(state.scenario.segs);
  const stage = STAGES[state.stage];
  const sick = infarctColour(stage);
  const active = stage.id !== 0 && segs.size > 0;

  for (let i = 0; i < col.count; i++) {
    let c = HEALTHY;
    if (active && segs.has(ahaSegment(theta[i], tArr[i]))) {
      // Subendocardial infarcts spare the outer wall, so colour only the inner layer.
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      const ref = state.geometry === 'scanned' && scanned
        ? scanned.lvSample(theta[i], tArr[i]) : lvRadius(tArr[i]);
      const inner = r < ref - lvWall(theta[i], tArr[i]) * 0.45;
      c = (state.scenario.subendo && !inner) ? HEALTHY : sick;
    }
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}

const DEAD_COLOUR = new THREE.Color('#6b6660');

// Toggling `transparent` can require a shader recompile. Only flag it on a real
// change so a slider drag doesn't rebuild the program on every frame.
function setOpacity(material, opacity) {
  const t = opacity < 1;
  if (material.transparent !== t) {
    material.transparent = t;
    material.needsUpdate = true;
  }
  material.opacity = opacity;
}

function paintVessels() {
  if (!lesionMarker) return;
  const dead = new Set(state.scenario.dead);
  const active = STAGES[state.stage].id !== 0;
  for (const [id, v] of vessels) {
    const isDead = active && dead.has(id);
    v.material.color.copy(isDead ? DEAD_COLOUR : v.base);
    setOpacity(v.material, isDead ? 0.55 : 1);
    v.mesh.visible = v.kind === 'artery' ? state.showArteries : state.showVeins;
  }
  const first = state.scenario.dead[0];
  if (active && first && vessels.has(first) && state.showArteries) {
    const g = vessels.get(first).mesh.geometry;
    lesionMarker.position.fromBufferAttribute(g.attributes.position, 0);
    lesionMarker.visible = true;
  } else {
    lesionMarker.visible = false;
  }
}

function paintChambers() {
  const scan = state.geometry === 'scanned' && scanned;
  const rvInfarct = state.scenario.rv && STAGES[state.stage].id !== 0;
  const rvColour = rvInfarct ? infarctColour(STAGES[state.stage]).getStyle() : '#8e5a52';

  if (lvMesh) lvMesh.visible = !scan;
  if (rvMesh) {
    rvMesh.visible = !scan && state.showChambers;
    rvMesh.material.color.set(rvColour);
  }
  if (scanned) {
    scanned.group.visible = !!scan;
    scanned.meshes.rv.visible = state.showChambers;
    scanned.meshes.rv.material.color.set(rvColour);
    for (const k of ['la', 'ra']) if (scanned.meshes[k]) scanned.meshes[k].visible = state.showChambers;
  }
  // Procedural atria step aside for the scanned ones; the great vessels have no
  // scanned counterpart in this build, so they stay.
  chamberExtras.forEach((m) => {
    m.visible = state.showChambers && !(scan && m.userData.kind === 'atrium');
  });

  const lv = activeLV();
  if (lv) setOpacity(lv.material, state.wallOpacity);
}

/* ------------------------------------------------------------------ *
 * 6. TEXT PANELS
 * ------------------------------------------------------------------ */

function esc(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

function renderPanels() {
  const sc = state.scenario;
  const st = STAGES[state.stage];

  $('#stage-time').textContent = st.time;
  $('#stage-short').textContent = st.short;

  $('#panel-lesion').innerHTML = `
    <h3>${esc(sc.name)}</h3>
    <dl class="kv">
      <dt>Wall</dt><dd>${esc(sc.wall)}</dd>
      <dt>Artery</dt><dd>${esc(sc.artery)}</dd>
      <dt>Segments</dt><dd>${sc.segs.length ? sc.segs.slice().sort((a, b) => a - b).map((s) => `${s} ${SEG_NAME[s]}`).join('; ') : '—'}</dd>
    </dl>`;

  const leadRow = (list, cls, label) => list.length
    ? `<p class="lead-row"><span class="tag ${cls}">${label}</span> ${list.map((l) => `<b>${l}</b>`).join(', ')}</p>` : '';

  $('#panel-ecg').innerHTML = `
    <h3>ECG</h3>
    <p>${esc(sc.leads)}</p>
    ${leadRow(sc.elevate, 'up', 'ST ↑')}
    ${leadRow(sc.depress, 'down', 'ST ↓')}
    ${sc.posterior ? '<p class="hint">Record V7–V9 to convert the mirror image into direct ST elevation.</p>' : ''}
    ${sc.rv ? '<p class="hint">Record V4R. ST elevation over 1 mm confirms right ventricular infarction.</p>' : ''}
    <p class="stage-note"><strong>At ${esc(st.time)}:</strong> ${esc(st.ecg)}</p>`;

  $('#panel-distinguish').innerHTML = `
    <h3>How to tell it apart</h3>
    <ul>${sc.distinguish.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`;

  $('#panel-gross').innerHTML = `
    <h3>Gross specimen at ${esc(st.time)}</h3>
    <p>${esc(st.gross)}</p>
    <dl class="kv">
      <dt>Where</dt><dd>${esc(sc.gross)}</dd>
      <dt>Microscopy</dt><dd>${esc(st.micro)}</dd>
      <dt>TTC stain</dt><dd>${esc(st.ttc)}</dd>
    </dl>
    ${st.risk ? `<p class="warn">${esc(st.risk)}</p>` : ''}`;
}

function update() {
  paintLV();
  paintVessels();
  paintChambers();
  paintBullseye();
  drawECG();
  renderPanels();
}

/* ------------------------------------------------------------------ *
 * 7. WIRING
 * ------------------------------------------------------------------ */

function buildControls() {
  const sel = $('#scenario');
  sel.innerHTML = SCENARIOS.map((s, i) => `<option value="${i}">${esc(s.name)}</option>`).join('');
  sel.addEventListener('change', () => { state.scenario = SCENARIOS[+sel.value]; update(); });

  const slider = $('#stage-slider');
  slider.max = String(STAGES.length - 1);
  slider.value = String(state.stage);
  slider.addEventListener('input', () => { state.stage = +slider.value; update(); });

  $('#opt-arteries').addEventListener('change', (e) => { state.showArteries = e.target.checked; update(); });
  $('#opt-veins').addEventListener('change', (e) => { state.showVeins = e.target.checked; update(); });
  $('#opt-chambers').addEventListener('change', (e) => { state.showChambers = e.target.checked; update(); });
  $('#opt-spin').addEventListener('change', (e) => { state.spin = e.target.checked; });
  $('#opt-scan').addEventListener('change', (e) => {
    state.geometry = e.target.checked ? 'scanned' : 'procedural';
    applyGeometry();
  });
  $('#opt-opacity').addEventListener('input', (e) => { state.wallOpacity = +e.target.value; paintChambers(); });

  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!camera) return;
      state.spin = false;
      $('#opt-spin').checked = false;
      frameCamera(btn.dataset.view);
    });
  });
}

function boot() {
  buildBullseye();
  buildControls();
  let ok = false;
  try {
    ok = initThree();
  } catch (err) {
    console.error('heart lab: 3D setup failed', err);
  }
  if (!ok) {
    $('#stage').innerHTML = '<p class="fallback">This browser could not start WebGL, so the 3D model is unavailable. Everything else on this page — the ECG, the bullseye map and the reference tables — still works.</p>';
  }
  update();
  // Scanned geometry is the default, so fetch it once the procedural model is up.
  if (state.geometry === 'scanned') applyGeometry();
  window.addEventListener('resize', drawECG);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawECG);
}

boot();
