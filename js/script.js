/**
 * HEAVENLY BY PENDABELLE — script.js
 * Menu mobile · Scroll animations · Filtre produits
 * Carousel témoignages · Commande WhatsApp · Newsletter
 */

'use strict';

/* ──────────────────────────────────────────────
   1. HEADER : sticky + nav active au scroll
─────────────────────────────────────────────── */
(function initHeader() {
  const header   = document.getElementById('header');
  const sections = document.querySelectorAll('section[id], footer[id]');
  const navLinks = document.querySelectorAll('.nav__link');

  function onScroll() {
    // Ombre header
    header.classList.toggle('scrolled', window.scrollY > 40);

    // Back-to-top
    const btt = document.getElementById('back-to-top');
    if (btt) {
      if (window.scrollY > 400) {
        btt.hidden = false;
      } else {
        btt.hidden = true;
      }
    }

    // Lien actif dans la nav
    let current = '';
    sections.forEach(section => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= 120 && rect.bottom >= 120) {
        current = section.getAttribute('id');
      }
    });
    navLinks.forEach(link => {
      link.classList.toggle(
        'active',
        link.getAttribute('href') === '#' + current
      );
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run once on load
})();


/* ──────────────────────────────────────────────
   2. MENU MOBILE (hamburger)
─────────────────────────────────────────────── */
(function initMobileMenu() {
  const hamburger  = document.getElementById('hamburger');
  const mobileNav  = document.getElementById('mobile-nav');
  const mobileLinks = document.querySelectorAll('.mobile-nav__link, .mobile-nav__cta');

  if (!hamburger || !mobileNav) return;

  function openMenu() {
    hamburger.classList.add('open');
    mobileNav.classList.add('open');
    hamburger.setAttribute('aria-expanded', 'true');
    mobileNav.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    hamburger.classList.remove('open');
    mobileNav.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    mobileNav.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function toggleMenu() {
    hamburger.classList.contains('open') ? closeMenu() : openMenu();
  }

  hamburger.addEventListener('click', toggleMenu);

  // Fermer au clic sur un lien
  mobileLinks.forEach(link => link.addEventListener('click', closeMenu));

  // Fermer avec Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMenu();
  });

  // Fermer au clic en dehors
  document.addEventListener('click', e => {
    if (
      mobileNav.classList.contains('open') &&
      !mobileNav.contains(e.target) &&
      !hamburger.contains(e.target)
    ) closeMenu();
  });
})();


/* ──────────────────────────────────────────────
   3. BACK TO TOP
─────────────────────────────────────────────── */
(function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();


/* ──────────────────────────────────────────────
   4. SCROLL ANIMATIONS (Intersection Observer)
─────────────────────────────────────────────── */
(function initReveal() {
  const revealEls = document.querySelectorAll('.reveal');
  if (!revealEls.length) return;

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Décalage progressif pour les enfants d'une même rangée
          const siblings = entry.target.parentElement
            ? Array.from(entry.target.parentElement.querySelectorAll('.reveal'))
            : [];
          const index = siblings.indexOf(entry.target);
          entry.target.style.transitionDelay = index > 0 ? `${index * 0.1}s` : '0s';

          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  revealEls.forEach(el => observer.observe(el));
})();


/* ──────────────────────────────────────────────
   5. FILTRE PRODUITS
─────────────────────────────────────────────── */
(function initProductFilter() {
  const tabs    = document.querySelectorAll('.filter-tab');
  const cards   = document.querySelectorAll('.product-card');

  if (!tabs.length || !cards.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Mettre à jour les onglets
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      const filter = tab.dataset.filter;

      // Filtrer les cartes avec animation
      cards.forEach(card => {
        const match = filter === 'all' || card.dataset.category === filter;
        if (match) {
          card.classList.remove('hidden');
          // Re-trigger reveal si la carte vient d'être cachée
          requestAnimationFrame(() => card.classList.add('visible'));
        } else {
          card.classList.add('hidden');
          card.classList.remove('visible');
        }
      });
    });
  });
})();


/* ──────────────────────────────────────────────
   6. CAROUSEL TÉMOIGNAGES
─────────────────────────────────────────────── */
(function initCarousel() {
  const track    = document.getElementById('carousel-track');
  const dotsWrap = document.getElementById('carousel-dots');
  const prevBtn  = document.getElementById('carousel-prev');
  const nextBtn  = document.getElementById('carousel-next');

  if (!track) return;

  const slides       = Array.from(track.children);
  let currentIndex   = 0;
  let autoScrollId   = null;
  let slidesPerView  = getSlidesPerView();

  // Créer les dots
  const totalDots = Math.ceil(slides.length / slidesPerView);
  let dots = [];

  function buildDots() {
    if (!dotsWrap) return;
    dotsWrap.innerHTML = '';
    dots = [];
    const count = Math.ceil(slides.length / getSlidesPerView());
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('button');
      dot.className = 'carousel__dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', `Aller au témoignage ${i + 1}`);
      dot.setAttribute('role', 'tab');
      dot.addEventListener('click', () => goTo(i));
      dotsWrap.appendChild(dot);
      dots.push(dot);
    }
  }

  function getSlidesPerView() {
    if (window.innerWidth <= 768)  return 1;
    if (window.innerWidth <= 1024) return 2;
    return 3;
  }

  function updateDots(index) {
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
  }

  function goTo(index) {
    const spv     = getSlidesPerView();
    const maxIdx  = Math.max(0, Math.ceil(slides.length / spv) - 1);
    currentIndex  = Math.max(0, Math.min(index, maxIdx));

    // Déplacer le track
    const slideWidth = track.parentElement.offsetWidth;
    const gap        = 24; // 1.5rem
    const offset     = currentIndex * (slideWidth + gap);
    track.style.transform = `translateX(-${offset}px)`;

    updateDots(currentIndex);
  }

  function next() {
    const spv    = getSlidesPerView();
    const maxIdx = Math.ceil(slides.length / spv) - 1;
    goTo(currentIndex < maxIdx ? currentIndex + 1 : 0);
  }

  function prev() {
    const spv    = getSlidesPerView();
    const maxIdx = Math.ceil(slides.length / spv) - 1;
    goTo(currentIndex > 0 ? currentIndex - 1 : maxIdx);
  }

  function startAuto() {
    stopAuto();
    autoScrollId = setInterval(next, 4500);
  }

  function stopAuto() {
    if (autoScrollId) clearInterval(autoScrollId);
    autoScrollId = null;
  }

  // Événements boutons
  if (prevBtn) prevBtn.addEventListener('click', () => { prev(); startAuto(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { next(); startAuto(); });

  // Touch / swipe
  let touchStartX = 0;
  track.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    stopAuto();
  }, { passive: true });
  track.addEventListener('touchend', e => {
    const delta = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 50) {
      delta > 0 ? next() : prev();
    }
    startAuto();
  }, { passive: true });

  // Pause au survol
  track.addEventListener('mouseenter', stopAuto);
  track.addEventListener('mouseleave', startAuto);

  // Recalcul au resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      slidesPerView = getSlidesPerView();
      buildDots();
      goTo(0);
      startAuto();
    }, 250);
  });

  // Init
  buildDots();
  goTo(0);
  startAuto();
})();


/* ──────────────────────────────────────────────
   7. FORMULAIRE COMMANDE
─────────────────────────────────────────────── */
(function initOrderForm() {
  const form      = document.getElementById('order-form');
  const submitBtn = document.getElementById('order-submit-btn');
  const feedback  = document.getElementById('order-feedback');
  if (!form || !submitBtn) return;

  const originalBtnHTML = submitBtn.innerHTML;

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const name     = form.querySelector('#customer-name').value.trim();
    const phone    = form.querySelector('#customer-phone').value.trim();
    const quantity = form.querySelector('#quantity').value;
    const delivery = form.querySelector('#delivery').value;
    const address  = form.querySelector('#address').value.trim();

    const selectedProducts = Array.from(
      form.querySelectorAll('input[name="products"]:checked')
    ).map(cb => cb.value);

    // Validation
    const errors = [];
    if (!name)                    errors.push('Votre nom complet est requis.');
    if (!phone)                   errors.push('Votre numéro de téléphone est requis.');
    if (!selectedProducts.length) errors.push('Veuillez sélectionner au moins un produit.');

    if (errors.length) {
      showFeedback('error', errors.join(' '));
      return;
    }

    // Envoi
    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours…';
    hideFeedback();

    try {
      const r = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          products: selectedProducts,
          quantity: parseInt(quantity) || 1,
          deliveryMode: delivery,
          address: address,
        }),
      });

      const data = await r.json();

      if (r.ok) {
        showFeedback('success',
          '✓ Commande enregistrée ! Notre équipe vous contactera sous peu pour confirmer.'
        );
        form.reset();
      } else {
        showFeedback('error', data.error || 'Une erreur est survenue. Veuillez réessayer.');
      }
    } catch {
      showFeedback('error', 'Connexion impossible. Vérifiez votre connexion et réessayez.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHTML;
    }
  });

  function showFeedback(type, msg) {
    if (!feedback) return;
    feedback.className = type === 'success' ? 'form-feedback form-feedback--success' : 'form-feedback form-feedback--error';
    feedback.textContent = msg;
    feedback.hidden = false;
    feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (type === 'success') setTimeout(hideFeedback, 9000);
  }

  function hideFeedback() {
    if (feedback) feedback.hidden = true;
  }
})();


/* ──────────────────────────────────────────────
   8. NEWSLETTER
─────────────────────────────────────────────── */
(function initNewsletter() {
  const form    = document.getElementById('newsletter-form');
  const success = document.getElementById('newsletter-success');
  if (!form || !success) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const email = form.querySelector('#newsletter-email').value.trim();
    if (!email || !email.includes('@')) {
      form.querySelector('#newsletter-email').focus();
      return;
    }

    // Simuler un envoi (intégrer votre API ici)
    form.querySelector('.newsletter__input-wrap').style.opacity = '.5';
    form.querySelector('.newsletter__input-wrap').style.pointerEvents = 'none';

    setTimeout(() => {
      success.hidden = false;
      form.reset();
      success.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 600);
  });
})();


/* ──────────────────────────────────────────────
   9. SMOOTH SCROLL pour tous les ancres internes
─────────────────────────────────────────────── */
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();


/* ──────────────────────────────────────────────
   10. LAZY LOADING images (fallback)
─────────────────────────────────────────────── */
(function initLazyImages() {
  if ('loading' in HTMLImageElement.prototype) return; // natif supporté

  const imgs = document.querySelectorAll('img[loading="lazy"]');
  const io   = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) img.src = img.dataset.src;
        io.unobserve(img);
      }
    });
  }, { rootMargin: '200px' });

  imgs.forEach(img => io.observe(img));
})();
