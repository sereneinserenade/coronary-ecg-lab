import { For, Show } from 'solid-js';
import { DOMINANCE, PATIENTS, SCENARIOS, SEG_NAME, VESSEL_INFO } from '~/lib/heart-data';
import type { DominanceId, Patient } from '~/lib/heart-data';
import { SWATCHES } from '~/lib/palette';
import type { Lab } from '~/lib/state';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Select } from './ui/select';
import { Slider } from './ui/slider';
import { InfoTerm } from './ui/tooltip';

const LEGEND: [label: string, colour: string][] = [
  ['Artery', SWATCHES.artery],
  ['Vein', SWATCHES.vein],
  ['No flow', SWATCHES.occluded],
  ['Viable', SWATCHES.viable],
  ['Right ventricle', SWATCHES.rightVentricle],
  ['Infarct', SWATCHES.infarct],
  ['Conduction', SWATCHES.conduction],
  ['Valve', SWATCHES.valve],
];

export function Controls(props: { lab: Lab }) {
  const { lab } = props;
  const sc = () => lab.scenario();

  return (
    <aside class="grid content-start gap-6">
      {/* The two decisions that drive everything else, first and unaccompanied. */}
      <div>
        <Select
          id="scenario"
          label="Occlusion"
          value={lab.state.scenarioId}
          options={SCENARIOS.map((s) => ({ value: s.id, label: s.name }))}
          onChange={(v) => lab.setState('scenarioId', v)}
        />
      </div>

      <div>
        <Select
          id="dominance"
          label="Coronary dominance"
          value={lab.state.dominance}
          options={Object.values(DOMINANCE).map((d) => ({
            value: d.id as DominanceId, label: `${d.label} (${d.prevalence})`,
          }))}
          onChange={(v) => lab.setState('dominance', v)}
        />
      </div>

      <div class="grid gap-3 rounded-(--radius-card) border border-(--color-line) bg-(--color-surface) p-4">
        <h3 class="text-[15px] font-semibold">{sc().name}</h3>
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
          {/* Five rows of em-dashes is not a baseline, it is noise. With nothing
              occluded only the rate has anything to report. */}
          <Show when={sc().dead.length}>
            <dt class="font-semibold text-(--color-muted)">Wall</dt>
            <dd class="m-0">{sc().wall}</dd>
            <dt class="font-semibold text-(--color-muted)">Artery</dt>
            <dd class="m-0">{sc().artery}</dd>
            <dt class="font-semibold text-(--color-muted)">Vessels</dt>
            <dd class="m-0">
              <For each={sc().dead}>
                {(v, i) => (
                  <>
                    <InfoTerm content={VESSEL_INFO[v]?.[1] ?? v}>{v}</InfoTerm>
                    <Show when={i() < sc().dead.length - 1}>{', '}</Show>
                  </>
                )}
              </For>
            </dd>
          </Show>
          <dt class="font-semibold text-(--color-muted)">Segments</dt>
          <dd class="m-0">
            {sc().segs.length
              ? sc().segs.map((s) => `${s} ${SEG_NAME[s]}`).join('; ')
              : '—'}
          </dd>
          <dt class="font-semibold text-(--color-muted)">Rate</dt>
          <dd class="m-0 tabular">{lab.stage().id === 0 ? 75 : sc().hr} bpm</dd>
        </dl>
      </div>

      <fieldset class="grid gap-2 border-0 p-0">
        <legend class="mb-1 text-[13px] font-medium text-(--color-muted)">Layers</legend>
        <div class="grid grid-cols-2 gap-1.5">
          <Checkbox label="Arteries" checked={lab.state.showArteries}
            onChange={(v) => lab.setState('showArteries', v)} />
          <Checkbox label="Veins" checked={lab.state.showVeins}
            onChange={(v) => lab.setState('showVeins', v)} />
          <Checkbox label="RV &amp; atria" checked={lab.state.showChambers}
            onChange={(v) => lab.setState('showChambers', v)} />
          <Checkbox label="Conduction" checked={lab.state.showConduction}
            onChange={(v) => lab.setState('showConduction', v)} />
          <Checkbox label="Valves" checked={lab.state.showInternals}
            onChange={(v) => lab.setState('showInternals', v)} />
          <Checkbox label="Variants" checked={lab.state.showVariants}
            onChange={(v) => lab.setState('showVariants', v)} />
        </div>
      </fieldset>

      {/* Secondary settings, disclosed but not hidden. */}
      <details class="border-t border-(--color-line) pt-3" open>
        <summary class="cursor-pointer list-none text-[13px] font-medium text-(--color-muted) marker:content-none hover:text-(--color-ink)">
          View options
        </summary>
        <div class="grid gap-5 pt-4">
          <div class="grid gap-2">
            <Label for="opacity">LV wall opacity</Label>
            <Slider
              id="opacity" aria-label="Left ventricular wall opacity"
              value={lab.state.wallOpacity} min={0.25} max={1} step={0.05}
              getValueLabel={(v) => `${Math.round(v * 100)} percent`}
              onChange={(v) => lab.setState('wallOpacity', v)}
            />
          </div>

          <Select
            id="patient"
            label="ST threshold for"
            description="Sets the V2–V3 bar: 2 mm, 2.5 mm or 1.5 mm."
            value={lab.state.patient}
            options={PATIENTS.map((p) => ({ value: p.id as Patient, label: p.label }))}
            onChange={(v) => lab.setState('patient', v)}
          />

          <div class="flex flex-wrap gap-2">
            <Checkbox label="Rotate" checked={lab.state.spin}
              onChange={(v) => lab.setState('spin', v)} />
            <Checkbox label="Scanned anatomy" checked={lab.state.geometry === 'scanned'}
              onChange={(v) => lab.setState('geometry', v ? 'scanned' : 'procedural')} />
          </div>

          <details class="border-t border-(--color-line) pt-3">
            <summary class="cursor-pointer list-none text-[13px] font-medium text-(--color-muted) marker:content-none hover:text-(--color-ink)">
              Colour key
            </summary>
            <ul class="grid grid-cols-2 gap-x-3 gap-y-1.5 p-0 pt-3 text-xs text-(--color-muted)">
              <For each={LEGEND}>
                {([name, colour]) => (
                  <li class="flex list-none items-center gap-2">
                    <i class="size-3 shrink-0 rounded-[3px] ring-1 ring-black/15"
                      style={{ background: colour }} aria-hidden="true" />
                    {name}
                  </li>
                )}
              </For>
            </ul>
          </details>
        </div>
      </details>
    </aside>
  );
}
