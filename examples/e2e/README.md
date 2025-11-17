# E2E Test Example

This directory contains an end-to-end test setup that validates the n8n-observability package works correctly in a containerized environment.

## Purpose

This example:
- Builds and packages `n8n-observability` as a tarball
- Installs it into an n8n Docker container
- Imports and executes a simple test workflow
- Validates that OpenTelemetry instrumentation is active
- Sends traces to Comet ML (Opik)

## Files

- **`docker-compose.yml`**: Defines the n8n test container with Comet ML configuration
- **`entrypoint.sh`**: Shell script that installs the package, imports the workflow, and executes it
- **`workflow.json`**: A simple test workflow with a Function node

## Running the E2E Test

### Quick Run (from repository root)

```bash
pnpm e2e
```

This command (defined in the root `package.json`) will:
1. Build the n8n-observability package
2. Create a tarball
3. Build the Docker container
4. Run the workflow execution test
5. Validate the observability hooks are working

### Manual Run

If you want to run the e2e test manually:

```bash
# From repository root
cd examples/e2e

# Build and run
docker-compose up --build
```

## Configuration

The test is configured to send traces to Comet ML's Opik platform. The configuration is in `docker-compose.yml`:

```yaml
environment:
  OTEL_EXPORTER_OTLP_ENDPOINT: "https://www.comet.com/opik/api/v1/private/otel"
  OTEL_EXPORTER_OTLP_HEADERS: "Authorization=test_fake_key_123,Comet-Workspace=default"
  N8N_OTEL_SERVICE_NAME: "n8n-e2e"
  N8N_OTEL_DEBUG: "1"
```

### Using a Real Comet API Key

To send traces to your actual Comet ML account, update the `OTEL_EXPORTER_OTLP_HEADERS` in `docker-compose.yml`:

```yaml
OTEL_EXPORTER_OTLP_HEADERS: "Authorization=${COMET_API_KEY}"
```

Then run:

```bash
export COMET_API_KEY=your_comet_api_key_here
docker-compose up --build
```

## Test Workflow

The test workflow (`workflow.json`) demonstrates a production-ready AI assistant with quality checks:

### Workflow Steps

1. **Execute Workflow Trigger**: Initiates the workflow
2. **Parse Request**: Parses and validates the incoming user request
3. **Fetch Context Data**: Retrieves additional context via HTTP API call
4. **Format Prompt**: Constructs OpenAI-compatible chat messages with context
5. **OpenAI Chat**: LLM completion with GPT-4 (simulated for testing)
6. **Quality Guardrail**: Evaluates response quality with multiple metrics
7. **Quality Gate**: Conditional branching based on quality score threshold
8. **Approve Response** / **Reject Response**: Different paths for quality outcomes
9. **Return Results**: Aggregates final results

### What This Tests

This production-like workflow validates that:
- **Workflow-level tracing**: The entire workflow execution is captured as a span
- **Node-level tracing**: Each individual node operation is traced with proper naming
- **HTTP requests**: External API calls are properly instrumented
- **LLM operations**: OpenAI-style completions are traced correctly
- **Guardrails**: Quality evaluation and gating are captured
- **Conditional logic**: Branch execution (approve/reject) is traced
- **Data flow**: Complete request/response lifecycle with metrics
- **Realistic structure**: Production-ready patterns with proper naming

### Trace Characteristics

When this workflow executes, you'll see traces with:
- **Workflow span**: `AI Assistant with Quality Checks` (~200-300ms)
  - **Parse Request** - Request validation
  - **Fetch Context Data** - HTTP request (100-200ms)
  - **Format Prompt** - Prompt construction
  - **OpenAI Chat** - LLM completion (simulated)
  - **Quality Guardrail** - Evaluation metrics
  - **Quality Gate** - Conditional branching
  - **Approve/Reject Response** - Path taken based on quality
  - **Return Results** - Final aggregation

This mirrors real-world AI workflows with LLM calls, quality guardrails, and conditional logic.

## Debug Output

With `N8N_OTEL_DEBUG: "1"` enabled, you'll see detailed logs:

```
[n8n-observability] observability ready and patches applied
[otel-setup] OpenTelemetry SDK initialized for service: n8n-e2e
```

These logs confirm that:
- The package is installed correctly
- Hooks are registered
- OpenTelemetry SDK is initialized
- Traces are being sent

## Validation

The automated test (via `pnpm e2e`) validates success by checking for specific log messages in the Docker output. The test passes if the observability initialization messages are present.

## Troubleshooting

### Container exits immediately
Check that the tarball was created successfully:
```bash
ls -la packages/n8n-observability/*.tgz
```

### No debug logs
Ensure `N8N_OTEL_DEBUG` is set to `"1"` in `docker-compose.yml`

### Workflow not executing
Check the entrypoint script logs for errors during workflow import

### Clean rebuild
```bash
docker-compose down -v
docker-compose up --build
```

## Use Cases

This e2e setup is useful for:
- **CI/CD validation**: Automated testing in pipelines
- **Local development testing**: Quick validation after code changes
- **Integration testing**: Ensuring the package works with different n8n versions
- **Debugging**: Isolated environment for troubleshooting issues
- **Demo purposes**: Shows realistic workflow tracing with multiple node types
- **Performance testing**: Validates observability overhead with complex workflows

