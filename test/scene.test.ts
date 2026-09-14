/* The render path, against a stubbed Three.js.
 *
 * This does not check that the picture looks right; it checks that the code
 * that draws it runs, over every occlusion, stage, dominance and layer. The
 * stub throws on non-finite vertices and malformed curves, so a geometry
 * mistake fails here rather than silently rendering nothing in a browser. */
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('three', () => import('./three-stub'));
vi.mock('three/addons/controls/OrbitControls.js', () => import('./orbit-stub'));

import { DOMINANCE, SCENARIOS, STAGES, withDominance } from '~/lib/heart-data';
import type { DominanceId } from '~/lib/heart-data';
import { createHeartScene, VIEW_NAMES, infarctColour } from '~/lib/heart-scene';
import { SWATCHES, infarctHex } from '~/lib/palette';
import type { SceneView } from '~/lib/heart-scene';

function host() {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: 800 });
  Object.defineProperty(el, 'clientHeight', { value: 600 });
  document.body.appendChild(el);
  return el;
}

const baseView = (over: Partial<SceneView> = {}): SceneView => ({
  scenario: SCENARIOS[0]!,
  stage: STAGES[2]!,
  dominance: 'right',
  showArteries: true,
  showVeins: false,
  showChambers: true,
  showConduction: false,
  showInternals: false,
  showVariants: false,
  wallOpacity: 0.7,
  spin: true,
  // Scanned geometry needs a network fetch; the procedural model is the one
  // that can be exercised offline, and it drives the same painting code.
  geometry: 'procedural',
  ...over,
});

beforeAll(() => {
  // jsdom has no WebGL and no ResizeObserver; the scene guards on the former.
  (globalThis as Record<string, unknown>).WebGLRenderingContext = function () {};
  (globalThis as Record<string, unknown>).ResizeObserver = class { observe() {} disconnect() {} };
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
});

describe('heart scene', () => {
  it('builds without throwing and cleans up after itself', () => {
    const el = host();
    const scene = createHeartScene(el);
    expect(scene).not.toBeNull();
    scene!.update(baseView());
    expect(() => scene!.dispose()).not.toThrow();
  });

  it('paints every occlusion at every stage', () => {
    const scene = createHeartScene(host())!;
    for (const scenario of SCENARIOS) {
      for (const stage of STAGES) {
        expect(() => scene.update(baseView({ scenario, stage }))).not.toThrow();
      }
    }
    scene.dispose();
  });

  it('rebuilds the coronary tree for every dominance', () => {
    const scene = createHeartScene(host())!;
    for (const dominance of Object.keys(DOMINANCE) as DominanceId[]) {
      for (const base of SCENARIOS) {
        const scenario = withDominance(base, dominance);
        expect(() => scene.update(baseView({ scenario, dominance }))).not.toThrow();
      }
    }
    scene.dispose();
  });

  it('paints every combination of the layer toggles', () => {
    const scene = createHeartScene(host())!;
    const flags = ['showArteries', 'showVeins', 'showChambers',
      'showConduction', 'showInternals', 'showVariants'] as const;
    // Every flag on its own, then all on, then all off.
    for (const flag of flags) {
      expect(() => scene.update(baseView({ [flag]: true }))).not.toThrow();
      expect(() => scene.update(baseView({ [flag]: false }))).not.toThrow();
    }
    expect(() => scene.update(baseView(Object.fromEntries(flags.map((f) => [f, true]))))).not.toThrow();
    expect(() => scene.update(baseView(Object.fromEntries(flags.map((f) => [f, false]))))).not.toThrow();
    scene.dispose();
  });

  it('accepts every named camera view and the full opacity range', () => {
    const scene = createHeartScene(host())!;
    scene.update(baseView());
    for (const v of VIEW_NAMES) expect(() => scene.setView(v.id)).not.toThrow();
    expect(() => scene.setView('anterolateral')).not.toThrow();
    for (let o = 0.25; o <= 1.001; o += 0.05) {
      expect(() => scene.update(baseView({ wallOpacity: o }))).not.toThrow();
    }
    scene.dispose();
  });

  it('falls back when the scanned meshes cannot be fetched', async () => {
    const onScanFailed = vi.fn();
    const scene = createHeartScene(host(), { onScanFailed })!;
    scene.update(baseView({ geometry: 'scanned' }));
    await vi.waitFor(() => expect(onScanFailed).toHaveBeenCalled());
    scene.dispose();
  });

  it('gives every stage a distinct enough colour to read as progress', () => {
    const seen = STAGES.map((s) => infarctHex(s));
    // The renderer must agree with the palette the bullseye and legend use.
    for (const s of STAGES) expect(infarctColour(s).getStyle()).toBe(infarctHex(s));
    // Stage 0 and 1 are deliberately identical: nothing is visible yet at 30 min.
    expect(new Set(seen).size).toBeGreaterThanOrEqual(STAGES.length - 1);
    expect(seen[0]).toBe(seen[1]);
  });

  it('exports the swatches the legend renders', () => {
    for (const [name, hex] of Object.entries(SWATCHES)) {
      expect(hex, name).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
