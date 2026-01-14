import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function generatePbPdf(data = {}) {
  const pdfDoc = await PDFDocument.create();

  const calibriPaths = [
    'C:/Windows/Fonts/calibri.ttf',
    'C:/Windows/Fonts/Calibri.ttf'
  ];
  const calibriBoldPaths = [
    'C:/Windows/Fonts/calibrib.ttf',
    'C:/Windows/Fonts/Calibri Bold.ttf'
  ];

  let fontRegular = null;
  let fontBold = null;
  for (const p of calibriPaths) {
    if (fs.existsSync(p)) {
      try { fontRegular = await pdfDoc.embedFont(fs.readFileSync(p)); break; } catch {}
    }
  }
  for (const p of calibriBoldPaths) {
    if (fs.existsSync(p)) {
      try { fontBold = await pdfDoc.embedFont(fs.readFileSync(p)); break; } catch {}
    }
  }
  if (!fontRegular) fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  if (!fontBold) fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page1 = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
  const { width, height } = page1.getSize();
  const bodySize = 12;
  const margin = 40;

  const drawText = (page, text, x, y, size = bodySize, font = fontRegular) => {
    page.drawText(String(text || ''), { x, y, size, font, color: rgb(0, 0, 0) });
  };

  const drawCentered = (page, text, y, size = bodySize, font = fontBold) => {
    const t = String(text || '');
    const w = font.widthOfTextAtSize(t, size);
    drawText(page, t, (width - w) / 2, y, size, font);
  };

  // Header
  drawCentered(page1, 'KARTU KENDALI PELAYANAN PUBLIK', height - margin - 10, 14, fontBold);
  drawCentered(page1, 'PELABUHAN PERIKANAN NUSANTARA KARANGANTU', height - margin - 28, 12, fontBold);

  // Info block
  let y = height - margin - 60;
  drawText(page1, `Nama Layanan : ${data.namaLayanan || 'Pelayanan PB'}`, margin, y);
  y -= 18;
  drawText(page1, `Pengguna : ${data.namaPengguna || data.nama || ''}`, margin, y);
  y -= 18;
  drawText(page1, `Alamat : ${data.alamat || ''}`, margin, y);

  // Checklist
  y -= 24;
  drawText(page1, 'Persyaratan :', margin, y, 12, fontBold);
  const checklist = [
    '✔ surat pernyataan kesiapan Kapal Perikanan berangkat dari Nakhoda (Master Sailing Declaration);',
    '✔ bukti pemenuhan pembayaran pajak pertambahan nilai, bagi Kapal Perikanan yang menggunakan bahan bakar minyak nonsubsidi;',
    '✔ Surat Laik Operasi (SLO);',
    '✔ Surat Tanda Bukti Lapor Kedatangan Kapal (STBLKK);',
    '✔ Perjanjian Kerja Laut (PKL); dan',
    '✔ Dokumen kapal lainnya (Pas Besar/Pas Kecil, Sertifikat Kelaikan, Surat Ukur, Daftar Awak, Buku Sijil, dan dokumen terkait)'
  ];
  y -= 16;
  for (const item of checklist) {
    drawText(page1, item, margin + 12, y);
    y -= 16;
  }

  // Table headers
  y -= 8;
  const colXs = [margin, margin + 40, margin + 270, margin + 330, margin + 390, width - margin];
  const rowHeight = 40;
  const tableTop = y;
  const drawCell = (page, text, x1, x2, yTop, yBottom, font = fontRegular, size = 12, center = false) => {
    page.drawRectangle({ x: x1, y: yBottom, width: x2 - x1, height: yTop - yBottom, borderColor: rgb(0.7,0.7,0.7), borderWidth: 1 });
    const t = String(text || '');
    const tw = font.widthOfTextAtSize(t, size);
    const tx = center ? x1 + (x2 - x1 - tw) / 2 : x1 + 6;
    page.drawText(t, { x: tx, y: yTop - 16, size, font, color: rgb(0,0,0) });
  };

  // Header row
  drawCell(page1, 'No', colXs[0], colXs[1], tableTop, tableTop - rowHeight, fontBold, 12, true);
  drawCell(page1, 'Tahapan', colXs[1], colXs[2], tableTop, tableTop - rowHeight, fontBold, 12, true);
  drawCell(page1, 'Waktu', colXs[2], colXs[3], tableTop, tableTop - rowHeight, fontBold, 12, true);
  drawCell(page1, 'Mulai', colXs[3], colXs[4], tableTop, tableTop - rowHeight, fontBold, 12, true);
  drawCell(page1, 'Selesai', colXs[4], colXs[5], tableTop, tableTop - rowHeight, fontBold, 12, true);

  // Rows data from payload if available
  const defaultSteps = [
    { text: 'Menerima laporan rencana keberangkatan kapal yang dilengkapi dengan dokumen persyaratan administrasi untuk permohonan penerbitan Persetujuan Berlayar (PB) dari Nakhoda atau Pemilik Kapal Perikanan/ Penanggung Jawab Perusahaan, dan meneruskan laporan serta kelengkapannya kepada Petugas Kesyahbandaran', time: '5 Menit' },
    { text: 'Melakukan pemeriksaan kelengkapan surat dan validitas dokumen kapal perikanan untuk penerbitan PB, dan dokumen kapal lainnya termasuk pemeriksaan kewajiban pelunasan PNBP PHP, dan menyampaikan hasil pemeriksaan tersebut kepada Syahbandar di Pelabuhan Perikanan', time: '10 Menit' },
    { text: 'Menerima hasil pemeriksaan kelengkapan surat dan validitas dokumen kapal perikanan untuk penerbitan PB, dan dokumen kapal lainnya termasuk pemeriksaan kewajiban pelunasan PNBP PHP dan menugaskan pemeriksaan teknis dan nautis kepada Petugas Kesyahbandaran', time: '5 Menit' },
    { text: 'Melakukan pemeriksaan di atas kapal, terkait: a. teknis dan nautis terhadap kapal perikanan dan alat penangkapan ikan, alat bantu penangkapan ikan; dan; b. pemeriksaan persyaratan pengawakan kapal perikanan, untuk selanjutnya hasil pemerikasaan tersebut disampaikan kepada Syahbandar di Pelabuhan Perikanan', time: '60 Menit' },
    { text: 'Melakukan pemeriksaan ulang kelengkapan dokumen kapal perikanan untuk melihat kelengkapan dan kesesuaian dokumen Kapal Perikanan. Berdasarkan hasil pemeriksaan ulang dinyatakan lengkap dan sesuai, selanjutnya dilakukan penandatanganan dalam aplikasi Teman SPB dan memerintahkan kepada Petugas Kesyahbanadaran untuk proses lanjut.', time: '10 Menit' },
    { text: 'Mencetak dan menyerahkan PB kepada Syahbandar di Pelabuhan Perikanan dan mengarsipkan salinan dokumen PB', time: '5 Menit' },
    { text: 'Menerima dokumen PB dan menyerahkan kepada Nakhoda atau Pemilik Kapal Perikanan/Penanggung Jawab Perusahaan', time: '15 Menit' }
  ];

  const payloadSteps = Array.isArray(data.flowSteps) && data.flowSteps.length ? data.flowSteps : defaultSteps;
  const rows = payloadSteps.map((step, idx) => [
    String(idx + 1),
    step.text || '',
    step.time || step.waktu || '',
    step.mulai || step.start || '',
    step.selesai || step.end || '',
    step.catatan || step.keterangan || ''
  ]);

  let rowY = tableTop - rowHeight;
  const usableBottom = margin + 160; // leave space for signatures

  const splitTextIntoLines = (text, maxWidth, font, size) => {
    const words = String(text || '').split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      const tw = font.widthOfTextAtSize(test, size);
      if (tw > maxWidth) { lines.push(line); line = w; } else { line = test; }
    }
    if (line) lines.push(line);
    return lines;
  };

  for (const r of rows) {
    const tahapanLines = splitTextIntoLines(r[1], (colXs[2] - colXs[1]) - 12, fontRegular, 12);
    const h = Math.max(rowHeight, 16 * tahapanLines.length + 12);
    const nextY = rowY - h;
    if (nextY < usableBottom) break; // stop if runs off page; keep to 1 page main table
    drawCell(page1, r[0], colXs[0], colXs[1], rowY, nextY, fontRegular, 12, true);
    // Tahapan cell with multiple lines
    page1.drawRectangle({ x: colXs[1], y: nextY, width: colXs[2] - colXs[1], height: rowY - nextY, borderColor: rgb(0.7,0.7,0.7), borderWidth: 1 });
    let ly = rowY - 16;
    for (const ln of tahapanLines) { drawText(page1, ln, colXs[1] + 6, ly, 12, fontRegular); ly -= 16; }
    drawCell(page1, r[2], colXs[2], colXs[3], rowY, nextY, fontRegular, 12, true);
    drawCell(page1, r[3], colXs[3], colXs[4], rowY, nextY, fontRegular, 12, true);
    drawCell(page1, r[4], colXs[4], colXs[5], rowY, nextY, fontRegular, 12, true);
    rowY = nextY;
  }

  // Signatures block
  const sigTop = usableBottom - 20;
  const colWidth = (width - margin * 2) / 2;
  const leftX = margin;
  const rightX = margin + colWidth;
  drawText(page1, 'Penerima Layanan', leftX + 4, sigTop, 11, fontRegular);
  drawText(page1, 'Pemberi Layanan', rightX + 4, sigTop, 11, fontRegular);

  // Signature images and names
  const sigData = data.signature;
  if (sigData && typeof sigData === 'string' && sigData.startsWith('data:')) {
    try {
      const m = sigData.match(/^data:(image\/png|image\/jpeg);base64,(.+)$/);
      if (m) {
        const imgBytes = Buffer.from(m[2], 'base64');
        const img = m[1] === 'image/png' ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);
        const dims = img.scale(0.5);
        page1.drawImage(img, { x: leftX + 20, y: sigTop - 70, width: dims.width, height: dims.height });
      }
    } catch {}
  }
  drawCentered(page1, `(${data.namaPengguna || data.nama || ''})`, sigTop - 100, 12, fontRegular);
  drawCentered(page1, '(Bambang)', sigTop - 100, 12, fontRegular);

  return await pdfDoc.save();
}

export default generatePbPdf;