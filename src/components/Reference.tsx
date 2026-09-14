import { For } from 'solid-js';
import { REFERENCE } from '~/content/reference';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';

export function Reference() {
  const open = REFERENCE.filter((b) => b.defaultOpen).map((b) => b.id);
  return (
    <section id="reference" class="mt-14 border-t border-(--color-line) pt-8" aria-label="Reference">
      <h2 class="mt-0 mb-1 text-2xl font-semibold">Reference</h2>
      <p class="mt-0 mb-5 max-w-(--measure) text-(--color-muted)">
        The tables and notes behind the model. Open what you need.
      </p>
      <Accordion multiple collapsible defaultValue={open}>
        <For each={REFERENCE}>
          {(block) => (
            <AccordionItem value={block.id}>
              <AccordionTrigger>{block.title}</AccordionTrigger>
              <AccordionContent>{block.body()}</AccordionContent>
            </AccordionItem>
          )}
        </For>
      </Accordion>
    </section>
  );
}
