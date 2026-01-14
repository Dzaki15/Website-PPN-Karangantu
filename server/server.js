import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './db.js';
import path from 'node:path';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generatePbPdf } from './tools/generate-pb-pdf.js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import zlib from 'node:zlib';

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Session middleware (required for Passport)
app.use(session({
  secret: process.env.SESSION_SECRET || 'session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // set to true if using HTTPS
}));

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Increase limit for base64 images
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport serialization
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(id);
  done(null, user);
});

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8080/auth/google/callback'
  },
  (accessToken, refreshToken, profile, done) => {
    // Check if user exists
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(profile.emails[0].value);
    
    if (!user) {
      // Create new user
      const result = db.prepare('INSERT INTO users (name, email, password_hash, oauth_provider, oauth_id) VALUES (?, ?, ?, ?, ?)').run(
        profile.displayName,
        profile.emails[0].value,
        '', // no password for OAuth users
        'google',
        profile.id
      );
      user = { id: result.lastInsertRowid, name: profile.displayName, email: profile.emails[0].value };
    }
    
    return done(null, user);
  }));
}

// Facebook OAuth Strategy
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:8080/auth/facebook/callback',
    profileFields: ['id', 'displayName', 'emails']
  },
  (accessToken, refreshToken, profile, done) => {
    // Check if user exists
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : `${profile.id}@facebook.com`;
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    
    if (!user) {
      // Create new user
      const result = db.prepare('INSERT INTO users (name, email, password_hash, oauth_provider, oauth_id) VALUES (?, ?, ?, ?, ?)').run(
        profile.displayName,
        email,
        '', // no password for OAuth users
        'facebook',
        profile.id
      );
      user = { id: result.lastInsertRowid, name: profile.displayName, email: email };
    }
    
    return done(null, user);
  }));
}

// Serve static site (frontend)
// In production (Railway), the working directory can vary; resolve paths relative to this file.
const serverDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(serverDir, '..');

const staticCandidates = [
  process.env.STATIC_DIR ? path.resolve(process.env.STATIC_DIR) : null,
  repoRoot,
  path.resolve(process.cwd()),
  path.resolve(process.cwd(), '..')
].filter(Boolean);

const staticDir = staticCandidates.find((dir) => {
  try {
    return (
      fs.existsSync(path.join(dir, 'index.html')) ||
      fs.existsSync(path.join(dir, 'home.html')) ||
      fs.existsSync(path.join(dir, 'welcome.html'))
    );
  } catch {
    return false;
  }
}) || repoRoot;

console.log('[server] Serving static from:', staticDir);
app.use(express.static(staticDir));

// Simple health check route for quick verification
app.get('/ping', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

function createToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role || 'user' }, JWT_SECRET, { expiresIn: '7d' });
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const claims = jwt.verify(token, JWT_SECRET);
    const row = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(claims.id);
    if (!row) return res.status(401).json({ error: 'Unauthorized' });
    req.user = row;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return next();
}

function decodeBase64Payload(base64) {
  if (!base64 || typeof base64 !== 'string') return null;
  // Accept raw base64 or data URL
  const cleaned = base64.includes('base64,') ? base64.split('base64,')[1] : base64;
  try {
    return Buffer.from(cleaned, 'base64');
  } catch {
    return null;
  }
}

function parseDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:(image\/(png|jpeg|jpg));base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  const base64 = match[3];
  const buf = decodeBase64Payload(base64);
  if (!buf) return null;
  return { mime, buf };
}

function tryDecodeContentStreamBytes(bytes) {
  if (!bytes || !bytes.length) return '';
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  try {
    return zlib.inflateSync(buf).toString('latin1');
  } catch {
    try {
      return zlib.inflateRawSync(buf).toString('latin1');
    } catch {
      return buf.toString('latin1');
    }
  }
}

function getLastPageContentText(doc, page) {
  try {
    const contentsRef = page.node.Contents();
    if (!contentsRef) return '';
    const lookedUp = doc.context.lookup(contentsRef);
    const rawStreams = [];

    const pushStream = (maybeStream) => {
      if (!maybeStream) return;
      // pdf-lib uses PDFRawStream internally; it has a `contents` Uint8Array.
      const bytes = maybeStream.contents;
      if (bytes && bytes.length) rawStreams.push(bytes);
    };

    if (lookedUp && typeof lookedUp.asArray === 'function') {
      // PDFArray
      for (const item of lookedUp.asArray()) {
        const stream = doc.context.lookup(item);
        pushStream(stream);
      }
    } else {
      pushStream(lookedUp);
    }

    return rawStreams.map(tryDecodeContentStreamBytes).join('\n');
  } catch {
    return '';
  }
}

function findLikelyUserSignaturePlacement(content, pageWidth, pageHeight) {
  if (!content) return null;
  const placements = [];
  const num = '(-?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)';
  // Match both patterns:
  //   q a b c d e f cm /Im0 Do Q
  //   a b c d e f cm /Im0 Do
  const re = new RegExp(`${num}\\s+${num}\\s+${num}\\s+${num}\\s+${num}\\s+${num}\\s+cm\\s*\\/([^\\s]+)\\s+Do`, 'g');
  let match;
  while ((match = re.exec(content)) !== null) {
    const a = Number(match[1]);
    const d = Number(match[4]);
    const e = Number(match[5]);
    const f = Number(match[6]);
    const w = Math.abs(a);
    const h = Math.abs(d);
    placements.push({ x: e, y: f, width: w, height: h });
  }

  // Heuristic: user signature is typically the only mid-size image on the left half.
  const candidates = placements.filter(p => (
    p.width >= 30 && p.width <= 260 &&
    p.height >= 12 && p.height <= 140 &&
    p.x >= 0 && p.x <= (pageWidth / 2) &&
    p.y >= 40 && p.y <= (pageHeight - 40)
  ));
  if (!candidates.length) return null;

  const yTarget = pageHeight * 0.35; // signature blocks are usually in lower-middle.
  candidates.sort((p1, p2) => {
    const score1 = (p1.width * p1.height) - (Math.abs(p1.y - yTarget) * 5);
    const score2 = (p2.width * p2.height) - (Math.abs(p2.y - yTarget) * 5);
    return score2 - score1;
  });
  return candidates[0];
}

function formatSignedLocationDate(signedDateIsoOrText) {
  // Accept ISO date (YYYY-MM-DD) from <input type="date">. If not parseable, return raw.
  const raw = (signedDateIsoOrText || '').toString().trim();
  if (!raw) return '';
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!isoMatch) return raw;
  const year = Number(isoMatch[1]);
  const month = Number(isoMatch[2]);
  const day = Number(isoMatch[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  // Use Indonesian month names
  const formatted = dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  return `Serang, ${formatted}.`;
}

async function signPdfBytes({ pdfBytes, signatureDataUrl, signedDate, signerName, serviceSlug }) {
  const doc = await PDFDocument.load(pdfBytes);
  const pages = doc.getPages();

  const slug = (serviceSlug || '').toString().trim();
  const secondPageServices = new Set(['shti-lt', 'stblkk', 'pb', 'skkp']);
  const page = (secondPageServices.has(slug) && pages.length >= 2)
    ? pages[1]
    : pages[pages.length - 1];
  const { width } = page.getSize();

  const font = await doc.embedFont(StandardFonts.Helvetica);

  // Deterministic per-form placement (matches dev-server.js fixes)
  const defaultLayout = {
    imageX: width - 120,
    textX: (width - 120) - 60,
    labelY: 245
  };

  const layouts = {
    'penggunaan-arra': { imageX: width - 220, textX: width - 180, labelY: 380 },
    'jasa-listrik': { imageX: width - 220, textX: width - 180, labelY: 540 },
    'pengadaan-es': { imageX: width - 220, textX: width - 180, labelY: 400 },
    'shti-lt': { imageX: width - 220, textX: width - 180, labelY: 750 },
    'stblkk': { imageX: width - 220, textX: width - 180, labelY: 755 },
    'pb': { imageX: width - 220, textX: width - 180, labelY: 565 },
    'skkp': { imageX: width - 220, textX: width - 180, labelY: 120 }
  };

  const layout = layouts[slug] || defaultLayout;

  const labelLine = 'Pemberi Layanan';
  const nameText = (signerName || '').toString().trim();
  const dateLine = formatSignedLocationDate(signedDate);

  const labelY = layout.labelY;
  const imageY = labelY - 65;
  const nameY = labelY - 70;
  const dateY = labelY + 12;

  if (dateLine) {
    page.drawText(dateLine, { x: layout.textX, y: dateY, size: 8, font, color: rgb(0, 0, 0) });
  }
  page.drawText(labelLine, { x: layout.textX, y: labelY, size: 9, font, color: rgb(0, 0, 0) });
  if (nameText) {
    page.drawText(nameText, { x: layout.textX, y: nameY, size: 9, font, color: rgb(0, 0, 0) });
  }

  const parsed = parseDataUrl(signatureDataUrl);
  if (parsed) {
    const img = parsed.mime.includes('png')
      ? await doc.embedPng(parsed.buf)
      : await doc.embedJpg(parsed.buf);
    page.drawImage(img, { x: layout.imageX, y: imageY, width: 90, height: 45 });
  }

  const out = await doc.save();
  return Buffer.from(out);
}

// OAuth Routes
// Google OAuth
app.get('/auth/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).send(`
      <html>
        <head><title>OAuth Not Configured</title></head>
        <body style="font-family: Arial; padding: 40px; text-align: center;">
          <h1>Google OAuth belum dikonfigurasi</h1>
          <p>Silakan setup Google OAuth credentials terlebih dahulu.</p>
          <p>Lihat file <code>server/OAUTH_SETUP.md</code> untuk panduan.</p>
          <br>
          <a href="/login.html" style="color: #06b0b8; text-decoration: none; font-weight: bold;">← Kembali ke Login</a>
        </body>
      </html>
    `);
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login.html' }),
  (req, res) => {
    // Successful authentication
    const user = { id: req.user.id, name: req.user.name, email: req.user.email };
    const token = createToken(user);
    
    // Redirect to frontend with token
    res.redirect(`/home.html?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}`);
  }
);

// Facebook OAuth
app.get('/auth/facebook', (req, res, next) => {
  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
    return res.status(503).send(`
      <html>
        <head><title>OAuth Not Configured</title></head>
        <body style="font-family: Arial; padding: 40px; text-align: center;">
          <h1>Facebook OAuth belum dikonfigurasi</h1>
          <p>Silakan setup Facebook OAuth credentials terlebih dahulu.</p>
          <p>Lihat file <code>server/OAUTH_SETUP.md</code> untuk panduan.</p>
          <br>
          <a href="/login.html" style="color: #06b0b8; text-decoration: none; font-weight: bold;">← Kembali ke Login</a>
        </body>
      </html>
    `);
  }
  passport.authenticate('facebook', { scope: ['email'] })(req, res, next);
});

app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login.html' }),
  (req, res) => {
    // Successful authentication
    const user = { id: req.user.id, name: req.user.name, email: req.user.email };
    const token = createToken(user);
    
    // Redirect to frontend with token
    res.redirect(`/home.html?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}`);
  }
);

// Auth routes
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(name, email, hash, 'user');
  const user = { id: result.lastInsertRowid, name, email, role: 'user' };
  return res.json({ user, token: createToken(user) });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  const row = db.prepare('SELECT id, name, email, role, password_hash FROM users WHERE email = ?').get(email);
  if (!row) return res.status(401).json({ error: 'Invalid email or password' });
  const ok = bcrypt.compareSync(password, row.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
  const user = { id: row.id, name: row.name, email: row.email, role: row.role || 'user' };
  return res.json({ user, token: createToken(user) });
});

// === Submissions: user upload (used by Arsip -> admin workflow) ===
app.post('/api/submissions', auth, (req, res) => {
  const { serviceSlug, fileName, data, pdfBase64 } = req.body || {};
  if (!serviceSlug || !fileName || !pdfBase64) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const pdfBuf = decodeBase64Payload(pdfBase64);
  if (!pdfBuf || !pdfBuf.length) {
    return res.status(400).json({ error: 'Invalid pdf payload' });
  }
  const payload = JSON.stringify({ ...(data || {}), __clientFileName: fileName });

  // Upsert-ish: if same user/service/file exists and still pending, replace pdf+payload
  const existing = db.prepare(
    'SELECT id FROM submissions WHERE user_id = ? AND service_slug = ? AND file_name = ? AND status = ? ORDER BY created_at DESC LIMIT 1'
  ).get(req.user.id, serviceSlug, fileName, 'pending');

  if (existing) {
    db.prepare('UPDATE submissions SET payload = ?, pdf_blob = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?').run(payload, pdfBuf, existing.id);
    return res.json({ ok: true, id: existing.id, updated: true });
  }

  const result = db.prepare(
    'INSERT INTO submissions (user_id, service_slug, file_name, payload, pdf_blob, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, serviceSlug, fileName, payload, pdfBuf, 'pending');
  return res.json({ ok: true, id: result.lastInsertRowid });
});

// === Admin: counts + list + view pdf + sign ===
app.get('/api/admin/counts', auth, adminOnly, (req, res) => {
  const rows = db.prepare(
    "SELECT service_slug, COUNT(*) as count FROM submissions WHERE status = 'pending' GROUP BY service_slug"
  ).all();
  const counts = Object.fromEntries(rows.map(r => [r.service_slug, r.count]));
  res.json({ counts });
});

app.get('/api/admin/submissions', auth, adminOnly, (req, res) => {
  const service = (req.query.serviceSlug || req.query.service || '').toString();
  const status = (req.query.status || 'pending').toString();

  const where = [];
  const params = [];
  where.push('s.status = ?');
  params.push(status);
  where.push('s.admin_deleted = 0');
  if (service) {
    where.push('s.service_slug = ?');
    params.push(service);
  }
  const sql = `
    SELECT s.id, s.user_id, s.service_slug, s.file_name, s.status, s.created_at, s.signed_at, s.signed_date,
           u.name as user_name, u.email as user_email, u.avatar as user_avatar
    FROM submissions s
    JOIN users u ON u.id = s.user_id
    WHERE ${where.join(' AND ')}
    ORDER BY s.created_at DESC
  `;
  const rows = db.prepare(sql).all(...params);
  res.json({ items: rows });
});

// Admin: view user profile (for showing identity details when reviewing submissions)
app.get('/api/admin/users/:id', auth, adminOnly, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid user id' });
  const row = db.prepare(
    'SELECT id, name, email, role, phone, address, avatar, profile_extra FROM users WHERE id = ?'
  ).get(id);
  if (!row) return res.status(404).json({ error: 'User not found' });
  return res.json({ success: true, data: row });
});

app.get('/api/admin/submissions/:id/pdf', auth, adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT file_name, pdf_blob FROM submissions WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${row.file_name || `submission-${id}.pdf`}"`);
  return res.send(row.pdf_blob);
});

app.post('/api/admin/submissions/:id/sign', auth, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const { signatureDataUrl, signedDate, signerName } = req.body || {};
  const row = db.prepare('SELECT id, pdf_blob, status, service_slug FROM submissions WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.status !== 'pending') {
    return res.status(409).json({ error: 'Submission is not pending' });
  }
  try {
    const resolvedSignerName = (signerName || req.user.name || '').toString().trim();
    const signedPdf = await signPdfBytes({
      pdfBytes: row.pdf_blob,
      signatureDataUrl,
      signedDate,
      signerName: resolvedSignerName,
      serviceSlug: row.service_slug
    });
    db.prepare(
      `UPDATE submissions
       SET status = 'signed',
           signed_at = CURRENT_TIMESTAMP,
           signed_by = ?,
           signed_date = ?,
           signer_name = ?,
           signature_data_url = ?,
           signed_pdf_blob = ?
       WHERE id = ?`
    ).run(req.user.id, signedDate || null, resolvedSignerName || null, signatureDataUrl || null, signedPdf, id);
    return res.json({ ok: true });
  } catch (e) {
    console.error('Failed to sign submission', e);
    return res.status(500).json({ error: 'Failed to sign PDF' });
  }
});

app.post('/api/admin/submissions/:id/reject', auth, adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT id, status FROM submissions WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.status !== 'pending') {
    return res.status(409).json({ error: 'Submission is not pending' });
  }
  db.prepare(
    `UPDATE submissions SET status = 'rejected', signed_at = CURRENT_TIMESTAMP, signed_by = ? WHERE id = ?`
  ).run(req.user.id, id);
  return res.json({ ok: true });
});

// === Admin: delete submission (used by Arsip Dokumen admin view) ===
app.delete('/api/admin/submissions/:id', auth, adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT status FROM submissions WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  // If already signed, soft-delete to preserve user archive (PDF + status)
  if (row.status === 'signed') {
    const info = db.prepare('UPDATE submissions SET admin_deleted = 1, admin_deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    if (!info || info.changes === 0) return res.status(404).json({ error: 'Not found' });
    return res.json({ ok: true, softDeleted: true });
  }

  // Pending/rejected can be removed fully
  const info = db.prepare('DELETE FROM submissions WHERE id = ?').run(id);
  if (!info || info.changes === 0) return res.status(404).json({ error: 'Not found' });
  return res.json({ ok: true, deleted: true });
});

app.get('/api/admin/submissions/:id/signed-pdf', auth, adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT file_name, signed_pdf_blob FROM submissions WHERE id = ? AND status = ? AND admin_deleted = 0').get(id, 'signed');
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (!row.signed_pdf_blob) return res.status(404).json({ error: 'Signed PDF not available' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${row.file_name || `signed-${id}.pdf`}"`);
  return res.send(row.signed_pdf_blob);
});

// === User: fetch signed submissions (for Arsip sync) ===
app.get('/api/my/signed-submissions', auth, (req, res) => {
  const rows = db.prepare(
    "SELECT id, service_slug, file_name, signed_at, signed_date FROM submissions WHERE user_id = ? AND status = 'signed' ORDER BY signed_at DESC"
  ).all(req.user.id);
  res.json({ items: rows });
});

// === User: fetch submissions by status (pending/rejected/signed) ===
app.get('/api/my/submissions', auth, (req, res) => {
  const status = String((req.query.status || 'pending')).toLowerCase();
  const allowed = new Set(['pending','rejected','signed']);
  const useStatus = allowed.has(status) ? status : 'pending';
  const baseCols = 'id, service_slug, file_name, created_at, signed_at, signed_date, status';
  const sql = `SELECT ${baseCols} FROM submissions WHERE user_id = ? AND status = ? ORDER BY created_at DESC`;
  const rows = db.prepare(sql).all(req.user.id, useStatus);
  res.json({ items: rows });
});

// === User: delete own submission (used by Arsip Dokumen) ===
app.delete('/api/my/submissions/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare('DELETE FROM submissions WHERE id = ? AND user_id = ?').run(id, req.user.id);
  if (!info || info.changes === 0) return res.status(404).json({ error: 'Not found' });
  return res.json({ ok: true });
});

app.get('/api/my/signed-count', auth, (req, res) => {
  const row = db.prepare(
    "SELECT COUNT(*) as count FROM submissions WHERE user_id = ? AND status = 'signed'"
  ).get(req.user.id);
  res.json({ count: row ? row.count : 0 });
});

app.get('/api/my/signed-submissions/:id/pdf', auth, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(
    "SELECT file_name, signed_pdf_blob FROM submissions WHERE id = ? AND user_id = ? AND status = 'signed'"
  ).get(id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (!row.signed_pdf_blob) return res.status(404).json({ error: 'Signed PDF not available' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${row.file_name || `signed-${id}.pdf`}"`);
  return res.send(row.signed_pdf_blob);
});

app.get('/api/me', auth, (req, res) => {
  const row = db.prepare('SELECT id, name, email, role, phone, address, avatar, profile_extra FROM users WHERE id = ?').get(req.user.id);
  if (!row) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  return res.json({ success: true, data: row });
});

app.put('/api/me', auth, (req, res) => {
  const { name, phone, address, avatar, profileExtra } = req.body || {};
  let profileExtraJson = null;
  if (profileExtra !== undefined) {
    try {
      profileExtraJson = JSON.stringify(profileExtra || {});
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Invalid profileExtra' });
    }
  }
  
  try {
    const wantsAvatar = Boolean(avatar);
    const wantsExtra = profileExtra !== undefined;

    if (wantsAvatar && wantsExtra) {
      db.prepare('UPDATE users SET name = ?, phone = ?, address = ?, avatar = ?, profile_extra = ? WHERE id = ?').run(
        name || '',
        phone || '',
        address || '',
        avatar || null,
        profileExtraJson,
        req.user.id
      );
    } else if (wantsAvatar) {
      db.prepare('UPDATE users SET name = ?, phone = ?, address = ?, avatar = ? WHERE id = ?').run(
        name || '',
        phone || '',
        address || '',
        avatar || null,
        req.user.id
      );
    } else if (wantsExtra) {
      db.prepare('UPDATE users SET name = ?, phone = ?, address = ?, profile_extra = ? WHERE id = ?').run(
        name || '',
        phone || '',
        address || '',
        profileExtraJson,
        req.user.id
      );
    } else {
      db.prepare('UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?').run(
        name || '',
        phone || '',
        address || '',
        req.user.id
      );
    }
    
    const updated = db.prepare('SELECT id, name, email, phone, address, avatar, profile_extra FROM users WHERE id = ?').get(req.user.id);
    return res.json({ success: true, data: updated, message: 'Profil berhasil diperbarui' });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Error updating profile: ' + error.message });
  }
});

// PB forms
app.get('/api/pb', auth, (req, res) => {
  const rows = db.prepare('SELECT id, status, created_at, updated_at, payload FROM pb_forms WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  const items = rows.map(r => ({ id: r.id, status: r.status, created_at: r.created_at, updated_at: r.updated_at, data: JSON.parse(r.payload) }));
  res.json({ items });
});

app.post('/api/pb', auth, (req, res) => {
  const payload = JSON.stringify(req.body || {});
  const result = db.prepare('INSERT INTO pb_forms (user_id, payload, status) VALUES (?, ?, ?)').run(req.user.id, payload, 'draft');
  const item = db.prepare('SELECT * FROM pb_forms WHERE id = ?').get(result.lastInsertRowid);
  res.json({ id: item.id, status: item.status, created_at: item.created_at, updated_at: item.updated_at, data: JSON.parse(item.payload) });
});

app.put('/api/pb/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM pb_forms WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const status = req.body.status || existing.status;
  const payload = req.body.data ? JSON.stringify(req.body.data) : existing.payload;
  db.prepare('UPDATE pb_forms SET status = ?, payload = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, payload, id);
  const row = db.prepare('SELECT * FROM pb_forms WHERE id = ?').get(id);
  res.json({ id: row.id, status: row.status, created_at: row.created_at, updated_at: row.updated_at, data: JSON.parse(row.payload) });
});

// New: pdf-lib PB generator endpoint
app.get('/api/generate-pb-pdf/:id', auth, async (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM pb_forms WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  let data = {};
  try { data = JSON.parse(row.payload); } catch {}
  try {
    const bytes = await generatePbPdf(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PB-${id}.pdf"`);
    return res.send(Buffer.from(bytes));
  } catch (e) {
    console.error('PB pdf-lib generation failed', e);
    return res.status(500).json({ error: 'PB PDF generation failed' });
  }
});

// Server-side PDF generation for PB form (uses Puppeteer when available)
app.get('/api/pb/:id/pdf', auth, async (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM pb_forms WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  let data = {};
  try { data = JSON.parse(row.payload); } catch (e) { data = {}; }

  // improved HTML template to better match the printed sample
  const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
      body { font-family: 'Poppins', Arial, Helvetica, sans-serif; font-size:12px; color:#111; margin:0; padding:20px }
      .container { max-width: 800px; margin: 0 auto }
      .header { text-align:center; font-weight:700; margin-bottom:6px }
      .subheader { text-align:center; font-size:12px; margin-bottom:12px }
      .info { margin-top:6px; font-size:11px }
      .info .row { margin-bottom:6px }
      .checklist { margin-top:8px; font-size:11px }
      .checklist ul { padding-left:18px; margin:6px 0 }
      .checklist li { margin-bottom:4px }
      table { width:100%; border-collapse: collapse; margin-top:12px; font-size:11px }
      table th{ background:#f5f7f7; padding:6px; border:1px solid #bdbdbd; font-weight:600 }
      table td{ padding:6px; border:1px solid #bdbdbd; vertical-align:top }
      .sig { margin-top:28px; display:flex; justify-content:space-between; align-items:flex-end }
      .sig .col { width:45%; text-align:center }
      .small { font-size:10px; color:#555 }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">KARTU KENDALI PELAYANAN PUBLIK</div>
      <div class="subheader">PELABUHAN PERIKANAN NUSANTARA KARANGANTU</div>

      <div class="info">
        <div class="row"><strong>Nama Layanan</strong> : ${escapeHtml(data.namaLayanan || 'Pelayanan PB')}</div>
        <div class="row"><strong>Pengguna</strong> : ${escapeHtml(data.namaPengguna || data.nama || '')}</div>
        <div class="row"><strong>Alamat</strong> : ${escapeHtml(data.alamat || '')}</div>
      </div>

      <div class="checklist">
        <strong>Persyaratan :</strong>
        <ul>
          <li>✔ surat pernyataan kesiapan Kapal Perikanan berangkat dari Nakhoda (Master Sailing Declaration);</li>
          <li>✔ bukti pemenuhan pembayaran pajak pertambahan nilai, bagi Kapal Perikanan yang menggunakan bahan bakar minyak nonsubsidi;</li>
          <li>✔ Surat Laik Operasi (SLO);</li>
          <li>✔ Surat Tanda Bukti Lapor Kedatangan Kapal (STBLKK);</li>
          <li>✔ Perjanjian Kerja Laut (PKL); dan</li>
          <li>✔ Dokumen kapal lainnya (Pas Besar/Pas Kecil, Sertifikat Kelaikan, Surat Ukur, Daftar Awak, Buku Sijil, dan dokumen terkait)</li>
        </ul>
      </div>

      <table>
        <thead>
          <tr><th style="width:40px">No</th><th>Tahapan</th><th style="width:80px">Waktu</th><th style="width:60px">Mulai</th><th style="width:60px">Selesai</th><th>Keterangan</th></tr>
        </thead>
        <tbody>
          <tr><td>1</td><td>Menerima laporan rencana keberangkatan kapal yang dilengkapi dengan dokumen persyaratan administrasi untuk permohonan penerbitan Persetujuan Berlayar (PB) dari Nakhoda atau Pemilik Kapal Perikanan/ Penanggung Jawab Perusahaan, dan meneruskan laporan serta kelengkapannya kepada Petugas Kesyahbandaran</td><td>5 Menit</td><td>14.00</td><td>14.05</td><td>-</td></tr>
          <tr><td>2</td><td>Melakukan pemeriksaan kelengkapan surat dan validitas dokumen kapal perikanan untuk penerbitan PB, dan dokumen kapal lainnya termasuk pemeriksaan kewajiban pelunasan PNBP PHP, dan menyampaikan hasil pemeriksaan tersebut kepada Syahbandar di Pelabuhan Perikanan</td><td>10 Menit</td><td>14.05</td><td>14.15</td><td>-</td></tr>
          <tr><td>3</td><td>Menerima hasil pemeriksaan kelengkapan surat dan validitas dokumen kapal perikanan untuk penerbitan PB, dan dokumen kapal lainnya termasuk pemeriksaan kewajiban pelunasan PNBP PHP dan menugaskan pemeriksaan teknis dan nautis kepada Petugas Kesyahbandaran</td><td>5 Menit</td><td>14.15</td><td>14.20</td><td>-</td></tr>
          <tr><td>4</td><td>Melakukan pemeriksaan di atas kapal, terkait: a. teknis dan nautis terhadap kapal perikanan dan alat penangkapan ikan, alat bantu penangkapan ikan; dan; b. pemeriksaan persyaratan pengawakan kapal perikanan, untuk selanjutnya hasil pemeriksaan tersebut disampaikan kepada Syahbandar di Pelabuhan Perikanan</td><td>60 Menit</td><td>14.20</td><td>15.20</td><td>-</td></tr>
          <tr><td>5</td><td>Melakukan pemeriksaan ulang kelengkapan dokumen kapal perikanan untuk melihat kelengkapan dan kesesuaian dokumen Kapal Perikanan. Berdasarkan hasil pemeriksaan ulang dinyatakan lengkap dan sesuai, selanjutnya dilakukan penandatanganan dalam aplikasi Teman SPB dan menerbitkan kepada Petugas Kesyahbandaran untuk proses lanjut.</td><td>10 Menit</td><td>15.20</td><td>15.30</td><td>-</td></tr>
          <tr><td>6</td><td>Mencetak dan menyerahkan PB kepada Syahbandar di Pelabuhan Perikanan dan mengarsipkan salinan dokumen PB</td><td>5 Menit</td><td>15.30</td><td>15.35</td><td>-</td></tr>
          <tr><td>7</td><td>Menerima dokumen PB dan menyerahkan kepada Nakhoda atau Pemilik Kapal Perikanan/Penanggung Jawab Perusahaan</td><td>15 Menit</td><td>15.35</td><td>15.50</td><td>-</td></tr>
        </tbody>
      </table>

      <div class="sig">
        <div class="col">
          <div class="small">Penerima Layanan</div>
          <div style="height:60px"></div>
          <div>(${escapeHtml(data.namaPengguna || data.nama || '')})</div>
        </div>
        <div class="col">
          <div class="small">Pemberi Layanan</div>
          <div style="height:60px"></div>
          <div>(Bambang)</div>
        </div>
      </div>
    </div>
  </body>
  </html>`;

  // If a PDF template exists in assets, use pdf-lib to fill it for pixel-exact result
  const templatePath = path.join(process.cwd(), 'assets', 'PB 2025.pdf');
  try {
    if (fs.existsSync(templatePath)){
      // dynamic import pdf-lib
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
      const existingPdfBytes = fs.readFileSync(templatePath);
      const pdfDoc = await PDFDocument.load(existingPdfBytes);

      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();

      // embed a standard font
      const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontSize = 10;

      // Helper to draw left-aligned text
      const drawText = (text, x, y, options = {}) => {
        firstPage.drawText(String(text || ''), { x, y, size: options.size || fontSize, font: helv, color: options.color || rgb(0,0,0) });
      };

      // Approximate positions (points) based on A4: tweak if needed
      // Header is already in template; write fields in their places
      drawText(data.namaLayanan || 'Pelayanan PB', 60, height - 140, { size: 11 });
      drawText(data.namaPengguna || data.nama || '', 60, height - 160, { size: 11 });

      // Address may be multi-line
      const address = data.alamat || '';
      const addrLines = helv.splitTextToSize ? helv.splitTextToSize(address, 380) : [address];
      let ay = height - 180;
      for (const ln of addrLines) {
        drawText(ln, 60, ay, { size: 10 });
        ay -= 12;
      }

      // If signature exists in payload (data URL), embed it
      const signatureData = data.signature || null;
      if(!signatureData && typeof data.signature === 'undefined'){
        // also check local storage scenario: data may not contain signature; we won't handle client-only signature here
      }
      if (signatureData && signatureData.startsWith('data:')){
        try{
          const matches = signatureData.match(/^data:(image\/png|image\/jpeg);base64,(.+)$/);
          if (matches){
            const imgType = matches[1];
            const imgBase64 = matches[2];
            const imgBytes = Buffer.from(imgBase64, 'base64');
            let img;
            if (imgType === 'image/png') img = await pdfDoc.embedPng(imgBytes);
            else img = await pdfDoc.embedJpg(imgBytes);
            const imgDims = img.scale(0.5);
            // place signature roughly bottom-left area
            firstPage.drawImage(img, { x: 80, y: 120, width: imgDims.width, height: imgDims.height });
          }
        }catch(e){ console.warn('signature embed failed', e); }
      }

      const modifiedPdfBytes = await pdfDoc.save();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="PB-${id}.pdf"`);
      return res.send(Buffer.from(modifiedPdfBytes));
    }
  } catch (err){
    console.error('pdf-lib fill failed', err);
    // fallthrough to Puppeteer rendering below
  }

  // dynamic import of puppeteer so server can run without it installed
  let mod;
  try {
    mod = await import('puppeteer');
  } catch (e) {
    return res.status(500).json({ error: 'Puppeteer is not installed on the server. Run `npm install puppeteer` in server folder.' });
  }
  const puppeteer = mod.default || mod;

  let browser;
  try {
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
    await browser.close();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PB-${id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    if (browser) try { await browser.close(); } catch (e) {}
    console.error('PDF generation failed', err);
    return res.status(500).json({ error: 'PDF generation failed' });
  }
});

function escapeHtml(s){
  if(!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ES (Pengadaan Es) endpoints
app.post('/api/es/submit', auth, (req, res) => {
  try {
    const payload = JSON.stringify(req.body || {});
    const result = db.prepare('INSERT INTO es_forms (user_id, payload, status) VALUES (?, ?, ?)').run(req.user.id, payload, 'completed');
    const item = db.prepare('SELECT * FROM es_forms WHERE id = ?').get(result.lastInsertRowid);
    res.json({ 
      ok: true, 
      id: item.id, 
      status: item.status, 
      created_at: item.created_at, 
      data: JSON.parse(item.payload) 
    });
  } catch (err) {
    console.error('ES form submit error:', err);
    res.status(500).json({ ok: false, message: 'Gagal menyimpan dokumen' });
  }
});

app.get('/api/es', auth, (req, res) => {
  try {
    const rows = db.prepare('SELECT id, status, created_at, payload FROM es_forms WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    const items = rows.map(r => ({ 
      id: r.id, 
      status: r.status, 
      created_at: r.created_at, 
      data: JSON.parse(r.payload) 
    }));
    res.json({ items });
  } catch (err) {
    console.error('ES forms fetch error:', err);
    res.status(500).json({ error: 'Gagal mengambil data' });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] Backend listening on 0.0.0.0:${PORT}`);
});
