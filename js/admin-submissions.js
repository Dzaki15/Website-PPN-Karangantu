(function(){
  function formatDate(iso){
    if(!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function todayIsoDate(){
    const d = new Date();
    const pad = (n) => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  async function ensureAdmin(){
    try {
      await apiGet('/api/admin/counts');
      return true;
    } catch (e){
      navigateWithFade('login.html');
      return false;
    }
  }

  async function fetchPdfBlobAdmin(submissionId){
    const headers = {};
    const token = getToken();
    if(token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/api/admin/submissions/${submissionId}/pdf`, { headers });
    if(!res.ok) throw new Error('Gagal mengambil PDF');
    return await res.blob();
  }

  async function fetchSignedPdfBlobAdmin(submissionId){
    const headers = {};
    const token = getToken();
    if(token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/api/admin/submissions/${submissionId}/signed-pdf`, { headers });
    if(!res.ok) throw new Error('Gagal mengambil PDF bertanda tangan');
    return await res.blob();
  }

  function setupSignatureCanvas(canvas){
    const ctx = canvas.getContext('2d');
    let drawing = false;
    let hasInk = false;

    canvas.style.touchAction = 'none';

    function resizeToCss(){
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#0b3b3f';
    }

    function getPos(evt){
      const rect = canvas.getBoundingClientRect();
      const x = (evt.clientX - rect.left);
      const y = (evt.clientY - rect.top);
      return { x, y };
    }

    function pointerDown(evt){
      drawing = true;
      const p = getPos(evt);
      try { canvas.setPointerCapture(evt.pointerId); } catch (e) {}
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      evt.preventDefault();
    }

    function pointerMove(evt){
      if(!drawing) return;
      const events = (typeof evt.getCoalescedEvents === 'function') ? evt.getCoalescedEvents() : [evt];
      for(const e of events){
        const p = getPos(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        hasInk = true;
      }
      evt.preventDefault();
    }

    function pointerUp(evt){
      drawing = false;
      evt.preventDefault();
    }

    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('resize', () => {
      const data = hasInk ? canvas.toDataURL('image/png') : null;
      resizeToCss();
      if(data){
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height);
        };
        img.src = data;
      }
    });

    resizeToCss();

    function loadDataUrl(dataUrl){
      if(!dataUrl) return false;
      const img = new Image();
      img.onload = () => {
        const rect = canvas.getBoundingClientRect();
        const w = rect.width || canvas.offsetWidth || 520;
        const h = rect.height || canvas.offsetHeight || 200;
        ctx.clearRect(0,0,canvas.width,canvas.height);
        const scale = Math.min(w / img.width, h / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        const dx = (w - dw) / 2;
        const dy = (h - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
        hasInk = true;
      };
      img.src = dataUrl;
      return true;
    }

    return {
      clear(){
        ctx.clearRect(0,0,canvas.width,canvas.height);
        hasInk = false;
      },
      hasInk(){ return hasInk; },
      toDataUrl(){
        if(!hasInk) return '';
        return canvas.toDataURL('image/png');
      },
      loadDataUrl
    };
  }

  function sanitizeText(v){
    return String(v || '').trim();
  }

  function safeJsonParse(v){
    if(!v) return {};
    try {
      if(typeof v === 'object') return v;
      return JSON.parse(String(v));
    } catch (e){
      return {};
    }
  }

  function getDefaultAvatarSrc(){
    return 'assets/Profile%20Idle%20Icon.png';
  }

  function getAvatarSrcFromItem(item){
    const src = item && (item.user_avatar || item.avatar);
    if(typeof src === 'string' && src.trim()) return src.trim();
    return getDefaultAvatarSrc();
  }

  async function fetchUserProfileAdmin(userId){
    return await apiGet(`/api/admin/users/${encodeURIComponent(String(userId))}`);
  }

  function renderProfileField(label, value){
    const v = sanitizeText(value);
    if(!v) return '';
    return `<div class="admin-user-profile-row"><div class="admin-user-profile-label">${label}</div><div class="admin-user-profile-value">${v}</div></div>`;
  }

  function filterItems(items, q){
    const query = (q || '').toLowerCase().trim();
    if(!query) return items;
    return items.filter(it => {
      const hay = [it.user_name, it.user_email, it.email, it.file_name].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(query);
    });
  }

  window.initAdminSubmissionsPage = function initAdminSubmissionsPage({ serviceSlug, serviceTitle }){
    const listEl = document.getElementById('list');
    const searchInput = document.getElementById('searchInput');
    const refreshBtn = document.getElementById('refreshBtn');
    const pendingCountEl = document.getElementById('pendingCount');
    const logoutBtn = document.getElementById('logoutBtn');

    const previewTitle = document.getElementById('previewTitle');
    const previewMeta = document.getElementById('previewMeta');
    const previewFrame = document.getElementById('previewFrame');

    const signedDate = document.getElementById('signedDate');
    const signerNameInput = document.getElementById('signerName');
    const sigUpload = document.getElementById('sigUpload');
    const clearSig = document.getElementById('clearSig');
    const signBtn = document.getElementById('signBtn');
    const rejectBtn = document.getElementById('rejectBtn');
    const sigCanvas = document.getElementById('sigCanvas');

    const state = {
      items: [],
      activeId: null,
      activePdfUrl: null,
      busy: false
    };

    function setBusy(isBusy){
      state.busy = Boolean(isBusy);
      if(signBtn) signBtn.disabled = isBusy || !state.activeId;
      if(rejectBtn) rejectBtn.disabled = isBusy || !state.activeId;
      if(refreshBtn) refreshBtn.disabled = isBusy;
    }

    function setPendingCount(n){
      const count = Number(n || 0) || 0;
      if(!pendingCountEl) return;
      if(count <= 0){
        pendingCountEl.hidden = true;
        pendingCountEl.textContent = '0';
        return;
      }
      pendingCountEl.hidden = false;
      pendingCountEl.textContent = `${count} masuk`;
    }

    function revokePdfUrl(){
      if(state.activePdfUrl){
        try { URL.revokeObjectURL(state.activePdfUrl); } catch (e) {}
        state.activePdfUrl = null;
      }
    }

    function renderList(){
      if(!listEl) return;
      listEl.innerHTML = '';

      const filtered = filterItems(state.items, searchInput ? searchInput.value : '');
      setPendingCount(filtered.length);

      if(!filtered.length){
        listEl.innerHTML = '<div class="archive-empty">Belum ada dokumen masuk.</div>';
        return;
      }

      filtered.forEach(item => {
        const row = document.createElement('div');
        row.className = 'admin-item' + (String(state.activeId) === String(item.id) ? ' active' : '');
        const isSigned = String(item.status || '').toLowerCase() === 'signed';
        const avatarSrc = getAvatarSrcFromItem(item);
        row.innerHTML = `
          <div class="admin-item-left">
            <button class="admin-user-avatar-btn" type="button" data-action="view-user" title="Lihat profil user">
              <img class="admin-user-avatar" src="${avatarSrc}" alt="Avatar" loading="lazy" />
            </button>
            <div class="admin-item-text">
              <div style="font-weight:700; color:#0b3b3f;">${sanitizeText(item.user_name || 'User')}</div>
              <div style="font-size: 13px; color:#677b81;">${sanitizeText(item.file_name || '')}</div>
              <div style="font-size: 12px; color:#677b81; margin-top: 2px;">${formatDate(item.created_at)}</div>
            </div>
          </div>
          <div style="display:flex; align-items:center;">
            <span class="badge ${isSigned ? 'badge-success' : 'badge-primary'}">${isSigned ? 'Signed' : 'Pending'}</span>
          </div>
        `;

        row.addEventListener('click', () => selectItem(item));

        const avatarBtn = row.querySelector('[data-action="view-user"]');
        if(avatarBtn){
          avatarBtn.addEventListener('click', async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();

            const existing = row.nextElementSibling;
            if(existing && existing.classList && existing.classList.contains('admin-user-profile')){
              existing.remove();
              return;
            }

            const panel = document.createElement('div');
            panel.className = 'admin-user-profile';
            panel.innerHTML = '<div class="admin-user-profile-title">Profil User</div><div class="admin-user-profile-loading">Memuat...</div>';
            row.insertAdjacentElement('afterend', panel);

            try {
              const resp = await fetchUserProfileAdmin(item.user_id);
              const user = resp && resp.success ? resp.data : null;
              if(!user){
                panel.innerHTML = '<div class="admin-user-profile-title">Profil User</div><div class="admin-user-profile-loading">Profil tidak ditemukan.</div>';
                return;
              }
              const extra = safeJsonParse(user.profile_extra);
              const fieldsHtml = [
                renderProfileField('Nama', user.name),
                renderProfileField('Email', user.email),
                renderProfileField('Telepon', user.phone),
                renderProfileField('Jenis Identitas', extra.idType),
                renderProfileField('Nomor Identitas', extra.idNumber),
                renderProfileField('Jenis Kelamin', extra.gender),
                renderProfileField('Tanggal Lahir', extra.dob),
                renderProfileField('Alamat', extra.fullAddress || user.address),
                renderProfileField('Kota', extra.city),
                renderProfileField('Kode Pos', extra.postalCode),
                renderProfileField('Negara', extra.country)
              ].filter(Boolean).join('');

              const avatar = (user.avatar && String(user.avatar).trim()) ? String(user.avatar).trim() : getDefaultAvatarSrc();
              panel.innerHTML = `
                <div class="admin-user-profile-header">
                  <img class="admin-user-profile-avatar" src="${avatar}" alt="Avatar" />
                  <div>
                    <div class="admin-user-profile-title">Profil User</div>
                    <div class="admin-user-profile-subtitle">${sanitizeText(user.name || '')}</div>
                  </div>
                </div>
                <div class="admin-user-profile-grid">${fieldsHtml || '<div class="admin-user-profile-loading">Data profil kosong.</div>'}</div>
              `;
            } catch (e){
              panel.innerHTML = '<div class="admin-user-profile-title">Profil User</div><div class="admin-user-profile-loading">Gagal memuat profil.</div>';
            }
          });
        }
        listEl.appendChild(row);
      });
    }

    async function selectItem(item){
      if(!item || !item.id) return;
      state.activeId = item.id;
      renderList();

      if(previewTitle) previewTitle.textContent = `${serviceTitle || serviceSlug}`;
      if(previewMeta) previewMeta.textContent = `${sanitizeText(item.user_name || 'User')} • ${sanitizeText(item.file_name || '')} • ${formatDate(item.created_at)}`;

      setBusy(true);
      revokePdfUrl();
      try {
        const blob = await fetchPdfBlobAdmin(item.id);
        const url = URL.createObjectURL(blob);
        state.activePdfUrl = url;
        if(previewFrame) previewFrame.src = url;
      } catch (e){
        if(previewFrame) previewFrame.removeAttribute('src');
        alert(e.message || 'Gagal membuka PDF');
      } finally {
        setBusy(false);
      }
    }

    async function loadSubmissions(){
      setBusy(true);
      try {
        const res = await apiGet(`/api/admin/submissions?status=pending&serviceSlug=${encodeURIComponent(serviceSlug)}`);
        const raw = Array.isArray(res && res.items) ? res.items : [];
        // Safety: ensure only pending items are shown even if backend misreports
        state.items = raw.filter(i => String(i.status || '').toLowerCase() === 'pending');
        // Always order newest first by created_at
        state.items.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        // reset active selection if it disappeared
        if(state.activeId && !state.items.some(i => String(i.id) === String(state.activeId))){
          state.activeId = null;
          revokePdfUrl();
          if(previewFrame) previewFrame.removeAttribute('src');
          if(previewTitle) previewTitle.textContent = 'Pilih dokumen';
          if(previewMeta) previewMeta.textContent = '—';
        }
        renderList();
      } catch (e){
        alert(e.message || 'Gagal memuat submissions');
      } finally {
        setBusy(false);
      }
    }

    async function signActive(){
      if(!state.activeId) return;
      if(state.busy) return;

      if(!sig || !sig.hasInk || !sig.hasInk()){
        alert('TTD masih kosong. Silakan upload atau gambar tanda tangan terlebih dahulu.');
        return;
      }

      setBusy(true);
      try {
        const current = JSON.parse(localStorage.getItem('currentUser') || 'null');
        const signerName = (signerNameInput && signerNameInput.value) ? signerNameInput.value : (current && current.name ? current.name : '');
        const dateVal = signedDate && signedDate.value ? signedDate.value : '';
        const signatureDataUrl = sig.toDataUrl();

        await apiPost(`/api/admin/submissions/${state.activeId}/sign`, {
          signatureDataUrl,
          signedDate: dateVal,
          signerName
        });

        // Remove signed document from list (user wants it to disappear after signing)
        state.items = state.items.filter(i => String(i.id) !== String(state.activeId));
        state.activeId = null;
        revokePdfUrl();
        if(previewFrame) previewFrame.removeAttribute('src');
        if(previewTitle) previewTitle.textContent = 'Pilih dokumen';
        if(previewMeta) previewMeta.textContent = '—';
        
        renderList();
        sig.clear();
        alert('Berhasil ditandatangani. Dokumen tersimpan di Arsip Admin.');
      } catch (e){
        alert(e.message || 'Gagal menandatangani');
      } finally {
        setBusy(false);
      }
    }

    let sig = null;

    document.addEventListener('DOMContentLoaded', async () => {
      const ok = await ensureAdmin();
      if(!ok) return;

      try {
        const me = await apiGet('/api/me');
        const user = me && me.success ? me.data : null;
        if(user) localStorage.setItem('currentUser', JSON.stringify(user));
      } catch (e) {}

      if(logoutBtn){
        logoutBtn.addEventListener('click', () => {
          localStorage.removeItem('currentUser');
          localStorage.removeItem('token');
          navigateWithFade('login.html');
        });
      }

      if(signedDate) signedDate.value = todayIsoDate();

      // Default provider name to current admin name
      try {
        const current = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if(signerNameInput && current && current.name && !signerNameInput.value){
          signerNameInput.value = current.name;
        }
      } catch (e) {}

      if(sigCanvas){
        sig = setupSignatureCanvas(sigCanvas);
      } else {
        sig = { clear(){}, hasInk(){return false;}, toDataUrl(){return '';}, loadDataUrl(){return false;} };
      }

      if(clearSig){
        clearSig.addEventListener('click', () => sig.clear());
      }

      if(sigUpload){
        sigUpload.addEventListener('change', (e) => {
          const file = e && e.target ? e.target.files && e.target.files[0] : null;
          if(!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            sig.clear();
            sig.loadDataUrl(String(reader.result || ''));
          };
          reader.readAsDataURL(file);
        });
      }

      if(signBtn){
        signBtn.addEventListener('click', () => {
          signActive();
        });
      }

      if(rejectBtn){
        rejectBtn.addEventListener('click', async () => {
          if(!state.activeId) return;
          if(!confirm('Tolak dokumen ini?')) return;
          
          setBusy(true);
          try {
            await apiPost(`/api/admin/submissions/${state.activeId}/reject`, {});
            
            // Remove rejected document from list
            state.items = state.items.filter(i => String(i.id) !== String(state.activeId));
            state.activeId = null;
            revokePdfUrl();
            if(previewFrame) previewFrame.removeAttribute('src');
            if(previewTitle) previewTitle.textContent = 'Pilih dokumen';
            if(previewMeta) previewMeta.textContent = '—';
            
            renderList();
            alert('Dokumen ditolak.');
          } catch (e) {
            alert(e.message || 'Gagal menolak dokumen');
          } finally {
            setBusy(false);
          }
        });
      }

      if(searchInput){
        searchInput.addEventListener('input', renderList);
      }

      if(refreshBtn){
        refreshBtn.addEventListener('click', loadSubmissions);
      }

      await loadSubmissions();
      setBusy(false);
    });
  };
})();
