import { For } from 'solid-js';
import { SEG_NAME } from '~/lib/heart-data';
import type { SegmentId } from '~/lib/heart-data';
import { infarctHex } from '~/lib/palette';
import type { Lab } from '~/lib/state';

const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  // Screen y is down; negate so anterior sits at the top.
  const a = (-deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};

function ringPath(cx: number, cy: number, rIn: number, rOut: number, a0: number, a1: number) {
  const [x1, y1] = polar(cx, cy, rOut, a0);
  const [x2, y2] = polar(cx, cy, rOut, a1);
  const [x3, y3] = polar(cx, cy, rIn, a1);
  const [x4, y4] = polar(cx, cy, rIn, a0);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M${x1} ${y1}A${rOut} ${rOut} 0 ${large} 0 ${x2} ${y2}L${x3} ${y3}A${rIn} ${rIn} 0 ${large} 1 ${x4} ${y4}Z`;
}

/** [segment, innerR, outerR, startDeg, endDeg] */
const RINGS: [SegmentId, number, number, number, number][] = (() => {
  const basal: [SegmentId, number, number][] = [[1, 60, 120], [2, 120, 180], [3, 180, 240], [4, 240, 300], [5, 300, 360], [6, 0, 60]];
  const mid: [SegmentId, number, number][] = [[7, 60, 120], [8, 120, 180], [9, 180, 240], [10, 240, 300], [11, 300, 360], [12, 0, 60]];
  const apical: [SegmentId, number, number][] = [[13, 45, 135], [14, 135, 225], [15, 225, 315], [16, -45, 45]];
  return [
    ...basal.map(([s, a, b]) => [s, 76, 100, a, b] as [SegmentId, number, number, number, number]),
    ...mid.map(([s, a, b]) => [s, 52, 76, a, b] as [SegmentId, number, number, number, number]),
    ...apical.map(([s, a, b]) => [s, 26, 52, a, b] as [SegmentId, number, number, number, number]),
  ];
})();

export function Bullseye(props: { lab: Lab }) {
  const hit = (seg: SegmentId) =>
    props.lab.stage().id !== 0 && props.lab.scenario().segs.includes(seg);
  const fill = (seg: SegmentId) =>
    hit(seg) ? infarctHex(props.lab.stage()) : 'var(--color-elevated)';
  // The segment number, so a reader can name what is lit without counting round.
  const centre = (rIn: number, rOut: number, a0: number, a1: number) =>
    polar(120, 120, (rIn + rOut) / 2, (a0 + a1) / 2);

  const label = (x: number, y: number, text: string, anchor: 'start' | 'middle' | 'end' = 'middle') => (
    <text x={x} y={y} text-anchor={anchor}
      class="fill-(--color-muted) text-[10px] font-semibold tracking-[0.08em]">{text}</text>
  );

  return (
    <svg
      viewBox="0 0 240 240" role="img"
      class="mx-auto block h-auto w-full max-w-64"
      aria-label={`Bullseye plot of the seventeen left ventricular segments. ${
        props.lab.stage().id === 0 || props.lab.scenario().segs.length === 0
          ? 'No segment is infarcted.'
          : `Infarcted: ${props.lab.scenario().segs.map((s) => SEG_NAME[s]).join(', ')}.`}`}
    >
      <For each={RINGS}>
        {([seg, rIn, rOut, a0, a1]) => (
          <>
            <path
              d={ringPath(120, 120, rIn, rOut, a0, a1)}
              fill={fill(seg)}
              stroke="var(--color-line)"
              stroke-width={hit(seg) ? 1.6 : 1}
              class="transition-[fill] duration-200 ease-out"
            >
              <title>{`${seg}. ${SEG_NAME[seg]}`}</title>
            </path>
            <text
              x={centre(rIn, rOut, a0, a1)[0]} y={centre(rIn, rOut, a0, a1)[1] + 3.5}
              text-anchor="middle"
              class="pointer-events-none text-[9px] font-semibold"
              fill={hit(seg) ? '#1c1a17' : 'var(--color-muted)'}
            >{seg}</text>
          </>
        )}
      </For>
      <circle
        cx={120} cy={120} r={26}
        fill={fill(17)}
        stroke="var(--color-line)"
        stroke-width={hit(17) ? 1.6 : 1}
        class="transition-[fill] duration-200 ease-out"
      >
        <title>17. apex</title>
      </circle>
      <text x={120} y={123.5} text-anchor="middle"
        class="pointer-events-none text-[9px] font-semibold"
        fill={hit(17) ? '#1c1a17' : 'var(--color-muted)'}>17</text>
      {label(120, 14, 'ANTERIOR')}
      {label(120, 236, 'INFERIOR')}
      {label(12, 124, 'SEPTAL', 'start')}
      {label(228, 124, 'LATERAL', 'end')}
    </svg>
  );
}
