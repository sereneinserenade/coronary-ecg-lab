/* The 3D heart.
 *
 * Deliberately framework-agnostic: it owns a Three.js scene and nothing else.
 * Solid drives it by calling `update()` with a plain snapshot of the view, so
 * the renderer never reads a signal and nothing here needs a component tree.
 * That is also what lets it be driven from Node against a stubbed Three.js. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  ANT_GROOVE, APEX_DIR, CONDUCTION, DOMINANCE, LAA, LA_POS, LV_LEN, LV_TOP,
  PAPILLARY, POST_GROOVE, RAA, RA_POS, RV_T0, RV_TIP, VALVES,
  ahaSegment, conductionState, heartBasis, heightSampler, lvEndoPoint, lvPoint,
  lvRadius, lvSurfY, lvWall, papillaryAxisPoints, rvInnerPoint, rvPoint,
  sampledPoint, shellMesh,
} from './heart-data';
import type {
  ConductionPart, DominanceId, HeightMap, PapillaryMuscle, Scenario, ShellSpec,
  Stage, Vec3, VesselId,
} from './heart-data';
import * as PALETTE from './palette';

/** Everything the scene needs to paint itself. A plain snapshot, never a signal. */
export interface SceneView {
  scenario: Scenario;
  stage: Stage;
  dominance: DominanceId;
  showArteries: boolean;
  showVeins: boolean;
  showChambers: boolean;
  showConduction: boolean;
  showInternals: boolean;
  showVariants: boolean;
  wallOpacity: number;
  spin: boolean;
  geometry: 'scanned' | 'procedural';
}

export type ViewName = 'anterior' | 'inferior' | 'lateral' | 'septal' | 'apex' | 'anterolateral';

export const VIEW_NAMES: { id: ViewName; label: string }[] = [
  { id: 'anterior', label: 'Anterior' },
  { id: 'inferior', label: 'Inferior' },
  { id: 'lateral', label: 'Lateral' },
  { id: 'septal', label: 'Septal' },
  { id: 'apex', label: 'Short axis' },
];

export interface HeartScene {
  update(view: SceneView): void;
  setView(name: ViewName): void;
  dispose(): void;
}

export interface SceneOptions {
  /** Status line for the geometry toggle. */
  onNote?: (note: string) => void;
  /** Called when scanned geometry cannot be fetched, so the UI can fall back. */
  onScanFailed?: (err: unknown) => void;
}

interface ScannedPart { file: string; triangles: number; vertices: number; role: string; label: string }
interface Manifest {
  parts: Record<string, ScannedPart>;
  lvHeightMap: HeightMap;
  rvHeightMap: HeightMap;
}

interface Scanned {
  group: THREE.Group;
  meshes: Record<string, THREE.Mesh>;
  manifest: Manifest;
  apparatus: { group: THREE.Group; meshes: Record<string, THREE.Mesh> } | null;
  lvSample: (th: number, t: number) => number;
  rvSample: (th: number, t: number) => number;
}

interface VesselEntry {
  mesh: THREE.Mesh;
  kind: 'artery' | 'vein';
  material: THREE.MeshStandardMaterial;
  base: THREE.Color;
}

const SCANNED_STYLE: Record<string, { color: string; vertexColours: boolean; opacity: number }> = {
  lv: { color: '#a8443f', vertexColours: true, opacity: 1 },
  rv: { color: '#8e5a52', vertexColours: false, opacity: 0.72 },
  la: { color: '#9d6f66', vertexColours: false, opacity: 0.55 },
  ra: { color: '#9d6f66', vertexColours: false, opacity: 0.55 },
};

// Valves and papillary muscles, scanned rather than sculpted. About 400 KB
// together, so they are fetched the first time the reader asks to see them.
const SCANNED_APPARATUS: Record<string, { color: string; opacity: number }> = {
  mv: { color: '#e0d3bf', opacity: 0.9 },
  tv: { color: '#e0d3bf', opacity: 0.9 },
  av: { color: '#d8cfc0', opacity: 0.95 },
  pv: { color: '#d8cfc0', opacity: 0.95 },
  pap: { color: '#8f3b37', opacity: 1 },
};

const HEALTHY = new THREE.Color(PALETTE.HEALTHY);
const DEAD_COLOUR = new THREE.Color(PALETTE.SWATCHES.occluded);
const DEAD_TISSUE = new THREE.Color(PALETTE.DEAD_TISSUE);
const NODE_COLOUR = PALETTE.SWATCHES.conduction;   // pale against the muscle
const PAP_COLOUR = PALETTE.PAPILLARY_COLOUR;

/** The infarct colour as a Three.js colour. The hex lives in the palette so the
 *  bullseye can use the same value without importing the renderer. */
export function infarctColour(stage: Stage): THREE.Color {
  return new THREE.Color(PALETTE.infarctHex(stage));
}

const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function createHeartScene(host: HTMLElement, opts: SceneOptions = {}): HeartScene | null {
  if (typeof WebGLRenderingContext === 'undefined') return null;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null;
  }

  /* --- surface samplers -------------------------------------------------
   * Swapped when the scanned geometry loads, so the coronaries lie on whichever
   * surface is showing without any other code needing to know which that is. */
  let surf = (th: number, t: number, off = 0) => new THREE.Vector3(...lvPoint(th, t, off));
  let rvSurf = (th: number, t: number, off = 0) => new THREE.Vector3(...rvPoint(th, t, off));

  const vessels = new Map<VesselId, VesselEntry>();
  const papillary = new Map<string, { mesh: THREE.Mesh; spec: PapillaryMuscle; material: THREE.MeshStandardMaterial }>();
  const conduction = new Map<string, { mesh: THREE.Mesh; spec: ConductionPart; material: THREE.MeshStandardMaterial }>();
  let chamberExtras: THREE.Mesh[] = [];
  let lvMesh: THREE.Mesh | undefined;
  let rvMesh: THREE.Mesh | undefined;
  let valveGroup: THREE.Group | undefined;
  let lesionMarker: THREE.Mesh;

  let scanned: Scanned | null = null;
  let scannedLoading: Promise<Scanned> | null = null;
  let apparatusLoading: Promise<unknown> | null = null;
  let appliedGeometry: SceneView['geometry'] | null = null;
  let appliedDominance: DominanceId | null = null;
  let view: SceneView | null = null;

  /* --- generic thick shell over a (theta, t) patch --------------------- */

  function buildShell(spec: ShellSpec): THREE.BufferGeometry {
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

  function tube(
    points: THREE.Vector3[], r0: number, r1: number,
    material: THREE.Material, radialSegs = 12,
  ): THREE.Mesh {
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.35);
    const n = Math.max(24, points.length * 10);
    const g = new THREE.TubeGeometry(curve, n, 1, radialSegs, false);
    // TubeGeometry has a constant radius; taper it by scaling each ring outward from the spine.
    const pos = g.attributes.position!, nor = g.attributes.normal!;
    if (r0 !== r1) {
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
      color: PALETTE.SWATCHES.rightVentricle, roughness: 0.75, transparent: true, opacity: 0.72, side: THREE.DoubleSide,
    }));
    group.add(rvMesh);
  }

  function buildAtriaAndGreatVessels(): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
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
    const appendage = (spec: { path: Vec3[]; r: [number, number] }, flatten: number) => {
      const seg = spec.path.length - 1, lobes: THREE.Mesh[] = [];
      for (let k = 0; k <= 6; k++) {
        const f = k / 6, i = Math.min(seg - 1, Math.floor(f * seg)), u = f * seg - i;
        const a = spec.path[i]!, b = spec.path[i + 1] ?? a;
        const c: Vec3 = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
        const r = spec.r[0] + (spec.r[1] - spec.r[0]) * f;
        const m = new THREE.Mesh(new THREE.SphereGeometry(r * (k % 2 ? 1.12 : 0.94), 16, 12), wall);
        m.position.set(c[0], c[1], c[2]);
        m.scale.set(1, flatten, 1.18);
        lobes.push(m);
      }
      return lobes;
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
    for (const [x, y] of [[-0.9, 5.05], [-0.8, 4.0], [1.6, 5.05], [1.5, 4.0]] as const) {
      const s = Math.sign(x) || 1;
      out.push(tube([V3(x, y, -2.55), V3(x + s * 1.15, y + 0.2, -3.25)], 0.42, 0.36, venous, 10));
    }

    out.forEach((m) => { m.userData.kind = m.userData.kind || 'vessel'; group.add(m); });
    return out;
  }

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
    // Coronaries taper. A vessel that keeps its calibre from ostium to apex reads as
    // plumbing; the narrowing is what makes the distal tree look like a tree.
    const make = (kind: 'artery' | 'vein', colour: string) =>
      (id: VesselId, pts: THREE.Vector3[], r0: number, r1: number = r0 * 0.66) => {
      const mat = new THREE.MeshStandardMaterial({ color: colour, roughness: kind === 'artery' ? 0.45 : 0.5, metalness: 0.05 });
      const mesh = tube(pts, r0, r1, mat, 8);
      mesh.userData.vesselId = id;
      group.add(mesh);
      vessels.set(id, { mesh, kind, material: mat, base: mat.color.clone() });
    };
    const A = make('artery', '#cf3b2f');
    const V = make('vein', '#3f6fb8');

    const dom = DOMINANCE[view?.dominance ?? 'right'] ?? DOMINANCE.right;
    const leftSinus = V3(-0.15, 3.35, 0.6);
    const rightSinus = V3(-1.25, 3.3, -0.1);
    const G = ANT_GROOVE;      // 122
    const P = POST_GROOVE;     // 232
    // Whichever artery reaches the crux is the dominant one. The other stops short.
    const rcaEnd = dom.pdaFrom === 'RCA' ? P : 250;
    const lcxEnd = dom.pdaFrom === 'LCX' ? P : (dom.plvFrom === 'LCX' ? 254 : 276);

    // --- Left system: LM bifurcates into the LAD (anterior IV groove) and the LCx
    //     (left AV groove, sweeping the LV free wall towards the crux).
    A('LM', [leftSinus, surf(G + 12, 0.03, 0.22), surf(G + 4, 0.055, 0.2)], 0.13, 0.12);
    A('LAD1', [surf(G + 4, 0.055, 0.2), surf(G, 0.16, 0.18), surf(G - 2, 0.28, 0.17)], 0.10, 0.092);
    A('LAD2', [surf(G - 2, 0.28, 0.17), surf(G - 4, 0.42, 0.16), surf(G - 6, 0.58, 0.15)], 0.088, 0.074);
    A('LAD3', [surf(G - 6, 0.58, 0.15), surf(G - 8, 0.74, 0.14), surf(G - 12, 0.88, 0.13),
               surf(170, 0.965, 0.12), surf(P - 20, 0.93, 0.12), surf(P - 16, 0.82, 0.13)], 0.07, 0.038);
    A('D1', [surf(G - 2, 0.28, 0.17), surf(95, 0.34, 0.19), surf(68, 0.43, 0.19), surf(50, 0.53, 0.18)], 0.078, 0.042);
    A('D2', [surf(G - 5, 0.50, 0.16), surf(96, 0.58, 0.17), surf(78, 0.68, 0.16)], 0.062, 0.034);
    // Septal perforators dive straight into the septum off the back of the LAD.
    A('S1', [surf(G + 2, 0.20, 0.14), V3(-1.35, lvSurfY(160, 0.24), 0.5)], 0.052, 0.03);
    A('S2', [surf(G - 3, 0.40, 0.13), V3(-1.0, lvSurfY(160, 0.44), 0.35)], 0.046, 0.026);
    A('S3', [surf(G - 6, 0.62, 0.12), V3(-0.6, lvSurfY(160, 0.66), 0.2)], 0.04, 0.022);
    // Ramus intermedius: a third trunk straight off the left main, in 15-30% of hearts.
    A('RI', [surf(G + 8, 0.05, 0.21), surf(86, 0.22, 0.20), surf(64, 0.38, 0.19), surf(52, 0.50, 0.18)], 0.072, 0.036);
    A('LCX1', [surf(G + 10, 0.045, 0.22), surf(100, 0.04, 0.22), surf(62, 0.045, 0.22), surf(24, 0.06, 0.22)], 0.10, 0.092);
    A('LCX2', [surf(24, 0.06, 0.22), surf(345, 0.07, 0.22), surf(310, 0.075, 0.22),
               surf(Math.min(288, (310 + lcxEnd) / 2), 0.08, 0.22), surf(lcxEnd, 0.10, 0.2)],
       0.086, dom.pdaFrom === 'LCX' ? 0.07 : 0.05);
    A('OM1', [surf(24, 0.06, 0.20), surf(8, 0.28, 0.19), surf(356, 0.46, 0.18), surf(350, 0.58, 0.17)], 0.072, 0.04);
    A('OM2', [surf(330, 0.07, 0.20), surf(322, 0.30, 0.19), surf(318, 0.46, 0.18)], 0.062, 0.034);

    // --- Right system: the RCA rides the right AV groove over the RV convexity to
    //     the crux, then gives the PDA down the posterior IV groove.
    A('RCA1', [rightSinus, rvSurf(142, 0.09, 0.16), rvSurf(165, 0.10, 0.18)], 0.115, 0.106);
    A('RCA2', [rvSurf(165, 0.10, 0.18), rvSurf(190, 0.105, 0.18), rvSurf(212, 0.115, 0.17)], 0.10, 0.094);
    A('RCA3', [rvSurf(212, 0.115, 0.17), rvSurf(224, 0.125, 0.16), surf(rcaEnd, 0.13, 0.16)],
       0.09, dom.pdaFrom === 'RCA' ? 0.082 : 0.05);
    // Conus branch: the first thing off the RCA, over the outflow tract. It is the
    // collateral that can keep an occluded LAD alive (the circle of Vieussens).
    A('CB', [rightSinus, rvSurf(150, 0.055, 0.2), V3(-3.1, 3.85, 1.5), V3(-1.9, 4.1, 2.0)], 0.055, 0.03);
    A('RV1', [rvSurf(178, 0.10, 0.16), rvSurf(180, 0.26, 0.15), rvSurf(182, 0.42, 0.14)], 0.05, 0.028);
    A('AM', [rvSurf(200, 0.11, 0.16), rvSurf(205, 0.28, 0.15), rvSurf(208, 0.5, 0.14), rvSurf(210, 0.7, 0.13)], 0.068, 0.036);
    A('RV2', [rvSurf(218, 0.12, 0.16), rvSurf(220, 0.3, 0.15), rvSurf(222, 0.46, 0.14)], 0.046, 0.026);
    A('PDA', [surf(P, 0.13, 0.15), surf(P - 4, 0.32, 0.14), surf(P - 8, 0.54, 0.13),
              surf(P - 12, 0.76, 0.12), surf(P - 18, 0.88, 0.12)], 0.078, 0.04);
    // Posterior septals climb the back third of the septum to meet the anterior ones.
    A('PS1', [surf(P - 3, 0.28, 0.12), V3(-0.95, lvSurfY(205, 0.32), -0.55)], 0.042, 0.024);
    A('PS2', [surf(P - 9, 0.58, 0.11), V3(-0.55, lvSurfY(205, 0.62), -0.3)], 0.036, 0.02);
    A('PLV', [surf(P, 0.13, 0.15), surf(262, 0.24, 0.15), surf(276, 0.38, 0.14)], 0.062, 0.034);
    A('SAN', [rvSurf(150, 0.095, 0.16), V3(-3.0, 4.6, 0.5), V3(-3.25, 5.4, 0.55)], 0.052, 0.03);
    A('AVN', [surf(P + 2, 0.13, 0.14), V3(-0.62, 3.00, -0.78)], 0.046, 0.026);

    // --- Venous system: every large vein accompanies an artery, and all but the
    //     anterior cardiac veins drain to the coronary sinus.
    V('CS', [surf(300, 0.075, 0.26), surf(276, 0.08, 0.28), surf(252, 0.09, 0.3),
             surf(P, 0.12, 0.32), V3(-2.1, 3.9, -1.3)], 0.12, 0.13);
    V('GCV', [surf(G + 6, 0.86, 0.13), surf(G + 8, 0.6, 0.15), surf(G + 10, 0.34, 0.18),
              surf(G + 14, 0.1, 0.22), surf(104, 0.07, 0.24), surf(66, 0.07, 0.25),
              surf(28, 0.09, 0.26), surf(348, 0.09, 0.26), surf(316, 0.085, 0.26), surf(300, 0.075, 0.26)], 0.062, 0.1);
    V('MCV', [surf(P - 14, 0.86, 0.12), surf(P - 10, 0.6, 0.14), surf(P - 6, 0.36, 0.17),
              surf(P - 2, 0.17, 0.24), surf(P, 0.125, 0.3), surf(252, 0.09, 0.3)], 0.055, 0.09);
    V('SCV', [rvSurf(196, 0.52, 0.13), rvSurf(200, 0.3, 0.15), rvSurf(210, 0.12, 0.2),
              rvSurf(224, 0.115, 0.22), surf(P, 0.12, 0.32)], 0.042, 0.07);
    V('PVLV', [surf(288, 0.5, 0.16), surf(290, 0.32, 0.2), surf(292, 0.15, 0.24), surf(288, 0.08, 0.26)], 0.04, 0.062);
    V('ACV', [rvSurf(170, 0.42, 0.14), rvSurf(168, 0.2, 0.16), V3(-2.9, 4.0, 0.6)], 0.036, 0.055);

    buildPapillary();
    buildConduction();
  }

  /* --- papillary muscles, conduction system and valves ------------------ *
   * All three are built in the same pass as the coronaries because all three are
   * coloured by which coronary is occluded, not by which wall is infarcted. */

  function clearMap(m: Map<string, { mesh: THREE.Mesh }>) {
    for (const v of m.values()) {
      group.remove(v.mesh);
      v.mesh.geometry.dispose();
      (v.mesh.material as THREE.Material).dispose();
    }
    m.clear();
  }

  function buildPapillary() {
    clearMap(papillary);
    for (const pm of PAPILLARY) {
      const [base, tip] = papillaryAxisPoints(pm);
      const mid: Vec3 = [
        (base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2, (base[2] + tip[2]) / 2,
      ];
      const mat = new THREE.MeshStandardMaterial({ color: PAP_COLOUR, roughness: 0.8 });
      const mesh = tube([V3(...base), V3(...mid), V3(...tip)], pm.r0, pm.r1, mat, 12);
      mesh.userData.papId = pm.id;
      group.add(mesh);
      papillary.set(pm.id, { mesh, spec: pm, material: mat });
    }
  }

  function buildConduction() {
    clearMap(conduction);
    for (const part of CONDUCTION) {
      const mat = new THREE.MeshStandardMaterial({
        color: NODE_COLOUR, roughness: 0.4, emissive: '#5a4708', emissiveIntensity: 0.35,
      });
      let mesh: THREE.Mesh;
      if (part.kind === 'node') {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(part.r, 18, 14), mat);
        mesh.position.set(...part.at!);
      } else {
        mesh = tube(part.path!.map((p) => V3(...p)), part.r, part.r * 0.8, mat, 8);
      }
      mesh.userData.condId = part.id;
      group.add(mesh);
      conduction.set(part.id, { mesh, spec: part, material: mat });
    }
  }

  /* The four annuli, drawn as rings with leaflets hanging from them. They fix the
   * planes the AV-groove arteries run in, and they are what a bare shell most
   * obviously lacks once you make the wall transparent. */
  function buildValves() {
    valveGroup = new THREE.Group();
    const ringMat = new THREE.MeshStandardMaterial({ color: '#d8cfc0', roughness: 0.55, metalness: 0.05 });
    const leafMat = new THREE.MeshStandardMaterial({
      color: '#e3d7c6', roughness: 0.6, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
    });
    const up = new THREE.Vector3(0, 1, 0);

    for (const v of VALVES) {
      const holder = new THREE.Group();
      const n = new THREE.Vector3(...v.normal).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(up, n);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(v.r, 0.085, 10, 48), ringMat);
      ring.rotateX(Math.PI / 2);          // torus lies in xy; put it in the xz plane
      holder.add(ring);

      // Leaflets: shallow cones hanging into the ventricle, split into the right count.
      for (let k = 0; k < v.leaflets; k++) {
        const span = (2 * Math.PI) / v.leaflets;
        const leaf = new THREE.Mesh(
          new THREE.CylinderGeometry(v.r * 0.97, v.r * 0.30, v.r * 0.85, 20, 1, true, k * span, span * 0.92),
          leafMat);
        leaf.position.y = -v.r * 0.43;
        holder.add(leaf);
      }
      holder.quaternion.copy(q);
      holder.position.set(...v.c);
      holder.userData.valveId = v.id;
      valveGroup.add(holder);
    }
    group.add(valveGroup);
  }

  /* --- scanned geometry (BodyParts3D) ------------------------------- */

  // Vite rewrites BASE_URL to wherever the site is deployed, which on GitHub
  // Pages is a subpath. Resolving against document.baseURI instead would break
  // the moment the page is served from a nested route.
  const modelsBase = () => `${import.meta.env.BASE_URL}models/`;

  /* --- scanned geometry (BodyParts3D) ------------------------------- */

  async function loadPart(file: string): Promise<THREE.BufferGeometry> {
    const res = await fetch(`${modelsBase()}${file}`);
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const head = new Uint32Array(buf, 0, 2);
    const nv = head[0]!, nf = head[1]!;
    const pos = new Float32Array(buf.slice(8, 8 + nv * 12));
    const idx = new Uint32Array(buf.slice(8 + nv * 12, 8 + nv * 12 + nf * 12));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    return g;
  }

  function loadScanned() {
    if (scanned) return Promise.resolve(scanned);
    if (scannedLoading) return scannedLoading;
    scannedLoading = (async () => {
      const res = await fetch(`${modelsBase()}heart-meshes.json`);
      if (!res.ok) throw new Error(`manifest: HTTP ${res.status}`);
      const manifest = (await res.json()) as Manifest;
      const holder = new THREE.Group();
      const meshes: Record<string, THREE.Mesh> = {};
      for (const [key, style] of Object.entries(SCANNED_STYLE)) {
        const part = manifest.parts[key];
        if (!part) continue;
        const g = await loadPart(part.file);
        if (style.vertexColours) {
          g.setAttribute('color', new THREE.BufferAttribute(
            new Float32Array(g.attributes.position!.count * 3), 3));
          // The mesh is already in the cardiac frame, so segment maths reads straight off it.
          const pos = g.attributes.position!;
          const th: number[] = [], tt: number[] = [];
          for (let i = 0; i < pos.count; i++) {
            th.push((Math.atan2(pos.getZ(i), pos.getX(i)) * 180) / Math.PI);
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
      const built: Scanned = {
        group: holder, meshes, manifest, apparatus: null,
        lvSample: heightSampler(manifest.lvHeightMap),
        rvSample: heightSampler(manifest.rvHeightMap),
      };
      scanned = built;
      return built;
    })();
    return scannedLoading;
  }

  // The scanned valves and papillary muscles, fetched on first use. Once they are
  // in, the procedural stand-ins step aside in scanned mode.
  function loadApparatus() {
    if (!scanned || scanned.apparatus) return Promise.resolve();
    if (apparatusLoading) return apparatusLoading;
    const s = scanned;
    apparatusLoading = (async () => {
      const holder = new THREE.Group();
      const meshes: Record<string, THREE.Mesh> = {};
      for (const [key, style] of Object.entries(SCANNED_APPARATUS)) {
        const part = s.manifest.parts[key];
        if (!part) continue;
        const m = new THREE.Mesh(await loadPart(part.file), new THREE.MeshStandardMaterial({
          color: style.color, roughness: 0.6, metalness: 0.02, side: THREE.DoubleSide,
          transparent: style.opacity < 1, opacity: style.opacity,
        }));
        m.userData.part = key;
        holder.add(m);
        meshes[key] = m;
      }
      group.add(holder);
      s.apparatus = { group: holder, meshes };
      if (view) paint(view);
      return undefined;
    })();
    return apparatusLoading;
  }

  async function applyGeometry(mode: SceneView['geometry']) {
    if (mode === 'scanned') {
      opts.onNote?.('Loading scanned meshes…');
      let s: Awaited<ReturnType<typeof loadScanned>>;
      try {
        s = await loadScanned();
      } catch (err) {
        console.error('heart lab: scanned geometry failed to load', err);
        opts.onNote?.('Scanned meshes could not be loaded; showing the procedural model.');
        opts.onScanFailed?.(err);
        return;
      }
      if (!s) return;
      surf = (th, t, off = 0) => new THREE.Vector3(...sampledPoint(s.lvSample, th, t, off));
      rvSurf = (th, t, off = 0) => new THREE.Vector3(...sampledPoint(s.rvSample, th, t, off));
      const tris = Object.values(s.manifest.parts)
        .filter((p) => p.role !== 'apparatus')
        .reduce((a, p) => a + p.triangles, 0);
      opts.onNote?.(`BodyParts3D scan · ${tris.toLocaleString()} triangles · valves load on demand`);
    } else {
      surf = (th, t, off = 0) => new THREE.Vector3(...lvPoint(th, t, off));
      rvSurf = (th, t, off = 0) => new THREE.Vector3(...rvPoint(th, t, off));
      opts.onNote?.('Procedural · generated from measured anatomy');
    }
    buildVessels();
    if (view) paint(view);
    refit();
  }

  /* --- orientation and framing ----------------------------------------- */

  const APEX = new THREE.Vector3(...APEX_DIR).normalize();

  const VIEW_DIRS: Record<Exclude<ViewName, 'apex'>, THREE.Vector3> = {
    anterior: new THREE.Vector3(0, 0.18, 1),
    inferior: new THREE.Vector3(0, -1, -0.32),
    lateral: new THREE.Vector3(1, 0.12, 0.18),
    septal: new THREE.Vector3(-1, 0.12, 0.18),
    // The anterolateral oblique you would use looking at a specimen on the table.
    anterolateral: new THREE.Vector3(0.5, 0.28, 1),
  };

  let heartCentre = new THREE.Vector3();
  let heartRadius = 8;

  function frameCamera(name: ViewName) {
    const dir = (name === 'apex' ? APEX.clone() : VIEW_DIRS[name].clone()).normalize();
    const dist = (heartRadius / Math.sin(((camera.fov * Math.PI) / 180) / 2)) * 0.95;
    camera.position.copy(heartCentre).addScaledVector(dir, dist);
    controls.target.copy(heartCentre);
    controls.update();
  }

  // The scanned meshes are a different size to the procedural ones, so the framing
  // worked out at boot no longer fits once they load.
  function refit() {
    group.updateMatrixWorld(true);
    const sphere = new THREE.Box3().setFromObject(group).getBoundingSphere(new THREE.Sphere());
    if (!sphere.radius) return;
    heartCentre = sphere.center.clone();
    heartRadius = sphere.radius;
    controls.minDistance = heartRadius * 0.8;
    controls.maxDistance = heartRadius * 6;
    controls.target.copy(heartCentre);
    controls.update();
  }

  /* --- painting -------------------------------------------------------- */

  const activeLV = () => (view?.geometry === 'scanned' && scanned ? scanned.meshes.lv : lvMesh);

  function paintLV(v: SceneView) {
    const mesh = activeLV();
    if (!mesh) return;
    const g = mesh.geometry;
    const col = g.attributes.color;
    const pos = g.attributes.position;
    if (!col || !pos) return;
    const theta = g.userData.theta as number[];
    const tArr = g.userData.t as number[];
    const segs = new Set<number>(v.scenario.segs);
    const sick = infarctColour(v.stage);
    const active = v.stage.id !== 0 && segs.size > 0;

    for (let i = 0; i < col.count; i++) {
      let c = HEALTHY;
      if (active && segs.has(ahaSegment(theta[i]!, tArr[i]!))) {
        // Subendocardial infarcts spare the outer wall, so colour only the inner layer.
        const r = Math.hypot(pos.getX(i), pos.getZ(i));
        const ref = v.geometry === 'scanned' && scanned
          ? scanned.lvSample(theta[i]!, tArr[i]!) : lvRadius(tArr[i]!);
        const inner = r < ref - lvWall(theta[i]!, tArr[i]!) * 0.45;
        c = v.scenario.subendo && !inner ? HEALTHY : sick;
      }
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }

  // Toggling `transparent` can require a shader recompile. Only flag it on a real
  // change so a slider drag doesn't rebuild the program on every frame.
  function setOpacity(material: THREE.Material, opacity: number) {
    const t = opacity < 1;
    if (material.transparent !== t) {
      material.transparent = t;
      material.needsUpdate = true;
    }
    material.opacity = opacity;
  }

  function paintVessels(v: SceneView) {
    const dead = new Set<VesselId>(v.scenario.dead);
    const active = v.stage.id !== 0;
    for (const [id, entry] of vessels) {
      const isDead = active && dead.has(id);
      entry.material.color.copy(isDead ? DEAD_COLOUR : entry.base);
      setOpacity(entry.material, isDead ? 0.55 : 1);
      const layerOn = entry.kind === 'artery' ? v.showArteries : v.showVeins;
      // The ramus intermedius is present in only 15-30% of hearts, so it is off
      // unless the reader asks to see variant anatomy.
      entry.mesh.visible = layerOn && (id !== 'RI' || v.showVariants);
    }
    const first = v.scenario.dead[0];
    const target = first ? vessels.get(first) : undefined;
    if (active && target && v.showArteries) {
      lesionMarker.position.fromBufferAttribute(
        target.mesh.geometry.attributes.position as THREE.BufferAttribute, 0);
      lesionMarker.visible = true;
    } else {
      lesionMarker.visible = false;
    }
  }

  function paintPapillary(v: SceneView) {
    const dead = new Set<VesselId>(v.scenario.dead);
    const active = v.stage.id !== 0;
    const sick = infarctColour(v.stage);
    const scanApparatus = v.geometry === 'scanned' && !!scanned?.apparatus;
    for (const { mesh, spec, material } of papillary.values()) {
      const lost = spec.supply.filter((x) => dead.has(x));
      // Dual supply means both feeds must go before the muscle dies.
      const failed = active && (spec.dual ? lost.length === spec.supply.length : lost.length > 0);
      material.color.copy(failed ? sick : new THREE.Color(PAP_COLOUR));
      mesh.visible = v.showInternals && !scanApparatus;
    }
  }

  function paintConduction(v: SceneView) {
    const parts = conductionState(v.stage.id !== 0 ? v.scenario.dead : []);
    for (const part of parts) {
      const entry = conduction.get(part.id);
      if (!entry) continue;
      entry.material.color.copy(part.failed ? DEAD_TISSUE : new THREE.Color(NODE_COLOUR));
      entry.material.emissiveIntensity = part.failed ? 0 : 0.35;
      entry.mesh.visible = v.showConduction;
    }
  }

  function paintValves(v: SceneView) {
    const scan = v.geometry === 'scanned' && scanned;
    // Scanned leaflets beat sculpted cones, so the procedural set only shows when
    // the scan is off or has not arrived yet.
    if (scan && v.showInternals && !scanned!.apparatus) {
      loadApparatus().catch((err) => console.error('heart lab: scanned valves failed to load', err));
    }
    const haveScan = !!(scan && scanned!.apparatus);
    if (scanned?.apparatus) scanned.apparatus.group.visible = haveScan && v.showInternals;
    if (valveGroup) valveGroup.visible = v.showInternals && !haveScan;
  }

  function paintChambers(v: SceneView) {
    const scan = v.geometry === 'scanned' && !!scanned;
    const rvInfarct = v.scenario.rv && v.stage.id !== 0;
    const rvColour = rvInfarct ? PALETTE.infarctHex(v.stage) : PALETTE.SWATCHES.rightVentricle;

    if (lvMesh) lvMesh.visible = !scan;
    if (rvMesh) {
      rvMesh.visible = !scan && v.showChambers;
      (rvMesh.material as THREE.MeshStandardMaterial).color.set(rvColour);
    }
    if (scanned) {
      scanned.group.visible = scan;
      scanned.meshes.rv!.visible = v.showChambers;
      (scanned.meshes.rv!.material as THREE.MeshStandardMaterial).color.set(rvColour);
      for (const k of ['la', 'ra']) if (scanned.meshes[k]) scanned.meshes[k]!.visible = v.showChambers;
    }
    // Procedural atria step aside for the scanned ones; the great vessels have no
    // scanned counterpart in this build, so they stay.
    chamberExtras.forEach((m) => {
      m.visible = v.showChambers && !(scan && m.userData.kind === 'atrium');
    });

    const lv = activeLV();
    if (lv) setOpacity(lv.material as THREE.Material, v.wallOpacity);
  }

  function paint(v: SceneView) {
    paintLV(v);
    paintVessels(v);
    paintPapillary(v);
    paintConduction(v);
    paintValves(v);
    paintChambers(v);
  }

  /* --- setup ----------------------------------------------------------- */

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 400);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;

  scene.add(new THREE.HemisphereLight('#ffffff', '#40363a', 1.1));
  const key = new THREE.DirectionalLight('#fff4ec', 1.45);
  key.position.set(6, 9, 10);
  const rim = new THREE.DirectionalLight('#9fd8ff', 0.6);
  rim.position.set(-8, 1, -9);
  scene.add(key, rim);

  const group = new THREE.Group();
  scene.add(group);

  buildLV();
  buildRV();
  chamberExtras = buildAtriaAndGreatVessels();
  buildVessels();
  buildValves();

  lesionMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 20, 16),
    new THREE.MeshStandardMaterial({
      color: '#1a1a1a', emissive: '#7a1f14', emissiveIntensity: 0.85, roughness: 0.3,
    }),
  );
  lesionMarker.visible = false;
  group.add(lesionMarker);

  // Orientation comes from heartBasis() in heart-data, so the renderer and the
  // silhouette checks use one definition.
  {
    const { X, Y, Z } = heartBasis();
    group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(...X), new THREE.Vector3(...Y), new THREE.Vector3(...Z)));
  }
  refit();
  frameCamera('anterolateral');

  const resize = new ResizeObserver(() => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  resize.observe(host);

  // The spin is decoration, so a reader who has asked for less motion gets none.
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const spinAxis = APEX.clone().negate();
  let last = performance.now();
  renderer.setAnimationLoop((now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    if (view?.spin && !calm) group.rotateOnWorldAxis(spinAxis, dt * 0.22);
    if (lesionMarker.visible && !calm) lesionMarker.scale.setScalar(1 + Math.sin(now / 220) * 0.22);
    controls.update();
    renderer.render(scene, camera);
  });

  return {
    update(next: SceneView) {
      const geometryChanged = next.geometry !== appliedGeometry;
      const dominanceChanged = appliedDominance !== null && next.dominance !== appliedDominance;
      view = next;
      appliedGeometry = next.geometry;
      appliedDominance = next.dominance;
      // Dominance moves which artery reaches the crux, so the tree is rebuilt.
      if (dominanceChanged && !geometryChanged) buildVessels();
      if (geometryChanged) {
        void applyGeometry(next.geometry);
        return;
      }
      paint(next);
    },
    setView: frameCamera,
    dispose() {
      renderer.setAnimationLoop(null);
      resize.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
