/* The Solid app in jsdom.
 *
 * Split in two on purpose. The shell tests render the whole App and check the
 * things that only exist once it is assembled: landmarks, the WebGL fallback,
 * the layer toggles, the reference. The behaviour tests drive the store the
 * components actually read, rather than pushing every assertion through
 * Kobalte's popover — jsdom runs no animations, so its listbox never reaches
 * its exit state and the interaction says more about the library than the lab.
 * One test still opens the select from the keyboard, to prove it is operable. */
import { fireEvent, render, screen, within } from '@solidjs/testing-library';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { App } from '~/App';
import { Bullseye } from '~/components/Bullseye';
import { Controls } from '~/components/Controls';
import { Findings } from '~/components/Findings';
import { Scrubber } from '~/components/Scrubber';
import { SCENARIOS, STAGES } from '~/lib/heart-data';
import { createLab } from '~/lib/state';
import type { Lab } from '~/lib/state';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
});

/** Kobalte's slider exposes both the thumb and its hidden range input under the
 *  same name; the input is the one that actually takes the arrow keys. */
function sliderInput(name: RegExp): HTMLInputElement {
  const match = screen.getAllByRole('slider', { name })
    .find((el): el is HTMLInputElement => el.tagName === 'INPUT');
  if (!match) throw new Error(`no slider input named ${name}`);
  return match;
}

describe('the page shell', () => {
  it('renders the model, the readouts and the reference', () => {
    render(() => <App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Coronary territories/i);
    expect(screen.getByLabelText(/twelve lead electrocardiogram/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Bullseye plot/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reference' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('reserves the stage and shows a loading status while the renderer arrives', () => {
    render(() => <App />);
    // Three.js is fetched after first paint, so the very first frame must already
    // hold the space and say what it is waiting for.
    expect(screen.getByRole('status')).toHaveTextContent(/Loading the 3D heart/i);
  });

  it('says so plainly when WebGL is unavailable instead of showing an empty box', async () => {
    render(() => <App />);
    expect(await screen.findByText(/could not start WebGL/i)).toBeInTheDocument();
    expect(screen.getByText(/the ECG, the segment map and the reference tables — still works/i))
      .toBeInTheDocument();
    // The loading state must not linger once the outcome is known.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('opens the occlusion list from the keyboard and offers every scenario', async () => {
    render(() => <App />);
    const trigger = screen.getByRole('button', { name: /^Occlusion\b/i });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(SCENARIOS.length);
    for (const sc of SCENARIOS) {
      expect(options.some((o) => o.textContent?.trim() === sc.name), sc.name).toBe(true);
    }
  });

  it('every layer toggle flips and reports its state', () => {
    render(() => <App />);
    for (const name of [/^Arteries$/, /^Veins$/, /RV & atria/, /^Conduction$/,
                        /^Valves$/, /^Variants$/, /^Rotate$/, /Scanned anatomy/]) {
      const box = screen.getByRole('checkbox', { name }) as HTMLInputElement;
      const before = box.checked;
      fireEvent.click(box);
      expect(box.checked, String(name)).toBe(!before);
      fireEvent.click(box);
      expect(box.checked, String(name)).toBe(before);
    }
  });

  it('the reference is present and its content survived the migration', () => {
    render(() => <App />);
    const ref = within(screen.getByRole('region', { name: 'Reference' }));
    // Each section is reachable twice over: from the index and from its heading.
    for (const title of [/Wall by wall/i, /three discriminations/i,
                         /reciprocal change is not a separate/i,
                         /conduction system, and why its blood supply/i, /Dominance, and why/i]) {
      expect(ref.getAllByRole('button', { name: title }).length).toBe(2);
    }
    // The first block is open by default, so its table is already rendered.
    expect(ref.getByText(/Posterior third of the LV on short-axis slice/i)).toBeInTheDocument();
  });

  it('the reference index opens a section and expand-all opens every one', () => {
    render(() => <App />);
    const ref = within(screen.getByRole('region', { name: 'Reference' }));
    const index = within(ref.getByRole('navigation', { name: /Reference sections/i }));

    // A closed section has no content on the page until it is asked for.
    expect(ref.queryByText(/South African flag|de Winter/i)).not.toBeInTheDocument();
    fireEvent.click(index.getByRole('button', { name: /occlusions in disguise/i }));
    expect(ref.getByText(/De Winter T waves/i)).toBeInTheDocument();

    const toggle = ref.getByRole('button', { name: /Expand all/i });
    fireEvent.click(toggle);
    expect(ref.getByRole('button', { name: /Collapse all/i })).toBeInTheDocument();
    // Something from the last section proves they all opened.
    expect(ref.getByText(/Thebesian veins/i)).toBeInTheDocument();
    // Kobalte keeps a panel mounted after it has been opened once, so it can
    // animate the height back down. aria-expanded is the honest signal.
    fireEvent.click(ref.getByRole('button', { name: /Collapse all/i }));
    for (const heading of ref.getAllByRole('button', { name: /Wall by wall|venous side/i })) {
      if (heading.hasAttribute('aria-expanded')) {
        expect(heading).toHaveAttribute('aria-expanded', 'false');
      }
    }
  });
});

describe('the lab responds to the reader', () => {
  const mount = (setup?: (lab: Lab) => void) => {
    let lab!: Lab;
    render(() => {
      lab = createLab();
      setup?.(lab);
      return (
        <>
          <Controls lab={lab} />
          <Scrubber lab={lab} />
          <Findings lab={lab} />
          <Bullseye lab={lab} />
        </>
      );
    });
    return lab!;
  };

  it('changing the occlusion updates the lesion, the leads and the injury axis', () => {
    const lab = mount();
    lab.setState('scenarioId', 'lad-prox');
    expect(screen.getByText('Extensive anterior')).toBeInTheDocument();
    expect(screen.getByText(/ST elevation V1–V6 plus I and aVL/i)).toBeInTheDocument();
    // The injury axis is the teaching point, so it has to be on screen.
    expect(screen.getByText(/Injury vector at/i)).toBeInTheDocument();
    expect(screen.getByText('-52°')).toBeInTheDocument();
  });

  /** The panel a finding belongs in, so a phrase repeated elsewhere on the page
   *  cannot satisfy the assertion by accident. */
  const panel = (name: RegExp) =>
    within(screen.getByRole('heading', { name }).closest('section')!);

  it('reports bifascicular block for a proximal LAD and none for a right-dominant circumflex', () => {
    const lab = mount();
    lab.setState('scenarioId', 'lad-prox');
    expect(panel(/Conduction and valve/).getByText(/^Bifascicular block/i)).toBeInTheDocument();
    lab.setState('scenarioId', 'lcx');
    expect(panel(/Conduction and valve/).getByText(/No part of the conduction system loses its supply/i))
      .toBeInTheDocument();
  });

  it('flags the posteromedial papillary muscle after an inferior infarct', () => {
    const lab = mount();
    lab.setState('scenarioId', 'rca-prox');
    expect(screen.getByText(/posteromedial papillary muscle infarcted/i)).toBeInTheDocument();
    expect(screen.getByText(/six to twelve times|ruptures, three to seven days/i)).toBeInTheDocument();
  });

  it('dominance moves the inferior wall between the two systems', () => {
    const lab = mount();
    lab.setState('scenarioId', 'rca-mid');
    const segments = () => screen.getByText('Segments').parentElement!;
    expect(within(segments()).getByText(/basal inferoseptal/i)).toBeInTheDocument();

    lab.setState('dominance', 'left');
    expect(within(segments()).getByText('—')).toBeInTheDocument();
    expect(screen.getByText(/leaves the left ventricle almost untouched/i)).toBeInTheDocument();
  });

  it('the timeline scrubs through every stage and lands the rupture warning', () => {
    const lab = mount();
    const slider = sliderInput(/Time since occlusion/i);
    const scrubber = () => within(slider.closest('div.grid')!.parentElement!);
    for (let i = 0; i < STAGES.length; i++) {
      lab.setState('stage', i);
      // "Normal" is both a stage name and a tick label, so read the headline only.
      expect(scrubber().getAllByText(STAGES[i]!.time).length, STAGES[i]!.time).toBeGreaterThan(0);
    }
    lab.setState('stage', 6);
    expect(screen.getByText(/PEAK MECHANICAL RUPTURE RISK/i)).toBeInTheDocument();
    // And the control itself is keyboard-driveable, in both directions.
    lab.setState('stage', 3);
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(lab.state.stage).toBe(4);
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(lab.state.stage).toBe(2);
  });

  it('the extra leads are offered only where they would be recorded', () => {
    const lab = mount();
    lab.setState('scenarioId', 'pda');
    expect(panel(/^ECG$/).getByText(/V7–V9 turn the mirror image/i)).toBeInTheDocument();

    lab.setState('scenarioId', 'rca-prox');
    expect(panel(/^ECG$/).getByText(/V4R above 0.5/i)).toBeInTheDocument();

    lab.setState('scenarioId', 'lad-mid');
    expect(panel(/^ECG$/).queryByText(/V7–V9 turn the mirror image/i)).not.toBeInTheDocument();
    expect(panel(/^ECG$/).queryByText(/V4R above 0.5/i)).not.toBeInTheDocument();
  });

  it('the patient selector changes which leads clear the threshold', () => {
    const lab = mount((l) => l.setState('scenarioId', 'lad-mid'));
    const bold = () => document.querySelectorAll('li.font-bold').length;
    lab.setState('patient', 'man>=40');
    const older = bold();
    expect(older).toBeGreaterThan(0);
    lab.setState('patient', 'man<30');
    // The under-30 bar in V2–V3 is higher, so no more leads can qualify.
    expect(bold()).toBeLessThanOrEqual(older);
  });

  it('every scenario at every stage renders a complete set of panels', () => {
    const lab = mount();
    for (const sc of SCENARIOS) {
      lab.setState('scenarioId', sc.id);
      for (let stage = 0; stage < STAGES.length; stage++) {
        lab.setState('stage', stage);
        expect(screen.getByRole('heading', { name: 'ECG' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /How to tell it apart/ })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /Conduction and valve apparatus/ })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /Gross specimen at/ })).toBeInTheDocument();
      }
    }
  });

  it('the bullseye names the infarcted segments for a screen reader', () => {
    const lab = mount();
    expect(screen.getByRole('img', { name: /No segment is infarcted/i })).toBeInTheDocument();
    lab.setState('scenarioId', 'rca-mid');
    expect(screen.getByRole('img', { name: /Infarcted:.*basal inferior/i })).toBeInTheDocument();
    lab.setState('stage', 0);
    expect(screen.getByRole('img', { name: /No segment is infarcted/i })).toBeInTheDocument();
  });
});
