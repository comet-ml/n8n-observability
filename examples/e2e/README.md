# E2E Test

End-to-end test that validates the published `n8n-observability` npm package works correctly with n8n.

> **Developing locally?** Use [`../../tests/e2e/`](../../tests/e2e/) instead to test local changes.

## Run

```bash
# From repository root
pnpm e2e
```

Or manually:

```bash
cd examples/e2e
docker-compose up --build
```

## What it does

1. Installs `n8n-observability` from npm
2. Imports and executes a test workflow
3. Validates OpenTelemetry instrumentation is active

## Success output

```
[n8n-observability] observability ready and patches applied
[otel-setup] OpenTelemetry SDK initialized for service: n8n-e2e
```

## Using a real Opik API key

Update `docker-compose.yml`:

```yaml
OTEL_EXPORTER_OTLP_HEADERS: "Authorization=${OPIK_API_KEY},Comet-Workspace=default"
```

Then:

```bash
export OPIK_API_KEY=your_opik_api_key_here
docker-compose up --build
```

The workflow trace will appear in your [Opik dashboard](https://www.comet.com/opik) under Traces.
