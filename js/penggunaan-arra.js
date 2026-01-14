(function(){
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('arraForm');
    if(!form) return;

    const toast = document.getElementById('arraToast');
    const downloadBtn = document.getElementById('arraDownload');
    const saveBtn = document.getElementById('arraSave');
    const homeBtn = document.getElementById('arraHome');
    const resetBtn = document.getElementById('arraReset');
    const signatureSaveBtn = document.getElementById('signatureSave');
    const signatureResetBtn = document.getElementById('signatureReset');
    const steps = Array.from(document.querySelectorAll('.arra-step'));
    const progressSteps = Array.from(document.querySelectorAll('#arraProgress .progress-step'));
    // Mapping cluster indices to actual form step indices
    const CLUSTER_STEPS = [0, 1, 8, 9]; // Data, Proses (mulai dari langkah 2), Tanda Tangan, Download
    const nextButtons = form.querySelectorAll('[data-action="next"]');
    const prevButtons = form.querySelectorAll('[data-action="prev"]');
    const DRAFT_KEY = 'persetujuanRuanganDraft';
    const ARCHIVE_META = {
      slug: 'penggunaan-arra',
      name: 'Penggunaan ARRA ES'
    };

    let currentStep = 0;
    let toastTimer = null;
    let draftTimer = null;

    function showToast(message){
      if(!toast) return;
      toast.textContent = message;
      toast.classList.add('show');
      if(toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
    }

    function collectFormData(){
      const formData = new FormData(form);
      const data = {};
      formData.forEach((value, key) => {
        if(key === 'tandaTanganFile') return;
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
      
      // Include signature canvas data
      if(signatureData){
        data.signatureImage = signatureData;
      }
      
      data.generatedAt = new Date().toISOString();
      return data;
    }

    function saveDraft(showMessage = true, presetData){
      try {
        const snapshot = presetData || collectFormData();
        localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
        if(showMessage) showToast('Draf formulir ruangan tersimpan.');
        return snapshot;
      } catch (error) {
        console.warn('Tidak dapat menyimpan draf ruangan:', error);
        if(showMessage) showToast('Penyimpanan draf gagal.');
        return null;
      }
    }

    function restoreDraft(){
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if(!raw) return;
        const stored = JSON.parse(raw);
        Object.entries(stored).forEach(([key, value]) => {
          if(key === 'tandaTanganFileName' || key === 'generatedAt') return;
          const fields = form.querySelectorAll(`[name="${key}"]`);
          if(!fields.length) return;
          const firstField = fields[0];
          if(firstField.type === 'checkbox' || firstField.type === 'radio'){
            const arr = Array.isArray(value) ? value : [value];
            fields.forEach(field => {
              field.checked = arr.includes(field.value);
            });
          } else {
            firstField.value = value;
          }
        });
        showToast('Draf formulir ruangan dimuat.');
      } catch (error) {
        console.warn('Tidak dapat memuat draf ruangan:', error);
      }
    }

    function resetForm(){
      form.reset();
      localStorage.removeItem(DRAFT_KEY);
      showStep(0);
      showToast('Form penggunaan ruangan dikosongkan.');
    }

    if (homeBtn) {
      homeBtn.addEventListener('click', () => navigateWithFade('home.html'));
    }

    function persistArchive(snapshot, fileName, pdfBlob){
      if(typeof window.archiveDocument !== 'function' || !snapshot) return;
      window.archiveDocument({
        serviceSlug: ARCHIVE_META.slug,
        serviceName: ARCHIVE_META.name,
        userName: snapshot.namaPengguna || snapshot.namaPemberiLayanan || snapshot.namaPemohon || 'Tanpa Nama',
        data: snapshot,
        fileName,
        pdfBlob
      });
    }

    function downloadJson(){
      try {
        const data = collectFormData();
        const fileName = `${ARCHIVE_META.slug}-${Date.now()}.json`;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        showToast('File JSON persetujuan ruangan siap.');
        persistArchive(data, fileName);
      } catch (error) {
        console.warn('Gagal menyiapkan file JSON ruangan:', error);
        showToast('Gagal menyiapkan file JSON.');
      }
    }

    // PDF Preview variables
    let pdfDoc = null;
    let currentPageNum = 1;
    let totalPagesNum = 0;
    let pdfBlob = null;

    async function buildPdfBlobForArchive(snapshot){
      const data = snapshot || collectFormData();
      const workflowSteps = [
        { mulai: data.pengajuanMulai || '', selesai: data.pengajuanSelesai || '', keterangan: data.pengajuanCatatan || '' },
        { mulai: data.loginMulai || '', selesai: data.loginSelesai || '', keterangan: data.loginCatatan || '' },
        { mulai: data.bookingMulai || '', selesai: data.bookingSelesai || '', keterangan: data.bookingCatatan || '' },
        { mulai: data.pemeriksaanMulai || '', selesai: data.pemeriksaanSelesai || '', keterangan: data.pemeriksaanCatatan || '' },
        { mulai: data.pembayaranMulai || '', selesai: data.pembayaranSelesai || '', keterangan: data.pembayaranCatatan || '' },
        { mulai: data.validasiMulai || '', selesai: data.validasiSelesai || '', keterangan: data.validasiCatatan || '' },
        { mulai: data.buktiMulai || '', selesai: data.buktiSelesai || '', keterangan: data.buktiCatatan || '' }
      ];

      const pdfData = {
        namaPengguna: data.namaPengguna || '',
        alamatPengguna: data.alamatPengguna || '',
        tanggalPengajuan: data.tanggalPenggunaan || '',
        namaPemberiLayanan: data.namaPemberiLayanan || '',
        workflowSteps: workflowSteps,
        signatureImage: signatureData
      };

      if (typeof generatePenggunaanARRAPDF !== 'function') {
        throw new Error('PDF builder Penggunaan ARRA belum tersedia');
      }

      return await generatePenggunaanARRAPDF(pdfData);
    }

    async function buildAndRenderPDF() {
      try {
        const data = collectFormData();
        
        // Map workflow steps dari form fields
        const workflowSteps = [
          { mulai: data.pengajuanMulai || '', selesai: data.pengajuanSelesai || '', keterangan: data.pengajuanCatatan || '' },
          { mulai: data.loginMulai || '', selesai: data.loginSelesai || '', keterangan: data.loginCatatan || '' },
          { mulai: data.bookingMulai || '', selesai: data.bookingSelesai || '', keterangan: data.bookingCatatan || '' },
          { mulai: data.pemeriksaanMulai || '', selesai: data.pemeriksaanSelesai || '', keterangan: data.pemeriksaanCatatan || '' },
          { mulai: data.pembayaranMulai || '', selesai: data.pembayaranSelesai || '', keterangan: data.pembayaranCatatan || '' },
          { mulai: data.validasiMulai || '', selesai: data.validasiSelesai || '', keterangan: data.validasiCatatan || '' },
          { mulai: data.buktiMulai || '', selesai: data.buktiSelesai || '', keterangan: data.buktiCatatan || '' }
        ];

        const pdfData = {
          namaPengguna: data.namaPengguna || '',
          alamatPengguna: data.alamatPengguna || '',
          tanggalPengajuan: data.tanggalPenggunaan || '',
          namaPemberiLayanan: data.namaPemberiLayanan || '',
          workflowSteps: workflowSteps,
          signatureImage: signatureData
        };

        pdfBlob = await generatePenggunaanARRAPDF(pdfData);
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
        const container = document.getElementById('pdfPreviewContainer');
        if (!container) return;
        container.innerHTML = '';

        // Ensure the container doesn't use flex centering that can cause odd sizing/clipping
        container.style.display = 'block';
        container.style.alignItems = '';
        container.style.justifyContent = '';

        // Fit-to-width rendering with proper DPR scaling for a clearer preview
        const baseViewport = page.getViewport({ scale: 1 });
        const paddingAllowance = 4; // avoid horizontal overflow by a few px
        const containerWidth = Math.max(1, (container.clientWidth || baseViewport.width) - paddingAllowance);
        const scale = containerWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';

        // Render at higher pixel density for crisp text
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

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

    async function downloadPDF() {
      try {
        if (!pdfBlob) {
          await buildAndRenderPDF();
        }
        
        if (pdfBlob) {
          const data = collectFormData();
          const url = URL.createObjectURL(pdfBlob);
          const link = document.createElement('a');
          link.href = url;
          const safeNama = String(data.namaPengguna || 'Form')
            .trim()
            .replace(/[\\/:*?"<>|]/g, '')
            .replace(/\s+/g, '_');
          const fileName = `Penggunaan_ARRA_${safeNama || 'Form'}_${Date.now()}.pdf`;
          link.download = fileName;
          link.click();
          URL.revokeObjectURL(url);
          showToast('PDF berhasil diunduh!');

          // Save exact PDF bytes to archive for 1:1 preview later
          persistArchive(data, fileName, pdfBlob);
        }
      } catch (error) {
        console.error('Error downloading PDF:', error);
        showToast('Gagal mengunduh PDF.');
      }
    }

    function updateProgress(){
      if(!progressSteps.length) return;
      const clusterIndex = (currentStep === 0) ? 0 : (currentStep >= 1 && currentStep <= 7) ? 1 : (currentStep === 8) ? 2 : 3;
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
      updateProgress();
      steps[currentStep].scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // Trigger PDF preview when entering step 9 (download page)
      if(index === 9) {
        setTimeout(buildAndRenderPDF, 100);
      }
    }

    function validateStep(index){
      const section = steps[index];
      if(!section) return true;
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

    nextButtons.forEach(btn => btn.addEventListener('click', () => {
      if(validateStep(currentStep)){
        // Save signature when leaving signature step (step 8)
        if (currentStep === 8) {
          const canvas = document.getElementById('signatureCanvas');
          if (canvas && signatureData) {
            localStorage.setItem('arrapSignature', signatureData);
          }
          // Move to download step; PDF preview will be built by showStep when it becomes active
          showStep(currentStep + 1);
        } else {
          showStep(currentStep + 1);
        }
      }
    }));

    prevButtons.forEach(btn => btn.addEventListener('click', () => {
      if(currentStep > 0){
        showStep(currentStep - 1);
      }
    }));

    // Make progress steps clickable to jump between form sections
    Array.from(progressSteps).forEach((stepEl, idx) => {
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

    form.addEventListener('submit', event => {
      event.preventDefault();
      if(!form.checkValidity()){
        form.reportValidity();
        return;
      }
      downloadJson();
      saveDraft(false);
    });

    if(downloadBtn){
      downloadBtn.addEventListener('click', async () => {
        if(!form.checkValidity()){
          form.reportValidity();
          return;
        }
        await downloadPDF();
        saveDraft(false);
      });
    }

    if(saveBtn){
      saveBtn.addEventListener('click', () => {
        if(!form.checkValidity()){
          form.reportValidity();
          return;
        }
        // Ensure we store the exact PDF bytes too (no download)
        (async () => {
          const snapshot = saveDraft(true);
          if(!snapshot) return;

          const safeNama = String(snapshot.namaPengguna || 'Form')
            .trim()
            .replace(/[\\/:*?"<>|]/g, '')
            .replace(/\s+/g, '_');
          const fileName = `Penggunaan_ARRA_${safeNama || 'Form'}_${Date.now()}.pdf`;

          // Arsipkan metadata dulu agar entri langsung muncul
          persistArchive(snapshot, fileName);

          // Lalu buat PDF blob tanpa bergantung pada preview pdf.js
          try {
            const blob = await buildPdfBlobForArchive(snapshot);
            pdfBlob = blob;
            persistArchive(snapshot, fileName, blob);
          } catch(e){
            console.warn('Gagal menyiapkan PDF untuk arsip (ARRA):', e);
          }
        })();
      });
    }

    if(resetBtn){
      resetBtn.addEventListener('click', resetForm);
    }

    // === Signature Canvas Setup ===
    const canvas = document.getElementById('signatureCanvas');

    const signatureUpload = document.getElementById('signatureUpload');
    const signaturePad = (canvas && typeof window.setupSignatureCanvas === 'function')
      ? window.setupSignatureCanvas(canvas, { strokeStyle: '#000', lineWidth: 2 })
      : null;
    let ctx = null;
    let signatureData = null;

    if(canvas){
      if (!signaturePad) {
        ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }

      // Load existing signature if any
      const savedSignature = localStorage.getItem('arrapSignature');
      if (savedSignature) {
        signatureData = savedSignature;
        if (signaturePad) {
          signaturePad.loadDataUrl(savedSignature);
        } else if (ctx) {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
          };
          img.src = savedSignature;
        }
      }
    }

    // Reset signature
    if(signatureResetBtn && canvas){
      signatureResetBtn.addEventListener('click', () => {
        if (signaturePad) {
          signaturePad.clear();
        } else {
          if (!ctx) return;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        signatureData = null;
        showToast('Tanda tangan dihapus.');
      });
    }

    // Upload signature
    if(signatureUpload && canvas){
      signatureUpload.addEventListener('change', e => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = evt => {
          signatureData = evt.target.result;
          if (signaturePad) {
            signaturePad.loadDataUrl(evt.target.result);
            showToast('File tanda tangan dimuat ke kanvas.');
            return;
          }
          if (!ctx) return;
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
            const x = (canvas.width - img.width * scale) / 2;
            const y = (canvas.height - img.height * scale) / 2;
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
            signatureData = canvas.toDataURL('image/png');
            showToast('File tanda tangan dimuat ke kanvas.');
          };
          img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    // Save signature
    if(signatureSaveBtn){
      signatureSaveBtn.addEventListener('click', () => {
        const dataUrl = signaturePad ? signaturePad.toDataUrl() : signatureData;
        if(!dataUrl){
          showToast('Belum ada tanda tangan. Silakan tanda tangan atau upload file.');
          return;
        }
        signatureData = dataUrl;
        localStorage.setItem('arrapSignature', signatureData);
        showToast('Tanda tangan disimpan.');
      });
    }

    form.addEventListener('input', () => {
      if(draftTimer) clearTimeout(draftTimer);
      draftTimer = setTimeout(() => saveDraft(false), 800);
    });

    // Do NOT auto-restore draft - user should start with clean form each time
    showStep(0);
  });
})();
