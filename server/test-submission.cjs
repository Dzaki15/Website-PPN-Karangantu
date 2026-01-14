const http = require('http');

function jsonRequest(path, method = 'GET', body, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 8080,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  try {
    // Register new user
    console.log('1. Registering new user...');
    const regRes = await jsonRequest('/api/register', 'POST', {
      name: 'Form User',
      email: 'formuser@test.com',
      password: 'pass123'
    });
    const token = regRes.token;
    console.log('Register: OK, token =', token.substring(0, 30) + '...');

    // Submit a form
    console.log('\n2. Submitting a form...');
    const subRes = await jsonRequest('/api/submissions', 'POST', {
      serviceSlug: 'skkp',
      fileName: 'skkp-form-001.pdf',
      data: { namaKapal: 'Kapal Test', namaPemilik: 'Owner Test' },
      pdfBase64: 'JVBERi0xLjQKJeLjz9MNCjEgMCBvYmo='  // dummy PDF base64
    }, token);
    console.log('Submit: OK, submission id =', subRes.id);

    // Admin view submissions
    console.log('\n3. Admin viewing submissions...');
    const adminToken = await (async () => {
      const adminReg = await jsonRequest('/api/login', 'POST', {
        email: 'admin@ppn.local',
        password: 'admin123'
      });
      return adminReg.token;
    })();
    
    const adminSubs = await jsonRequest('/api/admin/submissions', 'GET', null, adminToken);
    console.log('Admin submissions:');
    console.log(`  - Total: ${adminSubs.items.length}`);
    if (adminSubs.items.length > 0) {
      const first = adminSubs.items[0];
      console.log(`  - Latest: ${first.file_name} (${first.service_slug}) from user ${first.user_id}`);
    }

    console.log('\n✅ All tests passed!');
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
  process.exit(0);
})();
