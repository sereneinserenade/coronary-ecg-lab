import { createLab } from '~/lib/state';
import { Bullseye } from './components/Bullseye';
import { Controls } from './components/Controls';
import { EcgCanvas } from './components/EcgCanvas';
import { Findings } from './components/Findings';
import { HeartStage } from './components/HeartStage';
import { Reference } from './components/Reference';
import { Scrubber } from './components/Scrubber';
import { ThemeToggle } from './components/ThemeToggle';

export function App() {
  const lab = createLab();

  return (
    <>
      <a
        href="#main"
        class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-(--color-accent) focus:px-3 focus:py-2 focus:text-(--color-accent-ink)"
      >
        Skip to content
      </a>

      <header class="border-b border-(--color-line)">
        <div class="mx-auto flex max-w-[84rem] flex-wrap items-center gap-4 px-4 py-3 md:px-6 xl:px-8">
          <span class="grid">
            <span class="font-semibold tracking-[-0.01em]">Coronary Territories &amp; ECG</span>
            <span class="text-[13px] text-(--color-muted)">An interactive teaching tool</span>
          </span>
          <nav aria-label="Main" class="ml-auto flex items-center gap-1">
            <a class="rounded px-3 py-2 text-sm text-(--color-muted) transition-colors duration-150 hover:text-(--color-ink)" href="#main">Model</a>
            <a class="rounded px-3 py-2 text-sm text-(--color-muted) transition-colors duration-150 hover:text-(--color-ink)" href="#reference">Reference</a>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main id="main" class="mx-auto max-w-[84rem] px-4 pb-16 md:px-6 xl:px-8">
        <div class="max-w-(--measure) py-8">
          <p class="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-(--color-accent)">
            Teaching tool
          </p>
          <h1 class="mt-2 mb-3 text-[clamp(1.75rem,4vw,2.25rem)] font-semibold leading-[1.15] tracking-[-0.02em]">
            Coronary territories, the ECG, and the specimen.
          </h1>
          <p class="m-0 text-lg text-(--color-muted)">
            Pick a coronary occlusion. The model shows which wall dies, the
            12-lead shows what you would actually see, and the pathology panel
            shows what that same infarct looks like in the hand at every stage
            from thirty minutes to two months.
          </p>
          <p class="mt-4 rounded-(--radius-card) border border-(--color-line) bg-(--color-surface) p-4 text-sm">
            <strong>For clinicians and students.</strong> This is a deliberately
            simplified model built for teaching anatomy and ECG–pathology
            correlation. Coronary anatomy varies between people, ECG patterns
            overlap, and nothing here should be used to make a decision about a
            real patient.
          </p>
        </div>

        {/* The model and its two primary controls sit together; everything the
            reader changes is within reach of what it changes. */}
        <section class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-label="Interactive model">
          <div class="grid min-w-0 gap-4">
            <HeartStage lab={lab} />
            <Scrubber lab={lab} />
          </div>
          <Controls lab={lab} />
        </section>

        <section class="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]" aria-label="ECG and segment map">
          <figure class="m-0 grid min-w-0 gap-2">
            <figcaption class="text-[11px] font-bold uppercase tracking-[0.06em] text-(--color-muted)">
              12-lead ECG
            </figcaption>
            <EcgCanvas lab={lab} />
          </figure>
          <figure class="m-0 grid gap-2">
            <figcaption class="text-[11px] font-bold uppercase tracking-[0.06em] text-(--color-muted)">
              AHA 17-segment map
            </figcaption>
            <Bullseye lab={lab} />
          </figure>
        </section>

        <section class="mt-8" aria-label="Findings">
          <Findings lab={lab} />
        </section>

        <Reference />
      </main>

      <footer class="border-t border-(--color-line) py-8">
        <div class="mx-auto grid max-w-[84rem] gap-2 px-4 text-[13px] text-(--color-muted) md:px-6 xl:px-8">
          <p class="m-0">
            <strong>For clinicians and students.</strong> A simplified model for
            teaching anatomy and ECG–pathology correlation. Not for use in any
            decision about a real patient.
          </p>
          <p class="m-0">
            Scanned anatomy: BodyParts3D, Copyright © The Database Center for Life
            Science, licensed under{' '}
            <a class="underline underline-offset-2 hover:text-(--color-ink)"
              href="https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en">
              CC Attribution-Share Alike 2.1 Japan
            </a>.
          </p>
          <p class="m-0">
            Source:{' '}
            <a class="underline underline-offset-2 hover:text-(--color-ink)"
              href="https://github.com/sereneinserenade/coronary-ecg-lab">
              github.com/sereneinserenade/coronary-ecg-lab
            </a>
          </p>
        </div>
      </footer>
    </>
  );
}
