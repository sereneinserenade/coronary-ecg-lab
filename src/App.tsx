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

        {/* One reactive column beside a sticky control rail. Previously the
            controls were a second column of their own height, which left a
            screenful of dead space under the short one. */}
        <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div class="grid min-w-0 gap-6">
            <section class="grid gap-3" aria-label="Interactive model">
              <HeartStage lab={lab} />
              <Scrubber lab={lab} />
            </section>

            <section
              class="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_14rem]"
              aria-label="ECG and segment map"
            >
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

            <section aria-label="Findings">
              <Findings lab={lab} />
            </section>
          </div>

          {/* Sticky so the occlusion and the timeline stay reachable while the
              reader is down in the findings comparing them. */}
          <div class="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
            <Controls lab={lab} />
          </div>
        </div>

        <Reference />
      </main>

      <footer class="mt-16 border-t border-(--color-line) bg-(--color-surface)">
        <div class="mx-auto grid max-w-[84rem] gap-6 px-4 py-8 md:grid-cols-[minmax(0,1fr)_auto] md:px-6 xl:px-8">
          {/* The disclaimer is the one thing in here that must not be skimmed,
              so it keeps the weight and the rest drops to metadata. */}
          <p class="m-0 max-w-(--measure) text-sm">
            <strong>For clinicians and students.</strong> A simplified model for
            teaching anatomy and ECG–pathology correlation.{' '}
            <span class="text-(--color-warn)">
              Not for use in any decision about a real patient.
            </span>
          </p>

          <ul class="m-0 grid gap-1.5 p-0 text-[13px] text-(--color-muted) md:justify-items-end md:text-right">
            <li class="list-none">
              <a
                class="rounded underline decoration-(--color-line) underline-offset-4 transition-colors duration-150 hover:text-(--color-ink) hover:decoration-(--color-accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)"
                href="https://github.com/sereneinserenade/coronary-ecg-lab"
              >
                Source on GitHub
              </a>
            </li>
            <li class="list-none">
              Anatomy:{' '}
              <a
                class="rounded underline decoration-(--color-line) underline-offset-4 transition-colors duration-150 hover:text-(--color-ink) hover:decoration-(--color-accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)"
                href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/"
              >
                BodyParts3D
              </a>
              , ©&nbsp;The Database Center for Life Science
            </li>
            <li class="list-none">
              <a
                class="rounded underline decoration-(--color-line) underline-offset-4 transition-colors duration-150 hover:text-(--color-ink) hover:decoration-(--color-accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)"
                href="https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en"
              >
                CC BY-SA 2.1 JP
              </a>
              {' · code MIT'}
            </li>
          </ul>
        </div>
      </footer>
    </>
  );
}
