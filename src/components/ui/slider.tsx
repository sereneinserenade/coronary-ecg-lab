import { Slider as KSlider } from '@kobalte/core/slider';
import { cn } from '~/lib/utils';
import type { JSX } from 'solid-js';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  'aria-label': string;
  /** Spoken value, so a screen reader hears "3 to 7 days" rather than "6". */
  getValueLabel?: (value: number) => string;
  id?: string;
  class?: string;
}

export function Slider(props: SliderProps): JSX.Element {
  return (
    <KSlider
      class={cn('relative flex w-full touch-none select-none items-center', props.class)}
      value={[props.value]}
      minValue={props.min}
      maxValue={props.max}
      step={props.step}
      onChange={(v) => { if (v[0] !== undefined) props.onChange(v[0]); }}
      getValueLabel={(params) =>
        props.getValueLabel ? props.getValueLabel(params.values[0] ?? 0) : String(params.values[0])}
    >
      <KSlider.Label class="sr-only">{props['aria-label']}</KSlider.Label>
      <KSlider.Track class="relative h-1.5 w-full grow rounded-full bg-(--color-line)">
        <KSlider.Fill class="absolute h-full rounded-full bg-(--color-accent)" />
        <KSlider.Thumb
          id={props.id}
          class={cn(
            'block size-5 -top-1.75 rounded-full border-2 border-(--color-accent) bg-(--color-surface)',
            'shadow-sm transition-[box-shadow,transform] duration-150 ease-out',
            'hover:scale-110 active:scale-105',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)',
          )}
        >
          <KSlider.Input />
        </KSlider.Thumb>
      </KSlider.Track>
    </KSlider>
  );
}
