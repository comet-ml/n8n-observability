# n8n-observability

This package provides OpenTelemetry instrumentation for n8n workflows.  
It automatically traces workflow executions and individual node operations using the standard OpenTelemetry SDK.

## Features

- 🔍 **Automatic tracing** of workflow executions and node operations
- 📊 **Standard OpenTelemetry** instrumentation using the official Node.js SDK
- 🎯 **Zero-code setup** via n8n's hook system
- 🔌 **OTLP compatible** - works with any OpenTelemetry-compatible backend (Opik, Jaeger, Grafana Tempo, etc.)
- ⚙️ **Configurable** via environment variables
- 🦜 **LangChain instrumentation** - automatic tracing of LangChain operations using [Arize AI's OpenInference](https://arize-ai.github.io/openinference/js/packages/openinference-instrumentation-langchain/)

---

## Installation

```bash
npm install n8n-observability
# or
pnpm add n8n-observability
```

---

## Usage

### Option 1: Via n8n Hooks (Recommended)

Set the `EXTERNAL_HOOK_FILES` environment variable to load the hooks automatically:

```bash
export EXTERNAL_HOOK_FILES="/path/to/node_modules/n8n-observability/dist/hooks.cjs"
n8n start
```

### Option 2: Programmatic Setup

```typescript
import { setupN8nObservability } from 'n8n-observability';

await setupN8nObservability({
  serviceName: 'my-n8n-instance',
  debug: true
});
```

---

## Configuration

Configure via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `OTEL_SERVICE_NAME` | Service name for OpenTelemetry | `n8n` |
| `N8N_OTEL_SERVICE_NAME` | Alternative service name (takes precedence) | - |
| `N8N_OTEL_DEBUG` | Enable debug logging | `false` |
| `N8N_OTEL_CAPTURE_INPUT` | Capture node inputs/outputs | `true` |
| `N8N_OTEL_AUTO_INSTRUMENT` | Enable auto-instrumentation for HTTP, Express, etc. | `false` |
| `N8N_OTEL_METRICS` | Enable metrics collection (CPU, memory, etc.) | `false` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP exporter endpoint | - |

### Controlling Output Volume

**By default**, n8n-observability only emits **n8n workflow and node spans**. This keeps output clean and focused.

If you want more detailed instrumentation:
```bash
# Enable HTTP, Express, and other low-level instrumentation
export N8N_OTEL_AUTO_INSTRUMENT=true

# Enable metrics (CPU, memory, etc.)
export N8N_OTEL_METRICS=true
```

⚠️ **Note**: Auto-instrumentation creates many low-level spans (HTTP requests, Express routes, etc.). Only enable if you need that level of detail.

### Configuring the Exporter

By default, the package uses console exporters for development. To send data to a real backend, you'll need to modify the `otel-setup.ts` file to use OTLP exporters:

```typescript
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';

// Replace ConsoleSpanExporter with:
traceExporter: new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
}),

// Replace ConsoleMetricExporter with:
metricReader: new PeriodicExportingMetricReader({
  exporter: new OTLPMetricExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/metrics',
  }),
}),
```

---

## Development

### Prerequisites
- Node.js ≥ 18
- pnpm ≥ 8

### Build

```bash
pnpm install
pnpm build
```

Build artifacts include:
- `dist/hooks.cjs` → CommonJS entry for `EXTERNAL_HOOK_FILES` (recommended)
- `dist/index.cjs` → CommonJS programmatic API

### TypeScript

```bash
pnpm typecheck
```

---

## How it Works

### Initialization

1. **OpenTelemetry SDK Setup** (`setupObservability`) → Initializes the Node.js OpenTelemetry SDK with:
   - Auto-instrumentation for common Node.js libraries (HTTP, Express, etc.)
   - Console exporters (can be replaced with OTLP exporters)
   - Service name and resource attributes

2. **n8n Patching** → Locates the active `n8n-core` instance and patches:
   - `WorkflowExecute.processRunExecutionData` → workflow execution span
   - `WorkflowExecute.processRunData` → workflow data processing span
   - `WorkflowExecute.runNode` → per-node execution span

3. **Idempotent Patching** → Uses `WeakSet` to ensure methods are patched only once

### Span Model

#### Workflow Spans
- **Name**: `n8n.workflow.execute.*`
- **Attributes**:
  - `n8n.workflow.id`: Workflow ID
  - `n8n.workflow.name`: Workflow name
  - `n8n.workflow.mode`: Execution mode
- **Events**: Errors recorded as exception events

#### Node Spans
- **Name**: `n8n.node.execute`
- **Attributes**:
  - `n8n.node.type`: Node type (e.g., `n8n-nodes-base.httpRequest`)
  - `n8n.node.name`: Node name
  - `n8n.node.index`: Node index in workflow
  - `n8n.node.input`: JSON representation of inputs (if enabled)
  - `n8n.node.output`: JSON representation of outputs (if enabled)
- **Events**: Errors recorded as exception events

### Privacy & Security

Node inputs/outputs are captured from `INodeExecutionData.json` by default.

**To disable capture:**
```bash
export N8N_OTEL_CAPTURE_INPUT=false
```

Consider using OpenTelemetry's attribute processors or filtering at the collector level for sensitive data redaction.

---

## Troubleshooting

### No n8n-core patched
- Enable debug mode: `N8N_OTEL_DEBUG=1`
- Verify `EXTERNAL_HOOK_FILES` points to the correct path
- Check logs for "observability ready and patches applied"

### setupObservability failed
- Check the console for error messages
- Verify OpenTelemetry dependencies are installed
- Ensure the OTLP endpoint is accessible (if using OTLP exporters)

### No spans visible
- Check that workflows are being executed
- Verify the exporter configuration is correct
- Look for the startup log: `[n8n-observability] observability ready and patches applied`
- Enable debug logging to see diagnostic information

### No LangChain spans visible

If you're not seeing LangChain-specific spans (chains, agents, tools):

1. **Enable debug logging** to see instrumentation status:
   ```bash
   export N8N_OTEL_DEBUG=1
   ```
   
2. **Check for success message**: You should see:
   ```
   [otel-setup] LangChain instrumented successfully from: /path/to/@langchain/core/callbacks/manager.cjs
   ```

3. **If you see "module not found"**: Your n8n installation doesn't have LangChain nodes installed. Install them:
   ```bash
   npm install @n8n/n8n-nodes-langchain
   ```

4. **Verify your workflow actually uses LangChain nodes**: Add a ChatOpenAI, Agent, or Chain node to your workflow

**How it works**: LangChain instrumentation uses [Arize AI's OpenInference](https://arize-ai.github.io/openinference/js/packages/openinference-instrumentation-langchain/) manual instrumentation approach. No special setup required - it automatically instruments LangChain when n8n starts with the hooks file.

### Warning: "could not deserialize response"
If you see this warning:
```
OTLPExportDelegate Export succeeded but could not deserialize response
SyntaxError: Unexpected end of JSON input
```

This is **harmless** and means:
- The spans were successfully exported (note "Export succeeded")
- Your backend returned an empty 200 response instead of JSON
- This is common with some OTLP implementations (including Opik)
- The traces are still being stored correctly

You can verify this by checking your backend logs or UI for the traces.

### TypeScript errors
- Run `pnpm install` to ensure all dependencies are installed
- Make sure `@types/node` is installed in dev dependencies

---

## Examples

### Docker Compose with Jaeger

```yaml
version: '3.8'
services:
  n8n:
    image: n8nio/n8n
    environment:
      - EXTERNAL_HOOK_FILES=/data/node_modules/n8n-observability/dist/hooks.cjs
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
      - N8N_OTEL_DEBUG=1
    volumes:
      - ./n8n-data:/data
  
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # Jaeger UI
      - "4318:4318"    # OTLP HTTP
```

---

## License

MIT. View the [LICENSE](../../LICENSE) file for details.

---

## Related Projects

- [OpenTelemetry JavaScript](https://github.com/open-telemetry/opentelemetry-js)
- [n8n](https://github.com/n8n-io/n8n)
- [OpenTelemetry Collector](https://github.com/open-telemetry/opentelemetry-collector)
