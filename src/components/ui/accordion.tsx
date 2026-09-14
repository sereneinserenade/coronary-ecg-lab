import { Accordion as KAccordion } from '@kobalte/core/accordion';
import { splitProps } from 'solid-js';
import type { ComponentProps, JSX } from 'solid-js';
import { cn } from '~/lib/utils';

export function Accordion(props: ComponentProps<typeof KAccordion>) {
  const [local, rest] = splitProps(props, ['class']);
  return <KAccordion class={cn('w-full', local.class)} {...rest} />;
}

export function AccordionItem(props: ComponentProps<typeof KAccordion.Item>) {
  const [local, rest] = splitProps(props, ['class']);
  return <KAccordion.Item class={cn('border-b border-(--color-line)', local.class)} {...rest} />;
}

export function AccordionTrigger(props: { children: JSX.Element; class?: string }) {
  return (
    <KAccordion.Header class="flex">
      <KAccordion.Trigger
        class={cn(
          'group flex flex-1 items-center gap-3 py-4 text-left text-[15px] font-semibold',
          'text-(--color-ink) transition-colors duration-150 ease-out hover:text-(--color-accent)',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)',
          props.class,
        )}
      >
        <svg
          viewBox="0 0 16 16" aria-hidden="true"
          class="size-3.5 shrink-0 text-(--color-muted) transition-transform duration-200 ease-out group-data-[expanded]:rotate-90"
        >
          <path d="m5 3 6 5-6 5" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        {props.children}
      </KAccordion.Trigger>
    </KAccordion.Header>
  );
}

export function AccordionContent(props: { children: JSX.Element; class?: string }) {
  return (
    <KAccordion.Content
      class={cn(
        'overflow-hidden text-[15px]',
        // Kobalte measures the panel for us, so the height animation has a real target.
        'animate-kb-collapse-up data-[expanded]:animate-kb-collapse-down',
      )}
    >
      <div class={cn('ref-prose min-w-0 pb-7 pt-1', props.class)}>{props.children}</div>
    </KAccordion.Content>
  );
}
