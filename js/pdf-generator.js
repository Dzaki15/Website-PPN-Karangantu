(function(){
  const PDF_LIB_URL = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
  const PDF_SPEC_URL = 'assets/pdf-spec.json';
  const TEMPLATE_BASE_PATH = 'assets/';
  const DEFAULT_INFO_WIDTH = 380;
  const DEFAULT_LINE_GAP = 2;

  const TEMPLATE_CONFIG = {
    'persetujuan-berlayar': { file: 'PB 2025.pdf', defaultFileName: 'persetujuan-berlayar' },
    'pengadaan-es': { file: 'KARTU KENDALI Pengadaan ES 2025.pdf', defaultFileName: 'pengadaan-es' },
    'persetujuan-ruangan': { file: 'KARTU KENDALI Penggunaan aula ruang rapat asramaES 2025.pdf', defaultFileName: 'persetujuan-ruangan' },
    'stblkk': { file: 'STBLKK 2025.pdf', defaultFileName: 'stblkk' },
    'jasa-listrik': { file: 'KARTU KENDALI JASA LISTRIK 2025.pdf', defaultFileName: 'jasa-listrik' },
    'shti-lt': { file: 'Kartu kendali SHTI 2025.pdf', defaultFileName: 'shti-lt' },
    'skkp': { file: 'SKKP 2025.pdf', defaultFileName: 'skkp' }
  };

  const templateBufferCache = new Map();
  let specPromise = null;
  let pdfLibPromise = null;

  function sanitize(value){
    if(value === undefined || value === null) return '';
    if(Array.isArray(value)) return value.join(', ');
    return String(value).trim();
  }

  function requestJson(url){
    return fetch(url, { cache: 'no-store' }).then(res => {
      if(!res.ok) throw new Error(`Gagal memuat resource ${url}`);
      return res.json();
    });
  }

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
            reject(new Error('pdf-lib tidak tersedia di window.'));
          }
        };
        script.onerror = () => reject(new Error('Gagal memuat pdf-lib.'));
        document.head.appendChild(script);
      });
    }
    return pdfLibPromise;
  }

  async function loadPdfSpec(){
    if(!specPromise){
      specPromise = requestJson(PDF_SPEC_URL).then(entries => {
        const byFile = {};
        (entries || []).forEach(entry => {
          if(entry && entry.file){
            byFile[entry.file] = entry;
          }
        });
        return { list: entries, byFile };
      }).catch(error => {
        console.error('Tidak dapat memuat pdf-spec:', error);
        throw error;
      });
    }
    return specPromise;
  }

  async function loadTemplateBytes(fileName){
    if(templateBufferCache.has(fileName)){
      return templateBufferCache.get(fileName);
    }
    const encodedFile = encodeURI(fileName);
    const url = `${TEMPLATE_BASE_PATH}${encodedFile}`;
    const promise = fetch(url).then(res => {
      if(!res.ok) throw new Error(`Template PDF ${fileName} tidak ditemukan.`);
      return res.arrayBuffer();
    }).then(buffer => new Uint8Array(buffer));
    templateBufferCache.set(fileName, promise);
    return promise;
  }

  function drawParagraph(page, font, text, options){
    const {
      x,
      y,
      fontSize = 11,
      maxWidth,
      lineHeight = fontSize + DEFAULT_LINE_GAP,
      color
    } = options;
    if(!text) return;
    const lines = wrapText(text, font, fontSize, maxWidth || (page.getWidth() - x - 32));
    let cursorY = y;
    lines.forEach(line => {
      page.drawText(line, {
        x,
        y: cursorY,
        size: fontSize,
        font,
        color
      });
      cursorY -= lineHeight;
    });
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
        if(font.widthOfTextAtSize(candidate, fontSize) <= maxWidth){
          current = candidate;
        } else {
          if(current) lines.push(current);
          current = word;
        }
      });
      if(current) lines.push(current);
      if(index < paragraphs.length - 1){
        lines.push('');
      }
    });
    return lines.filter((line, idx, arr) => line !== '' || (idx && arr[idx - 1] !== ''));
  }

  function computeColumnLayout(headers, pageWidth){
    const entries = Object.entries(headers || {}).sort((a, b) => (a[1].x || 0) - (b[1].x || 0));
    const layout = { order: [], widthMap: {} };
    if(!entries.length) return layout;
    entries.forEach(([key]) => layout.order.push(key));
    entries.forEach(([key, meta], index) => {
      const x = meta.x || 40;
      const nextX = entries[index + 1] ? entries[index + 1][1].x : (pageWidth - 32);
      layout.widthMap[key] = Math.max(24, (nextX - x) - 6);
    });
    return layout;
  }

  function renderInfoFields(pages, font, specs, info, color){
    if(!specs || !info) return;
    Object.entries(specs).forEach(([key, field]) => {
      const value = sanitize(info[key]);
      if(!value) return;
      const pageIndex = (field.page || 1) - 1;
      const page = pages[pageIndex] || pages[0];
      drawParagraph(page, font, value, {
        x: field.x || 40,
        y: field.y || (page.getHeight() - 80),
        fontSize: field.fontSize || 11,
        maxWidth: field.maxWidth || DEFAULT_INFO_WIDTH,
        color
      });
    });
  }

  function renderTableRows(pages, font, tableSpec, rows, color, pageSize){
    if(!tableSpec || !rows || !rows.length) return;
    const basePageIndex = (tableSpec.page || 1) - 1;
    const firstPage = pages[basePageIndex] || pages[0];
    const pageWidth = pageSize?.width || firstPage.getWidth();
    const layout = computeColumnLayout(tableSpec.headers, pageWidth);
    if(!layout.order.length) return;
    const rowPositions = Array.isArray(tableSpec.rowYs) ? [...tableSpec.rowYs] : [];
    if(!rowPositions.length) return;
    const fontSize = tableSpec.fontSize || 10;
    const lineHeight = tableSpec.lineHeight || (fontSize + 1.5);
    const rowsPerPage = rowPositions.length;
    const maxPages = Math.max(1, pages.length - basePageIndex);
    const maxRows = Math.min(rows.length, rowsPerPage * maxPages);

    for(let idx = 0; idx < maxRows; idx += 1){
      const pageOffset = Math.floor(idx / rowsPerPage);
      const rowIndexInPage = idx % rowsPerPage;
      const page = pages[basePageIndex + pageOffset] || pages[pages.length - 1];
      const y = rowPositions[rowIndexInPage];
      const rowData = rows[idx] || {};

      layout.order.forEach(columnKey => {
        const columnMeta = tableSpec.headers[columnKey] || {};
        const width = layout.widthMap[columnKey] || 80;
        let cellValue = '';
        if(columnKey === 'no'){
          cellValue = sanitize(rowData.no !== undefined ? rowData.no : String(idx + 1));
        } else {
          const direct = rowData[columnKey];
          const lowerKey = typeof columnKey === 'string' ? columnKey.toLowerCase() : columnKey;
          const lower = rowData[lowerKey];
          cellValue = sanitize(direct !== undefined ? direct : lower);
        }
        if(!cellValue) return;
        drawParagraph(page, font, cellValue, {
          x: columnMeta.x || 40,
          y,
          fontSize,
          maxWidth: width,
          lineHeight,
          color
        });
      });
    }
  }

  function renderSignature(pages, font, signatureSpec, signatureData, color){
    if(!signatureSpec || !signatureData) return;
    const fontSize = 11;
    const labelSize = 10.5;

    if(signatureSpec.date){
      const dateText = signatureData.date || signatureData.dateText;
      if(dateText){
        const page = pages[(signatureSpec.date.page || 1) - 1] || pages[0];
        drawParagraph(page, font, sanitize(dateText), {
          x: signatureSpec.date.x || 360,
          y: signatureSpec.date.y || (page.getHeight() / 2),
          fontSize,
          maxWidth: 180,
          color
        });
      }
    }

    if(signatureSpec.penerimaLabel){
      const label = signatureData.penerimaLabel || 'Penerima Layanan';
      const page = pages[(signatureSpec.penerimaLabel.page || 1) - 1] || pages[0];
      drawParagraph(page, font, sanitize(label), {
        x: signatureSpec.penerimaLabel.x,
        y: signatureSpec.penerimaLabel.y,
        fontSize: labelSize,
        maxWidth: 200,
        color
      });
      if(signatureData.penerimaName && signatureSpec.penerimaLine){
        drawParagraph(page, font, sanitize(signatureData.penerimaName), {
          x: signatureSpec.penerimaLine.x,
          y: signatureSpec.penerimaLine.y,
          fontSize,
          maxWidth: 220,
          color
        });
      }
    }

    if(signatureSpec.pemberiLabel){
      const label = signatureData.pemberiLabel || 'Petugas / Pejabat';
      const page = pages[(signatureSpec.pemberiLabel.page || 1) - 1] || pages[0];
      drawParagraph(page, font, sanitize(label), {
        x: signatureSpec.pemberiLabel.x,
        y: signatureSpec.pemberiLabel.y,
        fontSize: labelSize,
        maxWidth: 220,
        color
      });
      const pemberiY = signatureSpec.pemberiLine ? signatureSpec.pemberiLine.y : (signatureSpec.pemberiLabel.y - 46);
      const pemberiX = signatureSpec.pemberiLine ? signatureSpec.pemberiLine.x : signatureSpec.pemberiLabel.x;
      if(signatureData.pemberiName){
        drawParagraph(page, font, sanitize(signatureData.pemberiName), {
          x: pemberiX,
          y: pemberiY,
          fontSize,
          maxWidth: 220,
          color
        });
      }
    }
  }

  async function generateServicePdf(config){
    const options = config || {};
    const templateSlug = options.templateSlug;
    if(!templateSlug) throw new Error('templateSlug wajib diisi.');
    const templateMeta = TEMPLATE_CONFIG[templateSlug];
    if(!templateMeta) throw new Error(`Template untuk slug ${templateSlug} belum dikonfigurasi.`);

    const [{ byFile }, pdfLib] = await Promise.all([
      loadPdfSpec(),
      ensurePdfLib()
    ]);

    const templateSpec = byFile[templateMeta.file];
    if(!templateSpec) throw new Error(`Spesifikasi PDF untuk ${templateMeta.file} tidak ditemukan.`);

    const templateBytes = await loadTemplateBytes(templateMeta.file);
    const pdfDoc = await pdfLib.PDFDocument.load(templateBytes);
    const font = await pdfDoc.embedFont(pdfLib.StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const textColor = pdfLib.rgb(0, 0, 0);

    renderInfoFields(pages, font, templateSpec.infoFields, options.info || {}, textColor);
    renderTableRows(pages, font, templateSpec.table, options.rows || options.tableRows || [], textColor, templateSpec.pageSize);
    renderSignature(pages, font, templateSpec.signature, options.signature || {}, textColor);

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const fileName = options.fileName || `${templateMeta.defaultFileName || templateSlug}-${Date.now()}.pdf`;

    return {
      blob,
      bytes: pdfBytes,
      fileName
    };
  }

  function downloadPdfBlob(blob, fileName){
    if(!blob) return;
    const safeName = fileName || `dokumen-${Date.now()}.pdf`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  async function generateAndDownloadPdf(config){
    const result = await generateServicePdf(config);
    downloadPdfBlob(result.blob, result.fileName);
    return result;
  }

  window.generateServicePdf = generateServicePdf;
  window.generateAndDownloadPdf = generateAndDownloadPdf;
  window.downloadPdfBlob = downloadPdfBlob;
})();
