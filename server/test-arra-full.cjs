// Full ARRA test: create submission, then sign it
const http = require('http');
const fs = require('fs');
const path = require('path');

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
    // Step 1: Login as regular user
    console.log('1. Login user...');
    const loginRes = await apiCall('POST', '/api/login', { 
      email: 'sofianabila946@gmail.com', 
      password: '123' 
    });
    const userToken = loginRes.body && loginRes.body.token;
    const userName = loginRes.body && loginRes.body.user && loginRes.body.user.name;
    console.log('  User token:', userToken);
    console.log('  User name:', userName);

    // Step 2: Submit ARRA form
    console.log('\n2. Submit ARRA form...');
    // Create a minimal PDF base64 (just a simple PDF)
    const pdfBase64 = 'JVBERi0xLjEKJeLjz9MNCjEgMCBvYmo7IHN0YXJ0IHngJQoxIDAgb2JqCjw8L1R5cGUgL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYgoyIDAgb2JqCjw8L1R5cGUgL1BhZ2VzL0tpZHMgWzMgMCBSXS9Db3VudCAxPj4KZW5kb2IKMyAwIG9iagp7PC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAwIFIgL1Jlc291cmNlcyA8PC9Gb250IDw8L0YxIDQgMCBSPj4+Pi9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9Db250ZW50cyA1IDAgUj4+fQplbmRvYgo0IDAgb2JqCjw8L1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhPj4KZW5kb2IKNSAwIG9iagp7L0xlbmd0aCA0NH0Kc3RyZWFtCkJUIC9GMSAxMiBUZiAxMDAgNzUwIFRkIChIZWxsbyBXb3JsZCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iCnhyZWYKMCAxCjAwMDAwMDAwMDAgNjU1MzUgZiAKMSAyIDAgMzAgMDAwMDAwMDAwOSAwMDAwMCBuIAoyIDAgMzAgMDAwMDAwMDc0IDAwMDAwIG4gCjMgMCAzMCAwMDAwMDAxNDcgMDAwMDAgbiAKNCAyIDAgMzAgMDAwMDAwMzEwIDAwMDAwIG4gCjUgMCAzMCAwMDAwMDA0MDEgMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDYgL1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKNTAxCiUlRU9GCg==';

    const submitRes = await apiCall('POST', '/api/submissions', {
      serviceSlug: 'penggunaan-arra',
      fileName: 'arra-test-' + Date.now() + '.pdf',
      data: {
        pengajuanCatatan: 'Test catatan pengajuan',
        loginCatatan: 'Test catatan login'
      },
      pdfBase64: pdfBase64
    }, userToken);
    
    const submissionId = submitRes.body && submitRes.body.id;
    console.log('  Submission ID:', submissionId, '| Status:', submitRes.status);
    if (!submissionId) {
      console.error('  ERROR: No submission ID returned');
      process.exit(1);
    }

    // Step 3: Login as admin
    console.log('\n3. Login admin...');
    const adminLoginRes = await apiCall('POST', '/api/login', { 
      email: 'admin@ppn.local', 
      password: 'admin123' 
    });
    const adminToken = adminLoginRes.body && adminLoginRes.body.token;
    console.log('  Admin token:', adminToken);

    // Step 4: Check pending submissions BEFORE signing
    console.log('\n4. Check pending submissions BEFORE signing...');
    const beforeSign = await apiCall('GET', '/api/admin/submissions?status=pending', null, adminToken);
    const pending = beforeSign.body && beforeSign.body.items || [];
    console.log('  Pending count:', pending.length);
    const ourSubmission = pending.find(s => s.id === submissionId);
    if (ourSubmission) {
      console.log('  Our submission found:');
      console.log('    ID:', ourSubmission.id);
      console.log('    service_slug:', ourSubmission.service_slug);
      console.log('    status:', ourSubmission.status);
      console.log('    user_id:', ourSubmission.user_id);
      console.log('    user_name:', ourSubmission.user_name);
      console.log('    file_name:', ourSubmission.file_name);
    }

    // Step 5: Sign the submission
    console.log('\n5. Signing submission...');
    const signRes = await apiCall('POST', `/api/admin/submissions/${submissionId}/sign`, {
      signatureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      signedDate: new Date().toISOString(),
      signerName: 'Admin Test'
    }, adminToken);
    console.log('  Status:', signRes.status);
    console.log('  Response:', signRes.body);

    // Step 6: Check signed submissions
    console.log('\n6. Check SIGNED submissions...');
    const signedRes = await apiCall('GET', '/api/admin/submissions?status=signed', null, adminToken);
    const signed = signedRes.body && signedRes.body.items || [];
    console.log('  Signed count:', signed.length);
    const signedSubmission = signed.find(s => s.id === submissionId);
    if (signedSubmission) {
      console.log('  Our signed submission found:');
      console.log('    ID:', signedSubmission.id);
      console.log('    service_slug:', signedSubmission.service_slug);
      console.log('    status:', signedSubmission.status);
      console.log('    user_id:', signedSubmission.user_id);
      console.log('    user_name:', signedSubmission.user_name);
      console.log('    file_name:', signedSubmission.file_name);
      console.log('    signed_at:', signedSubmission.signed_at);
    } else {
      console.log('  ERROR: Signed submission NOT found!');
      console.log('  Full signed list:');
      signed.forEach((s, i) => {
        console.log(`    [${i}] ID=${s.id}, status=${s.status}, service=${s.service_slug}`);
      });
    }

  } catch (e) {
    console.error('ERROR', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
