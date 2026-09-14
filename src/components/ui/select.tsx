import { Select as KSelect } from '@kobalte/core/select';
import { Show, splitProps } from 'solid-js';
import type { JSX } from 'solid-js';
import { cn } from '~/lib/utils';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  /** Rendered by Kobalte and wired to the trigger, so the control announces
   *  "Occlusion, Proximal LAD" rather than just reading its current value. */
  label: string;
  /** Help text below the control. Associated, not merely adjacent. */
  description?: string;
  id?: string;
  class?: string;
}

/** A select built on Kobalte's listbox, so keyboard behaviour, typeahead and
 *  the accessible name come from a maintained primitive rather than from us. */
export function Select<T extends string>(props: SelectProps<T>): JSX.Element {
  const [local] = splitProps(props, ['value', 'options', 'onChange', 'id', 'class', 'label', 'description']);
  const selected = () => local.options.find((o) => o.value === local.value) ?? local.options[0];

  return (
    <KSelect<SelectOption<T>>
      options={local.options}
      optionValue="value"
      optionTextValue="label"
      value={selected()}
      onChange={(option) => { if (option) local.onChange(option.value); }}
      class={cn('grid gap-2', local.class)}
      // The list always holds a value, so there is no empty state to clear to.
      disallowEmptySelection
      itemComponent={(itemProps) => (
        <KSelect.Item
          item={itemProps.item}
          class={cn(
            'relative flex cursor-default select-none items-center rounded-sm py-2 pl-3 pr-8 text-sm outline-none',
            'text-(--color-ink) data-[highlighted]:bg-(--color-accent-soft)',
            'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
          )}
        >
          <KSelect.ItemLabel>{itemProps.item.rawValue.label}</KSelect.ItemLabel>
          <KSelect.ItemIndicator class="absolute right-2 inline-flex items-center text-(--color-accent)">
            <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true">
              <path d="M13 4.5 6.5 11.5 3 8" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </KSelect.ItemIndicator>
        </KSelect.Item>
      )}
    >
      <KSelect.Label class="text-[13px] font-medium tracking-[0.01em] text-(--color-muted)">
        {local.label}
      </KSelect.Label>
      <KSelect.Trigger
        id={local.id}
        class={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-md border border-(--color-line)',
          'bg-(--color-surface) px-3 text-left text-sm text-(--color-ink)',
          'transition-[border-color,box-shadow] duration-150 ease-out',
          'hover:border-(--color-accent)',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <KSelect.Value<SelectOption<T>> class="truncate">
          {(state) => state.selectedOption()?.label}
        </KSelect.Value>
        <KSelect.Icon class="shrink-0 text-(--color-muted)">
          <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true">
            <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.75"
              stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </KSelect.Icon>
      </KSelect.Trigger>
      <Show when={local.description}>
        <KSelect.Description class="text-xs text-(--color-muted)">
          {local.description}
        </KSelect.Description>
      </Show>
      <KSelect.Portal>
        <KSelect.Content
          class={cn(
            'z-50 overflow-hidden rounded-md border border-(--color-line) bg-(--color-surface) shadow-lg',
            // Entry grows from the trigger; the exit is quicker than the entry.
            'origin-(--kb-select-content-transform-origin)',
            'animate-in fade-in-0 zoom-in-95 duration-150 ease-out',
          )}
        >
          <KSelect.Listbox class="max-h-64 overflow-y-auto p-1" />
        </KSelect.Content>
      </KSelect.Portal>
    </KSelect>
  );
}
