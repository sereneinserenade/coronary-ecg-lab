/* Clinical data and pure signal maths for the heart lab.
 * No Three.js, no DOM, no Solid — so it can be unit-tested on its own. */

/* ------------------------------------------------------------------ *
 * 1. LEADS AND MORPHOLOGY
 * ------------------------------------------------------------------ */

export type LimbLead = 'I' | 'II' | 'III' | 'aVR' | 'aVL' | 'aVF';
export type ChestLead = 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6';
export type ExtraLead = 'V4R' | 'V7' | 'V8' | 'V9';
export type Lead = LimbLead | ChestLead | ExtraLead;

/** A lead's deflection amplitudes, in mV. */
export interface Morph {
  p: number;
  q: number;
  r: number;
  s: number;
  t: number;
}

const DEFLECTIONS = ['p', 'q', 'r', 's', 't'] as const;

export const LEADS: Lead[] = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];

/** Recorded only when the story calls for them: V4R for the right ventricle,
 *  V7-V9 for the posterior wall. Both are in the Fourth Universal Definition. */
export const EXTRA_LEADS: ExtraLead[] = ['V4R', 'V7', 'V8', 'V9'];

export const CHEST_LEADS: ChestLead[] = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
export const LIMB_LEADS: LimbLead[] = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF'];
export const ALL_LEADS: Lead[] = [...LEADS, ...EXTRA_LEADS];

/* The frontal plane has only two degrees of freedom. Einthoven wired the three
 * bipolar leads into one triangle and Goldberger derived the three augmented
 * ones from the same three electrodes, so III, aVR, aVL and aVF are not
 * measurements at all — they are arithmetic on I and II:
 *
 *   III = II - I      aVR = -(I + II)/2      aVL = I - II/2      aVF = II - I/2
 *
 * Typing six independent limb morphologies produces an ECG that cannot exist.
 * So only I and II are data here; the other four are computed, and the same
 * rule is applied again to the ST shift, which keeps reciprocal change honest. */
type DerivedLimb = 'III' | 'aVR' | 'aVL' | 'aVF';

const DERIVE_LIMB: Record<DerivedLimb, (a: number, b: number) => number> = {
  III: (a, b) => b - a,
  aVR: (a, b) => -(a + b) / 2,
  aVL: (a, b) => a - b / 2,
  aVF: (a, b) => b - a / 2,
};

const isDerived = (lead: Lead): lead is DerivedLimb => lead in DERIVE_LIMB;

export function deriveLimb(lead: DerivedLimb, mI: Morph, mII: Morph): Morph {
  const f = DERIVE_LIMB[lead];
  const out = {} as Morph;
  for (const k of DEFLECTIONS) out[k] = f(mI[k], mII[k]);
  return out;
}

/** Hexaxial reference system: where each frontal lead looks from, in degrees. */
export const LEAD_AXIS: Record<LimbLead, number> = {
  I: 0, II: 60, III: 120, aVR: -150, aVL: -30, aVF: 90,
};

export const isLimbLead = (lead: Lead): lead is LimbLead => lead in LEAD_AXIS;

/* The augmented leads carry a gain of sqrt(3)/2 against the bipolar ones — which is
 * exactly what makes projection onto LEAD_AXIS agree with the Goldberger algebra above. */
const AUG = Math.sqrt(3) / 2;
export const LEAD_GAIN: Record<LimbLead, number> = {
  I: 1, II: 1, III: 1, aVR: AUG, aVL: AUG, aVF: AUG,
};

/** A dipole of magnitude `amp` pointing along `axisDeg`, read by one frontal lead. */
export function project(amp: number, axisDeg: number, lead: LimbLead): number {
  return amp * LEAD_GAIN[lead] * Math.cos(((LEAD_AXIS[lead] - axisDeg) * Math.PI) / 180);
}

/* Normal deflection amplitudes in mV.
 * I and II are seeded for a mean QRS axis near +45 deg; the rest of the frontal
 * plane falls out of deriveLimb, and the chest leads are independent measurements. */
const SEED = {
  I: { p: 0.11, q: -0.03, r: 0.84, s: -0.07, t: 0.23 },
  II: { p: 0.15, q: -0.04, r: 1.15, s: -0.10, t: 0.32 },
} satisfies Record<'I' | 'II', Morph>;

export const MORPH: Record<Lead, Morph> = {
  ...SEED,
  III: deriveLimb('III', SEED.I, SEED.II),
  aVR: deriveLimb('aVR', SEED.I, SEED.II),
  aVL: deriveLimb('aVL', SEED.I, SEED.II),
  aVF: deriveLimb('aVF', SEED.I, SEED.II),
  V1: { p: 0.08, q: 0.00, r: 0.20, s: -1.05, t: -0.05 },
  V2: { p: 0.10, q: 0.00, r: 0.35, s: -1.50, t: 0.35 },
  V3: { p: 0.10, q: 0.00, r: 0.70, s: -1.00, t: 0.40 },
  V4: { p: 0.10, q: -0.04, r: 1.45, s: -0.55, t: 0.38 },
  V5: { p: 0.10, q: -0.06, r: 1.35, s: -0.25, t: 0.30 },
  V6: { p: 0.09, q: -0.05, r: 1.00, s: -0.12, t: 0.22 },
  // V4R faces the right ventricle: a small rS, like V1 but smaller still.
  V4R: { p: 0.06, q: 0.00, r: 0.16, s: -0.42, t: 0.09 },
  // V7-V9 run round the back under the scapula; R falls off as they go lateral.
  V7: { p: 0.07, q: -0.03, r: 0.62, s: -0.22, t: 0.16 },
  V8: { p: 0.06, q: -0.03, r: 0.50, s: -0.16, t: 0.14 },
  V9: { p: 0.05, q: -0.02, r: 0.40, s: -0.12, t: 0.12 },
};

/** Who the ECG is being read for. Changes the V2/V3 and V4R thresholds only. */
/* The two age cut-offs are not the same one. The Fourth Universal Definition
 * raises the V2-V3 bar for men under 40, and the V4R bar for men under 30, so a
 * man of 35 needs the higher precordial threshold and the ordinary V4R one. */
export type Patient = 'man>=40' | 'man30-39' | 'man<30' | 'woman';

export const PATIENTS: { id: Patient; label: string }[] = [
  { id: 'man>=40', label: 'Man, 40 or over' },
  { id: 'man30-39', label: 'Man, 30 to 39' },
  { id: 'man<30', label: 'Man, under 30' },
  { id: 'woman', label: 'Woman, any age' },
];

const YOUNG_MAN = new Set<Patient>(['man30-39', 'man<30']);

/* Diagnostic J-point thresholds, Fourth Universal Definition of Myocardial
 * Infarction (2018), in mV. Two contiguous leads must clear the bar. */
export function stThreshold(lead: Lead, patient: Patient = 'man>=40'): number {
  if (lead === 'V2' || lead === 'V3') {
    if (patient === 'woman') return 0.15;
    return YOUNG_MAN.has(patient) ? 0.25 : 0.2;
  }
  if (lead === 'V4R') return patient === 'man<30' ? 0.1 : 0.05;
  if (lead === 'V7' || lead === 'V8' || lead === 'V9') return 0.05;
  return 0.1;
}

/* ------------------------------------------------------------------ *
 * 2. CLINICAL DATA
 * ------------------------------------------------------------------ */

export type SegmentId =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17;

export type VesselId =
  | 'LM' | 'LAD1' | 'LAD2' | 'LAD3' | 'D1' | 'D2' | 'S1' | 'S2' | 'S3' | 'RI'
  | 'LCX1' | 'LCX2' | 'OM1' | 'OM2'
  | 'RCA1' | 'RCA2' | 'RCA3' | 'AM' | 'CB' | 'RV1' | 'RV2'
  | 'PDA' | 'PS1' | 'PS2' | 'PLV' | 'SAN' | 'AVN'
  | 'CS' | 'GCV' | 'MCV' | 'SCV' | 'PVLV' | 'ACV';

export type DominanceId = 'right' | 'left' | 'codominant';

/** One step in the evolution of a transmural infarct. */
export interface Stage {
  id: number;
  time: string;
  short: string;
  /** ST elevation at the J point, in mV, before the injury vector scales it. */
  st: number;
  /** Multiplier on the normal T wave. Negative inverts it. */
  tMul: number;
  /** Fraction of a full pathological Q wave. */
  q: number;
  ecg: string;
  gross: string;
  micro: string;
  ttc: string;
  risk: string;
}

/** The current-of-injury dipole: where it points and how far it reaches. */
export interface Injury {
  /** Bearing on the hexaxial system, in degrees. */
  axis: number;
  /** Scale against the stage's ST magnitude. */
  amp: number;
  /** Horizontal-plane leads, as fractions of the same magnitude. */
  chest: Partial<Record<ChestLead | ExtraLead, number>>;
}

/** One occlusion, as authored (always the right-dominant case). */
export interface ScenarioSpec {
  id: string;
  name: string;
  wall: string;
  artery: string;
  dead: VesselId[];
  segs: SegmentId[];
  /** Textbook expectation, used by the tests to check the injury vector. */
  expectElevate: Lead[];
  expectDepress: Lead[];
  rv: boolean;
  subendo: boolean;
  posterior?: boolean;
  leads: string;
  distinguish: string[];
  gross: string;
}

/** A scenario with its derived lead labels, rate and injury vector attached. */
export interface Scenario extends ScenarioSpec {
  injury: Injury;
  hr: number;
  elevate: Lead[];
  depress: Lead[];
  extras: ExtraLead[];
  dominance?: Dominance;
}

export interface Dominance {
  id: DominanceId;
  label: string;
  prevalence: string;
  pdaFrom: 'RCA' | 'LCX';
  plvFrom: 'RCA' | 'LCX';
  avnFrom: 'RCA' | 'LCX';
  note: string;
}

// AHA 17-segment model.
export const SEG_NAME: Record<SegmentId, string> = {
  1: 'basal anterior', 2: 'basal anteroseptal', 3: 'basal inferoseptal', 4: 'basal inferior',
  5: 'basal inferolateral', 6: 'basal anterolateral',
  7: 'mid anterior', 8: 'mid anteroseptal', 9: 'mid inferoseptal', 10: 'mid inferior',
  11: 'mid inferolateral', 12: 'mid anterolateral',
  13: 'apical anterior', 14: 'apical septal', 15: 'apical inferior', 16: 'apical lateral',
  17: 'apex',
};

export const TERRITORY: Record<'LAD' | 'RCA' | 'LCX', SegmentId[]> = {
  LAD: [1, 2, 7, 8, 13, 14, 17],
  RCA: [3, 4, 9, 10, 15],
  LCX: [5, 6, 11, 12, 16],
};

// Evolution of a transmural infarct. st = ST elevation in mV at the J point.
// tMul scales the normal T wave (negative = inverted). q = fraction of a full pathological Q.

// Evolution of a transmural infarct. st = ST elevation in mV at the J point.
// tMul scales the normal T wave (negative = inverted). q = fraction of a full pathological Q.
export const STAGES: Stage[] = [
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
// Occlusion scenarios. `dead` lists vessel ids that lose flow; `segs` the AHA segments infarcted.
export const SCENARIO_SPECS: ScenarioSpec[] = [
  {
    id: 'none', name: 'No occlusion (normal)', wall: '—', artery: '—',
    dead: [], segs: [], expectElevate: [], expectDepress: [], rv: false, subendo: false,
    leads: 'Normal.',
    distinguish: ['Use this as the baseline. Step the timeline and nothing changes, because nothing is occluded.'],
    gross: 'Normal heart. Coronary arteries patent, myocardium uniformly red-brown.',
  },
  {
    id: 'lm', name: 'Left main occlusion', wall: 'Anterior + lateral (massive)', artery: 'Left main coronary artery',
    dead: ['LM', 'LAD1', 'LAD2', 'LAD3', 'D1', 'D2', 'S1', 'S2', 'S3', 'LCX1', 'LCX2', 'OM1', 'OM2'],
    segs: [1, 2, 6, 7, 8, 11, 12, 13, 14, 16, 17, 5],
    expectElevate: ['aVR', 'V1'], expectDepress: ['I', 'II', 'aVF', 'V3', 'V4', 'V5', 'V6', 'III'],
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
    expectElevate: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'I', 'aVL'], expectDepress: ['III', 'aVF', 'II'],
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
    expectElevate: ['V1', 'V2', 'V3', 'V4'], expectDepress: ['III'],
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
    expectElevate: ['V3', 'V4', 'V5', 'V6', 'II', 'III', 'aVF'], expectDepress: [],
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
    expectElevate: ['I', 'aVL', 'V2'], expectDepress: ['III', 'aVF'],
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
    expectElevate: ['I', 'aVL', 'V5', 'V6'], expectDepress: ['V1', 'V2', 'V3'],
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
    expectElevate: ['II', 'III', 'aVF', 'V1'], expectDepress: ['I', 'aVL'],
    rv: true, subendo: false,
    leads: 'ST elevation II, III and aVF with III greater than II, reciprocal depression in I and aVL, and ST elevation in V1.',
    distinguish: [
      'ST elevation in III greater than in II, plus ST depression in I and aVL, identifies the RCA rather than the circumflex.',
      'ST elevation in V1, or better V4R above 0.5 mm (1 mm in a man under 30), means right ventricular involvement — the lesion is proximal to the acute marginal branch.',
      'Clinically: hypotension with a raised JVP and clear lung fields. These patients are preload dependent — give fluid, avoid nitrates and opiates.',
      'The RCA supplies the SA node in about 60% and the AV node in about 85%, so bradycardia and AV block are common.',
    ],
    gross: 'Infarct of the inferior left ventricular wall, the posterior third of the septum and the right ventricular free wall. Occlusive thrombus in the RCA proximal to the acute marginal branch.',
  },
  {
    id: 'rca-mid', name: 'Mid / distal RCA', wall: 'Inferior', artery: 'Right coronary artery',
    dead: ['RCA2', 'RCA3', 'PDA', 'PLV', 'AVN'],
    segs: [3, 4, 9, 10, 15],
    expectElevate: ['II', 'III', 'aVF'], expectDepress: ['I', 'aVL'],
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
    expectElevate: [], expectDepress: ['V1', 'V2', 'V3'],
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
    expectElevate: ['aVR'], expectDepress: ['I', 'II', 'V3', 'V4', 'V5', 'V6', 'aVF'],
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
export const VESSEL_IDS: VesselId[] = [
  'LM', 'LAD1', 'LAD2', 'LAD3', 'D1', 'D2', 'S1', 'S2', 'S3', 'RI',
  'LCX1', 'LCX2', 'OM1', 'OM2',
  'RCA1', 'RCA2', 'RCA3', 'AM', 'CB', 'RV1', 'RV2', 'PDA', 'PS1', 'PS2', 'PLV', 'SAN', 'AVN',
  'CS', 'GCV', 'MCV', 'SCV', 'PVLV', 'ACV',
];

/* What each coronary is called and what it feeds, for the model's own legend.
 * `variant` notes how often the vessel is absent or arises elsewhere. */
export const VESSEL_INFO: Record<VesselId, [name: string, note: string]> = {
  LM: ['Left main', 'Left coronary sinus to the LAD/LCx bifurcation. 5-10 mm long; occlusion here is the widowmaker.'],
  LAD1: ['Proximal LAD', 'Anterior interventricular groove, before the first septal and first diagonal.'],
  LAD2: ['Mid LAD', 'Between the first diagonal and the apex.'],
  LAD3: ['Distal LAD', 'Apical. Wraps round onto the inferior wall in about two thirds of hearts (type III).'],
  D1: ['First diagonal', 'Anterolateral wall. Shares the anterolateral papillary muscle with OM1.'],
  D2: ['Second diagonal', 'Mid anterolateral wall.'],
  RI: ['Ramus intermedius', 'A third branch straight off the left main, between the LAD and the circumflex. Present in 15-30% of hearts.'],
  S1: ['First septal perforator', 'Anterior two-thirds of the septum, plus the right bundle and the left anterior fascicle.'],
  S2: ['Second septal perforator', 'Mid anterior septum.'],
  S3: ['Third septal perforator', 'Apical septum.'],
  LCX1: ['Proximal circumflex', 'Left atrioventricular groove, before the first obtuse marginal.'],
  LCX2: ['Distal circumflex', 'Continues round the AV groove; reaches the crux only in a left-dominant heart.'],
  OM1: ['First obtuse marginal', 'Lateral free wall. Second supply to the anterolateral papillary muscle.'],
  OM2: ['Second obtuse marginal', 'Inferolateral wall.'],
  RCA1: ['Proximal RCA', 'Right AV groove, before the acute marginal.'],
  RCA2: ['Mid RCA', 'Between the acute marginal and the crux.'],
  RCA3: ['Distal RCA', 'Reaches the crux and gives the PDA in a right-dominant heart.'],
  CB: ['Conus branch', 'First branch of the RCA, to the RV outflow tract. Arises from its own aortic ostium in roughly half of hearts, and collateralises the LAD through the circle of Vieussens.'],
  AM: ['Acute marginal', 'Right ventricular free wall. A lesion proximal to it puts the RV at risk.'],
  RV1: ['Right ventricular branch', 'Anterior RV free wall.'],
  RV2: ['Right ventricular branch', 'Mid RV free wall.'],
  PDA: ['Posterior descending', 'Posterior interventricular groove: inferior wall and the posterior third of the septum. Defines dominance.'],
  PS1: ['Posterior septal perforator', 'Posterior third of the septum, running up to meet the anterior septals.'],
  PS2: ['Posterior septal perforator', 'Apical posterior septum.'],
  PLV: ['Posterolateral branch', 'Inferolateral wall past the crux.'],
  SAN: ['Sinus node artery', 'To the sinoatrial node. From the RCA in about 60% of hearts, the circumflex in the rest.'],
  AVN: ['AV nodal artery', 'A short branch at the crux, from whichever artery is dominant. RCA in about 90%.'],
  CS: ['Coronary sinus', 'Posterior AV groove, into the right atrium. Takes almost all the venous return.'],
  GCV: ['Great cardiac vein', 'Up the anterior interventricular groove beside the LAD, then round into the coronary sinus.'],
  MCV: ['Middle cardiac vein', 'Posterior interventricular groove beside the PDA.'],
  SCV: ['Small cardiac vein', 'Right AV groove beside the RCA.'],
  PVLV: ['Posterior vein of the LV', 'The target for the left ventricular lead in cardiac resynchronisation.'],
  ACV: ['Anterior cardiac veins', 'Drain the RV straight into the right atrium, bypassing the coronary sinus.'],
};
/* ------------------------------------------------------------------ *
 * THE INJURY VECTOR
 *
 * Acute ischaemia makes the injured wall electrically positive relative to the
 * rest, so the ST segment is a single current-of-injury dipole pointing away
 * from the endocardium of the infarct. Every frontal lead sees the SAME vector
 * from its own angle — which is why reciprocal depression is not an extra
 * finding to memorise but the far side of one arrow.
 *
 * `axis` is where that arrow points on the hexaxial system, in degrees.
 * `amp` scales it against the stage's ST magnitude. `chest` gives the six
 * precordial leads and the extras directly, as fractions of the same magnitude,
 * because the horizontal plane is not derivable from the frontal one.
 * ------------------------------------------------------------------ */
export const INJURY: Record<string, Injury> = {
  none:       { axis: 0,    amp: 0,    chest: {} },
  // Global subendocardial: the vector runs away from the whole left ventricle,
  // towards the right shoulder. aVR looks straight down it; everything else sees its tail.
  lm:         { axis: -135, amp: 0.55, chest: { V1: 0.30, V2: -0.40, V3: -0.70, V4: -0.85, V5: -0.80, V6: -0.60 } },
  'lad-prox': { axis: -52,  amp: 0.52, chest: { V1: 0.50, V2: 0.95, V3: 1.00, V4: 0.90, V5: 0.60, V6: 0.40 } },
  'lad-mid':  { axis: -40,  amp: 0.22, chest: { V1: 0.45, V2: 0.95, V3: 1.00, V4: 0.85, V5: 0.24, V6: 0.08 } },
  // A wrap-around LAD injures apex and inferoapical wall at once, so the arrow
  // swings inferiorly and no lead ends up squarely behind it.
  'lad-wrap': { axis: 75,   amp: 0.55, chest: { V1: 0.10, V2: 0.30, V3: 0.70, V4: 0.90, V5: 0.80, V6: 0.60 } },
  d1:         { axis: -35,  amp: 0.75, chest: { V1: 0.05, V2: 0.35, V3: 0.10, V4: 0.00, V5: 0.05, V6: 0.05 } },
  lcx:        { axis: -20,  amp: 0.45, chest: { V1: -0.50, V2: -0.70, V3: -0.50, V4: 0.20, V5: 0.70, V6: 0.65,
                                                V7: 0.55, V8: 0.45, V9: 0.35 } },
  // III greater than II, and aVL the deepest reciprocal: that is an axis past 90.
  'rca-prox': { axis: 115,  amp: 1.00, chest: { V1: 0.35, V2: -0.10, V3: -0.30, V4: -0.20, V5: -0.10, V6: 0.00,
                                                V4R: 0.55 } },
  'rca-mid':  { axis: 112,  amp: 0.95, chest: { V1: 0.00, V2: -0.25, V3: -0.35, V4: -0.20, V5: 0.00, V6: 0.00,
                                                V4R: 0.05 } },
  // The posterior wall faces directly away from every standard electrode, so the
  // frontal projection is almost nothing and the diagnosis lives in V1-V3 and V7-V9.
  pda:        { axis: 100,  amp: 0.15, chest: { V1: -0.70, V2: -0.95, V3: -0.70, V4: -0.30, V5: 0.00, V6: 0.10,
                                                V7: 0.60, V8: 0.55, V9: 0.45 } },
  nstemi:     { axis: -150, amp: 0.50, chest: { V1: -0.20, V2: -0.50, V3: -0.80, V4: -1.00, V5: -0.95, V6: -0.75 } },
};

/* Heart rate is part of the clinical picture, not decoration. An inferior MI
 * knocks out the sinus node's supply and stimulates vagal afferents on the
 * inferior wall (the Bezold-Jarisch reflex), so it runs slow; an anterior MI
 * loses pump function and runs fast. */
export const SCENARIO_HR: Record<string, number> = {
  none: 75, lm: 112, 'lad-prox': 104, 'lad-mid': 92, 'lad-wrap': 88,
  d1: 80, lcx: 82, 'rca-prox': 50, 'rca-mid': 56, pda: 62, nstemi: 108,
};

/** ST deviation at the J point, in mV, for one lead under one scenario and stage. */
export function stDeviation(lead: Lead, scenario: Scenario, stage: Stage): number {
  if (!stage.st) return 0;
  const inj = scenario.injury;
  if (isLimbLead(lead)) return stage.st * project(inj.amp, inj.axis, lead);
  return stage.st * (inj.chest[lead] ?? 0);
}

/** Which leads a reader would call elevated or depressed, measured off the model at
 *  its peak rather than listed by hand — so the labels can never drift from the trace. */
const PEAK = STAGES.reduce((a, b) => (b.st > a.st ? b : a));

function derive(spec: ScenarioSpec): Scenario {
  const injury = INJURY[spec.id] ?? { axis: 0, amp: 0, chest: {} };
  const sc: Scenario = {
    ...spec,
    injury,
    hr: SCENARIO_HR[spec.id] ?? 75,
    elevate: [],
    depress: [],
    extras: EXTRA_LEADS.filter((l) => Math.abs(injury.chest[l] ?? 0) > 0.02),
  };
  for (const lead of ALL_LEADS) {
    const mv = stDeviation(lead, sc, PEAK);
    if (mv >= 0.1) sc.elevate.push(lead);
    else if (mv <= -0.05) sc.depress.push(lead);
  }
  return sc;
}

export const SCENARIOS: Scenario[] = SCENARIO_SPECS.map(derive);

export const scenarioById = (id: string): Scenario =>
  SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]!;

/* ------------------------------------------------------------------ *
 * DOMINANCE
 *
 * Dominance is decided by one thing: which artery gives off the posterior
 * descending. It moves the inferior wall, the posterior third of the septum and
 * the AV nodal branch from one system to the other, so it changes the answer to
 * "which vessel caused this inferior MI" more than any other variation.
 * Prevalences from the AHA review of coronary dominance.
 * ------------------------------------------------------------------ */
export const DOMINANCE: Record<DominanceId, Dominance> = {
  right: {
    id: 'right', label: 'Right dominant', prevalence: '~85%',
    pdaFrom: 'RCA', plvFrom: 'RCA', avnFrom: 'RCA',
    note: 'The usual arrangement. The posterior descending and the posterolateral branches both come off the RCA past the crux, so the inferior wall, the posterior third of the septum and the AV node are all RCA territory.',
  },
  left: {
    id: 'left', label: 'Left dominant', prevalence: '~8%',
    pdaFrom: 'LCX', plvFrom: 'LCX', avnFrom: 'LCX',
    note: 'The circumflex reaches the crux and gives the posterior descending. One vessel now feeds the lateral AND inferior walls, so a circumflex occlusion infarcts far more muscle and carries the worse prognosis. An RCA occlusion, conversely, spares the left ventricle almost entirely.',
  },
  codominant: {
    id: 'codominant', label: 'Co-dominant', prevalence: '~7%',
    pdaFrom: 'RCA', plvFrom: 'LCX', avnFrom: 'RCA',
    note: 'The RCA gives the posterior descending, the circumflex the posterolateral branches. The inferior wall stays with the RCA; the inferolateral wall moves across to the circumflex.',
  },
};

// Segments fed through the crux: the inferior wall and the inferobasal corner.
const CRUX_SEGS: SegmentId[] = [3, 4, 9, 10, 15];
// The AHA map already gives the inferolateral segments to the circumflex, so
// co-dominance moves the vessel at risk without moving any segment.
const PLV_SEGS: SegmentId[] = [];

/* A scenario as it plays out in one particular heart. Returns a new object —
 * the base SCENARIOS array always describes the right-dominant case. */
export function withDominance(sc: Scenario, domId: DominanceId = 'right'): Scenario {
  const dom = DOMINANCE[domId] || DOMINANCE.right;
  if (dom.id === 'right' || sc.id === 'none' || sc.id === 'nstemi') return { ...sc, dominance: dom };

  const dead = new Set(sc.dead);
  const segs = new Set(sc.segs);
  const isRca = sc.id.startsWith('rca');
  const isLcx = sc.id === 'lcx';
  let extra = '';

  const move = (vessels: VesselId[], fromRight: boolean) => {
    for (const v of vessels) (fromRight ? dead.delete(v) : dead.add(v));
  };
  const moveSegs = (list: SegmentId[], drop: boolean) => { for (const g of list) (drop ? segs.delete(g) : segs.add(g)); };

  if (dom.pdaFrom === 'LCX') {
    if (isRca) {
      move(['PDA', 'PLV', 'AVN'], true);
      moveSegs(CRUX_SEGS, true);
      moveSegs(PLV_SEGS, true);
      extra = 'In this heart the circumflex reaches the crux, so the RCA never supplies the inferior wall. An RCA occlusion here takes the right ventricle and the atria and leaves the left ventricle almost untouched — a much smaller infarct than the same lesion in a right-dominant heart.';
    } else if (isLcx) {
      move(['PDA', 'PLV', 'AVN'], false);
      moveSegs(CRUX_SEGS, false);
      extra = 'The circumflex is dominant, so this one occlusion takes the lateral wall AND the whole inferior wall and posterior septum. Expect inferior ST elevation on top of the lateral changes, AV block from the circumflex AV nodal branch, and a far larger infarct than a right-dominant circumflex lesion.';
    }
  } else if (dom.plvFrom === 'LCX') {
    if (isRca) {
      move(['PLV'], true);
      moveSegs(PLV_SEGS, true);
      extra = 'Co-dominant: the RCA still gives the posterior descending, so the inferior wall infarcts as usual. The posterolateral branches come off the circumflex instead, so they survive this occlusion — the wall map is unchanged, the vessels at risk are not.';
    } else if (isLcx) {
      move(['PLV'], false);
      moveSegs(PLV_SEGS, false);
      extra = 'Co-dominant: the posterolateral branches arise from the circumflex, so they go down with it. The inferior wall itself still belongs to the RCA and is spared.';
    }
  }

  if (sc.id === 'pda') {
    extra = `The posterior descending arises from the ${dom.pdaFrom === 'LCX' ? 'dominant circumflex' : 'RCA'} in this heart, so that is the vessel to look for on the angiogram.`;
  }

  return {
    ...sc,
    dominance: dom,
    dead: [...dead],
    segs: [...segs].sort((a, b) => a - b),
    distinguish: extra ? [...sc.distinguish, extra] : sc.distinguish,
  };
}

// Which of the three big vessels owns each AHA segment, for this heart.
export function territoryFor(domId: DominanceId = 'right'): Record<'LAD' | 'RCA' | 'LCX', SegmentId[]> {
  const dom = DOMINANCE[domId] || DOMINANCE.right;
  const t = { LAD: [...TERRITORY.LAD], RCA: [...TERRITORY.RCA], LCX: [...TERRITORY.LCX] };
  if (dom.pdaFrom === 'LCX') {
    t.LCX = [...t.LCX, ...t.RCA].sort((a, b) => a - b);
    t.RCA = [];
  }
  return t;
}

// Every vessel the 3D scene builds. Scenario `dead` lists must be a subset of this.
export const RR = 0.8;        // seconds per beat at HR 75; scenarios set their own rate
export const rrFor = (hr: number): number => 60 / (hr || 75);
export const MM_PER_S = 25;
export const MM_PER_MV = 10;

export function gauss(t: number, mu: number, sigma: number): number {
  const d = (t - mu) / sigma;
  return Math.exp(-0.5 * d * d);
}

// One beat in mV, for a lead whose morphology has already been modified.
export function beat(t: number, m: Morph, stOffset: number): number {
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

export function ahaSegment(thetaDeg: number, t: number): SegmentId {
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
  return ((t < 0.30 ? 1 : 7) + idx) as SegmentId;
}

// Apply a scenario and a stage to one lead: returns the modified morphology and the ST offset in mV.
// Only I, II and the chest leads are modified directly. The other four frontal leads
// are re-derived afterwards, so the twelve-lead stays a possible recording at every step.
function morphFor(lead: Lead, scenario: Scenario, stage: Stage): Morph {
  const m = { ...MORPH[lead] };
  // Keyed on the lead's role at the peak, not its deviation right now: the Q wave
  // outlives the ST elevation by decades, so it cannot be driven by the current shift.
  const up = scenario.elevate.includes(lead);
  const down = scenario.depress.includes(lead);

  if (up) {
    m.t *= stage.tMul;
    if (!scenario.subendo && stage.q > 0) {
      const depth = stage.q * 0.55;
      m.q = Math.min(m.q, 0) - depth * Math.max(0.4, Math.abs(m.r));
      m.r *= 1 - 0.75 * stage.q;
    }
  } else if (down) {
    if (stage.tMul < 0) m.t *= 0.6;
    // Posterior MI: the mirror-image R wave grows in V1-V3 as the posterior Q wave forms.
    if (scenario.posterior && ['V1', 'V2', 'V3'].includes(lead) && stage.q > 0) {
      m.r += stage.q * 1.1;
      m.s *= 1 - 0.5 * stage.q;
      m.t = Math.abs(m.t) + stage.q * 0.1;
    }
  }
  return m;
}

export function leadState(lead: Lead, scenario: Scenario, stage: Stage): { m: Morph; offset: number } {
  const offset = stDeviation(lead, scenario, stage);
  if (isDerived(lead)) {
    return {
      m: deriveLimb(lead, morphFor('I', scenario, stage), morphFor('II', scenario, stage)),
      offset,
    };
  }
  return { m: morphFor(lead, scenario, stage), offset };
}
/* ------------------------------------------------------------------ *
 * 3. GEOMETRY TYPES
 * ------------------------------------------------------------------ */

/** A point or direction in the local cardiac frame, in centimetres.
 *  +x patient's left, +y towards the base, +z anterior. */
export type Vec3 = [x: number, y: number, z: number];

/** Three world-space column vectors mapping the build frame into the chest. */
export interface Basis { X: Vec3; Y: Vec3; Z: Vec3 }

export interface EllipsoidSpec { c: Vec3; r: Vec3 }
export interface AppendageSpec { path: Vec3[]; r: [number, number] }

export interface PapillaryMuscle {
  id: 'ALPM' | 'PMPM';
  name: string;
  short: string;
  theta: number;
  base: number;
  tip: number;
  r0: number;
  r1: number;
  lean: number;
  supply: VesselId[];
  dual: boolean;
  note: string;
}

interface ConductionCommon {
  id: 'SAN' | 'AVN' | 'HIS' | 'RBB' | 'LAF' | 'LPF';
  name: string;
  r: number;
  supply: VesselId[];
  dual: boolean;
  block: string;
  note: string;
}
export type ConductionPart =
  | (ConductionCommon & { kind: 'node'; at: Vec3; path?: never })
  | (ConductionCommon & { kind: 'path'; path: Vec3[]; at?: never });

export interface ConductionState {
  id: ConductionCommon['id'];
  name: string;
  block: string;
  failed: boolean;
  lost: VesselId[];
}

export interface ConductionSummary {
  name: string;
  detail: string;
  parts: ConductionState[];
}

export interface Valve {
  id: 'mitral' | 'tricuspid' | 'aortic' | 'pulmonary';
  name: string;
  leaflets: 2 | 3;
  r: number;
  c: Vec3;
  normal: Vec3;
  note: string;
}

/** A radial surface, sampled from a scan: R(theta, t). */
export interface HeightMap { nTheta: number; nT: number; grid: number[][] }

/** Positions and triangle indices for a thick shell over a (theta, t) patch. */
export interface ShellSpec {
  a0: number;
  a1: number;
  wrap: boolean;
  t0?: number;
  t1?: number;
  nA: number;
  nT: number;
  outer: (theta: number, t: number) => Vec3;
  inner: (theta: number, t: number) => Vec3;
}

export interface ShellMesh {
  positions: number[];
  thetas: number[];
  ts: number[];
  index: number[];
  vertexCount: number;
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

export const norm360 = (d: number): number => ((d % 360) + 360) % 360;

export const lvY = (t: number): number => LV_TOP - t * LV_LEN;

// Prolate ellipsoid: widest at the equator, rounded (not pointed) at the apex.
export function lvRadius(t: number): number {
  const z = lvY(t) / LV_C;
  return LV_A * Math.sqrt(Math.max(0, 1 - z * z));
}

// The atrioventricular plane is oblique — the annulus sits higher posteriorly.
export const baseTilt = (thetaDeg: number): number => 0.55 * Math.cos((norm360(thetaDeg) - 250) * Math.PI / 180);

export const lvSurfY = (thetaDeg: number, t: number): number => lvY(t) + baseTilt(thetaDeg) * Math.pow(1 - t, 2.2);

// Posterolateral wall thicker than septum; thinnest of all at the apex.
export function lvWall(thetaDeg: number, t: number): number {
  const septal = Math.cos((norm360(thetaDeg) - 180) * Math.PI / 180);  // +1 septum, -1 free wall
  return (1.02 - 0.10 * septal) * (1 - 0.45 * Math.pow(t, 1.8));
}

// The cavity closes before the epicardial apex — apical myocardium is near solid.
export const lvEndo = (thetaDeg: number, t: number): number => Math.max(0, lvRadius(t) - lvWall(thetaDeg, t));

// The RV free wall: a crescent that falls to nothing at both interventricular
// grooves, and tapers along the long axis so the frontal silhouette is triangular.
// Asymmetric hump across the free wall, peaking at RV_SKEW and vanishing at both grooves.
function crescent(u: number): number {
  const k = 2.2, a = 2 * RV_SKEW * k, b = 2 * (1 - RV_SKEW) * k;
  const peak = Math.pow(RV_SKEW, a) * Math.pow(1 - RV_SKEW, b);
  return (Math.pow(u, a) * Math.pow(1 - u, b)) / peak;
}

export function rvBulge(thetaDeg: number, t: number): number {
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

export function rvDir(thetaDeg: number): Vec3 {
  const a = thetaDeg * Math.PI / 180;
  const d: Vec3 = [Math.cos(a) * (1 - RV_TILT), 0, Math.sin(a) * (1 - RV_TILT) + RV_TILT];
  const n = Math.hypot(d[0], d[2]);
  return [d[0] / n, 0, d[2] / n];
}

export function lvPoint(thetaDeg: number, t: number, off = 0): Vec3 {
  const a = thetaDeg * Math.PI / 180;
  const r = lvRadius(t) + off;
  return [r * Math.cos(a), lvSurfY(thetaDeg, t), r * Math.sin(a)];
}

export function lvEndoPoint(thetaDeg: number, t: number, floor = 0): Vec3 {
  const a = thetaDeg * Math.PI / 180;
  const r = Math.max(floor, lvEndo(thetaDeg, t));
  return [r * Math.cos(a), lvSurfY(thetaDeg, t), r * Math.sin(a)];
}

export function rvPoint(thetaDeg: number, t: number, off = 0): Vec3 {
  const p = lvPoint(thetaDeg, t);
  const b = rvBulge(thetaDeg, t);
  if (b <= 0 && off === 0) return p;
  const d = rvDir(thetaDeg);
  return [p[0] + (b + off) * d[0], p[1], p[2] + (b + off) * d[2]];
}

// Inner surface of the RV free wall: pulled back along the same direction.
export function rvInnerPoint(thetaDeg: number, t: number): Vec3 {
  return rvPoint(thetaDeg, t, -RV_WALL);
}

// Kept for the radial checks: how far the RV surface lies from the long axis.
export const rvRadius = (thetaDeg: number, t: number): number => {
  const p = rvPoint(thetaDeg, t);
  return Math.hypot(p[0], p[2]);
};

/* ------------------------------------------------------------------ *
 * PAPILLARY MUSCLES
 *
 * Two groups, and the difference between them is a blood supply, not a shape.
 * The anterolateral muscle is fed twice over — by the first diagonal and the
 * first obtuse marginal — while the posteromedial one hangs off the posterior
 * descending alone. That single supply is why posteromedial rupture after an
 * inferior MI is 6-12 times commoner than anterolateral rupture.
 * ------------------------------------------------------------------ */
export const PAPILLARY: PapillaryMuscle[] = [
  {
    id: 'ALPM', name: 'anterolateral papillary muscle', short: 'anterolateral',
    theta: 55, base: 0.74, tip: 0.44, r0: 0.55, r1: 0.30, lean: 0.50,
    supply: ['D1', 'OM1'], dual: true,
    note: 'Dual supply from the first diagonal and the first obtuse marginal. Rarely ruptures.',
  },
  {
    id: 'PMPM', name: 'posteromedial papillary muscle', short: 'posteromedial',
    theta: 246, base: 0.76, tip: 0.46, r0: 0.50, r1: 0.28, lean: 0.50,
    supply: ['PDA'], dual: false,
    note: 'Single supply from the posterior descending. This is the one that ruptures, three to seven days after an inferior MI, giving sudden severe mitral regurgitation and flash pulmonary oedema.',
  },
];

// Base sits on the endocardium; the tip stands free in the cavity, leaning towards the axis.
export function papillaryAxisPoints(pm: PapillaryMuscle): [base: Vec3, tip: Vec3] {
  const a = pm.theta * Math.PI / 180;
  const rBase = Math.max(0.1, lvEndo(pm.theta, pm.base));
  const rTip = Math.max(0.1, lvEndo(pm.theta, pm.tip)) * pm.lean;
  return [
    [rBase * Math.cos(a), lvSurfY(pm.theta, pm.base), rBase * Math.sin(a)],
    [rTip * Math.cos(a), lvSurfY(pm.theta, pm.tip), rTip * Math.sin(a)],
  ];
}

/* ------------------------------------------------------------------ *
 * CONDUCTION SYSTEM
 *
 * Worth drawing because its blood supply is not the same as the muscle's, and
 * that mismatch is the whole explanation for two facts the page already states:
 * why heart block belongs to inferior infarcts, and why new right bundle branch
 * block with left anterior fascicular block localises a LAD lesion proximal to
 * the first septal perforator.
 *
 * Supply, from the anatomical literature: the sinus node artery comes off the
 * RCA in about 60% of hearts and the circumflex in the rest; the AV nodal
 * artery comes off whichever artery reaches the crux, so the RCA in about 90%.
 * The His bundle is dual-supplied (AV nodal artery plus the first septal
 * perforator). The right bundle and the left ANTERIOR fascicle are thin and
 * fed by the septal perforators alone — which is what makes them the pair that
 * fails together. The left posterior fascicle is broad and dual-supplied, so
 * isolated left posterior fascicular block is rare.
 * ------------------------------------------------------------------ */

const septalEndo = (t: number): Vec3 => lvEndoPoint(180, t);

export const CONDUCTION: ConductionPart[] = [
  {
    id: 'SAN', name: 'sinoatrial node', kind: 'node',
    at: [-3.30, 5.55, 0.62], r: 0.26,
    supply: ['SAN'], dual: false,
    block: 'Sinus node ischaemia: sinus bradycardia, sinus arrest or a junctional escape rhythm.',
    note: 'At the junction of the superior vena cava and the right atrial appendage. Fed by the sinus node artery, off the RCA in about 60% of hearts.',
  },
  {
    id: 'AVN', name: 'atrioventricular node', kind: 'node',
    at: [-0.62, 3.00, -0.78], r: 0.22,
    supply: ['AVN'], dual: false,
    block: 'AV nodal ischaemia: first-degree or Mobitz I (Wenckebach) block, sometimes complete block — but narrow complex, atropine-responsive and usually temporary.',
    note: 'In the triangle of Koch, bounded by the septal leaflet of the tricuspid valve, the tendon of Todaro and the mouth of the coronary sinus. Fed by the AV nodal branch of whichever artery reaches the crux.',
  },
  {
    id: 'HIS', name: 'bundle of His', kind: 'path',
    path: [[-0.62, 3.00, -0.78], [-0.75, 2.55, -0.45], [-0.95, 2.15, -0.10]], r: 0.09,
    supply: ['AVN', 'S1'], dual: true,
    block: 'Infranodal block: wide complex, unresponsive to atropine, and it does not recover on its own.',
    note: 'Penetrates the central fibrous body and the membranous septum, runs 1-3 mm along the septal crest, then divides. Dual-supplied, so it survives most single occlusions.',
  },
  {
    id: 'RBB', name: 'right bundle branch', kind: 'path',
    path: [[-0.95, 2.15, -0.10], [-1.75, 1.30, 0.55], [-2.35, -0.30, 1.05],
           [-2.70, -1.70, 1.15], [-2.55, -2.60, 0.85]], r: 0.075,
    supply: ['S1', 'S2'], dual: false,
    block: 'Right bundle branch block: RSR′ in V1 with a wide slurred S in I and V6.',
    note: 'A thin unbranched cord running down the right side of the septum to the moderator band and the anterior papillary muscle of the right ventricle. Fed by septal perforators only, which is why it is the first thing a proximal LAD occlusion takes out.',
  },
  {
    id: 'LAF', name: 'left anterior fascicle', kind: 'path',
    path: [septalEndo(0.16), [-1.15, 1.10, 0.55], [-0.35, 0.05, 1.05], [0.55, -1.05, 1.05]], r: 0.07,
    supply: ['S1'], dual: false,
    block: 'Left anterior fascicular block: left axis deviation past −45°, qR in aVL, rS inferiorly.',
    note: 'Thin and tendon-like, running to the anterolateral papillary muscle. Single septal supply, so it fails alongside the right bundle — new RBBB with LAFB places the lesion proximal to the first septal perforator.',
  },
  {
    id: 'LPF', name: 'left posterior fascicle', kind: 'path',
    path: [septalEndo(0.16), [-1.20, 1.05, -0.60], [-0.75, -0.35, -1.30], [-0.05, -1.55, -1.55]], r: 0.10,
    supply: ['S1', 'PDA'], dual: true,
    block: 'Left posterior fascicular block: right axis deviation with no other cause. Rare in isolation.',
    note: 'A broad fan running to the posteromedial papillary muscle. Dual-supplied and physically larger, so it is the hardest fascicle to knock out.',
  },
];

/* What the conduction system does when a given set of vessels loses flow.
 * A dual-supplied part needs BOTH its arteries gone before it fails. */
export function conductionState(deadIds: VesselId[] = []): ConductionState[] {
  const dead = new Set(deadIds);
  const out: ConductionState[] = [];
  for (const part of CONDUCTION) {
    const lost = part.supply.filter((v) => dead.has(v));
    const failed = part.dual ? lost.length === part.supply.length : lost.length > 0;
    out.push({ ...part, failed, lost });
  }
  return out;
}

// One line naming the rhythm or block that follows, for the readout.
export function conductionSummary(deadIds: VesselId[] = []): ConductionSummary | null {
  const failed = conductionState(deadIds).filter((p) => p.failed);
  if (!failed.length) return null;
  const ids = new Set(failed.map((p) => p.id));
  if (ids.has('RBB') && ids.has('LAF')) {
    return {
      name: 'Bifascicular block (RBBB + left anterior fascicular block)',
      detail: 'The right bundle and the left anterior fascicle share a single septal perforator supply, so they go together. New bifascicular block in an anterior MI means the occlusion is proximal to the first septal perforator, carries a large infarct, and threatens complete heart block that will not respond to atropine.',
      parts: failed,
    };
  }
  if (ids.has('HIS')) {
    return { name: 'Infranodal (His) block', detail: 'Wide complex, atropine-unresponsive, and it will need pacing.', parts: failed };
  }
  if (ids.has('AVN') && ids.has('SAN')) {
    return { name: 'Sinus and AV nodal ischaemia', detail: 'Bradycardia with AV block. Narrow complex and atropine-responsive, because the block is above the bundle of His, and it usually recovers with reperfusion.', parts: failed };
  }
  return { name: failed.map((p) => p.name).join(' + ') + ' ischaemia', detail: failed.map((p) => p.block).join(' '), parts: failed };
}

/* ------------------------------------------------------------------ *
 * VALVE ANNULI
 *
 * Four rings in one fibrous skeleton. Sizes from CMR reference values: mitral
 * 2.6-2.9 cm, tricuspid 2.9-3.2 cm — the tricuspid is the larger of the two,
 * and it sits 5-8 mm apical to the mitral, the offset whose loss is Ebstein's.
 * The aortic valve is the keystone, wedged between mitral and tricuspid and in
 * direct fibrous continuity with the anterior mitral leaflet. The pulmonary
 * valve is the odd one out: no fibrous continuity with anything, and it stands
 * anterior and superior to all three, on the far side of the infundibulum.
 * ------------------------------------------------------------------ */
export const VALVES: Valve[] = [
  {
    id: 'mitral', name: 'mitral valve', leaflets: 2, r: 1.40,
    c: [0.15, LV_TOP + 0.05, -0.10], normal: [-0.20, 1, 0.34],
    note: 'Two leaflets, the anterior one in fibrous continuity with the aortic valve. Both papillary muscles pull on both leaflets through the chordae, which is why either muscle rupturing floods the whole valve.',
  },
  {
    id: 'tricuspid', name: 'tricuspid valve', leaflets: 3, r: 1.55,
    c: [-2.45, LV_TOP - 0.62, 0.35], normal: [0.22, 1, 0.20],
    note: 'Larger than the mitral and set 5-8 mm closer to the apex. Its septal leaflet forms one side of the triangle of Koch, so the AV node lies immediately behind it.',
  },
  {
    id: 'aortic', name: 'aortic valve', leaflets: 3, r: 1.18,
    c: [-0.58, 3.18, -0.12], normal: [-0.10, 0.97, 0.20],
    note: 'The keystone of the fibrous skeleton, wedged between the other three. The left bundle emerges just beneath its non-coronary cusp, and the coronary ostia open from its left and right sinuses.',
  },
  {
    id: 'pulmonary', name: 'pulmonary valve', leaflets: 3, r: 1.12,
    c: [0.42, 4.32, 1.05], normal: [0.28, 0.93, -0.24],
    note: 'The most anterior and most superior of the four, carried up and away by the infundibulum. It has no fibrous continuity with any other valve, which is why it can be harvested whole for a Ross procedure.',
  },
];

export const valveById = (id: string): Valve | undefined => VALVES.find((v) => v.id === id);

// Apex points left, inferior and anterior — the heart lying obliquely in the chest.
export const APEX_DIR: Vec3 = [0.55, -0.72, 0.42];

/* Positions and triangle indices for a thick shell over a (theta, t) patch.
 * Kept free of Three.js so the topology can be checked in Node. */
export function shellMesh({ a0, a1, wrap, t0 = 0, t1 = 1, nA, nT, outer, inner }: ShellSpec): ShellMesh {
  const ring = wrap ? nA : nA + 1;
  const positions: number[] = [], thetas: number[] = [], ts: number[] = [], index: number[] = [];

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
  const quad = (a: number, b: number, c: number, d: number) => index.push(a, b, c, a, c, d);

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
export const LA_POS: EllipsoidSpec = { c: [0.15, 4.45, -1.70], r: [2.10, 1.45, 1.90] };
export const RA_POS: EllipsoidSpec = { c: [-3.05, 4.15, 0.15], r: [2.00, 1.83, 1.80] };

// Appendages. The right one is a broad flap over the aortic root, the left a
// narrow finger — both sit on the frontal outline, so the silhouette check needs them.
export const LAA: AppendageSpec = { path: [[1.5, 4.45, 0.15], [2.35, 4.25, 0.8], [2.8, 3.9, 1.2]], r: [0.45, 0.22] };
export const RAA: AppendageSpec = { path: [[-2.35, 4.5, 0.85], [-1.55, 4.6, 1.5], [-0.85, 4.4, 1.6]], r: [0.62, 0.34] };

// Frontal silhouette targets measured from the reference diagram (see README).
export const SILHOUETTE_ASPECT = 1.074;   // width / height of the cardiac outline
export const SILHOUETTE_APEX_FRAC = 0.72; // apex position across the width, from the patient's right

/* Orientation basis. Maps the build frame into the chest: local -y (the apex
 * direction) onto APEX_DIR, and local +z as close to true anterior as the long
 * axis allows. Returned as three world-space column vectors, so the same maths
 * drives the renderer and can be checked without a browser. */
let _basis: Basis | null = null;
export function heartBasis(): Basis {
  if (_basis) return _basis;
  const al = Math.hypot(APEX_DIR[0], APEX_DIR[1], APEX_DIR[2]);
  const A: Vec3 = [APEX_DIR[0] / al, APEX_DIR[1] / al, APEX_DIR[2] / al];
  const Y: Vec3 = [-A[0], -A[1], -A[2]];                 // local +y in world
  const d = Y[2];                                        // (0,0,1) . Y
  const f: Vec3 = [-Y[0] * d, -Y[1] * d, 1 - Y[2] * d];
  const fl = Math.hypot(f[0], f[1], f[2]);
  const Z: Vec3 = [f[0] / fl, f[1] / fl, f[2] / fl];     // local +z in world
  const X: Vec3 = [Y[1] * Z[2] - Y[2] * Z[1], Y[2] * Z[0] - Y[0] * Z[2], Y[0] * Z[1] - Y[1] * Z[0]];
  _basis = { X, Y, Z };
  return _basis;
}

export function localToWorld(p: Vec3): Vec3 {
  const { X, Y, Z } = heartBasis();
  return [
    X[0] * p[0] + Y[0] * p[1] + Z[0] * p[2],
    X[1] * p[0] + Y[1] * p[1] + Z[1] * p[2],
    X[2] * p[0] + Y[2] * p[1] + Z[2] * p[2],
  ];
}

/* Every epicardial point of the ventricles and atria, in world coordinates.
 * The frontal projection of this cloud is the cardiac silhouette. */
/** Point `u` of the way along segment `i` of a spine. The caller has already
 *  clamped `i`, so this only satisfies the compiler's bounds check. */
function lerpPath(path: Vec3[], i: number, u: number): Vec3 {
  const a = path[i] ?? [0, 0, 0];
  const b = path[i + 1] ?? a;
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}

export function silhouetteCloud(step = 4): Vec3[] {
  const pts: Vec3[] = [];
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
      const c = lerpPath(A.path, i, u);
      const rad = A.r[0] + (A.r[1] - A.r[0]) * f;
      for (let m = 0; m <= 6; m++) {
        const ph = (m / 6) * Math.PI;
        for (let j = 0; j < 12; j++) {
          const th = (j / 12) * 2 * Math.PI;
          pts.push(localToWorld([
            c[0] + rad * Math.sin(ph) * Math.cos(th),
            c[1] + rad * Math.cos(ph),
            c[2] + rad * Math.sin(ph) * Math.sin(th),
          ]));
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
 * CAMERA FITTING
 *
 * Kept here, as pure maths on plain tuples, because it is the one piece of the
 * renderer that is easy to get subtly wrong and easy to check numerically.
 * ------------------------------------------------------------------ */

/** The eight corners of an axis-aligned box. */
export function boxCorners(min: Vec3, max: Vec3): Vec3[] {
  const out: Vec3[] = [];
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) out.push([x, y, z]);
    }
  }
  return out;
}

const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a: Vec3, b: Vec3): Vec3 =>
  [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit3 = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** The camera's own axes for a given view direction. `dir` points from the
 *  target towards the camera. */
export function viewBasis(dir: Vec3): { right: Vec3; up: Vec3 } {
  const d = unit3(dir);
  // Straight up or down the world Y axis leaves "up" undefined; pick another.
  const hint: Vec3 = Math.abs(d[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0];
  const right = unit3(cross3(hint, d));
  return { right, up: unit3(cross3(d, right)) };
}

/* How far back a perspective camera has to sit for every corner to be inside
 * the frustum, given a vertical field of view in degrees and a width/height
 * aspect. `margin` is the air left around the silhouette.
 *
 * The obvious shortcut — a bounding sphere — takes its radius from half the box
 * diagonal, which for anything that is not roughly spherical overshoots badly:
 * for the heart's chamber box it is about 45% too far, which is what leaves the
 * model small in the middle of an empty viewport. Projecting the corners onto
 * the camera's own axes and solving per corner gives the tight answer. */
export function fitDistance(
  corners: Vec3[], centre: Vec3, dir: Vec3, fovDeg: number, aspect: number, margin = 1.06,
): number {
  const d = unit3(dir);
  const { right, up } = viewBasis(d);
  const vHalf = ((fovDeg * Math.PI) / 180) / 2;
  const hHalf = Math.atan(Math.tan(vHalf) * aspect);
  let needed = 0;
  for (const c of corners) {
    const o = sub3(c, centre);
    const depth = dot3(o, d);                       // towards the camera
    needed = Math.max(
      needed,
      depth + Math.abs(dot3(o, up)) / Math.tan(vHalf),
      depth + Math.abs(dot3(o, right)) / Math.tan(hHalf),
    );
  }
  return needed * margin;
}

/* ------------------------------------------------------------------ *
 * NAMED VIEWS
 *
 * These are CARDIAC views, so they are given in the heart's own frame and
 * rotated into the chest by the renderer — not taken as world directions.
 *
 * The long axis really does lie about 44 degrees oblique in the chest, so a
 * camera using world up shows the heart leaning at that angle. Correct, and
 * unreadable: you cannot compare an anterior wall with an inferior one while
 * both sit on the diagonal. Orienting the camera to the heart instead puts the
 * apex at the bottom in every view — the way a specimen sits in the hand, and
 * the way every textbook plate is drawn — without moving the model itself.
 * ------------------------------------------------------------------ */
export type ViewName = 'anterior' | 'inferior' | 'lateral' | 'septal' | 'apex' | 'anterolateral';

export const VIEW_LOCAL: Record<ViewName, { dir: Vec3; up: Vec3 }> = {
  anterior: { dir: [0, 0.12, 1], up: [0, 1, 0] },
  inferior: { dir: [0, -0.1, -1], up: [0, 1, 0] },
  lateral: { dir: [1, 0.1, 0.1], up: [0, 1, 0] },
  septal: { dir: [-1, 0.1, 0.1], up: [0, 1, 0] },
  // Down the long axis from the apex, anterior wall at the top — the same
  // orientation as the AHA bullseye drawn beside it.
  apex: { dir: [0, -1, 0], up: [0, 0, 1] },
  anterolateral: { dir: [0.5, 0.12, 1], up: [0, 1, 0] },
};

/** Rotate a direction out of the cardiac frame and into the chest. */
export function localDirToWorld(v: Vec3): Vec3 {
  const { X, Y, Z } = heartBasis();
  return unit3([
    X[0] * v[0] + Y[0] * v[1] + Z[0] * v[2],
    X[1] * v[0] + Y[1] * v[1] + Z[1] * v[2],
    X[2] * v[0] + Y[2] * v[1] + Z[2] * v[2],
  ]);
}

/* ------------------------------------------------------------------ *
 * SCANNED GEOMETRY
 * Radial sampler over a height map produced by tools/build_heart_meshes.py.
 * Lets the procedural coronaries follow a scanned surface instead of the
 * analytic one, so everything downstream keeps working unchanged.
 * ------------------------------------------------------------------ */

export function heightSampler(map: HeightMap): (thetaDeg: number, t: number) => number {
  const { nTheta, nT, grid } = map;
  return function radius(thetaDeg: number, t: number): number {
    const a = (norm360(thetaDeg) / 360) * nTheta;
    const ti = Math.min(nT - 1 - 1e-9, Math.max(0, t * nT - 0.5));
    const i0 = Math.floor(ti), i1 = Math.min(nT - 1, i0 + 1), ft = ti - i0;
    const j0 = Math.floor(a) % nTheta, j1 = (j0 + 1) % nTheta, fa = a - Math.floor(a);
    const lerp = (p: number, q: number, f: number) => p + (q - p) * f;
    const row0 = grid[i0] ?? [], row1 = grid[i1] ?? [];
    return lerp(lerp(row0[j0] ?? 0, row0[j1] ?? 0, fa),
                lerp(row1[j0] ?? 0, row1[j1] ?? 0, fa), ft);
  };
}

// Same shape as lvPoint, but the radius comes from a sampler.
export function sampledPoint(radius: (th: number, t: number) => number, thetaDeg: number, t: number, off = 0): Vec3 {
  const a = thetaDeg * Math.PI / 180;
  const r = radius(thetaDeg, t) + off;
  return [r * Math.cos(a), lvY(t), r * Math.sin(a)];
}
