// Static checks for phase 7: whom the server acts for, and where the secret key may appear.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

const root = fileURLToPath(new URL("../src", import.meta.url));
const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = `${dir}/${n}`;
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const files = walk(root).filter((f) => /\.(ts|tsx)$/.test(f));
const read = (f) => readFileSync(f, "utf8");
const actions = `${root}/app/w/[ws]/upgrade/actions.ts`;

describe("the sandbox actions", () => {
  test("take the actor from the verified session, never from the submitted form", () => {
    const src = read(actions);
    assert.equal((src.match(/const user = await requireUser\(/g) ?? []).length, 2); // checkout and end
    assert.equal((src.match(/actor: user\.id/g) ?? []).length, 2);
    assert.doesNotMatch(src, /fd\.get\(["'](actor|user)/);
    assert.doesNotMatch(src, /field\(fd, ["'](actor|user)/);
    const page = read(`${root}/app/w/[ws]/upgrade/sandbox/page.tsx`);
    assert.doesNotMatch(page, /name="(actor|user)"/);
  });
  test("check the sandbox switch before touching the database, and refuse without the secret key", () => {
    const src = read(actions);
    for (const fn of ["completeCheckout", "endOrganiser"]) {
      const body = src.slice(src.indexOf(`export async function ${fn}`));
      assert.ok(body.indexOf("sandboxEnabled()") > -1 && body.indexOf("sandboxEnabled()") < body.indexOf("adminClient()"), `${fn}: switch must come first`);
      assert.ok(body.indexOf("adminClient()") < body.indexOf(".rpc("), `${fn}: client before rpc`);
    }
    assert.match(src, /if \(!admin\) return done\(ws, "unavailable"\)/);
  });
});

describe("the secret key", () => {
  test("the admin client is imported only by server-action files", () => {
    const importers = files.filter((f) => /supabase\/admin"/.test(read(f)));
    assert.ok(importers.length >= 2, "expected the settings and upgrade actions");
    for (const f of importers) {
      assert.match(f, /actions\.ts$/, `${f} is not an actions file`);
      assert.match(read(f), /^"use server";/m, `${f} must be a "use server" file`);
    }
  });
  test("no client file mentions it, and no NEXT_PUBLIC variable carries it", () => {
    for (const f of files) {
      const src = read(f);
      if (/^"use client";/m.test(src)) assert.doesNotMatch(src, /SECRET_KEY|SERVICE_ROLE|supabase\/admin/, `${f} is a client file`);
      assert.doesNotMatch(src, /NEXT_PUBLIC_[A-Z_]*(SECRET|SERVICE_ROLE)/, `${f} exposes a secret through NEXT_PUBLIC_`);
    }
    assert.doesNotMatch(readFileSync(fileURLToPath(new URL("../.env.example", import.meta.url)), "utf8"), /NEXT_PUBLIC_[A-Z_]*(SECRET|SERVICE_ROLE)/);
  });
});
