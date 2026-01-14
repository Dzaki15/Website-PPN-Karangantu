import db from './db.js';
import bcrypt from 'bcryptjs';

// Check existing users
const users = db.prepare('SELECT id, name, email, role FROM users').all();
console.log('=== Existing Users ===');
console.log(JSON.stringify(users, null, 2));

// Ensure test user
const testEmail = 'sofianabila946@gmail.com';
const testPass = '123';
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(testEmail);

if (!existing) {
  console.log(`\n=== Seeding test user ===`);
  const hash = bcrypt.hashSync(testPass, 10);
  const result = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
    'Sofia Nabila',
    testEmail,
    hash,
    'user'
  );
  console.log(`✓ Test user created with ID: ${result.lastInsertRowid}`);
} else {
  console.log(`\n✓ Test user already exists (ID: ${existing.id})`);
}

console.log('\n=== Final Users ===');
const finalUsers = db.prepare('SELECT id, name, email, role FROM users').all();
console.log(JSON.stringify(finalUsers, null, 2));
