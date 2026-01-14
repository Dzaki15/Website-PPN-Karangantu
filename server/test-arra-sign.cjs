// Test ARRA PDF signing with real ARRA form data
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
    // Login as user
    console.log('1. Login as user...');
    const userLogin = await apiCall('POST', '/api/login', { email: 'dzakihakim333@gmail.com', password: '123' });
    const userToken = userLogin.body && userLogin.body.token;
    if (!userToken) throw new Error('User login failed');

    // Create ARRA submission with realistic data
    console.log('2. Create ARRA submission...');
    const submitRes = await apiCall('POST', '/api/submissions', {
      serviceSlug: 'penggunaan-arra',
      fileName: 'test-arra-alignment.pdf',
      data: {
        namaLayanan: 'Penggunaan Ruang Pertemuan Aula, Ruang rapat, asrama, rumah tamu',
        penggunaan: 'fasilitas',
        alamat: 'Serangan',
        tanggalPengajuan: '2025-12-31',
        namaPengguna: 'Fadil',
        workflowSteps: [
          { mulai: '21:08', selesai: '21:13', keterangan: 'Wadwad' },
          { mulai: '21:08', selesai: '21:13', keterangan: 'Awdwa' }
        ]
      },
      pdfBase64: 'JVBERi0xLjQKJSBFbXB0eSBQREYgZm9yIHRlc3Rpbmc='
    }, userToken);

    const submissionId = submitRes.body && submitRes.body.id;
    console.log('   Created submission ID:', submissionId);
    if (!submissionId) throw new Error('Failed to create submission');

    // Login as admin
    console.log('3. Login as admin...');
    const adminLogin = await apiCall('POST', '/api/login', { email: 'admin@ppn.local', password: 'admin123' });
    const adminToken = adminLogin.body && adminLogin.body.token;
    if (!adminToken) throw new Error('Admin login failed');

    // Sign the submission
    console.log('4. Sign submission (ID:', submissionId, ')...');
    const signRes = await apiCall('POST', `/api/admin/submissions/${submissionId}/sign`, {
      signatureDataUrl: '',
      signerName: 'Admin'
    }, adminToken);
    console.log('   Sign status:', signRes.status);

    // Get the signed PDF
    console.log('5. Fetching signed PDF...');
    const pdfRes = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 8080,
        path: `/api/admin/submissions/${submissionId}/signed-pdf`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.setEncoding('base64');
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        });
      });

      req.on('error', reject);
      req.end();
    });

    if (pdfRes.status === 200) {
      console.log('   ✓ PDF retrieved, size:', Buffer.from(pdfRes.body, 'base64').length, 'bytes');
      console.log('   Submission ID for preview:', submissionId);
      console.log('\n✓ Done! Go to browser and:');
      console.log('   1. Open http://localhost:8080/Website%20PPN%20Karangantu/admin-arsip.html');
      console.log('   2. Login as admin@ppn.local');
      console.log('   3. Find submission ID', submissionId, 'in Signed list');
      console.log('   4. Click Preview and check if signatures are aligned');
    } else {
      console.log('   ✗ Failed to get PDF, status:', pdfRes.status);
    }

  } catch (e) {
    console.error('ERROR', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
