import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { HeartScene, SceneView, ViewName } from '~/lib/heart-scene';
import { Button } from './ui/button';
import type { Lab } from '~/lib/state';

export function HeartStage(props: { lab: Lab }) {
  let host!: HTMLDivElement;
  const [scene, setScene] = createSignal<HeartScene | null>(null);
  const [views, setViews] = createSignal<{ id: ViewName; label: string }[]>([]);
  // Which named view the camera is actually sitting at, so the buttons can say so.
  const [active, setActive] = createSignal<ViewName | null>('anterior');
  const [note, setNote] = createSignal('Procedural · generated from measured anatomy');
  const [status, setStatus] = createSignal<'loading' | 'ready' | 'unsupported'>('loading');

  onMount(() => {
    let disposed = false;
    let live: HeartScene | null = null;

    // Three.js is by far the largest thing on the page and nothing else needs
    // it, so it is fetched after first paint. The reader gets the ECG, the
    // segment map and the reference immediately instead of waiting on a
    // renderer, and the box below keeps its height either way.
    void (async () => {
      const { createHeartScene, VIEW_NAMES } = await import('~/lib/heart-scene');
      if (disposed) return;
      const s = createHeartScene(host, {
        onNote: setNote,
        // A failed scan is not a dead page: fall back and say so, in text.
        onScanFailed: () => props.lab.setState('geometry', 'procedural'),
        // Grabbing the model means you want to aim it, not chase it.
        onInteract: () => {
          props.lab.setState('spin', false);
          setActive(null);
        },
      });
      if (!s) { setStatus('unsupported'); return; }
      live = s;
      setViews(VIEW_NAMES);
      setScene(() => s);
      setStatus('ready');
    })();

    onCleanup(() => { disposed = true; live?.dispose(); });
  });

  // One effect feeds the renderer a plain snapshot. The scene never sees a signal.
  createEffect(() => {
    const s = scene();
    if (!s) return;
    const next: SceneView = {
      scenario: props.lab.scenario(),
      stage: props.lab.stage(),
      dominance: props.lab.state.dominance,
      showArteries: props.lab.state.showArteries,
      showVeins: props.lab.state.showVeins,
      showChambers: props.lab.state.showChambers,
      showConduction: props.lab.state.showConduction,
      showInternals: props.lab.state.showInternals,
      showVariants: props.lab.state.showVariants,
      wallOpacity: props.lab.state.wallOpacity,
      spin: props.lab.state.spin,
      geometry: props.lab.state.geometry,
    };
    s.update(next);
  });

  const jumpTo = (name: ViewName) => {
    props.lab.setState('spin', false);
    setActive(name);
    scene()?.setView(name);
  };

  return (
    <div class="grid gap-3">
      <div
        ref={host}
        class="relative h-[clamp(20rem,52vh,34rem)] w-full cursor-grab overflow-hidden rounded-(--radius-card) border border-(--color-line) bg-(--color-surface) active:cursor-grabbing"
      >
        <Show when={status() === 'unsupported'}>
          <p class="max-w-lg p-8 text-sm text-(--color-muted)">
            This browser could not start WebGL, so the 3D model is unavailable.
            Everything else on this page — the ECG, the segment map and the
            reference tables — still works.
          </p>
        </Show>
        <Show when={status() === 'loading'}>
          {/* The skeleton occupies exactly the box the canvas will, so nothing
              on the page moves when the renderer arrives. */}
          <div class="absolute inset-0 grid place-items-center" aria-hidden="true">
            <div class="size-28 animate-pulse rounded-full bg-(--color-line)" />
          </div>
          <p class="sr-only" role="status">Loading the 3D heart</p>
        </Show>
        <Show when={status() === 'ready'}>
          <p class="pointer-events-none absolute bottom-2 left-3 text-xs text-(--color-muted)">
            Drag to rotate · scroll to zoom
          </p>
        </Show>
      </div>

      <Show when={status() === 'ready'}>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[13px] font-medium text-(--color-muted)">Jump to</span>
          <For each={views()}>
            {(v) => (
              <Button
                variant="outline" size="sm"
                aria-pressed={active() === v.id}
                class={active() === v.id
                  ? 'border-(--color-accent) bg-(--color-accent-soft) text-(--color-ink)'
                  : undefined}
                onClick={() => jumpTo(v.id)}
              >
                {v.label}
              </Button>
            )}
          </For>
          <p class="ml-auto text-xs text-(--color-muted)" aria-live="polite">{note()}</p>
        </div>
      </Show>
    </div>
  );
}
