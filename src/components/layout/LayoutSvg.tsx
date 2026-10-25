import type { LayoutItemRow } from "@/lib/types";

// Kinds differ by SHAPE and OUTLINE as well as colour, so the plan reads in black and white and for colour-blind viewers.
export const KIND_STYLE: Record<string, { fill: string; stroke: string; dash?: string; width: number; round: "ellipse" | "soft" | "square" }> = {
  table: { fill: "var(--primary-tint)", stroke: "var(--primary)", width: 3, round: "ellipse" },
  stage: { fill: "var(--cue)", stroke: "var(--ink)", width: 6, round: "square" },
  entrance: { fill: "var(--success-tint)", stroke: "var(--success)", dash: "14 8", width: 4, round: "square" },
  booth: { fill: "var(--info-tint)", stroke: "var(--info)", width: 3, round: "soft" },
  other: { fill: "var(--sunken)", stroke: "var(--control)", dash: "4 6", width: 3, round: "square" },
};

export const fontFor = (roomW: number) => Math.max(14, Math.min(40, roomW / 45));
/** Fit a label into a box of width `w` (cm): roughly 0.55 em per character. */
export const fitLabel = (label: string, w: number, font: number) => {
  const max = Math.max(1, Math.floor(w / (font * 0.55)));
  return label.length <= max ? label : `${label.slice(0, Math.max(1, max - 1))}…`;
};

export const legend = [
  ["table", "Table"],
  ["stage", "Stage"],
  ["entrance", "Entrance"],
  ["booth", "Booth"],
  ["other", "Other"],
] as const;

/** Static, non-interactive plan of the venue. Used in the printable summary and as the read-only view. */
export function LayoutSvg({
  room,
  items,
  className = "",
  label,
}: {
  room: { w: number; d: number };
  items: Pick<LayoutItemRow, "id" | "kind" | "label" | "x_cm" | "y_cm" | "w_cm" | "h_cm">[];
  className?: string;
  label: string;
}) {
  const font = fontFor(room.w);
  const grid: number[] = [];
  for (let x = 100; x < room.w; x += 100) grid.push(x);
  const gridY: number[] = [];
  for (let y = 100; y < room.d; y += 100) gridY.push(y);
  return (
    <svg viewBox={`0 0 ${room.w} ${room.d}`} role="img" aria-label={label} className={`block h-auto w-full max-w-full ${className}`} style={{ aspectRatio: `${room.w} / ${room.d}` }}>
      <rect x={0} y={0} width={room.w} height={room.d} fill="var(--surface)" stroke="var(--ink)" strokeWidth={6} />
      {grid.map((x) => <line key={`gx${x}`} x1={x} y1={0} x2={x} y2={room.d} stroke="var(--rule)" strokeWidth={1.5} />)}
      {gridY.map((y) => <line key={`gy${y}`} x1={0} y1={y} x2={room.w} y2={y} stroke="var(--rule)" strokeWidth={1.5} />)}
      {items.map((it) => {
        const s = KIND_STYLE[it.kind] ?? KIND_STYLE.other;
        const rx = s.round === "ellipse" ? Math.min(it.w_cm, it.h_cm) / 2 : s.round === "soft" ? Math.min(it.w_cm, it.h_cm) * 0.12 : 0;
        return (
          <g key={it.id}>
            <title>{`${it.label || it.kind} (${it.kind})`}</title>
            <rect x={it.x_cm} y={it.y_cm} width={it.w_cm} height={it.h_cm} rx={rx} fill={s.fill} stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash} />
            <text x={it.x_cm + it.w_cm / 2} y={it.y_cm + it.h_cm / 2} textAnchor="middle" dominantBaseline="central" fontSize={font} fill="var(--ink)" fontWeight={600}>
              {fitLabel(it.label || it.kind, it.w_cm, font)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function LayoutLegend() {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Legend">
      {legend.map(([k, l]) => {
        const s = KIND_STYLE[k];
        return (
          <li key={k} className="flex items-center gap-1.5">
            <svg width="22" height="14" aria-hidden>
              <rect x="1.5" y="1.5" width="19" height="11" rx={s.round === "ellipse" ? 5.5 : s.round === "soft" ? 2 : 0} fill={s.fill} stroke={s.stroke} strokeWidth="1.5" strokeDasharray={s.dash ? "4 2" : undefined} />
            </svg>
            {l}
          </li>
        );
      })}
    </ul>
  );
}
