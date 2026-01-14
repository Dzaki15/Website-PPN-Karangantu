/* Smoke-test script for local API.
   Usage: node tools/smoke-api.js http://localhost:8081 */

const base = process.argv[2] || 'http://localhost:8081';

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

async function main() {
  console.log('Base:', base);
  console.log('Health:', await jsonRequest('/api/health'));

  const adminLogin = await jsonRequest('/api/login', 'POST', {
    email: 'admin@ppn.local',
    password: 'admin123'
  });
  console.log('Admin login ok:', Boolean(adminLogin.token));

  const adminMe = await jsonRequest('/api/me', 'GET', undefined, adminLogin.token);
  console.log('Admin me:', { role: adminMe.role, email: adminMe.email, name: adminMe.name });

  const signed = await jsonRequest('/api/admin/submissions?status=signed', 'GET', undefined, adminLogin.token);
  const pending = await jsonRequest('/api/admin/submissions?status=pending', 'GET', undefined, adminLogin.token);
  const signedCount = Array.isArray(signed) ? signed.length : (signed.items?.length ?? 0);
  const pendingCount = Array.isArray(pending) ? pending.length : (pending.items?.length ?? 0);
  console.log('Admin submissions:', { signed: signedCount, pending: pendingCount });

  const userLogin = await jsonRequest('/api/login', 'POST', {
    email: 'sofianabila946@gmail.com',
    password: '123'
  });
  console.log('User login ok:', Boolean(userLogin.token));

  const userMe = await jsonRequest('/api/me', 'GET', undefined, userLogin.token);
  console.log('User me:', { role: userMe.role, email: userMe.email, name: userMe.name });

  const mySigned = await jsonRequest('/api/my/signed-submissions', 'GET', undefined, userLogin.token);
  const mySignedCount = Array.isArray(mySigned) ? mySigned.length : (mySigned.items?.length ?? 0);
  console.log('User signed submissions:', { count: mySignedCount });
}

main().catch((err) => {
  console.error('SMOKE TEST FAILED:', err);
  process.exit(1);
});
