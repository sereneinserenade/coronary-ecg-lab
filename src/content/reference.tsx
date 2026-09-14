/* The reference section: the tables and notes behind the model.
 *
 * Converted from the pre-migration markup rather than retyped, so not a word of
 * the clinical content changed in the move to Solid. */
import type { JSX } from 'solid-js';

export interface ReferenceBlock {
  id: string;
  title: string;
  /** Open on first load. Only the first block is, so the page does not
   *  present the reader with a wall of text before they have touched anything. */
  defaultOpen?: boolean;
  body: () => JSX.Element;
}

export const REFERENCE: ReferenceBlock[] = [
  {
    id: 'wall-by-wall',
    title: 'Wall by wall',
    defaultOpen: true,
    body: () => (
      <>
        <p>The three things you need to hold together: which leads face the wall, which artery feeds it, and where the reciprocal change will appear.</p>
              <div class="ref-table"><table>
                <caption>Territory, leads and artery. Reciprocal change is what confirms that ST elevation is ischaemic.</caption>
                <thead>
                  <tr><th>Wall</th><th>Leads</th><th>Artery</th><th>Reciprocal change</th><th>Gross correlate</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Septal</td><td><code>V1–V2</code></td>
                    <td>LAD — septal perforators</td><td>None reliable</td>
                    <td>Anterior two-thirds of the interventricular septum</td>
                  </tr>
                  <tr>
                    <td>Anterior</td><td><code>V3–V4</code></td>
                    <td>LAD</td><td><code>II, III, aVF</code></td>
                    <td>Anterior free wall, often to the apex</td>
                  </tr>
                  <tr>
                    <td>Anteroseptal</td><td><code>V1–V4</code></td>
                    <td>LAD, proximal</td><td><code>II, III, aVF</code></td>
                    <td>Anterior wall + anterior septum + apex</td>
                  </tr>
                  <tr>
                    <td>High lateral</td><td><code>I, aVL</code></td>
                    <td>LCx (OM) or first diagonal</td><td><code>II, III, aVF</code></td>
                    <td>Basal anterolateral wall</td>
                  </tr>
                  <tr>
                    <td>Low / apical lateral</td><td><code>V5–V6</code></td>
                    <td>LCx or a wrap-around LAD</td><td><code>III, aVF</code></td>
                    <td>Apicolateral wall</td>
                  </tr>
                  <tr>
                    <td>Inferior</td><td><code>II, III, aVF</code></td>
                    <td>RCA ~80%, LCx ~20%</td><td><code>I, aVL</code></td>
                    <td>Inferior wall + posterior third of septum</td>
                  </tr>
                  <tr>
                    <td>Posterior (inferobasal)</td><td><code>V7–V9</code>; mirror in <code>V1–V3</code></td>
                    <td>PDA — from RCA or a dominant LCx</td><td>ST depression <code>V1–V3</code> with tall R</td>
                    <td>Posterior third of the LV on short-axis slice</td>
                  </tr>
                  <tr>
                    <td>Right ventricle</td><td><code>V4R</code> (also <code>V1</code>)</td>
                    <td>RCA, proximal to the acute marginal</td><td>None</td>
                    <td>RV free wall, thin and easily missed</td>
                  </tr>
                </tbody>
              </table></div>
      </>
    ),
  },
  {
    id: 'the-three-discriminations-worth-memorisi',
    title: 'The three discriminations worth memorising',
    body: () => (
      <>
        <h3>1. Inferior MI — is it the RCA or the circumflex?</h3>
              <p>It matters because a proximal RCA lesion threatens the right ventricle and the AV node, and changes how you treat the blood pressure.</p>
              <ul>
                <li><strong>RCA:</strong> ST elevation in III greater than in II, with ST depression in I and aVL. Add ST elevation in V1 or V4R and the lesion is proximal to the acute marginal, so the right ventricle is involved.</li>
                <li><strong>Circumflex:</strong> ST elevation in II at least equal to III, no depression in I or aVL (sometimes elevation), and often lateral involvement in V5–V6 or posterior depression in V1–V3.</li>
              </ul>
              <h3>2. Anterior MI — how proximal is the LAD?</h3>
              <ul>
                <li><strong>Proximal to the first septal:</strong> ST elevation in aVR or V1 over 2.5 mm, or new right bundle branch block with left anterior fascicular block.</li>
                <li><strong>Proximal to the first diagonal:</strong> ST elevation in aVL with reciprocal depression inferiorly.</li>
                <li><strong>Distal, wrap-around:</strong> anterior and inferior ST elevation together, with no reciprocal depression anywhere.</li>
              </ul>
              <h3>3. Transmural or subendocardial?</h3>
              <p>This is the distinction that shows most clearly in the specimen.</p>
              <ul>
                <li><strong>Transmural (STEMI):</strong> ST elevation, then Q waves. The infarct spans the full wall thickness within one arterial territory. Fibrinous pericarditis and free wall rupture are possible because the epicardium is involved.</li>
                <li><strong>Subendocardial (NSTEMI, demand ischaemia):</strong> ST depression, no Q waves. On the slice, a pale rim occupies the inner third to half of the wall, circumferentially, crossing territory boundaries. The subendocardium is the watershed: furthest from the epicardial vessels and squeezed hardest in systole.</li>
              </ul>
      </>
    ),
  },
  {
    id: 'why-the-reciprocal-change-is-not-a-separ',
    title: 'Why the reciprocal change is not a separate finding',
    body: () => (
      <>
        <p>Ischaemic myocardium is electrically positive relative to healthy muscle during the ST segment, so the whole injury behaves as a single current-of-injury dipole pointing away from the infarct. There are only two degrees of freedom in the frontal plane, and every limb lead is one projection of that same arrow.</p>
              <p>That is why this model does not carry a hand-written list of which leads go up and which go down. Each occlusion gets an <strong>injury axis</strong> in degrees on the hexaxial system, and each lead reads <code>amplitude &times; cos(lead axis &minus; injury axis)</code>. The elevation, the depression and their relative depths all fall out of one number.</p>
              <div class="ref-table"><table>
                <caption>Where each occlusion points the arrow, and what that forces the leads to show.</caption>
                <thead><tr><th>Occlusion</th><th>Injury axis</th><th>Falls out of it</th></tr></thead>
                <tbody>
                  <tr><td>Proximal RCA</td><td><code>+115&deg;</code></td><td>Past 90&deg;, so III exceeds II; aVL at &minus;30&deg; is nearly opposite, so it is the deepest reciprocal.</td></tr>
                  <tr><td>Circumflex, inferior</td><td><code>+80&deg;</code></td><td>Short of 90&deg;, so II equals or exceeds III, and I stays positive. That single difference is the RCA-versus-circumflex rule.</td></tr>
                  <tr><td>Proximal LAD</td><td><code>&minus;52&deg;</code></td><td>Elevation in I and aVL; III almost directly opposite, so it is the deepest reciprocal, then aVF, then II.</td></tr>
                  <tr><td>First diagonal</td><td><code>&minus;35&deg;</code></td><td>I and aVL up, III down. Add V2 and you have the South African flag.</td></tr>
                  <tr><td>Wrap-around LAD</td><td><code>+75&deg;</code></td><td>Anterior and inferior elevation together, and no limb lead far enough round to be reciprocal.</td></tr>
                  <tr><td>Left main</td><td><code>&minus;135&deg;</code></td><td>Straight at aVR, away from everything else: aVR up, eight leads down.</td></tr>
                  <tr><td>Posterior</td><td>almost none</td><td>The arrow points backwards, out of the frontal plane. Nothing shows until you record V7&ndash;V9.</td></tr>
                </tbody>
              </table></div>
              <p>The horizontal plane cannot be derived from the frontal one, so V1&ndash;V6 are given directly. But the four dependent frontal leads never are: <code>III = II &minus; I</code>, <code>aVR = &minus;(I+II)/2</code>, <code>aVL = I &minus; II/2</code>, <code>aVF = II &minus; I/2</code>, at every instant of every beat. A test checks all four to within 10<sup>&minus;9</sup>&nbsp;mV across every occlusion and every stage, so nothing the page draws could fail to come off a real patient.</p>
              <p>The numbers beside each trace are the ST shift in millimetres at the J point. Bold means that lead clears its diagnostic threshold under the Fourth Universal Definition &mdash; 1&nbsp;mm in most leads, 2&nbsp;mm in V2&ndash;V3 for a man of 40 or over (2.5&nbsp;mm under 40, 1.5&nbsp;mm for a woman), and 0.5&nbsp;mm in V4R and V7&ndash;V9. Change the patient in the view options and watch which leads cross.</p>
      </>
    ),
  },
  {
    id: 'the-conduction-system-and-why-its-blood-',
    title: 'The conduction system, and why its blood supply is the point',
    body: () => (
      <>
        <p>Turn on the conduction layer. The parts grey out one by one as you change the occlusion, and they do not follow the wall that is infarcting &mdash; they follow their own arteries.</p>
              <div class="ref-table"><table>
                <caption>Each part fails only when it loses every artery that feeds it.</caption>
                <thead><tr><th>Part</th><th>Supply</th><th>Fails when</th><th>What you see</th></tr></thead>
                <tbody>
                  <tr><td>Sinoatrial node</td><td>Sinus node artery &mdash; RCA ~60%, LCx ~40%</td><td>Single supply</td><td>Sinus bradycardia, arrest, or junctional escape.</td></tr>
                  <tr><td>AV node</td><td>AV nodal branch of whichever artery reaches the crux &mdash; RCA ~90%</td><td>Single supply</td><td>Wenckebach or complete block, but <strong>narrow</strong>, atropine-responsive and temporary.</td></tr>
                  <tr><td>Bundle of His</td><td>AV nodal artery <em>and</em> the first septal perforator</td><td>Both gone</td><td>Wide-complex infranodal block. Atropine will not touch it.</td></tr>
                  <tr><td>Right bundle branch</td><td>Septal perforators only</td><td>Single supply</td><td>RSR&prime; in V1, wide slurred S in I and V6.</td></tr>
                  <tr><td>Left anterior fascicle</td><td>First septal perforator only</td><td>Single supply</td><td>Left axis deviation past &minus;45&deg;, qR in aVL.</td></tr>
                  <tr><td>Left posterior fascicle</td><td>Septal perforators <em>and</em> the PDA</td><td>Both gone</td><td>Right axis deviation. Rare alone &mdash; it is broad and dual-fed.</td></tr>
                </tbody>
              </table></div>
              <p>Two consequences worth carrying out of the table. A <strong>proximal LAD</strong> occlusion takes the first septal perforator, and the right bundle and the left anterior fascicle are the two structures that depend on it alone &mdash; so they fail together, and new bifascicular block localises the lesion above the first septal. An <strong>inferior</strong> infarct takes the AV nodal branch, which sits above the bundle of His, so the block it causes is narrow, responds to atropine, and recovers. Same symptom, opposite prognosis, and the difference is anatomical.</p>
              <p>The same logic runs the papillary muscles. The anterolateral one is fed by the first diagonal <em>and</em> the first obtuse marginal; the posteromedial one hangs off the posterior descending alone. That is the whole reason posteromedial rupture after an inferior MI is six to twelve times commoner, and why it lands three to seven days out, when the muscle is at its softest.</p>
      </>
    ),
  },
  {
    id: 'patterns-that-are-occlusions-in-disguise',
    title: 'Patterns that are occlusions in disguise',
    body: () => (
      <>
        <ul>
                <li><strong>De Winter T waves</strong> — upsloping ST depression at the J point in the precordial leads with tall symmetrical T waves and slight elevation in aVR. Proximal LAD occlusion; treat as a STEMI.</li>
                <li><strong>Wellens syndrome</strong> — biphasic (type A) or deeply inverted (type B) T waves in V2–V3 in a pain-free patient. Critical proximal LAD stenosis; do not stress test.</li>
                <li><strong>Posterior MI</strong> — horizontal ST depression V1–V3 with a tall broad R wave and an upright T. Get V7–V9.</li>
                <li><strong>Sgarbossa criteria in LBBB or a paced rhythm</strong> — concordant ST elevation ≥1 mm (5 points), concordant ST depression ≥1 mm in V1–V3 (3 points), or excessively discordant ST elevation ≥5 mm (2 points). Three or more points is specific for infarction. The modified Smith rule replaces the last with an ST/S ratio of −0.25 or more.</li>
                <li><strong>Left main or triple vessel</strong> — ST elevation in aVR exceeding V1, with ST depression in eight or more leads.</li>
              </ul>
      </>
    ),
  },
  {
    id: 'timeline-ecg-beside-the-specimen',
    title: 'Timeline: ECG beside the specimen',
    body: () => (
      <>
        <p>Slide the timeline above and this table is what is moving underneath it.</p>
              <div class="ref-table"><table>
                <caption>Evolution of a transmural infarct. The mechanical complications track the softening, not the ECG.</caption>
                <thead>
                  <tr><th>Time</th><th>ECG</th><th>Gross specimen</th><th>Microscopy</th><th>Risk</th></tr>
                </thead>
                <tbody>
                  <tr><td>0–30 min</td><td>Hyperacute T waves</td><td>Nothing visible — injury still reversible</td><td>Nothing on H&amp;E</td><td>VF</td></tr>
                  <tr><td>30 min – 4 h</td><td>ST elevation, reciprocal depression</td><td>Nothing, or faint dusky change</td><td>Wavy fibres at the border; early coagulative necrosis</td><td>VF; best reperfusion window</td></tr>
                  <tr><td>4–12 h</td><td>Maximal ST elevation, R wave shrinking</td><td>Dark mottling begins</td><td>Coagulative necrosis, oedema, early neutrophils</td><td>—</td></tr>
                  <tr><td>12–24 h</td><td>Q waves appear, T flattening</td><td>Dark mottling obvious</td><td>Nuclei lost, contraction bands, brisk neutrophils</td><td>—</td></tr>
                  <tr><td>1–3 days</td><td>Deep T inversion, Q established</td><td>Yellow-tan centre, hyperaemic border</td><td>Dense neutrophilic infiltrate</td><td>Fibrinous pericarditis</td></tr>
                  <tr><td>3–7 days</td><td>ST near baseline, deep T inversion</td><td>Maximally yellow, soft, friable</td><td>Macrophages clearing debris; early granulation</td><td><strong>Peak rupture risk</strong> — free wall, septum, papillary muscle</td></tr>
                  <tr><td>7–14 days</td><td>Persistent T inversion and Q waves</td><td>Red-grey depressed borders</td><td>Granulation tissue, new vessels, early collagen</td><td>—</td></tr>
                  <tr><td>2–8 weeks</td><td>Q waves persist, T normalising</td><td>Grey-white scar spreading inward</td><td>Increasing collagen, falling cellularity</td><td>Dressler syndrome; mural thrombus</td></tr>
                  <tr><td>&gt; 2 months</td><td>Q waves only; persistent elevation suggests aneurysm</td><td>Dense white collagenous scar, thinned wall</td><td>Acellular dense collagen</td><td>Aneurysm, embolism, scar-related VT</td></tr>
                </tbody>
              </table></div>
      </>
    ),
  },
  {
    id: 'the-venous-side',
    title: 'The venous side',
    body: () => (
      <>
        <p>Turn on the venous layer in the model. Almost everything drains to the coronary sinus in the posterior atrioventricular groove, and each large vein runs beside the artery it accompanies — which is why the venous map is a useful way to relearn the arterial one.</p>
              <ul>
                <li><strong>Great cardiac vein</strong> — runs up the anterior interventricular groove beside the LAD, then turns into the left AV groove beside the circumflex, and becomes the coronary sinus.</li>
                <li><strong>Middle cardiac vein</strong> — posterior interventricular groove, beside the PDA, straight into the coronary sinus near the crux.</li>
                <li><strong>Small cardiac vein</strong> — right AV groove, beside the RCA and the acute marginal.</li>
                <li><strong>Posterior vein of the left ventricle</strong> — the target for the left ventricular lead in cardiac resynchronisation.</li>
                <li><strong>Anterior cardiac veins</strong> — drain the RV directly into the right atrium, bypassing the coronary sinus. <strong>Thebesian veins</strong> empty straight into the chambers, which is part of why arterial oxygen saturation is never quite 100%.</li>
              </ul>
      </>
    ),
  },
  {
    id: 'what-the-model-gets-right-and-what-it-do',
    title: "What the model gets right, and what it doesn't",
    body: () => (
      <>
        <p>The geometry is generated from measured anatomy and then checked against a reference diagram, rather than sculpted by eye. Twenty-eight automated checks run over the shape itself.</p>
              <ul>
                <li><strong>Orientation.</strong> The heart is a quadrangular pyramid lying on its side. The base is the left atrium, facing posteriorly at T5&ndash;T8; the apex is left ventricular and points anteriorly, inferiorly and to the left, reaching the fifth intercostal space in the midclavicular line. The long axis runs about 44&deg; oblique to the body planes, and projects onto a frontal view at 37&deg; from vertical &mdash; which is what the reference diagram measures too.</li>
                <li><strong>Left ventricle.</strong> A truncated prolate ellipsoid, circular in short axis, 8.7&nbsp;cm base to apex with a 6.6&nbsp;cm epicardial short axis, widest at the equator rather than at the annulus. Wall thickness follows the measured pattern: about 9&nbsp;mm at the septum, thicker posterolaterally, thinnest at the apex, where the cavity closes short of the epicardial surface because apical myocardium is nearly solid. Cavity long-to-short ratio 1.7:1, matching both the echo literature and the diagram.</li>
                <li><strong>Right ventricle.</strong> A crescent wrapping the left ventricle, 4&nbsp;mm thick, spanning about 110&deg; of the left ventricular circumference between the two interventricular grooves and falling to nothing at each. Cavity depth 3.6&nbsp;cm, giving a basal inflow near the measured 4.5&nbsp;cm. It is displaced forwards as well as outwards, and its deepest point is front-loaded towards the anterior interventricular groove rather than sitting out to the right &mdash; which is what puts the right ventricle, not the left, against the sternum.</li>
                <li><strong>The two annuli are not level.</strong> The tricuspid annulus sits about 6&nbsp;mm apical to the mitral &mdash; the normal offset whose loss defines Ebstein's anomaly. So the right ventricle starts lower and, although the shorter chamber at 7.0&nbsp;cm against 8.7, ends close to the apex. The apex itself is left ventricular.</li>
                <li><strong>Septum.</strong> Convex towards the right ventricle. That convexity is why the left ventricular cavity reads circular and the right ventricular cavity crescentic.</li>
                <li><strong>Borders and surfaces.</strong> Checked automatically on every build: the right border is the right atrium, the left border the left ventricle, the base the left atrium, the apex the left ventricle, and the sternocostal surface the right ventricle.</li>
                <li><strong>Appendages.</strong> The right atrial appendage is a broad scalloped flap lying over the aortic root; the left is a narrower flattened finger beside the pulmonary trunk.</li>
                <li><strong>Outflow and great arteries.</strong> The infundibulum sweeps up, left and anterior, crossing in front of the aortic root; the pulmonary trunk then runs posteriorly across the aorta. The two great arteries spiral around each other &mdash; the relationship that transposition reverses.</li>
              <li><strong>Valves and papillary muscles are scanned, not sculpted.</strong> BodyParts3D decomposes each chamber into a blood-pool cavity, a wall region, the valve leaflets hinged on it and the papillary muscles. Because the leaflets are shared between the chamber above and the chamber below, collecting every element of &ldquo;left atrium&rdquo; silently welds the mitral valve onto it &mdash; and earlier builds were painting AHA segment colours onto mitral leaflets. The build script now names each element, so the four valves and the papillary muscles come through as real scanned surfaces in their own right.</li>
              <li><strong>The atria are trimmed to the chamber.</strong> The cavae and the pulmonary veins are modelled as part of the atrial wall. Left attached they make each atrium about 9&nbsp;cm across and drive it straight down through the ventricles; clipped to a sphere anchored above each atrium&rsquo;s own AV valve they come out at 4&ndash;5&nbsp;cm, which is atrium-sized.</li>
              <li><strong>The conduction system is drawn where its blood supply is, not where the muscle is.</strong> Sinus node at the cavoatrial junction, AV node in the triangle of Koch, the His bundle through the membranous septum, then the right bundle and the two left fascicles. Each one greys out only when <em>all</em> of its arteries are occluded, which is why a proximal LAD lesion fells the right bundle and the left anterior fascicle together while the dual-supplied posterior fascicle and His bundle survive.</li>
              </ul>
              <p class="ref-note"><strong>Known limitations.</strong> The right ventricle now forms the most anterior point of the heart, but the procedural crescent still covers only about 37% of the frontal area, against roughly half to two thirds in life. The scanned frame is pinned to the extreme basal vertex of the left ventricle rather than to the mitral annulus, so the scanned parts sit two to three centimetres lower against the model&rsquo;s own base than they should; the relationships between them are right, the absolute height is not. In this one cadaveric dataset the tricuspid annulus also reads a few millimetres <em>basal</em> to the mitral rather than apical to it &mdash; the procedural model has the offset the right way round. <strong>Also left out:</strong> chordae tendineae, trabeculae carneae and the moderator band, the pericardium, and any patient-specific variation beyond dominance and the ramus intermedius. Coronary courses are schematic &mdash; real ones wander.</p>
      </>
    ),
  },
  {
    id: 'dominance-and-why-it-changes-the-answer',
    title: 'Dominance, and why it changes the answer',
    body: () => (
      <>
        <p>Dominance is defined by which artery gives off the posterior descending artery.</p>
              <ul>
                <li><strong>Right dominant (~85%)</strong> — PDA from the RCA. An inferior MI is an RCA lesion, and the AV node is at risk.</li>
                <li><strong>Left dominant (~8%)</strong> — PDA from the circumflex. An inferior MI here is a circumflex lesion, and because one vessel supplies both the lateral and inferior walls, the infarct is larger and the prognosis worse.</li>
                <li><strong>Co-dominant (~7%)</strong> — PDA from the RCA, posterolateral branches from the circumflex.</li>
              </ul>
              <p>Two supply facts worth carrying: the <strong>posteromedial papillary muscle</strong> has a single blood supply from the PDA, which is why it ruptures after an inferior MI while the dual-supplied anterolateral one rarely does. And the <strong>AV node</strong> comes off the RCA in about 85–90% of people, which is why heart block accompanies inferior rather than anterior infarcts — and why that block is usually narrow, atropine-responsive and temporary.</p>
              <p>Switch the <strong>dominance</strong> control beside the model and the whole tree rebuilds: the artery that reaches the crux changes, the posterior descending changes parent, and the inferior segments move from one territory to the other. In a left-dominant heart an RCA occlusion leaves the left ventricle almost untouched, and a circumflex occlusion takes the lateral <em>and</em> the inferior wall at once.</p>
      </>
    ),
  },
];
