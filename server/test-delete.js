// Test delete functionality
const http = require('http');

function apiCall(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8080,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if(token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if(body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  try {
    console.log('1. Login as admin...');
    const loginRes = await apiCall('POST', '/api/login', { email: 'admin@ppn.local', password: 'admin123' });
    console.log('   Status:', loginRes.status);
    if(loginRes.status !== 200) {
      console.log('   Login failed');
      process.exit(1);
    }
    console.log('   Body:', JSON.stringify(loginRes.body, null, 2));
    const token = loginRes.body.token;
    
    if(!token) {
      console.error('Failed to get token');
      process.exit(1);
    }

    console.log('\n2. Get signed submissions...');
    const submissionsRes = await apiCall('GET', '/api/admin/submissions?status=signed', null, token);
    console.log('   Status:', submissionsRes.status);
    console.log('   Body:', JSON.stringify(submissionsRes.body, null, 2));
    const items = submissionsRes.body.items || [];
    console.log('   Found', items.length, 'submissions');
    
    if(items.length === 0) {
      console.log('   No submissions to delete. Creating one first...');
      process.exit(0);
    }

    const firstId = items[0].id;
    console.log('   First submission ID:', firstId);

    console.log('\n3. Delete submission', firstId, '...');
    const deleteRes = await apiCall('DELETE', `/api/admin/submissions/${firstId}`, null, token);
    console.log('   Status:', deleteRes.status);
    console.log('   Body:', JSON.stringify(deleteRes.body, null, 2));

    if(deleteRes.status === 200) {
      console.log('\n✓ SUCCESS: Delete worked!');
      process.exit(0);
    } else {
      console.log('\n✗ FAILED: Unexpected status', deleteRes.status);
      process.exit(1);
    }

  } catch(e) {
    console.error('Error:', e);
    console.error(e.stack);
    process.exit(1);
  }
})();
