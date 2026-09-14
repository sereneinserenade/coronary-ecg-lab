import { STAGES } from '~/lib/heart-data';
import type { Lab } from '~/lib/state';
import { Slider } from './ui/slider';

export function Scrubber(props: { lab: Lab }) {
  const st = () => props.lab.stage();
  return (
    <div class="grid gap-3 rounded-(--radius-card) border border-(--color-line) bg-(--color-surface) p-4">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <p class="m-0 tabular">
          {/* The time is the headline; the label for the control sits beside it. */}
          <strong class="text-xl font-semibold tracking-[-0.01em]">{st().time}</strong>
          <span class="ml-1.5 text-sm text-(--color-muted)">{st().short}</span>
        </p>
        <span class="text-xs text-(--color-muted)">Time since occlusion</span>
      </div>
      <Slider
        aria-label="Time since occlusion"
        value={props.lab.state.stage}
        min={0} max={STAGES.length - 1} step={1}
        getValueLabel={(v) => STAGES[v]?.time ?? ''}
        onChange={(v) => props.lab.setState('stage', v)}
      />
      <div class="flex justify-between text-xs text-(--color-muted)" aria-hidden="true">
        <span>Normal</span><span>24h</span><span>3–7d</span><span>&gt;2mo</span>
      </div>
    </div>
  );
}
