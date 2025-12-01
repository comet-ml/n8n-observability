// Main entry point for the package
export { applyPatches } from "./patch-n8n.js";
export { setupObservability, shutdownObservability, flushObservability } from "./otel-setup.js";

// For programmatic setup
export async function setupN8nObservability(options?: {
  serviceName?: string;
  debug?: boolean;
  enableAutoInstrumentation?: boolean;
  enableMetrics?: boolean;
}) {
  const { setupObservability } = await import("./otel-setup.js");
  const { applyPatches } = await import("./patch-n8n.js");

  try {
    setupObservability({
      serviceName: options?.serviceName || process.env.N8N_OTEL_SERVICE_NAME || "n8n",
      debug: options?.debug || process.env.N8N_OTEL_DEBUG ? { consoleLogging: true, logLevel: "info" } : void 0,
      enableAutoInstrumentation: options?.enableAutoInstrumentation ?? process.env.N8N_OTEL_AUTO_INSTRUMENT === "true",
      enableMetrics: options?.enableMetrics ?? process.env.N8N_OTEL_METRICS === "true",
    });
  } catch (err) {
    console.warn("[n8n-observability] setupObservability failed:", (err as Error)?.message || err);
  }

  try {
    await applyPatches();
  } catch (err) {
    console.warn("[n8n-observability] patching failed:", (err as Error)?.message || err);
  }
}
