import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const composeFile = path.resolve('tests/e2e/docker-compose.yml');
// When N8N_OTEL_DEBUG is enabled, we validate by console logs (docker up output)

function sh(cmd, args, opts={}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)));
  });
}

async function main() {
  // Build and pack the local version for testing (before publishing)
  await sh('pnpm', ['build']);
  const rootDir = process.cwd();
  
  // Clean old tarballs
  for (const f of await fs.promises.readdir(rootDir)) {
    if (f.startsWith('n8n-observability-') && f.endsWith('.tgz')) {
      await fs.promises.unlink(path.join(rootDir, f));
    }
  }
  
  await sh('pnpm', ['pack']);

  // Build and run docker compose
  await sh('docker', ['compose', '-f', composeFile, 'build']);

  // Run the one-shot workflow container and stream logs
  // We'll capture output to a buffer to make assertions
  await new Promise((resolve, reject) => {
    const p = spawn('docker', ['compose', '-f', composeFile, 'up', '--abort-on-container-exit', '--exit-code-from', 'n8n-e2e']);
    let buf = '';
    p.stdout.on('data', (d) => { process.stdout.write(d); buf += d.toString(); });
    p.stderr.on('data', (d) => { process.stderr.write(d); buf += d.toString(); });
    p.on('exit', (code) => {
      if (code !== 0) return reject(new Error(`docker exited ${code}`));
      try {
        // Check for our debug logs from the hooks
        if (!buf.includes('[n8n-observability]')) {
          throw new Error('Expected n8n-observability logs not found');
        }
        if (!buf.includes('[otel-setup]')) {
          throw new Error('Expected otel-setup logs not found');
        }
        // Check for actual OTLP export to confirm traces were sent
        if (!buf.includes('OTLPExportDelegate items to be sent')) {
          throw new Error('Expected OTLP export log not found - traces were not sent to backend');
        }
        console.log('E2E OK: Observability SDK initialized and traces exported to backend');
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
