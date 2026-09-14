/* The colours the model is painted in.
 *
 * Plain strings, and deliberately free of any Three.js import: the bullseye and
 * the legend need these, and pulling the renderer in for a hex code would put
 * half a megabyte of Three into the first chunk the browser has to parse. */
import type { Stage } from './heart-data';

/** Healthy myocardium, and the colour every other state is read against. */
export const HEALTHY = '#a8443f';

/** The infarct as it ages: dusky, then mottled, then yellow and soft, then scar. */
export function infarctHex(stage: Stage): string {
  switch (stage.id) {
    case 0: return HEALTHY;
    case 1: return '#a8443f';   // nothing visible yet
    case 2: return '#9c4340';
    case 3: return '#6d3540';   // dark mottling
    case 4: return '#5d2f3c';
    case 5: return '#b08a4a';   // yellow-tan
    case 6: return '#d3b264';   // maximally yellow, soft
    case 7: return '#9c8a76';   // red-grey granulation
    case 8: return '#c3bdb0';   // grey-white scar
    default: return '#ded9cf';  // dense white scar
  }
}

/** The palette the legend has to agree with. Exported so the two cannot drift. */
export const SWATCHES = {
  artery: '#cf3b2f',
  vein: '#3f6fb8',
  occluded: '#6b6660',
  viable: HEALTHY,
  rightVentricle: '#8e5a52',
  infarct: '#d3b264',
  conduction: '#e8c85a',
  valve: '#d8cfc0',
} as const;

/** Conduction tissue that has lost its supply, and the papillary muscle colour. */
export const DEAD_TISSUE = '#7b7470';
export const PAPILLARY_COLOUR = '#8f3b37';
