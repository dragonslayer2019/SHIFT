/* ═══════════════════════════════════════════════════════════════
   SHIFT — Scene Shift GSAP Scroll Tracking
   Layout (hero fixed + margin-top) is handled by inline script
   in scene-shift.liquid. This file only does:
     - drawer class toggling
     - shadow animation
     - breathing trigger on panel establishment
   ═══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  function init() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    const panel = document.querySelector('[data-section-type="scene-shift"]');
    if (!panel) return;

    panel.classList.add('scene-shift--drawer');

    console.log('[scene-shift-scroll] GSAP init, panel found');

    /* Track panel scroll position */
    ScrollTrigger.create({
      trigger: panel,
      start: 'top bottom',
      end: 'top 60%',
      invalidateOnRefresh: true,
      onEnter: () => {
        console.log('[scene-shift-scroll] panel entering viewport');
        panel.classList.add('scene-shift--rising');
      },
      onLeave: () => {
        console.log('[scene-shift-scroll] panel established');
        panel.classList.remove('scene-shift--rising');
        panel.classList.add('scene-shift--established');
        activateFirstCard();
      },
      onEnterBack: () => {
        panel.classList.remove('scene-shift--established');
        panel.classList.add('scene-shift--rising');
        deactivateBreathing();
      },
      onLeaveBack: () => {
        panel.classList.remove('scene-shift--rising');
      },
    });

    /* Shadow scrub */
    gsap.fromTo(
      panel,
      { boxShadow: '0 -2px 12px rgba(0,0,0,0.04)' },
      {
        boxShadow: '0 -12px 60px rgba(0,0,0,0.18)',
        ease: 'none',
        scrollTrigger: {
          trigger: panel,
          start: 'top bottom',
          end: 'top top',
          scrub: 0.4,
          invalidateOnRefresh: true,
        },
      }
    );

    /* ── Mascot Animations (Cat & Dog) — scroll-driven, 3× cycles ── */
    const mascots = panel.querySelectorAll('.scene-shift__mascot');
    if (mascots.length && typeof lottie !== 'undefined') {
      let loadedCount = 0;
      const mascotAnims = [];
      const CYCLES = 6; /* animation repeats 6 times over the scroll range */

      mascots.forEach((el, i) => {
        const url = el.getAttribute('data-lottie-src');
        if (!url) return;

        const anim = lottie.loadAnimation({
          container: el,
          renderer: 'svg',
          loop: false,
          autoplay: false,
          path: url,
        });

        mascotAnims.push({ anim, totalFrames: 0 });

        anim.addEventListener('DOMLoaded', () => {
          mascotAnims[i].totalFrames = anim.totalFrames;
          anim.goToAndStop(0, true);
          loadedCount++;

          if (loadedCount === mascots.length) {
            ScrollTrigger.create({
              trigger: panel,
              start: 'top bottom',
              end: 'top top',
              scrub: 0.3,
              invalidateOnRefresh: true,
              onUpdate: (self) => {
                mascotAnims.forEach((item) => {
                  /* Map scroll progress to multiple animation cycles */
                  const looped = (self.progress * CYCLES) % 1;
                  const frame = Math.round(looped * (item.totalFrames - 1));
                  item.anim.goToAndStop(frame, true);
                });
              },
            });
          }
        });
      });
    }

    let breatheActivated = false;

    function activateFirstCard() {
      if (breatheActivated) return;
      breatheActivated = true;
      panel.dispatchEvent(new CustomEvent('scene-shift:established', { bubbles: true }));
    }

    function deactivateBreathing() {
      breatheActivated = false;
      panel.dispatchEvent(new CustomEvent('scene-shift:retracted', { bubbles: true }));
    }

    document.addEventListener('shopify:section:unload', () => {
      ScrollTrigger.getAll().forEach((st) => st.kill());
      panel.classList.remove('scene-shift--drawer', 'scene-shift--rising', 'scene-shift--established');
    }, { once: true });
  }

  function waitForGSAP(retries) {
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      init();
    } else if (retries > 0) {
      setTimeout(() => waitForGSAP(retries - 1), 150);
    }
  }

  if (document.readyState === 'complete') {
    waitForGSAP(20);
  } else {
    window.addEventListener('load', () => waitForGSAP(20));
  }
})();
