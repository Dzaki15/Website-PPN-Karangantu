(function(){
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('jasaListrikForm');
    if (!form) return;

    const steps = Array.from(document.querySelectorAll('.electric-step'));
    const progressSteps = Array.from(document.querySelectorAll('#jasaListrikProgress .progress-step'));
    const toast = document.getElementById('jasaListrikToast');

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

    const nextStepButtons = document.querySelectorAll('[data-action="next"]');
    const prevStepButtons = document.querySelectorAll('[data-action="prev"]');

    const flowSteps = [
      {
        text: 'Mengisi Form order pelayanan jasa listrik pada aplikasi SIPANDU',
        time: '5 Menit'
      },
      {
        text: 'Memproses Layanan Sesuai dengan form order',
        time: '5 Menit'
      },
      {
        text: 'Menerima pembayaran',
        time: '5 Menit'
      },
      {
        text: 'menerima jasa layanan listrik',
        time: '5 Menit'
      }
    ];

    const flowState = flowSteps.map(step => ({ ...step, mulai: '', selesai: '', catatan: '' }));
    const ARCHIVE_META = {
      slug: 'jasa-listrik',
      name: 'Form Jasa Listrik'
    };

    let currentStepIndex = 0;
    let currentFlowIndex = 0;

    function showStep(index) {
      currentStepIndex = Math.max(0, Math.min(index, steps.length - 1));
      steps.forEach((section, idx) => {
        section.classList.toggle('active', idx === currentStepIndex);
      });
      progressSteps.forEach((step, idx) => {
        step.classList.toggle('active', idx === currentStepIndex);
        step.classList.toggle('completed', idx < currentStepIndex);
      });

      if (currentStepIndex === 1) {
        renderFlowStep();
      }
    }

    function validateStep(index) {
      const section = steps[index];
      if (!section) return true;
      const requiredFields = Array.from(section.querySelectorAll('[required]'));
      for (const field of requiredFields) {
        if (field.disabled) continue;
        if (!field.value) {
          field.reportValidity();
          field.focus();
          return false;
        }
      }
      return true;
    }

    function goToNextStep() {
      if (!validateStep(currentStepIndex)) return;
      
      // Save signature when leaving signature step (step 3)
      if (currentStepIndex === 2) {
        const canvas = document.getElementById('signatureCanvas');
        if (canvas) {
          const signatureData = canvas.toDataURL('image/png');
          localStorage.setItem('jasaListrikSignature', signatureData);
        }
        // Build PDF when moving to download step
        showStep(currentStepIndex + 1);
        setTimeout(buildAndRenderPDF, 100);
      } else {
        showStep(currentStepIndex + 1);
      }
    }

    function goToPrevStep() {
      showStep(currentStepIndex - 1);
    }

    nextStepButtons.forEach(btn => btn.addEventListener('click', goToNextStep));
    prevStepButtons.forEach(btn => btn.addEventListener('click', () => {
      if (currentStepIndex === 0) return;
      goToPrevStep();
    }));

    // Make progress steps clickable
    progressSteps.forEach((stepEl, idx) => {
      try {
        stepEl.style.cursor = 'pointer';
        stepEl.setAttribute('role', 'button');
        stepEl.setAttribute('tabindex', '0');
        stepEl.addEventListener('click', () => {
          showStep(idx);
        });
        stepEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            showStep(idx);
          }
        });
      } catch (e) {
        console.warn('Tidak bisa membuat progress step clickable:', e);
      }
    });

    function persistFlowInputs() {
      const state = flowState[currentFlowIndex];
      if (!state) return;
      state.mulai = flowStartInput.value;
      state.selesai = flowEndInput.value;
      state.catatan = flowNotesInput.value;
    }

    function renderFlowStep() {
      const step = flowState[currentFlowIndex];
      if (!step || !flowTextEl || !flowTimeEl || !flowStepLabel) return;
      flowTextEl.textContent = step.text;
      flowTimeEl.textContent = `Waktu: ${step.time}`;
      flowStepLabel.textContent = `Langkah ${currentFlowIndex + 1} dari ${flowSteps.length}`;
      flowStartInput.value = step.mulai;
      flowEndInput.value = step.selesai;
      flowNotesInput.value = step.catatan;

      flowPrevBtn.textContent = currentFlowIndex === 0 ? 'Kembali ke data' : 'Sebelumnya';
      const lastLabel = flowNextBtn.getAttribute('data-last-label') || 'Lanjut ke unduhan';
      flowNextBtn.textContent = currentFlowIndex === flowSteps.length - 1 ? lastLabel : 'Selanjutnya';
    }

    if (flowPrevBtn) {
      flowPrevBtn.addEventListener('click', () => {
        persistFlowInputs();
        if (currentFlowIndex === 0) {
          showStep(0);
          return;
        }
        currentFlowIndex = Math.max(0, currentFlowIndex - 1);
        renderFlowStep();
      });
    }

    if (flowNextBtn) {
      flowNextBtn.addEventListener('click', () => {
        persistFlowInputs();
        if (currentFlowIndex < flowSteps.length - 1) {
          currentFlowIndex++;
          renderFlowStep();
        } else {
          showStep(2); // Go to signature step
        }
      });
    }

    // Signature canvas setup
    const canvas = document.getElementById('signatureCanvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      let isDrawing = false;
      let lastX = 0, lastY = 0;

      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';

      canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        [lastX, lastY] = [e.offsetX, e.offsetY];
      });

      canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();
        [lastX, lastY] = [e.offsetX, e.offsetY];
      });

      canvas.addEventListener('mouseup', () => isDrawing = false);
      canvas.addEventListener('mouseout', () => isDrawing = false);

      // Touch support
      canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        isDrawing = true;
        [lastX, lastY] = [touch.clientX - rect.left, touch.clientY - rect.top];
      });

      canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!isDrawing) return;
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        [lastX, lastY] = [x, y];
      });

      canvas.addEventListener('touchend', () => isDrawing = false);

      const saveBtn = document.getElementById('signatureSave');
      const resetBtn = document.getElementById('signatureReset');
      const uploadInput = document.getElementById('signatureUpload');

      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          const signatureData = canvas.toDataURL('image/png');
          localStorage.setItem('jasaListrikSignature', signatureData);
          showToast('Tanda tangan disimpan.');
        });
      }

      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          localStorage.removeItem('jasaListrikSignature');
          showToast('Tanda tangan dihapus.');
        });
      }

      if (uploadInput) {
        uploadInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            const img = new Image();
            img.onload = () => {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
              const x = (canvas.width - img.width * scale) / 2;
              const y = (canvas.height - img.height * scale) / 2;
              ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
              const signatureData = canvas.toDataURL('image/png');
              localStorage.setItem('jasaListrikSignature', signatureData);
              showToast('File tanda tangan dimuat.');
            };
            img.src = evt.target.result;
          };
          reader.readAsDataURL(file);
        });
      }

      // Load existing signature if any
      const savedSignature = localStorage.getItem('jasaListrikSignature');
      if (savedSignature) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
        };
        img.src = savedSignature;
      }
    }

    function collectFormData() {
      const formData = new FormData(form);
      const payload = {
        namaPengguna: formData.get('namaPengguna') || '',
        alamatPengguna: formData.get('alamatPengguna') || '',
        tanggalPengajuan: formData.get('tanggalPengajuan') || '',
        namaPemberiLayanan: formData.get('namaPemberiLayanan') || '',
        flowSteps: flowState,
        createdAt: new Date().toISOString()
      };
      return payload;
    }

    function persistLocal(payload) {
      try {
        localStorage.setItem('jasaListrikData', JSON.stringify(payload));
      } catch (e) {
        console.warn('Gagal simpan jasaListrikData', e);
      }
    }

    function showToast(message) {
      if (!toast) return;
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2400);
    }

    function persistArchive(payload, fileName, pdfBlob) {
      if (typeof window.archiveDocument !== 'function' || !payload) return;
      window.archiveDocument({
        serviceSlug: ARCHIVE_META.slug,
        serviceName: ARCHIVE_META.name,
        userName: payload.namaPengguna || payload.namaPemberiLayanan || 'Tanpa Nama',
        data: payload,
        fileName,
        pdfBlob
      });
    }

    function makeSafeFilePart(value) {
      return String(value || 'dokumen')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9\-_.]/g, '-');
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', async () => {
        try {
          const payload = collectFormData();
          persistLocal(payload);
          const signature = localStorage.getItem('jasaListrikSignature');
          const blob = await generateJasaListrikPDF({
            namaPengguna: payload.namaPengguna,
            alamatPengguna: payload.alamatPengguna,
            tanggalPengajuan: payload.tanggalPengajuan,
            namaPemberiLayanan: payload.namaPemberiLayanan,
            flowSteps: payload.flowSteps,
            signature
          });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const safeName = makeSafeFilePart(payload.namaPengguna || 'dokumen');
          const ts = Date.now();
          const fileName = `Jasa-Listrik-${safeName}-${ts}.pdf`;
          link.download = fileName;
          link.click();
          URL.revokeObjectURL(url);
          showToast('PDF Jasa Listrik berhasil diunduh.');
          // Use the same unique fileName for metadata + PDF to avoid duplicate rows,
          // but allow repeated submissions/downloads to create new archive entries.
          persistArchive(payload, fileName, blob);
        } catch (error) {
          console.error('Gagal membuat PDF Jasa Listrik', error);
          showToast('Gagal membuat PDF.');
        }
      });
    }

    const goSignatureBtn = document.getElementById('goSignature');
    if (goSignatureBtn) {
      goSignatureBtn.addEventListener('click', () => {
        const payload = collectFormData();
        persistLocal(payload);
        navigateWithFade('jasa-listrik-signature.html');
      });
    }

    // PDF Preview in Step 4 (inline viewer)
    let pdfDoc = null;
    let currentPageNum = 1;
    let totalPagesNum = 0;

    async function buildAndRenderPDF() {
      try {
        const payload = collectFormData();
        const signature = localStorage.getItem('jasaListrikSignature');
        const blob = await generateJasaListrikPDF({
          namaPengguna: payload.namaPengguna,
          alamatPengguna: payload.alamatPengguna,
          tanggalPengajuan: payload.tanggalPengajuan,
          namaPemberiLayanan: payload.namaPemberiLayanan,
          flowSteps: payload.flowSteps,
          signature
        });

        const arrayBuffer = await blob.arrayBuffer();
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

    // Trigger PDF render when entering Step 4
    const originalShowStep = showStep.bind(window);
    const originalShowStepFn = showStep;
    window.showStepWithPdfRender = function(index) {
      originalShowStepFn(index);
      if (index === 3) { // Step 4 (0-indexed as step 3)
        setTimeout(buildAndRenderPDF, 100);
      }
    };
    
    // Replace showStep calls for step 3 with the PDF render version
    const previewBtn = document.getElementById('previewPdf');
    if (previewBtn) {
      previewBtn.removeEventListener('click', () => {});
      previewBtn.style.display = 'none'; // Hide if exists from old HTML
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        (async () => {
          const payload = collectFormData();
          try {
            localStorage.setItem('jasaListrikDraft', JSON.stringify(payload));
            showToast('Data Jasa Listrik tersimpan di perangkat ini.');

            const safeName = makeSafeFilePart(payload.namaPengguna || 'dokumen');
            const ts = Date.now();
            const fileName = `Jasa-Listrik-${safeName}-${ts}.pdf`;

            // Arsipkan metadata terlebih dahulu dengan fileName PDF yang sama,
            // agar tidak membuat 2 entri (dedupe memakai serviceSlug + fileName).
            persistArchive(payload, fileName);

            // Lalu simpan PDF bytes yang persis (update entri yang sama).
            try {
              const signature = localStorage.getItem('jasaListrikSignature');
              const blob = await generateJasaListrikPDF({
                namaPengguna: payload.namaPengguna,
                alamatPengguna: payload.alamatPengguna,
                tanggalPengajuan: payload.tanggalPengajuan,
                namaPemberiLayanan: payload.namaPemberiLayanan,
                flowSteps: payload.flowSteps,
                signature,
              });
              persistArchive(payload, fileName, blob);
            } catch (pdfError) {
              console.warn('Gagal membuat PDF untuk arsip jasa listrik:', pdfError);
            }
            showToast('Membuka Arsip Dokumen...');
            setTimeout(() => navigateWithFade('arsip-dokumen.html'), 1200);
          } catch (error) {
            console.warn('Gagal menyimpan Jasa Listrik:', error);
            showToast('Penyimpanan lokal tidak tersedia.');
          }
        })();
      });
    }

    if (resetBtn) {
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

    if (backBtn) {
      backBtn.addEventListener('click', () => {
        navigateWithFade('home.html');
      });
    }

    form.addEventListener('submit', (event) => event.preventDefault());

    showStep(0);
  });
})();
