import { Tooltip as KTooltip } from '@kobalte/core/tooltip';
import type { JSX } from 'solid-js';
import { cn } from '~/lib/utils';

interface InfoProps {
  /** The visible text. Must make sense on its own — the tooltip only adds detail. */
  children: JSX.Element;
  content: string;
  class?: string;
}

/** A dotted-underline term with a tooltip. The tooltip is supplementary: the
 *  same text is always available in the panel below, never only on hover. */
export function InfoTerm(props: InfoProps): JSX.Element {
  return (
    <KTooltip openDelay={200} closeDelay={100}>
      <KTooltip.Trigger
        as="span"
        tabindex="0"
        class={cn(
          'cursor-help underline decoration-dotted underline-offset-2',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)',
          props.class,
        )}
      >
        {props.children}
      </KTooltip.Trigger>
      <KTooltip.Portal>
        <KTooltip.Content
          class={cn(
            'z-50 max-w-72 rounded-md border border-(--color-line) bg-(--color-surface)',
            'px-3 py-2 text-[13px] leading-snug text-(--color-ink) shadow-lg',
            'animate-in fade-in-0 zoom-in-95 duration-150 ease-out',
          )}
        >
          <KTooltip.Arrow />
          {props.content}
        </KTooltip.Content>
      </KTooltip.Portal>
    </KTooltip>
  );
}
