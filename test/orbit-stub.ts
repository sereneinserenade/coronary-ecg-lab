export class OrbitControls {
  enableDamping = false;
  enablePan = true;
  dampingFactor = 0;
  rotateSpeed = 1;
  zoomSpeed = 1;
  minDistance = 0;
  maxDistance = 0;
  target = { copy() {} };
  handlers = new Map<string, (() => void)[]>();
  /** The most recent instance, so a test can replay a drag against it. */
  static last: OrbitControls | undefined;
  constructor(public object: unknown, public dom: unknown) {
    OrbitControls.last = this;
  }
  addEventListener(type: string, fn: () => void) {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), fn]);
  }
  /** Stands in for the reader grabbing the model. */
  emit(type: string) { for (const fn of this.handlers.get(type) ?? []) fn(); }
  update() {}
  dispose() {}
}
