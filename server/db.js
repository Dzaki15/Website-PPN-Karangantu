import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';

const dbPath = process.env.SQLITE_PATH || './data.db';
const dir = path.dirname(dbPath);
if (dir && dir !== '.' && !fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(dbPath);

function ensureColumn(table, column, definitionSql) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = cols.some(c => c.name === column);
  if (exists) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${definitionSql};`);
}

// Initialize tables
// users: id, name, email(unique), password_hash, created_at
// pb_forms: id, user_id, payload(json string), status, created_at, updated_at
// es_forms: id, user_id, payload(json string), status, created_at

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  phone TEXT,
  address TEXT,
  avatar TEXT,
  profile_extra TEXT,
  oauth_provider TEXT,
  oauth_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pb_forms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS es_forms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  service_slug TEXT NOT NULL,
  file_name TEXT NOT NULL,
  payload TEXT NOT NULL,
  pdf_blob BLOB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  signed_at DATETIME,
  signed_by INTEGER,
  signed_date TEXT,
  signer_name TEXT,
  signature_data_url TEXT,
  signed_pdf_blob BLOB,
  admin_deleted INTEGER NOT NULL DEFAULT 0,
  admin_deleted_at DATETIME,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(signed_by) REFERENCES users(id)
 );
`);

// Backward-compatible migrations (in case tables were created before these columns existed)
ensureColumn('users', 'role', "role TEXT NOT NULL DEFAULT 'user'");
ensureColumn('users', 'profile_extra', 'profile_extra TEXT');
ensureColumn('submissions', 'admin_deleted', 'admin_deleted INTEGER NOT NULL DEFAULT 0');
ensureColumn('submissions', 'admin_deleted_at', 'admin_deleted_at DATETIME');

// Seed test user if not exists
const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get('sofianabila946@gmail.com');
if (!existingUser) {
  const hashedPassword = bcrypt.hashSync('123', 10);
  db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
    'Sofia Nabila',
    'sofianabila946@gmail.com',
    hashedPassword,
    'user'
  );
}

// Seed default admin account if not exists.
// You can override via env vars ADMIN_EMAIL / ADMIN_PASSWORD.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@ppn.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_EMAIL);
if (!existingAdmin) {
  const hashedPassword = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
    'Admin',
    ADMIN_EMAIL,
    hashedPassword,
    'admin'
  );
} else {
  // Ensure role is admin
  db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(ADMIN_EMAIL);
}

export default db;
