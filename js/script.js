(() => {
  const preloader = document.querySelector('.preloader');
  const header = document.querySelector('[data-header]');
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-menu]');
  const year = document.querySelector('[data-year]');
  const menuToggleLabel = menuToggle?.querySelector('.sr-only');

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
    if (menuToggleLabel) menuToggleLabel.textContent = 'Закрыть меню';
    menu?.classList.add('is-open');
    document.body.classList.add('menu-open');
    document.addEventListener('touchmove', preventMenuTouchScroll, { passive: false });
  };

  const closeMenu = ({ restoreScroll = true } = {}) => {
    menuToggle?.setAttribute('aria-expanded', 'false');
    if (menuToggleLabel) menuToggleLabel.textContent = 'Открыть меню';
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

  let lightboxScrollY = 0;
  let lightboxScale = 1;
  let lightboxX = 0;
  let lightboxY = 0;
  let pinchStartDistance = 0;
  let pinchStartScale = 1;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let lastTapAt = 0;
  let pointerMoved = false;
  const activePointers = new Map();

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const applyLightboxTransform = () => {
    if (!dialogImage) return;
    dialogImage.style.transform = `translate3d(${lightboxX}px, ${lightboxY}px, 0) scale(${lightboxScale})`;
    dialogImage.classList.toggle('is-zoomed', lightboxScale > 1.01);
  };

  const resetLightboxTransform = () => {
    lightboxScale = 1;
    lightboxX = 0;
    lightboxY = 0;
    activePointers.clear();
    pinchStartDistance = 0;
    pointerMoved = false;
    if (dialogImage) {
      dialogImage.classList.remove('is-dragging', 'is-zoomed');
      dialogImage.style.transform = '';
    }
  };

  const setLightboxScale = nextScale => {
    lightboxScale = clamp(nextScale, 1, 4);
    if (lightboxScale === 1) {
      lightboxX = 0;
      lightboxY = 0;
    }
    applyLightboxTransform();
  };

  const setLightboxLock = isOpen => {
    document.documentElement.classList.toggle('lightbox-open', isOpen);
    document.body.classList.toggle('lightbox-open', isOpen);

    if (isOpen) {
      lightboxScrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${lightboxScrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      return;
    }

    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, lightboxScrollY);
  };

  const getPointerDistance = () => {
    const points = [...activePointers.values()];
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };

  document.querySelectorAll('[data-lightbox]').forEach(button => {
    button.addEventListener('click', () => {
      if (!dialog || !dialogImage) return;
      resetLightboxTransform();
      dialogImage.src = button.dataset.lightbox;
      setLightboxLock(true);
      dialog.showModal();
    });
  });

  dialogImage?.addEventListener('wheel', event => {
    if (!dialog?.open) return;
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    setLightboxScale(lightboxScale + direction * 0.25);
  }, { passive: false });

  dialogImage?.addEventListener('dblclick', event => {
    event.preventDefault();
    setLightboxScale(lightboxScale > 1 ? 1 : 2);
  });

  dialogImage?.addEventListener('pointerdown', event => {
    event.preventDefault();
    pointerMoved = false;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dialogImage.setPointerCapture?.(event.pointerId);
    dialogImage.classList.add('is-dragging');

    if (activePointers.size === 1) {
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
    } else if (activePointers.size === 2) {
      pinchStartDistance = getPointerDistance();
      pinchStartScale = lightboxScale;
    }
  });

  dialogImage?.addEventListener('pointermove', event => {
    if (!activePointers.has(event.pointerId)) return;
    event.preventDefault();

    const previous = activePointers.get(event.pointerId);
    if (Math.abs(event.clientX - previous.x) > 2 || Math.abs(event.clientY - previous.y) > 2) {
      pointerMoved = true;
    }
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointers.size >= 2) {
      const distance = getPointerDistance();
      if (pinchStartDistance > 0) {
        setLightboxScale(pinchStartScale * (distance / pinchStartDistance));
      }
      return;
    }

    if (lightboxScale > 1) {
      lightboxX += event.clientX - lastPointerX;
      lightboxY += event.clientY - lastPointerY;
      applyLightboxTransform();
    }

    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
  });

  const finishPointer = event => {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.delete(event.pointerId);
    dialogImage?.releasePointerCapture?.(event.pointerId);

    if (event.pointerType === 'touch' && !pointerMoved) {
      const now = Date.now();
      if (now - lastTapAt < 320) {
        setLightboxScale(lightboxScale > 1 ? 1 : 2);
        lastTapAt = 0;
      } else {
        lastTapAt = now;
      }
    }

    if (activePointers.size === 1) {
      const remaining = [...activePointers.values()][0];
      lastPointerX = remaining.x;
      lastPointerY = remaining.y;
    } else if (activePointers.size === 0) {
      dialogImage?.classList.remove('is-dragging');
      pinchStartDistance = 0;
    }
  };

  dialogImage?.addEventListener('pointerup', finishPointer);
  dialogImage?.addEventListener('pointercancel', finishPointer);

  const closeDialog = () => {
    if (dialog?.open) dialog.close();
  };

  closeButton?.addEventListener('click', closeDialog);
  dialog?.addEventListener('close', () => {
    setLightboxLock(false);
    resetLightboxTransform();
    if (dialogImage) dialogImage.src = '';
  });
  dialog?.addEventListener('click', event => {
    if (event.target === dialog) closeDialog();
  });
})();
