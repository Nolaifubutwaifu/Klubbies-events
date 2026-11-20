/**
 * Signs in one load test guest and loads one page, to count the database
 * calls behind it: reset pg_stat_statements, run this, then list the
 * public.* queries (docs/hardening.md).
 *
 *   KBLT_SECRETS=/scratchpad/lt-secrets.json node scripts/one-page.mjs /e/load_test_nov18/a/<album id>
 *
 * Optional: KBLT_BASE (default production), KBLT_EMAIL (default loadtest-001),
 * KBLT_EVENT (default load_test_nov18).
 */
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path?.startsWith("/")) throw new Error("Give a path, e.g. /e/load_test_nov18");
const { password } = JSON.parse(readFileSync(process.env.KBLT_SECRETS ?? "", "utf8"));
const BASE = process.env.KBLT_BASE ?? "https://events.klubbies.app";
const EVENT = process.env.KBLT_EVENT ?? "load_test_nov18";
if (!EVENT.startsWith("load_test")) throw new Error("KBLT_EVENT must start with load_test");

const jar = new Map();
const keep = (res) => {
  for (const c of res.headers.getSetCookie()) {
    const [kv] = c.split(";");
    const i = kv.indexOf("=");
    jar.set(kv.slice(0, i), kv.slice(i + 1));
  }
};

let res = await fetch(`${BASE}/api/auth/password_signin`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: process.env.KBLT_EMAIL ?? "loadtest-001@klubbies.app", password, event: EVENT }),
});
keep(res);
if (!res.ok) throw new Error(`sign in ${res.status}: ${await res.text()}`);

const t = Date.now();
res = await fetch(`${BASE}${path}`, { headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") }, redirect: "manual" });
const html = await res.text();
console.log(`${path}: ${res.status} in ${Date.now() - t} ms, ${Math.round(html.length / 1024)} KB`);
