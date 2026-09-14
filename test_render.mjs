/* Smoke test for the render path.
 *
 * heart.js needs WebGL and a DOM, so it cannot be imported in Node directly.
 * This stubs both — enough of the Three.js surface to build real geometry and
 * enough of the DOM to wire the controls — then drives every scenario, stage,
 * dominance and layer combination and fails on any thrown error. It does not
 * check that the picture looks right; it checks that the code that draws it runs.
 *
 * Run: node test_render.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/* ---- a Three.js good enough to build geometry against ---- */

const STUB = `
const noop = () => {};
class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { return this.set(v.x, v.y, v.z); }
  clone() { return new Vector3(this.x, this.y, this.z); }
  negate() { return this.set(-this.x, -this.y, -this.z); }
  length() { return Math.hypot(this.x, this.y, this.z); }
  normalize() { const l = this.length() || 1; return this.set(this.x / l, this.y / l, this.z / l); }
  addScaledVector(v, s) { return this.set(this.x + v.x * s, this.y + v.y * s, this.z + v.z * s); }
  sub(v) { return this.set(this.x - v.x, this.y - v.y, this.z - v.z); }
  add(v) { return this.set(this.x + v.x, this.y + v.y, this.z + v.z); }
  multiplyScalar(s) { return this.set(this.x * s, this.y * s, this.z * s); }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  fromBufferAttribute(a, i) { return this.set(a.getX(i), a.getY(i), a.getZ(i)); }
  applyQuaternion() { return this; }
  crossVectors(a, b) {
    return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  }
}
class Color {
  constructor(hex) { this.r = 0.5; this.g = 0.5; this.b = 0.5; this.hex = hex; }
  clone() { return new Color(this.hex); }
  copy(c) { this.r = c.r; this.g = c.g; this.b = c.b; this.hex = c.hex; return this; }
  set(hex) { this.hex = hex; return this; }
  getStyle() { return this.hex || '#000000'; }
}
class Quaternion { setFromUnitVectors() { return this; } setFromRotationMatrix() { return this; } copy() { return this; } }
class Matrix4 { makeBasis() { return this; } }
class Object3D {
  constructor() {
    this.children = []; this.userData = {}; this.visible = true;
    this.position = new Vector3(); this.scale = new Vector3(1, 1, 1);
    this.quaternion = new Quaternion();
  }
  add(...o) { this.children.push(...o); return this; }
  remove(o) { const i = this.children.indexOf(o); if (i >= 0) this.children.splice(i, 1); return this; }
  rotateX() { return this; }
  rotateOnWorldAxis() { return this; }
  updateMatrixWorld() { return this; }
}
class Group extends Object3D {}
class Scene extends Object3D {}

class BufferAttribute {
  constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.count = array.length / itemSize; }
  getX(i) { return this.array[i * this.itemSize]; }
  getY(i) { return this.array[i * this.itemSize + 1]; }
  getZ(i) { return this.array[i * this.itemSize + 2]; }
  setXYZ(i, x, y, z) {
    if (![x, y, z].every(Number.isFinite)) throw new Error('non-finite vertex written at ' + i);
    this.array[i * this.itemSize] = x; this.array[i * this.itemSize + 1] = y; this.array[i * this.itemSize + 2] = z;
  }
}
class Float32BufferAttribute extends BufferAttribute {
  constructor(array, itemSize) { super(Float32Array.from(array), itemSize); }
}
class BufferGeometry {
  constructor() { this.attributes = {}; this.userData = {}; this.index = null; }
  setAttribute(n, a) { this.attributes[n] = a; return this; }
  setIndex(i) { this.index = i; return this; }
  computeVertexNormals() {
    const p = this.attributes.position;
    if (p) this.attributes.normal = new BufferAttribute(new Float32Array(p.array.length), 3);
    return this;
  }
  dispose() {}
}
// Enough of a tube to exercise the taper maths on real vertex data.
class TubeGeometry extends BufferGeometry {
  constructor(curve, n, r, radialSegs) {
    super();
    const count = (n + 1) * (radialSegs + 1);
    this.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    this.setAttribute('normal', new BufferAttribute(new Float32Array(count * 3), 3));
    this.curve = curve;
  }
}
class SphereGeometry extends BufferGeometry {}
class TorusGeometry extends BufferGeometry {}
class CylinderGeometry extends BufferGeometry {
  constructor(rTop, rBottom, h, rs, hs, open, start, len) {
    super();
    for (const v of [rTop, rBottom, h, start, len]) {
      if (!Number.isFinite(v)) throw new Error('bad cylinder parameter');
    }
    if (len <= 0) throw new Error('cylinder sweep must be positive');
  }
}
class CatmullRomCurve3 {
  constructor(points) {
    if (!points || points.length < 2) throw new Error('a curve needs at least two points');
    for (const p of points) {
      if (!(p instanceof Vector3)) throw new Error('curve point is not a Vector3');
      if (![p.x, p.y, p.z].every(Number.isFinite)) throw new Error('non-finite curve point');
    }
    this.points = points;
  }
}
class Material {
  constructor(o = {}) { Object.assign(this, o); this.color = new Color(o.color); this.needsUpdate = false; }
  dispose() {}
}
class MeshStandardMaterial extends Material {}
class Mesh extends Object3D {
  constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; }
}
class Box3 {
  setFromObject() { return this; }
  getBoundingSphere(s) { s.center = new Vector3(0, 0, 0); s.radius = 8; return s; }
}
class Sphere { constructor() { this.center = new Vector3(); this.radius = 0; } }
class PerspectiveCamera extends Object3D {
  constructor(fov, aspect) { super(); this.fov = fov; this.aspect = aspect; }
  updateProjectionMatrix() {}
}
class Light extends Object3D {}
class WebGLRenderer {
  constructor() { this.domElement = globalThis.document.createElement('canvas'); }
  setPixelRatio() {} setSize() {} render() {}
  setAnimationLoop(fn) { this.loop = fn; }
}
export {
  Vector3, Color, Quaternion, Matrix4, Object3D, Group, Scene,
  BufferAttribute, Float32BufferAttribute, BufferGeometry, TubeGeometry,
  SphereGeometry, TorusGeometry, CylinderGeometry, CatmullRomCurve3,
  MeshStandardMaterial, Mesh, Box3, Sphere, PerspectiveCamera, WebGLRenderer,
};
export const DoubleSide = 2;
export class HemisphereLight extends Light {}
export class DirectionalLight extends Light {}
`;

const ORBIT = `
export class OrbitControls {
  constructor(camera) { this.object = camera; this.target = { copy() {} }; }
  update() {}
}
`;

/* ---- a DOM good enough to wire the controls against ---- */

const listeners = new Map();

function makeEl(tag = 'div', id = '') {
  const el = {
    tagName: tag, id, dataset: {}, style: {}, children: [], checked: false, value: '',
    className: '', clientWidth: 640, clientHeight: 420, innerHTML: '', textContent: '',
    appendChild(c) { el.children.push(c); return c; },
    addEventListener(type, fn) {
      const key = id + ':' + type;
      listeners.set(key, [...(listeners.get(key) || []), fn]);
    },
    getContext: () => ctx2d,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  return el;
}

const ctx2d = new Proxy({}, {
  get(_, k) {
    if (k === 'measureText') return () => ({ width: 10 });
    if (k === 'canvas') return undefined;
    return () => {};
  },
  set: () => true,
});

const els = new Map();
function el(id) {
  if (!els.has(id)) els.set(id, makeEl('div', id));
  return els.get(id);
}
for (const id of [
  'stage', 'ecg', 'bullseye', 'scenario', 'dominance', 'stage-slider', 'stage-time', 'stage-short',
  'opt-arteries', 'opt-veins', 'opt-chambers', 'opt-conduction', 'opt-internals', 'opt-variants',
  'opt-spin', 'opt-scan', 'opt-opacity', 'patient', 'geometry-note',
  'panel-lesion', 'panel-ecg', 'panel-distinguish', 'panel-conduction', 'panel-gross',
]) el(id);

globalThis.document = {
  documentElement: { dataset: {} },
  createElement: (t) => makeEl(t),
  querySelector(sel) {
    const m = /^#([\w-]+)$/.exec(sel);
    return m && els.has(m[1]) ? els.get(m[1]) : null;
  },
  querySelectorAll: () => [],
};
globalThis.window = { devicePixelRatio: 1, addEventListener() {}, WebGLRenderingContext: function () {} };
globalThis.WebGLRenderingContext = globalThis.window.WebGLRenderingContext;
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.performance = globalThis.performance || { now: () => 0 };
globalThis.ResizeObserver = class { observe() {} };
globalThis.fetch = async () => { throw new Error('offline: scanned meshes are not fetched in this test'); };

/* ---- load heart.js against the stubs ---- */

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'heartlab-'));
fs.writeFileSync(path.join(dir, 'three.mjs'), STUB);
fs.writeFileSync(path.join(dir, 'orbit.mjs'), ORBIT);
fs.copyFileSync(new URL('./heart-data.js', import.meta.url), path.join(dir, 'heart-data.js'));
fs.writeFileSync(path.join(dir, 'heart.mjs'),
  fs.readFileSync(new URL('./heart.js', import.meta.url), 'utf8')
    .replace("from 'three'", "from './three.mjs'")
    .replace("from 'three/addons/controls/OrbitControls.js'", "from './orbit.mjs'"));

const errors = [];
const realError = console.error;
console.error = (...a) => errors.push(a.join(' '));
await import(pathToFileURL(path.join(dir, 'heart.mjs')).href);
console.error = realError;
fs.rmSync(dir, { recursive: true, force: true });

let n = 0;
const check = (name, fn) => { fn(); n++; };

const fire = (id, type = 'change') => {
  for (const fn of listeners.get(id + ':' + type) || []) fn({ target: els.get(id) });
};

check('the page boots without logging an error', () => {
  const real = errors.filter((e) => !/scanned geometry failed/.test(e));
  assert.deepEqual(real, [], `boot logged: ${real.join(' | ')}`);
  assert.ok(!els.get('stage').innerHTML.includes('fallback'), 'WebGL setup fell back');
});

check('the controls are populated', () => {
  assert.ok(els.get('scenario').innerHTML.includes('<option'), 'no occlusion options');
  assert.ok(els.get('dominance').innerHTML.includes('Right dominant'), 'no dominance options');
  assert.ok(els.get('bullseye').innerHTML.includes('bs-seg'), 'bullseye not drawn');
});

check('every occlusion at every stage renders without throwing', () => {
  const opts = (els.get('scenario').innerHTML.match(/<option/g) || []).length;
  assert.ok(opts >= 11, `only ${opts} scenarios`);
  for (let sc = 0; sc < opts; sc++) {
    els.get('scenario').value = String(sc);
    fire('scenario');
    for (let st = 0; st <= 9; st++) {
      els.get('stage-slider').value = String(st);
      fire('stage-slider', 'input');
      assert.ok(els.get('panel-ecg').innerHTML.length > 20, `scenario ${sc} stage ${st}: empty ECG panel`);
      assert.ok(els.get('panel-conduction').innerHTML.length > 20, `scenario ${sc} stage ${st}: empty conduction panel`);
    }
  }
});

check('every dominance rebuilds the tree for every occlusion', () => {
  const opts = (els.get('scenario').innerHTML.match(/<option/g) || []).length;
  for (const dom of ['left', 'codominant', 'right']) {
    els.get('dominance').value = dom;
    fire('dominance');
    for (let sc = 0; sc < opts; sc++) {
      els.get('scenario').value = String(sc);
      fire('scenario');
      assert.ok(els.get('panel-lesion').innerHTML.includes('Segments'), `${dom}/${sc}: lesion panel not drawn`);
    }
  }
});

check('every layer toggle paints without throwing', () => {
  for (const id of ['opt-arteries', 'opt-veins', 'opt-chambers', 'opt-conduction', 'opt-internals', 'opt-variants']) {
    for (const on of [true, false, true]) {
      els.get(id).checked = on;
      fire(id);
    }
  }
  els.get('opt-opacity').value = '0.35';
  fire('opt-opacity', 'input');
  els.get('opt-spin').checked = false;
  fire('opt-spin');
});

check('the ST threshold follows the selected patient', () => {
  const lad = [...(els.get('scenario').innerHTML.matchAll(/<option value="(\d+)">([^<]*)/g))]
    .find(([, , name]) => /Proximal LAD/.test(name));
  assert.ok(lad, 'no proximal LAD scenario');
  els.get('scenario').value = lad[1];
  fire('scenario');
  els.get('stage-slider').value = '3';
  fire('stage-slider', 'input');
  const shown = {};
  for (const p of ['man>=40', 'man<40', 'woman']) {
    els.get('patient').value = p;
    fire('patient');
    shown[p] = (els.get('panel-ecg').innerHTML.match(/is-sig/g) || []).length;
  }
  assert.ok(shown['woman'] >= shown['man>=40'], 'the lower female threshold should flag at least as many leads');
  assert.ok(shown['man>=40'] >= shown['man<40'], 'the higher young-male threshold should flag no more leads');
});

check('the extra leads reach the trace only where they belong', () => {
  const byName = Object.fromEntries(
    [...els.get('scenario').innerHTML.matchAll(/<option value="(\d+)">([^<]*)/g)].map(([, v, name]) => [name, v]));
  const pick = (re) => Object.entries(byName).find(([name]) => re.test(name))[1];
  els.get('stage-slider').value = '3';
  fire('stage-slider', 'input');
  // Read the measured chips, not the standing explanation of the thresholds.
  const chips = () => [...els.get('panel-ecg').innerHTML.matchAll(/class="st-chip[^"]*"[^>]*>([^<]+)</g)]
    .map(([, t]) => t.trim().split(' ')[0]);
  els.get('scenario').value = pick(/Posterior/);
  fire('scenario');
  assert.ok(chips().includes('V7'), `a posterior MI should measure V7, got ${chips()}`);
  els.get('scenario').value = pick(/Proximal RCA/);
  fire('scenario');
  assert.ok(chips().includes('V4R'), `a proximal RCA lesion should measure V4R, got ${chips()}`);
  els.get('scenario').value = pick(/Mid LAD/);
  fire('scenario');
  assert.ok(!chips().some((l) => ['V4R', 'V7', 'V8', 'V9'].includes(l)), 'a mid LAD needs no extra leads');
});

check('conduction findings reach the panel', () => {
  const byName = Object.fromEntries(
    [...els.get('scenario').innerHTML.matchAll(/<option value="(\d+)">([^<]*)/g)].map(([, v, name]) => [name, v]));
  const pick = (re) => Object.entries(byName).find(([name]) => re.test(name))[1];
  els.get('stage-slider').value = '4';
  fire('stage-slider', 'input');
  els.get('scenario').value = pick(/Proximal LAD/);
  fire('scenario');
  assert.match(els.get('panel-conduction').innerHTML, /Bifascicular/i, 'proximal LAD should report bifascicular block');
  els.get('scenario').value = pick(/Proximal RCA/);
  fire('scenario');
  assert.match(els.get('panel-conduction').innerHTML, /papillary/i, 'proximal RCA should flag the papillary muscle');
  els.get('stage-slider').value = '0';
  fire('stage-slider', 'input');
  assert.ok(!/Bifascicular/i.test(els.get('panel-conduction').innerHTML), 'nothing is blocked at baseline');
});

console.log(`ok: ${n} render checks passed`);
