import { Button as KButton } from '@kobalte/core/button';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { splitProps } from 'solid-js';
import type { ComponentProps, ValidComponent } from 'solid-js';
import { cn } from '~/lib/utils';

export const buttonVariants = cva(
  // Every control shares the same focus ring, disabled treatment and press feedback.
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ' +
  'transition-[color,background-color,border-color,box-shadow] duration-150 ease-out ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent) ' +
  'disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-(--color-accent) text-(--color-accent-ink) hover:bg-(--color-accent-hover)',
        outline:
          'border border-(--color-line) bg-(--color-surface) text-(--color-muted) ' +
          'hover:border-(--color-accent) hover:text-(--color-ink)',
        ghost: 'text-(--color-muted) hover:bg-(--color-accent-soft) hover:text-(--color-ink)',
      },
      size: {
        // 40px tall is the comfortable desktop target; sm stays above the 24px floor
        // with enough surrounding space, and icon keeps a square 40px hit area.
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded px-3 text-[13px]',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

type ButtonProps<T extends ValidComponent = 'button'> = ComponentProps<T> &
  VariantProps<typeof buttonVariants>;

export function Button<T extends ValidComponent = 'button'>(props: ButtonProps<T>) {
  const [local, rest] = splitProps(props as ButtonProps, ['class', 'variant', 'size']);
  return (
    <KButton
      class={cn(buttonVariants({ variant: local.variant, size: local.size }), local.class)}
      {...rest}
    />
  );
}
