# LangChain Instrumentation Investigation

## ✅ SOLVED - Using Arize AI OpenInference

We successfully implemented LangChain instrumentation using [Arize AI's OpenInference library](https://arize-ai.github.io/openinference/js/packages/openinference-instrumentation-langchain/), which uses a **manual instrumentation approach** instead of automatic patching.

---

## Problem with First Attempt

We initially attempted to use `@traceloop/instrumentation-langchain`, but encountered a fundamental limitation.

### Root Cause of Failure

The `@traceloop/instrumentation-langchain` package has `@langchain/core` as a **direct dependency**. This creates a circular dependency problem:

1. When we import the instrumentation library to set it up
2. The instrumentation library imports `@langchain/core` 
3. LangChain modules are loaded **by the instrumentation itself**
4. By the time the instrumentation tries to patch LangChain, the modules are already loaded
5. OpenTelemetry instrumentation requires patching **before** modules are loaded

This makes automatic instrumentation impossible with this library.

## What We Tried

1. ✅ Added `@traceloop/instrumentation-langchain` as a dependency
2. ✅ Integrated it into the OpenTelemetry setup  
3. ❌ Attempted automatic patching but failed due to circular dependencies
4. ❌ Tried Node.js preload with `NODE_OPTIONS='--require'` but still failed
5. ❌ Still saw warning: "LangChain modules already loaded before instrumentation!"

## ✅ Solution: Arize AI OpenInference

Instead of automatic patching, we use [Arize AI's `@arizeai/openinference-instrumentation-langchain`](https://arize-ai.github.io/openinference/js/packages/openinference-instrumentation-langchain/) which uses **manual instrumentation**.

### How It Works

```typescript
import { LangChainInstrumentation } from '@arizeai/openinference-instrumentation-langchain';

// Create instrumentation instance
const lcInstrumentation = new LangChainInstrumentation();

// Dynamically import and manually instrument the callbacks manager
import('@langchain/core/callbacks/manager')
  .then((CallbackManagerModule) => {
    lcInstrumentation.manuallyInstrument(CallbackManagerModule);
  });
```

### Key Advantages

1. **No timing dependencies** - Works even if LangChain modules are already loaded
2. **Manual control** - We explicitly instrument the callbacks manager
3. **No circular dependencies** - The instrumentation doesn't automatically import LangChain
4. **Runtime instrumentation** - Can be done after the SDK starts

### Implementation in n8n-observability

The instrumentation is now automatically applied when:
1. The OpenTelemetry SDK starts
2. We attempt to dynamically import `@langchain/core/callbacks/manager`
3. If found, we manually instrument it
4. If not found, we gracefully skip (LangChain is optional)

## What You Now Get

With the updated n8n-observability package, you get:

### ✅ **n8n Workflow Spans**
- Workflow execution timing
- Workflow metadata (ID, name, mode)
- Error tracking

### ✅ **n8n Node Spans**  
- Individual node execution timing
- Node type and name
- Input/output capture (configurable)

### ✅ **LangChain Operation Spans** (NEW!)
- Chain execution spans
- Agent reasoning steps
- Tool invocations
- LLM calls within chains
- LangChain-specific OpenInference semantic conventions
- Detailed inputs/outputs at each step

### ✅ **HTTP Request Spans** (if auto-instrumentation enabled)
- HTTP requests to OpenAI API
- Request/response timing
- Status codes

## Alternative Approaches

If you need detailed LangChain tracing, consider these alternatives:

### 1. **LangSmith** (Official LangChain Tracing)
LangChain's own tracing service. Works via environment variables:
```bash
export LANGCHAIN_TRACING_V2=true
export LANGCHAIN_API_KEY="your-key"
export LANGCHAIN_PROJECT="your-project"
```

### 2. **LangChain Callbacks** (Custom Integration)
For Python LangChain (not applicable to n8n's JS nodes):
```python
from langwatch.langchain import LangChainTracer
tracer = LangChainTracer()
chain.invoke(input, config={"callbacks": [tracer]})
```

### 3. **Manual Spans** (Future Enhancement)
Could potentially patch n8n's LangChain nodes to manually create OpenTelemetry spans. Would require:
- Understanding n8n's LangChain node implementation
- Monkey-patching at runtime
- Maintenance for each n8n version

### 4. **HTTP-Level Tracing**
Enable auto-instrumentation to capture HTTP calls to LLM APIs:
```bash
export N8N_OTEL_AUTO_INSTRUMENT=true
```
This captures:
- Requests to OpenAI, Anthropic, etc.
- Response times
- Status codes
- But not high-level LangChain semantics

## Recommendation

**Use the updated n8n-observability package** - it now provides complete tracing:
- ✅ n8n workflow and node execution
- ✅ LangChain chains, agents, and tools
- ✅ LLM calls with detailed parameters
- ✅ OpenInference semantic conventions

**Optional enhancements**:
```bash
# Enable HTTP-level instrumentation for additional detail
export N8N_OTEL_AUTO_INSTRUMENT=true

# Enable metrics (CPU, memory, etc.)
export N8N_OTEL_METRICS=true
```

**No need for** LangSmith or additional tracing solutions unless you specifically need their UI or analytics features.

## Files Changed

- ✅ Added `@arizeai/openinference-instrumentation-langchain` dependency
- ✅ Implemented manual LangChain instrumentation in `otel-setup.ts` using `require()`
- ✅ Updated README with OpenInference documentation and simplified troubleshooting
- ✅ Removed preload script (not needed - manual instrumentation works at runtime)
- ✅ Package now provides complete n8n + LangChain tracing with zero special setup

## Usage

Simply use the hooks approach (no special setup needed):

```bash
export EXTERNAL_HOOK_FILES="/path/to/n8n-observability/dist/hooks.cjs"
export N8N_OTEL_DEBUG=1  # to see instrumentation status
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="your-backend-url"
n8n start
```

You should see in the logs:
```
[otel-setup] OpenTelemetry initialized: n8n (OTLP export enabled, langchain (manual), n8n spans only)
[otel-setup] LangChain manually instrumented successfully
```

Now when you run workflows with LangChain nodes, you'll see detailed spans for all LangChain operations! 🎉

