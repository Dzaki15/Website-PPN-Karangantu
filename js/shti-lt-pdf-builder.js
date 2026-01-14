// SHTI-LT PDF Builder using pdf-lib
// Generates Kartu Kendali Pelayanan Publik - SHTI LT

async function generateSHTILTPDF(data) {
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

  // Header - center aligned
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
    { label: 'Nama Layanan', value: 'Pelayanan SHTI LT' },
    { label: 'Pengguna', value: data.namaPengguna || data.namaPemohon || '' },
    { label: 'Alamat', value: data.alamatPengguna || '' },
  ];
  fields.forEach(f => {
    drawText(`${f.label} :`, margin, y, { font: fontRegular, size: fontSize });
    drawText(f.value || '', margin + 90, y, { font: fontRegular, size: fontSize });
    y -= 14;
  });

  // Persyaratan
  drawText('Persyaratan :', margin, y, { font: fontRegular, size: fontSize });
  y -= 16;
  // Values match form checkbox values for proper X matching; display text adds punctuation
  const requirements = [
    'Formulir permohonan penerbitan Sertifikat Hasil Tangkapan Ikan-Lembar Turunan',
    'Draft Sertifikat Hasil Tangkapan Ikan-Lembar Turunan',
    'Salinan Lembar Awal',
    'Perizinan Berusaha subsector Penangkapan Ikan',
    'Perizinan Berusaha subsector Pengangkutan Ikan',
    'Bukti pembelian ikan',
    'Packing list perusahaan eksportir',
    'Invoice perusahaan eksportir',
    'Surat jalan pengiriman barang'
  ];
  const checked = Array.isArray(data.persyaratan) ? data.persyaratan : [];
  const checkSize = 10;
  const reqX = margin + 100;
  const textX = reqX + checkSize + 6;
  const drawXMark = (boxX, boxY, size) => {
    const padding = 2;
    const x1 = boxX + padding;
    const y1 = boxY + padding;
    const x2 = boxX + size - padding;
    const y2 = boxY + size - padding;
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 1, color: rgb(0, 0, 0) });
    page.drawLine({ start: { x: x1, y: y2 }, end: { x: x2, y: y1 }, thickness: 1, color: rgb(0, 0, 0) });
  };
  requirements.forEach(item => {
    const boxY = y - checkSize + 2;
    page.drawRectangle({ x: reqX, y: boxY, width: checkSize, height: checkSize, borderWidth: 1, borderColor: rgb(0, 0, 0) });
    if (checked.includes(item)) drawXMark(reqX, boxY, checkSize);
    const displayTextMap = {
      'Formulir permohonan penerbitan Sertifikat Hasil Tangkapan Ikan-Lembar Turunan': 'formulir permohonan penerbitan Sertifikat Hasil Tangkapan Ikan-Lembar Turunan',
      'Draft Sertifikat Hasil Tangkapan Ikan-Lembar Turunan': 'draft Sertifikat Hasil Tangkapan Ikan- Lembar Turunan',
      'Salinan Lembar Awal': 'salinan Lembar Awal',
      'Perizinan Berusaha subsector Penangkapan Ikan': 'salinan Perizinan Berusaha subsector Penangkapan Ikan',
      'Perizinan Berusaha subsector Pengangkutan Ikan': 'salinan Perizinan Berusaha subsector Pengangkutan Ikan, dalam hal melakukan alih muatan;',
      'Bukti pembelian ikan': 'bukti pembelian ikan',
      'Packing list perusahaan eksportir': 'packing list dari perusahaan eksportir;',
      'Invoice perusahaan eksportir': 'invoice dari perusahaan eksportir; dan',
      'Surat jalan pengiriman barang': 'surat jalan pengiriman barang dari perusahaan eksportir.'
    };
    const displayText = displayTextMap[item] || item;
    const lines = wrapText(sanitize(displayText), 400, fontSize, fontRegular);
    lines.forEach(line => { drawText(line, textX, y, { size: fontSize }); y -= 12; });
  });
  y -= 10;

  // Table setup (A4 width minus margins = 525)
  const colWidths = [25, 245, 55, 55, 55, 90];
  const headers = ['No', 'Tahapan', 'Waktu', 'Mulai', 'Selesai', 'Keterangan'];
  const tableX = margin;

  const stepsText = [
    'Mengajukan permohonan dan mengisi draft SHTI-LT',
    'Memeriksa kelengkapan persyaratan dokumen dan menginput permohonan penerbitan SHTI-LT pada aplikasi SHTI Online dan/atau Offline dengan MS Excel (apabila kondisi force majure), bila dokumen tidak lengkap, dikembalikan untuk dilengkapi.',
    'Melakukan verifikasi draft SHTI-LT, terhadap ketersediaan stok bahan baku yang akan dieksport, memeriksa kepatuhan kapal serta memeriksa dokumen pendukung eksport/kapal lainnya dan selanjutnya memparaf draft SHTI-LT disampaikan kepada Petugas Kesyahbandaran untuk dicetak, jika tidak valid proses tidak dilanjutkan.',
    'Mencetak SHTI-LT beserta lampirannya yang telah tervalidasi dan telah diberi nomor secara otomatis melalui aplikasi',
    'Memeriksa draft SHTI-LT, apabila tidak setuju maka dikembalikan kepada Petugas Kesyahbandaran dan apabia setuju maka ditandatangani dan menyampaikan dokumen SHTI-LT kepada Petugas Kesyahbandaran',
    'Menyampaikan SHTI-LT asli kepada pemohon/UPI dan mengarsipkan copy SHTI-LT',
    'Menerima dokumen SHTI-LT asli'
  ];
  const timeDefaults = ['5 Menit', '10 Menit', '15 Menit', '3 Menit', '10 Menit', '', '5 Menit'];
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
    const ketLines = wrapText(row.ket, colWidths[5] - 8, fontSize, fontRegular);
    const lineCount = Math.max(tahapanLines.length, ketLines.length, 1);
    const rowHeight = Math.max(24, lineCount * (fontSize + 2) + 8);

    addPageIfNeeded(rowHeight + 20);

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
  addPageIfNeeded(80);

  // Signature section
  y -= 28;
  const roleY = y;
  drawText('Penerima Layanan', margin + 40, roleY, { font: fontRegular, size: fontSize });

  const leftAreaX = margin + 20;
  const rightAreaX = margin + 310;
  const areaWidth = 180;
  const signatureHeight = 50; // Height for signature area
  const nameY = roleY - signatureHeight - 18; // Name below signature with spacing

  // Signature images centered in fixed area
  const drawSignature = async (imgData, x) => {
    if (!imgData) return;
    try {
      const imgBytes = Uint8Array.from(atob(imgData.split(',')[1] || ''), c => c.charCodeAt(0));
      const img = await pdfDoc.embedPng(imgBytes).catch(async () => await pdfDoc.embedJpg(imgBytes));
      const boxTop = roleY - 8;
      const boxBottom = roleY - 8 - signatureHeight;
      const boxHeight = signatureHeight;
      const maxWidth = areaWidth - 24;
      const aspect = img.width / img.height;
      let width = Math.min(maxWidth, boxHeight * aspect);
      let height = width / aspect;
      if (height > boxHeight) { height = boxHeight; width = height * aspect; }
      const centerY = (boxTop + boxBottom) / 2;
      const yPos = centerY - height / 2;
      const xPos = x + (areaWidth - width) / 2;
      page.drawImage(img, { x: xPos, y: yPos, width, height });
    } catch (e) { /* ignore */ }
  };

  await drawSignature(data.signatureLeft || data.signature, leftAreaX);
  await drawSignature(data.signatureRight, rightAreaX);

  // Names centered
  const namaPenerima = sanitize(data.namaPengguna || data.namaPemohon || '');
  const namaPemberi = sanitize(data.namaPemberiLayanan || '');
  if (namaPenerima) { const w = fontRegular.widthOfTextAtSize(namaPenerima, fontSize); drawText(namaPenerima, leftAreaX + (areaWidth - w) / 2, nameY, { font: fontRegular, size: fontSize }); }
  // Intentionally omit bottom-right footer text; admin will add later.

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}
