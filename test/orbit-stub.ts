export class OrbitControls {
  enableDamping = false;
  dampingFactor = 0;
  minDistance = 0;
  maxDistance = 0;
  target = { copy() {} };
  constructor(public object: unknown, public dom: unknown) {}
  update() {}
  dispose() {}
}
