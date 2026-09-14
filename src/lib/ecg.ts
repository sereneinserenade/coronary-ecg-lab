/* The 12-lead trace, drawn on a 2D canvas at true 25 mm/s, 10 mm/mV.
 * Pure drawing: it takes a snapshot and a context, and touches nothing else. */
import {
  ALL_LEADS, MM_PER_MV, MM_PER_S, beat, leadState, rrFor, stDeviation, stThreshold,
} from './heart-data';
import type { ExtraLead, Lead, Patient, Scenario, Stage } from './heart-data';

const ECG_ROWS: Lead[][] = [
  ['I', 'aVR', 'V1', 'V4'],
  ['II', 'aVL', 'V2', 'V5'],
  ['III', 'aVF', 'V3', 'V6'],
];

export interface EcgView {
  scenario: Scenario;
  stage: Stage;
  patient: Patient;
  dark: boolean;
}

/** Height the canvas needs at a given width, so the caller can reserve it and
 *  avoid a layout shift when the extra-lead row appears. */
export function ecgHeight(width: number, scenario: Scenario, stage: Stage): number {
  const extras = stage.id !== 0 ? scenario.extras : [];
  return Math.round(width * (extras.length ? 0.58 : 0.46));
}

export interface EcgMeasurement {
  lead: Lead;
  mm: number;
  threshold: number;
  significant: boolean;
}

/** Every lead with a readable ST shift, worst first. Drives both the on-canvas
 *  labels and the measurement chips beside it, so the two cannot disagree. */
export function measure(v: EcgView): EcgMeasurement[] {
  return ALL_LEADS
    .map((lead) => {
      const mm = stDeviation(lead, v.scenario, v.stage) * MM_PER_MV;
      const threshold = stThreshold(lead, v.patient) * MM_PER_MV;
      return { lead, mm, threshold, significant: Math.abs(mm) >= threshold };
    })
    .filter((r) => Math.abs(r.mm) >= 0.4)
    .sort((a, b) => Math.abs(b.mm) - Math.abs(a.mm));
}

export function drawECG(canvas: HTMLCanvasElement, v: EcgView): void {
  const cssW = canvas.clientWidth;
  if (!cssW) return;                    // laid out at zero width; nothing to draw
  const c = canvas.getContext('2d');
  if (!c) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const hr = v.stage.id === 0 ? 75 : v.scenario.hr;
  const rr = rrFor(hr);
  // A fifth row appears only when the scenario is one you would actually reach
  // for extra electrodes on: V4R for the right ventricle, V7-V9 for the back.
  const extras: ExtraLead[] = v.stage.id !== 0 ? v.scenario.extras : [];
  const rows = 4 + (extras.length ? 1 : 0);
  const cssH = ecgHeight(cssW, v.scenario, v.stage);

  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  canvas.style.height = `${cssH}px`;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);

  const paper = v.dark ? '#191313' : '#fff8f7';
  const fine = v.dark ? '#3a2626' : '#f6d3cf';
  const bold = v.dark ? '#5a3434' : '#eda9a2';
  const ink = v.dark ? '#f0efe9' : '#16110f';

  c.fillStyle = paper;
  c.fillRect(0, 0, cssW, cssH);

  // 1 large box = 0.2 s = 5 mm. Scale so roughly four beats fit each column.
  const pad = 6;
  const rowH = (cssH - pad * 2) / rows;
  const pxPerMm = Math.min(rowH / 13, (cssW - pad * 2) / (4 * MM_PER_S * 0.8 + 4));
  const pxPerS = pxPerMm * MM_PER_S;
  const pxPerMv = pxPerMm * MM_PER_MV;

  c.lineWidth = 1;
  for (let i = 0; i * pxPerMm < cssW; i++) {
    c.strokeStyle = i % 5 === 0 ? bold : fine;
    c.beginPath(); c.moveTo(i * pxPerMm + 0.5, 0); c.lineTo(i * pxPerMm + 0.5, cssH); c.stroke();
  }
  for (let j = 0; j * pxPerMm < cssH; j++) {
    c.strokeStyle = j % 5 === 0 ? bold : fine;
    c.beginPath(); c.moveTo(0, j * pxPerMm + 0.5); c.lineTo(cssW, j * pxPerMm + 0.5); c.stroke();
  }

  const byLead = new Map(measure(v).map((m) => [m.lead, m]));

  const trace = (lead: Lead, x0: number, width: number, baseY: number) => {
    const { m, offset } = leadState(lead, v.scenario, v.stage);
    c.strokeStyle = ink;
    c.lineWidth = 1.6;
    c.lineJoin = 'round';
    c.beginPath();
    const steps = Math.max(80, Math.round(width));
    for (let i = 0; i <= steps; i++) {
      const x = x0 + (i / steps) * width;
      const tIn = ((i / steps) * (width / pxPerS)) % rr;
      const y = baseY - beat(tIn, m, offset) * pxPerMv;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();

    c.fillStyle = ink;
    c.font = `600 ${Math.max(9, pxPerMm * 2.6)}px ui-sans-serif, system-ui, sans-serif`;
    c.fillText(lead, x0 + 3, baseY - rowH * 0.36);

    // Flag the abnormal leads, and say by how much — reading ST shift in
    // millimetres off the paper is the skill this is meant to teach.
    const found = v.stage.id !== 0 ? byLead.get(lead) : undefined;
    if (found) {
      c.fillStyle = found.mm > 0 ? '#d13b2e' : '#2f6fd0';
      c.font = `${found.significant ? 700 : 400} ${Math.max(8, pxPerMm * 2.3)}px ui-sans-serif, system-ui, sans-serif`;
      const label = `${found.mm > 0 ? '↑' : '↓'}${Math.abs(found.mm).toFixed(1)}${found.significant ? '*' : ''}`;
      c.fillText(label, x0 + width - pxPerMm * 10, baseY - rowH * 0.36);
    }
  };

  const colW = (cssW - pad * 2) / 4;
  ECG_ROWS.forEach((row, r) => {
    const baseY = pad + rowH * (r + 0.62);
    row.forEach((lead, col) => trace(lead, pad + col * colW, colW - 4, baseY));
  });
  // Rhythm strip, lead II, full width.
  trace('II', pad, cssW - pad * 2 - 4, pad + rowH * 3.62);

  if (extras.length) {
    const w = (cssW - pad * 2) / extras.length;
    extras.forEach((lead, col) => trace(lead, pad + col * w, w - 4, pad + rowH * 4.62));
  }

  c.fillStyle = ink;
  c.globalAlpha = 0.55;
  c.font = `${Math.max(8, pxPerMm * 2.2)}px ui-sans-serif, system-ui, sans-serif`;
  c.fillText(
    `25 mm/s   10 mm/mV   HR ${hr}   ↑↓ = ST shift in mm, * clears the diagnostic threshold`,
    pad + 2, cssH - 4);
  c.globalAlpha = 1;
}
