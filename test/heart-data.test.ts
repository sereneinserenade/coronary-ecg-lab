/* The clinical data, the ECG maths and the shape of the heart.
 * Carried over from the pre-migration suite unchanged except for the runner. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';
import * as DATA from '~/lib/heart-data';
import {
  ALL_LEADS, ANT_GROOVE, APEX_DIR, CONDUCTION, DOMINANCE, EXTRA_LEADS,
  INJURY, LA_POS, LEADS, LEAD_AXIS, LV_A, LV_BOT, LV_LEN, LV_TOP, MORPH, PAPILLARY,
  POST_GROOVE, RA_POS, RV_BULGE, RV_T0, RV_TILT, RV_TIP, RV_WALL, SCENARIOS,
  SCENARIO_HR, SEG_NAME, SILHOUETTE_APEX_FRAC, SILHOUETTE_ASPECT, STAGES, TERRITORY,
  VALVES, VESSEL_IDS, ahaSegment, baseTilt, beat, conductionState, conductionSummary,
  boxCorners, fitDistance, viewBasis, VIEW_LOCAL, localDirToWorld,
  heightSampler, leadState, localToWorld, lvEndo, lvEndoPoint, lvPoint,
  lvRadius, lvSurfY, lvWall, lvY, papillaryAxisPoints, rrFor, rvBulge, rvDir,
  rvInnerPoint, rvPoint, rvRadius, sampledPoint, shellMesh, silhouetteCloud,
  stDeviation, stThreshold, territoryFor, valveById, withDominance,
} from '~/lib/heart-data';

describe('heart lab', () => {
  // These arrays have a fixed, asserted length; indexing them in a test is safe.
  const stageAt = (i: number) => STAGES[i]!;
  const segName = (s: number) => SEG_NAME[s as DATA.SegmentId];

  const normal = SCENARIOS.find((s) => s.id === 'none')!;
  const baseline = stageAt(0);
  const acute = stageAt(2);      // 30 min – 4 h, peak ST elevation
  const old = stageAt(9);        // > 2 months
  const J = 0.30;               // a point inside the ST segment, in seconds
  
  // ST shift = this lead under the scenario, minus the same lead when normal.
  // Differencing against the lead's own normal removes the T-wave shoulder that sits over the J+60 point.
  const stAt = (lead: DATA.Lead, sc: DATA.Scenario, stage: DATA.Stage) => {
    const { m, offset } = leadState(lead, sc, stage);
    const ref = leadState(lead, normal, baseline);
    return beat(J, m, offset) - beat(J, ref.m, ref.offset);
  };
  
  
  it('every lead has a morphology', () => {
    assert.equal(LEADS.length, 12);
    for (const l of LEADS) assert.ok(MORPH[l], `missing morphology for ${l}`);
  });
  
  it('all 17 AHA segments are named', () => {
    for (let i = 1; i <= 17; i++) assert.ok(segName(i), `segment ${i} unnamed`);
  });
  
  it('ahaSegment reaches every segment and never leaves 1..17', () => {
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
  
  it('scenarios reference real leads, segments and vessels', () => {
    const ids = new Set(VESSEL_IDS);
    for (const sc of SCENARIOS) {
      for (const l of [...sc.elevate, ...sc.depress]) assert.ok(ALL_LEADS.includes(l), `${sc.id}: bad lead ${l}`);
      for (const l of [...sc.expectElevate, ...sc.expectDepress]) assert.ok(LEADS.includes(l), `${sc.id}: bad expected lead ${l}`);
      for (const s of sc.segs) assert.ok(s >= 1 && s <= 17, `${sc.id}: bad segment ${s}`);
      for (const v of sc.dead) assert.ok(ids.has(v), `${sc.id}: unknown vessel ${v}`);
      assert.equal(new Set(sc.elevate).size, sc.elevate.length, `${sc.id}: duplicate elevate lead`);
      const overlap = sc.elevate.filter((l) => sc.depress.includes(l));
      assert.equal(overlap.length, 0, `${sc.id}: ${overlap} both elevated and depressed`);
      assert.ok(sc.distinguish.length > 0, `${sc.id}: no distinguishing points`);
    }
  });
  
  it('baseline is flat in every lead', () => {
    for (const l of LEADS) {
      assert.equal(stAt(l, normal, baseline), 0, `${l} not isoelectric at baseline`);
    }
  });
  
  it('an acute STEMI elevates its own leads and depresses the reciprocals', () => {
    const rca = SCENARIOS.find((s) => s.id === 'rca-prox')!;
    for (const l of rca.elevate) assert.ok(stAt(l, rca, acute) > 0.09, `${l} should be elevated`);
    for (const l of rca.depress) assert.ok(stAt(l, rca, acute) < -0.01, `${l} should be depressed`);
    assert.ok(Math.abs(stAt('V6', rca, acute)) < 0.02, 'V6 should be untouched by an inferior MI');
  });
  
  it('inferior and anterior territories are reciprocal to each other', () => {
    const inf = SCENARIOS.find((s) => s.id === 'rca-mid')!;
    const ant = SCENARIOS.find((s) => s.id === 'lad-prox')!;
    assert.ok(inf.elevate.includes('III') && inf.depress.includes('aVL'));
    assert.ok(ant.elevate.includes('aVL') && ant.depress.includes('III'));
    // Same arrow, opposite ends: the two axes should be close to 180 degrees apart.
    const d = Math.abs(INJURY[inf.id].axis - INJURY[ant.id].axis) % 360;
    const sep = d > 180 ? 360 - d : d;
    assert.ok(sep > 140, `inferior and anterior injury axes are only ${sep.toFixed(0)} deg apart`);
  });
  
  it('Q waves deepen and R waves shrink as the infarct ages', () => {
    const lad = SCENARIOS.find((s) => s.id === 'lad-prox')!;
    const early = leadState('V3', lad, acute).m;
    const late = leadState('V3', lad, old).m;
    assert.ok(late.q < early.q, 'Q should be deeper in an old infarct');
    assert.ok(late.r < early.r, 'R should be smaller in an old infarct');
    assert.ok(Math.abs(stAt('V3', lad, old)) < 0.05, 'ST should be back to baseline by 2 months');
  });
  
  it('subendocardial infarction never grows Q waves', () => {
    const nstemi = SCENARIOS.find((s) => s.id === 'nstemi')!;
    for (const stage of STAGES) {
      for (const l of nstemi.elevate) {
        assert.equal(leadState(l, nstemi, stage).m.q, MORPH[l].q, `${l} grew a Q wave at ${stage.time}`);
      }
    }
  });
  
  it('posterior MI grows a tall R in V2 rather than a Q', () => {
    const post = SCENARIOS.find((s) => s.id === 'pda')!;
    assert.ok(leadState('V2', post, old).m.r > MORPH.V2.r + 0.8, 'V2 R wave should grow');
    assert.ok(stAt('V2', post, acute) < -0.05, 'V2 should be depressed acutely');
  });
  
  it('every stage carries ECG, gross and microscopy text', () => {
    assert.equal(STAGES.length, 10);
    for (const s of STAGES) {
      for (const k of ['time', 'short', 'ecg', 'gross', 'micro', 'ttc']) {
        assert.ok(s[k] && s[k].length > 3, `stage ${s.id} missing ${k}`);
      }
    }
  });
  
  it('ST elevation peaks early and the rupture warning lands at 3-7 days', () => {
    const peak = STAGES.reduce((a, b) => (b.st > a.st ? b : a));
    assert.ok(peak.id <= 3, `ST should peak in the first 12 h, peaked at stage ${peak.id}`);
    assert.match(stageAt(6).risk, /RUPTURE/i);
  });
  
  
  it('the twelve-lead obeys Einthoven and Goldberger at every instant', () => {
    // III = II - I, aVR = -(I+II)/2, aVL = I - II/2, aVF = II - I/2.
    // If any of these fail the trace could not have come off a real patient.
    const at = (lead, sc, stage, t) => {
      const { m, offset } = leadState(lead, sc, stage);
      return beat(t, m, offset);
    };
    for (const sc of SCENARIOS) {
      for (const stage of STAGES) {
        for (let t = 0; t < 0.8; t += 0.01) {
          const I = at('I', sc, stage, t), II = at('II', sc, stage, t);
          const near = (got, want, name) => assert.ok(Math.abs(got - want) < 1e-9,
            `${sc.id} @${stage.time} t=${t.toFixed(2)}: ${name} off by ${(got - want).toExponential(1)}`);
          near(at('III', sc, stage, t), II - I, 'III != II - I');
          near(at('aVR', sc, stage, t), -(I + II) / 2, 'aVR != -(I+II)/2');
          near(at('aVL', sc, stage, t), I - II / 2, 'aVL != I - II/2');
          near(at('aVF', sc, stage, t), II - I / 2, 'aVF != II - I/2');
          // The three augmented leads always sum to zero.
          near(at('aVR', sc, stage, t) + at('aVL', sc, stage, t) + at('aVF', sc, stage, t), 0, 'aVR+aVL+aVF');
        }
      }
    }
  });
  
  it('every lead a scenario is labelled with is really deviated on the trace', () => {
    const peak = STAGES.reduce((a, b) => (b.st > a.st ? b : a));
    for (const sc of SCENARIOS) {
      for (const l of sc.elevate) assert.ok(stDeviation(l, sc, peak) >= 0.1, `${sc.id}: ${l} labelled elevated but is not`);
      for (const l of sc.depress) assert.ok(stDeviation(l, sc, peak) <= -0.05, `${sc.id}: ${l} labelled depressed but is not`);
      const both = sc.elevate.filter((l) => sc.depress.includes(l));
      assert.deepEqual(both, [], `${sc.id}: ${both} in both lists`);
    }
  });
  
  it('the derived labels contain every lead the textbook expects', () => {
    // The curated lists are the expectation; the injury vector must reproduce them.
    // It may find extra reciprocals the shorthand omits, but never fewer.
    for (const sc of SCENARIOS) {
      for (const l of sc.expectElevate) assert.ok(sc.elevate.includes(l),
        `${sc.id}: ${l} should be elevated but the injury vector says ${stDeviation(l, sc, stageAt(3)).toFixed(3)} mV`);
      for (const l of sc.expectDepress) assert.ok(sc.depress.includes(l),
        `${sc.id}: ${l} should be depressed but the injury vector says ${stDeviation(l, sc, stageAt(3)).toFixed(3)} mV`);
    }
  });
  
  it('the ST vector reproduces the discriminations the page teaches', () => {
    const peak = stageAt(3);
    const st = (l, id) => stDeviation(l, SCENARIOS.find((s) => s.id === id)!, peak);
    // Inferior MI: RCA gives III > II with aVL depressed; a lateral lesion does not.
    assert.ok(st('III', 'rca-prox') > st('II', 'rca-prox'), 'RCA should give III greater than II');
    assert.ok(st('aVL', 'rca-prox') < -0.05, 'RCA inferior MI should depress aVL');
    // Proximal LAD: aVL up with inferior reciprocal depression. Mid LAD: neither.
    assert.ok(st('aVL', 'lad-prox') > 0.1 && st('III', 'lad-prox') < -0.05, 'proximal LAD pattern');
    assert.ok(Math.abs(st('aVL', 'lad-mid')) < 0.1, 'mid LAD should spare aVL');
    // Wrap-around LAD: anterior and inferior elevation together, no limb reciprocal depression.
    for (const l of ['V4', 'II', 'III', 'aVF']) assert.ok(st(l, 'lad-wrap') > 0.1, `wrap LAD should elevate ${l}`);
    assert.ok(!['I', 'II', 'III', 'aVL', 'aVF'].some((l) => st(l, 'lad-wrap') < -0.05),
      'wrap-around LAD should show no inferior or lateral reciprocal depression');
    // Left main: aVR elevation must exceed V1 elevation.
    assert.ok(st('aVR', 'lm') > st('V1', 'lm') && st('V1', 'lm') > 0, 'aVR should exceed V1 in left main');
    // Posterior MI is invisible on the standard leads and obvious on V7-V9.
    assert.ok(Math.max(...LEADS.map((l) => st(l, 'pda'))) < 0.1, 'posterior MI should elevate no standard lead');
    assert.ok(st('V7', 'pda') > 0.05, 'posterior leads should pick it up');
  });
  
  it('extra leads only appear where they would actually be recorded', () => {
    const rv = SCENARIOS.find((s) => s.id === 'rca-prox')!;
    const post = SCENARIOS.find((s) => s.id === 'pda')!;
    assert.ok(rv.extras.includes('V4R'), 'a proximal RCA lesion calls for V4R');
    assert.ok(post.extras.includes('V7') && post.extras.includes('V9'), 'a posterior MI calls for V7-V9');
    assert.deepEqual(SCENARIOS.find((s) => s.id === 'lad-mid')!.extras, [], 'a mid LAD needs no extra leads');
    for (const l of EXTRA_LEADS) assert.ok(MORPH[l], `no morphology for ${l}`);
  });
  
  it('ST thresholds follow the Fourth Universal Definition', () => {
    assert.equal(stThreshold('II'), 0.1);
    assert.equal(stThreshold('V2', 'man>=40'), 0.2);
    assert.equal(stThreshold('V2', 'man<30'), 0.25);
    assert.equal(stThreshold('V2', 'man30-39'), 0.25);
    assert.equal(stThreshold('V3', 'woman'), 0.15);
    assert.equal(stThreshold('V7'), 0.05);
    assert.equal(stThreshold('V4R'), 0.05);
    assert.equal(stThreshold('V4R', 'man<30'), 0.1);
  });
  
  it('heart rate matches the haemodynamics the page describes', () => {
    const hr = (id) => SCENARIOS.find((s) => s.id === id)!.hr;
    assert.equal(hr('none'), 75);
    assert.ok(hr('rca-prox') < 60, 'inferior MI should be bradycardic');
    assert.ok(hr('lad-prox') > 95, 'anterior MI should be tachycardic');
    assert.ok(Math.abs(rrFor(60) - 1) < 1e-12, 'rrFor(60) should be one second');
    for (const sc of SCENARIOS) assert.ok(sc.hr > 30 && sc.hr < 160, `${sc.id}: implausible rate ${sc.hr}`);
  });
  
  it('every scenario has an injury vector and every axis is a real bearing', () => {
    for (const sc of SCENARIOS) {
      assert.ok(INJURY[sc.id], `${sc.id}: no injury vector`);
      const { axis, amp, chest } = INJURY[sc.id];
      assert.ok(axis >= -180 && axis <= 180, `${sc.id}: axis ${axis} off the hexaxial circle`);
      assert.ok(amp >= 0 && amp <= 1.2, `${sc.id}: amplitude ${amp}`);
      for (const [l, f] of Object.entries(chest)) {
        assert.ok(!LEAD_AXIS[l], `${sc.id}: ${l} is a frontal lead and must come from the vector, not the chest map`);
        assert.ok((ALL_LEADS as string[]).includes(l), `${sc.id}: unknown chest lead ${l}`);
        assert.ok(Math.abs(f) <= 1.05, `${sc.id}: ${l} fraction ${f} out of range`);
      }
    }
    assert.equal(SCENARIO_HR.none, 75);
  });
  
  
  /* ---- dominance ---- */
  
  it('dominance moves the crux territory between the two systems', () => {
    const lcx = SCENARIOS.find((s) => s.id === 'lcx')!;
    const rca = SCENARIOS.find((s) => s.id === 'rca-mid')!;
    const right = withDominance(lcx, 'right'), left = withDominance(lcx, 'left');
    assert.deepEqual(right.segs, lcx.segs, 'right dominance is the base case');
    for (const g of [3, 4, 9, 10, 15] as DATA.SegmentId[]) assert.ok(left.segs.includes(g), `left-dominant circumflex should take segment ${g}`);
    assert.ok(left.dead.includes('PDA') && left.dead.includes('AVN'), 'left-dominant circumflex feeds the PDA and AV node');
    const rcaLeft = withDominance(rca, 'left');
    assert.deepEqual(rcaLeft.segs, [], 'in a left-dominant heart an RCA lesion spares the left ventricle');
    assert.ok(!rcaLeft.dead.includes('PDA'), 'the PDA is not RCA territory in a left-dominant heart');
    assert.ok(rcaLeft.distinguish.length > rca.distinguish.length, 'the change should be explained to the reader');
  });
  
  it('co-dominance moves the vessel at risk without moving a segment', () => {
    const rca = SCENARIOS.find((s) => s.id === 'rca-mid')!;
    const co = withDominance(rca, 'codominant');
    assert.deepEqual(co.segs, rca.segs, 'the AHA wall map is unchanged by co-dominance');
    assert.ok(!co.dead.includes('PLV'), 'the posterolateral branch comes off the circumflex here');
    assert.ok(co.dead.includes('PDA'), 'the posterior descending still comes off the RCA');
  });
  
  it('every dominance pattern is described and the territory map follows it', () => {
    for (const [id, d] of Object.entries(DOMINANCE)) {
      assert.equal(d.id, id);
      for (const k of ['label', 'prevalence', 'note', 'pdaFrom', 'plvFrom', 'avnFrom']) {
        assert.ok(d[k] && String(d[k]).length > 1, `${id}: missing ${k}`);
      }
    }
    const right = territoryFor('right');
    assert.deepEqual(right.RCA, TERRITORY.RCA);
    const left = territoryFor('left');
    assert.deepEqual(left.RCA, [], 'a left-dominant heart has no RCA left-ventricular territory');
    // Whatever the dominance, all 17 segments are owned exactly once.
    for (const id of Object.keys(DOMINANCE)) {
      const t = territoryFor(id as DATA.DominanceId);
      const all = [...t.LAD, ...t.RCA, ...t.LCX].sort((a, b) => a - b);
      assert.deepEqual(all, Array.from({ length: 17 }, (_, i) => i + 1), `${id}: territory map does not tile the ventricle`);
    }
  });
  
  it('scenarios stay internally valid under every dominance', () => {
    const ids = new Set(VESSEL_IDS);
    for (const dom of Object.keys(DOMINANCE)) {
      for (const sc of SCENARIOS) {
        const d = withDominance(sc, dom as DATA.DominanceId);
        for (const v of d.dead) assert.ok(ids.has(v), `${sc.id}/${dom}: unknown vessel ${v}`);
        for (const g of d.segs) assert.ok(g >= 1 && g <= 17, `${sc.id}/${dom}: bad segment ${g}`);
        assert.equal(new Set(d.segs).size, d.segs.length, `${sc.id}/${dom}: duplicate segment`);
        assert.equal(new Set(d.dead).size, d.dead.length, `${sc.id}/${dom}: duplicate vessel`);
      }
    }
  });
  
  
  /* ---- shape of the heart ---- */
  
  it('LV is a truncated prolate ellipsoid, widest at the equator not the base', () => {
    const rBase = lvRadius(0);
    const rEquator = Math.max(...Array.from({ length: 101 }, (_, i) => lvRadius(i / 100)));
    assert.ok(rBase < rEquator - 0.2, `base ${rBase.toFixed(2)} should be narrower than equator ${rEquator.toFixed(2)}`);
    assert.ok(Math.abs(rEquator - LV_A) < 0.01, 'equatorial radius should equal LV_A');
    // The widest point sits in the basal-to-mid third, as it does on a real ventricle.
    let tWide = 0, best = -1;
    for (let i = 0; i <= 100; i++) { const r = lvRadius(i / 100); if (r > best) { best = r; tWide = i / 100; } }
    assert.ok(tWide > 0.2 && tWide < 0.45, `widest at t=${tWide}, expected the basal-mid junction`);
  });
  
  it('LV apex is closed and rounded, and the long axis is 8-9 cm', () => {
    assert.ok(lvRadius(1) < 0.05, 'apex should close');
    assert.ok(lvRadius(0.98) > lvRadius(1), 'radius should fall monotonically into the apex');
    assert.ok(LV_LEN > 8 && LV_LEN < 9.2, `LV length ${LV_LEN} cm outside the normal range`);
    assert.ok(LV_A * 2 > 6 && LV_A * 2 < 7.2, 'epicardial short axis should be about 6.6 cm');
  });
  
  it('LV wall: posterolateral thicker than septum, apex thinnest, cavity never inverts', () => {
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
    assert.ok(closes !== undefined && closes > 0.9 && closes < 1, `cavity closes at t=${closes}, expected just short of the apex`);
  });
  
  it('the AV plane is oblique, higher posteriorly than anteriorly', () => {
    assert.ok(baseTilt(250) > 0.4, 'posterior annulus should sit high');
    assert.ok(baseTilt(70) < -0.4, 'anterior annulus should sit low');
    assert.ok(Math.abs(baseTilt(160)) < 0.2, 'the tilt should cross zero at the sides');
  });
  
  it('RV is a crescent: zero at both grooves, full over the acute margin', () => {
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
  
  it('RV is shorter than the LV and triangular in the frontal view', () => {
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
  
  it('RV always sits outside the LV epicardium, never inside it', () => {
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
  
  it('the apex points left, inferior and anterior', () => {
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
  
  it('AHA segment boundaries line up with the interventricular grooves', () => {
    // The anterior groove separates anterior from anteroseptal; the posterior groove
    // sits in the inferoseptal sector. Both must be inside the septal half.
    assert.ok(ahaSegment(ANT_GROOVE, 0.15) === 2, 'anterior groove should fall on basal anteroseptal');
    assert.ok(ahaSegment(POST_GROOVE, 0.15) === 3, 'posterior groove should fall on basal inferoseptal');
  });
  
  
  /* ---- papillary muscles, conduction system and valves ---- */
  
  it('both papillary muscles stand inside the cavity on the right walls', () => {
    assert.equal(PAPILLARY.length, 2);
    for (const pm of PAPILLARY) {
      const [base, tip] = papillaryAxisPoints(pm);
      // Base on the endocardium, tip free in the cavity and closer to the axis.
      const rBase = Math.hypot(base[0], base[2]), rTip = Math.hypot(tip[0], tip[2]);
      assert.ok(Math.abs(rBase - lvEndo(pm.theta, pm.base)) < 1e-9, `${pm.id}: base is off the endocardium`);
      assert.ok(rTip < rBase, `${pm.id}: tip should lean towards the long axis`);
      assert.ok(rTip + pm.r1 < lvEndo(pm.theta, pm.tip) + 1e-9, `${pm.id}: tip pokes through the wall`);
      // Length: real papillary muscles are 2-3.5 cm.
      const len = Math.hypot(tip[0] - base[0], tip[1] - base[1], tip[2] - base[2]);
      assert.ok(len > 2 && len < 3.6, `${pm.id} is ${len.toFixed(1)} cm long`);
      assert.ok(base[1] > LV_BOT && tip[1] < lvSurfY(pm.theta, 0), `${pm.id} outside the ventricle`);
      assert.ok(pm.r0 > pm.r1, `${pm.id} should taper towards the chordae`);
    }
    // One on the anterolateral wall, one on the inferoseptal side, roughly opposite.
    const [al, pm2] = PAPILLARY;
    assert.equal(al.id, 'ALPM');
    assert.equal(pm2.id, 'PMPM');
    const d = Math.abs(al.theta - pm2.theta) % 360;
    assert.ok(Math.min(d, 360 - d) > 150, 'the two muscles should sit near-opposite each other');
  });
  
  it('the posteromedial papillary muscle is the single-supply one', () => {
    const al = PAPILLARY.find((p) => p.id === 'ALPM')!;
    const pm = PAPILLARY.find((p) => p.id === 'PMPM')!;
    assert.ok(al.dual && al.supply.length === 2, 'anterolateral supply should be dual');
    assert.ok(!pm.dual && pm.supply.length === 1, 'posteromedial supply should be single');
    assert.deepEqual(pm.supply, ['PDA'], 'and that single supply is the posterior descending');
    const ids = new Set(VESSEL_IDS);
    for (const p of PAPILLARY) for (const v of p.supply) assert.ok(ids.has(v), `unknown vessel ${v}`);
  });
  
  it('the conduction system is continuous and correctly supplied', () => {
    const ids = new Set(VESSEL_IDS);
    const byId = Object.fromEntries(CONDUCTION.map((c) => [c.id, c]));
    for (const k of ['SAN', 'AVN', 'HIS', 'RBB', 'LAF', 'LPF']) assert.ok(byId[k], `missing ${k}`);
    for (const part of CONDUCTION) {
      for (const v of part.supply) assert.ok(ids.has(v), `${part.id}: unknown vessel ${v}`);
      assert.ok(part.block && part.note, `${part.id}: undocumented`);
      if (part.kind === 'path') {
        assert.ok(part.path.length >= 2, `${part.id}: needs a path`);
        for (const p of part.path) assert.ok(p.length === 3 && p.every(Number.isFinite), `${part.id}: bad point`);
      } else {
        assert.ok(part.at.length === 3 && part.r > 0, `${part.id}: bad node`);
      }
    }
    // The His bundle must start where the AV node sits — one axis, not two.
    const hisStart = byId.HIS!.path![0]!, avnAt = byId.AVN!.at!;
    const gap = Math.hypot(hisStart[0] - avnAt[0], hisStart[1] - avnAt[1], hisStart[2] - avnAt[2]);
    assert.ok(gap < 1e-9, `the His bundle starts ${gap.toFixed(2)} cm from the AV node`);
    // Both fascicles must leave the same point on the septal crest.
    const laf = byId.LAF!.path![0]!, lpf = byId.LPF!.path![0]!;
    const split = Math.hypot(laf[0] - lpf[0], laf[1] - lpf[1], laf[2] - lpf[2]);
    assert.ok(split < 1e-9, 'the two fascicles should branch from one point');
    // Thin single-supply parts vs broad dual-supply ones.
    assert.ok(!byId.RBB!.dual && !byId.LAF!.dual, 'right bundle and anterior fascicle are single-supply');
    assert.ok(byId.LPF!.dual && byId.HIS!.dual, 'posterior fascicle and His bundle are dual-supplied');
    assert.ok(byId.LPF!.r > byId.LAF!.r, 'the posterior fascicle is the broader of the two');
  });
  
  it('a dual-supplied part only fails when both its arteries go', () => {
    const state = (dead) => Object.fromEntries(conductionState(dead).map((p) => [p.id, p.failed]));
    assert.equal(state(['S1']).RBB, true, 'one septal perforator takes the right bundle');
    assert.equal(state(['S1']).LAF, true, 'and the left anterior fascicle with it');
    assert.equal(state(['S1']).LPF, false, 'but not the dual-supplied posterior fascicle');
    assert.equal(state(['S1']).HIS, false, 'nor the dual-supplied His bundle');
    assert.equal(state(['S1', 'PDA']).LPF, true, 'losing both supplies does take it');
    assert.equal(state(['S1', 'AVN']).HIS, true, 'and the same for the His bundle');
    assert.equal(state([]).SAN, false, 'nothing fails when nothing is occluded');
  });
  
  it('the conduction readout matches the two rules the page teaches', () => {
    const sc = (id) => SCENARIOS.find((s) => s.id === id)!;
    // Proximal LAD takes the septal perforators: bifascicular block.
    const ant = conductionSummary(sc('lad-prox').dead)!;
    assert.match(ant.name, /Bifascicular/i);
    // Mid LAD spares the first septal perforator, so the bundles survive.
    assert.ok(!sc('lad-mid').dead.includes('S1'), 'a mid LAD lesion is past the first septal');
    assert.ok(!conductionState(sc('lad-mid').dead).some((p) => p.id === 'LAF' && p.failed),
      'a mid LAD lesion should not cause fascicular block');
    // Proximal RCA takes both nodes: narrow-complex, atropine-responsive block.
    const inf = conductionSummary(sc('rca-prox').dead)!;
    assert.match(inf.detail, /narrow complex/i);
    // A right-dominant circumflex lesion touches neither node.
    assert.equal(conductionSummary(sc('lcx').dead), null, 'a right-dominant LCx lesion spares the conduction system');
    // A left-dominant one reaches the AV node.
    assert.ok(withDominance(sc('lcx'), 'left').dead.includes('AVN'),
      'a left-dominant circumflex supplies the AV node');
  });
  
  it('the four valve annuli hold their real spatial relationships', () => {
    assert.equal(VALVES.length, 4);
    const v = (id) => valveById(id);
    const [m, t, a, p] = (['mitral', 'tricuspid', 'aortic', 'pulmonary'] as const)
      .map((id) => valveById(id)!);
    // Diameters, from the CMR reference ranges.
    assert.ok(t.r > m.r, 'the tricuspid annulus is the larger of the two AV valves');
    assert.ok(m.r * 2 > 2.4 && m.r * 2 < 3.2, `mitral annulus ${(m.r * 2).toFixed(1)} cm`);
    assert.ok(t.r * 2 > 2.7 && t.r * 2 < 3.6, `tricuspid annulus ${(t.r * 2).toFixed(1)} cm`);
    assert.ok(a.r * 2 > 1.9 && a.r * 2 < 2.7, `aortic annulus ${(a.r * 2).toFixed(1)} cm`);
    // The tricuspid sits 5-8 mm apical to the mitral. Losing that offset is Ebstein's.
    const offset = m.c[1] - t.c[1];
    assert.ok(offset > 0.4 && offset < 0.9, `mitral-tricuspid offset ${offset.toFixed(2)} cm`);
    // The pulmonary valve is the most anterior and the most superior of the four.
    for (const other of [m, t, a]) {
      assert.ok(p.c[2] > other.c[2], `the pulmonary valve should sit anterior to the ${other.id}`);
      assert.ok(p.c[1] > other.c[1], `the pulmonary valve should sit above the ${other.id}`);
    }
    // Aortic-mitral fibrous continuity: the two annuli touch.
    const sep = Math.hypot(a.c[0] - m.c[0], a.c[1] - m.c[1], a.c[2] - m.c[2]);
    assert.ok(sep < a.r + m.r, 'the aortic and mitral annuli should be in fibrous continuity');
    // The aortic valve is the keystone: it sits between the mitral and the tricuspid.
    assert.ok(a.c[0] < m.c[0] && a.c[0] > t.c[0], 'the aortic valve is wedged between the AV valves');
    for (const valve of VALVES) {
      assert.equal(valve.normal.length, 3);
      assert.ok(valve.leaflets === 2 || valve.leaflets === 3, `${valve.id}: leaflet count`);
      assert.ok(valve.note.length > 20, `${valve.id}: undocumented`);
    }
  });
  
  
  /* ---- camera fitting ---- */

  it('every corner of the box lands inside the frustum, and only just', () => {
    const min: DATA.Vec3 = [-5, -6, -4], max: DATA.Vec3 = [5, 3, 4];
    const centre: DATA.Vec3 = [0, -1.5, 0];
    const corners = boxCorners(min, max);
    assert.equal(corners.length, 8);

    for (const dir of [[0, 0, 1], [1, 0, 0], [0, 1, 0], [0.5, 0.28, 1], [0.55, -0.72, 0.42]] as DATA.Vec3[]) {
      for (const aspect of [0.6, 1, 1.85, 3]) {
        const fov = 42, margin = 1.06;
        const d = (() => { const l = Math.hypot(...dir); return dir.map((v) => v / l) as DATA.Vec3; })();
        const dist = fitDistance(corners, centre, d, fov, aspect, margin);
        const { right, up } = viewBasis(d);
        const vHalf = ((fov * Math.PI) / 180) / 2;
        const hHalf = Math.atan(Math.tan(vHalf) * aspect);
        const eye = centre.map((c, i) => c + d[i]! * dist) as DATA.Vec3;

        let worstV = 0, worstH = 0;
        for (const c of corners) {
          const o = c.map((v, i) => v - eye[i]!) as DATA.Vec3;
          // Depth along the view axis, from the camera towards the target.
          const depth = -(o[0] * d[0]! + o[1] * d[1]! + o[2] * d[2]!);
          assert.ok(depth > 0, `corner behind the camera at aspect ${aspect}`);
          const v = Math.abs(o[0] * up[0]! + o[1] * up[1]! + o[2] * up[2]!) / (depth * Math.tan(vHalf));
          const h = Math.abs(o[0] * right[0]! + o[1] * right[1]! + o[2] * right[2]!) / (depth * Math.tan(hHalf));
          worstV = Math.max(worstV, v);
          worstH = Math.max(worstH, h);
        }
        // Inside the frame...
        assert.ok(worstV <= 1 && worstH <= 1,
          `corner clipped at aspect ${aspect}: v=${worstV.toFixed(3)} h=${worstH.toFixed(3)}`);
        // ...and filling it. A bounding-sphere fit scores about 0.7 here, which
        // is the gap that left the heart small in an empty viewport.
        assert.ok(Math.max(worstV, worstH) > 0.82,
          `only filling ${(Math.max(worstV, worstH) * 100).toFixed(0)}% at aspect ${aspect}`);
      }
    }
  });

  it('fitting beats a bounding sphere on a heart-shaped box', () => {
    const corners = boxCorners([-5, -6, -4], [5, 3, 4]);
    const centre: DATA.Vec3 = [0, -1.5, 0];
    const dir: DATA.Vec3 = [0, 0, 1];
    const tight = fitDistance(corners, centre, dir, 42, 1.85);
    // What the old code did: half the box diagonal, fitted vertically.
    const radius = Math.max(...corners.map((c) => Math.hypot(c[0] - centre[0], c[1] - centre[1], c[2] - centre[2])));
    const sphere = (radius / Math.sin(((42 * Math.PI) / 180) / 2)) * 1.08;
    assert.ok(tight < sphere * 0.75,
      `sphere fit ${sphere.toFixed(1)} vs corner fit ${tight.toFixed(1)} — expected a clear gain`);
  });

  it('the view basis stays well defined looking straight down the long axis', () => {
    for (const dir of [[0, 1, 0], [0, -1, 0], [0, 0.999, 0.001]] as DATA.Vec3[]) {
      const { right, up } = viewBasis(dir);
      for (const v of [right, up]) {
        assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-9, 'basis vector should be unit length');
        assert.ok(v.every(Number.isFinite), 'basis went non-finite straight down the axis');
      }
      const d = (() => { const l = Math.hypot(...dir); return dir.map((x) => x / l); })();
      assert.ok(Math.abs(right[0] * up[0] + right[1] * up[1] + right[2] * up[2]) < 1e-9, 'right and up should be perpendicular');
      assert.ok(Math.abs(right[0] * d[0]! + right[1] * d[1]! + right[2] * d[2]!) < 1e-9, 'right should be perpendicular to the view');
    }
  });


  it('every named view stands the heart on its apex and names its own face', () => {
    // Where a local landmark lands on screen, in camera axes.
    const dot3 = (a: DATA.Vec3, b: DATA.Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross3 = (a: DATA.Vec3, b: DATA.Vec3): DATA.Vec3 =>
      [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const unit = (a: DATA.Vec3): DATA.Vec3 => {
      const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l];
    };
    const LOCAL = {
      apex: [0, -1, 0], base: [0, 1, 0], anterior: [0, 0, 1],
      inferior: [0, 0, -1], lateral: [1, 0, 0], septal: [-1, 0, 0],
    } satisfies Record<string, DATA.Vec3>;

    const screen = (view: DATA.ViewName) => {
      const spec = VIEW_LOCAL[view];
      const dir = localDirToWorld(spec.dir);          // target towards camera
      const right = unit(cross3(localDirToWorld(spec.up), dir));
      const up = unit(cross3(dir, right));
      return Object.fromEntries(Object.entries(LOCAL).map(([k, v]) => {
        const w = localDirToWorld(v as DATA.Vec3);
        return [k, { x: dot3(w, right), y: dot3(w, up), z: dot3(w, dir) }];
      })) as Record<keyof typeof LOCAL, { x: number; y: number; z: number }>;
    };

    // Apex down and base up in every view that looks side-on at the heart.
    for (const view of ['anterior', 'inferior', 'lateral', 'septal', 'anterolateral'] as DATA.ViewName[]) {
      const p = screen(view);
      assert.ok(p.apex.y < -0.9, `${view}: the apex should hang straight down, got y=${p.apex.y.toFixed(2)}`);
      assert.ok(p.base.y > 0.9, `${view}: the base should sit at the top`);
    }

    // Each view faces the surface it is named after.
    const faces: [DATA.ViewName, keyof typeof LOCAL][] = [
      ['anterior', 'anterior'], ['inferior', 'inferior'],
      ['lateral', 'lateral'], ['septal', 'septal'],
    ];
    for (const [view, surface] of faces) {
      const p = screen(view);
      assert.ok(p[surface].z > 0.95, `${view} should look straight at the ${surface} surface`);
    }

    // Anterior is what a reader looks at first: the patient's left is on the
    // right of the screen, as it is on every chest film and every plate.
    const ant = screen('anterior');
    assert.ok(ant.lateral.x > 0.9, 'the LV free wall belongs on the right in an anterior view');
    assert.ok(ant.septal.x < -0.9, 'the septum belongs on the left in an anterior view');

    // Going round the back mirrors left and right, as it must.
    const inf = screen('inferior');
    assert.ok(inf.lateral.x < 0, 'the inferior view should mirror the anterior one');

    // The short axis must match the bullseye drawn beside it, or the two
    // readouts of the same territory disagree on screen.
    const sa = screen('apex');
    assert.ok(sa.apex.z > 0.9, 'the short axis looks up the long axis from the apex');
    assert.ok(sa.anterior.y > 0.9, 'anterior at the top, as on the bullseye');
    assert.ok(sa.inferior.y < -0.9, 'inferior at the bottom');
    assert.ok(sa.lateral.x > 0.9, 'lateral to the right');
    assert.ok(sa.septal.x < -0.9, 'septal to the left');
  });

  it('the view table is complete and every direction is usable', () => {
    for (const [name, spec] of Object.entries(VIEW_LOCAL)) {
      for (const v of [spec.dir, spec.up]) {
        assert.ok(Math.hypot(...v) > 0.5, `${name}: degenerate vector`);
        assert.ok(v.every(Number.isFinite), `${name}: non-finite vector`);
      }
      // A view direction parallel to its own up has no defined camera roll.
      const d = spec.dir, u = spec.up;
      const cosine = (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / (Math.hypot(...d) * Math.hypot(...u));
      assert.ok(Math.abs(cosine) < 0.9, `${name}: up is nearly parallel to the view direction`);
    }
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
  
  for (const [name, spec] of [['LV', LV_SPEC], ['RV', RV_SPEC]] as const) {
    it(`${name} mesh is watertight and well-formed`, () => {
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
  
  it('the LV mesh spans a plausible heart-sized volume', () => {
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
    const best: Record<string, { v: number; who: string }> = {};
    const tests: Record<string, (p: DATA.Vec3) => number> = {
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
    for (const [name, A] of [['LA', LA_POS], ['RA', RA_POS]] as const) {
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
  
  it('each border and surface is formed by the right chamber', () => {
    const { best } = surveyWorld();
    assert.equal(best['right']!.who, 'RA', 'the right border of the heart is the right atrium');
    assert.equal(best['left']!.who, 'LV', 'the left border is the left ventricle');
    assert.equal(best['posterior']!.who, 'LA', 'the base of the heart is the left atrium');
    assert.equal(best['low']!.who, 'LV', 'the apex is left ventricular');
    assert.equal(best['anterior']!.who, 'RV', 'the sternocostal surface is the right ventricle');
  });
  
  it('the right ventricle takes a large share of the sternocostal surface', () => {
    const { rvFrontShare } = surveyWorld();
    // Roughly half to two thirds in life. A crescent grown off the LV axis still
    // under-represents that, so this guards the direction of travel, not the textbook value.
    assert.ok(rvFrontShare > 0.33, `RV covers only ${(rvFrontShare * 100).toFixed(0)}% of the frontal area`);
    assert.ok(rvFrontShare < 0.75, 'RV should not swamp the left ventricle');
  });
  
  it('the heart is a plausible size in all three dimensions', () => {
    const pts = silhouetteCloud(3);
    const ext = (i) => { const v = pts.map((p) => p[i]); return Math.max(...v) - Math.min(...v); };
    const w = ext(0), h = ext(1), d = ext(2);
    assert.ok(w > 8 && w < 13, `transverse ${w.toFixed(1)} cm`);
    assert.ok(h > 8 && h < 13, `vertical ${h.toFixed(1)} cm`);
    assert.ok(d > 5 && d < 11, `anteroposterior ${d.toFixed(1)} cm`);
  });
  
  it('the frontal silhouette matches the reference diagram', () => {
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
  
  
  
  // Import hygiene is enforced by tsc: noUnusedLocals catches an unused import
  // and a missing one is a type error, both on every build.

  
  
  /* ---- scanned geometry, if it has been built ---- */
  
  const MODELS = new URL('../public/models/heart-meshes.json', import.meta.url);
  if (fs.existsSync(MODELS.pathname)) {
    const man = JSON.parse(fs.readFileSync(MODELS.pathname, 'utf8'));
  
    it('scanned manifest carries every part the page asks for', () => {
      for (const key of ['lv', 'rv', 'la', 'ra', 'mv', 'tv', 'av', 'pv', 'pap']) {
        const part = man.parts[key];
        assert.ok(part, `missing part ${key}`);
        assert.ok(part.triangles > 1000, `${key} has only ${part.triangles} triangles`);
        assert.ok(part.centroid && part.centroid.length === 3, `${key} has no centroid`);
        assert.ok(['chamber', 'apparatus'].includes(part.role), `${key} has no role`);
        const expected = 8 + part.vertices * 12 + part.triangles * 12;
        const size = fs.statSync(new URL(`../public/models/${part.file}`, import.meta.url).pathname).size;
        assert.equal(size, expected, `${key}.bin is ${size} bytes, header implies ${expected}`);
      }
      assert.equal(man.lvTop, LV_TOP, 'manifest built against a different LV_TOP');
      assert.equal(man.lvLen, LV_LEN, 'manifest built against a different LV_LEN');
      // The left ventricle carries the segment colours per vertex, so it must be the finest.
      assert.ok(man.parts.lv.triangles > 15000, `the LV mesh is only ${man.parts.lv.triangles} triangles`);
    });
  
    it('the scanned chambers are chamber-sized, not vein-sized', () => {
      // BodyParts3D models the cavae and the pulmonary veins as part of the atrial
      // wall. Untrimmed they make each atrium 9 cm across and drive it through the
      // ventricles below, so the build script clips them; this is that guard.
      for (const key of ['la', 'ra']) {
        const [w, h, d] = man.parts[key].bbox;
        assert.ok(Math.max(w, h, d) < 6.5, `${key} is ${Math.max(w, h, d)} cm across — the veins are still attached`);
        assert.ok(Math.max(w, h, d) > 3.5, `${key} is only ${Math.max(w, h, d)} cm across — over-trimmed`);
      }
      for (const key of ['lv', 'rv']) {
        const h = man.parts[key].bbox[1];
        assert.ok(h > 7 && h < 9.5, `${key} is ${h} cm base to apex`);
      }
    });
  
    it('the scanned parts hold their real spatial relationships', () => {
      const c: Record<string, number[]> = Object.fromEntries(
        Object.entries(man.parts).map(([k, p]) => [k, (p as { centroid: number[] }).centroid]));
      assert.ok(c.ra[0] < c.la[0], 'the right atrium should lie to the patient\'s right of the left');
      assert.ok(c.rv[0] < c.lv[0], 'the right ventricle should lie to the patient\'s right of the left');
      assert.ok(c.la[1] > c.mv[1], 'the left atrium should sit above the mitral valve');
      assert.ok(c.ra[1] > c.tv[1], 'the right atrium should sit above the tricuspid valve');
      assert.ok(c.pap[1] < c.mv[1], 'the papillary muscles should hang below the mitral valve');
      assert.ok(c.tv[0] < c.av[0] && c.av[0] < c.mv[0],
        'the aortic valve is the keystone, wedged between the two AV valves');
      assert.ok(c.pv[2] > Math.max(c.mv[2], c.tv[2], c.av[2]),
        'the pulmonary valve should be the most anterior of the four');
      assert.ok(Math.min(c.av[2], c.pv[2]) > Math.max(c.mv[2], c.tv[2]),
        'both arterial valves should sit anterior to both AV valves');
    });
  
    it('the scanned grooves agree with the model\'s groove angles', () => {
      // Measured from the LAD and PDA centroids in the registered frame.
      assert.ok(Math.abs(man.grooves.anterior - ANT_GROOVE) < 10,
        `scanned anterior groove ${man.grooves.anterior} vs model ${ANT_GROOVE}`);
      assert.ok(Math.abs(man.grooves.posterior - POST_GROOVE) < 10,
        `scanned posterior groove ${man.grooves.posterior} vs model ${POST_GROOVE}`);
    });
  
    it('scanned height maps are usable for placing vessels', () => {
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
  
    it('scanned points land on the scanned surface', () => {
      const sample = heightSampler(man.lvHeightMap);
      for (const th of [0, 90, 180, 270]) {
        for (const t of [0.2, 0.5, 0.8]) {
          const p = sampledPoint(sample, th, t);
          assert.ok(Math.abs(Math.hypot(p[0], p[2]) - sample(th, t)) < 1e-6, 'radius mismatch');
          assert.ok(Math.abs(p[1] - lvY(t)) < 1e-6, 'height mismatch');
        }
      }
    });
  }
  
  
});
