async function generatePenggunaanARRAPDF(data) {
  try {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    const margin = 35;
    const pageWidth = 595;
    const pageHeight = 842;

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 11;

    const sanitize = (text) => String(text || '').replace(/<[^>]+>/g, '');

    const drawText = (page, text, x, yPos, opts = {}) => {
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

    const stepsData = [
      {
        no: 1,
        tahapan: 'Menyampaikan permohonan melalui surat/medsos ke Petugas Pelayanan Jasa untuk menggunakan balai pertemuan nelayan/rumah tamu.',
        waktu: '15 Menit'
      },
      {
        no: 2,
        tahapan: 'Mengarahkan untuk login ke Aplikasi SIPANDU untuk booking order.',
        waktu: '10 Menit'
      },
      {
        no: 3,
        tahapan: 'Melakukan input booking order ke aplikasi SIPANDU',
        waktu: '5 Menit'
      },
      {
        no: 4,
        tahapan: 'Melakukan pemeriksaan order dan mengeluarkan billing pembayaran',
        waktu: '5 Menit'
      },
      {
        no: 5,
        tahapan: 'Melakukan pembayaran sesuai dengann billing ke kas negara dan mengupload bukti bayar di aplikasi SIPANDU',
        waktu: '15 Menit'
      },
      {
        no: 6,
        tahapan: 'Bendahara penerima memvalidasi bukti bayar dan menyelesaikan proses pada aplikasi SIPANDU',
        waktu: '5 Menit'
      },
      {
        no: 7,
        tahapan: 'Menerima bukti pembayaran',
        waktu: '2 Menit'
      }
    ];

    // PAGE 1: Data Pengguna + Tabel semua tahapan
    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    // Header
    const line1 = 'KARTU KENDALI PELAYANAN PUBLIK';
    const line2 = 'PELABUAHAN PERIKANAN NUSANTARA KARANGANTU';
    const headerSize = 12;
    const h1w = fontBold.widthOfTextAtSize(line1, headerSize);
    const h2w = fontBold.widthOfTextAtSize(line2, headerSize);
    drawText(page, line1, (pageWidth - h1w) / 2, y, { font: fontBold, size: headerSize });
    y -= 16;
    drawText(page, line2, (pageWidth - h2w) / 2, y, { font: fontBold, size: headerSize });
    y -= 24;

    // Data Pengguna
    drawText(page, 'Nama Layanan :', margin, y);
    drawText(page, 'Penggunaan Ruang Pertemuan Aula, Ruang rapat, asrama, rumah tamu', margin + 120, y);
    y -= 14;

    drawText(page, 'Pengguna :', margin, y);
    drawText(page, data.namaPengguna || '', margin + 120, y);
    y -= 14;

    drawText(page, 'Alamat :', margin, y);
    drawText(page, data.alamatPengguna || '', margin + 120, y);
    y -= 14;

    drawText(page, 'Tanggal Penggunaan', margin, y);
    drawText(page, data.tanggalPengajuan || '', margin + 120, y);
    y -= 24;

    // TABLE HEADER
    page.drawRectangle({
      x: margin,
      y: y - 20,
      width: pageWidth - 2 * margin,
      height: 20,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });

    const colWidths = [25, 265, 60, 50, 50, 75];
    const tableX = margin;
    let xPos = tableX;

    const headers = ['No', 'Tahapan', 'Waktu', 'Mulai', 'Selesai', 'Keterangan'];
    headers.forEach((header, idx) => {
      drawText(page, header, xPos + 5, y - 14, { font: fontBold, size: 11 });
      if (idx < headers.length - 1) {
        page.drawLine({
          start: { x: xPos + colWidths[idx], y: y },
          end: { x: xPos + colWidths[idx], y: y - 20 },
          thickness: 1,
          color: rgb(0, 0, 0),
        });
      }
      xPos += colWidths[idx];
    });

    y -= 20;

    // Draw all steps in table
    stepsData.forEach((step) => {
      // Wrap text untuk kolom tahapan (11pt font)
      const tahapanLines = wrapText(step.tahapan, colWidths[1] - 10, 11, fontRegular);
      const rowHeight = Math.max(30, tahapanLines.length * 12 + 8);

      page.drawRectangle({
        x: tableX,
        y: y - rowHeight,
        width: pageWidth - 2 * margin,
        height: rowHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });

      // Vertical lines
      xPos = tableX;
      headers.forEach((header, colIdx) => {
        if (colIdx < headers.length - 1) {
          page.drawLine({
            start: { x: xPos + colWidths[colIdx], y: y },
            end: { x: xPos + colWidths[colIdx], y: y - rowHeight },
            thickness: 1,
            color: rgb(0, 0, 0),
          });
        }
        xPos += colWidths[colIdx];
      });

      // Content - No
      drawText(page, step.no.toString(), tableX + 8, y - 16, { size: 11 });

      // Content - Tahapan (multi-line with 11pt)
      tahapanLines.forEach((line, idx) => {
        drawText(page, line, tableX + colWidths[0] + 5, y - 14 - (idx * 12), { size: 11 });
      });

      // Content - Waktu
      drawText(page, step.waktu, tableX + colWidths[0] + colWidths[1] + 6, y - 16, { size: 11 });

      // Get workflow data
      if (data.workflowSteps && data.workflowSteps[step.no - 1]) {
        const stepData = data.workflowSteps[step.no - 1];
        drawText(page, stepData.mulai || '', tableX + colWidths[0] + colWidths[1] + colWidths[2] + 5, y - 16, { size: 11 });
        drawText(page, stepData.selesai || '', tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5, y - 16, { size: 11 });
        drawText(page, stepData.keterangan || '', tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + 5, y - 16, { size: 11 });
      }

      y -= rowHeight;
    });

    y -= 30;

    // SIGNATURE SECTION
    // Penerima Layanan (left) - Pemberi Layanan akan ditambahkan oleh admin
    drawText(page, 'Penerima Layanan', margin + 40, y, { size: fontSize });

    const sigY = y - 65;

    // Embed signature images if available (keep Y identical for horizontal alignment)
    const drawSig = async (sigSrc, x) => {
      if (!sigSrc) return;
      try {
        const bytes = await fetch(sigSrc).then(res => res.arrayBuffer());
        const img = await pdfDoc.embedPng(bytes).catch(async () => await pdfDoc.embedJpg(bytes));
        const dims = img.scale(0.3);
        page.drawImage(img, {
          x,
          y: sigY,
          width: dims.width,
          height: dims.height,
        });
      } catch (err) {
        console.warn('Could not embed signature image:', err);
      }
    };

    // Only draw Penerima Layanan signature (left side) - Pemberi Layanan akan ditambah admin
    await drawSig(data.signatureImage, margin + 20);
    
    let sigLeftY = y - 70;
    drawText(page, data.namaPengguna || '', margin + 40, sigLeftY, { size: fontSize });

    // Pemberi Layanan section will be filled by admin later

    // Save PDF and return blob
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    
    return blob;
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Terjadi kesalahan saat membuat PDF. Silakan coba lagi.');
    return false;
  }
}
