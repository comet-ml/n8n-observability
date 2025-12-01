import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const composeFile = path.resolve('examples/e2e/docker-compose.yml');
// When N8N_OTEL_DEBUG is enabled, we validate by console logs (docker up output)

function sh(cmd, args, opts={}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)));
  });
}

async function main() {
  // Build the docker image (uses published n8n-observability package from npm)
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
        console.log('E2E OK: Observability SDK and setup logs present');
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
