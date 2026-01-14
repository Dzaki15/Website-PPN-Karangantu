// Test reject functionality
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
    // login as user
    const userLogin = await apiCall('POST','/api/login',{ email: 'dzakihakim333@gmail.com', password: '123' });
    const userToken = userLogin.body && userLogin.body.token;
    if(!userToken) throw new Error('User login failed');

    // create submission
    const submitRes = await apiCall('POST','/api/submissions',{
      serviceSlug: 'penggunaan-arra',
      fileName: 'test-rejected.pdf',
      data: { test: true },
      pdfBase64: 'JVBERi0xLjQKJSBFbXB0eSBQREYgZm9yIHRlc3Rpbmc='
    }, userToken);
    
    const createdId = submitRes.body && submitRes.body.id;
    if(!createdId) throw new Error('Submission creation failed');
    console.log('Created submission ID:', createdId);

    // login as admin
    const adminLogin = await apiCall('POST','/api/login',{ email: 'admin@ppn.local', password: 'admin123' });
    const adminToken = adminLogin.body && adminLogin.body.token;
    if(!adminToken) throw new Error('Admin login failed');

    // reject the submission
    const rejectRes = await apiCall('POST', `/api/admin/submissions/${createdId}/reject`, {}, adminToken);
    console.log('Reject status:', rejectRes.status);

    console.log('\n✓ Submission', createdId, 'rejected successfully');
    console.log('Check admin-arsip.html - should now show this submission with "Ditolak" label');

  } catch (e) {
    console.error('ERROR', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
