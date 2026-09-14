# Coronary Territories & ECG

An interactive teaching tool. Pick a coronary occlusion and four things move
together: the left ventricular wall that infarcts, the conduction tissue that
loses its supply, the 12-lead ECG it produces, and what that same infarct looks
like in the hand from thirty minutes to two months.

**For clinicians and students.** Deliberately simplified. Coronary anatomy varies,
ECG patterns overlap, and nothing here should inform a decision about a real patient.

## What's in it

- **3D heart** — procedurally generated from measured anatomy, with an optional
  toggle to scan-derived meshes (BodyParts3D): four chambers, four valves and the
  papillary muscles, all registered into one cardiac frame. 33 named coronary
  vessels, the conduction system, and a left ventricle coloured by the AHA
  17-segment model.
- **Coronary dominance** — right (~85%), left (~8%) or co-dominant (~7%). Changing
  it rebuilds the tree: the artery that reaches the crux changes, the posterior
  descending changes parent, and the inferior segments move between territories.
  In a left-dominant heart an RCA occlusion barely touches the left ventricle.
- **11 occlusion scenarios** — left main, proximal/mid/wrap-around LAD, first
  diagonal, circumflex, proximal and mid RCA, posterior, and circumferential
  subendocardial for contrast.
- **12-lead ECG built on the hexaxial system** — each occlusion carries an injury
  axis in degrees, and every frontal lead is one projection of that single arrow,
  so reciprocal change is physics rather than a hand-written list. The four
  dependent limb leads are derived from I and II by Einthoven and Goldberger at
  every instant, and V4R or V7–V9 appear as a fifth row when the scenario calls
  for them. ST shift is labelled in millimetres against the Fourth Universal
  Definition thresholds for the selected patient.
- **Conduction system** — sinus node, AV node, His bundle and the three fascicles,
  each greying out only when every artery feeding it is occluded. That is what
  separates the narrow atropine-responsive block of an inferior MI from the
  bifascicular block of a proximal LAD lesion.
- **Pathology timeline** — 10 stages tying the ECG to gross specimen, microscopy,
  TTC staining and the complication risks that track the softening.

## Running it

No build step and no package manager. Three.js loads from a CDN; everything else
is plain HTML, CSS and ES modules.

    python3 tools/serve.py        # http://127.0.0.1:8000
    node test_heart.mjs           # 53 checks — data, maths and geometry
    node test_render.mjs          # 8 checks — the render path, against stubs

`test_heart.mjs` covers the clinical data, the ECG maths (including Einthoven's
law across every scenario, stage and instant), the dominance model, the heart
geometry, mesh topology, the anatomical invariants and the scanned mesh manifest.

`test_render.mjs` stubs Three.js and the DOM so `heart.js` can be driven in Node,
then walks every occlusion, stage, dominance and layer toggle. It does not check
that the picture looks right; it checks that the code drawing it runs.

## Geometry

`heart-data.js` holds the clinical content and the shape maths with no Three.js and
no DOM, so the medicine can be edited without touching the rendering. Sources and
reasoning are in the comment blocks above each section.

The scanned meshes in `models/` are regenerated with:

    python3 tools/build_heart_meshes.py

It reads only the element meshes it needs, over HTTP range requests, and fails
loudly if the registration drifts — the interventricular grooves must land within
10° of the model's own angles, and the chambers, valves and papillary muscles must
hold their real spatial relationships.

## Licence

Meshes in `models/` derive from BodyParts3D and are CC BY-SA 2.1 Japan — see
`models/LICENSE`. The rest of the code is MIT.
