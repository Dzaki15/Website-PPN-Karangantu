// helper for fade navigation
function navigateWithFade(url){
    // add fade-out (simple)
    document.body.classList.add('fade-out');
    setTimeout(() => {
      window.location.href = url;
    }, 380);
  }
  
  console.log('[script.js] Loaded');
  
  // API helpers
  // Backend API base URL.
  // - On production (served over http/https), use same-origin so /api/* hits the deployed server.
  // - On local dev (opened via file:// or when you want a specific server), fall back to localhost ports.
  // To force a specific base: set window.API_BASE_OVERRIDE in browser console before loading pages.
  const LOCAL_API_BASES = ['http://127.0.0.1:8080', 'http://127.0.0.1:8081'];
  const API_BASE_OVERRIDE = (typeof window !== 'undefined' && window.API_BASE_OVERRIDE) ? window.API_BASE_OVERRIDE : '';
  const API_BASE_STORAGE_KEY = 'apiBase';

  function getSameOriginBase(){
    try {
      if (typeof window === 'undefined' || !window.location) return '';
      const protocol = window.location.protocol;
      if (protocol !== 'http:' && protocol !== 'https:') return '';
      return `${protocol}//${window.location.host}`;
    } catch (e){
      return '';
    }
  }

  function normalizeApiBase(value){
    if(!value) return '';
    const trimmed = String(value).trim().replace(/\/+$/, '');
    if(!/^https?:\/\//i.test(trimmed)) return '';
    return trimmed;
  }

  const SAME_ORIGIN_BASE = getSameOriginBase();

  const storedApiBase = (typeof localStorage !== 'undefined')
    ? normalizeApiBase(localStorage.getItem(API_BASE_STORAGE_KEY) || '')
    : '';

  // Default priority:
  // 1) API_BASE_OVERRIDE (explicit)
  // 2) stored API base
  // 3) same-origin when served over http/https
  // 4) localhost dev default
  let API_BASE = normalizeApiBase(API_BASE_OVERRIDE) || storedApiBase || SAME_ORIGIN_BASE || LOCAL_API_BASES[0];
  const LOCAL_USERS_KEY = 'localUsers';
  function getToken(){
    return localStorage.getItem('token') || '';
  }
  function setAuth(user, token){
    if(user) localStorage.setItem('currentUser', JSON.stringify(user));
    if(token) localStorage.setItem('token', token);
  }
  function clearAuth(){
    try { localStorage.removeItem('token'); } catch(e) {}
    try { localStorage.removeItem('currentUser'); } catch(e) {}
  }

  function bindFadeLinks(root){
    try {
      const scope = root || document;
      const anchors = scope.querySelectorAll('a[data-fade]');
      anchors.forEach(a => {
        if(a.dataset.fadeBound === '1') return;
        a.dataset.fadeBound = '1';
        a.addEventListener('click', function(e){
          if(a.hasAttribute('data-logout')) return;
          const href = a.getAttribute('href');
          if(!href) return;
          e.preventDefault();
          navigateWithFade(href);
        });
      });
    } catch (e){
      // ignore
    }
  }
  function getLocalUsers(){
    try {
      return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY)) || [];
    } catch (error){
      console.warn('Gagal membaca penyimpanan lokal:', error);
      return [];
    }
  }
  function saveLocalUsers(users){
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  }
  function registerLocalUser({ name, email, password }){
    const users = getLocalUsers();
    if(users.some(user => user.email === email)){
      throw new Error('Email sudah terdaftar (mode offline).');
    }
    const user = { id: `local-${Date.now()}`, name, email, password };
    users.push(user);
    saveLocalUsers(users);
    return { user: { id: user.id, name: user.name, email: user.email }, token: `local-${user.id}` };
  }
  function loginLocalUser({ email, password }){
    const user = getLocalUsers().find(entry => entry.email === email && entry.password === password);
    if(!user){
      throw new Error('Email atau password salah (mode offline).');
    }
    return { user: { id: user.id, name: user.name, email: user.email }, token: `local-${user.id}` };
  }
  function isNetworkError(err){
    return !!(err && (err.isNetworkError || err.message === 'Failed to fetch' || err.name === 'TypeError'));
  }
  
  // Check for OAuth callback with token in URL
  document.addEventListener('DOMContentLoaded', function(){
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userJson = urlParams.get('user');
    
    if (token && userJson) {
      try {
        const user = JSON.parse(decodeURIComponent(userJson));
        setAuth(user, token);
        // Clean URL and navigate to home
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {
        console.error('Error parsing OAuth callback:', e);
      }
    }
  });
  async function apiRequest(path, method = 'GET', body){
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if(token) headers['Authorization'] = `Bearer ${token}`;
    const url = `${API_BASE}${path}`;
    let res;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (error){
      // If the default port is busy (common on Windows), retry once using the fallback base.
      // Do not override when the user explicitly sets API_BASE_OVERRIDE.
      if(!API_BASE_OVERRIDE){
        // Only use localhost fallbacks in local-dev mode.
        const canUseLocalFallbacks = !SAME_ORIGIN_BASE || API_BASE.startsWith('http://127.0.0.1') || API_BASE.startsWith('http://localhost');
        const fallbacks = canUseLocalFallbacks ? LOCAL_API_BASES.filter(b => b !== API_BASE) : [];
        const nextBase = fallbacks[0];
        if(nextBase){
          try {
            const retryRes = await fetch(`${nextBase}${path}`, {
              method,
              headers,
              body: body ? JSON.stringify(body) : undefined
            });
            API_BASE = nextBase;
            try { localStorage.setItem(API_BASE_STORAGE_KEY, API_BASE); } catch(e) {}
            res = retryRes;
          } catch (retryError){
            const networkErr = new Error('Network error');
            networkErr.isNetworkError = true;
            networkErr.cause = retryError;
            throw networkErr;
          }
        } else {
          const networkErr = new Error('Network error');
          networkErr.isNetworkError = true;
          networkErr.cause = error;
          throw networkErr;
        }
      } else {
        const networkErr = new Error('Network error');
        networkErr.isNetworkError = true;
        networkErr.cause = error;
        throw networkErr;
      }
    }
    // Try to parse JSON; if not JSON, keep raw text for better error reporting
    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')){
      data = await res.json().catch(()=>({}));
    } else {
      const text = await res.text().catch(()=> '');
      data = text ? { message: text } : {};
    }
    if(!res.ok){
      let msg = (data && (data.error || data.message)) || `${res.status} ${res.statusText}` || 'Request failed';
      msg = String(msg || '');

      if (msg.includes('<!DOCTYPE') || msg.includes('<html')){
        const preMatch = msg.match(/<pre>([\s\S]*?)<\/pre>/i);
        if (preMatch && preMatch[1]) {
          msg = preMatch[1].replace(/\s+/g, ' ').trim();
        } else {
          msg = 'Request failed';
        }
      }

      if (/^Cannot\s+(GET|POST|PUT|DELETE)\s+\/api\//i.test(msg)){
        msg = `${msg}. Backend API belum berjalan / salah server. Jalankan START_SERVER.bat (port 8080).`;
      }

      if (msg.length > 240) msg = msg.slice(0, 240) + '...';

      const err = new Error(msg);
      err.httpStatus = res.status;
      throw err;
    }
    return data;
  }
  async function apiPost(path, body){ return apiRequest(path, 'POST', body); }
  async function apiGet(path){ return apiRequest(path, 'GET'); }
  async function apiPut(path, body){ return apiRequest(path, 'PUT', body); }

  function getCurrentPageName(){
    try {
      const raw = (window.location && window.location.pathname) ? window.location.pathname : '';
      const last = raw.split('/').pop() || '';
      return last.toLowerCase();
    } catch (e){
      return '';
    }
  }

  function isTopicChromeTargetPage(){
    const page = getCurrentPageName();
    // Requested: home, admin home, and the 7 forms (apply to both user + admin variants).
    const targets = new Set([
      'home.html',
      'admin-home.html',
      'arsip-dokumen.html',
      'skkp.html',
      'pb-form.html',
      'pengadaan-es.html',
      'stblkk.html',
      'shti-lt.html',
      'jasa-listrik.html',
      'penggunaan-arra.html',
      'admin-skkp.html',
      'admin-pb.html',
      'admin-pengadaan-es.html',
      'admin-stblkk.html',
      'admin-shti-lt.html',
      'admin-jasa-listrik.html',
      'admin-penggunaan-arra.html',
      'admin-arsip.html'
    ]);
    return targets.has(page);
  }

  const TOPIC_DEFAULT_AVATAR_SRC = 'assets/Profile%20Idle%20Icon.png';

  function coerceUserFromApiResponse(res){
    if(!res) return null;
    if(res.success && res.data) return res.data;
    if(res.user) return res.user;
    if(res.data && (res.data.id || res.data.email)) return res.data;
    if(res.id || res.email) return res;
    return null;
  }

  function getStoredCurrentUserSafe(){
    try {
      return JSON.parse(localStorage.getItem('currentUser') || 'null');
    } catch (e){
      return null;
    }
  }

  function setStoredCurrentUserSafe(user){
    try {
      if(!user) return;
      localStorage.setItem('currentUser', JSON.stringify(user));
    } catch (e){
      // ignore
    }
  }

  function setTopicHeaderAvatarSrc(src){
    try {
      const header = document.querySelector('header.topic-header');
      if(!header) return false;
      const img = header.querySelector('img[data-topic-avatar]');
      if(!img) return false;

      const nextSrc = (typeof src === 'string' && src.trim()) ? src.trim() : TOPIC_DEFAULT_AVATAR_SRC;
      if(img.getAttribute('src') !== nextSrc) img.setAttribute('src', nextSrc);

      if(img.dataset && img.dataset.fallbackBound !== '1'){
        img.dataset.fallbackBound = '1';
        img.addEventListener('error', () => {
          if(img.getAttribute('src') !== TOPIC_DEFAULT_AVATAR_SRC){
            img.setAttribute('src', TOPIC_DEFAULT_AVATAR_SRC);
          }
        });
      }

      return true;
    } catch (e){
      return false;
    }
  }

  async function hydrateTopicHeaderAvatar(){
    // Always start with idle icon so it matches the requested UX.
    setTopicHeaderAvatarSrc(TOPIC_DEFAULT_AVATAR_SRC);

    const stored = getStoredCurrentUserSafe();
    if(stored && typeof stored.avatar === 'string' && stored.avatar.trim()){
      setTopicHeaderAvatarSrc(stored.avatar);
    }

    const token = getToken();
    if(!token) return;

    try {
      const res = await apiGet('/api/me');
      const me = coerceUserFromApiResponse(res);
      if(!me) return;

      const merged = { ...(stored || {}), ...me };
      setStoredCurrentUserSafe(merged);

      if(typeof merged.avatar === 'string' && merged.avatar.trim()){
        setTopicHeaderAvatarSrc(merged.avatar);
      }
    } catch (e){
      // ignore
    }
  }

  function buildTopicHeaderHtml(){
    const page = getCurrentPageName();
    const isAdmin = page.startsWith('admin-');
    const homeHref = isAdmin ? 'admin-home.html' : 'home.html';
    const arsipHref = isAdmin ? 'admin-arsip.html' : 'arsip-dokumen.html';
    const arsipLabel = isAdmin ? 'Arsip Admin' : 'Arsip Dokumen';

    const formPages = isAdmin ? [
      { href: 'admin-skkp.html', label: 'SKKP' },
      { href: 'admin-pb.html', label: 'PB' },
      { href: 'admin-pengadaan-es.html', label: 'Pengadaan ES' },
      { href: 'admin-stblkk.html', label: 'STBLKK' },
      { href: 'admin-shti-lt.html', label: 'SHTI LT' },
      { href: 'admin-jasa-listrik.html', label: 'Jasa Listrik' },
      { href: 'admin-penggunaan-arra.html', label: 'Penggunaan ARRA' }
    ] : [
      { href: 'skkp.html', label: 'SKKP' },
      { href: 'pb-form.html', label: 'PB' },
      { href: 'pengadaan-es.html', label: 'Pengadaan ES' },
      { href: 'stblkk.html', label: 'STBLKK' },
      { href: 'shti-lt.html', label: 'SHTI LT' },
      { href: 'jasa-listrik.html', label: 'Jasa Listrik' },
      { href: 'penggunaan-arra.html', label: 'Penggunaan ARRA' }
    ];

    const shouldShowBack = !['home.html', 'admin-home.html'].includes(page);
    const backHref = homeHref;

    const pagesMenu = formPages.map(p => `<a class="topic-menu-item" href="${p.href}" data-fade>${p.label}</a>`).join('');
    const mobileLinks = [
      `<a class="topic-mobile-link" href="${homeHref}" data-fade>Home</a>`,
      `<a class="topic-mobile-link" href="${arsipHref}" data-fade>${arsipLabel}</a>`,
      ...formPages.map(p => `<a class="topic-mobile-link" href="${p.href}" data-fade>${p.label}</a>`)
    ].join('');

    // Note: user icon is visual only; avoid adding new flows.
    return `
      <header class="site-header topic-header" data-topic-chrome>
        <div class="topic-nav" role="navigation" aria-label="Primary">
          <div class="topic-left">
            ${shouldShowBack ? `<a class="topic-back" href="${backHref}" data-fade aria-label="Kembali">\u2190</a>` : `<span class="topic-back-spacer" aria-hidden="true"></span>`}
            <a class="topic-brand" href="${homeHref}" data-fade aria-label="Beranda">
              <img class="topic-brand-logo" src="assets/Kementerian Kelautan dan Perikanan (KKP) Republik Indonesia.png" alt="Logo Kementerian Kelautan dan Perikanan" loading="lazy" decoding="async" />
              <span class="topic-name">PPN Karangantu</span>
            </a>
          </div>

          <nav class="topic-links" aria-label="Menu">
            <a class="topic-link" href="${homeHref}" data-fade>Home</a>
            <a class="topic-link" href="${arsipHref}" data-fade>${arsipLabel}</a>
            <div class="topic-dropdown">
              <button class="topic-dropbtn" type="button" aria-expanded="false">Pages <span aria-hidden="true">\u25BE</span></button>
              <div class="topic-menu" role="menu" aria-label="Pages">
                ${pagesMenu}
              </div>
            </div>
            <a class="topic-link" href="login.html" data-logout>Logout</a>
          </nav>

          <div class="topic-actions">
            <a class="topic-icon-btn topic-user" href="edit-profile.html" data-fade aria-label="Profile">
              <img class="topic-user-icon" data-topic-avatar src="assets/Profile%20Idle%20Icon.png" alt="" aria-hidden="true" loading="lazy" decoding="async" />
            </a>
            <button class="topic-icon-btn topic-burger" type="button" aria-label="Menu" aria-expanded="false">
              <span class="topic-burger-lines" aria-hidden="true"></span>
            </button>
          </div>
        </div>

        <div class="topic-mobile" aria-label="Mobile menu">
          ${mobileLinks}
          <a class="topic-mobile-link" href="edit-profile.html" data-fade>Profile</a>
          <a class="topic-mobile-link" href="login.html" data-logout>Logout</a>
        </div>
      </header>
    `;
  }

  function buildTopicFooterHtml(){
    const page = getCurrentPageName();
    const isAdmin = page.startsWith('admin-');
    const homeHref = isAdmin ? 'admin-home.html' : 'home.html';
    const arsipHref = isAdmin ? 'admin-arsip.html' : 'arsip-dokumen.html';
    const useWideFooterLogos = (page === 'home.html' || page === 'admin-home.html');
    const kkpLogoSrc = useWideFooterLogos
      ? 'assets/logo kementrian kelautan dan  perikanan lebar.png'
      : 'assets/logo-kkp-pipp.png';
    const upiLogoSrc = useWideFooterLogos
      ? 'assets/Logo UPI lebar.png'
      : 'assets/Logo Upi .png';
    const resourceLinks = [
      { href: homeHref, label: 'Home' },
      { href: arsipHref, label: 'Arsip Dokumen' }
    ];

    return `
      <footer class="topic-footer" data-topic-chrome>
        <div class="topic-footer-inner">
          <div class="topic-footer-grid">
            <div class="topic-footer-col">
              <div class="topic-footer-brand">
                <img class="topic-footer-logo topic-footer-logo-kkp" src="${kkpLogoSrc}" alt="Logo KKP" loading="lazy" decoding="async" />
                <img class="topic-footer-logo topic-footer-logo-upi" src="${upiLogoSrc}" alt="Logo UPI" loading="lazy" decoding="async" />
              </div>
            </div>
            <div class="topic-footer-col">
              <div class="topic-footer-title">Resources</div>
              <div class="topic-footer-links">
                ${resourceLinks.map(l => `<a href="${l.href}" data-fade>${l.label}</a>`).join('')}
              </div>
            </div>
            <div class="topic-footer-col">
              <div class="topic-footer-title">Information</div>
              <div class="topic-footer-info">
                <div class="topic-footer-info-line">Email <span class="topic-footer-muted">info@karangantu</span></div>
              </div>
            </div>
            <div class="topic-footer-col topic-footer-lang">
              <button class="topic-lang-btn" type="button">Indonesia</button>
            </div>
          </div>

          <div class="topic-footer-bottom">
            <div class="topic-footer-muted">Copyright \u00A9 2025 ProkonKel3UPI. All rights reserved.</div>
          </div>
        </div>
      </footer>
    `;
  }

  function injectTopicChromeIfNeeded(){
    if(!isTopicChromeTargetPage()) return false;

    // Replace existing header (site header / topbar / form header) with Topic-style header.
    try {
      const headerHtml = buildTopicHeaderHtml().trim();
      const host = document.createElement('div');
      host.innerHTML = headerHtml;
      const newHeader = host.firstElementChild;
      const existingHeader = document.querySelector('.site-header, .topbar, .topbar-right, .form-header');
      if(existingHeader && newHeader){
        existingHeader.replaceWith(newHeader);
      } else if(newHeader){
        document.body.insertAdjacentElement('afterbegin', newHeader);
      }
    } catch (e) {
      // ignore
    }

    // Replace/ensure footer.
    try {
      const footerHtml = buildTopicFooterHtml().trim();
      const host = document.createElement('div');
      host.innerHTML = footerHtml;
      const newFooter = host.firstElementChild;
      const existingFooter = document.querySelector('.site-footer');
      if(existingFooter && newFooter){
        existingFooter.replaceWith(newFooter);
      } else if(newFooter){
        document.body.appendChild(newFooter);
      }
    } catch (e) {
      // ignore
    }

    // Wire up header interactions (mobile menu + dropdown).
    try {
      const header = document.querySelector('header.topic-header');
      if(header){
        bindFadeLinks(header);

        const burger = header.querySelector('.topic-burger');
        const dropdownBtn = header.querySelector('.topic-dropbtn');
        const dropdown = header.querySelector('.topic-dropdown');

        const logoutLinks = header.querySelectorAll('a[data-logout]');
        logoutLinks.forEach(link => {
          if(link.dataset.logoutBound === '1') return;
          link.dataset.logoutBound = '1';
          link.addEventListener('click', (e) => {
            e.preventDefault();
            clearAuth();
            document.documentElement.classList.remove('topic-menu-open');
            navigateWithFade('login.html');
          });
        });

        if(burger){
          burger.addEventListener('click', () => {
            const isOpen = document.documentElement.classList.toggle('topic-menu-open');
            burger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
          });
        }

        if(dropdownBtn && dropdown){
          dropdownBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isOpen = dropdown.classList.toggle('is-open');
            dropdownBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
          });
          document.addEventListener('click', (e) => {
            if(!dropdown.contains(e.target)){
              dropdown.classList.remove('is-open');
              dropdownBtn.setAttribute('aria-expanded', 'false');
            }
          });
        }

        // Profile icon (idle -> avatar)
        hydrateTopicHeaderAvatar();
      }
    } catch (e) {
      // ignore
    }

    // Asset fallbacks: hide missing logos.
    try {
      const images = Array.from(document.querySelectorAll('img.topic-brand-logo, img.topic-footer-logo'));
      images.forEach((img) => {
        img.addEventListener('error', () => {
          // If UPI logo missing in a given folder, hide it.
          img.style.display = 'none';
        }, { once: true });
      });
    } catch (e) {
      // ignore
    }

    return true;
  }
  
  // Wait for DOM and then add loaded class for simple entry animation
  document.addEventListener('DOMContentLoaded', function(){
    // small delay so css transition is visible
    setTimeout(()=> {
      document.documentElement.classList.add('js-ready');
      document.body.classList.add('loaded');
      // mark page-level element for internal transition
      const pages = document.querySelectorAll('.page');
      pages.forEach(p => p.classList.add('loaded'));
    }, 80);
  
    // intercept all internal links that call navigateWithFade via href="#" plus onclick to navigateWithFade
    // also attach to anchors with data-fade attribute
    bindFadeLinks(document);

    // TemplateMo Topic-like header/footer for requested pages.
    const injected = injectTopicChromeIfNeeded();

    // Fallback footer for other pages without a footer.
    if(!injected){
      try {
        if(!document.querySelector('.site-footer')){
          const footer = document.createElement('footer');
          footer.className = 'site-footer';
          footer.innerHTML = `
            <div class="footer-inner">
              <p class="footer-text">PPN Karangantu • Arsip Pintar</p>
            </div>
          `;
          document.body.appendChild(footer);
        }
      } catch (e) {
        // ignore
      }
    }
  });

  // Home search: filter category cards
  document.addEventListener('DOMContentLoaded', function(){
    try {
      if(!document.body || !document.body.classList.contains('home-page')) return;
      const input = document.querySelector('.search-card input[type="search"]');
      const cards = Array.from(document.querySelectorAll('.grid-categories .cat'));
      if(!input || !cards.length) return;

      const normalize = (value) => (value || '').toString().toLowerCase().trim();

      function applyFilter(raw){
        const query = normalize(raw);
        cards.forEach((card) => {
          const label = card.querySelector('.cat-label')?.textContent || '';
          const alt = card.querySelector('img')?.getAttribute('alt') || '';
          const haystack = normalize(`${label} ${alt}`);
          const isMatch = !query || haystack.includes(query);
          card.style.display = isMatch ? '' : 'none';
        });
      }

      input.addEventListener('input', () => applyFilter(input.value));
      input.addEventListener('keydown', (e) => {
        if(e.key !== 'Enter') return;
        const query = normalize(input.value);
        if(!query) return;
        const firstVisible = cards.find(card => card.style.display !== 'none');
        if(firstVisible){
          e.preventDefault();
          firstVisible.click();
        }
      });
    } catch (e) {
      // ignore
    }
  });
  
  // ===== Dokumentasi Arsip Lokal =====
  const ARCHIVE_STORAGE_KEY = 'documentArchiveEntries';
  const ARCHIVE_LIMIT = 200;

  // Store the *actual generated PDF* bytes separately from metadata.
  // localStorage is too small for PDFs, so we use IndexedDB.
  const ARCHIVE_DB_NAME = 'arsipPintarArchive';
  const ARCHIVE_DB_VERSION = 1;
  const ARCHIVE_PDF_STORE = 'pdfs';

  function openArchiveDb(){
    return new Promise((resolve, reject) => {
      if(typeof indexedDB === 'undefined'){
        reject(new Error('IndexedDB tidak tersedia.'));
        return;
      }
      const req = indexedDB.open(ARCHIVE_DB_NAME, ARCHIVE_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if(!db.objectStoreNames.contains(ARCHIVE_PDF_STORE)){
          db.createObjectStore(ARCHIVE_PDF_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Gagal membuka IndexedDB.'));
    });
  }

  async function saveArchivePdfBlob(id, blob){
    if(!id || !blob) return false;
    try {
      const db = await openArchiveDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(ARCHIVE_PDF_STORE, 'readwrite');
        const store = tx.objectStore(ARCHIVE_PDF_STORE);
        store.put({ id, blob, savedAt: Date.now() });
        tx.oncomplete = () => {
          try { db.close(); } catch(e) {}
          resolve(true);
        };
        tx.onerror = () => {
          try { db.close(); } catch(e) {}
          reject(tx.error || new Error('Gagal menyimpan PDF ke IndexedDB.'));
        };
      });
    } catch (error){
      console.warn('Tidak dapat menyimpan PDF arsip:', error);
      return false;
    }
  }

  async function getArchivePdfBlob(id){
    if(!id) return null;
    try {
      const db = await openArchiveDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(ARCHIVE_PDF_STORE, 'readonly');
        const store = tx.objectStore(ARCHIVE_PDF_STORE);
        const req = store.get(id);
        req.onsuccess = () => {
          try { db.close(); } catch(e) {}
          resolve(req.result ? req.result.blob : null);
        };
        req.onerror = () => {
          try { db.close(); } catch(e) {}
          reject(req.error || new Error('Gagal mengambil PDF dari IndexedDB.'));
        };
      });
    } catch (error){
      console.warn('Tidak dapat membaca PDF arsip:', error);
      return null;
    }
  }

  async function deleteArchivePdfBlob(id){
    if(!id) return false;
    try {
      const db = await openArchiveDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(ARCHIVE_PDF_STORE, 'readwrite');
        const store = tx.objectStore(ARCHIVE_PDF_STORE);
        store.delete(id);
        tx.oncomplete = () => {
          try { db.close(); } catch(e) {}
          resolve(true);
        };
        tx.onerror = () => {
          try { db.close(); } catch(e) {}
          reject(tx.error || new Error('Gagal menghapus PDF dari IndexedDB.'));
        };
      });
    } catch (error){
      console.warn('Tidak dapat menghapus PDF arsip:', error);
      return false;
    }
  }

  async function clearArchivePdfBlobs(){
    try {
      const db = await openArchiveDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(ARCHIVE_PDF_STORE, 'readwrite');
        const store = tx.objectStore(ARCHIVE_PDF_STORE);
        store.clear();
        tx.oncomplete = () => {
          try { db.close(); } catch(e) {}
          resolve(true);
        };
        tx.onerror = () => {
          try { db.close(); } catch(e) {}
          reject(tx.error || new Error('Gagal mengosongkan PDF IndexedDB.'));
        };
      });
    } catch (error){
      console.warn('Tidak dapat mengosongkan PDF arsip:', error);
      return false;
    }
  }

  function getArchiveEntries(){
    try {
      const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error){
      console.warn('Tidak dapat membaca arsip lokal:', error);
      return [];
    }
  }

  function persistArchiveEntries(entries){
    try {
      const limited = Array.isArray(entries) ? entries.slice(0, ARCHIVE_LIMIT) : [];
      const json = JSON.stringify(limited);
      console.log('[Archive] persistArchiveEntries: saving', limited.length, 'entries, size:', json.length, 'bytes');
      localStorage.setItem(ARCHIVE_STORAGE_KEY, json);
      console.log('[Archive] persistArchiveEntries: ✅ success!');
    } catch (error){
      console.error('[Archive] persistArchiveEntries: ❌ ERROR -', error);
    }
  }

  function archiveDocument({ serviceSlug = 'dokumen', serviceName = 'Dokumen', userName = '', data = {}, fileName, pdfBlob } = {}){
    try {
      console.log('[Archive] archiveDocument called:', { serviceSlug, serviceName, userName, fileName, hasPdf: !!pdfBlob });
      const timestamp = Date.now();
      const resolvedFileName = fileName || `${serviceSlug}-${timestamp}.${pdfBlob ? 'pdf' : 'json'}`;
      const resolvedUserName = userName || data.namaPengguna || data.namaPemohon || data.namaPemberiLayanan || data.namaPemberi || data.namaKapal || 'Tanpa Nama';
      const hasPdf = Boolean(pdfBlob) || (typeof resolvedFileName === 'string' && /\.pdf$/i.test(resolvedFileName));

      // Dedupe: if the same document (serviceSlug + fileName) is saved again,
      // update the existing entry instead of inserting a new one.
      const entries = getArchiveEntries();
      const existingIndex = entries.findIndex(e => e && e.serviceSlug === serviceSlug && e.fileName === resolvedFileName);
      if(existingIndex >= 0){
        const existing = entries[existingIndex];
        const updated = {
          ...existing,
          serviceSlug,
          serviceName,
          userName: resolvedUserName,
          savedAt: new Date(timestamp).toISOString(),
          fileName: resolvedFileName,
          hasPdf: existing.hasPdf || hasPdf,
          data
        };
        entries[existingIndex] = updated;
        // move updated entry to top
        if(existingIndex !== 0){
          entries.splice(existingIndex, 1);
          entries.unshift(updated);
        }
        persistArchiveEntries(entries);
        Promise.resolve().then(() => updateArsipBadgeCount()).catch(()=>{});
        if(pdfBlob){
          Promise.resolve().then(() => saveArchivePdfBlob(updated.id, pdfBlob)).catch(()=>{});
          Promise.resolve().then(() => publishSubmissionToServer({ serviceSlug, fileName: resolvedFileName, data, pdfBlob, entryId: updated.id })).catch(()=>{});
        }
        return updated;
      }

      const entry = {
        id: `${serviceSlug}-${timestamp}`,
        serviceSlug,
        serviceName,
        userName: resolvedUserName,
        savedAt: new Date(timestamp).toISOString(),
        fileName: resolvedFileName,
        hasPdf,
        data
      };
      entries.unshift(entry);
      console.log('[Archive] Created new entry:', entry.id);
      persistArchiveEntries(entries);
      Promise.resolve().then(() => updateArsipBadgeCount()).catch(()=>{});

      // Save PDF bytes in IndexedDB (best-effort). Keep archive metadata synchronous.
      if(pdfBlob){
        Promise.resolve().then(() => saveArchivePdfBlob(entry.id, pdfBlob)).catch(()=>{});
        Promise.resolve().then(() => publishSubmissionToServer({ serviceSlug, fileName: resolvedFileName, data, pdfBlob, entryId: entry.id })).catch(()=>{});
      }
      console.log('[Archive] archiveDocument: ✅ complete');
      return entry;
    } catch (error){
      console.error('[Archive] archiveDocument: ❌ ERROR -', error);
      return null;
    }
  }

  function isLocalOfflineToken(token){
    return typeof token === 'string' && token.startsWith('local-');
  }

  function blobToBase64(blob){
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error('Gagal membaca blob'));
        reader.onload = () => {
          const result = String(reader.result || '');
          // result is a data URL: data:application/pdf;base64,....
          const base64 = result.includes('base64,') ? result.split('base64,')[1] : result;
          resolve(base64);
        };
        reader.readAsDataURL(blob);
      } catch (e){
        reject(e);
      }
    });
  }

  function updateArchiveEntryFieldsById(id, patch){
    if(!id || !patch) return;
    const entries = getArchiveEntries();
    const idx = entries.findIndex(e => e && e.id === id);
    if(idx < 0) return;
    entries[idx] = { ...entries[idx], ...patch };
    persistArchiveEntries(entries);
  }

  async function publishSubmissionToServer({ serviceSlug, fileName, data, pdfBlob, entryId }){
    try {
      const token = getToken();
      if(!token || isLocalOfflineToken(token)) return null;
      if(!pdfBlob) return null;

      const pdfBase64 = await blobToBase64(pdfBlob);
      const res = await apiPost('/api/submissions', { serviceSlug, fileName, data, pdfBase64 });
      if(res && res.id && entryId){
        updateArchiveEntryFieldsById(entryId, { submissionId: res.id, submittedAt: new Date().toISOString() });
      }
      return res;
    } catch (e){
      // Best-effort only: local Arsip remains usable even if server is offline
      console.warn('Gagal mengirim submission ke server:', e);
      return null;
    }
  }

  async function syncSignedSubmissionsToArchive({ maxItems = 25 } = {}){
    try {
      const token = getToken();
      if(!token || isLocalOfflineToken(token)) return { ok: false, skipped: true };

      // Throttle sync to avoid excessive downloads
      const throttleKey = 'signedSubmissionsLastSyncAt';
      const last = Number(localStorage.getItem(throttleKey) || '0') || 0;
      if(Date.now() - last < 30_000) return { ok: true, throttled: true };
      localStorage.setItem(throttleKey, String(Date.now()));

      const listRes = await apiGet('/api/my/signed-submissions');
      const items = Array.isArray(listRes && listRes.items) ? listRes.items : [];
      if(!items.length) return { ok: true, updated: 0 };

      const entries = getArchiveEntries();
      let updatedCount = 0;

      for(const item of items.slice(0, maxItems)){
        if(!item || !item.id || !item.service_slug || !item.file_name) continue;
        const match = entries.find(e => e && e.serviceSlug === item.service_slug && e.fileName === item.file_name);
        if(!match) continue;

        // Skip if we already synced this signed submission
        if(match.signedSubmissionId && String(match.signedSubmissionId) === String(item.id)) continue;

        const blob = await (async () => {
          const headers = {};
          const t = getToken();
          if(t) headers['Authorization'] = `Bearer ${t}`;
          const res = await fetch(`${API_BASE}/api/my/signed-submissions/${item.id}/pdf`, { headers });
          if(!res.ok) throw new Error('Gagal mengambil PDF signed');
          return await res.blob();
        })();

        await saveArchivePdfBlob(match.id, blob);
        updateArchiveEntryFieldsById(match.id, {
          hasPdf: true,
          status: 'signed',
          signedSubmissionId: item.id,
          signedAt: item.signed_at || new Date().toISOString()
        });
        updatedCount += 1;
      }

      return { ok: true, updated: updatedCount };
    } catch (e){
      console.warn('Gagal sync dokumen signed:', e);
      return { ok: false, error: e };
    }
  }

  function deleteArchiveEntry(id){
    if(!id) return;
    const entries = getArchiveEntries().filter(entry => entry.id !== id);
    persistArchiveEntries(entries);
    Promise.resolve().then(() => updateArsipBadgeCount()).catch(()=>{});
    Promise.resolve().then(() => deleteArchivePdfBlob(id)).catch(()=>{});
  }

  function clearArchiveEntries(){
    persistArchiveEntries([]);
    Promise.resolve().then(() => updateArsipBadgeCount()).catch(()=>{});
    Promise.resolve().then(() => clearArchivePdfBlobs()).catch(()=>{});
  }

  function downloadDataAsJson(data, fileName = `dokumen-${Date.now()}.json`){
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1200);
    } catch (error){
      console.warn('Gagal mengunduh data arsip:', error);
      alert('Tidak dapat menyiapkan berkas unduhan.');
    }
  }

  function getArchiveEntryById(id){
    if(!id) return null;
    return getArchiveEntries().find(entry => entry.id === id) || null;
  }

  // Ekspos helper ke global scope untuk digunakan halaman/form lain
  window.archiveDocument = archiveDocument;
  console.log('[script.js] window.archiveDocument exported:', typeof window.archiveDocument);
  window.getArchiveEntries = getArchiveEntries;
  window.deleteArchiveEntry = deleteArchiveEntry;
  window.clearArchiveEntries = clearArchiveEntries;
  window.downloadDataAsJson = downloadDataAsJson;
  window.getArchiveEntryById = getArchiveEntryById;

  // PDF storage helpers for Arsip Dokumen
  window.saveArchivePdfBlob = saveArchivePdfBlob;
  window.getArchivePdfBlob = getArchivePdfBlob;
  window.deleteArchivePdfBlob = deleteArchivePdfBlob;
  window.clearArchivePdfBlobs = clearArchivePdfBlobs;

  // ===== Signature Pad (shared helper) =====
  function setupSignatureCanvas(canvas, { strokeStyle = '#0b3b3f', lineWidth = 2 } = {}){
    if(!canvas) return { clear(){}, hasInk(){return false;}, toDataUrl(){return '';}, loadDataUrl(){return false;} };
    const ctx = canvas.getContext('2d');
    let drawing = false;
    let hasInk = false;

    canvas.style.touchAction = 'none';

    function resizeToCss(preserveInk){
      const rect = canvas.getBoundingClientRect();
      const cssW = Math.max(1, Math.round(rect.width || canvas.offsetWidth || 520));
      const cssH = Math.max(1, Math.round(rect.height || canvas.offsetHeight || 200));
      const dpr = window.devicePixelRatio || 1;

      const prev = (preserveInk && hasInk) ? canvas.toDataURL('image/png') : null;

      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = strokeStyle;

      if(prev){
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, cssW, cssH);
        };
        img.src = prev;
      }
    }

    function getPos(evt){
      const rect = canvas.getBoundingClientRect();
      return {
        x: (evt.clientX - rect.left),
        y: (evt.clientY - rect.top)
      };
    }

    function pointerDown(evt){
      drawing = true;
      hasInk = hasInk || false;
      try { canvas.setPointerCapture(evt.pointerId); } catch(e) {}
      const p = getPos(evt);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      evt.preventDefault();
    }

    function drawPoint(p){
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      hasInk = true;
    }

    function pointerMove(evt){
      if(!drawing) return;
      const events = (typeof evt.getCoalescedEvents === 'function') ? evt.getCoalescedEvents() : [evt];
      for(const e of events){
        drawPoint(getPos(e));
      }
      evt.preventDefault();
    }

    function pointerUp(evt){
      drawing = false;
      evt.preventDefault();
    }

    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);
    canvas.addEventListener('pointerleave', pointerUp);

    window.addEventListener('resize', () => resizeToCss(true));
    resizeToCss(false);

    function clear(){
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      hasInk = false;
    }

    function toDataUrl(){
      if(!hasInk) return '';
      return canvas.toDataURL('image/png');
    }

    function loadDataUrl(dataUrl){
      if(!dataUrl) return false;
      const img = new Image();
      img.onload = () => {
        const rect = canvas.getBoundingClientRect();
        const w = rect.width || canvas.offsetWidth || 520;
        const h = rect.height || canvas.offsetHeight || 200;
        ctx.clearRect(0, 0, w, h);
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

    return { clear, hasInk: () => hasInk, toDataUrl, loadDataUrl };
  }

  window.setupSignatureCanvas = setupSignatureCanvas;

  // ===== Server-signed PDF sync (User -> Arsip Dokumen) =====
  function serviceNameFromSlug(slug){
    const map = {
      'skkp': 'SKKP',
      'pb': 'PB',
      'pengadaan-es': 'Pengadaan ES',
      'stblkk': 'STBLKK',
      'shti-lt': 'SHTI LT',
      'jasa-listrik': 'Jasa Listrik',
      'penggunaan-arra': 'Penggunaan ARRA ES'
    };
    return map[String(slug || '').toLowerCase()] || (slug ? String(slug) : 'Dokumen');
  }

  async function fetchSignedPdfBlobForMe(submissionId){
    const headers = {};
    const token = getToken();
    if(token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/api/my/signed-submissions/${submissionId}/pdf`, { headers });
    if(!res.ok) throw new Error('Gagal mengambil PDF bertanda tangan');
    return await res.blob();
  }

  async function syncSignedSubmissionsToArchive(){
    // Best-effort: do nothing if user is not authenticated.
    const token = getToken();
    if(!token) return { ok: false, skipped: true };

    let me;
    try {
      const res = await apiGet('/api/me');
      me = res && res.success ? res.data : null;
    } catch (e){
      return { ok: false, skipped: true };
    }

    if(!me || me.role !== 'user') return { ok: false, skipped: true };
    if(typeof window.archiveDocument !== 'function') return { ok: false, skipped: true };

    const existing = (typeof window.getArchiveEntries === 'function') ? window.getArchiveEntries() : [];
    const existingByKey = new Map();
    existing.forEach(e => {
      if(!e) return;
      const key = `${e.serviceSlug}::${e.fileName}`;
      existingByKey.set(key, e);
    });

    const list = await apiGet('/api/my/signed-submissions');
    const items = Array.isArray(list && list.items) ? list.items : [];
    const limited = items.slice(0, 50); // guardrail

    for(const item of limited){
      const serviceSlug = item.service_slug;
      const fileName = item.file_name;
      const key = `${serviceSlug}::${fileName}`;
      const prev = existingByKey.get(key);
      const prevSignedAt = prev && prev.data ? prev.data.__signedAt : null;
      if(prevSignedAt && item.signed_at && String(prevSignedAt) === String(item.signed_at)){
        continue; // already up to date
      }

      const blob = await fetchSignedPdfBlobForMe(item.id);
      window.archiveDocument({
        serviceSlug,
        serviceName: serviceNameFromSlug(serviceSlug),
        userName: me.name || '',
        data: {
          ...(prev && prev.data ? prev.data : {}),
          __signedSubmissionId: item.id,
          __signedAt: item.signed_at || null,
          __signedDate: item.signed_date || null
        },
        fileName,
        pdfBlob: blob
      });
    }

    return { ok: true };
  }

  window.syncSignedSubmissionsToArchive = syncSignedSubmissionsToArchive;

  // ===== Arsip Dokumen badge count (Home) =====
  function getLocalArchiveEntriesSafe(){
    try {
      if(typeof window.getArchiveEntries !== 'function') return [];
      const entries = window.getArchiveEntries();
      return Array.isArray(entries) ? entries : [];
    } catch (e){
      return [];
    }
  }

  function getLocalLinkedSubmissionIds(){
    const entries = getLocalArchiveEntriesSafe();
    const ids = new Set();
    for(const entry of entries){
      if(!entry) continue;
      if(entry.submissionId != null) ids.add(String(entry.submissionId));
      const signedId = entry.data ? entry.data.__signedSubmissionId : null;
      if(signedId != null) ids.add(String(signedId));
    }
    return ids;
  }

  async function computeRemoteArsipCount(){
    // Merge local archive entries + server submissions that are not yet represented locally.
    const token = getToken();
    if(!token) return null;

    const localEntries = getLocalArchiveEntriesSafe();
    const linkedIds = getLocalLinkedSubmissionIds();
    const remoteUnique = new Set();

    try {
      const signedRes = await apiGet('/api/my/signed-submissions');
      const signedItems = Array.isArray(signedRes && signedRes.items) ? signedRes.items : [];
      for(const item of signedItems){
        const id = item && item.id != null ? String(item.id) : '';
        if(!id) continue;
        if(!linkedIds.has(id)) remoteUnique.add(id);
      }

      for(const st of ['pending', 'rejected']){
        const res = await apiGet(`/api/my/submissions?status=${encodeURIComponent(st)}`);
        const items = Array.isArray(res && res.items) ? res.items : [];
        for(const item of items){
          const id = item && item.id != null ? String(item.id) : '';
          if(!id) continue;
          if(!linkedIds.has(id)) remoteUnique.add(id);
        }
      }

      return localEntries.length + remoteUnique.size;
    } catch (e){
      return null;
    }
  }

  function ensureArsipBadgeElement(){
    let badge = document.getElementById('arsipBadge');
    if(badge) return badge;

    // Some home variants might not have the badge element in markup.
    const host =
      document.querySelector('[onclick*="arsip-dokumen.html"]') ||
      document.querySelector('a[href$="arsip-dokumen.html"], a[href*="arsip-dokumen.html"]');
    if(!host) return null;

    badge = document.createElement('span');
    badge.id = 'arsipBadge';
    badge.className = 'badge badge-success cat-badge cat-badge-circle';
    badge.hidden = true;

    // Ensure the host can position the badge.
    if(host instanceof HTMLElement){
      const stylePos = host.style && host.style.position;
      if(!stylePos) host.style.position = 'relative';
    }

    host.appendChild(badge);
    return badge;
  }

  function setArsipBadgeValue(badge, count){
    if(!badge) return;
    if(count > 0){
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.hidden = false;
      badge.setAttribute('aria-label', `Arsip Dokumen: ${badge.textContent} dokumen`);
      return;
    }

    badge.textContent = '';
    badge.hidden = true;
    badge.removeAttribute('aria-label');
  }

  async function updateArsipBadgeCount(){
    const badge = ensureArsipBadgeElement();
    if(!badge) return { ok: false, skipped: true };

    // Fast path: show local count immediately.
    const localCount = getLocalArchiveEntriesSafe().length;
    setArsipBadgeValue(badge, localCount);

    // Background refresh: include server submissions too.
    if(badge.dataset && badge.dataset.remoteInFlight === '1'){
      return { ok: true, count: localCount, pendingRemote: true };
    }

    if(badge.dataset) badge.dataset.remoteInFlight = '1';
    Promise.resolve()
      .then(() => computeRemoteArsipCount())
      .then((remoteTotal) => {
        if(remoteTotal == null) return;
        setArsipBadgeValue(badge, remoteTotal);
      })
      .catch(() => {})
      .finally(() => {
        if(badge.dataset) delete badge.dataset.remoteInFlight;
      });

    return { ok: true, count: localCount };
  }

  window.updateArsipBadgeCount = updateArsipBadgeCount;

  // Auto-run badge update on Home page (user) so it behaves like admin-home badges.
  try {
    document.addEventListener('DOMContentLoaded', () => {
      try {
        const page = getCurrentPageName && getCurrentPageName();
        if(page !== 'home.html') return;
        if(typeof window.updateArsipBadgeCount !== 'function') return;
        // Run immediately + once shortly after.
        Promise.resolve().then(() => window.updateArsipBadgeCount()).catch(()=>{});
        setTimeout(() => {
          try { window.updateArsipBadgeCount && window.updateArsipBadgeCount(); } catch(e) {}
        }, 900);
      } catch (e) {
        // ignore
      }
    });
  } catch (e) {
    // ignore
  }

  // Admin workflow helpers
  window.publishSubmissionToServer = publishSubmissionToServer;
  window.syncSignedSubmissionsToArchive = syncSignedSubmissionsToArchive;
 