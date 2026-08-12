(() => {
  const bombGallery = [...document.querySelectorAll('[data-gallery]')].find(gallery => {
    const title = gallery.querySelector('h3')?.textContent?.trim();
    return title === 'Bomb Coffee';
  });

  const bombTrack = bombGallery?.querySelector('[data-gallery-track]');
  if (bombTrack) {
    const existingSlides = [...bombTrack.querySelectorAll('.gallery-card__slide')];

    existingSlides.slice(0, 3).forEach((slide, index) => {
      const imageNumber = index + 1;
      const src = `../images/bomb-coffee-0${imageNumber}.webp`;
      slide.dataset.lightbox = src;
      slide.setAttribute('aria-label', `Открыть Bomb Coffee, изображение ${imageNumber}`);
      const image = slide.querySelector('img');
      if (image) {
        image.src = src;
        image.alt = `Bomb Coffee — изображение проекта ${imageNumber}`;
        image.width = 1800;
        image.height = 1273;
      }
    });

    for (let imageIndex = 4; imageIndex <= 6; imageIndex += 1) {
      const src = `../images/bomb-coffee-0${imageIndex}.webp`;
      if (bombTrack.querySelector(`[data-lightbox="${src}"]`)) continue;

      const slide = document.createElement('button');
      slide.className = 'gallery-card__slide';
      slide.type = 'button';
      slide.dataset.lightbox = src;
      slide.setAttribute('aria-label', `Открыть Bomb Coffee, изображение ${imageIndex}`);

      const image = document.createElement('img');
      image.src = src;
      image.alt = `Bomb Coffee — изображение проекта ${imageIndex}`;
      image.width = 1800;
      image.height = 1273;
      image.loading = 'lazy';

      slide.appendChild(image);
      bombTrack.appendChild(slide);
    }
  }

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

    const dots = slides.map((_, dotIndex) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'gallery-card__dot';
      dot.setAttribute('aria-label', `Показать изображение ${dotIndex + 1}`);
      dot.addEventListener('click', () => goTo(dotIndex));
      dotsContainer?.append(dot);
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

    previous?.addEventListener('click', () => goTo(index - 1));
    next?.addEventListener('click', () => goTo(index + 1));

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
})();
