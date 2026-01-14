/* E2E smoke test: starts the backend, runs a few API calls, then stops it.
   Usage: node tools/smoke-e2e.js [port]
*/

import { spawn } from 'node:child_process';

const port = Number(process.argv[2] || 8081);
const base = `http://localhost:${port}`;

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function jsonRequest(path, method = 'GET', body, token) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  }
  return data;
}

async function waitForHealth(timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const data = await jsonRequest('/api/health');
      if (data && data.ok) return true;
    } catch (err) {
      lastErr = err;
    }
    await sleep(200);
  }
  throw lastErr || new Error('Health check timed out');
}

async function main() {
  console.log('Starting backend…', { port, base });

  const child = spawn(process.execPath, ['server.js'], {
    // Run from the current working directory (expected: .../server)
    // Using file-URL pathnames on Windows can produce invalid cwd values.
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => {
    stdout += d.toString();
    if (stdout.length > 4000) stdout = stdout.slice(-4000);
  });
  child.stderr.on('data', (d) => {
    stderr += d.toString();
    if (stderr.length > 4000) stderr = stderr.slice(-4000);
  });

  const stop = async () => {
    if (child.killed) return;
    child.kill('SIGTERM');
    await sleep(300);
    if (!child.killed) child.kill('SIGKILL');
  };

  try {
    await waitForHealth();
    console.log('Health OK');

    const adminLogin = await jsonRequest('/api/login', 'POST', { email: 'admin@ppn.local', password: 'admin123' });
    console.log('Admin login ok:', Boolean(adminLogin.token));

    const adminMe = await jsonRequest('/api/me', 'GET', undefined, adminLogin.token);
    console.log('Admin me:', { role: adminMe?.data?.role, email: adminMe?.data?.email });

    const signed = await jsonRequest('/api/admin/submissions?status=signed', 'GET', undefined, adminLogin.token);
    const pending = await jsonRequest('/api/admin/submissions?status=pending', 'GET', undefined, adminLogin.token);
    const signedCount = Array.isArray(signed) ? signed.length : (signed.items?.length ?? 0);
    const pendingCount = Array.isArray(pending) ? pending.length : (pending.items?.length ?? 0);
    console.log('Admin submissions:', { signed: signedCount, pending: pendingCount });

    const randomEmail = `smoke-${Date.now()}@ppn.local`;
    const randomPassword = 'smoke12345';
    await jsonRequest('/api/register', 'POST', { name: 'Smoke User', email: randomEmail, password: randomPassword });
    const userLogin = await jsonRequest('/api/login', 'POST', { email: randomEmail, password: randomPassword });
    console.log('User login ok:', Boolean(userLogin.token));

    const mySigned = await jsonRequest('/api/my/signed-submissions', 'GET', undefined, userLogin.token);
    const mySignedCount = Array.isArray(mySigned) ? mySigned.length : (mySigned.items?.length ?? 0);
    console.log('User signed submissions:', { count: mySignedCount });

    console.log('SMOKE OK');
  } finally {
    await stop();
  }

  // Help debug if child printed anything unexpected
  if (stderr.trim()) {
    console.log('Backend stderr (tail):');
    console.log(stderr.trim());
  }
}

main().catch((err) => {
  console.error('SMOKE FAILED:', err);
  process.exit(1);
});
