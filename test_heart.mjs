/* Self-check for the heart lab's clinical data and ECG maths.
 * Run: node test_heart.mjs   — exits non-zero on any failure. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as DATA from './heart-data.js';
import {
  LEADS, MORPH, SEG_NAME, STAGES, SCENARIOS, VESSEL_IDS,
  beat, ahaSegment, leadState,
  LV_A, LV_TOP, LV_LEN, ANT_GROOVE, POST_GROOVE, RV_T0, RV_TIP, RV_WALL, RV_TILT, RV_BULGE,
  lvY, lvRadius, lvWall, lvEndo, baseTilt, rvBulge, rvRadius, APEX_DIR, shellMesh,
  lvPoint, lvEndoPoint, rvPoint, rvInnerPoint, rvDir, localToWorld,
  LA_POS, RA_POS, SILHOUETTE_ASPECT, SILHOUETTE_APEX_FRAC, silhouetteCloud,
  heightSampler, sampledPoint,
} from './heart-data.js';

const normal = SCENARIOS.find((s) => s.id === 'none');
const baseline = STAGES[0];
const acute = STAGES[2];      // 30 min – 4 h, peak ST elevation
const old = STAGES[9];        // > 2 months
const J = 0.30;               // a point inside the ST segment, in seconds

// ST shift = this lead under the scenario, minus the same lead when normal.
// Differencing against the lead's own normal removes the T-wave shoulder that sits over the J+60 point.
const stAt = (lead, sc, stage) => {
  const { m, offset } = leadState(lead, sc, stage);
  const ref = leadState(lead, normal, baseline);
  return beat(J, m, offset) - beat(J, ref.m, ref.offset);
};

let n = 0;
const check = (name, fn) => { fn(); n++; };

check('every lead has a morphology', () => {
  assert.equal(LEADS.length, 12);
  for (const l of LEADS) assert.ok(MORPH[l], `missing morphology for ${l}`);
});

check('all 17 AHA segments are named', () => {
  for (let i = 1; i <= 17; i++) assert.ok(SEG_NAME[i], `segment ${i} unnamed`);
});

check('ahaSegment reaches every segment and never leaves 1..17', () => {
  const seen = new Set();
  for (let th = 0; th < 360; th += 1) {
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const s = ahaSegment(th, t);
      assert.ok(Number.isInteger(s) && s >= 1 && s <= 17, `bad segment ${s} at ${th}deg t=${t}`);
      seen.add(s);
    }
  }
  assert.equal(seen.size, 17, `only reached ${seen.size} segments`);
});

check('scenarios reference real leads, segments and vessels', () => {
  const ids = new Set(VESSEL_IDS);
  for (const sc of SCENARIOS) {
    for (const l of [...sc.elevate, ...sc.depress]) assert.ok(LEADS.includes(l), `${sc.id}: bad lead ${l}`);
    for (const s of sc.segs) assert.ok(s >= 1 && s <= 17, `${sc.id}: bad segment ${s}`);
    for (const v of sc.dead) assert.ok(ids.has(v), `${sc.id}: unknown vessel ${v}`);
    assert.equal(new Set(sc.elevate).size, sc.elevate.length, `${sc.id}: duplicate elevate lead`);
    const overlap = sc.elevate.filter((l) => sc.depress.includes(l));
    assert.equal(overlap.length, 0, `${sc.id}: ${overlap} both elevated and depressed`);
    assert.ok(sc.distinguish.length > 0, `${sc.id}: no distinguishing points`);
  }
});

check('baseline is flat in every lead', () => {
  for (const l of LEADS) {
    assert.equal(stAt(l, normal, baseline), 0, `${l} not isoelectric at baseline`);
  }
});

check('an acute STEMI elevates its own leads and depresses the reciprocals', () => {
  const rca = SCENARIOS.find((s) => s.id === 'rca-prox');
  for (const l of rca.elevate) assert.ok(stAt(l, rca, acute) > 0.2, `${l} should be elevated`);
  for (const l of rca.depress) assert.ok(stAt(l, rca, acute) < -0.05, `${l} should be depressed`);
  assert.ok(Math.abs(stAt('V6', rca, acute)) < 0.02, 'V6 should be untouched by an inferior MI');
});

check('inferior and anterior territories are reciprocal to each other', () => {
  const inf = SCENARIOS.find((s) => s.id === 'rca-mid');
  const ant = SCENARIOS.find((s) => s.id === 'lad-prox');
  assert.ok(inf.elevate.includes('III') && inf.depress.includes('aVL'));
  assert.ok(ant.elevate.includes('aVL') && ant.depress.includes('III'));
});

check('Q waves deepen and R waves shrink as the infarct ages', () => {
  const lad = SCENARIOS.find((s) => s.id === 'lad-prox');
  const early = leadState('V3', lad, acute).m;
  const late = leadState('V3', lad, old).m;
  assert.ok(late.q < early.q, 'Q should be deeper in an old infarct');
  assert.ok(late.r < early.r, 'R should be smaller in an old infarct');
  assert.ok(Math.abs(stAt('V3', lad, old)) < 0.05, 'ST should be back to baseline by 2 months');
});

check('subendocardial infarction never grows Q waves', () => {
  const nstemi = SCENARIOS.find((s) => s.id === 'nstemi');
  for (const stage of STAGES) {
    for (const l of nstemi.elevate) {
      assert.equal(leadState(l, nstemi, stage).m.q, MORPH[l].q, `${l} grew a Q wave at ${stage.time}`);
    }
  }
});

check('posterior MI grows a tall R in V2 rather than a Q', () => {
  const post = SCENARIOS.find((s) => s.id === 'pda');
  assert.ok(leadState('V2', post, old).m.r > MORPH.V2.r + 0.8, 'V2 R wave should grow');
  assert.ok(stAt('V2', post, acute) < -0.05, 'V2 should be depressed acutely');
});

check('every stage carries ECG, gross and microscopy text', () => {
  assert.equal(STAGES.length, 10);
  for (const s of STAGES) {
    for (const k of ['time', 'short', 'ecg', 'gross', 'micro', 'ttc']) {
      assert.ok(s[k] && s[k].length > 3, `stage ${s.id} missing ${k}`);
    }
  }
});

check('ST elevation peaks early and the rupture warning lands at 3-7 days', () => {
  const peak = STAGES.reduce((a, b) => (b.st > a.st ? b : a));
  assert.ok(peak.id <= 3, `ST should peak in the first 12 h, peaked at stage ${peak.id}`);
  assert.match(STAGES[6].risk, /RUPTURE/i);
});


/* ---- shape of the heart ---- */

check('LV is a truncated prolate ellipsoid, widest at the equator not the base', () => {
  const rBase = lvRadius(0);
  const rEquator = Math.max(...Array.from({ length: 101 }, (_, i) => lvRadius(i / 100)));
  assert.ok(rBase < rEquator - 0.2, `base ${rBase.toFixed(2)} should be narrower than equator ${rEquator.toFixed(2)}`);
  assert.ok(Math.abs(rEquator - LV_A) < 0.01, 'equatorial radius should equal LV_A');
  // The widest point sits in the basal-to-mid third, as it does on a real ventricle.
  let tWide = 0, best = -1;
  for (let i = 0; i <= 100; i++) { const r = lvRadius(i / 100); if (r > best) { best = r; tWide = i / 100; } }
  assert.ok(tWide > 0.2 && tWide < 0.45, `widest at t=${tWide}, expected the basal-mid junction`);
});

check('LV apex is closed and rounded, and the long axis is 8-9 cm', () => {
  assert.ok(lvRadius(1) < 0.05, 'apex should close');
  assert.ok(lvRadius(0.98) > lvRadius(1), 'radius should fall monotonically into the apex');
  assert.ok(LV_LEN > 8 && LV_LEN < 9.2, `LV length ${LV_LEN} cm outside the normal range`);
  assert.ok(LV_A * 2 > 6 && LV_A * 2 < 7.2, 'epicardial short axis should be about 6.6 cm');
});

check('LV wall: posterolateral thicker than septum, apex thinnest, cavity never inverts', () => {
  const septum = lvWall(180, 0.15), postlat = lvWall(0, 0.15);
  assert.ok(postlat > septum, 'posterolateral wall should be thicker than the septum');
  assert.ok(septum > 0.8 && septum < 1.1, `septum ${septum.toFixed(2)} cm outside 9.3 mm +/- range`);
  assert.ok(lvWall(180, 1) < lvWall(180, 0), 'apex should be the thinnest part of the wall');
  for (let th = 0; th < 360; th += 5) {
    for (let t = 0; t <= 1.0001; t += 0.01) {
      assert.ok(lvEndo(th, t) >= 0, `endocardium inverted at ${th}deg t=${t.toFixed(2)}`);
      assert.ok(lvEndo(th, t) <= lvRadius(t) + 1e-9, `endocardium outside epicardium at ${th}deg`);
    }
  }
  // The cavity must close short of the epicardial apex, leaving solid apical muscle.
  const closes = Array.from({ length: 1001 }, (_, i) => i / 1000).find((t) => lvEndo(0, t) <= 0);
  assert.ok(closes > 0.9 && closes < 1, `cavity closes at t=${closes}, expected just short of the apex`);
});

check('the AV plane is oblique, higher posteriorly than anteriorly', () => {
  assert.ok(baseTilt(250) > 0.4, 'posterior annulus should sit high');
  assert.ok(baseTilt(70) < -0.4, 'anterior annulus should sit low');
  assert.ok(Math.abs(baseTilt(160)) < 0.2, 'the tilt should cross zero at the sides');
});

check('RV is a crescent: zero at both grooves, full over the acute margin', () => {
  assert.equal(rvBulge(ANT_GROOVE, 0.1), 0, 'must vanish at the anterior IV groove');
  assert.equal(rvBulge((ANT_GROOVE + POST_GROOVE) / 2, RV_T0 / 2), 0,
    'must not appear above the tricuspid annulus');
  assert.equal(rvBulge(POST_GROOVE, 0.1), 0, 'must vanish at the posterior IV groove');
  assert.equal(rvBulge(90, 0.1), 0, 'must not appear on the LV anterior wall');
  assert.equal(rvBulge(300, 0.1), 0, 'must not appear on the LV inferolateral wall');
  const mid = (ANT_GROOVE + POST_GROOVE) / 2;
  assert.ok(rvBulge(mid, 0.10) > 2.5, 'should be near-maximal over the acute margin');
  // Crescent, not an annulus: the RV covers well under half the circumference.
  let covered = 0;
  for (let th = 0; th < 360; th++) if (rvBulge(th, 0.1) > 0) covered++;
  assert.ok(covered > 80 && covered < 140, `RV spans ${covered} deg, expected a crescent of ~110 deg`);
});

check('RV is shorter than the LV and triangular in the frontal view', () => {
  const mid = (ANT_GROOVE + POST_GROOVE) / 2;
  assert.equal(rvBulge(mid, 0.95), 0, 'RV must not reach the LV apex');
  // The tricuspid annulus is apically offset from the mitral by 5-8 mm in normal hearts.
  const offset = RV_T0 * LV_LEN;
  assert.ok(offset > 0.4 && offset < 0.9, `mitral-tricuspid offset ${offset.toFixed(2)} cm outside 5-8 mm`);
  assert.ok((1 - RV_TIP) * LV_LEN > 0.6, 'the left ventricle alone must form the apex');
  const lvLenOfRv = (RV_TIP - RV_T0) * LV_LEN;
  assert.ok(lvLenOfRv > 6.5 && lvLenOfRv < 8.2, `RV length ${lvLenOfRv.toFixed(1)} cm, expected ~7.6 cm`);
  // Width must fall monotonically from base to tip.
  let prev = Infinity;
  for (let t = RV_T0; t <= RV_TIP; t += 0.02) {
    const w = rvBulge(mid, t);
    assert.ok(w <= prev + 1e-9, `RV widens towards the apex at t=${t.toFixed(2)}`);
    prev = w;
  }
  assert.ok(RV_WALL > 0.25 && RV_WALL < 0.55, 'RV wall should be 3-5 mm');
});

check('RV always sits outside the LV epicardium, never inside it', () => {
  for (let th = 0; th < 360; th += 3) {
    for (let t = 0; t <= RV_TIP; t += 0.02) {
      assert.ok(rvRadius(th, t) >= lvRadius(t) - 1e-9, `RV inside LV at ${th}deg`);
    }
  }
  // The displacement must always carry the free wall forwards as well as outwards,
  // because the right ventricle lies in front of the left, not merely beside it.
  for (let th = ANT_GROOVE + 1; th < POST_GROOVE; th += 1) {
    assert.ok(rvDir(th)[2] > 0, `RV displacement not anterior at ${th}deg`);
  }
  assert.ok(RV_TILT > 0 && RV_TILT < 1, 'RV_TILT should be a blend fraction');
  // Basal RV inflow should be about 4.5 cm across.
  const inflow = RV_BULGE - RV_WALL;
  assert.ok(inflow > 2.8 && inflow < 4.6, `RV cavity depth ${inflow.toFixed(1)} cm`);
});

check('the apex points left, inferior and anterior', () => {
  const [x, y, z] = APEX_DIR;
  assert.ok(x > 0.3, 'apex should point to the patient left');
  assert.ok(y < -0.5, 'apex should point inferiorly');
  assert.ok(z > 0.2, 'apex should point anteriorly');
  const len = Math.hypot(x, y, z);
  assert.ok(Math.abs(len - 1) < 0.02, 'APEX_DIR should be unit length');
  // Roughly 45 degrees oblique to the body planes, as the imaging literature describes.
  const fromVertical = Math.acos(-y / len) * 180 / Math.PI;
  assert.ok(fromVertical > 30 && fromVertical < 60, `long axis ${fromVertical.toFixed(0)}deg from vertical`);
});

check('AHA segment boundaries line up with the interventricular grooves', () => {
  // The anterior groove separates anterior from anteroseptal; the posterior groove
  // sits in the inferoseptal sector. Both must be inside the septal half.
  assert.ok(ahaSegment(ANT_GROOVE, 0.15) === 2, 'anterior groove should fall on basal anteroseptal');
  assert.ok(ahaSegment(POST_GROOVE, 0.15) === 3, 'posterior groove should fall on basal inferoseptal');
});


/* ---- mesh topology ---- */

const LV_SPEC = {
  a0: 0, a1: 360, wrap: true, t0: 0, t1: 0.995, nA: 24, nT: 16,
  outer: (th, t) => lvPoint(th, t),
  inner: (th, t) => lvEndoPoint(th, t, 0.02),
};
const RV_SPEC = {
  a0: ANT_GROOVE, a1: POST_GROOVE, wrap: false, t0: RV_T0, t1: RV_TIP, nA: 12, nT: 10,
  outer: (th, t) => rvPoint(th, t),
  inner: (th, t) => rvInnerPoint(th, t),
};

const manifold = (mesh) => {
  const edges = new Map();
  for (let i = 0; i < mesh.index.length; i += 3) {
    const tri = [mesh.index[i], mesh.index[i + 1], mesh.index[i + 2]];
    for (let k = 0; k < 3; k++) {
      const a = tri[k], b = tri[(k + 1) % 3];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  return [...edges.values()];
};

for (const [name, spec] of [['LV', LV_SPEC], ['RV', RV_SPEC]]) {
  check(`${name} mesh is watertight and well-formed`, () => {
    const m = shellMesh(spec);
    assert.equal(m.positions.length, m.vertexCount * 3, `${name}: vertex count mismatch`);
    for (const v of m.positions) assert.ok(Number.isFinite(v), `${name}: non-finite coordinate`);
    for (const i of m.index) {
      assert.ok(Number.isInteger(i) && i >= 0 && i < m.vertexCount, `${name}: index ${i} out of range`);
    }
    // Every triangle must have three distinct corners.
    for (let i = 0; i < m.index.length; i += 3) {
      const [a, b, c] = [m.index[i], m.index[i + 1], m.index[i + 2]];
      assert.ok(a !== b && b !== c && a !== c, `${name}: degenerate triangle`);
    }
    // Closed surface: every edge shared by exactly two triangles.
    const counts = manifold(m);
    const bad = counts.filter((c) => c !== 2).length;
    assert.equal(bad, 0, `${name}: ${bad} non-manifold edges — the shell is not closed`);
    // Every vertex used.
    const used = new Set(m.index);
    assert.equal(used.size, m.vertexCount, `${name}: ${m.vertexCount - used.size} orphan vertices`);
  });
}

check('the LV mesh spans a plausible heart-sized volume', () => {
  const m = shellMesh(LV_SPEC);
  let minY = Infinity, maxY = -Infinity, maxR = 0;
  for (let i = 0; i < m.positions.length; i += 3) {
    const [x, y, z] = [m.positions[i], m.positions[i + 1], m.positions[i + 2]];
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    maxR = Math.max(maxR, Math.hypot(x, z));
  }
  const height = maxY - minY;
  assert.ok(height > 8 && height < 10, `LV height ${height.toFixed(1)} cm`);
  assert.ok(maxR * 2 > 6 && maxR * 2 < 7.2, `LV width ${(maxR * 2).toFixed(1)} cm`);
  // Widest point must sit below the base, not at it.
  assert.ok(maxR > lvRadius(0) + 0.2, 'the ventricle should bulge below the annulus');
});


/* ---- the heart as it lies in the chest ---- */

// World frame: +x patient's left, +y superior, +z anterior.
function surveyWorld() {
  const best = {}; const tests = {
    right: (p) => -p[0], left: (p) => p[0], anterior: (p) => p[2], posterior: (p) => -p[2], low: (p) => -p[1],
  };
  for (const k of Object.keys(tests)) best[k] = { v: -Infinity, who: '' };
  const add = (p, who) => { for (const k of Object.keys(tests)) { const v = tests[k](p); if (v > best[k].v) best[k] = { v, who }; } };
  const front = new Map();
  for (let th = 0; th < 360; th += 1.5) {
    for (let i = 0; i <= 70; i++) {
      const t = i / 70;
      const lp = localToWorld(lvPoint(th, t)); add(lp, 'LV');
      const cell = (p) => `${Math.round(p[0] * 2)}_${Math.round(p[1] * 2)}`;
      let c = front.get(cell(lp));
      if (!c || lp[2] > c.z) front.set(cell(lp), { z: lp[2], who: 'LV' });
      if (rvBulge(th, t) > 0) {
        const rp = localToWorld(rvPoint(th, t)); add(rp, 'RV');
        c = front.get(cell(rp));
        if (!c || rp[2] > c.z) front.set(cell(rp), { z: rp[2], who: 'RV' });
      }
    }
  }
  for (const [name, A] of [['LA', LA_POS], ['RA', RA_POS]]) {
    for (let i = 0; i <= 24; i++) for (let j = 0; j < 48; j++) {
      const ph = (i / 24) * Math.PI, th = (j / 48) * 2 * Math.PI;
      add(localToWorld([A.c[0] + A.r[0] * Math.sin(ph) * Math.cos(th),
                        A.c[1] + A.r[1] * Math.cos(ph),
                        A.c[2] + A.r[2] * Math.sin(ph) * Math.sin(th)]), name);
    }
  }
  let rv = 0, lv = 0;
  for (const c of front.values()) (c.who === 'RV' ? rv++ : lv++);
  return { best, rvFrontShare: rv / (rv + lv) };
}

check('each border and surface is formed by the right chamber', () => {
  const { best } = surveyWorld();
  assert.equal(best.right.who, 'RA', 'the right border of the heart is the right atrium');
  assert.equal(best.left.who, 'LV', 'the left border is the left ventricle');
  assert.equal(best.posterior.who, 'LA', 'the base of the heart is the left atrium');
  assert.equal(best.low.who, 'LV', 'the apex is left ventricular');
  assert.equal(best.anterior.who, 'RV', 'the sternocostal surface is the right ventricle');
});

check('the right ventricle takes a large share of the sternocostal surface', () => {
  const { rvFrontShare } = surveyWorld();
  // Roughly half to two thirds in life. A crescent grown off the LV axis still
  // under-represents that, so this guards the direction of travel, not the textbook value.
  assert.ok(rvFrontShare > 0.33, `RV covers only ${(rvFrontShare * 100).toFixed(0)}% of the frontal area`);
  assert.ok(rvFrontShare < 0.75, 'RV should not swamp the left ventricle');
});

check('the heart is a plausible size in all three dimensions', () => {
  const pts = silhouetteCloud(3);
  const ext = (i) => { const v = pts.map((p) => p[i]); return Math.max(...v) - Math.min(...v); };
  const w = ext(0), h = ext(1), d = ext(2);
  assert.ok(w > 8 && w < 13, `transverse ${w.toFixed(1)} cm`);
  assert.ok(h > 8 && h < 13, `vertical ${h.toFixed(1)} cm`);
  assert.ok(d > 5 && d < 11, `anteroposterior ${d.toFixed(1)} cm`);
});

check('the frontal silhouette matches the reference diagram', () => {
  const proj = silhouetteCloud(3).map(([x, y]) => [x, -y]);
  let a = Infinity, b = -Infinity, c = Infinity, e = -Infinity;
  for (const [u, v] of proj) { a = Math.min(a, u); b = Math.max(b, u); c = Math.min(c, v); e = Math.max(e, v); }
  const aspect = (b - a) / (e - c);
  let apex = proj[0];
  for (const p of proj) if (p[1] > apex[1]) apex = p;
  const apexFrac = (apex[0] - a) / (b - a);
  assert.ok(Math.abs(aspect - SILHOUETTE_ASPECT) < 0.06,
    `silhouette aspect ${aspect.toFixed(3)} vs diagram ${SILHOUETTE_ASPECT}`);
  assert.ok(Math.abs(apexFrac - SILHOUETTE_APEX_FRAC) < 0.12,
    `apex at ${(apexFrac * 100).toFixed(0)}% vs diagram ${SILHOUETTE_APEX_FRAC * 100}%`);
  assert.ok(aspect > 1, 'the cardiac silhouette is wider than it is tall');
});


/* ---- heart.js cannot be loaded here (it needs WebGL), so check its bindings statically ---- */

check('heart.js imports exactly the heart-data bindings it uses', () => {
  const src = fs.readFileSync(new URL('./heart.js', import.meta.url), 'utf8');
  const importBlock = src.slice(src.indexOf("from 'three/addons"), src.indexOf("from './heart-data.js'"));
  const imported = new Set(
    (importBlock.match(/\{([\s\S]*)/) || ['', ''])[1]
      .replace(/\/\/[^\n]*/g, '')
      .split(/[,{}\n]/).map((x) => x.trim()).filter(Boolean)
  );
  // Body with comments and strings stripped, so a name in prose is not mistaken for a use.
  const body = src.slice(src.indexOf("from './heart-data.js'"))
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g, ' ')
    .replace(/\.\.\./g, ' ');      // spread dots would otherwise read as property access

  const missing = [], unused = [];
  for (const name of Object.keys(DATA)) {
    const used = new RegExp(`(?<![.\\w$])${name}\\b`).test(body);
    if (used && !imported.has(name)) missing.push(name);
    if (!used && imported.has(name)) unused.push(name);
  }
  assert.deepEqual(missing, [], `heart.js uses these without importing them: ${missing.join(', ')}`);
  assert.deepEqual(unused, [], `heart.js imports these but never uses them: ${unused.join(', ')}`);
});


/* ---- scanned geometry, if it has been built ---- */

const MODELS = new URL('./models/heart-meshes.json', import.meta.url);
if (fs.existsSync(MODELS)) {
  const man = JSON.parse(fs.readFileSync(MODELS, 'utf8'));

  check('scanned manifest carries every part the page asks for', () => {
    for (const key of ['lv', 'rv', 'la', 'ra']) {
      const part = man.parts[key];
      assert.ok(part, `missing part ${key}`);
      assert.ok(part.triangles > 1000, `${key} has only ${part.triangles} triangles`);
      const expected = 8 + part.vertices * 12 + part.triangles * 12;
      const size = fs.statSync(new URL(`./models/${part.file}`, import.meta.url)).size;
      assert.equal(size, expected, `${key}.bin is ${size} bytes, header implies ${expected}`);
    }
    assert.equal(man.lvTop, LV_TOP, 'manifest built against a different LV_TOP');
    assert.equal(man.lvLen, LV_LEN, 'manifest built against a different LV_LEN');
  });

  check('the scanned grooves agree with the model\'s groove angles', () => {
    // Measured from the LAD and PDA centroids in the registered frame.
    assert.ok(Math.abs(man.grooves.anterior - ANT_GROOVE) < 10,
      `scanned anterior groove ${man.grooves.anterior} vs model ${ANT_GROOVE}`);
    assert.ok(Math.abs(man.grooves.posterior - POST_GROOVE) < 10,
      `scanned posterior groove ${man.grooves.posterior} vs model ${POST_GROOVE}`);
  });

  check('scanned height maps are usable for placing vessels', () => {
    for (const key of ['lv', 'rv']) {
      const map = man[key + 'HeightMap'];
      assert.ok(map, `no ${key} height map`);
      assert.equal(map.grid.length, map.nT);
      assert.equal(map.grid[0].length, map.nTheta);
      const sample = heightSampler(map);
      let prev = sample(0, 0.5), jumps = 0;
      for (let th = 0; th <= 360; th += 2) {
        const r = sample(th, 0.5);
        assert.ok(Number.isFinite(r) && r > 0 && r < 9, `${key} radius ${r} at ${th}deg`);
        if (Math.abs(r - prev) > 1.2) jumps++;
        prev = r;
      }
      assert.ok(jumps < 6, `${key} height map is too jagged: ${jumps} jumps over 1.2 cm`);
    }
  });

  check('scanned points land on the scanned surface', () => {
    const sample = heightSampler(man.lvHeightMap);
    for (const th of [0, 90, 180, 270]) {
      for (const t of [0.2, 0.5, 0.8]) {
        const p = sampledPoint(sample, th, t);
        assert.ok(Math.abs(Math.hypot(p[0], p[2]) - sample(th, t)) < 1e-6, 'radius mismatch');
        assert.ok(Math.abs(p[1] - lvY(t)) < 1e-6, 'height mismatch');
      }
    }
  });
} else {
  console.log('  (scanned meshes not built — run tools/build_heart_meshes.py to include those checks)');
}

console.log(`ok: ${n} checks passed`);
