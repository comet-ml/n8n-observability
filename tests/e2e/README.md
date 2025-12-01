# E2E Tests (CI/CD)

This directory contains end-to-end tests for CI/CD pipelines. These tests use the **local tarball** of the n8n-observability package to validate changes before publishing to npm.

## Purpose

- ✅ Test the package before publishing
- ✅ Validate observability hooks work correctly  
- ✅ Ensure workflow execution is traced properly
- ✅ Run automatically in CI/CD pipelines

## Usage

From the repository root:

```bash
pnpm e2e
```

This will:
1. Build the n8n-observability package
2. Pack it into a tarball
3. Run a test n8n workflow with the local package
4. Validate that observability traces are generated

## For Users

If you want to try the **published npm package** instead, see [`examples/e2e/`](../../examples/e2e/) which demonstrates using the package from npm.

## Configuration

The test setup uses:
- **Local tarball**: `/packages/n8n-observability/*.tgz`
- **Service name**: `n8n-e2e-test`
- **Debug mode**: Enabled (`N8N_OTEL_DEBUG=1`)

