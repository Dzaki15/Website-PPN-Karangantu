// SKKP Form Handler (aligned with SHTI LT flow)
console.log('[skkp.js] Loaded');
const stepOrder = [0, 1, 2, 3, 4];
let currentStep = 0;
let currentFlowchartStep = 0;
let skkpData = {};
let signaturePadCanvas;
let signatureCtx;
let signaturePad;
let isDrawing = false;
let pdfDoc = null;
let pdfCurrentPage = 1;
const ARCHIVE_META = { slug: 'skkp', name: 'Form Sertifikat Kelaikan Kapal Perikanan' };

const flowchartSteps = [
  {
    shortTitle: 'Pemohon menyampaikan permohonan SKKP lewat SICEFI',
    pdfLabel: 'Pemohon kirim permohonan SKKP via SICEFI',
    title: 'Menyampaikan Permohonan penerbitan Sertifikat Kelaikan Kapal Perikanan melalui aplikasi SICEFI',
    waktu: 'Waktu: Waktu Pemohon',
    mulai: '',
    selesai: '',
    keterangan: ''
  },
  {
    shortTitle: 'Petugas menerima dan disposisi ke verifikator',
    pdfLabel: 'Petugas teruskan permohonan ke verifikator',
    title: 'Menerima permohonan dan Mendisposisikan kepada Verifikator untuk memeriksa kelengkapan serta menilai kesesuaian dokumen persyaratan',
    waktu: 'Waktu: 5 menit',
    mulai: '',
    selesai: '',
    keterangan: ''
  },
  {
    shortTitle: 'Verifikator memeriksa kelengkapan dokumen',
    pdfLabel: 'Verifikator cek kelengkapan dokumen',
    title: 'Melakukan verifikasi terhadap kesesuaian dokumen persyaratan melalui aplikasi SICEFI: a. jika sesuai menyampaikan hasil kepada koordinator b. jika tidak sesuai menyampaikan pemberitahuan penolakan kepada pemohon',
    waktu: 'Waktu: 30 menit',
    mulai: '',
    selesai: '',
    keterangan: ''
  },
  {
    shortTitle: 'Koordinator menyiapkan surat tugas pemeriksaan',
    pdfLabel: 'Koordinator susun draft surat tugas',
    title: 'Menerima Hasil Verifikasi, membuat Draf Surat Tugas Pemeriksaan Kelaikan Kapal Perikanan Kepada Kepala Pelabuhan pada aplikasi SICEFI',
    waktu: 'Waktu: 10 menit',
    mulai: '',
    selesai: '',
    keterangan: ''
  },
  {
    shortTitle: 'Kepala pelabuhan menyetujui surat tugas dan memberi jadwal',
    pdfLabel: 'Kepala pelabuhan setujui tugas & jadwal',
    title: 'Memeriksa Draf Surat Tugas: a. jika setuju, Approve Surat Tugas pada aplikasi SICEFI dan menyampaikan kepada Petugas Pemeriksa Kelaikan Kapal Perikanan dan Mengirim pemberitahuan jadwal b. jika tidak setuju, draft dikembalikan kepada Koordinator SKKP c. koordinator klik selesai pada aplikasi SICEFI',
    waktu: 'Waktu: 5 menit',
    mulai: '',
    selesai: '',
    keterangan: ''
  },
  {
    shortTitle: 'Pemohon menyiapkan kapal dan pendamping sesuai jadwal',
    pdfLabel: 'Pemohon siapkan kapal & pendamping',
    title: 'Menerima pemberitahuan jadwal pelaksanaan pemeriksaan di aplikasi SICEFI, menyiapkan kapal perikanan, dan pendamping bagi petugas pemeriksa kelaikan kapal perikanan sesuai dengan jadwal pemeriksaan',
    waktu: 'Waktu: Waktu Pemohon',
    mulai: '',
    selesai: '',
    keterangan: ''
  },
  {
    shortTitle: 'Petugas melaksanakan pemeriksaan dan lapor hasil',
    pdfLabel: 'Petugas periksa kapal dan buat laporan',
    title: 'Menerima Surat Tugas, melaksanakan pemeriksaan, membuat dan menyampaikan laporan hasil pemeriksaan kelaikan kapal perikanan kepada Kepala Pelabuhan',
    waktu: 'Waktu: 1 hari',
    mulai: '',
    selesai: '',
    keterangan: ''
  },
  {
    shortTitle: 'Kepala pelabuhan menilai hasil dan menandatangani SKKP',
    pdfLabel: 'Kepala pelabuhan nilai hasil & tandatangani',
    title: 'Mewawcarai laporan hasil pemeriksaan kelaikan kapal perikanan serta menyetujui dan menandatangani: a. Sertifikat Kelaikan Kapal Perikanan jika sesuai, b. Surat Penolakan diterbitkan jika tidak sesuai',
    waktu: 'Waktu: 20 menit',
    mulai: '',
    selesai: '',
    keterangan: ''
  },
  {
    shortTitle: 'Pemohon menerima SKKP atau surat penolakan',
    pdfLabel: 'Pemohon terima SKKP atau surat pemberitahuan penolakan',
    title: 'Menerima Sertifikat Kelaikan Kapal Perikanan atau Surat Pemberitahuan Penolakan',
    waktu: 'Waktu: Waktu Pemohon',
    mulai: '',
    selesai: '',
    keterangan: ''
  }
];

const REQUIREMENT_ITEMS = [
  { key: 'req1', label: 'Permohonan dan persyaratan siap diperiksa', code: '1' },
  { key: 'req2', label: 'Fotokopi SIUP', code: '2' },
  { key: 'req3', label: 'Persetujuan pengadaan Kapal Perikanan (PPKP)', code: '3' },
  { key: 'req4', label: 'Surat ukur', code: '4' },
  { key: 'req5', label: 'Gambar General Arrangement', code: '5' },
  { key: 'req6', label: 'Gambar Engine Room Layout', code: '6' },
  { key: 'req7', label: 'Surat keterangan docking atau tukang', code: '7' },
  { key: 'req8', label: 'Foto kapal & alat tangkap', code: '8' }
];

function buildRequirementSnapshot(formData) {
  const codes = [];
  const descriptions = [];
  REQUIREMENT_ITEMS.forEach(item => {
    if (formData.get(item.key)) {
      codes.push(item.code);
      descriptions.push(item.label);
    }
  });
  return { codes, descriptions };
}

function stripWaktuLabel(value) {
  if (!value) return '';
  return value.replace(/^Waktu:\s*/i, '').trim();
}

function buildFlowRows() {
  return flowchartSteps.map((step, idx) => ({
    no: idx + 1,
    tahapan: step.pdfLabel || step.shortTitle || step.title,
    waktu: stripWaktuLabel(step.waktu),
    mulai: step.mulai || '',
    selesai: step.selesai || '',
    keterangan: step.keterangan || ''
  }));
}

function formatIndonesianDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function sanitizeFileName(text) {
  if (!text) return 'dokumen';
  const sanitized = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return sanitized || 'dokumen';
}

function buildSkkpPdfFileName(nameValue) {
  const safe = sanitizeFileName(nameValue);
  return `SKKP-${safe}-${Date.now()}.pdf`;
}

function buildSkkpSnapshot() {
  const form = document.getElementById('skkpForm');
  if (!form) return null;
  const formData = new FormData(form);
  const requirementInfo = buildRequirementSnapshot(formData);
  const snapshot = {
    namaPengguna: formData.get('namaPengguna') || '',
    alamat: formData.get('alamat') || '',
    tanggal: formData.get('tanggal') || '',
    namaPemberiLayanan: formData.get('namaPeriksaLaporan') || '',
    persyaratanCodes: requirementInfo.codes,
    persyaratan: requirementInfo.descriptions,
    flowchartSteps: buildFlowRows(),
    signature: formData.get('signatureData') || '',
    updatedAt: new Date().toISOString()
  };
  REQUIREMENT_ITEMS.forEach(item => {
    snapshot[item.key] = Boolean(formData.get(item.key));
  });
  return snapshot;
}

function buildPdfInput(snapshot) {
  if (!snapshot) return null;
  const requirementText = snapshot.persyaratanCodes && snapshot.persyaratanCodes.length
    ? `Dipenuhi: ${snapshot.persyaratanCodes.join(', ')}`
    : 'Checklist belum dipilih';
  const safeName = snapshot.namaPengguna ? `skkp-${sanitizeFileName(snapshot.namaPengguna)}` : null;
  return {
    templateSlug: 'skkp',
    fileName: safeName ? `${safeName}.pdf` : undefined,
    info: {
      Pengguna: snapshot.namaPengguna || '-',
      Alamat: snapshot.alamat || '-',
      Persyaratan: requirementText
    },
    rows: snapshot.flowchartSteps,
    signature: {
      date: formatIndonesianDate(snapshot.tanggal),
      penerimaLabel: 'Pemohon',
      penerimaName: snapshot.namaPengguna || '-',
      pemberiLabel: 'Petugas / Pemberi Layanan',
      pemberiName: snapshot.namaPemberiLayanan || '-',
      image: snapshot.signature || ''
    }
  };
}

function updateStepUI() {
  const steps = Array.from(document.querySelectorAll('.stblkk-step'));
  const progress = Array.from(document.querySelectorAll('#skkpProgress .progress-step'));
  steps.forEach(stepEl => {
    const stepIndex = Number(stepEl.dataset.step);
    const active = stepIndex === currentStep;
    stepEl.classList.toggle('active', active);
  });
  progress.forEach((p, idx) => {
    p.classList.toggle('active', idx <= currentStep);
  });
}

function showStep(stepIndex) {
  if (!stepOrder.includes(stepIndex)) return;
  currentStep = stepIndex;
  updateStepUI();
  if (currentStep === 2) {
    renderFlowchartStep();
  }
  if (currentStep === 4) {
    renderPdfPreview();
  }
}

function renderFlowchartStep() {
  const step = flowchartSteps[currentFlowchartStep];

  const flowStepLabel = document.getElementById('flowStepLabel');
  const flowTextEl = document.getElementById('flowText');
  const flowTimeEl = document.getElementById('flowTime');
  const flowStartInput = document.getElementById('flowStart');
  const flowEndInput = document.getElementById('flowEnd');
  const flowNotesInput = document.getElementById('flowNotes');
  const flowNextBtn = document.getElementById('flowNext');

  if (flowStepLabel) flowStepLabel.textContent = `Langkah ${currentFlowchartStep + 1} dari ${flowchartSteps.length}`;
  if (flowTextEl) flowTextEl.textContent = step.title;
  if (flowTimeEl) flowTimeEl.textContent = step.waktu;
  if (flowStartInput) flowStartInput.value = step.mulai || '';
  if (flowEndInput) flowEndInput.value = step.selesai || '';
  if (flowNotesInput) flowNotesInput.value = step.keterangan || '';
  if (flowNextBtn) flowNextBtn.textContent = currentFlowchartStep === flowchartSteps.length - 1 ? 'Tanda Tangan' : 'Selanjutnya';
}

function nextFlowchartStep() {
  const mulaiEl = document.getElementById('flowStart');
  const selesaiEl = document.getElementById('flowEnd');
  const ketEl = document.getElementById('flowNotes');
  const step = flowchartSteps[currentFlowchartStep];
  step.mulai = mulaiEl ? mulaiEl.value : '';
  step.selesai = selesaiEl ? selesaiEl.value : '';
  step.keterangan = ketEl ? ketEl.value : '';

  if (currentFlowchartStep < flowchartSteps.length - 1) {
    currentFlowchartStep++;
    renderFlowchartStep();
  } else {
    showStep(3);
  }
}

function prevFlowStep() {
  if (currentFlowchartStep === 0) {
    showStep(1);
    return;
  }
  currentFlowchartStep--;
  renderFlowchartStep();
}

function attachFlowHandlers() {
  const flowPrevBtn = document.getElementById('flowPrev');
  const flowNextBtn = document.getElementById('flowNext');
  if (flowPrevBtn) flowPrevBtn.addEventListener('click', prevFlowStep);
  if (flowNextBtn) flowNextBtn.addEventListener('click', nextFlowchartStep);
}

function initSignaturePad() {
  signaturePadCanvas = document.getElementById('signaturePad');
  if (!signaturePadCanvas) return;
  signatureCtx = signaturePadCanvas.getContext('2d');
  if (typeof window.setupSignatureCanvas === 'function') {
    signaturePad = window.setupSignatureCanvas(signaturePadCanvas, { strokeStyle: '#000', lineWidth: 2 });
  }
}

function saveSignature() {
  const sigInput = document.getElementById('signatureData');
  if (!signaturePadCanvas || !sigInput) return;
  const dataUrl = signaturePad ? signaturePad.toDataUrl() : signaturePadCanvas.toDataURL('image/png');
  if (!dataUrl) {
    alert('Silakan bubuhkan tanda tangan terlebih dahulu!');
    return;
  }
  sigInput.value = dataUrl;
  localStorage.setItem('skkpSignature', dataUrl);
  alert('Tanda tangan disimpan');
}

function resetSignature() {
  if (!signaturePadCanvas) return;
  if (signaturePad) {
    signaturePad.clear();
  } else if (signatureCtx) {
    signatureCtx.clearRect(0, 0, signaturePadCanvas.width, signaturePadCanvas.height);
  }
  const sigInput = document.getElementById('signatureData');
  if (sigInput) sigInput.value = '';
  localStorage.removeItem('skkpSignature');
}

function loadSavedSignature() {
  const sig = localStorage.getItem('skkpSignature');
  if (!sig || !signaturePadCanvas) return;
  if (signaturePad) {
    signaturePad.loadDataUrl(sig);
    const sigInput = document.getElementById('signatureData');
    if (sigInput) sigInput.value = sig;
    return;
  }
  const img = new Image();
  img.onload = () => {
    signatureCtx.clearRect(0, 0, signaturePadCanvas.width, signaturePadCanvas.height);
    signatureCtx.drawImage(img, 0, 0, signaturePadCanvas.width, signaturePadCanvas.height);
    const sigInput = document.getElementById('signatureData');
    if (sigInput) sigInput.value = sig;
  };
  img.src = sig;
}

function handleSignatureUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file || !signaturePadCanvas) return;
  const reader = new FileReader();
  reader.onload = ev => {
    if (signaturePad) {
      signaturePad.loadDataUrl(ev.target.result);
      const sigInput = document.getElementById('signatureData');
      if (sigInput) sigInput.value = ev.target.result;
      localStorage.setItem('skkpSignature', ev.target.result);
      return;
    }
    const img = new Image();
    img.onload = () => {
      signatureCtx.clearRect(0, 0, signaturePadCanvas.width, signaturePadCanvas.height);
      signatureCtx.drawImage(img, 0, 0, signaturePadCanvas.width, signaturePadCanvas.height);
      const dataUrl = signaturePadCanvas.toDataURL('image/png');
      const sigInput = document.getElementById('signatureData');
      if (sigInput) sigInput.value = dataUrl;
      localStorage.setItem('skkpSignature', dataUrl);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function persistArchiveEntry(fileName, pdfBlob) {
  if (typeof window.archiveDocument !== 'function') {
    console.error('[SKKP] window.archiveDocument tidak ada!');
    return;
  }
  if (!skkpData) {
    console.error('[SKKP] skkpData kosong!');
    return;
  }
  console.log('[SKKP] persistArchiveEntry called:', { fileName, hasPdf: !!pdfBlob, skkpData });
  window.archiveDocument({
    serviceSlug: ARCHIVE_META.slug,
    serviceName: ARCHIVE_META.name,
    userName: skkpData.namaPengguna || skkpData.namaPemberiLayanan || skkpData.namaPemohon || 'Tanpa Nama',
    data: skkpData,
    fileName: fileName || skkpData.pdfFileName,
    pdfBlob
  });
  console.log('[SKKP] persistArchiveEntry: done');
}

async function renderPdfPreview() {
  const container = document.getElementById('pdfPreviewContainer');
  const indicator = document.getElementById('pdfPageIndicator');
  if (!container) return;
  container.innerHTML = '<p style="color:#666;">Mempersiapkan dokumen...</p>';

  const snapshot = buildSkkpSnapshot();
  if (!snapshot) {
    container.innerHTML = '<p style="color:#e74c3c;">Lengkapi formulir untuk melihat preview.</p>';
    return;
  }
  skkpData = snapshot;
  localStorage.setItem('skkpData', JSON.stringify(snapshot));
  if (snapshot.signature) {
    localStorage.setItem('skkpSignature', snapshot.signature);
  }

  const requestData = {
    namaAplikasi: snapshot.namaPengguna || '',
    alamat: snapshot.alamat || '',
    tanggal: snapshot.tanggal || '',
    namaPemberiLayanan: snapshot.namaPemberiLayanan || '',
    persyaratan: snapshot.persyaratan || [],
    flowchartSteps: snapshot.flowchartSteps || [],
    signature: snapshot.signature || null
  };

  let blob;
  if (typeof generateSKKPPDF === 'function') {
    try {
      blob = await generateSKKPPDF(requestData);
    } catch (err) {
      console.error('Gagal membuat PDF client-side:', err);
    }
  }

  if (!blob) {
    container.innerHTML = '<p style="color:#e74c3c;">PDF builder tidak tersedia.</p>';
    return;
  }

  const url = URL.createObjectURL(blob);
  if (typeof pdfjsLib === 'undefined') {
    container.innerHTML = '<p style="color:#e74c3c;">pdf.js tidak dimuat.</p>';
    return;
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/pdfjs/pdf.worker.min.js';
  pdfDoc = await pdfjsLib.getDocument(url).promise;
  pdfCurrentPage = 1;
  await renderPdfPage(pdfCurrentPage, container);
  if (indicator) indicator.textContent = `Halaman ${pdfCurrentPage}`;
}

async function renderPdfPage(pageNum, container) {
  if (!pdfDoc || !container) return;
  const page = await pdfDoc.getPage(pageNum);

  // Scale to container width so the preview always fits inside the border.
  // Use devicePixelRatio for crisp rendering without changing the layout size.
  const containerStyles = window.getComputedStyle(container);
  const paddingX = (parseFloat(containerStyles.paddingLeft) || 0) + (parseFloat(containerStyles.paddingRight) || 0);
  const availableWidth = Math.max(200, container.clientWidth - paddingX);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(2, availableWidth / baseViewport.width);
  const viewport = page.getViewport({ scale });
  const outputScale = window.devicePixelRatio || 1;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;
  canvas.style.maxWidth = '100%';
  canvas.style.display = 'block';
  canvas.style.margin = '0 auto';

  ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0);
  await page.render({ canvasContext: ctx, viewport }).promise;
  container.innerHTML = '';
  container.appendChild(canvas);
}

async function downloadPDF() {
  const snapshot = buildSkkpSnapshot();
  if (!snapshot) {
    alert('Lengkapi formulir sebelum mengunduh.');
    return;
  }
  skkpData = snapshot;
  localStorage.setItem('skkpData', JSON.stringify(snapshot));
  if (snapshot.signature) localStorage.setItem('skkpSignature', snapshot.signature);

  const requestData = {
    namaAplikasi: snapshot.namaPengguna || '',
    alamat: snapshot.alamat || '',
    tanggal: snapshot.tanggal || '',
    namaPemberiLayanan: snapshot.namaPemberiLayanan || '',
    persyaratan: snapshot.persyaratan || [],
    flowchartSteps: snapshot.flowchartSteps || [],
    signature: snapshot.signature || null
  };

  let blob;
  if (typeof generateSKKPPDF === 'function') {
    try {
      blob = await generateSKKPPDF(requestData);
    } catch (err) {
      console.error('Gagal membuat PDF client-side:', err);
    }
  }

  if (!blob) {
    alert('PDF builder tidak tersedia.');
    return;
  }

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileName = buildSkkpPdfFileName(snapshot.namaPengguna);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);

  skkpData.pdfFileName = fileName;
  persistArchiveEntry(fileName, blob);
}

async function saveSKKP() {
  if (!skkpData || !skkpData.namaPengguna) {
    skkpData = buildSkkpSnapshot();
  }
  if (!skkpData) {
    alert('Lengkapi formulir sebelum menyimpan.');
    return;
  }

  // Generate the exact same PDF and store it (no download) so preview matches 1:1.
  const requestData = {
    namaAplikasi: skkpData.namaPengguna || '',
    alamat: skkpData.alamat || '',
    tanggal: skkpData.tanggal || '',
    namaPemberiLayanan: skkpData.namaPemberiLayanan || '',
    persyaratan: skkpData.persyaratan || [],
    flowchartSteps: skkpData.flowchartSteps || [],
    signature: skkpData.signature || null
  };

  let blob = null;
  if (typeof generateSKKPPDF === 'function') {
    try {
      blob = await generateSKKPPDF(requestData);
    } catch (err) {
      console.error('Gagal membuat PDF untuk arsip:', err);
    }
  }

  const fileName = buildSkkpPdfFileName(skkpData.namaPengguna);
  skkpData.pdfFileName = fileName;
  console.log('[SKKP] saveSKKP: About to call persistArchiveEntry with fileName=', fileName, 'hasPdf=', !!blob);
  persistArchiveEntry(fileName, blob || undefined);
  alert('Data SKKP tersimpan. Membuka Arsip Dokumen...');
  console.log('[SKKP] saveSKKP: After persistArchiveEntry, navigating to arsip-dokumen.html');
  setTimeout(() => navigateWithFade('arsip-dokumen.html'), 800);
}

function resetForm() {
  const form = document.getElementById('skkpForm');
  if (form) form.reset();
  resetSignature();
  currentFlowchartStep = 0;
  renderFlowchartStep();
  showStep(0);
  localStorage.removeItem('skkpData');
  localStorage.removeItem('skkpSignature');
}

function attachNavHandlers() {
  const buttons = document.querySelectorAll('[data-action]');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      if (action === 'next') {
        showStep(Math.min(currentStep + 1, stepOrder.length - 1));
      } else if (action === 'prev') {
        if (currentStep === 0) {
          navigateWithFade('home.html');
        } else {
          showStep(Math.max(currentStep - 1, 0));
        }
      }
    });
  });

  const progress = document.querySelectorAll('#skkpProgress .progress-step');
  progress.forEach((el, idx) => {
    el.addEventListener('click', () => {
      showStep(idx);
    });
  });
}

function attachDownloadHandlers() {
  const downloadBtn = document.getElementById('skkpDownload');
  const saveBtn = document.getElementById('skkpSave');
  const homeBtn = document.getElementById('skkpHome');
  const resetBtn = document.getElementById('skkpReset');
  const prevBtn = document.getElementById('pdfPrevPage');
  const nextBtn = document.getElementById('pdfNextPage');
  const indicator = document.getElementById('pdfPageIndicator');

  if (downloadBtn) downloadBtn.addEventListener('click', downloadPDF);
  if (saveBtn) saveBtn.addEventListener('click', saveSKKP);
  if (homeBtn) homeBtn.addEventListener('click', () => navigateWithFade('home.html'));
  if (resetBtn) resetBtn.addEventListener('click', resetForm);
  if (prevBtn) {
    prevBtn.addEventListener('click', async () => {
      if (!pdfDoc) return;
      pdfCurrentPage = Math.max(1, pdfCurrentPage - 1);
      await renderPdfPage(pdfCurrentPage, document.getElementById('pdfPreviewContainer'));
      if (indicator) indicator.textContent = `Halaman ${pdfCurrentPage}`;
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', async () => {
      if (!pdfDoc) return;
      pdfCurrentPage = Math.min(pdfDoc.numPages, pdfCurrentPage + 1);
      await renderPdfPage(pdfCurrentPage, document.getElementById('pdfPreviewContainer'));
      if (indicator) indicator.textContent = `Halaman ${pdfCurrentPage}`;
    });
  }
}

function attachSignatureHandlers() {
  const saveBtn = document.getElementById('signatureSave');
  const resetBtn = document.getElementById('signatureReset');
  const uploadInput = document.getElementById('signatureUpload');
  if (saveBtn) saveBtn.addEventListener('click', saveSignature);
  if (resetBtn) resetBtn.addEventListener('click', resetSignature);
  if (uploadInput) uploadInput.addEventListener('change', handleSignatureUpload);
}

window.addEventListener('DOMContentLoaded', () => {
  attachNavHandlers();
  attachFlowHandlers();
  attachDownloadHandlers();
  initSignaturePad();
  attachSignatureHandlers();
  loadSavedSignature();
  renderFlowchartStep();
  updateStepUI();
});
