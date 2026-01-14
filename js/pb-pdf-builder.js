// PB PDF Builder - Generate PDF with proper grid layout and 11pt font
(function(){
  const PDF_LIB_URL = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
  let pdfLibPromise = null;

  async function ensurePdfLib(){
    if(window.PDFLib) return window.PDFLib;
    if(!pdfLibPromise){
      pdfLibPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = PDF_LIB_URL;
        script.async = true;
        script.onload = () => {
          if(window.PDFLib){
            resolve(window.PDFLib);
          } else {
            reject(new Error('pdf-lib tidak tersedia.'));
          }
        };
        script.onerror = () => reject(new Error('Gagal memuat pdf-lib.'));
        document.head.appendChild(script);
      });
    }
    return pdfLibPromise;
  }

  function sanitize(value){
    if(value === undefined || value === null) return '';
    if(Array.isArray(value)) return value.join(', ');
    return String(value).trim();
  }

  // Convert DataURL to Uint8Array for pdf-lib
  function dataUrlToUint8Array(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    
    try {
      const parts = dataUrl.split(',');
      const bstr = atob(parts[1]);
      const n = bstr.length;
      const u8arr = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        u8arr[i] = bstr.charCodeAt(i);
      }
      return u8arr;
    } catch (e) {
      console.warn('Failed to convert DataURL to Uint8Array:', e);
      return null;
    }
  }

  function wrapText(text, font, fontSize, maxWidth){
    const cleaned = sanitize(text);
    if(!cleaned) return [];
    const paragraphs = cleaned.split(/\n+/);
    const lines = [];
    paragraphs.forEach((paragraph, index) => {
      const words = paragraph.trim().replace(/\s+/g, ' ').split(' ');
      let current = '';
      words.forEach(word => {
        if(!word) return;
        const candidate = current ? `${current} ${word}` : word;
        try {
          if(font.widthOfTextAtSize(candidate, fontSize) <= maxWidth){
            current = candidate;
          } else {
            if(current) lines.push(current);
            current = word;
          }
        } catch(e){
          // Fallback if width measurement fails
          if(candidate.length * fontSize * 0.6 <= maxWidth){
            current = candidate;
          } else {
            if(current) lines.push(current);
            current = word;
          }
        }
      });
      if(current) lines.push(current);
      if(index < paragraphs.length - 1){
        lines.push('');
      }
    });
    return lines.filter((line, idx, arr) => line !== '' || (idx && arr[idx - 1] !== ''));
  }

  function drawParagraph(page, font, text, x, y, fontSize, maxWidth, lineHeight){
    if(!text) return y;
    const lines = wrapText(text, font, fontSize, maxWidth);
    let currentY = y;
    lines.forEach(line => {
      page.drawText(line, {
        x,
        y: currentY,
        size: fontSize,
        font,
        color: window.PDFLib.rgb(0, 0, 0)
      });
      currentY -= lineHeight;
    });
    return currentY;
  }

  async function generatePbPdf(data){
    try {
      const pdfLib = await ensurePdfLib();
      const pdfDoc = await pdfLib.PDFDocument.create();
      
      // Try to use Calibri font (fallback to Helvetica if not available)
      let fontBold, fontRegular;
      try {
        // Attempt to fetch Calibri fonts (browser may have it cached or user can serve it)
        // For now, we'll use Helvetica as it's universally available
        fontBold = await pdfDoc.embedFont(pdfLib.StandardFonts.HelveticaBold);
        fontRegular = await pdfDoc.embedFont(pdfLib.StandardFonts.Helvetica);
      } catch (e) {
        console.warn('Using Helvetica font as fallback');
        fontBold = await pdfDoc.embedFont(pdfLib.StandardFonts.HelveticaBold);
        fontRegular = await pdfDoc.embedFont(pdfLib.StandardFonts.Helvetica);
      }
      
      const black = pdfLib.rgb(0, 0, 0);
      const FONT_SIZE = 11;
      const MARGIN = 20;

      // === PAGE 1 ===
      let page1 = pdfDoc.addPage([595.28, 841.89]); // A4
      const pageWidth = page1.getWidth();
      const pageHeight = page1.getHeight();
      let y = pageHeight - MARGIN - 20;

      // Header - CENTERED and BOLD
      const headerText1 = 'KARTU KENDALI PELAYANAN PUBLIK';
      const headerText2 = 'PELABUAHAN PERIKANAN NUSANTARA KARANGANTU';
      
      const width1 = fontBold.widthOfTextAtSize(headerText1, FONT_SIZE);
      const width2 = fontBold.widthOfTextAtSize(headerText2, FONT_SIZE);
      
      page1.drawText(headerText1, {
        x: (pageWidth - width1) / 2,
        y,
        size: FONT_SIZE,
        font: fontBold,
        color: black
      });
      y -= 14;

      page1.drawText(headerText2, {
        x: (pageWidth - width2) / 2,
        y,
        size: FONT_SIZE,
        font: fontBold,
        color: black
      });
      y -= 20;

      // Info fields - simple format
      const infoX = MARGIN;
      const colonX = MARGIN + 80;
      const valueX = MARGIN + 95;

      // Nama Layanan
      page1.drawText('Nama Layanan', { x: infoX, y, size: FONT_SIZE, font: fontRegular, color: black });
      page1.drawText(':', { x: colonX, y, size: FONT_SIZE, font: fontBold, color: black });
      page1.drawText(data.namaLayanan || 'Pelayanan PB', { x: valueX, y, size: FONT_SIZE, font: fontRegular, color: black });
      y -= 14;

      // Pengguna
      page1.drawText('Pengguna', { x: infoX, y, size: FONT_SIZE, font: fontRegular, color: black });
      page1.drawText(':', { x: colonX, y, size: FONT_SIZE, font: fontBold, color: black });
      page1.drawText(data.namaPengguna || '-', { x: valueX, y, size: FONT_SIZE, font: fontRegular, color: black });
      y -= 14;

      // Alamat
      page1.drawText('Alamat', { x: infoX, y, size: FONT_SIZE, font: fontRegular, color: black });
      page1.drawText(':', { x: colonX, y, size: FONT_SIZE, font: fontBold, color: black });
      page1.drawText(data.alamat || '-', { x: valueX, y, size: FONT_SIZE, font: fontRegular, color: black });
      y -= 20;

      // Persyaratan header
      page1.drawText('Persyaratan', { x: infoX, y, size: FONT_SIZE, font: fontRegular, color: black });
      page1.drawText(':', { x: colonX, y, size: FONT_SIZE, font: fontBold, color: black });
      y -= 14;

      // Requirements - format rapi dengan checkbox
      // Check both persyaratan and requirements fields, also handle data.data nesting
      let requirements = [];
      if (data.data && Array.isArray(data.data.requirements) && data.data.requirements.length) {
        requirements = data.data.requirements;
      } else if (Array.isArray(data.requirements) && data.requirements.length) {
        requirements = data.requirements;
      } else if (Array.isArray(data.persyaratan) && data.persyaratan.length) {
        requirements = data.persyaratan;
      }
      
      // All possible requirements list from form
      const allRequirements = [
        'Surat pernyataan kesiapan Kapal Perikanan berangkat dari Nakhoda (Master Sailing Declaration);',
        'Bukti pemenuhan pembayaran pajak pertambahan nilai, bagi Kapal Perikanan yang menggunakan bahan bakar minyak nonsubsidi;',
        'Surat Laik Operasi (SLO);',
        'Surat Tanda Bukti Lapor Kedatangan Kapal (STBLKK);',
        'Perjanjian Kerja Laut (PKL); dan',
        'Dokumen kapal lainnya (Pas Besar/Pas Kecil, Sertifikat Kelaikan, Surat Ukur, Daftar Awak, Buku Sijil, dan dokumen terkait)'
      ];
      
      // If no requirements from data, use all items (for demo/offline)
      if (requirements.length === 0) {
        requirements = allRequirements;
      }
      
      // Get checked state from data if available
      const checkedItems = Array.isArray(data.requirementsChecked) ? data.requirementsChecked : [];
      
      // Debug log
      console.log('PDF Requirements:', requirements);
      console.log('Checked Items:', checkedItems);

      // Only show checked items with X mark, skip unchecked items
      allRequirements.forEach((req, idx) => {
        const isChecked = checkedItems.includes(idx);
        
        // Only render if checked
        if (isChecked) {
          // Checkbox with X mark
          page1.drawRectangle({
            x: valueX - 10,
            y: y - 7,
            width: 7,
            height: 7,
            borderColor: black,
            borderWidth: 0.5
          });
          
          // X mark inside checkbox
          page1.drawLine({
            start: { x: valueX - 9, y: y - 6 },
            end: { x: valueX - 4, y: y - 1 },
            thickness: 0.5,
            color: black
          });
          page1.drawLine({
            start: { x: valueX - 4, y: y - 6 },
            end: { x: valueX - 9, y: y - 1 },
            thickness: 0.5,
            color: black
          });
          
          // Wrap requirement text closer to checkbox to avoid large gaps
          const reqLines = wrapText(req, fontRegular, FONT_SIZE, pageWidth - valueX - 40);
          reqLines.forEach((line, lineIdx) => {
            page1.drawText(line, {
              x: valueX + 10,
              y: y - 1 - (lineIdx * (FONT_SIZE + 1)),
              size: FONT_SIZE,
              font: fontRegular,
              color: black
            });
          });
          y -= (reqLines.length * (FONT_SIZE + 1) + 4);
        }
      });

      y -= 16;

      // === TABLE SECTION ===
      const flowSteps = Array.isArray(data.flowSteps) && data.flowSteps.length ? data.flowSteps : [];
      
      // Column widths adjusted to match original PDF
      // Table width tuned to match PB 2025.pdf
      const tableTotalWidth = pageWidth - (MARGIN * 2) - 20; // slight inset
      const colWidths = {
        no: 22,
        tahapan: 120,
        waktu: 50,
        mulai: 55,
        selesai: 55,
        keterangan: tableTotalWidth - (22 + 120 + 50 + 55 + 55)
      };

      const tableX = MARGIN + 10;
      const rowHeight = 58; // add padding to avoid line collisions
      const headerHeight = 16;
      let tableY = y;

      // Table Header - match table body width
      page1.drawRectangle({
        x: tableX,
        y: tableY - headerHeight,
        width: tableTotalWidth,
        height: headerHeight,
        borderColor: black,
        borderWidth: 0.5
      });

      // Header columns with dividers
      let colX = tableX;
      const headers = ['No', 'Tahapan', 'Waktu', 'Mulai', 'Selesai', 'Keterangan'];
      const widths = [colWidths.no, colWidths.tahapan, colWidths.waktu, colWidths.mulai, colWidths.selesai, colWidths.keterangan];
      
      widths.forEach((w, idx) => {
        if(idx > 0) {
          page1.drawLine({
            start: { x: colX, y: tableY },
            end: { x: colX, y: tableY - headerHeight },
            thickness: 0.5,
            color: black
          });
        }
        
        page1.drawText(headers[idx], {
          x: colX + 4,
          y: tableY - 11,
          size: FONT_SIZE - 2,
          font: fontBold,
          color: black
        });
        colX += w;
      });

      tableY -= headerHeight;
      let rowsOnPage1 = 0;
      const maxRowsPage1 = 4;

      // Data rows on page 1
      for(let i = 0; i < Math.min(flowSteps.length, maxRowsPage1); i++){
        const row = flowSteps[i];
        colX = tableX;
        const rowY = tableY;

        const cellData = [
          String(i + 1),
          sanitize(row.tahapan || row.text || ''),
          sanitize(row.waktu || row.time || ''),
          sanitize(row.mulai || ''),
          sanitize(row.selesai || ''),
          sanitize(row.keterangan || row.catatan || '')
        ];

        cellData.forEach((text, colIdx) => {
          const w = widths[colIdx];
          const fontSize = FONT_SIZE - 2;

          // Cell border
          page1.drawRectangle({
            x: colX,
            y: rowY - rowHeight,
            width: w,
            height: rowHeight,
            borderColor: black,
            borderWidth: 0.5
          });

          // Column dividers
          if(colIdx > 0) {
            page1.drawLine({
              start: { x: colX, y: rowY },
              end: { x: colX, y: rowY - rowHeight },
              thickness: 0.5,
              color: black
            });
          }

          // Cell text
          const cellLines = wrapText(text, fontRegular, fontSize, w - 8);
          cellLines.slice(0, 5).forEach((line, lineIdx) => {
            page1.drawText(line, {
              x: colX + 4,
              y: rowY - 8 - (lineIdx * (fontSize + 2)),
              size: fontSize,
              font: fontRegular,
              color: black
            });
          });

          colX += w;
        });

        tableY -= rowHeight;
        rowsOnPage1++;
      }

      // === PAGE 2 (if needed) ===
      if(flowSteps.length > maxRowsPage1){
        let page2 = pdfDoc.addPage([595.28, 841.89]);
        let y2 = pageHeight - MARGIN - 20;

        // NO HEADER on page 2 - just continue table data
        let tableY2 = y2;

        // Remaining rows (no header)
        for(let i = maxRowsPage1; i < flowSteps.length; i++){
          const row = flowSteps[i];
          colX = tableX;
          const rowY = tableY2;

          const cellData = [
            String(i + 1),
            sanitize(row.tahapan || row.text || ''),
            sanitize(row.waktu || row.time || ''),
            sanitize(row.mulai || ''),
            sanitize(row.selesai || ''),
            sanitize(row.keterangan || row.catatan || '')
          ];

          cellData.forEach((text, colIdx) => {
            const w = widths[colIdx];
            const fontSize = FONT_SIZE - 2;

            page2.drawRectangle({
              x: colX,
              y: rowY - rowHeight,
              width: w,
              height: rowHeight,
              borderColor: black,
              borderWidth: 0.5
            });

            if(colIdx > 0) {
              page2.drawLine({
                start: { x: colX, y: rowY },
                end: { x: colX, y: rowY - rowHeight },
                thickness: 0.5,
                color: black
              });
            }

            const cellLines = wrapText(text, fontRegular, fontSize, w - 8);
            cellLines.slice(0, 5).forEach((line, lineIdx) => {
              page2.drawText(line, {
                x: colX + 4,
                y: rowY - 8 - (lineIdx * (fontSize + 2)),
                size: fontSize,
                font: fontRegular,
                color: black
              });
            });

            colX += w;
          });

          tableY2 -= rowHeight;
        }

        // Signature section on page 2
        tableY2 -= 35;

        // Signature positions
        const penerimaX2 = MARGIN + 20;
        const pemberiX2 = pageWidth - MARGIN - 140;

        // Labels
        tableY2 -= (FONT_SIZE + 8);
        page2.drawText('Penerima Layanan', {
          x: penerimaX2,
          y: tableY2,
          size: FONT_SIZE - 1,
          font: fontRegular,
          color: black
        });

        tableY2 -= 55;

        // Signature image (left + optional right/admin) - keep Y identical for horizontal alignment
        if (data.signature) {
          try {
            const sigData = dataUrlToUint8Array(data.signature);
            if (sigData) {
              const sigImage = await pdfDoc.embedPng(sigData);
              page2.drawImage(sigImage, {
                x: penerimaX2 + 10,
                y: tableY2,
                width: 80,
                height: 35
              });
            }
          } catch (e) {
            console.warn('Failed to embed signature:', e);
          }
        }

        if (data.signatureRight) {
          try {
            const sigDataRight = dataUrlToUint8Array(data.signatureRight);
            if (sigDataRight) {
              const sigImageRight = await pdfDoc.embedPng(sigDataRight);
              page2.drawImage(sigImageRight, {
                x: pemberiX2 + 10,
                y: tableY2,
                width: 80,
                height: 35
              });
            }
          } catch (e) {
            console.warn('Failed to embed right signature:', e);
          }
        }

        tableY2 -= 20;

        // Names (no parentheses or labels)
        const namePenerima = data.namaPengguna || '';

        if (namePenerima) {
          page2.drawText(namePenerima, {
            x: penerimaX2,
            y: tableY2,
            size: FONT_SIZE - 1,
            font: fontRegular,
            color: black
          });
        }
      } else {
        // Signature on page 1 if all rows fit
        tableY -= 30;

        // Signature labels baseline
        // Left (Penerima) slightly shifted right to align with table grid
        const penerimaX1 = MARGIN + 20;
        const pemberiX1 = pageWidth - MARGIN - 140;

        tableY -= (FONT_SIZE + 8);

        page1.drawText('Penerima Layanan', {
          x: penerimaX1,
          y: tableY,
          size: FONT_SIZE - 1,
          font: fontRegular,
          color: black
        });


        tableY -= 55;

        // Signature image (left + optional right/admin) - keep Y identical for horizontal alignment
        if (data.signature) {
          try {
            const sigData = dataUrlToUint8Array(data.signature);
            if (sigData) {
              const sigImage = await pdfDoc.embedPng(sigData);
              page1.drawImage(sigImage, {
                x: penerimaX1 + 10,
                y: tableY,
                width: 80,
                height: 35
              });
            }
          } catch (e) {
            console.warn('Failed to embed signature:', e);
          }
        }

        if (data.signatureRight) {
          try {
            const sigDataRight = dataUrlToUint8Array(data.signatureRight);
            if (sigDataRight) {
              const sigImageRight = await pdfDoc.embedPng(sigDataRight);
              page1.drawImage(sigImageRight, {
                x: pemberiX1 + 10,
                y: tableY,
                width: 80,
                height: 35
              });
            }
          } catch (e) {
            console.warn('Failed to embed right signature:', e);
          }
        }

        tableY -= 20;

        // Names
        const namePenerima = data.namaPengguna || '(Nama Penerima)';

        page1.drawText(`(${namePenerima})`, {
          x: penerimaX1,
          y: tableY,
          size: FONT_SIZE - 1,
          font: fontRegular,
          color: black
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const name = sanitize(data.namaPengguna || data.nama || 'dokumen').replace(/\s+/g, '-');
      const fileName = `Persetujuan-Berlayar-${name}-${Date.now()}.pdf`;

      return { blob, bytes: pdfBytes, fileName };
    } catch(error) {
      console.error('Error generating PB PDF:', error);
      throw new Error('Gagal membuat PDF: ' + (error.message || 'Unknown error'));
    }
  }

  function formatIndonesianDate(dateString){
    if(!dateString) return '';
    const date = new Date(dateString);
    if(Number.isNaN(date.getTime())) return dateString;
    const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  function downloadPbPdf(blob, fileName){
    if(!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  async function generateAndDownloadPbPdf(data){
    const result = await generatePbPdf(data);
    downloadPbPdf(result.blob, result.fileName);
    return result;
  }

  window.generatePbPdf = generatePbPdf;
  window.generateAndDownloadPbPdf = generateAndDownloadPbPdf;
  window.downloadPbPdf = downloadPbPdf;
})();
