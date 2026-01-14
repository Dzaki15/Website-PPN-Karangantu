#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

// Start dev-server
const server = spawn('node', [path.join(__dirname, 'dev-server.js')], {
  stdio: 'inherit',
  cwd: __dirname
});

// Wait then run test
setTimeout(() => {
  const test = spawn('node', [path.join(__dirname, 'test-submission.cjs')], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  test.on('exit', (code) => {
    server.kill();
    process.exit(code);
  });
}, 2000);
