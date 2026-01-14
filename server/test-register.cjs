const http = require('http');

function jsonRequest(path, method = 'GET', body) {
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
    console.log('Testing /api/register...');
    const regRes = await jsonRequest('/api/register', 'POST', {
      name: 'Test User',
      email: 'testuser@example.com',
      password: 'password123'
    });
    console.log('Register response:', JSON.stringify(regRes, null, 2));

    if (regRes.user && regRes.token) {
      console.log('\nTesting /api/login with new user...');
      const loginRes = await jsonRequest('/api/login', 'POST', {
        email: 'testuser@example.com',
        password: 'password123'
      });
      console.log('Login response:', JSON.stringify(loginRes, null, 2));
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
})();
