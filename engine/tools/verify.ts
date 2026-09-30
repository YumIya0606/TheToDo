export {};

const B = "http://localhost:5178/api";
const j = async (p: string, init?: RequestInit) => {
  const r = await fetch(`${B}${p}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const line = (label: string, ok: boolean, extra = "") =>
  console.log(`${ok ? "PASS" : "FAIL"}  ${label.padEnd(42)} ${extra}`);

const health = await j("/health");
line("health", health.body?.ok === true);

const state = await j("/state");
line("state: 6 channels seeded", state.body?.channels?.length === 6, `${state.body?.channels?.length}`);
line("state: providers registered", (state.body?.providers?.length ?? 0) >= 7, `${state.body?.providers?.length}`);
line("state: advice + aiStats present", "advice" in (state.body ?? {}) && "aiStats" in (state.body ?? {}));
line("state: colombo clock", /^\d{4}-\d{2}-\d{2}$/.test(state.body?.now?.date ?? ""), state.body?.now?.label);

const dash = await j("/dashboard");
const st = dash.body?.stats;
line("dashboard: messages stored", (st?.messages ?? 0) > 0, `${st?.messages}`);
line("dashboard: links extracted", (st?.links ?? 0) > 0, `${st?.links}`);

const msgs = await j("/messages?limit=5");
line("messages: paginated list", Array.isArray(msgs.body?.messages));
const withSinhala = (msgs.body?.messages ?? []).filter((m: any) => /[\u0D80-\u0DFF]/.test(m.text));
line("messages: Sinhala preserved", withSinhala.length > 0, `${withSinhala.length}/${msgs.body?.messages?.length}`);

const zoom = await j("/links?kind=zoom");
line("links: zoom filter", Array.isArray(zoom.body), `${zoom.body?.length} zoom`);
const yt = await j("/links?kind=youtube");
line("links: youtube filter", Array.isArray(yt.body), `${yt.body?.length} youtube`);

const evs = await j("/events?limit=5");
line("events: list responds", Array.isArray(evs.body));

const tasks = await j("/tasks");
line("tasks: list responds", Array.isArray(tasks.body));

const models = await j("/models?provider=kiloFree");
line("models: kilo index (no key)", (models.body?.models?.length ?? 0) > 100, `${models.body?.models?.length} models`);

const testAi = await j("/test-ai", { method: "POST", body: JSON.stringify({ provider: "openrouter" }) });
// Either outcome is correct depending on whether a usable key is saved: a
// clean "no key yet" message, or a provider error surfaced as text.
line(
  "test-ai: reports status cleanly",
  testAi.status === 200 && typeof testAi.body?.ok === "boolean",
  String(testAi.body?.error ?? "reachable").slice(0, 60),
);

const chan = state.body?.channels?.[0];
const ch = await j(`/channels/${chan.id}`, { method: "PATCH", body: JSON.stringify({ enabled: true }) });
line("channels: toggle enabled", ch.status === 200);
await j(`/channels/${chan.id}`, { method: "PATCH", body: JSON.stringify({ enabled: 1 }) });

const login = await j("/telegram/login/state");
line("telegram: login state (unconfigured)", login.status === 200, JSON.stringify(login.body));

const home = await fetch("http://localhost:5178/");
const html = await home.text();
line("spa: index served", home.status === 200 && html.includes("<div id=\"root\">"));
const spa = await fetch("http://localhost:5178/settings");
line("spa: client route served", spa.status === 200);
