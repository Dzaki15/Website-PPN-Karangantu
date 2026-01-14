(function(){
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('shtiForm');
    if(!form) return;

    const steps = Array.from(document.querySelectorAll('.shti-step'));
  const nextButtons = form.querySelectorAll('[data-action="next"]');
  const prevButtons = form.querySelectorAll('[data-action="prev"]');
  const progressSteps = Array.from(document.querySelectorAll('#shtiProgress .progress-step'));
  // Map 5 progress clusters to form steps: Data (0), Persyaratan (1), Proses (2), TTD (9), Download (10)
  const CLUSTER_STEPS = [0, 1, 2, 9, 10];
    const toast = document.getElementById('shtiToast');

    const downloadBtn = document.getElementById('shtiDownload');
    const pdfDownloadBtn = document.getElementById('shtiPdfDownload');
    const saveBtn = document.getElementById('shtiSave');
    const homeBtn = document.getElementById('shtiHome');
    const resetBtn = document.getElementById('shtiReset');
    const finishBtn = null;

    const signaturePad = document.getElementById('signaturePad');
    const signatureUpload = document.getElementById('signatureUpload');
    const signatureDataInput = document.getElementById('signatureData');
    const signatureSaveBtn = document.getElementById('signatureSave');
    const signatureResetBtn = document.getElementById('signatureReset');

  let currentStep = 0;
  let signatureCtx;
  let drawing = false;
  let signatureInitialized = false;
    const ARCHIVE_META = {
      slug: 'shti-lt',
      name: 'Form Persetujuan SHTI LT'
    };

    function updateProgressDisplay(){
      if(!progressSteps.length) return;
      // Map current step to cluster: 0->0 (Data), 1->1 (Persyaratan), 2-8->2 (Proses), 9->3 (TTD), 10->4 (Download)
      const clusterIndex = (currentStep === 0) ? 0 : (currentStep === 1) ? 1 : (currentStep >= 2 && currentStep <= 8) ? 2 : (currentStep === 9) ? 3 : 4;
      progressSteps.forEach((step, idx) => {
        step.classList.toggle('active', idx === clusterIndex);
        step.classList.toggle('completed', idx < clusterIndex);
      });
    }

    function showStep(index){
      if(index < 0 || index >= steps.length) return;
      currentStep = index;
      steps.forEach((section, idx) => {
        section.classList.toggle('active', idx === currentStep);
      });
      updateProgressDisplay();
      steps[currentStep].scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // Trigger PDF preview when entering step 10 (download page)
      if(index === 10) {
        setTimeout(buildAndRenderPDF, 100);
      }
    }

    function showToast(message){
      if(!toast) return;
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2400);
    }

    function validateStep(index){
      const section = steps[index];
      if(!section) return true;

      if(section.id === 'signatureStep'){
        if(!signatureDataInput.value){
          showToast('Simpan tanda tangan terlebih dahulu.');
          return false;
        }
        return true;
      }

      const requiredFields = Array.from(section.querySelectorAll('[required]'));
      for(const field of requiredFields){
        if(field.disabled) continue;
        if(field.type === 'checkbox' || field.type === 'radio'){
          const group = section.querySelectorAll(`[name="${field.name}"]`);
          const anyChecked = Array.from(group).some(input => input.checked);
          if(!anyChecked){
            showToast('Lengkapi pilihan pada langkah ini.');
            return false;
          }
          continue;
        }
        if(!field.value){
          field.reportValidity();
          field.focus();
          return false;
        }
      }
      return true;
    }

    function validateAllSteps(){
      for(let idx = 0; idx < steps.length; idx += 1){
        if(!validateStep(idx)){
          showStep(idx);
          return false;
        }
      }
      return true;
    }

    nextButtons.forEach(btn => btn.addEventListener('click', () => {
      if(validateStep(currentStep)){
        showStep(currentStep + 1);
      }
    }));

    prevButtons.forEach(btn => btn.addEventListener('click', () => {
      if(currentStep > 0){
        showStep(currentStep - 1);
      }
    }));

    // Make progress steps clickable
    progressSteps.forEach((stepEl, idx) => {
      try {
        stepEl.style.cursor = 'pointer';
        stepEl.setAttribute('role', 'button');
        stepEl.setAttribute('tabindex', '0');
        stepEl.addEventListener('click', () => {
          const target = CLUSTER_STEPS[idx] ?? 0;
          showStep(target);
        });
        stepEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const target = CLUSTER_STEPS[idx] ?? 0;
            showStep(target);
          }
        });
      } catch (e) {
        console.warn('Tidak bisa membuat progress step clickable:', e);
      }
    });

    function collectData(){
      const formData = new FormData(form);
      const data = {};
      formData.forEach((value, key) => {
        if(data[key]){
          if(Array.isArray(data[key])){
            data[key].push(value);
          } else {
            data[key] = [data[key], value];
          }
        } else {
          data[key] = value;
        }
      });
      data.generatedAt = new Date().toISOString();
      return data;
    }

    function sanitizePdfName(value){
      return String(value || '')
        .trim()
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 80) || 'tanpa-nama';
    }

    function buildPdfFileName(data){
      const displayName = data.namaPengguna || data.namaPemohon || data.namaPemberiLayanan || 'tanpa-nama';
      return `shti-lt-${sanitizePdfName(displayName)}-${Date.now()}.pdf`;
    }

    function persistArchive(snapshot, fileName, pdfBlob){
      if(typeof window.archiveDocument !== 'function' || !snapshot) return;
      window.archiveDocument({
        serviceSlug: ARCHIVE_META.slug,
        serviceName: ARCHIVE_META.name,
        userName: snapshot.namaPemohon || snapshot.namaPengguna || snapshot.namaPemberiLayanan || 'Tanpa Nama',
        data: snapshot,
        fileName,
        pdfBlob
      });
    }

    async function downloadPDF(){
      const data = collectData();
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
      const flowSteps = stepsText.map((text, idx) => ({
        text,
        time: timeDefaults[idx],
        mulai: data[`mulaiLangkah${idx+1}`] || '',
        selesai: data[`selesaiLangkah${idx+1}`] || '',
        catatan: data[`keteranganLangkah${idx+1}`] || ''
      }));
      try{
        const blob = await generateSHTILTPDF({
          namaPengguna: data.namaPengguna || data.namaPemohon,
          alamatPengguna: data.alamatPengguna,
          persyaratan: Array.isArray(data.persyaratan) ? data.persyaratan : (data.persyaratan ? [data.persyaratan] : []),
          flowSteps,
          signature: signatureDataInput.value,
          namaPemberiLayanan: data.namaPemberiLayanan
        });
        const fileName = buildPdfFileName(data);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName; a.click(); URL.revokeObjectURL(url);
        showToast('PDF SHTI LT diunduh.');
        persistArchive(data, fileName, blob);
      }catch(err){
        console.warn('Gagal membuat PDF SHTI LT:', err);
        alert('Gagal membuat PDF: ' + (err && err.message ? err.message : err));
        showToast('Gagal membuat PDF.');
      }
    }

    function downloadDraft(){
      const data = collectData();
      const fileName = `${ARCHIVE_META.slug}-${Date.now()}.json`;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      showToast('Draft SHTI LT diunduh.');
      persistArchive(data, fileName);
    }

    async function saveDraft(){
      try {
        const data = collectData();
        localStorage.setItem('shtiLtDraft', JSON.stringify(data));
        showToast('Data tersimpan di perangkat ini.');

        const fileName = buildPdfFileName(data);
        // Metadata first so Arsip entry exists even if PDF build fails.
        persistArchive(data, fileName);

        try {
          if(!pdfBlob){
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
            const flowSteps = stepsText.map((text, idx) => ({
              text,
              time: timeDefaults[idx],
              mulai: data[`mulaiLangkah${idx+1}`] || '',
              selesai: data[`selesaiLangkah${idx+1}`] || '',
              catatan: data[`keteranganLangkah${idx+1}`] || ''
            }));

            pdfBlob = await generateSHTILTPDF({
              namaPengguna: data.namaPengguna || data.namaPemohon,
              alamatPengguna: data.alamatPengguna,
              persyaratan: Array.isArray(data.persyaratan) ? data.persyaratan : (data.persyaratan ? [data.persyaratan] : []),
              flowSteps,
              signature: signatureDataInput.value,
              namaPemberiLayanan: data.namaPemberiLayanan
            });
          }

          persistArchive(data, fileName, pdfBlob);
        } catch (err) {
          console.warn('Gagal membuat PDF untuk arsip (SHTI-LT):', err);
        }
        showToast('Membuka Arsip Dokumen...');
        setTimeout(() => navigateWithFade('arsip-dokumen.html'), 1000);
      } catch (error) {
        console.warn('Tidak dapat menyimpan draft SHTI:', error);
        showToast('Penyimpanan lokal tidak tersedia.');
      }
    }

    function resetForm(){
      form.reset();
      if(signaturePad && signatureCtx){
        clearSignature();
      }
      showStep(0);
      showToast('Formulir direset.');
    }

    function getPointerPosition(event){
      const rect = signaturePad.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    }

    function startDraw(event){
      if(!signatureCtx) return;
      event.preventDefault();
      drawing = true;
      const { x, y } = getPointerPosition(event);
      signatureCtx.beginPath();
      signatureCtx.moveTo(x, y);
    }

    function drawStroke(event){
      if(!drawing || !signatureCtx) return;
      event.preventDefault();
      const { x, y } = getPointerPosition(event);
      signatureCtx.lineTo(x, y);
      signatureCtx.stroke();
    }

    function endDraw(event){
      if(!drawing || !signatureCtx) return;
      event.preventDefault();
      drawing = false;
      signatureCtx.closePath();
      updateSignatureData();
    }

    function resizeSignatureCanvas(){
      if(!signaturePad) return;
      const existingData = signatureDataInput.value;
      const ratio = window.devicePixelRatio || 1;
      const width = signaturePad.offsetWidth || 520;
      const height = signaturePad.offsetHeight || 200;
      signaturePad.width = width * ratio;
      signaturePad.height = height * ratio;
      signatureCtx = signaturePad.getContext('2d');
      signatureCtx.setTransform(1, 0, 0, 1, 0, 0);
      signatureCtx.scale(ratio, ratio);
      clearSignature(!existingData);
      if(existingData){
        const img = new Image();
        img.onload = () => {
          signatureCtx.drawImage(img, 0, 0, width, height);
          signatureDataInput.value = existingData;
        };
        img.src = existingData;
      }
    }

    function initSignaturePad(){
      if(!signaturePad) return;
      if(!signatureInitialized){
        signaturePad.addEventListener('pointerdown', startDraw);
        signaturePad.addEventListener('pointermove', drawStroke);
        signaturePad.addEventListener('pointerup', endDraw);
        signaturePad.addEventListener('pointerleave', endDraw);
        signatureInitialized = true;
      }
      resizeSignatureCanvas();
      window.addEventListener('resize', resizeSignatureCanvas);
    }

    function clearSignature(resetValue = true){
      if(!signaturePad || !signatureCtx) return;
      signatureCtx.fillStyle = '#fff';
      signatureCtx.fillRect(0, 0, signaturePad.width, signaturePad.height);
      signatureCtx.lineWidth = 2;
      signatureCtx.lineCap = 'round';
      signatureCtx.strokeStyle = '#0b3b3f';
      if(resetValue){
        signatureDataInput.value = '';
        if(signatureUpload){
          signatureUpload.value = '';
        }
      }
    }

    function updateSignatureData(){
      if(!signaturePad) return;
      signatureDataInput.value = signaturePad.toDataURL('image/png');
    }

    if(signaturePad){
      initSignaturePad();
    }

    if(signatureSaveBtn){
      signatureSaveBtn.addEventListener('click', () => {
        if(!signatureDataInput.value){
          showToast('Belum ada tanda tangan yang disimpan.');
          return;
        }
        showToast('Tanda tangan tersimpan.');
      });
    }

    if(signatureResetBtn){
      signatureResetBtn.addEventListener('click', () => {
        clearSignature();
        showToast('Tanda tangan dihapus.');
      });
    }

    if(signatureUpload){
      signatureUpload.addEventListener('change', event => {
        const files = event.target.files;
        const file = files && files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          signatureDataInput.value = reader.result;
          resizeSignatureCanvas();
          showToast('File tanda tangan siap digunakan.');
        };
        reader.readAsDataURL(file);
      });
    }

    // PDF Preview variables
    let pdfDoc = null;
    let currentPageNum = 1;
    let totalPagesNum = 0;
    let pdfBlob = null;

    async function buildAndRenderPDF() {
      try {
        const data = collectData();
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
        const flowSteps = stepsText.map((text, idx) => ({
          text,
          time: timeDefaults[idx],
          mulai: data[`mulaiLangkah${idx+1}`] || '',
          selesai: data[`selesaiLangkah${idx+1}`] || '',
          catatan: data[`keteranganLangkah${idx+1}`] || ''
        }));
        pdfBlob = await generateSHTILTPDF({
          namaPengguna: data.namaPengguna || data.namaPemohon,
          alamatPengguna: data.alamatPengguna,
          persyaratan: Array.isArray(data.persyaratan) ? data.persyaratan : (data.persyaratan ? [data.persyaratan] : []),
          flowSteps,
          signature: signatureDataInput.value,
          namaPemberiLayanan: data.namaPemberiLayanan
        });
        const arrayBuffer = await pdfBlob.arrayBuffer();
        pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        totalPagesNum = pdfDoc.numPages;
        currentPageNum = 1;
        renderPdfPage(1);
        updatePdfPageIndicator();
      } catch (err) {
        console.error('Build PDF error', err);
        const container = document.getElementById('pdfPreviewContainer');
        if (container) container.innerHTML = '<div style="text-align: center; color: #c00;"><p>Gagal membuat preview PDF</p></div>';
      }
    }

    async function renderPdfPage(pageNum) {
      if (!pdfDoc || pageNum < 1 || pageNum > totalPagesNum) return;
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.2 });
        const container = document.getElementById('pdfPreviewContainer');
        if (!container) return;
        container.innerHTML = '';

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.maxWidth = '100%';
        canvas.style.height = 'auto';
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';

        await page.render({ canvasContext: ctx, viewport }).promise;
        container.appendChild(canvas);
      } catch (err) {
        console.error('Render page error', err);
      }
    }

    function updatePdfPageIndicator() {
      const indicator = document.getElementById('pdfPageIndicator');
      if (indicator) indicator.textContent = `Halaman ${currentPageNum} / ${totalPagesNum}`;
    }

    const pdfPrevBtn = document.getElementById('pdfPrevPage');
    const pdfNextBtn = document.getElementById('pdfNextPage');
    if (pdfPrevBtn) {
      pdfPrevBtn.addEventListener('click', () => {
        if (currentPageNum > 1) {
          currentPageNum--;
          renderPdfPage(currentPageNum);
          updatePdfPageIndicator();
        }
      });
    }
    if (pdfNextBtn) {
      pdfNextBtn.addEventListener('click', () => {
        if (currentPageNum < totalPagesNum) {
          currentPageNum++;
          renderPdfPage(currentPageNum);
          updatePdfPageIndicator();
        }
      });
    }

    if(downloadBtn){
      downloadBtn.addEventListener('click', async () => {
        // Always use cached pdfBlob if available to avoid regenerating
        if (pdfBlob) {
          const data = collectData();
          const url = URL.createObjectURL(pdfBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `SHTI-LT-${data.namaPengguna || 'Form'}.pdf`;
          link.click();
          URL.revokeObjectURL(url);
          showToast('PDF berhasil diunduh!');
          saveDraft();
        } else {
          // Fallback to downloadPDF if pdfBlob not yet generated
          await downloadPDF();
        }
      });
    } else if(pdfDownloadBtn){
      pdfDownloadBtn.addEventListener('click', async () => {
        if(!validateAllSteps()) return;
        await downloadPDF();
      });
    }

    if(saveBtn){
      saveBtn.addEventListener('click', () => {
        if(!validateAllSteps()) return;
        saveDraft();
      });
    }

    if(resetBtn){
      resetBtn.addEventListener('click', resetForm);
    }

    if(homeBtn){
      homeBtn.addEventListener('click', () => navigateWithFade('home.html'));
    }

    // finishBtn removed in UI

    form.addEventListener('submit', event => event.preventDefault());
    showStep(0);
  });
})();
