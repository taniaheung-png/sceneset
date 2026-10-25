import { useId } from "react";
import type { ComponentProps, ReactNode } from "react";

type Common = { label: string; hint?: string; error?: string };

const control =
  "min-h-11 w-full rounded-md border bg-surface px-3 text-base text-ink placeholder:text-ink-2 disabled:bg-sunken";

function Wrap({ id, label, hint, error, children }: Common & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-ink-2">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const describe = (id: string, { hint, error }: Common) => (error ? `${id}-err` : hint ? `${id}-hint` : undefined);

export function TextField({ label, hint, error, ...props }: Common & ComponentProps<"input">) {
  const id = useId();
  return (
    <Wrap id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe(id, { label, hint, error })}
        className={`${control} ${error ? "border-danger" : "border-control"}`}
        {...props}
      />
    </Wrap>
  );
}

export function TextAreaField({ label, hint, error, ...props }: Common & ComponentProps<"textarea">) {
  const id = useId();
  return (
    <Wrap id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe(id, { label, hint, error })}
        className={`${control} py-2 ${error ? "border-danger" : "border-control"}`}
        {...props}
      />
    </Wrap>
  );
}

export function SelectField({ label, hint, error, children, ...props }: Common & ComponentProps<"select">) {
  const id = useId();
  return (
    <Wrap id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe(id, { label, hint, error })}
        className={`${control} ${error ? "border-danger" : "border-control"}`}
        {...props}
      >
        {children}
      </select>
    </Wrap>
  );
}
