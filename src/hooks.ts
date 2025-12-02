import { setupObservability, flushTraces } from "./otel-setup.js";
import { applyPatches } from "./patch-n8n.js";

// Override process.exit to flush traces before exiting
// This is necessary because n8n CLI calls process.exit() directly
const originalExit = process.exit;
let isExiting = false;

process.exit = ((code?: number) => {
  if (isExiting) {
    return originalExit(code);
  }
  isExiting = true;
  
  if (process.env.N8N_OTEL_DEBUG) {
    console.log('[n8n-observability] process.exit intercepted, flushing traces...');
  }
  
  // Flush traces with a timeout, then exit
  flushTraces(5000).finally(() => {
    if (process.env.N8N_OTEL_DEBUG) {
      console.log('[n8n-observability] Traces flushed, exiting');
    }
    originalExit(code);
  });
  
  // Return never to satisfy TypeScript (originalExit will be called async)
  return undefined as never;
}) as typeof process.exit;

/**
 * CommonJS backend hooks file for n8n (used via EXTERNAL_HOOK_FILES)
 *
 * This initializes OpenTelemetry observability and applies the n8n patches
 * during the `n8n.ready` lifecycle hook so context is set up before any
 * workflow executes.
 */
const hooks = {
  n8n: {
    ready: [
      async function (_app: unknown) {
        try {
          const serviceName = process.env.N8N_OTEL_SERVICE_NAME || process.env.OTEL_SERVICE_NAME || "n8n";
          setupObservability({
            serviceName,
            debug: process.env.N8N_OTEL_DEBUG ? { consoleLogging: true, logLevel: "info" } : undefined,
            enableAutoInstrumentation: process.env.N8N_OTEL_AUTO_INSTRUMENT === "true",
            enableMetrics: process.env.N8N_OTEL_METRICS === "true",
          });
        } catch (err) {
          console.warn("[n8n-observability] setupObservability failed:", (err as Error)?.message || err);
        }

        try {
          await applyPatches();
          console.log("[n8n-observability] observability ready and patches applied");
        } catch (err) {
          console.warn("[n8n-observability] patching failed:", (err as Error)?.message || err);
        }
      },
    ],
  },
};

// Eager init in case hooks are loaded but ready hook is not triggered (e.g., n8n execute)
try {
  const serviceName = process.env.N8N_OTEL_SERVICE_NAME || process.env.OTEL_SERVICE_NAME || "n8n";
  setupObservability({
    serviceName,
    debug: process.env.N8N_OTEL_DEBUG ? { consoleLogging: true, logLevel: "info" } : undefined,
    enableAutoInstrumentation: process.env.N8N_OTEL_AUTO_INSTRUMENT === "true",
    enableMetrics: process.env.N8N_OTEL_METRICS === "true",
  });
  // Fire-and-forget; patch attempts multiple resolution strategies
  void applyPatches();
} catch {}

// @ts-expect-error - CommonJS export
export = hooks;
