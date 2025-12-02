# n8n-observability

> [!IMPORTANT]
> This package only works with **self-hosted n8n** installations. It is not compatible with n8n Cloud.

OpenTelemetry instrumentation for [n8n](https://n8n.io) workflows. Automatically traces workflow executions and node operations using the standard OpenTelemetry SDK.

![Observability Setup](https://raw.githubusercontent.com/comet-ml/n8n-observability/refs/heads/main/assets/opik_dashboard.png)

## Features

- 🔍 **Automatic tracing** of workflow executions and individual node operations
- 📊 **Standard OpenTelemetry** instrumentation using the official Node.js SDK
- 🎯 **Zero-code setup** via n8n's hook system
- 🔌 **OTLP compatible** - works with any OpenTelemetry-compatible backend
- ⚙️ **Configurable** I/O capture, node filtering, and more
- 🚀 Works with Docker or bare metal
- 💻 Node.js ≥ 18

---

## Quick Start (Docker)

The fastest way to get started is with Docker Compose:

```bash
# Clone and navigate to the example
git clone https://github.com/comet-ml/n8n-observability.git
cd n8n-observability/examples/docker-compose

# Set your Opik API key (get one free at https://www.comet.com/signup)
export OPIK_API_KEY=your_api_key_here

# Build and run
docker-compose up --build
```

Open http://localhost:5678, create a workflow, and see traces in your [Comet ML dashboard](https://www.comet.com)!

📖 See [`examples/docker-compose/`](./examples/docker-compose/) for full documentation.

---

## Setup Options

### Docker (Recommended)

Create a custom Dockerfile that installs the package globally:

```dockerfile
FROM n8nio/n8n:latest

USER root
RUN npm install -g n8n-observability

ENV EXTERNAL_HOOK_FILES=/usr/local/lib/node_modules/n8n-observability/dist/hooks.cjs

USER node
```

Then run with your OTLP configuration:

```yaml
# docker-compose.yml
services:
  n8n:
    build: .
    environment:
      # Comet ML / Opik
      OTEL_EXPORTER_OTLP_ENDPOINT: "https://www.comet.com/opik/api/v1/private/otel"
      OTEL_EXPORTER_OTLP_HEADERS: "Authorization=${OPIK_API_KEY},Comet-Workspace=default"
      N8N_OTEL_SERVICE_NAME: "my-n8n"
    volumes:
      - n8n_data:/home/node/.n8n
    ports:
      - "5678:5678"

volumes:
  n8n_data:
```

### Bare Metal / npm

```bash
# Install globally
npm install -g n8n-observability

# Configure OTLP endpoint (Comet ML example)
export OTEL_EXPORTER_OTLP_ENDPOINT=https://www.comet.com/opik/api/v1/private/otel
export OTEL_EXPORTER_OTLP_HEADERS='Authorization=<your-api-key>,Comet-Workspace=default'
export N8N_OTEL_SERVICE_NAME=my-n8n
export EXTERNAL_HOOK_FILES=$(npm root -g)/n8n-observability/dist/hooks.cjs

# Start n8n
n8n start
```

### Programmatic

```ts
import { setupN8nObservability } from 'n8n-observability';

await setupN8nObservability({
  serviceName: 'my-n8n',
  debug: true,
});

// Then start n8n as usual
```

---

## Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP exporter endpoint | — |
| `OTEL_EXPORTER_OTLP_HEADERS` | OTLP headers (e.g., auth tokens) | — |
| `N8N_OTEL_SERVICE_NAME` | Service name for telemetry | `n8n` |
| `N8N_OTEL_NODE_INCLUDE` | Only trace listed nodes (comma-separated) | — |
| `N8N_OTEL_NODE_EXCLUDE` | Exclude listed nodes (comma-separated) | — |
| `N8N_OTEL_CAPTURE_INPUT` | Capture node input data | `true` |
| `N8N_OTEL_CAPTURE_OUTPUT` | Capture node output data | `true` |
| `N8N_OTEL_AUTO_INSTRUMENT` | Enable HTTP/Express instrumentation | `false` |
| `N8N_OTEL_METRICS` | Enable metrics collection | `false` |
| `N8N_OTEL_DEBUG` | Enable debug logging | `false` |
| `EXTERNAL_HOOK_FILES` | Path to hooks.cjs (set automatically) | — |

### Node Filtering

```bash
# Only trace specific nodes
export N8N_OTEL_NODE_INCLUDE="OpenAI,HTTP Request"

# Exclude noisy nodes
export N8N_OTEL_NODE_EXCLUDE="Wait,Set"

# Disable I/O capture for privacy
export N8N_OTEL_CAPTURE_INPUT=false
export N8N_OTEL_CAPTURE_OUTPUT=false
```

---

## OTLP Backends

Works with **any OpenTelemetry-compatible backend**:

### Comet ML / Opik (Recommended)

```bash
# Cloud
export OTEL_EXPORTER_OTLP_ENDPOINT=https://www.comet.com/opik/api/v1/private/otel
export OTEL_EXPORTER_OTLP_HEADERS='Authorization=<your-api-key>,Comet-Workspace=default'

# Self-hosted Opik
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:5173/api/v1/private/otel
```

### Other Providers

```bash
# Jaeger
export OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318

# Grafana Tempo
export OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4318

# Honeycomb
export OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io
export OTEL_EXPORTER_OTLP_HEADERS='x-honeycomb-team=<api-key>'

# Generic OTLP collector
export OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
```

---

## Span Attributes

### Workflow Spans
- `n8n.workflow.id` - Workflow ID
- `n8n.workflow.name` - Workflow name
- `n8n.span.type` - `"workflow"`

### Node Spans
- `n8n.node.type` - Node type (e.g., `n8n-nodes-base.httpRequest`)
- `n8n.node.name` - Node name
- `n8n.span.type` - `"llm"`, `"prompt"`, `"evaluation"`, or undefined
- `n8n.node.input` - JSON input (if capture enabled)
- `n8n.node.output` - JSON output (if capture enabled)
- `gen_ai.system` - AI provider (e.g., `openai`, `anthropic`)
- `gen_ai.request.model` - Model name (e.g., `gpt-4`)

---

## Verify Installation

Check the package is installed:

```bash
node -e "console.log(require.resolve('n8n-observability/hooks'))"
```

Expected startup logs:

```
[otel-setup] OpenTelemetry initialized: my-n8n (OTLP export enabled, langchain (manual), n8n spans only)
[n8n-observability] observability ready and patches applied
```

---

## Examples

| Example | Description |
| --- | --- |
| [`examples/docker-compose/`](./examples/docker-compose/) | Production-ready Docker setup with Comet ML |

---

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run e2e tests
pnpm e2e
```

---

## License

MIT - See [LICENSE](./LICENSE) for details.

---

## Acknowledgments

> [!NOTE]
> This project is a fork of [LangWatch's n8n-observability](https://github.com/langwatch/n8n-observability). We're grateful for their excellent work in creating the original implementation. We've extended their code to work with **all OpenTelemetry providers**, making it a universal solution for n8n observability.
