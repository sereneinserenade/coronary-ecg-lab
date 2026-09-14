import { Separator as KSeparator } from '@kobalte/core/separator';
import { splitProps } from 'solid-js';
import type { ComponentProps } from 'solid-js';
import { cn } from '~/lib/utils';

export function Separator(props: ComponentProps<typeof KSeparator>) {
  const [local, rest] = splitProps(props, ['class', 'orientation']);
  return (
    <KSeparator
      orientation={local.orientation ?? 'horizontal'}
      class={cn(
        'shrink-0 border-none bg-(--color-line)',
        (local.orientation ?? 'horizontal') === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        local.class,
      )}
      {...rest}
    />
  );
}
