import { createSignal, For } from 'solid-js';
import { REFERENCE } from '~/content/reference';
import { cn } from '~/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';

export function Reference() {
  const [open, setOpen] = createSignal<string[]>(
    REFERENCE.filter((b) => b.defaultOpen).map((b) => b.id),
  );

  /** Jump to a section from the index, opening it first if it is shut. The two
   *  have to stay in step: a link that scrolls to a collapsed panel lands the
   *  reader on a heading with nothing under it. */
  const jump = (id: string) => {
    if (!open().includes(id)) setOpen([...open(), id]);
    // Let the panel lay out before measuring where to scroll to.
    requestAnimationFrame(() => {
      document.getElementById(`ref-${id}`)?.scrollIntoView({
        block: 'start',
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
  };

  const allOpen = () => open().length === REFERENCE.length;

  return (
    <section id="reference" class="mt-14 border-t border-(--color-line) pt-8" aria-label="Reference">
      <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 class="mt-0 mb-1 text-2xl font-semibold tracking-[-0.01em]">Reference</h2>
          <p class="m-0 max-w-(--measure) text-(--color-muted)">
            The tables and notes behind the model. Open what you need.
          </p>
        </div>
        <button
          type="button"
          class={cn(
            'rounded-md border border-(--color-line) bg-(--color-surface) px-3 py-1.5',
            'text-[13px] text-(--color-muted) transition-colors duration-150 ease-out',
            'hover:border-(--color-accent) hover:text-(--color-ink)',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)',
          )}
          onClick={() => setOpen(allOpen() ? [] : REFERENCE.map((b) => b.id))}
        >
          {allOpen() ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {/* The index fills the gutter the prose cannot use, and turns nine
          collapsed headings into something you can navigate without scrolling. */}
      <div class="grid items-start gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav
          class="hidden lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
          aria-label="Reference sections"
        >
          <p class="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-(--color-muted)">
            On this page
          </p>
          <ul class="m-0 grid gap-0.5 p-0">
            <For each={REFERENCE}>
              {(block) => (
                <li class="list-none">
                  <button
                    type="button"
                    onClick={() => jump(block.id)}
                    aria-current={open().includes(block.id) ? 'true' : undefined}
                    class={cn(
                      'w-full rounded-md px-2.5 py-1.5 text-left text-[13px] leading-snug',
                      'border-l-2 border-transparent transition-colors duration-150 ease-out',
                      'text-(--color-muted) hover:bg-(--color-accent-soft) hover:text-(--color-ink)',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)',
                      'aria-[current]:border-l-(--color-accent) aria-[current]:font-medium aria-[current]:text-(--color-ink)',
                    )}
                  >
                    {block.title}
                  </button>
                </li>
              )}
            </For>
          </ul>
        </nav>

        <Accordion
          multiple
          collapsible
          value={open()}
          onChange={setOpen}
          class="min-w-0 border-t border-(--color-line)"
        >
          <For each={REFERENCE}>
            {(block) => (
              <AccordionItem value={block.id}>
                <span id={`ref-${block.id}`} class="block scroll-mt-4" />
                <AccordionTrigger>{block.title}</AccordionTrigger>
                <AccordionContent>{block.body()}</AccordionContent>
              </AccordionItem>
            )}
          </For>
        </Accordion>
      </div>
    </section>
  );
}
