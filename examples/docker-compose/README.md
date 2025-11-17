# Docker Compose Example with Comet ML (Opik)

This example demonstrates how to run n8n with OpenTelemetry observability enabled, sending traces to Comet ML's Opik platform.

## Prerequisites

1. **Comet ML API Key**: Get your API key from [Comet ML](https://www.comet.com/)
   - Sign up for a free account at https://www.comet.com/signup
   - Navigate to Settings → API Keys to generate your key

## Quick Start

1. **Set your Comet API Key**:
   ```bash
   export COMET_API_KEY=your_comet_api_key_here
   ```

2. **Build and run**:
   ```bash
   docker-compose up --build
   ```

3. **Access n8n**:
   - Open http://localhost:5678 in your browser
   - Create and execute workflows

4. **View traces in Comet**:
   - Go to your Comet ML dashboard
   - Navigate to Opik/Traces to see your workflow execution traces

## Configuration

The `docker-compose.yml` file is configured with:
- **OTEL_EXPORTER_OTLP_ENDPOINT**: Points to Comet ML's Opik trace endpoint
- **OTEL_EXPORTER_OTLP_HEADERS**: Includes your API key for authentication
- **N8N_OTEL_SERVICE_NAME**: Identifies your n8n instance in traces

### Using Local Opik

If you're running Opik locally instead of using Comet Cloud, update the endpoint in `docker-compose.yml`:

```yaml
OTEL_EXPORTER_OTLP_ENDPOINT: "http://host.docker.internal:5173/api/v1/private/otel"
# Remove the OTEL_EXPORTER_OTLP_HEADERS line for local Opik
```

## Optional: Enable Additional Features

Uncomment these environment variables in `docker-compose.yml` to enable more features:

```yaml
N8N_OTEL_METRICS: "true"      # Enable metrics collection
N8N_OTEL_DEBUG: "1"           # Enable debug logging
N8N_OTEL_CAPTURE_INPUT: "false"  # Disable input capture for privacy
```

## Troubleshooting

- **No traces appearing**: Verify your COMET_API_KEY is set correctly
- **Connection errors**: Check that the OTLP endpoint is accessible
- **Enable debug mode**: Set `N8N_OTEL_DEBUG: "1"` to see detailed logs

