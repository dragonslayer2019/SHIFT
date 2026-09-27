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

    /* ── Pin scene-shift → UGC slides up as drawer ── */
    const ugcSection = document.querySelector('[data-section-type="ugc-mood"]');
    if (ugcSection) {
      console.log('[scene-shift-scroll] UGC section found — setting up pin');

      /* Compute actual dimensions for debugging */
      const panelRect = panel.getBoundingClientRect();
      const panelParent = panel.parentElement;
      console.log('[scene-shift-scroll] panel tag:', panel.tagName, 'id:', panel.id);
      console.log('[scene-shift-scroll] panel parent tag:', panelParent?.tagName, 'class:', panelParent?.className);
      console.log('[scene-shift-scroll] panel rect:', JSON.stringify({ top: panelRect.top, height: panelRect.height, bottom: panelRect.bottom }));
      console.log('[scene-shift-scroll] panel computed position:', getComputedStyle(panel).position);
      console.log('[scene-shift-scroll] panel computed overflow:', getComputedStyle(panel).overflow);
      console.log('[scene-shift-scroll] panel computed transform:', getComputedStyle(panel).transform);
      if (panelParent) {
        console.log('[scene-shift-scroll] parent computed overflow:', getComputedStyle(panelParent).overflow);
        console.log('[scene-shift-scroll] parent computed transform:', getComputedStyle(panelParent).transform);
      }

      /* Pin scene-shift slightly above viewport to hide border-radius */
      const pinST = ScrollTrigger.create({
        trigger: panel,
        start: 'top top+=-60',
        endTrigger: ugcSection,
        end: 'top top',
        pin: true,
        pinSpacing: false,
        invalidateOnRefresh: true,
        onToggle: (self) => {
          console.log('[scene-shift-scroll] PIN toggle — active:', self.isActive, 'progress:', self.progress.toFixed(3));
        },
        onUpdate: (self) => {
          if (Math.round(self.progress * 100) % 25 === 0) {
            console.log('[scene-shift-scroll] PIN progress:', self.progress.toFixed(3));
          }
        },
      });
      console.log('[scene-shift-scroll] Pin ScrollTrigger created:', pinST ? 'YES' : 'NO');
      console.log('[scene-shift-scroll] Pin start/end:', pinST.start, pinST.end);

      /* UGC drawer styling */
      ugcSection.classList.add('ugc-mood--drawer');

      /* UGC shadow scrub as it rises over pinned scene-shift */
      gsap.fromTo(
        ugcSection,
        { boxShadow: '0 -4px 16px rgba(0,0,0,0.04)' },
        {
          boxShadow: '0 -16px 60px rgba(0,0,0,0.22)',
          ease: 'none',
          scrollTrigger: {
            trigger: ugcSection,
            start: 'top bottom',
            end: 'top 20%',
            scrub: 0.4,
            invalidateOnRefresh: true,
          },
        }
      );
    } else {
      console.warn('[scene-shift-scroll] UGC section NOT found — no pin');
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
