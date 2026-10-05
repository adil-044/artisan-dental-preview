/**
 * Artisan Dental — AI Booking Engine (demo)
 * Conversational booking with real slot locking via localStorage.
 * No backend — works offline as client-side demo.
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "artisan_dental_bookings_v1";
  var CLINIC = {
    name: "Artisan Dental",
    phone: "(905) 689-6222",
    tel: "+19056896222",
    email: "info@artisandental.ca",
    address: "245 Dundas St E, Unit 6, Waterdown, ON L8B 0E9",
  };

  var SERVICES = [
    { id: "cleaning", label: "Cleaning / checkup", mins: 45, keywords: ["clean", "checkup", "hygiene", "recall", "polish"] },
    { id: "new", label: "New patient exam", mins: 60, keywords: ["new patient", "first visit", "exam", "new"] },
    { id: "emergency", label: "Tooth pain / emergency", mins: 30, keywords: ["pain", "emergency", "ache", "hurt", "urgent", "swelling"] },
    { id: "cosmetic", label: "Cosmetic consult", mins: 45, keywords: ["cosmetic", "whitening", "veneer", "smile", "invisalign", "aligner"] },
    { id: "implants", label: "Implants / restorative", mins: 60, keywords: ["implant", "crown", "bridge", "denture", "restor"] },
    { id: "kids", label: "Children's dental", mins: 40, keywords: ["kid", "child", "pediatric", "children"] },
  ];

  /* Hours from Google Maps listing */
  var HOURS = {
    1: { open: 9, close: 18 },      // Mon
    2: { open: 9.5, close: 18 },    // Tue
    3: { open: 9.5, close: 16 },    // Wed
    4: { open: 9.5, close: 13.5 },  // Thu
    5: { open: 9.5, close: 13.5 },  // Fri
  };

  function loadBookings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function saveBookings(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function uid() {
    return "AD-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function formatTime(h) {
    var hr = Math.floor(h);
    var min = Math.round((h - hr) * 60);
    var ampm = hr >= 12 ? "PM" : "AM";
    var h12 = hr % 12 || 12;
    return h12 + ":" + pad(min) + " " + ampm;
  }

  function formatDate(d) {
    return d.toLocaleDateString("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function toISODate(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function parseISODate(s) {
    var p = s.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function slotKey(dateISO, timeLabel) {
    return dateISO + "|" + timeLabel;
  }

  function isTaken(dateISO, timeLabel) {
    return loadBookings().some(function (b) {
      return b.status !== "cancelled" && b.date === dateISO && b.time === timeLabel;
    });
  }

  function nextOpenDays(count) {
    var out = [];
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    var guard = 0;
    while (out.length < count && guard < 40) {
      guard++;
      d.setDate(d.getDate() + 1);
      if (HOURS[d.getDay()]) out.push(new Date(d));
    }
    return out;
  }

  function slotsForDay(dateObj, serviceMins) {
    var day = dateObj.getDay();
    var cfg = HOURS[day];
    if (!cfg) return [];
    var dateISO = toISODate(dateObj);
    var slots = [];
    var step = 0.5; // 30 min
    var start = cfg.open;
    var end = cfg.close - serviceMins / 60;
    for (var t = start; t <= end + 0.001; t += step) {
      var label = formatTime(t);
      slots.push({
        time: label,
        taken: isTaken(dateISO, label),
        key: slotKey(dateISO, label),
      });
    }
    return slots;
  }

  function matchService(text) {
    var t = text.toLowerCase();
    var best = null;
    var score = 0;
    SERVICES.forEach(function (s) {
      s.keywords.forEach(function (k) {
        if (t.indexOf(k) !== -1 && k.length > score) {
          best = s;
          score = k.length;
        }
      });
      if (t.indexOf(s.label.toLowerCase()) !== -1) {
        best = s;
        score = 99;
      }
    });
    return best;
  }

  function extractPhone(text) {
    var m = text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    return m ? m[0] : null;
  }

  function extractEmail(text) {
    var m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return m ? m[0] : null;
  }

  function extractName(text) {
    var m = text.match(/(?:i(?:'m| am)|my name is|this is)\s+([A-Za-z][A-Za-z' -]{1,40})/i);
    if (m) return m[1].trim();
    if (/^[A-Za-z][A-Za-z' -]{1,40}$/.test(text.trim()) && text.trim().split(/\s+/).length <= 4) {
      return text.trim();
    }
    return null;
  }

  function extractDayHint(text) {
    var t = text.toLowerCase();
    var days = nextOpenDays(10);
    var names = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    for (var i = 0; i < names.length; i++) {
      if (t.indexOf(names[i]) !== -1 || t.indexOf(names[i].slice(0, 3)) !== -1) {
        for (var j = 0; j < days.length; j++) {
          if (days[j].getDay() === i) return days[j];
        }
      }
    }
    if (/\btomorrow\b/.test(t)) {
      var tom = new Date();
      tom.setDate(tom.getDate() + 1);
      tom.setHours(0, 0, 0, 0);
      if (HOURS[tom.getDay()]) return tom;
      return nextOpenDays(1)[0];
    }
    if (/\bnext week\b/.test(t)) return days[Math.min(5, days.length - 1)];
    var iso = t.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (iso) return parseISODate(iso[1]);
    return null;
  }

  function createBooking(data) {
    var list = loadBookings();
    if (isTaken(data.date, data.time)) {
      return { ok: false, error: "That slot was just taken. Pick another time." };
    }
    var booking = {
      id: uid(),
      serviceId: data.service.id,
      service: data.service.label,
      date: data.date,
      time: data.time,
      name: data.name,
      phone: data.phone,
      email: data.email || "",
      notes: data.notes || "",
      createdAt: new Date().toISOString(),
      status: "confirmed",
      clinic: CLINIC.name,
    };
    list.push(booking);
    saveBookings(list);
    return { ok: true, booking: booking };
  }

  function cancelBooking(id) {
    var list = loadBookings().map(function (b) {
      if (b.id === id) b.status = "cancelled";
      return b;
    });
    saveBookings(list);
  }

  function icsFor(booking) {
    var d = parseISODate(booking.date);
    var timeMatch = booking.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!timeMatch) return null;
    var hr = +timeMatch[1];
    var min = +timeMatch[2];
    var ap = timeMatch[3].toUpperCase();
    if (ap === "PM" && hr !== 12) hr += 12;
    if (ap === "AM" && hr === 12) hr = 0;
    d.setHours(hr, min, 0, 0);
    var end = new Date(d.getTime() + 45 * 60000);
    function stamp(x) {
      return (
        x.getUTCFullYear() +
        pad(x.getUTCMonth() + 1) +
        pad(x.getUTCDate()) +
        "T" +
        pad(x.getUTCHours()) +
        pad(x.getUTCMinutes()) +
        "00Z"
      );
    }
    var body = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Artisan Dental//AI Booking Demo//EN",
      "BEGIN:VEVENT",
      "UID:" + booking.id + "@artisandental.demo",
      "DTSTAMP:" + stamp(new Date()),
      "DTSTART:" + stamp(d),
      "DTEND:" + stamp(end),
      "SUMMARY:" + booking.service + " — Artisan Dental",
      "LOCATION:" + CLINIC.address,
      "DESCRIPTION:Booking " + booking.id + "\\nPatient: " + booking.name + "\\nPhone: " + booking.phone,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    return "data:text/calendar;charset=utf-8," + encodeURIComponent(body);
  }

  /* —— UI controller —— */
  function mount(root) {
    if (!root) return null;

    var state = {
      step: "intent",
      service: null,
      date: null,
      dateISO: null,
      time: null,
      name: null,
      phone: null,
      email: null,
      notes: "",
      busy: false,
    };

    var log = root.querySelector("[data-ai-log]");
    var form = root.querySelector("[data-ai-form]");
    var input = root.querySelector("[data-ai-input]");
    var sendBtn = root.querySelector("[data-ai-send]");
    var listEl = document.querySelector("[data-bookings-list]");

    function refreshList() {
      if (!listEl) return;
      var active = loadBookings().filter(function (b) {
        return b.status !== "cancelled";
      });
      if (!active.length) {
        listEl.innerHTML = '<p class="empty">No demo bookings yet. Chat with the AI to lock a slot.</p>';
        return;
      }
      listEl.innerHTML =
        "<ul>" +
        active
          .slice()
          .reverse()
          .map(function (b) {
            return (
              "<li><span><strong>" +
              b.id +
              "</strong><br/>" +
              b.service +
              " · " +
              b.date +
              " · " +
              b.time +
              "<br/>" +
              b.name +
              "</span><button type=\"button\" data-cancel=\"" +
              b.id +
              "\">Cancel</button></li>"
            );
          })
          .join("") +
        "</ul>";
      listEl.querySelectorAll("[data-cancel]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          cancelBooking(btn.getAttribute("data-cancel"));
          refreshList();
          bot("Cancelled " + btn.getAttribute("data-cancel") + ". That slot is free again.");
        });
      });
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
              handleUser(c.value || c.label);
            });
          }
          wrap.appendChild(b);
        });
        el.appendChild(wrap);
      }
      log.appendChild(el);
      requestAnimationFrame(function () {
        el.classList.add("in");
      });
      log.scrollTop = log.scrollHeight;
      return el;
    }

    function typingThen(fn, ms) {
      state.busy = true;
      if (sendBtn) sendBtn.disabled = true;
      var tip = addMsg("bot", '<span class="typing"><i></i><i></i><i></i></span>');
      setTimeout(function () {
        tip.remove();
        state.busy = false;
        if (sendBtn) sendBtn.disabled = false;
        fn();
        if (input) input.focus();
      }, ms || 550 + Math.random() * 400);
    }

    function bot(html, chips) {
      addMsg("bot", html, chips);
    }

    function user(text) {
      addMsg("user", escapeHtml(text));
    }

    function escapeHtml(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    function serviceChips() {
      return SERVICES.map(function (s) {
        return { label: s.label, value: s.label };
      });
    }

    function dayChips() {
      return nextOpenDays(5).map(function (d) {
        return { label: formatDate(d), value: formatDate(d) + " (" + toISODate(d) + ")" };
      });
    }

    function timeChips() {
      if (!state.date || !state.service) return [];
      return slotsForDay(state.date, state.service.mins).map(function (s) {
        return { label: s.time, value: s.time, slot: true, taken: s.taken };
      });
    }

    function askService() {
      state.step = "service";
      bot(
        "What do you need? Pick a service — or type it in plain words (pain, cleaning, Invisalign…).",
        serviceChips()
      );
    }

    function askDay() {
      state.step = "day";
      bot("Got it — <strong>" + state.service.label + "</strong> (~" + state.service.mins + " min). Which day works?", dayChips());
    }

    function askTime() {
      state.step = "time";
      var chips = timeChips();
      var free = chips.filter(function (c) {
        return !c.taken;
      });
      if (!free.length) {
        bot("No open slots that day. Pick another day.", dayChips());
        state.step = "day";
        return;
      }
      bot("Open times on <strong>" + formatDate(state.date) + "</strong>:", chips);
    }

    function askName() {
      state.step = "name";
      bot("Who is the appointment for? (full name)");
    }

    function askPhone() {
      state.step = "phone";
      bot("Best phone number to confirm? Example: 905-555-0142");
    }

    function finalize() {
      state.step = "done";
      var res = createBooking({
        service: state.service,
        date: state.dateISO,
        time: state.time,
        name: state.name,
        phone: state.phone,
        email: state.email,
        notes: state.notes,
      });
      if (!res.ok) {
        bot(res.error, timeChips());
        state.step = "time";
        return;
      }
      var b = res.booking;
      var ics = icsFor(b);
      var card =
        '<div class="confirm-card"><strong>✓ Booked — demo confirmed</strong><dl>' +
        "<dt>Confirmation</dt><dd>" +
        b.id +
        "</dd>" +
        "<dt>Service</dt><dd>" +
        b.service +
        "</dd>" +
        "<dt>When</dt><dd>" +
        b.date +
        " · " +
        b.time +
        "</dd>" +
        "<dt>Patient</dt><dd>" +
        escapeHtml(b.name) +
        " · " +
        escapeHtml(b.phone) +
        "</dd>" +
        "<dt>Clinic</dt><dd>" +
        CLINIC.address +
        "</dd></dl>" +
        (ics
          ? '<div class="chips" style="margin-top:0.65rem"><a class="chip" href="' +
            ics +
            '" download="artisan-' +
            b.id +
            '.ics">Add to calendar</a>' +
            '<a class="chip" href="tel:' +
            CLINIC.tel +
            '">Call clinic</a></div>'
          : "") +
        "</div>";
      bot(
        "You're set. I locked this slot in the demo system (browser storage). Clinic would get this live once we wire their PMS.",
      );
      bot(card, [
        { label: "Book another", value: "book another" },
        { label: "Start over", value: "start over" },
      ]);
      refreshList();
      root.dispatchEvent(new CustomEvent("booking:confirmed", { detail: b, bubbles: true }));
    }

    function resolveDayFromText(text) {
      var hint = extractDayHint(text);
      if (hint) return hint;
      var iso = text.match(/20\d{2}-\d{2}-\d{2}/);
      if (iso) return parseISODate(iso[0]);
      var days = nextOpenDays(7);
      for (var i = 0; i < days.length; i++) {
        if (text.indexOf(formatDate(days[i])) !== -1) return days[i];
      }
      return null;
    }

    function handleUser(raw) {
      if (state.busy) return;
      var text = String(raw || "").trim();
      if (!text) return;
      user(text);

      var lower = text.toLowerCase();
      if (lower === "start over" || lower === "restart" || lower === "reset") {
        state = { step: "intent", service: null, date: null, dateISO: null, time: null, name: null, phone: null, email: null, notes: "", busy: false };
        typingThen(function () {
          bot("Fresh start. I'm Artisan AI — I book real demo slots for Waterdown.");
          askService();
        });
        return;
      }
      if (lower === "book another" || lower === "another") {
        state = { step: "intent", service: null, date: null, dateISO: null, time: null, name: null, phone: null, email: null, notes: "", busy: false };
        typingThen(askService);
        return;
      }

      typingThen(function () {
        // opportunistic extraction any step
        var svc = matchService(text);
        var day = resolveDayFromText(text);
        var phone = extractPhone(text);
        var email = extractEmail(text);
        var name = extractName(text);

        if (svc && (!state.service || state.step === "intent" || state.step === "service")) {
          state.service = svc;
        }
        if (day && HOURS[day.getDay()]) {
          state.date = day;
          state.dateISO = toISODate(day);
        }
        if (phone) state.phone = phone;
        if (email) state.email = email;
        if (name && state.step === "name") state.name = name;

        if (state.step === "intent" || state.step === "service") {
          if (!state.service) {
            bot("I didn't catch the service. Tap one below — or say cleaning, pain, whitening…", serviceChips());
            state.step = "service";
            return;
          }
          askDay();
          return;
        }

        if (state.step === "day") {
          if (!state.date) {
            bot("Pick a day from the chips, or say Monday / tomorrow.", dayChips());
            return;
          }
          askTime();
          return;
        }

        if (state.step === "time") {
          var slots = slotsForDay(state.date, state.service.mins);
          var hit = null;
          slots.forEach(function (s) {
            if (text.toLowerCase().indexOf(s.time.toLowerCase()) !== -1 || text === s.time) hit = s;
          });
          // also match "10am" style
          if (!hit) {
            var loose = text.toLowerCase().replace(/\s+/g, "");
            slots.forEach(function (s) {
              var compact = s.time.toLowerCase().replace(/\s+/g, "");
              if (loose === compact || loose.indexOf(compact) !== -1) hit = s;
            });
          }
          if (!hit || hit.taken) {
            bot(hit && hit.taken ? "That one's taken. Grab another:" : "Tap an open time:", timeChips());
            return;
          }
          state.time = hit.time;
          askName();
          return;
        }

        if (state.step === "name") {
          var n = extractName(text) || (text.length >= 2 && text.length < 60 ? text : null);
          if (!n) {
            bot("Need a name — e.g. Jordan Lee");
            return;
          }
          state.name = n;
          askPhone();
          return;
        }

        if (state.step === "phone") {
          var p = extractPhone(text);
          if (!p) {
            bot("Need a valid phone — e.g. 905-689-6222");
            return;
          }
          state.phone = p;
          if (email) state.email = email;
          finalize();
          return;
        }

        if (state.step === "done") {
          bot("Want another visit? Say <em>book another</em> — or call " + CLINIC.phone + ".", [
            { label: "Book another", value: "book another" },
            { label: "Start over", value: "start over" },
          ]);
        }
      });
    }

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = input.value;
        input.value = "";
        handleUser(v);
      });
    }

    // boot
    log.innerHTML = "";
    bot(
      "Hi — I'm <strong>Artisan AI</strong>, the clinic booking assistant. I check live demo availability (Mon–Fri hours) and lock your slot instantly."
    );
    askService();
    refreshList();

    return {
      handleUser: handleUser,
      refreshList: refreshList,
      reset: function () {
        handleUser("start over");
      },
    };
  }

  global.ArtisanAIBooking = {
    CLINIC: CLINIC,
    SERVICES: SERVICES,
    mount: mount,
    loadBookings: loadBookings,
    cancelBooking: cancelBooking,
  };
})(window);
