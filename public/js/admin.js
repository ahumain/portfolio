(function(){
  const links = document.querySelectorAll('.admin-sidebar .nav-link');
  const cards = document.querySelectorAll('.card');
  const toast = document.getElementById('toast');
  function show(section){
    links.forEach(l=>l.classList.toggle('active', l.dataset.target===section));
    cards.forEach(c=>c.classList.toggle('hidden', c.dataset.section!==section));
  }
  function notify(msg){
    if(!toast) return; toast.textContent = msg; toast.classList.remove('hidden');
    setTimeout(()=>toast.classList.add('hidden'), 2200);
  }
  links.forEach(l=>l.addEventListener('click', e=>{ e.preventDefault(); show(l.dataset.target); history.replaceState(null,'',`#${l.dataset.target}`); }))
  const hash = (location.hash||'').replace('#',''); if(hash) show(hash);
  document.querySelectorAll('.form').forEach(form=>{
    form.addEventListener('submit', async (e)=>{
      // Progressive enhancement: try AJAX, fallback to normal POST
      if (e.submitter && e.submitter.hasAttribute('formnovalidate')) return;
      e.preventDefault();
      const action = form.getAttribute('action');
      const method = form.getAttribute('method')||'post';
      const body = new URLSearchParams(new FormData(form));
      try {
        const res = await fetch(action, { method, headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' }, body });
        if (res.ok) {
          notify('Enregistré');
          // refresh basic lists if endpoint returns data
          const ct = res.headers.get('content-type')||'';
          if (ct.includes('application/json')) {
            const json = await res.json();
            if (json.reload) location.reload();
          }
        } else {
          notify('Erreur');
        }
      } catch { notify('Erreur réseau'); }
    });
  });

  // Checkbox dropdown for categories
  document.querySelectorAll('[data-dd]').forEach(dd => {
    const toggle = dd.querySelector('[data-dd-toggle]');
    const menu = dd.querySelector('[data-dd-menu]');
    const hidden = dd.querySelector('input[type="hidden"][name="categoryIds"]');
    const countEl = dd.querySelector('[data-dd-count]');
    if (!toggle || !menu || !hidden) return;
    function syncHidden(){
      const ids = Array.from(menu.querySelectorAll('input[type="checkbox"]:checked')).map(i=>i.value);
      hidden.value = ids.join(',');
      if (countEl) countEl.textContent = String(ids.length);
    }
    toggle.addEventListener('click', ()=>{
      menu.classList.toggle('hidden');
    });
    menu.addEventListener('change', syncHidden);
    document.addEventListener('click', (e)=>{
      if (!dd.contains(e.target)) menu.classList.add('hidden');
    });
  });

  // (no slider gauges; level is a numeric input)

  // Icon picker
  document.querySelectorAll('[data-icon-dd]').forEach(dd => {
    const toggle = dd.querySelector('[data-icon-toggle]');
    const menu = dd.querySelector('[data-icon-menu]');
    const input = dd.closest('form')?.querySelector('input[name="icon"]');
    if (!toggle || !menu || !input) return;
    toggle.addEventListener('click', ()=> menu.classList.toggle('hidden'));
    menu.addEventListener('click', (e)=>{
      const item = e.target.closest('.icon-item');
      if (!item) return;
      const val = item.getAttribute('data-icon-val');
      input.value = val;
      menu.classList.add('hidden');
    });
    document.addEventListener('click', (e)=>{ if (!dd.contains(e.target)) menu.classList.add('hidden'); });
  });

  // Image preview for project forms
  document.querySelectorAll('input[data-img-input]').forEach(inp => {
    const preview = inp.parentElement.querySelector('img[data-img-preview]') || inp.form?.querySelector('img[data-img-preview]');
    if (!preview) return;
    function sync(){ const v = inp.value.trim(); preview.src = v || '/images/placeholder-project.svg'; }
    inp.addEventListener('input', sync);
    sync();
  });
})();
