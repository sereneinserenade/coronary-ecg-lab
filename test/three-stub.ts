/* Enough of Three.js to build real geometry and catch real mistakes.
 *
 * The scene module is where a bad vertex, an empty curve or a degenerate
 * cylinder sweep would show up, and none of that needs a GPU to detect. The
 * stub throws on non-finite coordinates and malformed inputs rather than
 * silently accepting them, so the checks have something to fail on. */

export const DoubleSide = 2;

export class Vector3 {
  constructor(public x = 0, public y = 0, public z = 0) {}
  set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v: Vector3) { return this.set(v.x, v.y, v.z); }
  clone() { return new Vector3(this.x, this.y, this.z); }
  negate() { return this.set(-this.x, -this.y, -this.z); }
  length() { return Math.hypot(this.x, this.y, this.z); }
  normalize() { const l = this.length() || 1; return this.set(this.x / l, this.y / l, this.z / l); }
  addScaledVector(v: Vector3, s: number) { return this.set(this.x + v.x * s, this.y + v.y * s, this.z + v.z * s); }
  distanceTo(v: Vector3) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  sub(v: Vector3) { return this.set(this.x - v.x, this.y - v.y, this.z - v.z); }
  dot(v: Vector3) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  crossVectors(a: Vector3, b: Vector3) {
    return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  }
  setScalar(s: number) { return this.set(s, s, s); }
  fromBufferAttribute(a: BufferAttribute, i: number) { return this.set(a.getX(i), a.getY(i), a.getZ(i)); }
  applyMatrix4() { return this; }
}

export class Color {
  r = 0.5; g = 0.5; b = 0.5;
  constructor(public hex?: string) {}
  clone() { return new Color(this.hex); }
  copy(c: Color) { this.r = c.r; this.g = c.g; this.b = c.b; this.hex = c.hex; return this; }
  set(hex: string) { this.hex = hex; return this; }
  getStyle() { return this.hex ?? '#000000'; }
}

export class Quaternion {
  setFromUnitVectors() { return this; }
  setFromRotationMatrix() { return this; }
  identity() { return this; }
  clone() { return new Quaternion(); }
  copy() { return this; }
}
export class Matrix4 { makeBasis() { return this; } }

export class Object3D {
  children: Object3D[] = [];
  userData: Record<string, unknown> = {};
  visible = true;
  position = new Vector3();
  scale = new Vector3(1, 1, 1);
  rotation = { set(_x: number, _y: number, _z: number) {} };
  quaternion = new Quaternion();
  add(...o: Object3D[]) { this.children.push(...o); return this; }
  remove(o: Object3D) { const i = this.children.indexOf(o); if (i >= 0) this.children.splice(i, 1); return this; }
  rotateX() { return this; }
  rotateOnWorldAxis() { return this; }
  updateMatrixWorld() { return this; }
  traverse(fn: (o: Object3D) => void) { fn(this); this.children.forEach((c) => c.traverse(fn)); }
}
export class Group extends Object3D {}
export class Scene extends Object3D {}

export class BufferAttribute {
  count: number;
  needsUpdate = false;
  constructor(public array: ArrayLike<number> & { [i: number]: number }, public itemSize: number) {
    this.count = array.length / itemSize;
  }
  getX(i: number) { return this.array[i * this.itemSize]!; }
  getY(i: number) { return this.array[i * this.itemSize + 1]!; }
  getZ(i: number) { return this.array[i * this.itemSize + 2]!; }
  setXYZ(i: number, x: number, y: number, z: number) {
    if (![x, y, z].every(Number.isFinite)) throw new Error(`non-finite vertex written at index ${i}`);
    this.array[i * this.itemSize] = x;
    this.array[i * this.itemSize + 1] = y;
    this.array[i * this.itemSize + 2] = z;
  }
}
export class Float32BufferAttribute extends BufferAttribute {
  constructor(array: ArrayLike<number>, itemSize: number) {
    super(Float32Array.from(array), itemSize);
  }
}

export class BufferGeometry {
  attributes: Record<string, BufferAttribute> = {};
  userData: Record<string, unknown> = {};
  index: unknown = null;
  setAttribute(n: string, a: BufferAttribute) { this.attributes[n] = a; return this; }
  setIndex(i: unknown) { this.index = i; return this; }
  computeVertexNormals() {
    const p = this.attributes.position;
    if (p) this.attributes.normal = new BufferAttribute(new Float32Array(p.array.length), 3);
    return this;
  }
  dispose() {}
}

export class TubeGeometry extends BufferGeometry {
  constructor(_curve: CatmullRomCurve3, n: number, _r: number, radialSegs: number) {
    super();
    const count = (n + 1) * (radialSegs + 1);
    this.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    this.setAttribute('normal', new BufferAttribute(new Float32Array(count * 3), 3));
  }
}
export class SphereGeometry extends BufferGeometry {}
export class TorusGeometry extends BufferGeometry {}
export class CylinderGeometry extends BufferGeometry {
  constructor(rTop: number, rBottom: number, h: number, _rs?: number, _hs?: number,
              _open?: boolean, start = 0, len = Math.PI * 2) {
    super();
    for (const v of [rTop, rBottom, h, start, len]) {
      if (!Number.isFinite(v)) throw new Error('non-finite cylinder parameter');
    }
    if (len <= 0) throw new Error('cylinder sweep must be positive');
  }
}

export class CatmullRomCurve3 {
  constructor(public points: Vector3[]) {
    if (!points || points.length < 2) throw new Error('a curve needs at least two points');
    for (const p of points) {
      if (!(p instanceof Vector3)) throw new Error('curve point is not a Vector3');
      if (![p.x, p.y, p.z].every(Number.isFinite)) throw new Error('non-finite curve point');
    }
  }
}

export class Material {
  color: Color;
  needsUpdate = false;
  transparent = false;
  opacity = 1;
  emissiveIntensity = 1;
  constructor(o: Record<string, unknown> = {}) {
    Object.assign(this, o);
    this.color = new Color(o.color as string | undefined);
  }
  dispose() {}
}
export class MeshStandardMaterial extends Material {}

export class Mesh extends Object3D {
  constructor(public geometry: BufferGeometry, public material: Material) { super(); }
}

export class Box3 {
  // A fixed heart-sized box. The real bounds need geometry the stub does not
  // build; what matters here is that the scene reads min/max and gets finite
  // numbers back, so the fitting maths runs for real. Its correctness is
  // checked numerically against known boxes in heart-data.test.ts.
  min = new Vector3(-5, -6, -4);
  max = new Vector3(5, 3, 4);
  private filled = false;
  setFromObject() { this.filled = true; return this; }
  expandByObject() { this.filled = true; return this; }
  isEmpty() { return !this.filled; }
  getCenter(v: Vector3) { return v.set(0, -1.5, 0); }
  getBoundingSphere(s: Sphere) { s.center = new Vector3(0, -1.5, 0); s.radius = 8; return s; }
}
export class Sphere { center = new Vector3(); radius = 0; }

export class PerspectiveCamera extends Object3D {
  // OrbitControls orients itself from camera.up, and the scene sets it per view
  // to stand the heart on its apex, so the stub has to carry a real vector.
  up = new Vector3(0, 1, 0);
  constructor(public fov: number, public aspect: number) { super(); }
  updateProjectionMatrix() {}
}
class Light extends Object3D {}
export class HemisphereLight extends Light {}
export class DirectionalLight extends Light {}

export class WebGLRenderer {
  domElement = document.createElement('canvas');
  loop: ((t: number) => void) | null = null;
  setPixelRatio() {}
  setSize() {}
  render() {}
  dispose() {}
  setAnimationLoop(fn: ((t: number) => void) | null) { this.loop = fn; }
}
