import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { LangChainInstrumentation } from '@arizeai/openinference-instrumentation-langchain';

export interface ObservabilityOptions {
  serviceName?: string;
  debug?: {
    consoleLogging?: boolean;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
  };
  /**
   * Enable auto-instrumentation for Node.js libraries (HTTP, Express, etc.)
   * Disable this if you only want n8n workflow/node spans
   * @default false
   */
  enableAutoInstrumentation?: boolean;
  /**
   * Enable metrics collection (memory, CPU, HTTP metrics, etc.)
   * @default false
   */
  enableMetrics?: boolean;
}

let sdkInstance: NodeSDK | null = null;

/**
 * Setup OpenTelemetry observability with the Node.js SDK
 * 
 * This function initializes OpenTelemetry with:
 * - Auto-instrumentation for common Node.js libraries
 * - Console exporters for traces and metrics (can be replaced with OTLP exporters)
 * - Service name and resource attributes
 * - Optional debug logging
 */
export function setupObservability(options: ObservabilityOptions = {}): void {
  // Prevent double initialization
  if (sdkInstance) {
    console.warn('[otel-setup] OpenTelemetry SDK already initialized');
    return;
  }

  const serviceName = options.serviceName || 'n8n';

  // Setup diagnostic logging if debug is enabled
  if (options.debug?.consoleLogging) {
    const logLevelMap = {
      debug: DiagLogLevel.DEBUG,
      info: DiagLogLevel.INFO,
      warn: DiagLogLevel.WARN,
      error: DiagLogLevel.ERROR,
    };
    const logLevel = logLevelMap[options.debug.logLevel || 'info'];
    diag.setLogger(new DiagConsoleLogger(), logLevel);
  }

  // Create resource with service name
  const resource = Resource.default().merge(
    new Resource({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
    })
  );

  // Determine if we should use OTLP exporters
  // Follow OpenTelemetry standard: support both generic and signal-specific endpoints
  // - OTEL_EXPORTER_OTLP_ENDPOINT: base URL, SDK appends /v1/traces, /v1/metrics
  // - OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: specific URL for traces, used as-is
  // - OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: specific URL for metrics, used as-is
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const tracesEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  const metricsEndpoint = process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT;

  // Parse OTLP headers from environment variables
  // Note: Unlike other OTel SDKs, the JS SDK doesn't automatically read these env vars
  // Format: "key1=value1,key2=value2"
  const parseHeaders = (headersString: string | undefined): Record<string, string> => {
    if (!headersString) return {};
    
    const headers: Record<string, string> = {};
    const pairs = headersString.split(',');
    
    for (const pair of pairs) {
      const [key, ...valueParts] = pair.split('=');
      if (key && valueParts.length > 0) {
        // Join back in case the value contains '='
        headers[key.trim()] = valueParts.join('=').trim();
      }
    }
    
    return headers;
  };

  const genericHeaders = parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);
  const tracesHeaders = {
    ...genericHeaders,
    ...parseHeaders(process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS),
  };
  const metricsHeaders = {
    ...genericHeaders,
    ...parseHeaders(process.env.OTEL_EXPORTER_OTLP_METRICS_HEADERS),
  };

  // Debug log headers (mask sensitive values)
  if (options.debug?.consoleLogging && (Object.keys(tracesHeaders).length > 0 || Object.keys(metricsHeaders).length > 0)) {
    const maskHeaderValue = (key: string, value: string): string => {
      const sensitiveKeys = ['authorization', 'api-key', 'apikey', 'token'];
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
        return value.substring(0, 4) + '***' + value.substring(value.length - 4);
      }
      return value;
    };
    
    if (Object.keys(tracesHeaders).length > 0) {
      console.log('[otel-setup] Trace headers:', 
        Object.entries(tracesHeaders).map(([k, v]) => `${k}=${maskHeaderValue(k, v)}`).join(', ')
      );
    }
    if (Object.keys(metricsHeaders).length > 0) {
      console.log('[otel-setup] Metrics headers:', 
        Object.entries(metricsHeaders).map(([k, v]) => `${k}=${maskHeaderValue(k, v)}`).join(', ')
      );
    }
  }
  
  const useOTLP = otlpEndpoint || tracesEndpoint;

  // Build OTLP URLs following the standard convention
  const getTraceUrl = (): string => {
    // Signal-specific endpoint takes precedence and is used as-is
    if (tracesEndpoint) {
      if (options.debug?.consoleLogging) {
        console.log(`[otel-setup] Using OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: ${tracesEndpoint}`);
      }
      return tracesEndpoint;
    }
    // Generic endpoint: append /v1/traces
    if (otlpEndpoint) {
      const url = `${otlpEndpoint}/v1/traces`;
      if (options.debug?.consoleLogging) {
        console.log(`[otel-setup] Using OTEL_EXPORTER_OTLP_ENDPOINT + /v1/traces: ${url}`);
      }
      return url;
    }
    throw new Error('No OTLP endpoint configured');
  };

  const getMetricsUrl = (): string => {
    // Signal-specific endpoint takes precedence and is used as-is
    if (metricsEndpoint) {
      if (options.debug?.consoleLogging) {
        console.log(`[otel-setup] Using OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: ${metricsEndpoint}`);
      }
      return metricsEndpoint;
    }
    // Generic endpoint: append /v1/metrics
    if (otlpEndpoint) {
      const url = `${otlpEndpoint}/v1/metrics`;
      if (options.debug?.consoleLogging) {
        console.log(`[otel-setup] Using OTEL_EXPORTER_OTLP_ENDPOINT + /v1/metrics: ${url}`);
      }
      return url;
    }
    throw new Error('No OTLP endpoint configured');
  };

  // Prepare SDK configuration
  const sdkConfig: any = {
    resource,
    // Trace exporter - OTLP if endpoint is set, otherwise console
    traceExporter: useOTLP
      ? (() => {
          const traceUrl = getTraceUrl();
          if (options.debug?.consoleLogging) {
            console.log(`[otel-setup] Creating OTLP trace exporter with URL: ${traceUrl}`);
          }
          
          const exporter = new OTLPTraceExporter({
            url: traceUrl,
            headers: tracesHeaders,
            timeoutMillis: 10000,
          });
          
          // Add debug logging and error handling
          if (options.debug?.consoleLogging) {
            const originalExport = exporter.export.bind(exporter);
            exporter.export = (spans: any, resultCallback: any) => {
              console.log(`[otel-setup] Exporting ${spans.length} span(s) to ${traceUrl}`);
              originalExport(spans, (result: any) => {
                if (result.error) {
                  // Filter out benign JSON parse errors from backends that return empty 200 responses
                  const errorMsg = result.error?.message || result.error?.toString() || '';
                  const isBenignJsonError = errorMsg.includes('JSON') && errorMsg.includes('Unexpected end');
                  
                  if (!isBenignJsonError) {
                    console.error(`[otel-setup] Failed to export spans:`, result.error);
                  } else {
                    console.log(`[otel-setup] Successfully exported ${spans.length} span(s) (backend returned empty response)`);
                  }
                } else {
                  console.log(`[otel-setup] Successfully exported ${spans.length} span(s)`);
                }
                resultCallback(result);
              });
            };
          }
          
          return exporter;
        })()
      : new ConsoleSpanExporter(),
  };

  // Add metrics only if enabled
  if (options.enableMetrics) {
    const metricsExporter = useOTLP
      ? (() => {
          const metricsUrl = getMetricsUrl();
          if (options.debug?.consoleLogging) {
            console.log(`[otel-setup] Creating OTLP metrics exporter with URL: ${metricsUrl}`);
          }
          return new OTLPMetricExporter({
            url: metricsUrl,
            headers: metricsHeaders,
            timeoutMillis: 10000,
          });
        })()
      : new ConsoleMetricExporter();
    
    sdkConfig.metricReader = new PeriodicExportingMetricReader({
      exporter: metricsExporter,
    });
  }

  // Add auto-instrumentation only if enabled
  if (options.enableAutoInstrumentation) {
    sdkConfig.instrumentations = [getNodeAutoInstrumentations()];
  }

  // Initialize the SDK
  sdkInstance = new NodeSDK(sdkConfig);

  // Start the SDK
  sdkInstance.start();

  // Manually instrument LangChain using OpenInference approach
  // This must be done after SDK starts and can work even if modules are already loaded
  try {
    const lcInstrumentation = new LangChainInstrumentation();
    
    // Try to require the LangChain callbacks manager
    // We use a try-catch since this is an optional dependency
    try {
      if (options.debug?.consoleLogging) {
        console.log('[otel-setup] Attempting to instrument LangChain...');
      }
      
      const CallbackManagerModule = require('@langchain/core/callbacks/manager');
      lcInstrumentation.manuallyInstrument(CallbackManagerModule);
      
      if (options.debug?.consoleLogging) {
        // Show where the module was loaded from
        try {
          const resolved = require.resolve('@langchain/core/callbacks/manager');
          console.log('[otel-setup] LangChain instrumented successfully from:', resolved);
        } catch {
          console.log('[otel-setup] LangChain manually instrumented successfully');
        }
      }
    } catch (requireErr) {
      // LangChain not installed or not available - this is fine
      if (options.debug?.consoleLogging) {
        console.log('[otel-setup] LangChain instrumentation skipped (module not found)');
        console.log('[otel-setup] Reason:', (requireErr as Error)?.message || requireErr);
      }
    }
  } catch (err) {
    if (options.debug?.consoleLogging) {
      console.warn('[otel-setup] Failed to set up LangChain instrumentation:', (err as Error)?.message);
    }
  }

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    sdkInstance?.shutdown()
      .then(() => console.log('[otel-setup] OpenTelemetry SDK shut down successfully'))
      .catch((error: Error) => console.error('[otel-setup] Error shutting down OpenTelemetry SDK', error))
      .finally(() => process.exit(0));
  });

  // Build status message
  const features: string[] = [];
  if (useOTLP) {
    const traceUrl = getTraceUrl();
    features.push(`OTLP export enabled`);
  } else {
    features.push('console output');
  }
  features.push('langchain (manual)');
  if (options.enableAutoInstrumentation) features.push('auto-instrumentation');
  if (options.enableMetrics) features.push('metrics');
  if (!options.enableAutoInstrumentation && !options.enableMetrics) features.push('n8n spans only');
  
  console.log(
    `[otel-setup] OpenTelemetry initialized: ${serviceName} (${features.join(', ')})`
  );
  
  // Show detailed URLs in debug mode
  if (options.debug?.consoleLogging && useOTLP) {
    console.log(`[otel-setup] Traces endpoint: ${getTraceUrl()}`);
    if (options.enableMetrics) {
      console.log(`[otel-setup] Metrics endpoint: ${getMetricsUrl()}`);
    }
  }
}

/**
 * Shutdown the OpenTelemetry SDK
 */
export async function shutdownObservability(): Promise<void> {
  if (sdkInstance) {
    await sdkInstance.shutdown();
    sdkInstance = null;
  }
}

