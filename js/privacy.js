(() => {
  const COUNTER_ID = 111279263;
  const STORAGE_KEY = 'zs_cookie_choice_v1';
  const DISABLE_KEY = `disableYaCounter${COUNTER_ID}`;
  let metrikaLoaded = false;

  const safeGet = () => {
    try { return localStorage.getItem(STORAGE_KEY); } catch (_) { return null; }
  };

  const safeSet = value => {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (_) {}
  };

  const loadMetrika = () => {
    if (metrikaLoaded) return;
    metrikaLoaded = true;
    window[DISABLE_KEY] = false;

    (function(m,e,t,r,i,k,a){
      m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
      m[i].l=1*new Date();
      for (let j = 0; j < document.scripts.length; j += 1) {
        if (document.scripts[j].src === r) return;
      }
      k=e.createElement(t); a=e.getElementsByTagName(t)[0];
      k.async=1; k.src=r; a.parentNode.insertBefore(k,a);
    })(window, document, 'script', `https://mc.yandex.ru/metrika/tag.js?id=${COUNTER_ID}`, 'ym');

    ym(COUNTER_ID, 'init', {
      ssr: true,
      webvisor: true,
      clickmap: true,
      ecommerce: 'dataLayer',
      referrer: document.referrer,
      url: location.href,
      accurateTrackBounce: true,
      trackLinks: true
    });
  };

  const clearMetrikaCookies = () => {
    const names = document.cookie.split(';').map(part => part.split('=')[0].trim()).filter(Boolean);
    names.filter(name => name.startsWith('_ym_') || name === 'yandexuid' || name === 'ymex').forEach(name => {
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      document.cookie = `${name}=; Max-Age=0; path=/; domain=.dezlatasign.ru; SameSite=Lax`;
    });
    try {
      Object.keys(localStorage).filter(key => key.startsWith('_ym')).forEach(key => localStorage.removeItem(key));
    } catch (_) {}
  };

  const stopMetrika = () => {
    window[DISABLE_KEY] = true;
    if (typeof window.ym === 'function') {
      try { window.ym(COUNTER_ID, 'destruct'); } catch (_) {}
    }
    clearMetrikaCookies();
    metrikaLoaded = false;
  };

  const styles = document.createElement('style');
  styles.textContent = `
    .cookie-consent {
      position: fixed;
      left: clamp(14px, 2vw, 28px);
      right: clamp(14px, 2vw, 28px);
      bottom: clamp(14px, 2vw, 28px);
      z-index: 1300;
      max-width: 900px;
      margin-left: auto;
      padding: clamp(18px, 2.2vw, 28px);
      border: 1px solid var(--ink, #474135);
      border-radius: var(--radius, 22px);
      color: var(--ink, #474135);
      background: rgba(239,242,221,.97);
      box-shadow: 0 24px 70px rgba(71,65,53,.18);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      opacity: 0;
      transform: translateY(18px);
      pointer-events: none;
      transition: opacity .25s ease, transform .25s ease;
    }
    .cookie-consent.is-visible { opacity: 1; transform: none; pointer-events: auto; }
    .cookie-consent__grid { display: grid; grid-template-columns: 1fr auto; gap: clamp(18px, 3vw, 40px); align-items: end; }
    .cookie-consent__copy { max-width: 620px; }
    .cookie-consent h2 { margin: 0; font: 700 clamp(22px, 2.5vw, 34px)/1.02 var(--font-display, Onest, sans-serif); letter-spacing: -.035em; }
    .cookie-consent p { margin: 0; color: var(--muted, #474135); font: 400 clamp(13px, 1.1vw, 15px)/1.5 var(--font-body, Inter, sans-serif); }
    .cookie-consent a { text-decoration: underline; text-underline-offset: 3px; }
    .cookie-consent__actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .cookie-consent__button { min-height: 44px; padding: 0 16px; border: 1px solid var(--ink, #474135); border-radius: 999px; background: transparent; cursor: pointer; font: 600 12px/1 var(--font-body, Inter, sans-serif); transition: transform .18s ease, background .18s ease, color .18s ease; }
    .cookie-consent__button:hover, .cookie-consent__button:focus-visible { transform: translateY(-1px); outline: none; }
    .cookie-consent__button--accept { border-color: var(--accent, #e8ee74); color: var(--ink, #474135); background: var(--accent, #e8ee74); }
    .cookie-settings-link { border: 0; padding: 0; color: inherit; background: transparent; cursor: pointer; font: inherit; text-decoration: underline; text-underline-offset: 3px; }
    .contact__footer .cookie-legal-links { display: inline-flex; gap: 14px; align-items: center; flex-wrap: wrap; }
    @media (max-width: 720px) {
      .cookie-consent { left: 10px; right: 10px; bottom: 10px; padding: 18px; border-radius: 18px; }
      .cookie-consent__grid { grid-template-columns: 1fr; align-items: stretch; }
      .cookie-consent__actions { justify-content: flex-start; }
      .cookie-consent__button { flex: 1 1 auto; }
    }
    @media (prefers-reduced-motion: reduce) { .cookie-consent { transition: none; } }
  `;
  document.head.appendChild(styles);

  let banner = null;

  const hideBanner = () => {
    if (!banner) return;
    banner.classList.remove('is-visible');
    window.setTimeout(() => { banner?.remove(); banner = null; }, 260);
  };

  const showBanner = () => {
    if (banner) { banner.classList.add('is-visible'); return; }
    banner = document.createElement('section');
    banner.className = 'cookie-consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Уведомление о cookie');
    banner.innerHTML = `
      <div class="cookie-consent__grid">
        <div class="cookie-consent__copy">
          <h2>Мы используем куки</h2>
        </div>
        <div class="cookie-consent__actions">
          <button class="cookie-consent__button cookie-consent__button--accept" type="button" data-cookie-accept>Ясно</button>
        </div>
      </div>`;
    document.body.appendChild(banner);

    banner.querySelector('[data-cookie-accept]')?.addEventListener('click', () => {
      safeSet('accepted');
      loadMetrika();
      hideBanner();
    });

    requestAnimationFrame(() => banner?.classList.add('is-visible'));
  };

  const addFooterLinks = () => {
    document.querySelectorAll('.contact__footer').forEach(footer => {
      if (footer.querySelector('.cookie-legal-links')) return;
      const group = document.createElement('span');
      group.className = 'cookie-legal-links';
      group.innerHTML = '<a href="/privacy/">Политика данных</a><button class="cookie-settings-link" type="button" data-cookie-settings>Настройки cookie</button>';
      const topLink = [...footer.querySelectorAll('a')].find(link => link.getAttribute('href') === '#top');
      if (topLink) footer.insertBefore(group, topLink);
      else footer.appendChild(group);
    });
  };

  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-cookie-settings]');
    if (!trigger) return;
    event.preventDefault();
    showBanner();
  });

  window[DISABLE_KEY] = true;
  const choice = safeGet();
  if (choice === 'accepted') loadMetrika();
  else if (choice !== 'declined') showBanner();

  addFooterLinks();
})();
