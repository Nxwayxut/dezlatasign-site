(() => {
  const findGallery = title => [...document.querySelectorAll('[data-gallery]')].find(item => {
    return item.querySelector('h3')?.textContent?.trim() === title;
  });

  const featuredProjects = document.querySelector('#identity .featured-projects');

  if (featuredProjects && !findGallery('Прудыкс')) {
    const prudyksGallery = document.createElement('article');
    prudyksGallery.className = 'gallery-card reveal is-visible';
    prudyksGallery.dataset.gallery = '';
    prudyksGallery.innerHTML = `
      <div class="gallery-card__viewport" data-gallery-viewport>
        <div class="gallery-card__track" data-gallery-track>
          ${Array.from({ length: 7 }, (_, i) => {
            const n = i + 1;
            const src = `../images/prudyks-${String(n).padStart(2, '0')}.webp`;
            return `<button class="gallery-card__slide" type="button" data-lightbox="${src}" aria-label="Увеличить изображение ${n} проекта Прудыкс"><img src="${src}" alt="Прудыкс — изображение проекта ${n}" width="842" height="595" loading="lazy"></button>`;
          }).join('')}
        </div>
        <button class="gallery-card__arrow gallery-card__arrow--prev" type="button" data-gallery-prev aria-label="Предыдущее изображение"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
        <button class="gallery-card__arrow gallery-card__arrow--next" type="button" data-gallery-next aria-label="Следующее изображение"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
        <div class="gallery-card__counter" aria-live="polite"><span data-gallery-current>1</span> / <span data-gallery-total>7</span></div>
      </div>
      <div class="gallery-card__caption">
        <div><span>Айдентика · городской концепт</span><h3>Прудыкс</h3></div>
        <p>Концепт айдентики Верхнего пруда Выксы</p>
      </div>
      <div class="gallery-card__dots" data-gallery-dots aria-label="Навигация по изображениям"></div>
    `;

    const bombGallery = findGallery('Bomb Coffee');
    const museumGallery = findGallery('Музей Выксы');
    if (bombGallery) featuredProjects.appendChild(bombGallery);
    featuredProjects.appendChild(prudyksGallery);
    if (museumGallery) featuredProjects.appendChild(museumGallery);
  }

  const ensureSectionGallery = ({ sectionId, title, eyebrow, description, slug, total, width, height }) => {
    const section = document.querySelector(`#${sectionId}`);
    if (!section || section.querySelector('[data-gallery]')) return;

    const placeholder = section.querySelector('.empty-category');
    const gallery = document.createElement('article');
    gallery.className = 'gallery-card gallery-card--natural reveal is-visible';
    gallery.dataset.gallery = '';

    const slides = Array.from({ length: total }, (_, i) => {
      const n = i + 1;
      const src = `../images/${slug}-${String(n).padStart(2, '0')}.webp`;
      return `
        <button class="gallery-card__slide" type="button" data-lightbox="${src}" aria-label="Увеличить изображение ${n} проекта ${title}">
          <img src="${src}" alt="${description} — изображение ${n}" width="${width}" height="${height}" loading="lazy" style="display:block;width:100%;max-width:100%;height:auto;aspect-ratio:auto;object-fit:contain;object-position:center;">
        </button>`;
    }).join('');

    gallery.innerHTML = `
      <div class="gallery-card__viewport" data-gallery-viewport>
        <div class="gallery-card__track" data-gallery-track>${slides}</div>
        <button class="gallery-card__arrow gallery-card__arrow--prev" type="button" data-gallery-prev aria-label="Предыдущее изображение"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
        <button class="gallery-card__arrow gallery-card__arrow--next" type="button" data-gallery-next aria-label="Следующее изображение"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
        <div class="gallery-card__counter" aria-live="polite"><span data-gallery-current>1</span> / <span data-gallery-total>${total}</span></div>
      </div>
      <div class="gallery-card__caption">
        <div><span>${eyebrow}</span><h3>${title}</h3></div>
        <p>${description}</p>
      </div>
      <div class="gallery-card__dots" data-gallery-dots aria-label="Навигация по изображениям"></div>
    `;

    if (placeholder) placeholder.replaceWith(gallery);
    else section.appendChild(gallery);
  };

  ensureSectionGallery({
    sectionId: 'digital',
    title: 'MND',
    eyebrow: 'Digital-дизайн · социальные сети',
    description: 'Оформление соцсетей для бренда украшений MND',
    slug: 'mnd-digital',
    total: 2,
    width: 1600,
    height: 1130
  });

  ensureSectionGallery({
    sectionId: 'merch',
    title: 'Ples Open 2026',
    eyebrow: 'Мерч · баскетбольный турнир',
    description: 'Принт для призовых футболок баскетбольного турнира',
    slug: 'ples-open-merch',
    total: 2,
    width: 1600,
    height: 1130
  });

  const hydrateGallery = ({ title, slug, width, height, total }) => {
    const gallery = findGallery(title);
    const track = gallery?.querySelector('[data-gallery-track]');
    if (!track) return;

    const existingSlides = [...track.querySelectorAll('.gallery-card__slide')];
    existingSlides.forEach((slide, index) => {
      const imageNumber = index + 1;
      if (imageNumber > total) {
        slide.remove();
        return;
      }
      const src = `../images/${slug}-${String(imageNumber).padStart(2, '0')}.webp`;
      slide.dataset.lightbox = src;
      slide.setAttribute('aria-label', `Открыть ${title}, изображение ${imageNumber}`);
      const image = slide.querySelector('img');
      if (image) {
        image.src = src;
        image.alt = `${title} — изображение проекта ${imageNumber}`;
        image.width = width;
        image.height = height;
      }
    });

    const currentSlides = [...track.querySelectorAll('.gallery-card__slide')];
    for (let imageIndex = currentSlides.length + 1; imageIndex <= total; imageIndex += 1) {
      const src = `../images/${slug}-${String(imageIndex).padStart(2, '0')}.webp`;
      const slide = document.createElement('button');
      slide.className = 'gallery-card__slide';
      slide.type = 'button';
      slide.dataset.lightbox = src;
      slide.setAttribute('aria-label', `Открыть ${title}, изображение ${imageIndex}`);

      const image = document.createElement('img');
      image.src = src;
      image.alt = `${title} — изображение проекта ${imageIndex}`;
      image.width = width;
      image.height = height;
      image.loading = 'lazy';

      slide.appendChild(image);
      track.appendChild(slide);
    }
  };

  hydrateGallery({ title: 'Bomb Coffee', slug: 'bomb-coffee', width: 1800, height: 1273, total: 6 });
  hydrateGallery({ title: 'Прудыкс', slug: 'prudyks', width: 842, height: 595, total: 7 });
  hydrateGallery({ title: 'Музей Выксы', slug: 'museum-vyksa', width: 1600, height: 1131, total: 6 });

  const dialog = document.querySelector('[data-lightbox-dialog]');
  const dialogImage = document.querySelector('[data-lightbox-image]');

  document.querySelectorAll('[data-gallery]').forEach(gallery => {
    const track = gallery.querySelector('[data-gallery-track]');
    const viewport = gallery.querySelector('[data-gallery-viewport]');
    const slides = Array.from(gallery.querySelectorAll('.gallery-card__slide'));
    const previous = gallery.querySelector('[data-gallery-prev]');
    const next = gallery.querySelector('[data-gallery-next]');
    const currentLabel = gallery.querySelector('[data-gallery-current]');
    const totalLabel = gallery.querySelector('[data-gallery-total]');
    const dotsContainer = gallery.querySelector('[data-gallery-dots]');
    if (!track || !viewport || slides.length === 0) return;

    let index = 0;
    let pointerStartX = null;

    if (totalLabel) totalLabel.textContent = String(slides.length);
    if (dotsContainer) dotsContainer.innerHTML = '';

    const dots = slides.map((slide, dotIndex) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'gallery-card__dot';
      dot.setAttribute('aria-label', `Показать изображение ${dotIndex + 1}`);
      dot.addEventListener('click', () => goTo(dotIndex));
      dotsContainer?.append(dot);

      if (!slide.dataset.lightboxBound) {
        slide.dataset.lightboxBound = 'true';
        slide.addEventListener('click', () => {
          if (!dialog || !dialogImage || !slide.dataset.lightbox) return;
          dialogImage.src = slide.dataset.lightbox;
          if (!dialog.open) dialog.showModal();
        });
      }
      return dot;
    });

    const update = () => {
      track.style.transform = `translate3d(-${index * 100}%, 0, 0)`;
      if (currentLabel) currentLabel.textContent = String(index + 1);
      slides.forEach((slide, slideIndex) => {
        const active = slideIndex === index;
        slide.setAttribute('aria-hidden', String(!active));
        slide.tabIndex = active ? 0 : -1;
      });
      dots.forEach((dot, dotIndex) => {
        const active = dotIndex === index;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-current', active ? 'true' : 'false');
      });
    };

    function goTo(newIndex) {
      index = (newIndex + slides.length) % slides.length;
      update();
    }

    previous?.addEventListener('click', event => {
      event.stopPropagation();
      goTo(index - 1);
    });
    next?.addEventListener('click', event => {
      event.stopPropagation();
      goTo(index + 1);
    });

    viewport.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      pointerStartX = event.clientX;
    });
    viewport.addEventListener('pointerup', event => {
      if (pointerStartX === null) return;
      const delta = event.clientX - pointerStartX;
      pointerStartX = null;
      if (Math.abs(delta) < 45) return;
      goTo(delta < 0 ? index + 1 : index - 1);
    });
    viewport.addEventListener('pointercancel', () => { pointerStartX = null; });

    update();
  });

  const loopingVideos = [...document.querySelectorAll('#digital video[autoplay][loop]')];
  if (loopingVideos.length) {
    const tryPlay = video => {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      const playPromise = video.play();
      if (playPromise?.catch) playPromise.catch(() => {});
    };

    const videoObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.2 && !document.hidden) {
          tryPlay(video);
        } else {
          video.pause();
        }
      });
    }, { threshold: [0, 0.2, 0.5] });

    loopingVideos.forEach(video => {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.addEventListener('loadeddata', () => {
        const rect = video.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < window.innerHeight && !document.hidden) tryPlay(video);
      }, { once: true });
      videoObserver.observe(video);
    });

    document.addEventListener('visibilitychange', () => {
      loopingVideos.forEach(video => {
        if (document.hidden) {
          video.pause();
          return;
        }
        const rect = video.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < window.innerHeight) tryPlay(video);
      });
    });
  }
})();