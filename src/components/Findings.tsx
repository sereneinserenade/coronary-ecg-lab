import { For, Show } from 'solid-js';
import { conductionSummary, PAPILLARY } from '~/lib/heart-data';
import { measure } from '~/lib/ecg';
import type { Lab } from '~/lib/state';

function Panel(props: { title: string; children: import('solid-js').JSX.Element }) {
  return (
    <section class="rounded-(--radius-card) border border-(--color-line) bg-(--color-surface) p-5">
      <h3 class="mt-0 mb-3 text-[15px] font-semibold">{props.title}</h3>
      <div class="grid gap-3 text-[15px] leading-relaxed">{props.children}</div>
    </section>
  );
}

function LeadRow(props: { leads: string[]; kind: 'up' | 'down' }) {
  return (
    <Show when={props.leads.length}>
      <p class="m-0 flex flex-wrap items-baseline gap-2">
        <span
          class="rounded px-1.5 py-0.5 text-[11px] font-bold tracking-[0.04em] text-white"
          style={{ background: props.kind === 'up' ? 'var(--color-elevation-up)' : 'var(--color-elevation-down)' }}
        >
          ST {props.kind === 'up' ? '↑' : '↓'}
        </span>
        <For each={props.leads}>{(l, i) => <b>{l}{i() < props.leads.length - 1 ? ',' : ''}</b>}</For>
      </p>
    </Show>
  );
}

export function Findings(props: { lab: Lab }) {
  const sc = () => props.lab.scenario();
  const st = () => props.lab.stage();

  const measured = () => (st().id === 0 ? [] : measure({
    scenario: sc(), stage: st(), patient: props.lab.state.patient, dark: false,
  }));

  const conduction = () => (st().id === 0 ? null : conductionSummary(sc().dead));

  const papillaryRisk = () => (st().id === 0 ? [] : PAPILLARY.filter((pm) => {
    const lost = pm.supply.filter((v) => sc().dead.includes(v));
    return pm.dual ? lost.length === pm.supply.length : lost.length > 0;
  }));

  return (
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Panel title="ECG">
        <p class="m-0">{sc().leads}</p>
        <LeadRow leads={sc().elevate} kind="up" />
        <LeadRow leads={sc().depress} kind="down" />

        <Show when={sc().injury.amp > 0.05}>
          <p class="m-0 text-[13px] text-(--color-muted)">
            Injury vector at{' '}
            <b class="text-(--color-ink)">
              {sc().injury.axis > 0 ? '+' : ''}{sc().injury.axis}°
            </b>{' '}
            on the hexaxial system. Every frontal lead below is the same arrow
            seen from a different angle — which is why the reciprocal depression
            is not a separate finding.
          </p>
        </Show>

        <Show when={measured().length}>
          <div class="grid gap-2">
            <span class="text-[11px] font-bold uppercase tracking-[0.04em] text-(--color-muted)">
              Measured at the J point
            </span>
            <ul class="m-0 flex flex-wrap gap-1.5 p-0">
              <For each={measured()}>
                {(m) => (
                  <li
                    class="tabular list-none whitespace-nowrap rounded border px-1.5 py-0.5 text-xs"
                    classList={{ 'font-bold': m.significant, 'opacity-70': !m.significant }}
                    style={{ color: m.mm > 0 ? 'var(--color-elevation-up)' : 'var(--color-elevation-down)' }}
                    title={`threshold in ${m.lead} is ${m.threshold.toFixed(1)} mm`}
                  >
                    {m.lead} {m.mm > 0 ? '+' : '−'}{Math.abs(m.mm).toFixed(1)}
                  </li>
                )}
              </For>
            </ul>
            <p class="m-0 text-xs text-(--color-muted)">
              Bold clears the diagnostic threshold: 1&nbsp;mm in the limb and most
              chest leads, 2&nbsp;mm in V2–V3 for a man of 40 or over, 0.5&nbsp;mm
              in V4R and V7–V9.
            </p>
          </div>
        </Show>

        <Show when={sc().posterior}>
          <p class="m-0 text-[13px] text-(--color-muted)">
            V7–V9 turn the mirror image into direct ST elevation — the extra row on the trace.
          </p>
        </Show>
        <Show when={sc().rv}>
          <p class="m-0 text-[13px] text-(--color-muted)">
            V4R above 0.5&nbsp;mm confirms right ventricular infarction — the extra row on the trace.
          </p>
        </Show>

        <p class="m-0 border-t border-(--color-line) pt-3">
          <strong>At {st().time}:</strong> {st().ecg}
        </p>
      </Panel>

      <Panel title="How to tell it apart">
        <ul class="m-0 grid gap-2 pl-5">
          <For each={sc().distinguish}>{(d) => <li>{d}</li>}</For>
        </ul>
      </Panel>

      <Panel title="Conduction and valve apparatus">
        <Show
          when={conduction()}
          fallback={
            <p class="m-0">
              No part of the conduction system loses its supply in this occlusion.
              Both nodes and all three fascicles stay perfused.
            </p>
          }
        >
          {(summary) => (
            <>
              <p class="m-0 rounded border-l-[3px] border-(--color-warn) bg-(--color-warn-soft) px-3 py-2 font-medium">
                {summary().name}
              </p>
              <p class="m-0">{summary().detail}</p>
              <ul class="m-0 grid gap-2 pl-5">
                <For each={summary().parts}>
                  {(pt) => <li><b>{pt.name}</b> — {pt.block}</li>}
                </For>
              </ul>
            </>
          )}
        </Show>

        <Show
          when={papillaryRisk().length}
          fallback={
            <p class="m-0 text-[13px] text-(--color-muted)">
              Both papillary muscles keep their supply. Turn on{' '}
              <em>Valves &amp; papillary muscles</em> to see them.
            </p>
          }
        >
          <p class="m-0 rounded border-l-[3px] border-(--color-warn) bg-(--color-warn-soft) px-3 py-2 font-medium">
            {papillaryRisk().map((pm) => pm.name).join(' and ')} infarcted.
          </p>
          <ul class="m-0 grid gap-2 pl-5">
            <For each={papillaryRisk()}>{(pm) => <li>{pm.note}</li>}</For>
          </ul>
        </Show>

        <p class="m-0 text-[13px] text-(--color-muted)">
          <b>{sc().dominance?.label} ({sc().dominance?.prevalence}).</b>{' '}
          {sc().dominance?.note}
        </p>
      </Panel>

      <Panel title={`Gross specimen at ${st().time}`}>
        <p class="m-0">{st().gross}</p>
        <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt class="font-semibold text-(--color-muted)">Where</dt>
          <dd class="m-0">{sc().gross}</dd>
          <dt class="font-semibold text-(--color-muted)">Microscopy</dt>
          <dd class="m-0">{st().micro}</dd>
          <dt class="font-semibold text-(--color-muted)">TTC stain</dt>
          <dd class="m-0">{st().ttc}</dd>
        </dl>
        <Show when={st().risk}>
          <p class="m-0 rounded border-l-[3px] border-(--color-warn) bg-(--color-warn-soft) px-3 py-2 font-medium">
            {st().risk}
          </p>
        </Show>
      </Panel>
    </div>
  );
}
