import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { drawECG, ecgHeight } from '~/lib/ecg';
import type { Lab } from '~/lib/state';

export function EcgCanvas(props: { lab: Lab }) {
  let canvas!: HTMLCanvasElement;
  const [dark, setDark] = createSignal(false);
  const [width, setWidth] = createSignal(0);

  onMount(() => {
    const root = document.documentElement;
    const read = () => setDark(root.dataset.theme === 'dark');
    read();

    // Redraw on theme change, whether it came from the toggle or the OS.
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    // The canvas is a bitmap: it has to be re-rastered at every new width.
    const resize = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    resize.observe(canvas);

    onCleanup(() => { observer.disconnect(); resize.disconnect(); });
  });

  createEffect(() => {
    width();                              // re-run on resize
    drawECG(canvas, {
      scenario: props.lab.scenario(),
      stage: props.lab.stage(),
      patient: props.lab.state.patient,
      dark: dark(),
    });
  });

  // Reserving the height the trace will need stops the extra-lead row from
  // shoving the page down when the reader picks a posterior or RV occlusion.
  const reserved = () => {
    const w = width();
    return w ? `${ecgHeight(w, props.lab.scenario(), props.lab.stage())}px` : 'auto';
  };

  return (
    <canvas
      ref={canvas}
      style={{ height: reserved() }}
      class="block w-full rounded-(--radius-card) border border-(--color-line)"
      aria-label="Simulated twelve lead electrocardiogram for the selected occlusion and time point"
    />
  );
}
