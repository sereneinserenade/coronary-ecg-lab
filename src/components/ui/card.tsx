import { splitProps } from 'solid-js';
import type { ComponentProps } from 'solid-js';
import { cn } from '~/lib/utils';

/** One surface treatment, used sparingly — not every section is a card. */
export function Card(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class']);
  return (
    <div
      class={cn(
        'rounded-(--radius-card) border border-(--color-line) bg-(--color-surface)',
        local.class,
      )}
      {...rest}
    />
  );
}
