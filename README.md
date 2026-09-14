# Coronary Territories & ECG

An interactive teaching tool. Pick a coronary occlusion and three things move
together: the left ventricular wall that infarcts, the 12-lead ECG it produces,
and what that same infarct looks like in the hand from thirty minutes to two
months.

**For clinicians and students.** Deliberately simplified. Coronary anatomy varies,
ECG patterns overlap, and nothing here should inform a decision about a real patient.

## What's in it

- **3D heart** — procedurally generated from measured anatomy, with an optional
  toggle to scan-derived meshes (BodyParts3D). 21 named coronary arteries, 6 cardiac
  veins, left ventricle coloured by the AHA 17-segment model.
- **11 occlusion scenarios** — left main, proximal/mid/wrap-around LAD, first diagonal,
  circumflex, proximal and mid RCA, posterior, and circumferential subendocardial
  for contrast. Each with its leads, reciprocal changes, distinguishing features
  and gross correlate.
- **Synthesised 12-lead ECG** — real PQRST built from Gaussians per lead on a proper
  25 mm/s, 10 mm/mV grid. Scrub the timeline to watch hyperacute T → ST elevation →
  Q waves → T inversion → old Q waves.
- **Pathology timeline** — 10 stages tying the ECG to gross specimen, microscopy,
  TTC staining and the complication risks that track the softening.

## Running it

No build step and no package manager. Three.js loads from a CDN; everything else
is plain HTML, CSS and ES modules.

    python3 tools/serve.py        # http://127.0.0.1:8000
    node test_heart.mjs           # 33 checks

The checks cover the clinical data, the ECG maths, the heart geometry, mesh
topology (both ventricle shells are verified watertight), the anatomical
invariants (right border = right atrium, sternocostal surface = right ventricle,
apex = left ventricle), and the scanned mesh manifest.

## Geometry

`heart-data.js` holds the clinical content and the shape maths with no Three.js and
no DOM, so the medicine can be edited without touching the rendering. Sources and
reasoning are in the comment block above the geometry section.

The scanned meshes in `models/` are regenerated with:

    python3 tools/build_heart_meshes.py

## Licence

Meshes in `models/` derive from BodyParts3D and are CC BY-SA 2.1 Japan — see
`models/LICENSE`. The rest of the code is MIT.
