import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { PDFDocument, rgb } from 'pdf-lib';
import { fileURLToPath } from 'node:url';

const app = express();
const PORT = process.env.PORT || 8080;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static frontend (auto-detect common folders)
const staticCandidates = [
  path.join(__dirname, '..'),
  path.join(__dirname, '..', 'Website PPN Karangantu'),
];
let staticDir = process.env.STATIC_DIR;
if (!staticDir) {
  staticDir =
    staticCandidates.find((dir) => {
      try {
        return (
          fs.existsSync(path.join(dir, 'index.html')) ||
          fs.existsSync(path.join(dir, 'home.html'))
        );
      } catch {
        return false;
      }
    }) || staticCandidates[0];
}
console.log('[dev-server] Serving static from:', staticDir);
app.use(express.static(staticDir));

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  try {
    const auth = req.headers.authorization || '';
    console.log(new Date().toISOString(), req.method, req.url, 'auth=', auth);
  } catch {
    // ignore
  }
  next();
});

// Seed users
const users = [
  { id: 1, name: 'Admin', email: 'admin@ppn.local', password_hash: bcrypt.hashSync('admin123', 10), role: 'admin' },
  { id: 2, name: 'Sofia Nabila', email: 'sofianabila946@gmail.com', password_hash: bcrypt.hashSync('123', 10), role: 'user' },
  { id: 3, name: 'Dza Ki Hakim', email: 'dzakihakim333@gmail.com', password_hash: bcrypt.hashSync('123', 10), role: 'user' },
];
let nextUserId = 4;
let nextSubmissionId = 1;
let submissions = [];

// Persist lightweight user profile fields for dev.
// We keep auth users seeded in code, but allow updating profile data via /api/me.
let userProfiles = {};

const DATA_FILE = path.join(__dirname, 'dev-data.json');

function loadPersistedState() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.submissions)) submissions = parsed.submissions;
    if (parsed && typeof parsed.userProfiles === 'object' && parsed.userProfiles) userProfiles = parsed.userProfiles;
    // Backward-compatible migration for older dev-data.json
    submissions = submissions.map((s) => ({
      ...s,
      admin_deleted: Boolean(s && s.admin_deleted),
      admin_deleted_at: (s && s.admin_deleted_at) || null,
      user_deleted: Boolean(s && s.user_deleted),
      user_deleted_at: (s && s.user_deleted_at) || null,
    }));
    const maxId = submissions.reduce((m, s) => Math.max(m, Number(s?.id) || 0), 0);
    nextSubmissionId = maxId + 1;
    console.log(`[dev-server] Loaded ${submissions.length} submissions from dev-data.json`);
  } catch (e) {
    console.warn('[dev-server] Failed to load dev-data.json:', e?.message || e);
  }
}
function persistState() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ submissions, userProfiles }, null, 2), 'utf8');
  } catch (e) {
    console.warn('[dev-server] Failed to persist dev-data.json:', e?.message || e);
  }
}
loadPersistedState();

function createToken(user) {
  return `dev-token-${user.id}-${Date.now()}`;
}

function parseDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:(image\/(png|jpeg|jpg));base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], base64: match[3] };
}

function formatDateIndonesian(dateStr) {
  try {
    const date = new Date(dateStr);
    const day = date.getDate();
    const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}, ${month} ${year}`;
  } catch {
    return String(dateStr || '');
  }
}

async function addSignatureToPdf(pdfBase64, signatureDataUrl, signedDate, signerName, serviceSlug) {
  try {
    const pdfBytes = Buffer.from(pdfBase64, 'base64');
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    
    // For SHTI LT, STBLKK, PB, and SKKP, use page 2; for others, use last page
    let targetPage;
    if ((serviceSlug === 'shti-lt' || serviceSlug === 'stblkk' || serviceSlug === 'pb' || serviceSlug === 'skkp') && pages.length >= 2) {
      targetPage = pages[1]; // Page 2 for SHTI LT, STBLKK, PB, and SKKP
    } else {
      targetPage = pages[pages.length - 1]; // Last page for others
    }
    
    const { width } = targetPage.getSize();

    // Different coordinates per service type
    let imageDrawX, textDrawX, PEMBERI_LABEL_Y;
    
    if (serviceSlug === 'penggunaan-arra') {
      // Penggunaan ARRA: signature left, text right
      imageDrawX = width - 220;
      textDrawX = width - 180;
      PEMBERI_LABEL_Y = 380;
    } else if (serviceSlug === 'jasa-listrik') {
      // Jasa Listrik: signature and text aligned on right
      imageDrawX = width - 220;
      textDrawX = width - 180;
      PEMBERI_LABEL_Y = 540;
    } else if (serviceSlug === 'pengadaan-es') {
      // Pengadaan ES: signature aligned with green box on right side
      imageDrawX = width - 220;
      textDrawX = width - 180;
      PEMBERI_LABEL_Y = 400; // Turunkan lebih jauh agar masuk ke kotak hijau dan sejajar dengan penerima layanan
    } else if (serviceSlug === 'shti-lt') {
      // SHTI LT: signature positioned in upper green box area on page 2
      imageDrawX = width - 220;
      textDrawX = width - 180;
      PEMBERI_LABEL_Y = 750; // Naikkan lagi untuk sejajar dengan penerima layanan
    } else if (serviceSlug === 'stblkk') {
      // STBLKK: signature aligned with green box on right side (page 2)
      imageDrawX = width - 220;
      textDrawX = width - 180;
      PEMBERI_LABEL_Y = 755; // Posisi sejajar dengan penerima layanan STBLKK
    } else if (serviceSlug === 'pb') {
      // PB: signature aligned with green box on right side (page 2)
      imageDrawX = width - 220;
      textDrawX = width - 180;
      PEMBERI_LABEL_Y = 565; // Naikkan lagi agar masuk ke dalam kotak hijau dan sejajar dengan penerima layanan PB
    } else if (serviceSlug === 'skkp') {
      // SKKP: signature aligned with green box on right side (page 2)
      imageDrawX = width - 220;
      textDrawX = width - 180;
      PEMBERI_LABEL_Y = 120; // Naikkan sedikit agar sejajar dengan penerima layanan SKKP
    } else {
      // Other services: original position
      imageDrawX = width - 120;
      textDrawX = imageDrawX - 60;
      PEMBERI_LABEL_Y = 245;
    }

    const PEMBERI_IMAGE_Y = PEMBERI_LABEL_Y - 65;
    const PEMBERI_NAME_Y = PEMBERI_LABEL_Y - 70;
    const PEMBERI_DATE_Y = PEMBERI_LABEL_Y + 12;

    const formattedDate = formatDateIndonesian(signedDate || new Date().toISOString());

    targetPage.drawText('Pemberi Layanan', { x: textDrawX, y: PEMBERI_LABEL_Y, size: 9, color: rgb(0, 0, 0) });
    targetPage.drawText(formattedDate, { x: textDrawX, y: PEMBERI_DATE_Y, size: 8, color: rgb(0, 0, 0) });

    const parsed = parseDataUrl(signatureDataUrl);
    if (parsed) {
      const imgBytes = Buffer.from(parsed.base64, 'base64');
      const embedded = parsed.mime.includes('png') ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);
      targetPage.drawImage(embedded, { x: imageDrawX, y: PEMBERI_IMAGE_Y, width: 90, height: 45 });
    }

    targetPage.drawText(signerName || 'Admin', { x: textDrawX, y: PEMBERI_NAME_Y, size: 9, color: rgb(0, 0, 0) });

    const modifiedPdfBytes = await pdfDoc.save();
    return Buffer.from(modifiedPdfBytes).toString('base64');
  } catch (e) {
    console.error('Error adding signature to PDF:', e?.message || e);
    return pdfBase64;
  }
}

function parseBearerToken(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  return token || '';
}
function getUserFromToken(token) {
  const m = String(token).match(/^dev-token-(\d+)-\d+/);
  if (!m) return null;
  const id = Number(m[1]);
  return users.find((u) => u.id === id) || null;
}

function getProfileForUserId(userId) {
  const key = String(userId);
  const p = (userProfiles && userProfiles[key]) ? userProfiles[key] : {};
  return {
    phone: typeof p.phone === 'string' ? p.phone : '',
    address: typeof p.address === 'string' ? p.address : '',
    avatar: typeof p.avatar === 'string' ? p.avatar : null,
  };
}

function setProfileForUserId(userId, updates) {
  const key = String(userId);
  const prev = (userProfiles && userProfiles[key]) ? userProfiles[key] : {};
  userProfiles = userProfiles || {};
  userProfiles[key] = {
    ...prev,
    ...(updates || {}),
  };
  persistState();
}
function requireAuthToken(req, res, next) {
  const token = parseBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const user = getUserFromToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid token' });
  req.user = user;
  next();
}
function requireAdminToken(req, res, next) {
  const token = parseBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const user = getUserFromToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid token' });
  if (user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  req.user = user;
  next();
}

app.get('/api/health', (req, res) => res.json({ ok: true, dev: true }));

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  const row = users.find((u) => u.email === email);
  if (!row) return res.status(401).json({ error: 'Invalid email or password' });
  if (!bcrypt.compareSync(password, row.password_hash)) return res.status(401).json({ error: 'Invalid email or password' });
  const profile = getProfileForUserId(row.id);
  const user = { id: row.id, name: row.name, email: row.email, role: row.role, ...profile };
  return res.json({ user, token: createToken(user) });
});

app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  if (users.some((u) => u.email === email)) return res.status(400).json({ error: 'Email sudah terdaftar' });
  const newUser = { id: nextUserId++, name, email, password_hash: bcrypt.hashSync(password, 10), role: 'user' };
  users.push(newUser);
  const profile = getProfileForUserId(newUser.id);
  const user = { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, ...profile };
  return res.json({ user, token: createToken(user) });
});

app.get('/api/me', (req, res) => {
  const token = parseBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const user = getUserFromToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid token' });
  const profile = getProfileForUserId(user.id);
  return res.json({
    success: true,
    data: { id: user.id, name: user.name, email: user.email, role: user.role, ...profile },
  });
});

app.put('/api/me', (req, res) => {
  const token = parseBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const user = getUserFromToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid token' });

  const { name, phone, address, avatar } = req.body || {};
  const nextName = typeof name === 'string' ? name.trim() : '';
  if (!nextName) return res.status(400).json({ success: false, message: 'Nama lengkap harus diisi' });

  // Update name on the user record
  user.name = nextName;

  const updates = {};
  if (typeof phone === 'string') updates.phone = phone;
  if (typeof address === 'string') updates.address = address;
  if (typeof avatar === 'string' || avatar === null) updates.avatar = avatar;
  setProfileForUserId(user.id, updates);

  const profile = getProfileForUserId(user.id);
  return res.json({
    success: true,
    data: { id: user.id, name: user.name, email: user.email, role: user.role, ...profile },
  });
});

app.post('/api/submissions', requireAuthToken, (req, res) => {
  const { serviceSlug, fileName, data, pdfBase64 } = req.body || {};
  if (!serviceSlug || !fileName || !pdfBase64) return res.status(400).json({ error: 'Missing fields' });

  const existing = submissions.find((s) => s.user_id === req.user.id && s.service_slug === serviceSlug && s.file_name === fileName && s.status === 'pending');

  if (existing) {
    existing.payload = data || {};
    existing.pdf_base64 = pdfBase64;
    existing.created_at = new Date().toISOString();
    if (!existing.user_name) existing.user_name = req.user.name;
    persistState();
    return res.json({ ok: true, id: existing.id, updated: true });
  }

  const newSubmission = {
    id: nextSubmissionId++,
    user_id: req.user.id,
    user_name: req.user.name,
    service_slug: serviceSlug,
    file_name: fileName,
    payload: data || {},
    pdf_base64: pdfBase64,
    status: 'pending',
    created_at: new Date().toISOString(),
    admin_deleted: false,
    admin_deleted_at: null,
    user_deleted: false,
    user_deleted_at: null,
  };
  submissions.push(newSubmission);
  persistState();
  return res.json({ ok: true, id: newSubmission.id });
});

app.get('/api/admin/counts', requireAdminToken, (req, res) => {
  const counts = { skkp: 0, pb: 0, 'pengadaan-es': 0, stblkk: 0, 'shti-lt': 0, 'jasa-listrik': 0, 'penggunaan-arra': 0 };
  submissions.forEach((s) => {
    if (s.status === 'pending' && Object.prototype.hasOwnProperty.call(counts, s.service_slug)) counts[s.service_slug]++;
  });
  return res.json({ counts });
});

app.get('/api/admin/submissions', requireAdminToken, (req, res) => {
  const status = req.query.status || 'pending';
  const serviceSlug = req.query.serviceSlug;
  // Hide entries deleted from admin archive while keeping them for user archive
  let filtered = submissions.filter((s) => s.status === status && !s.admin_deleted);
  if (serviceSlug) filtered = filtered.filter((s) => s.service_slug === serviceSlug);
  return res.json({ items: filtered });
});

app.get('/api/admin/submissions/:id/pdf', requireAdminToken, (req, res) => {
  const id = Number(req.params.id);
  const row = submissions.find((s) => s.id === id);
  if (!row || !row.pdf_base64) return res.status(404).json({ error: 'PDF not found' });
  const buf = Buffer.from(row.pdf_base64, 'base64');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', buf.length);
  return res.send(buf);
});

app.get('/api/admin/submissions/:id/signed-pdf', requireAdminToken, (req, res) => {
  const id = Number(req.params.id);
  const row = submissions.find((s) => s.id === id && s.status === 'signed' && !s.admin_deleted);
  if (!row || !row.signed_pdf_base64) return res.status(404).json({ error: 'Signed PDF not found' });
  const buf = Buffer.from(row.signed_pdf_base64, 'base64');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', buf.length);
  return res.send(buf);
});

app.post('/api/admin/submissions/:id/sign', requireAdminToken, async (req, res) => {
  const id = Number(req.params.id);
  const row = submissions.find((s) => s.id === id);
  if (!row) return res.status(404).json({ error: 'Submission not found' });
  if (row.status !== 'pending') return res.status(400).json({ error: 'Submission not pending' });

  const { signatureDataUrl, signedDate, signerName } = req.body || {};
  row.signatureDataUrl = signatureDataUrl || '';
  row.signed_date = signedDate || new Date().toISOString();
  row.signed_by = signerName || req.user.name || 'admin';
  row.signed_pdf_base64 = await addSignatureToPdf(row.pdf_base64, signatureDataUrl, row.signed_date, row.signed_by, row.service_slug);
  row.status = 'signed';
  row.signed_at = new Date().toISOString();
  persistState();
  return res.json({ ok: true });
});

app.post('/api/admin/submissions/:id/reject', requireAdminToken, (req, res) => {
  const id = Number(req.params.id);
  const row = submissions.find((s) => s.id === id);
  if (!row) return res.status(404).json({ error: 'Submission not found' });
  if (row.status !== 'pending') return res.status(400).json({ error: 'Submission not pending' });
  row.status = 'rejected';
  row.rejected_at = new Date().toISOString();
  row.rejected_by = req.user.name;
  persistState();
  return res.json({ ok: true });
});

app.delete('/api/admin/submissions/:id', requireAdminToken, (req, res) => {
  const id = Number(req.params.id);
  const idx = submissions.findIndex((s) => s.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Submission not found' });
  const row = submissions[idx];
  // For signed/rejected, soft-delete so user archive keeps status and (for signed) signed PDF.
  if (row && (row.status === 'signed' || row.status === 'rejected')) {
    row.admin_deleted = true;
    row.admin_deleted_at = new Date().toISOString();
  } else {
    // Pending (or other) can be removed fully
    submissions.splice(idx, 1);
  }
  persistState();
  return res.json({ ok: true });
});

// === User: fetch submissions by status (pending/rejected/signed) ===
app.get('/api/my/submissions', requireAuthToken, (req, res) => {
  const status = String(req.query.status || 'pending');
  const allowed = new Set(['pending', 'rejected', 'signed']);
  if (!allowed.has(status)) return res.status(400).json({ error: 'Invalid status' });

  const items = submissions
    .filter((s) => s.user_id === req.user.id && s.status === status && !s.user_deleted)
    .map((s) => ({
      id: s.id,
      service_slug: s.service_slug,
      file_name: s.file_name,
      created_at: s.created_at,
      signed_at: s.signed_at,
      signed_date: s.signed_date,
      rejected_at: s.rejected_at,
      rejected_by: s.rejected_by,
    }));

  return res.json({ items });
});

// === User: delete own submission (used by Arsip Dokumen) ===
app.delete('/api/my/submissions/:id', requireAuthToken, (req, res) => {
  const id = Number(req.params.id);
  const row = submissions.find((s) => s.id === id && s.user_id === req.user.id);
  if (!row) return res.status(404).json({ error: 'Submission not found' });
  // User delete should not affect admin archive; just hide from this user.
  row.user_deleted = true;
  row.user_deleted_at = new Date().toISOString();
  persistState();
  return res.json({ ok: true });
});

app.get('/api/my/signed-submissions', requireAuthToken, (req, res) => {
  const items = submissions
    .filter((s) => s.user_id === req.user.id && s.status === 'signed' && !s.user_deleted)
    .map((s) => ({
      id: s.id,
      service_slug: s.service_slug,
      file_name: s.file_name,
      created_at: s.created_at,
      signed_at: s.signed_at,
      signed_date: s.signed_date,
    }));
  return res.json({ items });
});

app.get('/api/my/signed-submissions/:id/pdf', requireAuthToken, (req, res) => {
  const id = Number(req.params.id);
  const row = submissions.find((s) => s.id === id && s.user_id === req.user.id && s.status === 'signed' && !s.user_deleted);
  if (!row || !row.signed_pdf_base64) return res.status(404).json({ error: 'Signed PDF not found' });
  const buf = Buffer.from(row.signed_pdf_base64, 'base64');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', buf.length);
  return res.send(buf);
});

app.listen(PORT, () => {
  console.log(`Dev backend listening on http://localhost:${PORT}`);
  console.log('Seeded users:', users.map((u) => ({ email: u.email, role: u.role })));
});
