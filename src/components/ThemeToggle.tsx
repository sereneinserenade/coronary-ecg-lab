import { createSignal, onMount } from 'solid-js';
import { Button } from './ui/button';

type Theme = 'light' | 'dark';

/** An explicit choice, remembered. With nothing stored the OS preference wins,
 *  which is what the unset `data-theme` attribute already means to the CSS. */
export function ThemeToggle() {
  const [theme, setTheme] = createSignal<Theme>('light');

  const apply = (next: Theme) => {
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try { localStorage.setItem('theme', next); } catch { /* private mode */ }
  };

  onMount(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem('theme'); } catch { /* private mode */ }
    const prefersDark = typeof matchMedia === 'function'
      && matchMedia('(prefers-color-scheme: dark)').matches;
    const preferred: Theme = stored === 'dark' || stored === 'light'
      ? stored
      : prefersDark ? 'dark' : 'light';
    apply(preferred);
  });

  return (
    <Button
      variant="ghost" size="icon"
      aria-label={`Switch to ${theme() === 'dark' ? 'light' : 'dark'} theme`}
      onClick={() => apply(theme() === 'dark' ? 'light' : 'dark')}
    >
      <svg viewBox="0 0 24 24" class="size-4" aria-hidden="true" fill="none"
        stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        {theme() === 'dark'
          ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>
          : <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />}
      </svg>
    </Button>
  );
}
