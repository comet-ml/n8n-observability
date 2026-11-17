// Unit tests for the span masking (N8N_OTEL_REDACT_KEYS). Run after `pnpm build`: pnpm run test:unit
// Every value below is fake.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { redact, redactKeys, REDACTED } = require("../../dist/index.cjs");

beforeEach(() => {
  delete process.env.N8N_OTEL_REDACT_KEYS;
});

test("default list masks auth headers and cookies, case-insensitively", () => {
  const out = redact({ headers: { Authorization: "Bearer fake-1", cookie: "s=fake-2", "X-Api-Key": "fake-3" } });
  assert.deepEqual(out, { headers: { Authorization: REDACTED, cookie: REDACTED, "X-Api-Key": REDACTED } });
});

test("a key that is not listed stays visible (the control)", () => {
  const out = redact({ headers: { "x-custom": "visible", host: "example.test" } });
  assert.deepEqual(out, { headers: { "x-custom": "visible", host: "example.test" } });
});

test("matching is by exact key name, not substring", () => {
  const out = redact({ keyboard: "azerty", authorizationHint: "visible", cookie: "fake" });
  assert.deepEqual(out, { keyboard: "azerty", authorizationHint: "visible", cookie: REDACTED });
});

test("masks at any depth and inside arrays", () => {
  const out = redact([{ a: { b: [{ authorization: "fake" }] } }]);
  assert.deepEqual(out, [{ a: { b: [{ authorization: REDACTED }] } }]);
});

test("an n8n { name, value } pair is masked by its name", () => {
  const params = { headerParameters: { parameters: [
    { name: "X-Api-Key", value: "fake-param" },
    { name: "Accept", value: "application/json" },
  ] } };
  const out = redact(params);
  assert.equal(out.headerParameters.parameters[0].value, REDACTED);
  assert.equal(out.headerParameters.parameters[0].name, "X-Api-Key");
  assert.equal(out.headerParameters.parameters[1].value, "application/json");
});

test("an object shared by two branches is masked in both", () => {
  const shared = { authorization: "fake" };
  const out = redact({ first: shared, second: shared });
  assert.equal(out.first.authorization, REDACTED);
  assert.equal(out.second.authorization, REDACTED);
});

test("a cycle does not throw and is marked", () => {
  const o = { authorization: "fake" };
  o.self = o;
  const out = redact(o);
  assert.equal(out.authorization, REDACTED);
  assert.equal(out.self, "[Circular]");
});

test("the input is never mutated", () => {
  const input = { headers: { authorization: "fake" } };
  redact(input);
  assert.equal(input.headers.authorization, "fake");
});

test("non-object values pass through", () => {
  for (const v of [null, undefined, 0, "text", true]) assert.equal(redact(v), v);
});

test("N8N_OTEL_REDACT_KEYS replaces the default list", () => {
  process.env.N8N_OTEL_REDACT_KEYS = "host, webhookUrl";
  assert.deepEqual([...redactKeys()].sort(), ["host", "webhookurl"]);
  const out = redact({ host: "example.test", webhookUrl: "https://example.test/x", authorization: "now-visible" });
  assert.deepEqual(out, { host: REDACTED, webhookUrl: REDACTED, authorization: "now-visible" });
});

test("an empty N8N_OTEL_REDACT_KEYS turns masking off", () => {
  process.env.N8N_OTEL_REDACT_KEYS = "";
  const input = { authorization: "fake" };
  assert.equal(redact(input), input);
});
