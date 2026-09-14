import { Checkbox as KCheckbox } from '@kobalte/core/checkbox';
import { cn } from '~/lib/utils';
import type { JSX } from 'solid-js';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Shown to everyone, not only on hover — a tooltip is never the only carrier. */
  hint?: string;
  class?: string;
}

/** A chip-shaped checkbox: the layer toggles read as a set of switches rather
 *  than a form, but they stay real checkboxes for the keyboard and the reader. */
export function Checkbox(props: CheckboxProps): JSX.Element {
  return (
    <KCheckbox
      checked={props.checked}
      onChange={props.onChange}
      class={cn('inline-flex', props.class)}
    >
      <KCheckbox.Input class="peer sr-only" />
      <KCheckbox.Label
        class={cn(
          'inline-flex cursor-pointer items-center gap-2 rounded-md border border-(--color-line)',
          'bg-(--color-surface) px-2.5 py-1.5 text-[13px] text-(--color-muted)',
          'transition-[color,background-color,border-color] duration-150 ease-out',
          'hover:border-(--color-accent) hover:text-(--color-ink)',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--color-accent)',
          'data-[checked]:border-(--color-accent) data-[checked]:bg-(--color-accent-soft) data-[checked]:text-(--color-ink)',
        )}
      >
        <KCheckbox.Control
          class={cn(
            'grid size-4 shrink-0 place-items-center rounded-[4px] border border-(--color-line)',
            'bg-(--color-surface) transition-colors duration-150',
            'data-[checked]:border-(--color-accent) data-[checked]:bg-(--color-accent)',
          )}
        >
          <KCheckbox.Indicator>
            <svg viewBox="0 0 16 16" class="size-3 text-(--color-accent-ink)" aria-hidden="true">
              <path d="M13 4.5 6.5 11.5 3 8" fill="none" stroke="currentColor" stroke-width="2.5"
                stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </KCheckbox.Indicator>
        </KCheckbox.Control>
        {props.label}
      </KCheckbox.Label>
    </KCheckbox>
  );
}
