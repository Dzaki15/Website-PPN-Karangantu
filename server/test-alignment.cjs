const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

(async () => {
  try {
    // Login as user
    const loginRes = await (await fetch('http://127.0.0.1:8080/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sofianabila946@gmail.com', password: '123456' })
    })).json();
    
    if (!loginRes.token) {
      console.log('Login failed:', loginRes);
      return;
    }
    
    const userToken = loginRes.token;
    console.log('✓ User logged in');
    
    // Create ARRA submission with keterangan
    const submissionRes = await (await fetch('http://127.0.0.1:8080/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + userToken },
      body: JSON.stringify({
        serviceSlug: 'penggunaan-arra',
        fileName: 'test-arra-alignment.pdf',
        data: {
          workflowSteps: [
            { step: 1, keterangan: 'Diterima dan dicek' },
            { step: 2, keterangan: 'Diproses' },
            { step: 3, keterangan: 'Persetujuan' },
            { step: 4, keterangan: 'Pengesahan' },
            { step: 5, keterangan: 'Distribusi' },
            { step: 6, keterangan: 'Selesai' }
          ]
        },
        pdfBase64: 'JVBERi0xLjQKJeLjz9MNCjEgMCBvYmo8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PmVuZG9iagoyIDAgb2JqPDwvVHlwZS9QYWdlcy9LaWRzWzMgMCBSXS9Db3VudCAxPj5lbmRvYmoKMyAwIG9iajw8L1R5cGUvUGFnZS9QYXJlbnQgMiAwIFIvTWVkaWFCb3hbMCAwIDYxMiA3OTJdL1Jlc291cmNlczw8L0ZvbnQ8PC9GMSA0IDAgUj4+Pj4vQ29udGVudHMgNSAwIFI+PmVuZG9iagooaAowCjQgMCBvYmo8PC9Gb250RGVzY3JpcHRvciA2IDAgUi9CYXNlRm9udC9IZWx2ZXRpY2EvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEgPj5lbmRvYmoKNSAwIG9iajw8L0xlbmd0aCAzMy9GaWx0ZXIvRmxhdGVEZWNvZGU+PnN0cmVhbQp4nCtk4nAqS8wpTVWqBAAZBQX5+TlFqZkFBZnFGZkluZkluQU5Rfl5mUUFOal5mQWVmQU5lZWluVVFmcUFpSkluUWpjCi4KZW5kc3RyZWFtCmVuZG9iagoKNiAwIG9iajw8L1R5cGUvRm9udERlc2NyaXB0b3IvRm9udE5hbWUvSGVsdmV0aWNhL0ZsYWdzIDMyL0ZvbnRCQm94WzAgLTEwMjEgMTAwMCA3NzVdL0l0YWxpY0FuZ2xlIDAuMC9Bc2NlbnQgNzcyL0Rlc2NlbnQgLTI1MC9DYXBIZWlnaHQgNzc1L1N0ZW1WIDUwPj5lbmRvYmoKeHJlZgowIDcKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNzQgMDAwMDAgbiAKMDAwMDAwMDEyMyAwMDAwMCBuIAowMDAwMDAwMzIyIDAwMDAwIG4gCjAwMDAwMDA0MTAgMDAwMDAgbiAKMDAwMDAwMDUyMyAwMDAwMCBuIAp0cmFpbGVyIDw8L1NpemUgNy9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjcwMApFT0Y='
      })
    })).json();
    
    if (!submissionRes.id) {
      console.log('Submission failed:', submissionRes);
      return;
    }
    
    console.log('✓ Submission created, ID:', submissionRes.id);
    
    // Login as admin
    const adminLoginRes = await (await fetch('http://127.0.0.1:8080/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@ppn.local', password: 'admin123' })
    })).json();
    
    if (!adminLoginRes.token) {
      console.log('Admin login failed:', adminLoginRes);
      return;
    }
    
    const adminToken = adminLoginRes.token;
    console.log('✓ Admin logged in');
    
    // Sign the submission
    const signRes = await fetch('http://127.0.0.1:8080/api/admin/submissions/' + submissionRes.id + '/sign', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + adminToken },
      body: JSON.stringify({})
    });
    
    if (signRes.status !== 200) {
      const errText = await signRes.text();
      console.log('Sign failed:', signRes.status, errText);
      return;
    }
    
    console.log('✓ Submission signed');
    console.log('');
    console.log('✓ Test submission ready!');
    console.log('  Submission ID: ' + submissionRes.id);
    console.log('');
    console.log('Open browser and:');
    console.log('  1. Go to: http://localhost:8080/Website%20PPN%20Karangantu/admin-arsip.html');
    console.log('  2. Login as: admin@ppn.local / admin123');
    console.log('  3. Find submission ' + submissionRes.id + ' in the list');
    console.log('  4. Click Preview to check alignment of:');
    console.log('     - Date label (31 Desember 2025)');
    console.log('     - Pemberi Layanan label');
    console.log('     - Admin name');
    console.log('     Should align with Penerima Layanan side');
    
  } catch(e) {
    console.log('Error:', e.message);
  }
})();
