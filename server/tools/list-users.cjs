const Database = require('better-sqlite3');
const path = require('path');
const dbPath = process.env.SQLITE_PATH || path.join(__dirname, '..', 'data.db');
const db = new Database(dbPath, { readonly: true });
const rows = db.prepare('SELECT id, name, email, role FROM users ORDER BY id').all();
console.log(JSON.stringify(rows, null, 2));
