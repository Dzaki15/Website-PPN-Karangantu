/**
 * SKKP PDF Builder - Client-side PDF generation using pdf-lib
 * Adapted from server-side generate-skkp-pdf.js
 */

async function generateSKKPPDF(data) {
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]); // A4 size
  
  let { width, height } = page.getSize();
  const margin = 40;
  const contentWidth = width - (margin * 2);
  let yPosition = height - margin;

  // Extract data with defaults
  const {
    namaAplikasi = '',
    alamat = '',
    tanggal = '',
    namaPemberiLayanan = '',
    persyaratan = [],
    flowchartSteps = [],
    signature = null,
    signatureRight = null
  } = data;

  // Fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const bodyFont = helvetica;
  const boldFont = helveticaBold;
  const baseFontSize = 12;

  // Helper function to draw text
  const drawText = (text, x, y, fontSize = baseFontSize, color = rgb(0, 0, 0), font = bodyFont) => {
    page.drawText(text, {
      x,
      y,
      size: fontSize,
      color,
      font,
    });
  };

  // Helper function to wrap text
  const wrapText = (text, maxWidth, fontSize = baseFontSize, font = bodyFont) => {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  // Helper function to draw table
  const drawTable = (xStart, yStart, colWidths, rows, options = {}) => {
    const { includeHeader = true } = options;
    let y = yStart;
    const minRowHeight = 28;
    const cellPadding = 6;
    const fontSize = baseFontSize;
    const lineHeight = fontSize + 2;

    // Draw header row if needed
    if (includeHeader && rows.length) {
      let x = xStart;
      const rowHeight = Math.max(minRowHeight, fontSize + 10);
      rows[0].forEach((header, idx) => {
        const rectY = y - rowHeight;
        page.drawRectangle({
          x,
          y: rectY,
          width: colWidths[idx],
          height: rowHeight,
          borderColor: rgb(0, 0, 0),
          borderWidth: 1,
        });
        const text = String(header || '');
        const textWidth = boldFont.widthOfTextAtSize(text, fontSize);
        const textX = x + (colWidths[idx] - textWidth) / 2;
        const textY = rectY + (rowHeight - fontSize) / 2;
        drawText(text, textX, textY, fontSize, rgb(0, 0, 0), boldFont);
        x += colWidths[idx];
      });
      y -= rowHeight;
    }

    // Draw data rows with text wrapping
    const startIdx = includeHeader ? 1 : 0;
    for (let rowIdx = startIdx; rowIdx < rows.length; rowIdx++) {
      const rowCells = rows[rowIdx];
      
      // Calculate row height based on tallest cell (handle explicit newlines)
      let maxLines = 1;
      rowCells.forEach((cell, cellIdx) => {
        const cellText = String(cell || '');
        const parts = cellText.split('\n');
        const maxWidth = colWidths[cellIdx] - (cellPadding * 2);
        let linesCount = 0;
        parts.forEach(part => {
          const lines = wrapText(part, maxWidth, fontSize, bodyFont);
          linesCount += Math.max(lines.length, 1);
        });
        maxLines = Math.max(maxLines, linesCount);
      });
      
      const rowHeight = Math.max(minRowHeight, maxLines * lineHeight + 6);
      const rectY = y - rowHeight;
      let x = xStart;

      rowCells.forEach((cell, cellIdx) => {
        // Draw cell border
        page.drawRectangle({
          x,
          y: rectY,
          width: colWidths[cellIdx],
          height: rowHeight,
          borderColor: rgb(0, 0, 0),
          borderWidth: 1,
        });

        // Draw wrapped text with explicit newline support
        const cellText = String(cell || '');
        const parts = cellText.split('\n');
        const maxWidth = colWidths[cellIdx] - (cellPadding * 2);
        let lineCursor = 0;
        const textStartY = rectY + rowHeight - cellPadding - fontSize;
        parts.forEach(part => {
          const lines = wrapText(part, maxWidth, fontSize, bodyFont);
          const useLines = lines.length ? lines : [''];
          useLines.forEach(line => {
            drawText(line, x + cellPadding, textStartY - (lineCursor * lineHeight), fontSize, rgb(0, 0, 0), bodyFont);
            lineCursor++;
          });
        });
        
        x += colWidths[cellIdx];
      });

      y -= rowHeight;
    }

    return y;
  };

  // Title (centered, bold)
  yPosition -= 20;
  const title1 = 'KARTU KENDALI PELAYANAN PUBLIK';
  const title2 = 'PELABUAHAN PERIKANAN NUSANTARA KARANGANTU';
  const t1Width = boldFont.widthOfTextAtSize(title1, baseFontSize);
  const t2Width = boldFont.widthOfTextAtSize(title2, baseFontSize);
  const centerX = (width - t1Width) / 2;
  const centerX2 = (width - t2Width) / 2;
  drawText(title1, centerX, yPosition, baseFontSize, rgb(0, 0, 0), boldFont);
  yPosition -= 18;
  drawText(title2, centerX2, yPosition, baseFontSize, rgb(0, 0, 0), boldFont);
  yPosition -= 28;

  // Form fields
  // Nama Layanan
  drawText('Nama Layanan', margin, yPosition);
  drawText(': pelayanan SKKP', margin + 120, yPosition);
  yPosition -= 18;

  // Pengguna
  drawText('Pengguna', margin, yPosition);
  drawText(`: ${namaAplikasi}`, margin + 120, yPosition);
  yPosition -= 18;

  // Alamat
  drawText('Alamat', margin, yPosition);
  drawText(`: ${alamat || 'Pelabuahan Perikanan Nusantara Karangantu'}`, margin + 120, yPosition);
  yPosition -= 22;

  // Persyaratan
  drawText('Persyaratan :', margin, yPosition);
  yPosition -= 15;

  const requirementsList = [
    { text: 'Permohonan, Persyaratan siap untuk dilakukan pemeriksaaan kelaikan', indent: 0 },
    { text: 'Foto copy SIUP', indent: 0 },
    { text: 'Persetujuan pengadaan Kapal Perikanan (PPKP)', indent: 0 },
    { text: 'Surat Ukur', indent: 0 },
    { text: 'Gambar General Arrangement', indent: 0 },
    { text: 'Gambar Engine Room Layout', indent: 0 },
    { text: 'Surat Keterangan Docking/ Suarat Keterangan Tukang', indent: 0 },
    { text: 'Foto Kapal', indent: 0 },
    { text: '1) Tampak samping keseluruhan dengan nama kapal jelas terbaca', indent: 20 },
    { text: '2) Tamapk buritan', indent: 20 },
    { text: '3) Tampak apal dengan tanda selar', indent: 20 },
    { text: '4) Palka ikan yangsudah diberi nomor', indent: 20 },
    { text: '5) Mesin utama kapal yang menunjukan merk, tipe dan nomor mesin', indent: 20 },
    { text: '6) Foto alat penangkapan ikan yang digunakan diatas kapal', indent: 20 },
  ];

  const checkboxSize = 10;

  requirementsList.forEach((req) => {
    const baseIndent = margin + 20 + req.indent;
    // Check if this requirement is checked
    const isChecked = req.indent === 0 && persyaratan.some(p => {
      const pLower = String(p).toLowerCase().trim();
      const reqText = req.text.toLowerCase();
      return pLower.includes('siup') ? reqText.includes('siup') :
             pLower.includes('ppkp') ? reqText.includes('ppkp') :
             pLower.includes('ukur') ? reqText.includes('ukur') :
             pLower.includes('arrangement') ? reqText.includes('arrangement') :
             pLower.includes('engine') ? reqText.includes('engine') :
             pLower.includes('keterangan docking') ? reqText.includes('docking') :
             pLower.includes('kapal') ? reqText.includes('kapal') && req.text.includes('Foto') :
             pLower.includes('permohonan') ? reqText.includes('permohonan') :
             false;
    });
    
    if (req.indent === 0) {
      const boxX = margin + 20;
      const boxY = yPosition - (checkboxSize - 2);
      page.drawRectangle({
        x: boxX,
        y: boxY,
        width: checkboxSize,
        height: checkboxSize,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });

      if (isChecked) {
        drawText('X', boxX + 2, boxY + 1, baseFontSize - 2, rgb(0, 0, 0), boldFont);
      }

      drawText(req.text, boxX + checkboxSize + 6, yPosition, baseFontSize);
    } else {
      drawText(req.text, baseIndent, yPosition, baseFontSize);
    }
    yPosition -= 14;
  });

  yPosition -= 10;

  // Table
  const colWidths = [25, 220, 80, 50, 50, 85];
  const tableHeader = ['No', 'Tahapan', 'Waktu', 'Mulai', 'Selesai', 'Keterangan'];

  const baseRows = [
    ['1', 'Menyampaikan Permohonanan penerbitan\nSertifikat Kelaikan Kapal Perikanan melalui\naplikasi SICEFI', 'Waktu Pemohon'],
    ['2', 'Menerima permohonan dan Mendisposisikan\nkepada Verifikator untuk memeriksa\nkelengkapan serta menilai kesesuaian\ndokumen persyaratan', '5 Menit'],
    ['3', 'Melakukan verifikasi terhadap kesesuaian\ndokumen persyaratan melalui aplikasi SICEFI:\na. jika sesuai menyampaikan hasil kepada\nkoordinator\nb. jika tidak sesuai menyampaikan\npemberitahuan penolakan kepada pemohon', '30 Menit'],
    ['4', 'Menerima Hasil Verifikasi, membuat Draf\nSurat Tugas  Pemeriksaan Kelaikan Kapal\nPerikanan Kepada Kepala Pelabuhan pada\naplikasi SICEFI', '10 Menit'],
    ['5', 'Memeriksa Draf Surat Tugas:\na. jika setuju, Approve Surat Tugas pada\naplikasi SICEFI dan menyampaikan kepada\nPetugas Pemeriksa Kelaikan Kapal Perikanan\ndan Mengirim pemberitahuan jadwal\npemeriksaan kepada pemohon\nb. jika tidak setuju, draft dikembalikan kepada\nKoordinator SKKP\nc. koordinator klik selesai pada aplikasi SICEFI', '5 menit'],
    ['6', 'Menerima pemberitahuan jadwal\npelaksanaan pemeriksaan di aplikasi SICEFI,\nmenyiapkan kapal perikanan, dan\npendamping bagi petugas pemeriksa kelaikan\nkapal perikanan sesuai dengan jadwal\npemeriksaan', 'Waktu Pemohon'],
    ['7', 'Menerima Surat Tugas, melaksanakan\npemeriksaan, membuat dan menyampaikan\nlaporan hasil pemeriksaan kelaikan kapal\nperikanan kepada Kepala Pelabuhan', '1 hari'],
    ['8', 'Memeriksa laporan hasil pemeriksaan\nkelaikan kapal perikanan serta menyetujui\ndan menandatangani:\na. Sertifikat Kelaikan Kapal Perikanan jika\nsesuai,\nb. Surat Penolakan disertai alasan jika tidak\nsesuai', '20 menit'],
    ['9', 'Menerima Sertifikat Kelaikan Kapal Perikanan\natau Surat Pemberitahuan Penolakan', 'Waktu Pemohon'],
  ];

  const tableRows = baseRows.map((row, idx) => {
    const user = Array.isArray(flowchartSteps) ? flowchartSteps[idx] : null;
    return [
      row[0],
      row[1],
      row[2],
      user?.mulai || '',
      user?.selesai || '',
      user?.keterangan || '',
    ];
  });

  // Page 1: rows 1-4
  const page1Rows = [tableHeader, ...tableRows.slice(0, 4)];
  yPosition = drawTable(margin, yPosition, colWidths, page1Rows, { includeHeader: true });
  
  // Page 2: rows 5-9 + signatures
  page = pdfDoc.addPage([595, 842]);
  ({ width, height } = page.getSize());
  yPosition = height - margin - 30;
  const page2Rows = tableRows.slice(4);
  yPosition = drawTable(margin, yPosition, colWidths, page2Rows, { includeHeader: false });
  
  // Ensure enough space for signatures (minimum 120pt from bottom)
  const minBottomMargin = 120;
  if (yPosition < minBottomMargin) {
    yPosition = minBottomMargin;
  } else {
    yPosition -= 40;
  }

  // Signature block
  const year = tanggal ? new Date(tanggal).getFullYear() : '2025';
  const sigCenterX = width / 2;
  const columnOffset = 140;
  const leftX = sigCenterX - columnOffset;
  const rightX = sigCenterX + columnOffset;

  drawText('Penerima Layanan', leftX - (bodyFont.widthOfTextAtSize('Penerima Layanan', baseFontSize) / 2), yPosition);
  
  const pemberiY = yPosition - 25;

  // Target name position and signature centering between label and name (left side)
  const labelYLeft = yPosition;
  const nameOffset = 65; // distance from label to name baseline
  const targetNameY = labelYLeft - nameOffset;

  // Signatures positioned at vertical center between label and name (keep Y identical for horizontal alignment)
  const centerY = (labelYLeft + targetNameY) / 2;
  const drawSig = async (sigDataUrl, xCenter) => {
    if (!sigDataUrl) return;
    try {
      const matches = sigDataUrl.match(/^data:(image\/png|image\/jpeg);base64,(.+)$/);
      if (!matches) return;
      const imgType = matches[1];
      const imgBase64 = matches[2];
      const imgBytes = Uint8Array.from(atob(imgBase64), c => c.charCodeAt(0));
      const img = imgType === 'image/png'
        ? await pdfDoc.embedPng(imgBytes)
        : await pdfDoc.embedJpg(imgBytes);
      const imgDims = img.scale(0.35);
      page.drawImage(img, {
        x: xCenter - (imgDims.width / 2),
        y: centerY - (imgDims.height / 2),
        width: imgDims.width,
        height: imgDims.height
      });
    } catch (e) {
      console.warn('Failed to embed signature:', e);
    }
  };

  await drawSig(signature, leftX);
  await drawSig(signatureRight, rightX);

  // Names (without parentheses or dots)
  const nameY = targetNameY;
  const penerimaName = (namaAplikasi || '').trim();
  
  if (penerimaName) {
    drawText(penerimaName, leftX - (bodyFont.widthOfTextAtSize(penerimaName, baseFontSize) / 2), nameY);
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}
