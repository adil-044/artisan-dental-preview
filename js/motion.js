(function () {
  "use strict";
  if (!window.gsap) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  if (window.ScrollToPlugin) gsap.registerPlugin(ScrollToPlugin);

  // Hero parallax + text reveal
  var heroImg = document.querySelector(".hero-media img");
  var heroBits = document.querySelectorAll(".hero-brand, .hero-line, .hero-support, .hero-actions");

  if (heroBits.length) {
    gsap.from(heroBits, {
      opacity: 0,
      y: 36,
      duration: 1,
      stagger: 0.12,
      ease: "power3.out",
      delay: 0.15,
    });
  }

  if (heroImg && window.ScrollTrigger) {
    gsap.to(heroImg, {
      yPercent: 12,
      scale: 1.08,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero, .page-hero",
        start: "top top",
        end: "bottom top",
        scrub: true,
      },
    });
  }

  // Section heads
  gsap.utils.toArray(".section-head, .booking-aside, .care-item").forEach(function (el) {
    gsap.from(el, {
      opacity: 0,
      y: 24,
      duration: 0.7,
      ease: "power2.out",
      scrollTrigger: {
        trigger: el,
        start: "top 88%",
      },
    });
  });

  // AI shell entrance
  var shell = document.querySelector(".ai-shell");
  if (shell) {
    gsap.from(shell, {
      opacity: 0,
      y: 40,
      duration: 0.85,
      ease: "power3.out",
      scrollTrigger: {
        trigger: shell,
        start: "top 90%",
      },
    });
  }

  // FAB bounce-in
  var fab = document.querySelector(".ai-fab");
  if (fab) {
    gsap.from(fab, {
      scale: 0.6,
      opacity: 0,
      duration: 0.6,
      ease: "back.out(1.6)",
      delay: 1.2,
    });
  }

  // Smooth scroll to book on FAB / CTAs with data-scroll
  document.querySelectorAll('[href="#book"], [data-scroll="#book"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var target = document.getElementById("book");
      if (!target) return;
      e.preventDefault();
      gsap.to(window, {
        duration: 0.9,
        scrollTo: { y: target, offsetY: 70 },
        ease: "power2.inOut",
      });
    });
  });
})();
