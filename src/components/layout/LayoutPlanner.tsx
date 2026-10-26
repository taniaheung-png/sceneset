"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { type LayoutFormState, saveLayout } from "@/app/w/[ws]/events/[ev]/layout/actions";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { type Box, KINDS, boxProblem, clampBox, cmToMetres, kindLabel, metresToCm, moveBy, newBox, resizeBy, type Kind } from "@/lib/layout";
import { KIND_STYLE, LayoutLegend, fitLabel, fontFor } from "./LayoutSvg";

export type PlannerItem = { key: string; id?: string; version?: string; kind: string; label: string; x: number; y: number; w: number; h: number };

const box = (i: PlannerItem): Box => ({ x: i.x, y: i.y, w: i.w, h: i.h });
const m = (cm: number) => cmToMetres(cm);
const describe = (i: PlannerItem) => `${i.label || kindLabel(i.kind)}: ${kindLabel(i.kind).toLowerCase()}, x ${m(i.x)} m, y ${m(i.y)} m, ${m(i.w)} by ${m(i.h)} m`;

/**
 * Edits are kept as a draft in this component and saved together with "Save layout" (one transaction on the server).
 * Three equal ways to edit: pointer drag, keyboard (arrows move, Ctrl+arrows resize, Shift = bigger steps, Delete removes),
 * and the numeric form. All three go through clampBox, so nothing can leave the venue.
 */
export function LayoutPlanner({
  ws,
  ev,
  room,
  venueName,
  initial,
}: {
  ws: string;
  ev: string;
  room: { w: number; d: number };
  venueName: string;
  initial: PlannerItem[];
}) {
  const [items, setItems] = useState<PlannerItem[]>(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const [numError, setNumError] = useState("");
  const [state, action] = useActionState(saveLayout, {} as LayoutFormState);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ key: string; sx: number; sy: number; ox: number; oy: number; scale: number } | null>(null);
  const seq = useRef(0);
  const font = fontFor(room.w);

  const strip = (list: PlannerItem[]) => JSON.stringify(list.map((i) => [i.id, i.version, i.kind, i.label, i.x, i.y, i.w, i.h]));
  const dirty = strip(items) !== strip(initial);
  const sel = items.find((i) => i.key === selected) ?? null;

  const payload = JSON.stringify({
    upserts: items
      .filter((it) => {
        const o = initial.find((x) => x.id === it.id);
        return !it.id || !o || o.x !== it.x || o.y !== it.y || o.w !== it.w || o.h !== it.h || o.kind !== it.kind || o.label !== it.label;
      })
      .map((it) => ({ id: it.id, version: it.version, kind: it.kind, label: it.label, x: it.x, y: it.y, w: it.w, h: it.h })),
    deletes: initial.filter((o) => !items.some((it) => it.key === o.key)).map((o) => o.id),
  });

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const patch = (key: string, p: Partial<PlannerItem>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i)));
  const place = (it: PlannerItem, b: Box, say = true) => {
    patch(it.key, b);
    if (say) setLive(describe({ ...it, ...b }));
  };

  function onKey(e: React.KeyboardEvent<SVGGElement>, it: PlannerItem) {
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const d = dirs[e.key];
    if (d) {
      e.preventDefault();
      const step = e.shiftKey ? 100 : 10;
      const resize = e.ctrlKey || e.metaKey;
      const next = (resize ? resizeBy : moveBy)(box(it), d[0] * step, d[1] * step, room);
      if (next.x === it.x && next.y === it.y && next.w === it.w && next.h === it.h) setLive("At the edge of the venue.");
      else place(it, next);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      remove(it);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelected(it.key);
      setLive(describe(it));
    }
  }

  function remove(it: PlannerItem) {
    setItems((list) => list.filter((i) => i.key !== it.key));
    setSelected(null);
    setLive(`${it.label || kindLabel(it.kind)} removed. It is deleted when you save.`);
  }

  function down(e: React.PointerEvent<SVGGElement>, it: PlannerItem) {
    setSelected(it.key);
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { key: it.key, sx: e.clientX, sy: e.clientY, ox: it.x, oy: it.y, scale: ctm.a };
  }
  function move(e: React.PointerEvent<SVGGElement>, it: PlannerItem) {
    const g = drag.current;
    if (!g || g.key !== it.key) return;
    place(it, clampBox({ ...box(it), x: g.ox + (e.clientX - g.sx) / g.scale, y: g.oy + (e.clientY - g.sy) / g.scale }, room), false);
  }
  function up(it: PlannerItem) {
    if (drag.current?.key === it.key) setLive(describe(items.find((i) => i.key === it.key) ?? it));
    drag.current = null;
  }

  function addObject(fd: FormData) {
    const kind = String(fd.get("kind") ?? "table") as Kind;
    const label = String(fd.get("label") ?? "").trim().slice(0, 60);
    seq.current += 1;
    const it: PlannerItem = { key: `new-${seq.current}`, kind, label, ...newBox(kind, room) };
    setItems((l) => [...l, it]);
    setSelected(it.key);
    setLive(`${describe(it)} added. It is saved when you save the layout.`);
  }

  function applyNumbers(fd: FormData, it: PlannerItem) {
    const [x, y, w, h] = ["x", "y", "w", "h"].map((k) => metresToCm(String(fd.get(k) ?? "")));
    if ([x, y, w, h].some((v) => v === null)) return setNumError("Enter each position and size in metres, like 2.5 (no negatives, at most 2 decimals).");
    const b = { x: x!, y: y!, w: w!, h: h! };
    const problem = boxProblem(b, room);
    if (problem) return setNumError(problem);
    setNumError("");
    const kind = String(fd.get("kind") ?? it.kind);
    patch(it.key, { ...b, kind, label: String(fd.get("label") ?? "").trim().slice(0, 60) });
    setLive(`${describe({ ...it, ...b, kind })} applied.`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <div>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${room.w} ${room.d}`}
            className="block h-auto w-full max-w-full touch-none rounded-md border border-control bg-surface"
            style={{ aspectRatio: `${room.w} / ${room.d}` }}
            role="group"
            aria-label={`Layout of ${venueName}, ${m(room.w)} by ${m(room.d)} metres. ${items.length} objects. Focus an object, then use the arrow keys to move it.`}
          >
            <rect x={0} y={0} width={room.w} height={room.d} fill="var(--surface)" stroke="var(--ink)" strokeWidth={6} />
            {Array.from({ length: Math.floor((room.w - 1) / 100) }, (_, i) => <line key={`x${i}`} x1={(i + 1) * 100} y1={0} x2={(i + 1) * 100} y2={room.d} stroke="var(--rule)" strokeWidth={1.5} />)}
            {Array.from({ length: Math.floor((room.d - 1) / 100) }, (_, i) => <line key={`y${i}`} x1={0} y1={(i + 1) * 100} x2={room.w} y2={(i + 1) * 100} stroke="var(--rule)" strokeWidth={1.5} />)}
            {items.map((it) => {
              const s = KIND_STYLE[it.kind] ?? KIND_STYLE.other;
              const rx = s.round === "ellipse" ? Math.min(it.w, it.h) / 2 : s.round === "soft" ? Math.min(it.w, it.h) * 0.12 : 0;
              const on = it.key === selected;
              return (
                <g
                  key={it.key}
                  role="button"
                  tabIndex={0}
                  aria-pressed={on}
                  aria-label={describe(it)}
                  data-object={it.label || it.kind}
                  className="cursor-grab outline-none"
                  onFocus={() => setSelected(it.key)}
                  onKeyDown={(e) => onKey(e, it)}
                  onPointerDown={(e) => down(e, it)}
                  onPointerMove={(e) => move(e, it)}
                  onPointerUp={() => up(it)}
                  onPointerCancel={() => up(it)}
                >
                  <rect x={it.x} y={it.y} width={it.w} height={it.h} rx={rx} fill={s.fill} stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash} />
                  <text x={it.x + it.w / 2} y={it.y + it.h / 2} textAnchor="middle" dominantBaseline="central" fontSize={font} fill="var(--ink)" fontWeight={600} pointerEvents="none">
                    {fitLabel(it.label || it.kind, it.w, font)}
                  </text>
                  {on && <rect x={it.x - 8} y={it.y - 8} width={it.w + 16} height={it.h + 16} rx={rx + 8} fill="none" stroke="var(--primary)" strokeWidth={6} strokeDasharray="18 10" pointerEvents="none" />}
                </g>
              );
            })}
          </svg>
          <LayoutLegend />
          <p className="mt-2 text-xs text-ink-2">
            Drag an object, or focus it and use the arrow keys (10 cm; hold Shift for 1 m). Hold Ctrl with the arrows to resize. Delete removes it.
            You can also type exact numbers in the form. Objects always stay inside the venue.
          </p>
          <p className="sr-only" role="status" aria-live="polite" data-live>{live}</p>
        </div>

        <div className="flex flex-col gap-4">
          <section aria-labelledby="sel-h" className="panel p-4">
            <h3 id="sel-h" className="font-bold">{sel ? `Selected: ${sel.label || kindLabel(sel.kind)}` : "No object selected"}</h3>
            {sel ? (
              <form
                key={`${sel.key}:${sel.x},${sel.y},${sel.w},${sel.h}:${sel.kind}:${sel.label}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  applyNumbers(new FormData(e.currentTarget), sel);
                }}
                className="mt-3 flex flex-col gap-3"
                aria-label="Exact position and size"
                noValidate
              >
                <TextField name="label" label="Label" defaultValue={sel.label} maxLength={60} />
                <SelectField name="kind" label="Kind" defaultValue={sel.kind}>
                  {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </SelectField>
                <div className="grid grid-cols-2 gap-3">
                  <TextField name="x" inputMode="decimal" label="X, from left (m)" defaultValue={m(sel.x)} />
                  <TextField name="y" inputMode="decimal" label="Y, from top (m)" defaultValue={m(sel.y)} />
                  <TextField name="w" inputMode="decimal" label="Width (m)" defaultValue={m(sel.w)} />
                  <TextField name="h" inputMode="decimal" label="Depth (m)" defaultValue={m(sel.h)} />
                </div>
                {numError && <p role="alert" className="text-sm font-medium text-danger">{numError}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit">Apply</Button>
                  <Button type="button" variant="secondary" onClick={() => remove(sel)}>Remove object</Button>
                </div>
              </form>
            ) : (
              <p className="mt-2 text-sm text-ink-2">Select an object in the plan or in the list to edit it.</p>
            )}
          </section>

          <form
            action={(fd) => addObject(fd)}
            className="flex flex-col gap-3 panel p-4"
            aria-label="Add an object"
          >
            <h3 className="font-bold">Add an object</h3>
            <SelectField name="kind" label="Kind" defaultValue="table">
              {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </SelectField>
            <TextField name="label" label="Label" hint="e.g. Table 4, Main stage" maxLength={60} />
            <div><Button type="submit" variant="secondary">Add to the plan</Button></div>
          </form>
        </div>
      </div>

      <form action={action} className="flex flex-wrap items-center gap-3 panel p-4" aria-label="Save the layout">
        <input type="hidden" name="ws" value={ws} />
        <input type="hidden" name="ev" value={ev} />
        <input type="hidden" name="payload" value={payload} />
        <SubmitButton pendingText="Saving…">Save layout</SubmitButton>
        <Button type="button" variant="secondary" disabled={!dirty} onClick={() => { setItems(initial); setSelected(null); setNumError(""); setLive("Changes reverted."); }}>Revert changes</Button>
        <span role="status" className={`text-sm ${dirty ? "font-semibold text-warn-ink" : "text-ink-2"}`} data-dirty={dirty}>
          {dirty ? "You have unsaved changes." : "All changes are saved."}
        </span>
        {state.error && <p role="alert" className="w-full rounded-md bg-danger-tint p-3 text-sm font-medium text-danger">{state.error}</p>}
      </form>

      <section aria-labelledby="objs-h" className="overflow-x-auto panel">
        <h3 id="objs-h" className="px-4 pt-4 font-bold">Objects ({items.length})</h3>
        {items.length === 0 ? (
          <p className="px-4 pb-4 pt-2 text-sm text-ink-2">Nothing is placed yet. Add a table, stage, entrance or booth.</p>
        ) : (
          <table className="mt-2 w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Objects in the layout, with positions and sizes in metres</caption>
            <thead>
              <tr>
                <th scope="col" className="px-3 py-2">Object</th>
                <th scope="col" className="px-3 py-2">Kind</th>
                <th scope="col" className="num px-3 py-2 text-right">X</th>
                <th scope="col" className="num px-3 py-2 text-right">Y</th>
                <th scope="col" className="num px-3 py-2 text-right">Width</th>
                <th scope="col" className="num px-3 py-2 text-right">Depth</th>
                <th scope="col" className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.key} className="border-t border-rule" data-row={it.label || it.kind}>
                  <th scope="row" className="px-3 py-2 font-semibold">{it.label || kindLabel(it.kind)}{!it.id && <span className="ml-2 text-xs font-normal text-info">new, unsaved</span>}</th>
                  <td className="px-3 py-2">{kindLabel(it.kind)}</td>
                  <td className="num px-3 py-2 text-right">{m(it.x)}</td>
                  <td className="num px-3 py-2 text-right">{m(it.y)}</td>
                  <td className="num px-3 py-2 text-right">{m(it.w)}</td>
                  <td className="num px-3 py-2 text-right">{m(it.h)}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button type="button" variant="secondary" aria-pressed={it.key === selected} aria-label={`Select ${it.label || kindLabel(it.kind)}`} onClick={() => setSelected(it.key)}>Select</Button>
                      <Button type="button" variant="secondary" aria-label={`Remove ${it.label || kindLabel(it.kind)}`} onClick={() => remove(it)}>Remove</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="px-4 pb-4 pt-2 text-xs text-ink-2">Sizes and positions are in metres. Removed objects are deleted when you press Save layout.</p>
      </section>
    </div>
  );
}
