/**
 * Left-dock AI chat — talks to /api/chat (OpenRouter via server)
 * Booking actions handled from model @@ACTION@@ blocks + chip UI.
 */
(function () {
  "use strict";

  var dock = document.querySelector("[data-ai-dock]");
  var backdrop = document.querySelector("[data-ai-backdrop]");
  var launcher = document.querySelector(".ai-launcher");
  var log = document.querySelector("[data-ai-log]");
  var form = document.querySelector("[data-ai-form]");
  var input = document.querySelector("[data-ai-input]");
  var sendBtn = document.querySelector("[data-ai-send]");

  if (!dock || !log) return;

  var history = [];
  var busy = false;
  var pendingPrefill = null;

  function openDock(prefill) {
    dock.classList.add("open");
    dock.setAttribute("aria-hidden", "false");
    if (backdrop) backdrop.classList.add("open");
    if (launcher) launcher.hidden = true;
    if (prefill) pendingPrefill = prefill;
    setTimeout(function () {
      if (input) input.focus();
      if (pendingPrefill) {
        var p = pendingPrefill;
        pendingPrefill = null;
        sendMessage(p);
      }
    }, 320);
  }

  function closeDock() {
    dock.classList.remove("open");
    dock.setAttribute("aria-hidden", "true");
    if (backdrop) backdrop.classList.remove("open");
    if (launcher) launcher.hidden = false;
  }

  document.querySelectorAll("[data-open-ai]").forEach(function (el) {
    el.addEventListener("click", function () {
      openDock(el.getAttribute("data-ai-prefill"));
    });
  });
  document.querySelectorAll("[data-close-ai]").forEach(function (el) {
    el.addEventListener("click", closeDock);
  });
  if (backdrop) backdrop.addEventListener("click", closeDock);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && dock.classList.contains("open")) closeDock();
  });

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
  }

  function addMsg(role, html, chips) {
    var el = document.createElement("div");
    el.className = "msg " + (role === "user" ? "user" : "bot");
    el.innerHTML = html;
    if (chips && chips.length) {
      var wrap = document.createElement("div");
      wrap.className = "chips";
      chips.forEach(function (c) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "chip" + (c.slot ? " slot" : "") + (c.taken ? " taken" : "");
        b.textContent = c.label;
        if (!c.taken) {
          b.addEventListener("click", function () {
            sendMessage(c.value || c.label);
          });
        }
        wrap.appendChild(b);
      });
      el.appendChild(wrap);
    }
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function showTyping() {
    return addMsg("bot", '<span class="typing"><i></i><i></i><i></i></span>');
  }

  function bookingCard(b) {
    return (
      '<div class="confirm-card"><strong>✓ Booked — confirmed</strong><dl>' +
      "<dt>Confirmation</dt><dd>" +
      escapeHtml(b.id) +
      "</dd>" +
      "<dt>Service</dt><dd>" +
      escapeHtml(b.service) +
      "</dd>" +
      "<dt>When</dt><dd>" +
      escapeHtml(b.date) +
      " · " +
      escapeHtml(b.time) +
      "</dd>" +
      "<dt>Patient</dt><dd>" +
      escapeHtml(b.name) +
      " · " +
      escapeHtml(b.phone) +
      "</dd></dl></div>"
    );
  }

  function slotChipsFrom(slotsPayload) {
    if (!slotsPayload || !slotsPayload.days) return [];
    var chips = [];
    slotsPayload.days.forEach(function (day) {
      day.free.slice(0, 4).forEach(function (t) {
        chips.push({
          label: day.label.split(",")[0] + " " + t,
          value:
            "Book " +
            (slotsPayload.service?.label || "appointment") +
            " on " +
            day.date +
            " at " +
            t +
            ". My name and phone are coming next if you need them.",
          slot: true,
        });
      });
    });
    return chips.slice(0, 10);
  }

  async function sendMessage(text) {
    text = String(text || "").trim();
    if (!text || busy) return;
    busy = true;
    if (sendBtn) sendBtn.disabled = true;

    addMsg("user", escapeHtml(text));
    history.push({ role: "user", content: text });
    var tip = showTyping();

    try {
      var resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      var data = await resp.json();
      tip.remove();

      if (!data.ok) {
        addMsg("bot", "AI hiccup: " + escapeHtml(data.error || "try again") + ". You can still call (905) 689-6222.", [
          { label: "Cleaning", value: "I want a cleaning" },
          { label: "Tooth pain", value: "I have tooth pain" },
          { label: "Show times", value: "Show available times for cleaning" },
        ]);
      } else {
        history.push({ role: "assistant", content: data.reply });
        var chips = [];
        if (data.slots) chips = chips.concat(slotChipsFrom(data.slots));
        if (data.action && data.action.type === "NONE" && !chips.length) {
          chips = [
            { label: "Exam", value: "New patient — book a routine oral exam" },
            { label: "Cleaning", value: "Book a professional teeth cleaning" },
            { label: "Fillings", value: "Book dental fillings" },
            { label: "Major care", value: "Show major services — crowns, dentures, implants, surgery" },
          ];
        }
        addMsg("bot", escapeHtml(data.reply), chips);
        if (data.booking) {
          addMsg("bot", bookingCard(data.booking), [
            { label: "Book another", value: "I'd like to book another appointment" },
            { label: "Cancel this", value: "Please cancel booking " + data.booking.id },
          ]);
        }
      }
    } catch (e) {
      tip.remove();
      addMsg("bot", "Connection issue. Call the clinic at (905) 689-6222, or retry in a moment.", [
        { label: "Retry cleaning", value: "Book a cleaning please" },
      ]);
    }

    busy = false;
    if (sendBtn) sendBtn.disabled = false;
    if (input) input.focus();
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = input.value;
      input.value = "";
      sendMessage(v);
    });
  }

  /* Boot greeting */
  addMsg(
    "bot",
    "Artisan Dental — Waterdown. What are we booking?",
    [
      { label: "New patient exam", value: "New patient — book a routine oral exam" },
      { label: "Cleaning", value: "Book a professional teeth cleaning" },
      { label: "Fillings", value: "Book dental fillings" },
      { label: "Root canal", value: "Book a root canal" },
      { label: "Implants", value: "Book dental implants consult" },
      { label: "Pain", value: "Tooth pain — need an emergency visit" },
    ]
  );

  /* Prefill cards anywhere */
  document.querySelectorAll("[data-ai-prefill]").forEach(function (el) {
    if (el.hasAttribute("data-open-ai")) return; // handled above with open
    el.addEventListener("click", function () {
      openDock(el.getAttribute("data-ai-prefill"));
    });
  });

  if (/[?&]book=1\b/.test(location.search)) {
    setTimeout(function () { openDock(); }, 600);
  }

  window.ArtisanAIChat = { open: openDock, close: closeDock, send: sendMessage };
})();
