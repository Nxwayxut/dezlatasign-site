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
  if ('IntersectionObserver' in window) {
    revealItems.forEach(item => {
      const rect = item.getBoundingClientRect();
      if (rect.top < window.innerHeight * 1.15) item.classList.add('is-visible');
    });

    document.documentElement.classList.add('reveal-enabled');

    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -50px' });

    revealItems.forEach(item => {
      if (!item.classList.contains('is-visible')) revealObserver.observe(item);
    });
  } else {
    revealItems.forEach(item => item.classList.add('is-visible'));
  }

  const parallax = document.querySelector('[data-parallax]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (parallax && !reduceMotion) {
    window.addEventListener('pointermove', event => {
      const x = (event.clientX / window.innerWidth - 0.5) * 10;
      const y = (event.clientY / window.innerHeight - 0.5) * 10;
      parallax.style.translate = `${x}px ${y}px`;
    }, { passive: true });
  }

  const projectGrid = document.querySelector('.project-grid');
  if (projectGrid) {
    const cards = [...projectGrid.querySelectorAll('.project-card')];

    if (cards.length >= 6) {
      const galleryStyles = document.createElement('style');
      galleryStyles.textContent = `
        .projects .project-grid { display: block; }
        .project-gallery { width: 100%; }
        .project-gallery + .project-gallery { margin-top: clamp(40px, 6vw, 84px); }
        .project-gallery__viewport { position: relative; width: 100%; overflow: hidden; border-radius: var(--radius); background: var(--paper); }
        .project-gallery .project-card { display: none; width: 100%; border-radius: 0; cursor: zoom-in; }
        .project-gallery .project-card.is-active { display: block; }
        .project-gallery .project-card img,
        .project-gallery .project-card--wide img { width: 100%; height: auto; aspect-ratio: 1.414 / 1; object-fit: contain; object-position: center; transform: none; filter: none; background: var(--paper); }
        .project-gallery .project-card:hover img { transform: none; filter: none; }
        .project-gallery .project-card__meta { display: none; }
        .project-gallery__arrow { position: absolute; top: 50%; z-index: 4; display: grid; place-items: center; width: clamp(48px, 4.6vw, 66px); height: clamp(48px, 4.6vw, 66px); padding: 0; border: 1px solid rgba(255,255,255,.72); border-radius: 50%; color: #fff; background: rgba(11,11,13,.58); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); font-size: clamp(22px, 2vw, 30px); line-height: 1; cursor: pointer; transform: translateY(-50%); transition: background .22s ease, color .22s ease, transform .22s ease; }
        .project-gallery__arrow:hover,
        .project-gallery__arrow:focus-visible { color: var(--ink); background: #fff; transform: translateY(-50%) scale(1.05); outline: none; }
        .project-gallery__arrow--prev { left: clamp(12px, 2vw, 28px); }
        .project-gallery__arrow--next { right: clamp(12px, 2vw, 28px); }
        .project-gallery__footer { display: flex; align-items: baseline; justify-content: space-between; gap: 24px; padding-top: 16px; }
        .project-gallery__title { margin: 0; font-family: var(--font-display); font-size: clamp(20px, 2vw, 30px); font-weight: 600; line-height: 1.1; }
        .project-gallery__counter { flex: 0 0 auto; color: rgba(255,255,255,.64); font-size: var(--small-size); font-weight: 600; letter-spacing: .1em; text-transform: uppercase; }
        @media (max-width: 700px) {
          .project-gallery + .project-gallery { margin-top: 46px; }
          .project-gallery__viewport { border-radius: 16px; }
          .project-gallery .project-card img,
          .project-gallery .project-card--wide img { aspect-ratio: 1.414 / 1; }
          .project-gallery__arrow { width: 44px; height: 44px; font-size: 22px; }
          .project-gallery__arrow--prev { left: 10px; }
          .project-gallery__arrow--next { right: 10px; }
          .project-gallery__footer { padding-top: 12px; }
          .project-gallery__title { font-size: 20px; }
        }
      `;
      document.head.appendChild(galleryStyles);

      const bombCards = cards.slice(0, 3);
      const museumCards = cards.slice(3, 6);

      const hydrateProjectCards = ({ projectCards, title, slug, width, height }) => {
        projectCards.forEach((card, index) => {
          const imageNumber = index + 1;
          const src = `images/${slug}-0${imageNumber}.webp`;
          card.dataset.lightbox = src;
          card.setAttribute('aria-label', `Открыть проект ${title}, изображение ${imageNumber}`);
          const image = card.querySelector('img');
          if (image) {
            image.src = src;
            image.alt = `${title} — изображение проекта ${imageNumber}`;
            image.width = width;
            image.height = height;
          }
        });

        for (let imageIndex = 4; imageIndex <= 6; imageIndex += 1) {
          const src = `images/${slug}-0${imageIndex}.webp`;
          const card = document.createElement('button');
          card.className = 'project-card reveal is-visible';
          card.type = 'button';
          card.dataset.lightbox = src;
          card.setAttribute('aria-label', `Открыть проект ${title}, изображение ${imageIndex}`);

          const image = document.createElement('img');
          image.src = src;
          image.alt = `${title} — изображение проекта ${imageIndex}`;
          image.width = width;
          image.height = height;
          image.loading = 'lazy';

          card.appendChild(image);
          projectCards.push(card);
        }
      };

      hydrateProjectCards({ projectCards: bombCards, title: 'Bomb Coffee', slug: 'bomb-coffee', width: 1800, height: 1273 });
      hydrateProjectCards({ projectCards: museumCards, title: 'Музей Выксы', slug: 'museum-vyksa', width: 1600, height: 1131 });

      const groups = [
        { title: 'Bomb Coffee', cards: bombCards },
        { title: 'Музей Выксы', cards: museumCards }
      ];

      projectGrid.innerHTML = '';

      groups.forEach(({ title, cards: groupCards }) => {
        const gallery = document.createElement('div');
        gallery.className = 'project-gallery';
        gallery.setAttribute('role', 'region');
        gallery.setAttribute('aria-label', `Галерея проекта ${title}`);

        const viewport = document.createElement('div');
        viewport.className = 'project-gallery__viewport';

        const prev = document.createElement('button');
        prev.className = 'project-gallery__arrow project-gallery__arrow--prev';
        prev.type = 'button';
        prev.setAttribute('aria-label', `Предыдущее изображение проекта ${title}`);
        prev.textContent = '←';

        const next = document.createElement('button');
        next.className = 'project-gallery__arrow project-gallery__arrow--next';
        next.type = 'button';
        next.setAttribute('aria-label', `Следующее изображение проекта ${title}`);
        next.textContent = '→';

        const footer = document.createElement('div');
        footer.className = 'project-gallery__footer';

        const heading = document.createElement('h3');
        heading.className = 'project-gallery__title';
        heading.textContent = title;

        const counter = document.createElement('span');
        counter.className = 'project-gallery__counter';
        footer.append(heading, counter);

        groupCards.forEach((card, index) => {
          card.classList.remove('project-card--wide');
          card.classList.add('project-gallery__slide');
          card.classList.toggle('is-active', index === 0);
          card.setAttribute('aria-hidden', index === 0 ? 'false' : 'true');
          card.tabIndex = index === 0 ? 0 : -1;
          viewport.appendChild(card);
        });

        viewport.append(prev, next);
        gallery.append(viewport, footer);
        projectGrid.appendChild(gallery);

        let current = 0;
        let touchStartX = 0;
        let touchStartY = 0;

        const showSlide = nextIndex => {
          current = (nextIndex + groupCards.length) % groupCards.length;
          groupCards.forEach((card, index) => {
            const active = index === current;
            card.classList.toggle('is-active', active);
            card.setAttribute('aria-hidden', active ? 'false' : 'true');
            card.tabIndex = active ? 0 : -1;
          });
          counter.textContent = `${current + 1} / ${groupCards.length}`;
        };

        prev.addEventListener('click', event => {
          event.stopPropagation();
          showSlide(current - 1);
        });
        next.addEventListener('click', event => {
          event.stopPropagation();
          showSlide(current + 1);
        });

        gallery.addEventListener('keydown', event => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            showSlide(current - 1);
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            showSlide(current + 1);
          }
        });

        viewport.addEventListener('touchstart', event => {
          if (event.touches.length !== 1) return;
          touchStartX = event.touches[0].clientX;
          touchStartY = event.touches[0].clientY;
        }, { passive: true });

        viewport.addEventListener('touchend', event => {
          if (!event.changedTouches.length) return;
          const dx = event.changedTouches[0].clientX - touchStartX;
          const dy = event.changedTouches[0].clientY - touchStartY;
          if (Math.abs(dx) < 45 || Math.abs(dx) <= Math.abs(dy)) return;
          showSlide(current + (dx < 0 ? 1 : -1));
        }, { passive: true });

        showSlide(0);
      });
    }
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

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-lightbox]');
    if (!button || !dialog || !dialogImage) return;
    resetLightboxTransform();
    dialogImage.src = button.dataset.lightbox;
    setLightboxLock(true);
    dialog.showModal();
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
    if (Math.abs(event.clientX - previous.x) > 2 || Math.abs(event.clientY - previous.y) > 2) pointerMoved = true;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointers.size >= 2) {
      const distance = getPointerDistance();
      if (pinchStartDistance > 0) setLightboxScale(pinchStartScale * (distance / pinchStartDistance));
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