// STBLKK PDF Builder using pdf-lib
// Generates Kartu Kendali Pelayanan Publik - STBLKK
// Note: pdf-lib only supports standard PDF fonts (Helvetica, Times-Roman, Courier)
// Calibri requires custom font embedding which would increase file size significantly
// Helvetica at 11pt provides similar readability to Calibri 11pt

async function generateSTBLKKPDF(data) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]); // A4 portrait
  const margin = 35;
  let y = page.getSize().height - margin;

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 11;

  const sanitize = (text) => String(text || '').replace(/<[^>]+>/g, '');

  const drawText = (text, x, yPos, opts = {}) => {
    const { size = fontSize, font = fontRegular, color = rgb(0, 0, 0) } = opts;
    page.drawText(sanitize(text), { x, y: yPos, size, font, color });
  };

  const wrapText = (text, maxWidth, size = fontSize, font = fontRegular) => {
    const words = String(text || '').split(/\s+/);
    const lines = [];
    let current = '';
    words.forEach(word => {
      const test = current ? `${current} ${word}` : word;
      const width = font.widthOfTextAtSize(test, size);
      if (width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    });
    if (current) lines.push(current);
    return lines;
  };

  const addPageIfNeeded = (requiredSpace = 0) => {
    if (y - requiredSpace < margin + 60) {
      page = pdfDoc.addPage([595, 842]);
      y = page.getSize().height - margin;
    }
  };

  // Header - center-aligned
  const headerLine1 = 'KARTU KENDALI PELAYANAN PUBLIK';
  const headerLine2 = 'PELABUAHAN PERIKANAN NUSANTARA KARANGANTU';
  const headerSize = 13;
  const pageWidth = page.getSize().width;
  const header1Width = fontBold.widthOfTextAtSize(headerLine1, headerSize);
  const header2Width = fontBold.widthOfTextAtSize(headerLine2, headerSize);
  const header1X = (pageWidth - header1Width) / 2;
  const header2X = (pageWidth - header2Width) / 2;
  
  drawText(headerLine1, header1X, y, { font: fontBold, size: headerSize });
  y -= 16;
  drawText(headerLine2, header2X, y, { font: fontBold, size: headerSize });
  y -= 24;

  // Metadata
  const namaLayanan = 'Pelayanan STBLKK';
  const fields = [
    { label: 'Nama Layanan', value: namaLayanan },
    { label: 'Pengguna', value: data.namaPengguna || '' },
    { label: 'Alamat', value: data.alamatPengguna || '' },
  ];

  fields.forEach(f => {
    drawText(`${f.label} :`, margin, y, { font: fontRegular, size: fontSize });
    drawText(f.value || '', margin + 90, y, { font: fontRegular, size: fontSize });
    y -= 14;
  });

  // Persyaratan
  const reqLabel = 'Persyaratan';
  drawText(`${reqLabel} :`, margin, y, { font: fontRegular, size: fontSize });
  y -= 16;

  const requirements = [
    'Persetujuan Berlayar asal',
    'Perizinan Berusaha',
    'Log book Penangkapan Ikan',
    'Daftar Nakhoda dan Daftar Anak Buah Kapal',
    'Berita Acara Alih Muat; dan/atau',
    'Dokumen kapal lainnya (Pas Besar/Pas Kecil, Sertifikat Kelaikan, Surat Ukur, dan dokumen terkait lainnya)'
  ];
  const checked = Array.isArray(data.persyaratan) ? data.persyaratan : [];
  const checkSize = 10;
  const reqX = margin + 100;  // Aligned with Persyaratan label
  const textX = reqX + checkSize + 6;
  // precise X rendering using diagonal lines for better centering
  const drawXMark = (boxX, boxY, size) => {
    const padding = 2; // inner padding from box border
    const x1 = boxX + padding;
    const y1 = boxY + padding;
    const x2 = boxX + size - padding;
    const y2 = boxY + size - padding;
    // draw two diagonals
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 1, color: rgb(0, 0, 0) });
    page.drawLine({ start: { x: x1, y: y2 }, end: { x: x2, y: y1 }, thickness: 1, color: rgb(0, 0, 0) });
  };

  requirements.forEach(item => {
    // draw square box
    const boxY = y - checkSize + 2;
    page.drawRectangle({ x: reqX, y: boxY, width: checkSize, height: checkSize, borderWidth: 1, borderColor: rgb(0, 0, 0) });
    if (checked.includes(item)) {
      drawXMark(reqX, boxY, checkSize);
    }
    // Add semicolon to last 5 items for display (matching original format)
    const displayText = (item === 'Berita Acara Alih Muat; dan/atau' || item === 'Dokumen kapal lainnya (Pas Besar/Pas Kecil, Sertifikat Kelaikan, Surat Ukur, dan dokumen terkait lainnya)') 
      ? item 
      : item + ';';
    const lines = wrapText(sanitize(displayText), 400, fontSize, fontRegular);
    lines.forEach(line => {
      drawText(line, textX, y, { size: fontSize });
      y -= 12;
    });
  });
  y -= 10;

  // Table setup
  // Total width: 595 - (2 * 35 margin) = 525 available
  const colWidths = [25, 245, 55, 55, 55, 90];  // Adjusted to fit within page
  const headers = ['No', 'Tahapan', 'Waktu', 'Mulai', 'Selesai', 'Keterangan'];
  const tableX = margin;

  const baseSteps = [
    'a. Menerima pemberitahuan rencana kedatangan kapal paling lambat 2 (dua) jam sebelum masuk pelabuhan pangkalan dan menerima dokumen permohonan penerbitan STBLKK dari Nakhoda atau Pemilik Kapal Perikanan/Penanggung Jawab Perusahaan\nb. Mengarahkan untuk menyiapkan lokasi tambat/labuh kapal perikanan. untuk selanjutnya menyampaikan kepada Petugas Kesyahbandaran',
    'Menerima pemberitahuan rencana kedatangan dan dokumen permohonan penerbitan STBLKK dan menyiapkan lokasi tambat/labuh kapal perikanan, untuk selanjutnya dilaporkan kepada Syahbandar di Pelabuhan Perikanan',
    'Menyampaikan informasi kesiapan lokasi tambat labuh kapal kepada Nakhoda atau Pemilik Kapal Perikanan/Penanggung Jawab Perusahaan, dan selanjutnya menyerahkan proses tambat labuh kepada Petugas Kesyahbandaran',
    'a. Menerima dokumen fisik permohonan penerbitan STBLKK dari Nakhoda atau Pemilik Kapal Perikanan/Penanggung Jawab Perusahaan setelah kapal bersandar/tiba di Pelabuhan Pangkalan.\nb. Melakukan pemeriksaan atas dokumen fisik permohonan penerbitan STBLKK dan melakukan inspeksi di atas kapal. Selanjutnya melaporkan hasil pemeriksaan dokumen fisik dan inspeksi tersebut kepada Syahbandar di Pelabuhan Perikanan',
    'Melakukan penandatanganan dan penerbitan STBLKK, untuk selanjutnya disampaikan kepada Petugas Kesyahbandaran',
    'Mencetak dan menyerahkan STBLKK kepada Syahbandar di Pelabuhan Perikanan serta mengarsipkan salinan dokumen STBLKK',
    'Menerima dokumen STBLKK dan menyerahkan kepada Nakhoda atau Pemilik Kapal Perikanan/Penanggung Jawab Perusahaan'
  ];

  const timeDefaults = ['10 Menit', '15 Menit', '10 Menit', '35 Menit', '10 Menit', '5 Menit', '15 Menit'];
  const stepsData = Array.isArray(data.flowSteps) && data.flowSteps.length
    ? data.flowSteps
    : baseSteps.map((text, idx) => ({ text, time: timeDefaults[idx], mulai: '', selesai: '', catatan: '' }));

  const rows = stepsData.map((step, idx) => {
    const tahapan = sanitize(step.text || baseSteps[idx] || '');
    const waktu = sanitize(step.time || timeDefaults[idx] || '');
    const mulai = sanitize(step.mulai || '');
    const selesai = sanitize(step.selesai || '');
    const ket = sanitize(step.catatan || '');
    return { no: idx + 1, tahapan, waktu, mulai, selesai, ket };
  });

  const drawCell = (text, x, yTop, width, height, opts = {}) => {
    const { font = fontRegular, size = fontSize } = opts;
    page.drawRectangle({ x, y: yTop - height, width, height, borderWidth: 1, borderColor: rgb(0, 0, 0) });
    if (!text) return;
    const lines = wrapText(text, width - 8, size, font);
    let textY = yTop - 6 - size;
    lines.forEach(line => {
      drawText(line, x + 4, textY, { font, size });
      textY -= size + 2;
    });
  };

  // Header row
  const headerHeight = 22;
  let xPos = tableX;
  headers.forEach((h, idx) => {
    drawCell(h, xPos, y, colWidths[idx], headerHeight, { font: fontBold });
    xPos += colWidths[idx];
  });
  y -= headerHeight;

  // Data rows
  rows.forEach(row => {
    // Estimate height based on tahapan and keterangan
    const tahapanLines = wrapText(row.tahapan, colWidths[1] - 8, fontSize, fontRegular);
    const ketLines = wrapText(row.ket, colWidths[5] - 8, fontSize, fontRegular);
    const lineCount = Math.max(tahapanLines.length, ketLines.length, 1);
    const rowHeight = Math.max(24, lineCount * (fontSize + 2) + 8);

    addPageIfNeeded(rowHeight + 20);

    let xx = tableX;
    drawCell(String(row.no), xx, y, colWidths[0], rowHeight);
    xx += colWidths[0];
    drawCell(row.tahapan, xx, y, colWidths[1], rowHeight);
    xx += colWidths[1];
    drawCell(row.waktu, xx, y, colWidths[2], rowHeight);
    xx += colWidths[2];
    drawCell(row.mulai, xx, y, colWidths[3], rowHeight);
    xx += colWidths[3];
    drawCell(row.selesai, xx, y, colWidths[4], rowHeight);
    xx += colWidths[4];
    drawCell(row.ket, xx, y, colWidths[5], rowHeight);

    y -= rowHeight;
  });

  y -= 26;
  addPageIfNeeded(80);

  // Signature section
  y -= 28;
  const roleY = y;
  drawText('Penerima Layanan', margin + 40, roleY, { font: fontRegular, size: fontSize });
  // Names baseline (shared)
  const leftAreaX = margin + 20;
  const rightAreaX = margin + 310;
  const areaWidth = 180;
  const nameY = roleY - 62;
  y = nameY; // align subsequent calculations to name baseline

  // Signature baselines removed per request (no parentheses or dotted lines)
  const baselineY = nameY + 12; // keep for vertical centering math only

  // Signatures if provided (data.signatureLeft, data.signatureRight)
  const drawSignature = async (imgData, x) => {
    if (!imgData) return;
    try {
      const imgBytes = Uint8Array.from(atob(imgData.split(',')[1] || ''), c => c.charCodeAt(0));
      const img = await pdfDoc.embedPng(imgBytes).catch(async () => await pdfDoc.embedJpg(imgBytes));
      // Constrain signature image within a box between role and baseline
      const boxTop = roleY - 8;
      const boxBottom = baselineY - 6;
      const boxHeight = Math.max(24, boxTop - boxBottom);
      const maxWidth = areaWidth - 24;
      const aspect = img.width / img.height;
      let width = Math.min(maxWidth, boxHeight * aspect);
      let height = width / aspect;
      if (height > boxHeight) {
        height = boxHeight;
        width = height * aspect;
      }
      const centerY = (boxTop + boxBottom) / 2;
      const yPos = centerY - height / 2;
      const xPos = x + (areaWidth - width) / 2;
      page.drawImage(img, { x: xPos, y: yPos, width, height });
    } catch (e) {
      // ignore signature errors
    }
  };

  // Draw signatures centered vertically between role and name
  await drawSignature(data.signatureLeft || data.signature, leftAreaX);
  await drawSignature(data.signatureRight, rightAreaX);

  // Remove underscore lines; place names centered within signature areas
  const namaPenerima = sanitize(data.namaPengguna || '');
  const namaPemberi = sanitize(data.namaPemberiLayanan || '');

  const penerimaAreaX = leftAreaX; // left signature area start
  const penerimaAreaWidth = areaWidth;     // approximate area width for centering
  const pemberiAreaX = rightAreaX; // right signature area start
  const pemberiAreaWidth = areaWidth;

  if (namaPenerima) {
    const nameWidth = fontRegular.widthOfTextAtSize(namaPenerima, fontSize);
    const nameX = penerimaAreaX + (penerimaAreaWidth - nameWidth) / 2;
    drawText(namaPenerima, nameX, nameY, { font: fontRegular, size: fontSize });
  }
  // Intentionally omit bottom-right footer text; admin will add later.

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}
