import { splitProps } from 'solid-js';
import type { ComponentProps } from 'solid-js';
import { cn } from '~/lib/utils';

/** The one label style. Never a placeholder standing in for a label. */
export function Label(props: ComponentProps<'label'>) {
  const [local, rest] = splitProps(props, ['class']);
  return (
    <label
      class={cn(
        'text-[13px] font-medium tracking-[0.01em] text-(--color-muted)',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        local.class,
      )}
      {...rest}
    />
  );
}
