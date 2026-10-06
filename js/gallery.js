(function () {
  "use strict";

  var grid = document.querySelector("[data-ig-grid]");
  if (!grid) return;

  var lightbox = document.querySelector("[data-lightbox]");
  var lbImg = lightbox && lightbox.querySelector("img");
  var lbCap = lightbox && lightbox.querySelector("[data-lightbox-cap]");
  var lbClose = lightbox && lightbox.querySelector("[data-lightbox-close]");

  function openLb(src, cap) {
    if (!lightbox) return;
    lbImg.src = src;
    lbImg.alt = cap || "";
    if (lbCap) lbCap.textContent = cap || "";
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
  }
  function closeLb() {
    if (!lightbox) return;
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
  }
  if (lbClose) lbClose.addEventListener("click", closeLb);
  if (lightbox) {
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeLb();
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeLb();
  });

  fetch("data/gallery.json")
    .then(function (r) {
      return r.json();
    })
    .then(function (items) {
      grid.innerHTML = "";
      items.forEach(function (item) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ig-cell";
        btn.setAttribute("aria-label", item.caption || "Gallery photo");
        var src = "images/gallery/" + item.file;
        btn.innerHTML =
          '<img src="' +
          src +
          '" alt="' +
          (item.alt || item.caption || "") +
          '" loading="lazy" width="600" height="600" />' +
          '<span class="cap">' +
          (item.caption || "") +
          "</span>";
        btn.addEventListener("click", function () {
          openLb(src, item.caption);
        });
        grid.appendChild(btn);
      });

      if (window.gsap && window.ScrollTrigger) {
        gsap.from(".ig-cell", {
          opacity: 0,
          y: 24,
          scale: 0.97,
          duration: 0.5,
          stagger: 0.04,
          ease: "power3.out",
          scrollTrigger: { trigger: grid, start: "top 85%" },
        });
      }
    })
    .catch(function () {
      grid.innerHTML = "<p>Gallery failed to load.</p>";
    });
})();
