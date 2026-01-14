(function(){
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('stblkkForm');
    if(!form) return;

    const steps = Array.from(document.querySelectorAll('.stblkk-step'));
    const progressSteps = Array.from(document.querySelectorAll('#stblkkProgress .progress-step'));
    // Map 5 progress clusters to form steps: Data (0), Persyaratan (1), Proses (2), TTD (3), Download (4)
    const CLUSTER_STEPS = [0, 1, 2, 3, 4];
    const toast = document.getElementById('stblkkToast');

    const flowTextEl = document.getElementById('flowText');
    const flowTimeEl = document.getElementById('flowTime');
    const flowStepLabel = document.getElementById('flowStepLabel');
    const flowStartInput = document.getElementById('flowStart');
    const flowEndInput = document.getElementById('flowEnd');
    const flowNotesInput = document.getElementById('flowNotes');
    const flowPrevBtn = document.getElementById('flowPrev');
    const flowNextBtn = document.getElementById('flowNext');

    const downloadBtn = document.getElementById('downloadPdf');
    const saveBtn = document.getElementById('saveDraft');
    const resetBtn = document.getElementById('resetForm');
    const backBtn = document.getElementById('backToHome');
    
    // Signature (SHTI-style)
    const signatureCanvas = document.getElementById('signaturePad');
    const signatureSaveBtn = document.getElementById('signatureSave');
    const signatureResetBtn = document.getElementById('signatureReset');
    const signatureUploadInput = document.getElementById('signatureUpload');
    const signaturePad = (signatureCanvas && typeof window.setupSignatureCanvas === 'function')
      ? window.setupSignatureCanvas(signatureCanvas, { strokeStyle: '#000', lineWidth: 2 })
      : null;

    // PDF Preview elements
    const pdfPreviewContainer = document.getElementById('pdfPreviewContainer');
    const pdfPrevPageBtn = document.getElementById('pdfPrevPage');
    const pdfNextPageBtn = document.getElementById('pdfNextPage');
    const pdfPageIndicator = document.getElementById('pdfPageIndicator');
    let pdfBlob = null;
    let pdfDoc = null;
    let currentPdfPage = 1;
    let totalPdfPages = 0;

    const nextStepButtons = document.querySelectorAll('[data-action="next"]');
    const prevStepButtons = document.querySelectorAll('[data-action="prev"]');

    const flowSteps = [
      {
        text: 'a. Menerima pemberitahuan rencana kedatangan kapal paling lambat 2 jam sebelum masuk pelabuhan pangkalan dan menerima dokumen permohonan penerbitan STBLKK. b. Mengarahkan untuk menyiapkan lokasi tambat/labuh kapal perikanan dan menyampaikannya kepada Petugas Kesyahbandaran.',
        time: '10 menit'
      },
      {
        text: 'Menerima pemberitahuan rencana kedatangan dan dokumen permohonan penerbitan STBLKK serta menyiapkan lokasi tambat/labuh kapal perikanan untuk dilaporkan kepada Syahbandar di Pelabuhan Perikanan.',
        time: '15 menit'
      },
      {
        text: 'Menyampaikan informasi kesiapan lokasi tambat/labuh kepada Nakhoda atau Penanggung Jawab Perusahaan dan menyerahkan proses tambat/labuh kepada Petugas Kesyahbandaran.',
        time: '10 menit'
      },
      {
        text: 'a. Menerima dokumen fisik permohonan penerbitan STBLKK setelah kapal bersandar. b. Melakukan pemeriksaan dokumen fisik dan inspeksi di atas kapal lalu melaporkan hasilnya kepada Syahbandar.',
        time: '35 menit'
      },
      {
        text: 'Melakukan penandatanganan dan penerbitan STBLKK untuk disampaikan kepada Petugas Kesyahbandaran.',
        time: '10 menit'
      },
      {
        text: 'Mencetak dan menyerahkan STBLKK kepada Syahbandar di Pelabuhan Perikanan serta mengarsipkan salinan dokumen.',
        time: '5 menit'
      },
      {
        text: 'Menerima dokumen STBLKK dan menyerahkan kepada Nakhoda atau Penanggung Jawab Perusahaan.',
        time: '15 menit'
      }
    ];

    const flowState = flowSteps.map(step => ({ ...step, mulai: '', selesai: '', catatan: '' }));
    const ARCHIVE_META = {
      slug: 'stblkk',
      name: 'Form STBLKK'
    };

    function sanitizePdfName(value){
      return String(value || '')
        .trim()
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 80) || 'dokumen';
    }

    function buildPdfFileName(payload){
      const name = payload && (payload.namaPengguna || payload.namaPemohon || payload.namaPemberiLayanan);
      return `STBLKK-${sanitizePdfName(name)}-${Date.now()}.pdf`;
    }

    let currentStepIndex = 0;
    let currentFlowIndex = 0;

    function showStep(index){
      currentStepIndex = Math.max(0, Math.min(index, steps.length - 1));
      steps.forEach((section, idx) => {
        section.classList.toggle('active', idx === currentStepIndex);
      });
      
      // Map step to cluster: 0->0 (Data), 1->1 (Persyaratan), 2->2 (Proses), 3->3 (TTD), 4->4 (Download)
      const clusterIndex = (currentStepIndex === 0) ? 0 : (currentStepIndex === 1) ? 1 : (currentStepIndex === 2) ? 2 : (currentStepIndex === 3) ? 3 : 4;
      progressSteps.forEach((step, idx) => {
        step.classList.toggle('active', idx === clusterIndex);
        step.classList.toggle('completed', idx < clusterIndex);
      });

      if(currentStepIndex === 2){
        renderFlowStep();
      }

      // Build PDF preview when entering download step
      if (currentStepIndex === 4 && !pdfBlob) {
        buildAndRenderPDF();
      }
    }

    async function buildAndRenderPDF() {
      if (!pdfPreviewContainer) return;
      try {
        pdfPreviewContainer.innerHTML = '<div style="text-align:center;color:#999;"><p>Membuat PDF...</p></div>';
        
        const payload = collectFormData();
        const signature = localStorage.getItem('stblkkSignature');
        
        pdfBlob = await generateSTBLKKPDF({
          namaPengguna: payload.namaPengguna,
          alamatPengguna: payload.alamatPengguna,
          tanggalPengajuan: payload.tanggalPengajuan,
          namaPemberiLayanan: payload.namaPemberiLayanan,
          persyaratan: payload.persyaratan,
          flowSteps: payload.flowSteps,
          signature
        });

        const arrayBuffer = await pdfBlob.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        pdfDoc = await loadingTask.promise;
        totalPdfPages = pdfDoc.numPages;
        currentPdfPage = 1;

        await renderPdfPage(currentPdfPage);
        updatePdfPageIndicator();
      } catch (err) {
        console.error('Error building PDF preview:', err);
        pdfPreviewContainer.innerHTML = '<div style="text-align:center;color:#f44;"><p>Gagal memuat preview PDF.</p></div>';
      }
    }

    async function renderPdfPage(pageNum) {
      if (!pdfDoc || !pdfPreviewContainer) return;
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.2 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.maxWidth = '100%';
        canvas.style.height = 'auto';

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        await page.render(renderContext).promise;
        pdfPreviewContainer.innerHTML = '';
        pdfPreviewContainer.appendChild(canvas);
      } catch (err) {
        console.error('Error rendering PDF page:', err);
      }
    }

    function updatePdfPageIndicator() {
      if (pdfPageIndicator) {
        pdfPageIndicator.textContent = `Halaman ${currentPdfPage} dari ${totalPdfPages}`;
      }
      if (pdfPrevPageBtn) {
        pdfPrevPageBtn.disabled = currentPdfPage === 1;
      }
      if (pdfNextPageBtn) {
        pdfNextPageBtn.disabled = currentPdfPage === totalPdfPages;
      }
    }

    if (pdfPrevPageBtn) {
      pdfPrevPageBtn.addEventListener('click', async () => {
        if (currentPdfPage > 1) {
          currentPdfPage--;
          await renderPdfPage(currentPdfPage);
          updatePdfPageIndicator();
        }
      });
    }

    if (pdfNextPageBtn) {
      pdfNextPageBtn.addEventListener('click', async () => {
        if (currentPdfPage < totalPdfPages) {
          currentPdfPage++;
          await renderPdfPage(currentPdfPage);
          updatePdfPageIndicator();
        }
      });
    }

    function validateStep(index){
      const section = steps[index];
      if(!section) return true;
      const requiredFields = Array.from(section.querySelectorAll('[required]'));
      for(const field of requiredFields){
        if(field.disabled) continue;
        if(!field.value){
          field.reportValidity();
          field.focus();
          return false;
        }
      }
      return true;
    }

    function goToNextStep(){
      if(!validateStep(currentStepIndex)) return;

      // Best-effort: persist signature when leaving signature step
      if (currentStepIndex === 3 && signatureCanvas) {
        try {
          const signatureData = signaturePad ? signaturePad.toDataUrl() : signatureCanvas.toDataURL('image/png');
          if (signatureData) localStorage.setItem('stblkkSignature', signatureData);
        } catch (e) {
          // ignore
        }
      }

      showStep(currentStepIndex + 1);
    }

    function goToPrevStep(){
      showStep(currentStepIndex - 1);
    }

    nextStepButtons.forEach(btn => btn.addEventListener('click', goToNextStep));
    prevStepButtons.forEach(btn => btn.addEventListener('click', () => {
      if(currentStepIndex === 0) return;
      goToPrevStep();
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

    // Signature canvas setup (high-precision, shared)
    if (signatureCanvas) {
      if (signatureSaveBtn) {
        signatureSaveBtn.addEventListener('click', () => {
          const signatureData = signaturePad ? signaturePad.toDataUrl() : signatureCanvas.toDataURL('image/png');
          if (!signatureData) {
            showToast('Belum ada tanda tangan.');
            return;
          }
          localStorage.setItem('stblkkSignature', signatureData);
          showToast('Tanda tangan disimpan.');
        });
      }

      if (signatureResetBtn) {
        signatureResetBtn.addEventListener('click', () => {
          if (signaturePad) {
            signaturePad.clear();
          } else {
            const ctx = signatureCanvas.getContext('2d');
            ctx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
          }
          localStorage.removeItem('stblkkSignature');
          showToast('Tanda tangan dihapus.');
        });
      }

      if (signatureUploadInput) {
        signatureUploadInput.addEventListener('change', (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            if (signaturePad) {
              signaturePad.loadDataUrl(evt.target.result);
              localStorage.setItem('stblkkSignature', evt.target.result);
              showToast('File tanda tangan dimuat.');
              return;
            }
            const ctx = signatureCanvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
              ctx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
              const scale = Math.min(signatureCanvas.width / img.width, signatureCanvas.height / img.height);
              const x = (signatureCanvas.width - img.width * scale) / 2;
              const y = (signatureCanvas.height - img.height * scale) / 2;
              ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
              const signatureData = signatureCanvas.toDataURL('image/png');
              localStorage.setItem('stblkkSignature', signatureData);
              showToast('File tanda tangan dimuat.');
            };
            img.src = evt.target.result;
          };
          reader.readAsDataURL(file);
        });
      }

      // Load existing signature if any
      const savedSignature = localStorage.getItem('stblkkSignature');
      if (savedSignature) {
        if (signaturePad) {
          signaturePad.loadDataUrl(savedSignature);
        } else {
          const ctx = signatureCanvas.getContext('2d');
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
          };
          img.src = savedSignature;
        }
      }
    }

    function persistFlowInputs(){
      const state = flowState[currentFlowIndex];
      if(!state) return;
      state.mulai = flowStartInput.value;
      state.selesai = flowEndInput.value;
      state.catatan = flowNotesInput.value;
    }

    function renderFlowStep(){
      const step = flowState[currentFlowIndex];
      if(!step || !flowTextEl || !flowTimeEl || !flowStepLabel) return;
      flowTextEl.innerHTML = step.text;
      flowTimeEl.textContent = `Waktu: ${step.time}`;
      flowStepLabel.textContent = `Langkah ${currentFlowIndex + 1} dari ${flowSteps.length}`;
      flowStartInput.value = step.mulai;
      flowEndInput.value = step.selesai;
      flowNotesInput.value = step.catatan;

      flowPrevBtn.textContent = currentFlowIndex === 0 ? 'Kembali ke persyaratan' : 'Sebelumnya';
      flowNextBtn.textContent = currentFlowIndex === flowSteps.length - 1 ? 'Lanjut ke unduhan' : 'Selanjutnya';
    }

    if(flowPrevBtn){
      flowPrevBtn.addEventListener('click', () => {
        persistFlowInputs();
        if(currentFlowIndex === 0){
          showStep(1);
          return;
        }
        currentFlowIndex = Math.max(0, currentFlowIndex - 1);
        renderFlowStep();
      });
    }

    if(flowNextBtn){
      flowNextBtn.addEventListener('click', () => {
        persistFlowInputs();
        if(currentFlowIndex < flowSteps.length - 1){
          currentFlowIndex++;
          renderFlowStep();
        } else {
          showStep(3);
        }
      });
    }

    function collectFormData(){
      const formData = new FormData(form);
      const payload = {
        namaPengguna: formData.get('namaPengguna') || '',
        alamatPengguna: formData.get('alamatPengguna') || '',
        tanggalPengajuan: formData.get('tanggalPengajuan') || '',
        namaPemberiLayanan: formData.get('namaPemberiLayanan') || '',
        persyaratan: Array.from(document.querySelectorAll('input[name="persyaratan"]:checked')).map(cb => cb.value),
        flowSteps: flowState,
        createdAt: new Date().toISOString()
      };
      return payload;
    }

    function persistLocal(payload){
      try {
        localStorage.setItem('stblkkData', JSON.stringify(payload));
      } catch (e) {
        console.warn('Gagal simpan stblkkData', e);
      }
    }

    function showToast(message){
      if(!toast) return;
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2400);
    }

    function persistArchive(payload, fileName, pdfBlob){
      if(typeof window.archiveDocument !== 'function' || !payload) return;
      window.archiveDocument({
        serviceSlug: ARCHIVE_META.slug,
        serviceName: ARCHIVE_META.name,
        userName: payload.namaPengguna || payload.namaPemberiLayanan || 'Tanpa Nama',
        data: payload,
        fileName,
        pdfBlob
      });
    }

    if(downloadBtn){
      downloadBtn.addEventListener('click', async () => {
        try {
          const payload = collectFormData();
          persistLocal(payload);
          
          // Use cached blob if available
          const blob = pdfBlob || await (async () => {
            const signature = localStorage.getItem('stblkkSignature');
            return await generateSTBLKKPDF({
              namaPengguna: payload.namaPengguna,
              alamatPengguna: payload.alamatPengguna,
              tanggalPengajuan: payload.tanggalPengajuan,
              namaPemberiLayanan: payload.namaPemberiLayanan,
              persyaratan: payload.persyaratan,
              flowSteps: payload.flowSteps,
              signature
            });
          })();
          
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const fileName = buildPdfFileName(payload);
          link.download = fileName;
          link.click();
          URL.revokeObjectURL(url);
          showToast('PDF STBLKK berhasil diunduh.');
          persistArchive(payload, fileName, blob);
        } catch (error) {
          console.error('Gagal membuat PDF STBLKK', error);
          showToast('Gagal membuat PDF.');
        }
      });
    }

    const goSignatureBtn = document.getElementById('goSignature');
    if(goSignatureBtn){
      goSignatureBtn.addEventListener('click', () => {
        const payload = collectFormData();
        persistLocal(payload);
        navigateWithFade('stblkk-signature.html');
      });
    }

    const previewBtn = document.getElementById('previewPdf');
    if(previewBtn){
      previewBtn.addEventListener('click', () => {
        const payload = collectFormData();
        persistLocal(payload);
        navigateWithFade('stblkk-preview.html');
      });
    }

    if(saveBtn){
      saveBtn.addEventListener('click', async () => {
        const payload = collectFormData();
        const fileName = buildPdfFileName(payload);

        try {
          localStorage.setItem('stblkkDraft', JSON.stringify(payload));
        } catch (error) {
          console.warn('Gagal menyimpan STBLKK (localStorage):', error);
        }

        // Metadata-first so entry exists even if PDF generation fails
        try {
          persistArchive(payload, fileName);
        } catch (error) {
          console.warn('Gagal menyimpan STBLKK metadata ke Arsip Dokumen:', error);
        }

        // Then store the exact PDF bytes
        try {
          const blobToStore = pdfBlob || await (async () => {
            const signature = localStorage.getItem('stblkkSignature');
            return await generateSTBLKKPDF({
              namaPengguna: payload.namaPengguna,
              alamatPengguna: payload.alamatPengguna,
              tanggalPengajuan: payload.tanggalPengajuan,
              namaPemberiLayanan: payload.namaPemberiLayanan,
              persyaratan: payload.persyaratan,
              flowSteps: payload.flowSteps,
              signature
            });
          })();

          pdfBlob = blobToStore;
          persistArchive(payload, fileName, blobToStore);
        } catch (error) {
          console.warn('Gagal menyimpan STBLKK PDF blob ke Arsip Dokumen:', error);
        }

        showToast('Data STBLKK tersimpan.');
      });
    }

    if(resetBtn){
      resetBtn.addEventListener('click', () => {
        form.reset();
        flowState.forEach(state => {
          state.mulai = '';
          state.selesai = '';
          state.catatan = '';
        });
        currentFlowIndex = 0;
        renderFlowStep();
        showStep(0);
        showToast('Formulir dikosongkan.');
      });
    }

    if(backBtn){
      backBtn.addEventListener('click', () => {
        navigateWithFade('home.html');
      });
    }

    form.addEventListener('submit', (event) => event.preventDefault());

    showStep(0);
  });
})();
