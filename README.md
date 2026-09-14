# Coronary Territories & ECG

An interactive teaching tool. Pick a coronary occlusion and four things move
together: the left ventricular wall that infarcts, the conduction tissue that
loses its supply, the 12-lead ECG it produces, and what that same infarct looks
like in the hand from thirty minutes to two months.

**For clinicians and students.** Deliberately simplified. Coronary anatomy varies,
ECG patterns overlap, and nothing here should inform a decision about a real patient.

<https://sereneinserenade.github.io/coronary-ecg-lab/>

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

## Stack

SolidJS, TypeScript and Vite, with Tailwind CSS v4 for styling and shadcn-style
components built on [Kobalte](https://kobalte.dev) primitives in
`src/components/ui`. The components are vendored rather than pulled from a
generator: the `shadcn-solid` CLI has not shipped since March 2025 and targets
Tailwind v3, and `solidcn` is at 0.1.0, while Kobalte — what both are built on —
is actively maintained. Copying the components in is shadcn's own distribution
model, so nothing is lost but the dependency.

    npm install
    npm run dev          # http://localhost:5173/coronary-ecg-lab/
    npm run build        # typecheck, then a production build into dist/
    npm test             # 69 checks
    npm run typecheck

## Layout

| Path | What it holds |
| --- | --- |
| `src/lib/heart-data.ts` | The clinical content and the shape maths. No renderer, no DOM, no Solid. |
| `src/lib/heart-scene.ts` | The Three.js scene. Framework-agnostic: Solid hands it a plain snapshot. |
| `src/lib/ecg.ts` | The 12-lead trace, drawn on a canvas at true 25 mm/s and 10 mm/mV. |
| `src/lib/palette.ts` | The colours, free of any Three.js import so the legend can share them. |
| `src/lib/state.ts` | One store, so the model, the ECG and the panels cannot disagree. |
| `src/components/ui/` | shadcn-style primitives on Kobalte. |
| `src/content/reference.tsx` | The reference tables, converted from the original markup. |
| `tools/build_heart_meshes.py` | Regenerates the scanned meshes from BodyParts3D. |

The three test files split by what they can actually prove:

- `test/heart-data.test.ts` — the clinical data, the ECG maths (including
  Einthoven's law across every scenario, stage and instant), the dominance model,
  the geometry, mesh topology, the anatomical invariants and the mesh manifest.
- `test/scene.test.ts` — the render path against a stubbed Three.js, over every
  occlusion, stage, dominance and layer. The stub throws on non-finite vertices
  and malformed curves, so a geometry mistake fails here rather than silently
  rendering nothing in a browser.
- `test/app.test.tsx` — the Solid components in jsdom: landmarks, the WebGL
  fallback, keyboard operation, and the wiring from the store to the panels.

## Geometry

`src/lib/heart-data.ts` holds the medicine and the maths with nothing else in it,
so the clinical content can be edited without touching the rendering. Sources and
reasoning are in the comment blocks above each section.

The scanned meshes in `public/models/` are regenerated with:

    npm run meshes

It reads only the element meshes it needs, over HTTP range requests, and fails
loudly if the registration drifts — the interventricular grooves must land within
10° of the model's own angles, and the chambers, valves and papillary muscles must
hold their real spatial relationships.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which typechecks, runs the
full suite and only then builds and publishes to GitHub Pages. A red test never
reaches the site.

## Licence

Meshes in `public/models/` derive from BodyParts3D and are CC BY-SA 2.1 Japan —
see `public/models/LICENSE`. The rest of the code is MIT.
