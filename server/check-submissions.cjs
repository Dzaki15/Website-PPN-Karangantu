// Check submissions status
const http = require('http');

function apiCall(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8080,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };

    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  try {
    // Login as admin
    const adminLogin = await apiCall('POST','/api/login',{ email: 'admin@ppn.local', password: 'admin123' });
    const adminToken = adminLogin.body && adminLogin.body.token;
    if(!adminToken) throw new Error('Admin login failed');

    // Check all submissions
    const allSubs = await apiCall('GET', '/api/admin/submissions', null, adminToken);
    console.log('All submissions:', JSON.stringify(allSubs.body, null, 2));

    // Check pending
    const pending = await apiCall('GET', '/api/admin/submissions?status=pending', null, adminToken);
    console.log('\nPending submissions:', JSON.stringify(pending.body, null, 2));

    // Check signed
    const signed = await apiCall('GET', '/api/admin/submissions?status=signed', null, adminToken);
    console.log('\nSigned submissions:', JSON.stringify(signed.body, null, 2));

  } catch (e) {
    console.error('ERROR', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
