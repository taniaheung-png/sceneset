"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/(site)/auth-actions";
import { TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

export type AuthField = {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
};

/** One form shell for sign-in, sign-up and password flows. Keeps typed values when the server rejects them. */
export function AuthForm({
  action,
  fields,
  submit,
  hidden,
  children,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  fields: AuthField[];
  submit: string;
  hidden?: Record<string, string>;
  children?: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);

  if (state.done) {
    return (
      <p role="status" className="rounded-md bg-success-tint p-4 text-success">
        {state.notice}
      </p>
    );
  }
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && (
        <p role="alert" className="rounded-md bg-danger-tint p-3 text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {fields.map((f) => (
        <TextField
          key={f.name}
          name={f.name}
          label={f.label}
          type={f.type ?? "text"}
          autoComplete={f.autoComplete}
          hint={f.hint}
          defaultValue={f.type === "password" ? undefined : state.values?.[f.name]}
          required
        />
      ))}
      <SubmitButton pendingText="Please wait…">{submit}</SubmitButton>
      {children}
    </form>
  );
}
