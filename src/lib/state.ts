/* The single source of truth for what the page is showing.
 *
 * Kept as one store rather than scattered signals so the 3D scene, the ECG, the
 * bullseye and the panels can never disagree about which heart they are drawing. */
import { createMemo } from 'solid-js';
import { createStore } from 'solid-js/store';
import { SCENARIOS, STAGES, withDominance } from './heart-data';
import type { DominanceId, Patient, Scenario, Stage } from './heart-data';

export interface LabState {
  scenarioId: string;
  dominance: DominanceId;
  stage: number;
  showArteries: boolean;
  showVeins: boolean;
  showChambers: boolean;
  showConduction: boolean;
  /** Papillary muscles and valves. */
  showInternals: boolean;
  /** Branches present in only some hearts, such as the ramus intermedius. */
  showVariants: boolean;
  wallOpacity: number;
  spin: boolean;
  geometry: 'scanned' | 'procedural';
  patient: Patient;
}

const INITIAL: LabState = {
  scenarioId: 'none',
  dominance: 'right',
  stage: 2,
  showArteries: true,
  showVeins: false,
  showChambers: true,
  showConduction: false,
  showInternals: false,
  showVariants: false,
  wallOpacity: 0.7,
  spin: true,
  geometry: 'scanned',
  patient: 'man>=40',
};

export function createLab() {
  const [state, setState] = createStore<LabState>({ ...INITIAL });

  const base = createMemo(
    () => SCENARIOS.find((s) => s.id === state.scenarioId) ?? SCENARIOS[0]!,
  );

  /** The scenario as it plays out in THIS heart. Dominance moves the crux
   *  territory, so everything downstream reads this, not the right-dominant base. */
  const scenario = createMemo<Scenario>(() => withDominance(base(), state.dominance));
  const stage = createMemo<Stage>(() => STAGES[state.stage] ?? STAGES[0]!);

  return { state, setState, scenario, stage };
}

export type Lab = ReturnType<typeof createLab>;
