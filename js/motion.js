(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

  /* Lenis — same pattern as PediNNails / BodyBliss packs */
  var lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({
      duration: 1.15,
      easing: function (t) {
        return Math.min(1, 1.001 - Math.pow(2, -10 * t));
      },
      smoothWheel: true,
    });
    lenis.on("scroll", ScrollTrigger.update);
    ScrollTrigger.scrollerProxy(document.documentElement, {
      scrollTop: function (value) {
        if (arguments.length) lenis.scrollTo(value, { immediate: true });
        return lenis.scroll;
      },
      getBoundingClientRect: function () {
        return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
      },
    });
    ScrollTrigger.addEventListener("refresh", function () {
      lenis.resize();
    });
    gsap.ticker.add(function (time) {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
  }

  /* Scroll progress */
  var bar = document.querySelector(".scroll-progress span");
  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: function (self) {
      if (bar) bar.style.width = self.progress * 100 + "%";
    },
  });

  /* Nav */
  var nav = document.querySelector("[data-nav]");
  ScrollTrigger.create({
    start: 80,
    onUpdate: function (self) {
      if (nav) nav.classList.toggle("is-scrolled", self.scroll() > 80);
    },
  });

  if (reduce) {
    document.querySelectorAll("[data-reveal], [data-hero-item], .scroll-hint").forEach(function (el) {
      el.style.opacity = "1";
      el.style.transform = "none";
      el.style.filter = "none";
    });
    return;
  }

  /* Hero — Kuzz-style */
  var hero = document.querySelector("[data-hero]");
  if (hero) {
    var tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    var himg = hero.querySelector(".hero-media img");
    if (himg) {
      tl.fromTo(himg, { scale: 1.12, yPercent: -4 }, { scale: 1, yPercent: 0, duration: 1.4 });
    }
    tl.from(
      hero.querySelectorAll("[data-hero-item]"),
      { opacity: 0, y: 32, filter: "blur(6px)", stagger: 0.1, duration: 0.9 },
      "-=0.9"
    );
    tl.to(".scroll-hint", { opacity: 1, duration: 0.5 }, "-=0.3");

    if (himg) {
      gsap.to(himg, {
        yPercent: 14,
        ease: "none",
        scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
      });
    }
  }

  /* Pinned explore stage */
  var stage = document.querySelector("[data-explore-stage]");
  if (stage) {
    var slides = gsap.utils.toArray("[data-explore-slide]", stage);
    var dotsWrap = stage.querySelector("[data-explore-dots]");
    var progress = stage.querySelector("[data-explore-progress]");
    var titleEl = stage.querySelector("[data-explore-title]");
    var descEl = stage.querySelector("[data-explore-desc]");
    var pin = stage.querySelector(".explore-pin");
    var copy = [
      { t: "Routine cleaning", d: "Preventive care that keeps Waterdown smiles healthy — hygiene team, gentle pace." },
      { t: "Teeth whitening", d: "Brighter smiles planned around your goals — cosmetic consults welcome." },
      { t: "Invisalign", d: "Clear aligners with a clear plan. Ask AI to book a consult." },
      { t: "Dental implants", d: "Restore missing teeth with durable, natural-looking options." },
      { t: "Veneers", d: "Refine shape and shade — cosmetic craftsmanship at Artisan." },
    ];

    slides.forEach(function (_, i) {
      if (!dotsWrap) return;
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", "Slide " + (i + 1));
      if (i === 0) b.classList.add("is-active");
      b.addEventListener("click", function () {
        setActive(i);
      });
      dotsWrap.appendChild(b);
    });

    function setActive(index) {
      slides.forEach(function (slide, i) {
        slide.classList.toggle("is-active", i === index);
      });
      if (dotsWrap) {
        dotsWrap.querySelectorAll("button").forEach(function (dot, i) {
          dot.classList.toggle("is-active", i === index);
        });
      }
      if (titleEl && copy[index]) titleEl.textContent = copy[index].t;
      if (descEl && copy[index]) descEl.textContent = copy[index].d;
    }

    if (slides.length > 1 && pin) {
      var total = slides.length;
      ScrollTrigger.create({
        trigger: stage,
        start: "top top",
        end: function () {
          return "+=" + window.innerHeight * (total * 0.85);
        },
        pin: pin,
        scrub: 0.65,
        anticipatePin: 1,
        onUpdate: function (self) {
          var idx = Math.min(total - 1, Math.floor(self.progress * total));
          setActive(idx);
          if (progress) progress.style.transform = "scaleX(" + self.progress + ")";
        },
      });

      slides.forEach(function (slide) {
        var img = slide.querySelector("img");
        if (!img) return;
        gsap.fromTo(
          img,
          { scale: 1.06 },
          {
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: stage,
              start: "top top",
              end: function () {
                return "+=" + window.innerHeight * (total * 0.85);
              },
              scrub: true,
            },
          }
        );
      });
    }
  }

  /* Reveals */
  gsap.utils.toArray("[data-reveal], .svc-card").forEach(function (el) {
    gsap.from(el, {
      opacity: 0,
      y: 28,
      duration: 0.7,
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 88%" },
    });
  });

  /* Marquee */
  var track = document.querySelector("[data-marquee] .marquee-track");
  if (track) {
    var half = track.scrollWidth / 2;
    gsap.to(track, {
      x: -half,
      duration: 28,
      ease: "none",
      repeat: -1,
    });
  }

  /* 3D tilt cards — fine pointer only */
  if (window.matchMedia("(pointer: fine)").matches) {
    document.querySelectorAll("[data-tilt]").forEach(function (card) {
      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(card, {
          rotateY: x * 10,
          rotateX: -y * 8,
          transformPerspective: 800,
          duration: 0.35,
          ease: "power2.out",
        });
      });
      card.addEventListener("mouseleave", function () {
        gsap.to(card, { rotateY: 0, rotateX: 0, duration: 0.5, ease: "power3.out" });
      });
    });
  }

  /* Smooth anchor scroll */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (!id || id === "#") return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -70 });
      else gsap.to(window, { duration: 0.9, scrollTo: { y: target, offsetY: 70 }, ease: "power2.inOut" });
    });
  });

  window.ArtisanMotion = { lenis: lenis };
})();
