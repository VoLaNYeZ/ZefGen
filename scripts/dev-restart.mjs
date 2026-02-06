import { execSync, spawn } from 'node:child_process';

const PORT = Number(process.env.PORT || process.env.VITE_PORT || 5173);

function run(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const pidOutput = run(`lsof -ti tcp:${PORT}`);
  const pids = pidOutput ? pidOutput.split(/\s+/).filter(Boolean) : [];

  for (const pid of pids) {
    const comm = run(`ps -p ${pid} -o comm=`);
    // Avoid killing random stuff; we only expect Vite to be a node process.
    if (!comm || !comm.includes('node')) continue;
    try {
      process.kill(Number(pid), 'SIGTERM');
    } catch {
      // ignore
    }
  }

  // Wait briefly for the port to be released (best-effort).
  for (let i = 0; i < 25; i += 1) {
    const stillListening = Boolean(run(`lsof -ti tcp:${PORT}`));
    if (!stillListening) break;
    await sleep(100);
  }

  const child = spawn('vite', { stdio: 'inherit', shell: true });
  child.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

