/* Clinical data and pure signal maths for the heart lab.
 * No Three.js, no DOM — so it can be unit-tested in Node (see test_heart.mjs). */

/* ------------------------------------------------------------------ *
 * 1. CLINICAL DATA
 * ------------------------------------------------------------------ */

export const LEADS = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];

// Normal deflection amplitudes in mV. r may be negative where the net QRS is negative (aVR, V1).
export const MORPH = {
  I:   { p: 0.10, q: -0.04, r: 0.75, s: -0.08, t: 0.22 },
  II:  { p: 0.15, q: -0.04, r: 1.15, s: -0.10, t: 0.32 },
  III: { p: 0.06, q: -0.03, r: 0.45, s: -0.12, t: 0.10 },
  aVR: { p: -0.12, q: 0.00, r: -0.85, s: 0.00, t: -0.25 },
  aVL: { p: 0.06, q: -0.03, r: 0.40, s: -0.10, t: 0.12 },
  aVF: { p: 0.11, q: -0.03, r: 0.70, s: -0.10, t: 0.20 },
  V1:  { p: 0.08, q: 0.00, r: 0.20, s: -1.05, t: -0.05 },
  V2:  { p: 0.10, q: 0.00, r: 0.35, s: -1.50, t: 0.35 },
  V3:  { p: 0.10, q: 0.00, r: 0.70, s: -1.00, t: 0.40 },
  V4:  { p: 0.10, q: -0.04, r: 1.45, s: -0.55, t: 0.38 },
  V5:  { p: 0.10, q: -0.06, r: 1.35, s: -0.25, t: 0.30 },
  V6:  { p: 0.09, q: -0.05, r: 1.00, s: -0.12, t: 0.22 },
};

// AHA 17-segment model.
export const SEG_NAME = {
  1: 'basal anterior', 2: 'basal anteroseptal', 3: 'basal inferoseptal', 4: 'basal inferior',
  5: 'basal inferolateral', 6: 'basal anterolateral',
  7: 'mid anterior', 8: 'mid anteroseptal', 9: 'mid inferoseptal', 10: 'mid inferior',
  11: 'mid inferolateral', 12: 'mid anterolateral',
  13: 'apical anterior', 14: 'apical septal', 15: 'apical inferior', 16: 'apical lateral',
  17: 'apex',
};

export const TERRITORY = {
  LAD: [1, 2, 7, 8, 13, 14, 17],
  RCA: [3, 4, 9, 10, 15],
  LCX: [5, 6, 11, 12, 16],
};

// Evolution of a transmural infarct. st = ST elevation in mV at the J point.
// tMul scales the normal T wave (negative = inverted). q = fraction of a full pathological Q.
export const STAGES = [
  {
    id: 0, time: 'Normal', short: 'Baseline',
    st: 0, tMul: 1, q: 0,
    ecg: 'Normal 12-lead. Concordant R-wave progression V1→V6, no ST shift, no pathological Q.',
    gross: 'Myocardium uniformly red-brown and firm. Coronary arteries patent on cross-section.',
    micro: 'Normal myofibres with central nuclei and visible cross-striations.',
    ttc: 'Whole slice stains brick-red with TTC — dehydrogenases intact throughout.',
    risk: '',
  },
  {
    id: 1, time: '0–30 min', short: 'Hyperacute',
    st: 0.06, tMul: 2.4, q: 0,
    ecg: 'Tall, broad, symmetrical hyperacute T waves — often the only change, and easily missed. ST elevation is still minimal. Loss of normal ST concavity.',
    gross: 'No visible change. This is the window of reversible injury — nothing to see with the naked eye.',
    micro: 'Nothing on H&E. Electron microscopy: glycogen depletion, mitochondrial swelling, sarcolemmal relaxation.',
    ttc: 'TTC still stains the whole slice red. The stain cannot detect infarction before about 2–3 hours.',
    risk: 'Ventricular fibrillation risk is highest in this first hour, before the patient reaches hospital.',
  },
  {
    id: 2, time: '30 min – 4 h', short: 'Acute STEMI',
    st: 0.32, tMul: 1.6, q: 0,
    ecg: 'Convex ("tombstone") ST elevation in the territory leads, with reciprocal ST depression in the opposite leads. Reciprocal change is the most reliable sign that elevation is ischaemic rather than benign.',
    gross: 'Still essentially normal, or at most a faint dusky discoloration. Irreversible injury begins at 20–40 min but is invisible.',
    micro: 'Wavy fibres at the infarct border; early coagulative necrosis. Contraction band necrosis if reperfused.',
    ttc: 'From roughly 2–3 h the infarct fails to stain and appears pale against brick-red viable muscle.',
    risk: 'Malignant ventricular arrhythmia. Reperfusion within this window salvages the most myocardium.',
  },
  {
    id: 3, time: '4–12 h', short: 'Established',
    st: 0.36, tMul: 1.2, q: 0.15,
    ecg: 'ST elevation at its maximum. Early loss of R-wave height in the affected leads as viable muscle is lost.',
    gross: 'Dark mottling begins — patchy blue-red discoloration from stagnant trapped blood.',
    micro: 'Coagulative necrosis well underway. Oedema, haemorrhage, early neutrophil margination.',
    ttc: 'Sharply demarcated pale unstained zone.',
    risk: '',
  },
  {
    id: 4, time: '12–24 h', short: 'Q waves appear',
    st: 0.30, tMul: 0.6, q: 0.35,
    ecg: 'Pathological Q waves develop (>40 ms wide, or >25% of R height). ST elevation begins to settle; T waves start to flatten then invert.',
    gross: 'Dark mottling now obvious across the infarct.',
    micro: 'Full coagulative necrosis — nuclei lost (karyolysis), striations gone. Contraction bands. Brisk neutrophil infiltrate.',
    ttc: 'Pale infarct with a clear border.',
    risk: '',
  },
  {
    id: 5, time: '1–3 days', short: 'Neutrophilic',
    st: 0.18, tMul: -0.6, q: 0.6,
    ecg: 'ST elevation resolving, deep symmetrical T-wave inversion appearing, Q waves established.',
    gross: 'Infarct centre turns yellow-tan and softens; a hyperaemic red border appears at the edge.',
    micro: 'Dense neutrophilic infiltrate with early karyorrhexis of the neutrophils themselves.',
    ttc: 'Yellow-tan centre, unstained.',
    risk: 'Fibrinous pericarditis over a transmural infarct — pleuritic pain and a friction rub.',
  },
  {
    id: 6, time: '3–7 days', short: 'Macrophage / soft',
    st: 0.10, tMul: -1.0, q: 0.8,
    ecg: 'ST back near baseline. Deep, symmetrical T-wave inversion. Established Q waves.',
    gross: 'Maximally yellow, soft and friable centre with a depressed hyperaemic rim. This is the weakest the wall will ever be.',
    micro: 'Macrophages clearing necrotic myocytes; dying neutrophils. Early granulation tissue at the margins.',
    ttc: 'Soft yellow centre.',
    risk: 'PEAK MECHANICAL RUPTURE RISK — free wall rupture with tamponade, ventricular septal rupture, papillary muscle rupture.',
  },
  {
    id: 7, time: '7–14 days', short: 'Granulation',
    st: 0.05, tMul: -0.9, q: 0.95,
    ecg: 'Persistent T-wave inversion and Q waves.',
    gross: 'Red-grey depressed infarct borders as granulation tissue grows inward from the edge.',
    micro: 'Well-established granulation tissue: new capillaries, fibroblasts, early collagen.',
    ttc: 'Grey-red rim, pale core.',
    risk: '',
  },
  {
    id: 8, time: '2–8 weeks', short: 'Scarring',
    st: 0.02, tMul: -0.4, q: 1.0,
    ecg: 'Q waves persist. T waves gradually return towards upright.',
    gross: 'Grey-white scar progressing from the border towards the core.',
    micro: 'Increasing collagen, falling cellularity.',
    ttc: 'Scar does not stain.',
    risk: 'Dressler syndrome (autoimmune pericarditis). Mural thrombus over an akinetic apex.',
  },
  {
    id: 9, time: '> 2 months', short: 'Old infarct',
    st: 0, tMul: 0.3, q: 1.0,
    ecg: 'Pathological Q waves only — the permanent electrical footprint. ST elevation persisting beyond 2–3 weeks suggests a left ventricular aneurysm.',
    gross: 'Dense, firm, white collagenous scar. The wall is thinned and may be frankly aneurysmal.',
    micro: 'Acellular dense collagen.',
    ttc: 'White scar, unstained.',
    risk: 'LV aneurysm, mural thrombus with systemic embolism, ischaemic cardiomyopathy, scar-related VT.',
  },
];

// Occlusion scenarios. `dead` lists vessel ids that lose flow; `segs` the AHA segments infarcted.
export const SCENARIOS = [
  {
    id: 'none', name: 'No occlusion (normal)', wall: '—', artery: '—',
    dead: [], segs: [], elevate: [], depress: [], rv: false, subendo: false,
    leads: 'Normal.',
    distinguish: ['Use this as the baseline. Step the timeline and nothing changes, because nothing is occluded.'],
    gross: 'Normal heart. Coronary arteries patent, myocardium uniformly red-brown.',
  },
  {
    id: 'lm', name: 'Left main occlusion', wall: 'Anterior + lateral (massive)', artery: 'Left main coronary artery',
    dead: ['LM', 'LAD1', 'LAD2', 'LAD3', 'D1', 'D2', 'S1', 'S2', 'S3', 'LCX1', 'LCX2', 'OM1', 'OM2'],
    segs: [1, 2, 6, 7, 8, 11, 12, 13, 14, 16, 17, 5],
    elevate: ['aVR', 'V1'], depress: ['I', 'II', 'aVF', 'V3', 'V4', 'V5', 'V6', 'III'],
    rv: false, subendo: false,
    leads: 'ST elevation in aVR greater than in V1, with widespread ST depression in eight or more leads.',
    distinguish: [
      'The pattern is global subendocardial ischaemia, not a single territory — widespread ST depression with ST elevation only in aVR.',
      'aVR elevation > V1 elevation favours left main over proximal LAD.',
      'Almost always in cardiogenic shock. Same ECG can be produced by severe triple-vessel disease.',
    ],
    gross: 'Very large infarct of the entire anterior wall, septum, apex and lateral wall. Occlusive thrombus in the left main stem within 1 cm of the ostium.',
  },
  {
    id: 'lad-prox', name: 'Proximal LAD (before D1 and S1)', wall: 'Extensive anterior', artery: 'Left anterior descending',
    dead: ['LAD1', 'LAD2', 'LAD3', 'D1', 'D2', 'S1', 'S2', 'S3'],
    segs: [1, 2, 6, 7, 8, 12, 13, 14, 17],
    elevate: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'I', 'aVL'], depress: ['III', 'aVF', 'II'],
    rv: false, subendo: false,
    leads: 'ST elevation V1–V6 plus I and aVL, with reciprocal depression in II, III and aVF.',
    distinguish: [
      'ST elevation in aVR and/or V1 over 2.5 mm, or new right bundle branch block with left anterior fascicular block, places the lesion proximal to the first septal perforator.',
      'ST elevation in aVL with reciprocal depression inferiorly places it proximal to the first diagonal.',
      'Anterior MI causes tachycardia and pump failure — the opposite of the bradycardia seen with inferior MI.',
    ],
    gross: 'Pale then yellow infarct of the anterior free wall, the anterior two-thirds of the interventricular septum and the apex. Thrombus in the LAD in the anterior interventricular groove, proximal to the first diagonal.',
  },
  {
    id: 'lad-mid', name: 'Mid LAD (after D1)', wall: 'Anteroseptal', artery: 'Left anterior descending',
    dead: ['LAD2', 'LAD3', 'D2', 'S2', 'S3'],
    segs: [1, 2, 7, 8, 13, 14, 17],
    elevate: ['V1', 'V2', 'V3', 'V4'], depress: ['III'],
    rv: false, subendo: false,
    leads: 'ST elevation V1–V4 (anteroseptal), little or no limb-lead change.',
    distinguish: [
      'No ST elevation in aVL and no reciprocal inferior depression — that is what separates mid from proximal LAD.',
      'Septal involvement shows as V1–V2 elevation with loss of the septal q in I, aVL, V5 and V6.',
    ],
    gross: 'Infarct confined to the anterior wall and anterior septum, sparing the basal anterolateral wall supplied by the first diagonal.',
  },
  {
    id: 'lad-wrap', name: 'Distal / wrap-around LAD', wall: 'Apical + inferoapical', artery: 'LAD (type III, wraps the apex)',
    dead: ['LAD3'],
    segs: [13, 14, 15, 16, 17],
    elevate: ['V3', 'V4', 'V5', 'V6', 'II', 'III', 'aVF'], depress: [],
    rv: false, subendo: false,
    leads: 'ST elevation in the apical precordial leads AND the inferior leads at the same time.',
    distinguish: [
      'Simultaneous anterior and inferior ST elevation with no reciprocal depression is the signature of a wrap-around LAD, not two separate occlusions.',
      'A true inferior MI would show reciprocal depression in I and aVL; here there is none.',
    ],
    gross: 'Infarct of the apex extending onto the inferoapical wall. The LAD can be traced around the apex into the posterior interventricular groove.',
  },
  {
    id: 'd1', name: 'First diagonal (D1)', wall: 'High lateral', artery: 'First diagonal branch',
    dead: ['D1'],
    segs: [6, 12],
    elevate: ['I', 'aVL', 'V2'], depress: ['III', 'aVF'],
    rv: false, subendo: false,
    leads: 'ST elevation in I, aVL and V2, with ST depression in III.',
    distinguish: [
      'The "South African flag" sign — elevation in I, aVL and V2 with depression in III maps onto the flag pattern on a standard 12-lead layout.',
      'Small territory, so troponin rise is modest and the ECG change is easy to dismiss.',
    ],
    gross: 'Small wedge-shaped infarct of the basal and mid anterolateral wall. The rest of the anterior wall is spared.',
  },
  {
    id: 'lcx', name: 'Circumflex / obtuse marginal', wall: 'Lateral (± posterior)', artery: 'Left circumflex',
    dead: ['LCX1', 'LCX2', 'OM1', 'OM2'],
    segs: [5, 6, 11, 12, 16],
    elevate: ['I', 'aVL', 'V5', 'V6'], depress: ['V1', 'V2', 'V3'],
    rv: false, subendo: false,
    leads: 'ST elevation in I, aVL, V5 and V6, often with ST depression in V1–V3 from posterior extension.',
    distinguish: [
      'The great masquerader. Up to a third of circumflex occlusions produce no ST elevation at all on a standard 12-lead — if the story fits, record posterior leads V7–V9.',
      'Isolated ST depression in V1–V3 with a tall R wave in V2 is a posterior STEMI until proven otherwise, not anterior ischaemia.',
      'In an inferior MI, ST elevation in II at least equal to III with no depression in I or aVL points to circumflex rather than RCA.',
    ],
    gross: 'Infarct of the lateral free wall, sometimes wrapping onto the posterior wall. Thrombus in the circumflex in the left atrioventricular groove.',
  },
  {
    id: 'rca-prox', name: 'Proximal RCA (with RV infarct)', wall: 'Inferior + right ventricle', artery: 'Right coronary artery',
    dead: ['RCA1', 'RCA2', 'RCA3', 'AM', 'PDA', 'PLV', 'SAN', 'AVN'],
    segs: [3, 4, 9, 10, 15],
    elevate: ['II', 'III', 'aVF', 'V1'], depress: ['I', 'aVL'],
    rv: true, subendo: false,
    leads: 'ST elevation II, III and aVF with III greater than II, reciprocal depression in I and aVL, and ST elevation in V1.',
    distinguish: [
      'ST elevation in III greater than in II, plus ST depression in I and aVL, identifies the RCA rather than the circumflex.',
      'ST elevation in V1 (or better, V4R above 1 mm) means right ventricular involvement — the lesion is proximal to the acute marginal branch.',
      'Clinically: hypotension with a raised JVP and clear lung fields. These patients are preload dependent — give fluid, avoid nitrates and opiates.',
      'The RCA supplies the SA node in about 60% and the AV node in about 85%, so bradycardia and AV block are common.',
    ],
    gross: 'Infarct of the inferior left ventricular wall, the posterior third of the septum and the right ventricular free wall. Occlusive thrombus in the RCA proximal to the acute marginal branch.',
  },
  {
    id: 'rca-mid', name: 'Mid / distal RCA', wall: 'Inferior', artery: 'Right coronary artery',
    dead: ['RCA2', 'RCA3', 'PDA', 'PLV', 'AVN'],
    segs: [3, 4, 9, 10, 15],
    elevate: ['II', 'III', 'aVF'], depress: ['I', 'aVL'],
    rv: false, subendo: false,
    leads: 'ST elevation II, III and aVF with reciprocal depression in I and aVL. No V1 elevation.',
    distinguish: [
      'Same inferior pattern as a proximal RCA lesion but without ST elevation in V1 and without the haemodynamic picture of RV infarction.',
      'AV nodal branch usually still involved, so transient heart block can occur — typically Wenckebach, narrow complex, atropine-responsive, and it recovers.',
    ],
    gross: 'Infarct limited to the inferior wall and posterior septum. The right ventricular free wall is spared.',
  },
  {
    id: 'pda', name: 'Posterior (inferobasal) MI', wall: 'Posterior / inferobasal', artery: 'PDA — from RCA or a dominant LCx',
    dead: ['PDA', 'PLV'],
    segs: [4, 5, 10],
    elevate: [], depress: ['V1', 'V2', 'V3'],
    rv: false, subendo: false, posterior: true,
    leads: 'Horizontal ST depression in V1–V3 with a tall broad R wave in V2 (R/S over 1) and an upright T wave. ST elevation appears in posterior leads V7–V9.',
    distinguish: [
      'This is a STEMI equivalent presenting upside down, because no standard lead faces the posterior wall.',
      'Flip the ECG over and hold it to the light — the mirror image shows the Q waves and ST elevation.',
      'Tall R in V1–V2 has a short differential: posterior MI, right ventricular hypertrophy, WPW type A, and normal variant.',
    ],
    gross: 'Infarct of the inferobasal (posterior) wall, best seen on the short-axis slice as pallor of the posterior third opposite the septum.',
  },
  {
    id: 'nstemi', name: 'Circumferential subendocardial (NSTEMI / demand)', wall: 'Subendocardial, all walls', artery: 'Supply–demand mismatch, no single occlusion',
    dead: [],
    segs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
    elevate: ['aVR'], depress: ['I', 'II', 'V3', 'V4', 'V5', 'V6', 'aVF'],
    rv: false, subendo: true,
    leads: 'Widespread horizontal ST depression, maximal in V4–V6, with ST elevation in aVR. No Q waves develop.',
    distinguish: [
      'The subendocardium is the watershed — furthest from the epicardial vessels and compressed hardest in systole, so it dies first in any supply–demand mismatch.',
      'No Q waves, because the outer myocardium survives and still generates a depolarisation vector.',
      'Causes: severe anaemia, tachyarrhythmia, aortic stenosis, hypotension, or triple-vessel disease — not usually a single acute plaque rupture.',
    ],
    gross: 'On the short-axis slice a pale rim occupies the inner third to half of the wall, circumferentially, with the outer myocardium preserved. Contrast with a transmural infarct, which spans the full wall thickness in one territory.',
  },
];


// Every vessel the 3D scene builds. Scenario `dead` lists must be a subset of this.
export const VESSEL_IDS = [
  'LM', 'LAD1', 'LAD2', 'LAD3', 'D1', 'D2', 'S1', 'S2', 'S3',
  'LCX1', 'LCX2', 'OM1', 'OM2',
  'RCA1', 'RCA2', 'RCA3', 'AM', 'PDA', 'PLV', 'SAN', 'AVN',
  'CS', 'GCV', 'MCV', 'SCV', 'PVLV', 'ACV',
];

export const RR = 0.8;        // seconds per beat (HR 75)
export const MM_PER_S = 25;
export const MM_PER_MV = 10;

export function gauss(t, mu, sigma) {
  const d = (t - mu) / sigma;
  return Math.exp(-0.5 * d * d);
}

// One beat in mV, for a lead whose morphology has already been modified.
export function beat(t, m, stOffset) {
  let v = m.p * gauss(t, 0.120, 0.022)
        + m.q * gauss(t, 0.200, 0.009)
        + m.r * gauss(t, 0.216, 0.011)
        + m.s * gauss(t, 0.236, 0.012)
        + m.t * gauss(t, 0.420, 0.058);
  if (stOffset) {
    // Lift from the J point (~250 ms) and let it decay after the T wave.
    const w = 1 / (1 + Math.exp(-(t - 0.252) / 0.012)) * (1 / (1 + Math.exp((t - 0.500) / 0.050)));
    v += stOffset * w;
  }
  return v;
}

export function ahaSegment(thetaDeg, t) {
  const a = ((thetaDeg % 360) + 360) % 360;
  if (t >= 0.90) return 17;
  if (t >= 0.60) {
    if (a >= 45 && a < 135) return 13;
    if (a >= 135 && a < 225) return 14;
    if (a >= 225 && a < 315) return 15;
    return 16;
  }
  let idx;
  if (a >= 60 && a < 120) idx = 0;
  else if (a >= 120 && a < 180) idx = 1;
  else if (a >= 180 && a < 240) idx = 2;
  else if (a >= 240 && a < 300) idx = 3;
  else if (a >= 300) idx = 4;
  else idx = 5;
  return (t < 0.30 ? 1 : 7) + idx;
}

// Apply a scenario and a stage to one lead: returns the modified morphology and the ST offset in mV.
export function leadState(lead, scenario, stage) {
  const m = { ...MORPH[lead] };
  let offset = 0;

  if (scenario.elevate.includes(lead)) {
    offset = stage.st;
    m.t *= stage.tMul;
    if (!scenario.subendo && stage.q > 0) {
      const depth = stage.q * 0.55;
      m.q = Math.min(m.q, 0) - depth * Math.max(0.4, Math.abs(m.r));
      m.r *= 1 - 0.75 * stage.q;
    }
  } else if (scenario.depress.includes(lead)) {
    offset = -stage.st * 0.45;
    if (stage.tMul < 0) m.t *= 0.6;
    // Posterior MI: the mirror-image R wave grows in V1-V3 as the posterior Q wave forms.
    if (scenario.posterior && ['V1', 'V2', 'V3'].includes(lead) && stage.q > 0) {
      m.r += stage.q * 1.1;
      m.s *= 1 - 0.5 * stage.q;
      m.t = Math.abs(m.t) + stage.q * 0.1;
    }
  }
  return { m, offset };
}

/* ------------------------------------------------------------------ *
 * GEOMETRY — the shape of the heart, as pure maths.
 *
 * Sources for the numbers below:
 *  - Gray's Anatomy: whole heart 12 cm long x 8.5 cm wide x 6 cm AP.
 *  - Heart is a quadrangular pyramid lying on its side: base (left atrium)
 *    faces posteriorly at T5-T8, apex (left ventricle) points anteriorly,
 *    inferiorly and to the left, reaching the 5th intercostal space in the
 *    midclavicular line. Long axis lies about 45 deg oblique to the body planes.
 *  - Surfaces: sternocostal/anterior = mostly RIGHT ventricle; diaphragmatic
 *    /inferior = both ventricles; left pulmonary = left ventricle;
 *    base/posterior = left atrium. Right border = right atrium.
 *  - LV: truncated prolate ellipsoid, circular in short axis, widest at the
 *    equator (not the base). EDD 48 +/- 4 mm; septum 9.3 mm, posterior wall
 *    9.5 mm; posterolateral wall thicker than septum; wall thins towards the apex.
 *  - RV: crescentic in short axis, triangular in frontal view, wraps around the
 *    LV. Wall 3-5 mm. Basal inflow 4.5 cm, length 7.6 cm — shorter than the LV,
 *    so it does not reach the apex. Three parts: inlet, trabecular apex, and a
 *    smooth infundibulum that wraps around the aortic root.
 *  - Interventricular septum runs obliquely backwards and to the right, convex
 *    towards the RV. That convexity is what makes the LV circular and the RV
 *    crescentic in cross-section.
 *  - Pulmonary trunk arises anterior and to the left of the aortic root, then
 *    runs posteriorly across it — the two great arteries spiral around each other.
 * ------------------------------------------------------------------ */

// All lengths in centimetres.
export const LV_C = 6.0;            // semi-major axis of the epicardial prolate spheroid
export const LV_A = 3.30;           // equatorial epicardial radius (short axis 6.6 cm)
export const LV_TRUNC = 0.45;       // the base is cut at 0.45c above the equator
export const LV_TOP = LV_TRUNC * LV_C;
export const LV_BOT = -LV_C;
export const LV_LEN = LV_TOP - LV_BOT;    // 8.7 cm base to apex

// Local frame: +x patient's left (LV lateral wall), +z anterior, -y towards the apex.
// theta measured from +x: 0 lateral, 90 anterior, 180 septal, 270 inferior.
export const ANT_GROOVE = 122;      // anterior interventricular groove
export const POST_GROOVE = 232;     // posterior interventricular groove
// The tricuspid annulus sits apically offset from the mitral annulus by 5-8 mm in
// normal hearts (losing or reversing that offset is Ebstein's). So the RV starts
// lower than the LV and, though the shorter chamber, ends near — but short of —
// the apex, which the LV alone forms. Confirmed against the reference diagram,
// where the RV cavity descends further than the LV cavity.
export const RV_T0 = 0.070;         // tricuspid annulus, ~6 mm below the mitral annulus
export const RV_TIP = 0.870;        // RV free wall stops ~1.1 cm short of the LV apex
export const RV_WALL = 0.40;
export const RV_BULGE = 4.00;

export const norm360 = (d) => ((d % 360) + 360) % 360;

export const lvY = (t) => LV_TOP - t * LV_LEN;

// Prolate ellipsoid: widest at the equator, rounded (not pointed) at the apex.
export function lvRadius(t) {
  const z = lvY(t) / LV_C;
  return LV_A * Math.sqrt(Math.max(0, 1 - z * z));
}

// The atrioventricular plane is oblique — the annulus sits higher posteriorly.
export const baseTilt = (thetaDeg) => 0.55 * Math.cos((norm360(thetaDeg) - 250) * Math.PI / 180);

export const lvSurfY = (thetaDeg, t) => lvY(t) + baseTilt(thetaDeg) * Math.pow(1 - t, 2.2);

// Posterolateral wall thicker than septum; thinnest of all at the apex.
export function lvWall(thetaDeg, t) {
  const septal = Math.cos((norm360(thetaDeg) - 180) * Math.PI / 180);  // +1 septum, -1 free wall
  return (1.02 - 0.10 * septal) * (1 - 0.45 * Math.pow(t, 1.8));
}

// The cavity closes before the epicardial apex — apical myocardium is near solid.
export const lvEndo = (thetaDeg, t) => Math.max(0, lvRadius(t) - lvWall(thetaDeg, t));

// The RV free wall: a crescent that falls to nothing at both interventricular
// grooves, and tapers along the long axis so the frontal silhouette is triangular.
// Asymmetric hump across the free wall, peaking at RV_SKEW and vanishing at both grooves.
function crescent(u) {
  const k = 2.2, a = 2 * RV_SKEW * k, b = 2 * (1 - RV_SKEW) * k;
  const peak = Math.pow(RV_SKEW, a) * Math.pow(1 - RV_SKEW, b);
  return (Math.pow(u, a) * Math.pow(1 - u, b)) / peak;
}

export function rvBulge(thetaDeg, t) {
  const a = norm360(thetaDeg);
  if (t < RV_T0 || t > RV_TIP || a <= ANT_GROOVE || a >= POST_GROOVE) return 0;
  const u = (a - ANT_GROOVE) / (POST_GROOVE - ANT_GROOVE);
  const along = Math.pow(1 - (t - RV_T0) / (RV_TIP - RV_T0), 0.75);
  return RV_BULGE * crescent(u) * along;
}

// The right ventricle sits in FRONT of the left as well as to its right — the
// sternocostal surface of the heart is mostly RV. A purely radial bulge off the LV
// axis cannot produce that, so the crescent is displaced partly anteriorly.
export const RV_TILT = 0.45;      // 0 = straight out from the LV axis, 1 = straight anterior

// Where the crescent is deepest across the free wall. 0 sits at the anterior
// interventricular groove, 1 at the posterior. Real hearts are front-loaded: the
// bulk of the right ventricle lies against the sternum, not out to the right.
export const RV_SKEW = 0.30;

export function rvDir(thetaDeg) {
  const a = thetaDeg * Math.PI / 180;
  const d = [Math.cos(a) * (1 - RV_TILT), 0, Math.sin(a) * (1 - RV_TILT) + RV_TILT];
  const n = Math.hypot(d[0], d[2]);
  return [d[0] / n, 0, d[2] / n];
}

export function lvPoint(thetaDeg, t, off = 0) {
  const a = thetaDeg * Math.PI / 180;
  const r = lvRadius(t) + off;
  return [r * Math.cos(a), lvSurfY(thetaDeg, t), r * Math.sin(a)];
}

export function lvEndoPoint(thetaDeg, t, floor = 0) {
  const a = thetaDeg * Math.PI / 180;
  const r = Math.max(floor, lvEndo(thetaDeg, t));
  return [r * Math.cos(a), lvSurfY(thetaDeg, t), r * Math.sin(a)];
}

export function rvPoint(thetaDeg, t, off = 0) {
  const p = lvPoint(thetaDeg, t);
  const b = rvBulge(thetaDeg, t);
  if (b <= 0 && off === 0) return p;
  const d = rvDir(thetaDeg);
  return [p[0] + (b + off) * d[0], p[1], p[2] + (b + off) * d[2]];
}

// Inner surface of the RV free wall: pulled back along the same direction.
export function rvInnerPoint(thetaDeg, t) {
  return rvPoint(thetaDeg, t, -RV_WALL);
}

// Kept for the radial checks: how far the RV surface lies from the long axis.
export const rvRadius = (thetaDeg, t) => {
  const p = rvPoint(thetaDeg, t);
  return Math.hypot(p[0], p[2]);
};

// Apex points left, inferior and anterior — the heart lying obliquely in the chest.
export const APEX_DIR = [0.55, -0.72, 0.42];

/* Positions and triangle indices for a thick shell over a (theta, t) patch.
 * Kept free of Three.js so the topology can be checked in Node. */
export function shellMesh({ a0, a1, wrap, t0 = 0, t1 = 1, nA, nT, outer, inner }) {
  const ring = wrap ? nA : nA + 1;
  const positions = [], thetas = [], ts = [], index = [];

  for (let layer = 0; layer < 2; layer++) {
    const radial = layer === 0 ? outer : inner;
    for (let i = 0; i <= nT; i++) {
      const t = t0 + (t1 - t0) * (i / nT);
      for (let j = 0; j < ring; j++) {
        const theta = a0 + (a1 - a0) * (j / nA);
        const p = radial(theta, t);
        positions.push(p[0], p[1], p[2]);
        thetas.push(theta);
        ts.push(t);
      }
    }
  }

  const layerSize = (nT + 1) * ring;
  const quad = (a, b, c, d) => index.push(a, b, c, a, c, d);

  for (let layer = 0; layer < 2; layer++) {
    const base = layer * layerSize;
    for (let i = 0; i < nT; i++) {
      for (let j = 0; j < nA; j++) {
        const j2 = (j + 1) % ring;
        const a = base + i * ring + j, b = base + i * ring + j2;
        const c = base + (i + 1) * ring + j2, d = base + (i + 1) * ring + j;
        if (layer === 0) quad(a, b, c, d); else quad(a, d, c, b);   // inner faces the cavity
      }
    }
  }
  // Rim at the base (the cut edge you see in a specimen) and at the far end.
  const L = nT * ring;
  for (let j = 0; j < nA; j++) {
    const j2 = (j + 1) % ring;
    quad(j, layerSize + j, layerSize + j2, j2);
    quad(L + j2, layerSize + L + j2, layerSize + L + j, L + j);
  }
  // Cut faces where a partial arc meets the interventricular grooves.
  if (!wrap) {
    for (const edge of [0, ring - 1]) {
      for (let i = 0; i < nT; i++) {
        const o = i * ring + edge, o2 = (i + 1) * ring + edge;
        const n = layerSize + o, n2 = layerSize + o2;
        edge === 0 ? quad(o, n, n2, o2) : quad(o2, n2, n, o);
      }
    }
  }
  return { positions, thetas, ts, index, vertexCount: layerSize * 2 };
}

// Atrial placement, shared by the renderer and the silhouette fitter.
// Positions refined by fitting the frontal silhouette to the reference diagram.
// The right atrium moved rightward — it forms the right border of the heart — and
// the left atrium moved posteriorly, since it is the most posterior chamber and
// contributes almost nothing to the frontal outline.
export const LA_POS = { c: [0.15, 4.45, -1.70], r: [2.10, 1.45, 1.90] };
export const RA_POS = { c: [-3.05, 4.15, 0.15], r: [2.00, 1.83, 1.80] };

// Appendages. The right one is a broad flap over the aortic root, the left a
// narrow finger — both sit on the frontal outline, so the silhouette check needs them.
export const LAA = { path: [[1.5, 4.45, 0.15], [2.35, 4.25, 0.8], [2.8, 3.9, 1.2]], r: [0.45, 0.22] };
export const RAA = { path: [[-2.35, 4.5, 0.85], [-1.55, 4.6, 1.5], [-0.85, 4.4, 1.6]], r: [0.62, 0.34] };

// Frontal silhouette targets measured from the reference diagram (see README).
export const SILHOUETTE_ASPECT = 1.074;   // width / height of the cardiac outline
export const SILHOUETTE_APEX_FRAC = 0.72; // apex position across the width, from the patient's right

/* Orientation basis. Maps the build frame into the chest: local -y (the apex
 * direction) onto APEX_DIR, and local +z as close to true anterior as the long
 * axis allows. Returned as three world-space column vectors, so the same maths
 * drives the renderer and can be checked without a browser. */
let _basis = null;
export function heartBasis() {
  if (_basis) return _basis;
  const al = Math.hypot(APEX_DIR[0], APEX_DIR[1], APEX_DIR[2]);
  const A = APEX_DIR.map((v) => v / al);
  const Y = [-A[0], -A[1], -A[2]];                       // local +y in world
  const d = Y[2];                                        // (0,0,1) . Y
  const f = [-Y[0] * d, -Y[1] * d, 1 - Y[2] * d];
  const fl = Math.hypot(f[0], f[1], f[2]);
  const Z = [f[0] / fl, f[1] / fl, f[2] / fl];           // local +z in world
  const X = [Y[1] * Z[2] - Y[2] * Z[1], Y[2] * Z[0] - Y[0] * Z[2], Y[0] * Z[1] - Y[1] * Z[0]];
  _basis = { X, Y, Z };
  return _basis;
}

export function localToWorld(p) {
  const { X, Y, Z } = heartBasis();
  return [
    X[0] * p[0] + Y[0] * p[1] + Z[0] * p[2],
    X[1] * p[0] + Y[1] * p[1] + Z[1] * p[2],
    X[2] * p[0] + Y[2] * p[1] + Z[2] * p[2],
  ];
}

/* Every epicardial point of the ventricles and atria, in world coordinates.
 * The frontal projection of this cloud is the cardiac silhouette. */
export function silhouetteCloud(step = 4) {
  const pts = [];
  for (let th = 0; th < 360; th += step) {
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      pts.push(localToWorld(lvPoint(th, t)));
      if (rvBulge(th, t) > 0) pts.push(localToWorld(rvPoint(th, t)));
    }
  }
  for (const A of [LAA, RAA]) {
    const seg = A.path.length - 1;
    for (let k = 0; k <= 24; k++) {
      const f = k / 24, i = Math.min(seg - 1, Math.floor(f * seg)), u = f * seg - i;
      const c = [0, 1, 2].map((j) => A.path[i][j] + (A.path[i + 1][j] - A.path[i][j]) * u);
      const rad = A.r[0] + (A.r[1] - A.r[0]) * f;
      for (let m = 0; m <= 6; m++) {
        const ph = (m / 6) * Math.PI;
        for (let j = 0; j < 12; j++) {
          const th = (j / 12) * 2 * Math.PI;
          pts.push(localToWorld([c[0] + rad * Math.sin(ph) * Math.cos(th),
                                 c[1] + rad * Math.cos(ph),
                                 c[2] + rad * Math.sin(ph) * Math.sin(th)]));
        }
      }
    }
  }
  for (const A of [LA_POS, RA_POS]) {
    for (let i = 0; i <= 16; i++) {
      const ph = (i / 16) * Math.PI;
      for (let j = 0; j < 32; j++) {
        const th = (j / 32) * 2 * Math.PI;
        pts.push(localToWorld([
          A.c[0] + A.r[0] * Math.sin(ph) * Math.cos(th),
          A.c[1] + A.r[1] * Math.cos(ph),
          A.c[2] + A.r[2] * Math.sin(ph) * Math.sin(th),
        ]));
      }
    }
  }
  return pts;
}

/* ------------------------------------------------------------------ *
 * SCANNED GEOMETRY
 * Radial sampler over a height map produced by tools/build_heart_meshes.py.
 * Lets the procedural coronaries follow a scanned surface instead of the
 * analytic one, so everything downstream keeps working unchanged.
 * ------------------------------------------------------------------ */

export function heightSampler(map) {
  const { nTheta, nT, grid } = map;
  return function radius(thetaDeg, t) {
    const a = (norm360(thetaDeg) / 360) * nTheta;
    const ti = Math.min(nT - 1 - 1e-9, Math.max(0, t * nT - 0.5));
    const i0 = Math.floor(ti), i1 = Math.min(nT - 1, i0 + 1), ft = ti - i0;
    const j0 = Math.floor(a) % nTheta, j1 = (j0 + 1) % nTheta, fa = a - Math.floor(a);
    const lerp = (p, q, f) => p + (q - p) * f;
    return lerp(lerp(grid[i0][j0], grid[i0][j1], fa),
                lerp(grid[i1][j0], grid[i1][j1], fa), ft);
  };
}

// Same shape as lvPoint, but the radius comes from a sampler.
export function sampledPoint(radius, thetaDeg, t, off = 0) {
  const a = thetaDeg * Math.PI / 180;
  const r = radius(thetaDeg, t) + off;
  return [r * Math.cos(a), lvY(t), r * Math.sin(a)];
}
