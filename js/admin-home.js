(function(){
  async function ensureAdmin(){
    try {
      await apiGet('/api/admin/counts');
      return true;
    } catch (e){
      navigateWithFade('login.html');
      return false;
    }
  }

  function setBadge(serviceSlug, count){
    const el = document.querySelector(`[data-badge-for="${serviceSlug}"]`);
    if(!el) return;
    const n = Number(count || 0) || 0;
    if(n <= 0){
      el.hidden = true;
      el.textContent = '0';
      return;
    }
    el.hidden = false;
    el.textContent = String(n);
  }

  async function loadCounts(){
    try {
      const res = await apiGet('/api/admin/counts');
      const counts = (res && res.counts) ? res.counts : {};
      const services = ['skkp','pb','pengadaan-es','stblkk','shti-lt','jasa-listrik','penggunaan-arra'];
      services.forEach(slug => setBadge(slug, counts[slug] || 0));

      // Load admin archive count (signed documents)
      const arsipRes = await apiGet('/api/admin/submissions?status=signed');
      const arsipCount = Array.isArray(arsipRes && arsipRes.items) ? arsipRes.items.length : 0;
      const arsipBadge = document.getElementById('arsipAdminBadge');
      if(arsipBadge){
        if(arsipCount > 0){
          arsipBadge.hidden = false;
          arsipBadge.textContent = String(arsipCount);
        } else {
          arsipBadge.hidden = true;
        }
      }
    } catch (e){
      // ignore
    }
  }

  function hydrateAdminHeader(){
    const current = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if(current && current.name){
      const greeting = document.getElementById('greeting');
      if(greeting) greeting.textContent = `Hi, ${current.name.split(' ')[0]}!`;

      if(current.avatar){
        const img = document.getElementById('avatarImage');
        const ph = document.getElementById('avatarPlaceholder');
        if(img && ph){
          img.src = current.avatar;
          img.style.display = 'block';
          ph.style.display = 'none';
        }
      }
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const ok = await ensureAdmin();
    if(!ok) return;

    try {
      const me = await apiGet('/api/me');
      const user = me && me.success ? me.data : null;
      if(user) localStorage.setItem('currentUser', JSON.stringify(user));
    } catch (e) {}

    hydrateAdminHeader();
    await loadCounts();

    const logoutBtn = document.getElementById('logoutBtn');
    if(logoutBtn){
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('token');
        navigateWithFade('login.html');
      });
    }
  });
})();
