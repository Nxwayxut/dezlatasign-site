(() => {
  const preloader = document.querySelector('.preloader');
  const header = document.querySelector('[data-header]');
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-menu]');
  const year = document.querySelector('[data-year]');

  window.addEventListener('load', () => {
    window.setTimeout(() => preloader?.classList.add('is-hidden'), 250);
  });

  const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 24);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  let lockedScrollY = 0;

  const preventMenuTouchScroll = event => {
    if (document.body.classList.contains('menu-open')) event.preventDefault();
  };

  const openMenu = () => {
    lockedScrollY = window.scrollY;
    document.body.style.top = `-${lockedScrollY}px`;
    menuToggle?.setAttribute('aria-expanded', 'true');
    menu?.classList.add('is-open');
    document.body.classList.add('menu-open');
    document.addEventListener('touchmove', preventMenuTouchScroll, { passive: false });
  };

  const closeMenu = ({ restoreScroll = true } = {}) => {
    menuToggle?.setAttribute('aria-expanded', 'false');
    menu?.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    document.body.style.top = '';
    document.removeEventListener('touchmove', preventMenuTouchScroll);
    if (restoreScroll) window.scrollTo(0, lockedScrollY);
  };

  menuToggle?.addEventListener('click', () => {
    const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
    if (isOpen) closeMenu();
    else openMenu();
  });

  menu?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', event => {
      const href = link.getAttribute('href');
      if (!href?.startsWith('#')) {
        closeMenu();
        return;
      }

      const target = document.querySelector(href);
      if (!target) {
        closeMenu();
        return;
      }

      event.preventDefault();
      closeMenu({ restoreScroll: true });
      window.requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', href);
      });
    });
  });

  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenu();
  });

  if (year) year.textContent = new Date().getFullYear();

  const revealItems = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -50px' });
  revealItems.forEach(item => revealObserver.observe(item));

  const parallax = document.querySelector('[data-parallax]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (parallax && !reduceMotion) {
    window.addEventListener('pointermove', event => {
      const x = (event.clientX / window.innerWidth - 0.5) * 10;
      const y = (event.clientY / window.innerHeight - 0.5) * 10;
      parallax.style.translate = `${x}px ${y}px`;
    }, { passive: true });
  }

  const dialog = document.querySelector('[data-lightbox-dialog]');
  const dialogImage = document.querySelector('[data-lightbox-image]');
  const closeButton = document.querySelector('[data-lightbox-close]');

  document.querySelectorAll('[data-lightbox]').forEach(button => {
    button.addEventListener('click', () => {
      if (!dialog || !dialogImage) return;
      dialogImage.src = button.dataset.lightbox;
      dialog.showModal();
    });
  });

  const closeDialog = () => {
    if (dialog?.open) dialog.close();
    if (dialogImage) dialogImage.src = '';
  };
  closeButton?.addEventListener('click', closeDialog);
  dialog?.addEventListener('click', event => {
    if (event.target === dialog) closeDialog();
  });
})();
