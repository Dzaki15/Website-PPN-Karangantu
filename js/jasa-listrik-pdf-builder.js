// Jasa Listrik PDF Builder using pdf-lib
// Generates Kartu Kendali Pelayanan Publik - Jasa Listrik

async function generateJasaListrikPDF(data) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 portrait
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

  // Header - centered
  const line1 = 'KARTU KENDALI PELAYANAN PUBLIK';
  const line2 = 'PELABUAHAN PERIKANAN NUSANTARA KARANGANTU';
  const headerSize = 13;
  const pageWidth = page.getSize().width;
  const h1w = fontBold.widthOfTextAtSize(line1, headerSize);
  const h2w = fontBold.widthOfTextAtSize(line2, headerSize);
  drawText(line1, (pageWidth - h1w) / 2, y, { font: fontBold, size: headerSize });
  y -= 16;
  drawText(line2, (pageWidth - h2w) / 2, y, { font: fontBold, size: headerSize });
  y -= 24;

  // Metadata
  const fields = [
    { label: 'Nama Layanan', value: 'Jasa Listrik' },
    { label: 'Pengguna', value: data.namaPengguna || data.namaPemohon || '' },
    { label: 'Alamat', value: data.alamatPengguna || '' },
  ];
  fields.forEach(f => {
    drawText(`${f.label} :`, margin, y, { font: fontRegular, size: fontSize });
    drawText(f.value || '', margin + 90, y, { font: fontRegular, size: fontSize });
    y -= 14;
  });
  y -= 10;

  // Table setup (A4 width minus margins = 525)
  // Adjusted to give more space for Keterangan to avoid cramped layout
  const colWidths = [35, 260, 60, 45, 45, 80];
  const headers = ['No', 'Tahapan', 'Waktu', 'Mulai', 'Selesai', 'Keterangan'];
  const tableX = margin;

  const stepsText = [
    'Mengisi Form order pelayanan jasa listrik pada aplikasi SIPANDU',
    'Memproses Layanan Sesuai dengan form order',
    'Menerima pembayaran',
    'menerima jasa layanan listrik'
  ];
  const timeDefaults = ['5 Menit', '5 Menit', '5 Menit', '5 Menit'];
  
  const stepsData = Array.isArray(data.flowSteps) && data.flowSteps.length
    ? data.flowSteps
    : stepsText.map((text, idx) => ({ text, time: timeDefaults[idx], mulai: '', selesai: '', catatan: '' }));

  const rows = stepsData.map((step, idx) => ({
    no: idx + 1,
    tahapan: sanitize(step.text || stepsText[idx] || ''),
    waktu: sanitize(step.time || timeDefaults[idx] || ''),
    mulai: sanitize(step.mulai || ''),
    selesai: sanitize(step.selesai || ''),
    ket: sanitize(step.catatan || '')
  }));

  const drawCell = (text, x, yTop, width, height, opts = {}) => {
    const { font = fontRegular, size = fontSize } = opts;
    page.drawRectangle({ x, y: yTop - height, width, height, borderWidth: 1, borderColor: rgb(0, 0, 0) });
    if (!text) return;
    const lines = wrapText(text, width - 8, size, font);
    let textY = yTop - 6 - size;
    lines.forEach(line => { drawText(line, x + 4, textY, { font, size }); textY -= size + 2; });
  };

  // Header row
  const headerHeight = 22;
  let xPos = tableX;
  headers.forEach((h, idx) => { drawCell(h, xPos, y, colWidths[idx], headerHeight, { font: fontBold }); xPos += colWidths[idx]; });
  y -= headerHeight;

  // Data rows
  rows.forEach(row => {
    const tahapanLines = wrapText(row.tahapan, colWidths[1] - 8, fontSize, fontRegular);
    const lineCount = Math.max(tahapanLines.length, 1);
    const rowHeight = Math.max(24, lineCount * (fontSize + 2) + 8);

    let xx = tableX;
    drawCell(String(row.no), xx, y, colWidths[0], rowHeight); xx += colWidths[0];
    drawCell(row.tahapan, xx, y, colWidths[1], rowHeight); xx += colWidths[1];
    drawCell(row.waktu, xx, y, colWidths[2], rowHeight); xx += colWidths[2];
    drawCell(row.mulai, xx, y, colWidths[3], rowHeight); xx += colWidths[3];
    drawCell(row.selesai, xx, y, colWidths[4], rowHeight); xx += colWidths[4];
    drawCell(row.ket, xx, y, colWidths[5], rowHeight);
    y -= rowHeight;
  });

  y -= 26;

  // Signature section (clean style like SHTI LT - no parentheses or underlines)
  y -= 28;
  const roleY = y;
  drawText('Penerima Layanan', margin + 40, roleY, { font: fontRegular, size: fontSize });

  const leftAreaX = margin + 20;
  const rightAreaX = margin + 310;
  const areaWidth = 180;
  const nameY = roleY - 62;

  // Signature images centered
  const drawSignature = async (imgData, x) => {
    if (!imgData) return;
    try {
      const imgBytes = Uint8Array.from(atob(imgData.split(',')[1] || ''), c => c.charCodeAt(0));
      const img = await pdfDoc.embedPng(imgBytes).catch(async () => await pdfDoc.embedJpg(imgBytes));
      const boxHeight = 50;
      const maxWidth = areaWidth - 24;
      const aspect = img.width / img.height;
      let width = Math.min(maxWidth, boxHeight * aspect);
      let height = width / aspect;
      if (height > boxHeight) { height = boxHeight; width = height * aspect; }
      const yPos = roleY - 50;
      const xPos = x + (areaWidth - width) / 2;
      page.drawImage(img, { x: xPos, y: yPos, width, height });
    } catch (e) { /* ignore */ }
  };

  await drawSignature(data.signatureLeft || data.signature, leftAreaX);
  await drawSignature(data.signatureRight || '', rightAreaX);

  // Names centered (no parentheses, no underlines)
  const namaPenerima = sanitize(data.namaPengguna || data.namaPemohon || '');
  const namaPemberi = '';
  if (namaPenerima) {
    const w = fontRegular.widthOfTextAtSize(namaPenerima, fontSize);
    drawText(namaPenerima, leftAreaX + (areaWidth - w) / 2, nameY, { font: fontRegular, size: fontSize });
  }
  // Per request: do not print the Pemberi Layanan name

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}
