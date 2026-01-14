// Full flow: create submission as user, sign as admin, then delete
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
    console.log('Login as user...');
    const userLogin = await apiCall('POST','/api/login',{ email: 'dzakihakim333@gmail.com', password: '123' });
    console.log(' user login status', userLogin.status);
    const userToken = userLogin.body && userLogin.body.token;
    if(!userToken) throw new Error('User login failed');

    // create submission
    console.log('Create submission...');
    const submitRes = await apiCall('POST','/api/submissions',{
      serviceSlug: 'penggunaan-arra',
      fileName: 'test-delete.pdf',
      data: { test: true },
      pdfBase64: 'JVBERi0xLjQKJSBFbXB0eSBQREYgZGF0YQo='
    }, userToken);
    console.log(' submit status', submitRes.status, JSON.stringify(submitRes.body));
    const createdId = submitRes.body && submitRes.body.id;
    if(!createdId) throw new Error('Submission creation failed');

    // login as admin
    console.log('Login as admin...');
    const adminLogin = await apiCall('POST','/api/login',{ email: 'admin@ppn.local', password: 'admin123' });
    const adminToken = adminLogin.body && adminLogin.body.token;
    if(!adminToken) throw new Error('Admin login failed');

    // sign the submission
    console.log('Sign submission id', createdId);
    const signRes = await apiCall('POST', `/api/admin/submissions/${createdId}/sign`, { signatureDataUrl: '', signerName: 'Admin' }, adminToken);
    console.log(' sign status', signRes.status, JSON.stringify(signRes.body));

    // confirm signed
    const signedList = await apiCall('GET','/api/admin/submissions?status=signed', null, adminToken);
    console.log(' signed items count', signedList.body && signedList.body.items ? signedList.body.items.length : 0);

    // delete submission
    console.log('Delete submission id', createdId);
    const deleteRes = await apiCall('DELETE', `/api/admin/submissions/${createdId}`, null, adminToken);
    console.log(' delete status', deleteRes.status, JSON.stringify(deleteRes.body));

    if(deleteRes.status === 200) console.log('✓ Delete successful');
    else console.log('✗ Delete failed');

  } catch (e) {
    console.error('ERROR', e && e.message ? e.message : e);
    console.error(e && e.stack);
    process.exit(1);
  }
})();
