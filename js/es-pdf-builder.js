/**
 * Pengadaan ES PDF Builder - Generate PDF using pdf-lib
 * Format: KARTU KENDALI PELAYANAN PUBLIK - PENGADAAN ES
 */

async function generateESPDF(data) {
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]); // A4 size
  
  let { width, height } = page.getSize();
  const margin = 40;
  let yPosition = height - margin;

  // Extract data with defaults
  const {
    namaPengguna = '',
    alamat = '',
    tanggal = '',
    namaPemberiLayanan = '',
    flowSteps = [],
    signature = null,
    signatureRight = null
  } = data;

  // Fonts - Bold for headers
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const bodyFont = helvetica;
  const boldFont = helveticaBold;
  const baseFontSize = 11;

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
  const drawTable = (xStart, yStart, colWidths, rows) => {
    let y = yStart;
    const minRowHeight = 28;
    const cellPadding = 6;
    const fontSize = baseFontSize;
    const lineHeight = fontSize + 2;

    // Draw header row
    if (rows.length) {
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
    for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
      const rowCells = rows[rowIdx];
      
      // Calculate row height based on tallest cell
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
  drawText(': Pengadaan ES', margin + 80, yPosition);
  yPosition -= 18;

  // Pengguna
  drawText('Pengguna', margin, yPosition);
  drawText(`: ${namaPengguna}`, margin + 80, yPosition);
  yPosition -= 18;

  // Alamat
  drawText('Alamat', margin, yPosition);
  drawText(`: ${alamat}`, margin + 80, yPosition);
  yPosition -= 22;

  // Table headers and data
  const colWidths = [25, 240, 55, 50, 50, 95];
  
  // Build table data from flowchartSteps
  const tableHeader = ['No', 'Tahapan', 'Waktu', 'Mulai', 'Selesai', 'Keterangan'];

  // Base rows with fixed descriptions (note: skip no 4)
  const baseRows = [
    ['1', 'Mengisi form order pengadaan Es\npada aplikasi SIPANDU', '5 Menit'],
    ['2', 'Memeriksa ketersediaan Es sesuai\ndengan daftar order serta menghitung\nbiaya. Bila tidak tersedia maka tidak\ndapat dilayani.', '5 Menit'],
    ['3', 'Memberikan pelayanan Es.', '10 Menit'],
    ['5', 'Menerima pelayanan Es dan\nmembayar pelayanan jasa Es.', '5 Menit'],
    ['6', 'Menerima pembayaran dan\nmenyerahkan bukti pembayaran.', '5 Menit'],
    ['7', 'Menerima bukti pembayaran.', '5 Menit'],
  ];

  const tableRows = baseRows.map((row, idx) => {
    const user = Array.isArray(flowSteps) ? flowSteps[idx] : null;
    return [
      row[0],
      row[1],
      row[2],
      user?.mulai || '',
      user?.selesai || '',
      user?.catatan || '',
    ];
  });

  // Draw table
  const allRows = [tableHeader, ...tableRows];
  yPosition = drawTable(margin, yPosition, colWidths, allRows);
  yPosition -= 30;

  // Signature block (center aligned)
  const year = tanggal ? new Date(tanggal).getFullYear() : '2025';
  const sigCenterX = width / 2;
  const columnOffset = 140;
  const leftX = sigCenterX - columnOffset;
  const rightX = sigCenterX + columnOffset;

  // Left side: Penerima Layanan label
  drawText('Penerima Layanan', leftX - (bodyFont.widthOfTextAtSize('Penerima Layanan', baseFontSize) / 2), yPosition);
  
  // Keep spacing consistent
  const pemberiY = yPosition - 12;

  // Signatures (left: user, right: admin) - keep Y identical for horizontal alignment
  const sigImageY = pemberiY - 8;
  let signatureHeight = 0;
  const drawSig = async (sigDataUrl, xCenter, captureHeight = false) => {
    if (!sigDataUrl) return 0;
    try {
      const matches = sigDataUrl.match(/^data:(image\/png|image\/jpeg);base64,(.+)$/);
      if (!matches) return 0;
      const imgType = matches[1];
      const imgBase64 = matches[2];
      const imgBytes = Uint8Array.from(atob(imgBase64), c => c.charCodeAt(0));
      const img = imgType === 'image/png'
        ? await pdfDoc.embedPng(imgBytes)
        : await pdfDoc.embedJpg(imgBytes);
      const imgDims = img.scale(0.35);
      page.drawImage(img, {
        x: xCenter - (imgDims.width / 2),
        y: sigImageY - imgDims.height,
        width: imgDims.width,
        height: imgDims.height
      });
      return captureHeight ? imgDims.height : 0;
    } catch (e) {
      console.warn('Failed to embed signature:', e);
      return 0;
    }
  };

  signatureHeight = await drawSig(signature, leftX, true);
  await drawSig(signatureRight, rightX, false);

  // Names at bottom (place below signature with extra spacing)
  const nameY = sigImageY - signatureHeight - 24;
  if (namaPengguna) {
    drawText(namaPengguna, leftX - (bodyFont.widthOfTextAtSize(namaPengguna, baseFontSize) / 2), nameY);
  }
  // Intentionally omit bottom-right footer text; admin will add later.

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}
