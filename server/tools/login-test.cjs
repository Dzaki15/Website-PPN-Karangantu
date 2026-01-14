(async () => {
  try {
    const res = await fetch('http://127.0.0.1:8080/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@ppn.local', password: 'admin123' })
    });
    console.log('STATUS', res.status);
    const text = await res.text();
    console.log('BODY:', text);
  } catch (e) {
    console.error('ERROR:', e);
  }
})();
