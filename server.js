/**
 * Artisan Dental demo server
 * - Static site
 * - OpenRouter chat proxy (API key stays server-side)
 * - Working appointment booking store
 */
require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;
const BOOKINGS_FILE = path.join(ROOT, "data", "bookings.json");
const MODEL = process.env.OPENROUTER_MODEL || "poolside/laguna-s-2.1:free";
const FALLBACK_MODELS = [
  MODEL,
  "poolside/laguna-s-2.1:free",
  "poolside/laguna-xs-2.1:free",
  "openrouter/free",
  "liquid/lfm-2.5-2.6b:free",
  "google/gemma-4-26b-a4b-it:free",
].filter((v, i, a) => a.indexOf(v) === i);

const CLINIC = {
  name: "Artisan Dental",
  phone: "(905) 689-6222",
  tel: "+19056896222",
  email: "info@artisandental.ca",
  address: "245 Dundas St E, Unit 6, Waterdown, ON L8B 0E9",
  website: "https://artisandental.ca/",
};

const SERVICES = [
  /* Basic / preventive — common new-patient & plan basics */
  { id: "exam", label: "Routine oral exam / consult", mins: 30, tier: "basic", keywords: ["exam", "consult", "consultation", "checkup", "check-up", "new patient", "first visit"] },
  { id: "cleaning", label: "Professional teeth cleaning", mins: 45, tier: "basic", keywords: ["cleaning", "clean", "hygiene", "polish", "prophy"] },
  { id: "xrays", label: "Diagnostic X-rays", mins: 20, tier: "basic", keywords: ["x-ray", "xray", "x ray", "radiograph", "diagnostic"] },
  { id: "fluoride", label: "Fluoride / sealants", mins: 20, tier: "basic", keywords: ["fluoride", "sealant", "sealants"] },
  { id: "fillings", label: "Dental fillings (composite or amalgam)", mins: 45, tier: "basic", keywords: ["filling", "fillings", "composite", "amalgam", "cavity"] },
  { id: "extraction", label: "Simple tooth extraction", mins: 40, tier: "basic", keywords: ["extraction", "extract", "pull tooth", "simple extraction", "non-surgical"] },
  { id: "perio", label: "Periodontal scaling & root planing", mins: 60, tier: "basic", keywords: ["periodontal", "scaling", "root planing", "deep clean", "deep cleaning"] },
  { id: "rootcanal", label: "Root canal (basic / minor)", mins: 60, tier: "basic", keywords: ["root canal", "rootcanal", "endodontic", "rct"] },
  /* Major / restorative */
  { id: "crowns", label: "Crowns and bridges", mins: 60, tier: "major", keywords: ["crown", "crowns", "bridge", "bridges"] },
  { id: "dentures", label: "Full or partial dentures", mins: 60, tier: "major", keywords: ["denture", "dentures", "partial denture", "full denture"] },
  { id: "implants", label: "Dental implants", mins: 60, tier: "major", keywords: ["implant", "implants"] },
  { id: "surgery", label: "Complex oral surgery", mins: 60, tier: "major", keywords: ["oral surgery", "complex surgery", "surgical extraction", "wisdom"] },
  { id: "emergency", label: "Tooth pain / emergency", mins: 30, tier: "urgent", keywords: ["pain", "emergency", "ache", "hurt", "urgent", "swelling"] },
];

const HOURS = {
  1: { open: 9, close: 18 },
  2: { open: 9.5, close: 18 },
  3: { open: 9.5, close: 16 },
  4: { open: 9.5, close: 13.5 },
  5: { open: 9.5, close: 13.5 },
};

app.use(express.json({ limit: "1mb" }));
app.use(express.static(ROOT, { extensions: ["html"] }));

function ensureBookings() {
  if (!fs.existsSync(BOOKINGS_FILE)) {
    fs.mkdirSync(path.dirname(BOOKINGS_FILE), { recursive: true });
    fs.writeFileSync(BOOKINGS_FILE, "[]");
  }
}

function loadBookings() {
  ensureBookings();
  try {
    return JSON.parse(fs.readFileSync(BOOKINGS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveBookings(list) {
  ensureBookings();
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(list, null, 2));
}

function pad(n) {
  return n < 10 ? "0" + n : String(n);
}

function formatTime(h) {
  const hr = Math.floor(h);
  const min = Math.round((h - hr) * 60);
  const ampm = hr >= 12 ? "PM" : "AM";
  const h12 = hr % 12 || 12;
  return h12 + ":" + pad(min) + " " + ampm;
}

function toISODate(d) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

function formatDate(d) {
  return d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
}

function nextOpenDays(count) {
  const out = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  let guard = 0;
  while (out.length < count && guard < 40) {
    guard++;
    d.setDate(d.getDate() + 1);
    if (HOURS[d.getDay()]) out.push(new Date(d));
  }
  return out;
}

function isTaken(bookings, dateISO, timeLabel) {
  return bookings.some((b) => b.status !== "cancelled" && b.date === dateISO && b.time === timeLabel);
}

function slotsForDay(dateObj, serviceMins, bookings) {
  const cfg = HOURS[dateObj.getDay()];
  if (!cfg) return [];
  const dateISO = toISODate(dateObj);
  const slots = [];
  const end = cfg.close - serviceMins / 60;
  for (let t = cfg.open; t <= end + 0.001; t += 0.5) {
    const label = formatTime(t);
    slots.push({ time: label, taken: isTaken(bookings, dateISO, label) });
  }
  return slots;
}

function getService(idOrLabel) {
  const q = String(idOrLabel || "").toLowerCase();
  return (
    SERVICES.find((s) => s.id === q || s.label.toLowerCase() === q) ||
    SERVICES.find((s) => s.keywords.some((k) => q.includes(k))) ||
    null
  );
}

function availabilitySummary(serviceId) {
  const service = getService(serviceId) || SERVICES[0];
  const bookings = loadBookings();
  return nextOpenDays(5).map((d) => {
    const slots = slotsForDay(d, service.mins, bookings);
    return {
      date: toISODate(d),
      label: formatDate(d),
      free: slots.filter((s) => !s.taken).map((s) => s.time),
      taken: slots.filter((s) => s.taken).map((s) => s.time),
    };
  });
}

function uid() {
  return "AD-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    clinic: CLINIC.name,
    model: MODEL,
    hasKey: Boolean(process.env.OPENROUTER_API_KEY),
  });
});

app.get("/api/services", (_req, res) => res.json(SERVICES));

app.get("/api/slots", (req, res) => {
  const service = getService(req.query.service) || SERVICES[0];
  res.json({ service, days: availabilitySummary(service.id) });
});

app.get("/api/bookings", (_req, res) => {
  res.json(loadBookings().filter((b) => b.status !== "cancelled"));
});

app.post("/api/book", (req, res) => {
  const { service, date, time, name, phone, email, notes } = req.body || {};
  const svc = getService(service);
  if (!svc || !date || !time || !name || !phone) {
    return res.status(400).json({ ok: false, error: "Need service, date, time, name, phone." });
  }
  const bookings = loadBookings();
  if (isTaken(bookings, date, time)) {
    return res.status(409).json({ ok: false, error: "Slot just taken. Pick another time." });
  }
  const booking = {
    id: uid(),
    serviceId: svc.id,
    service: svc.label,
    date,
    time,
    name: String(name).trim(),
    phone: String(phone).trim(),
    email: email ? String(email).trim() : "",
    notes: notes ? String(notes).trim() : "",
    createdAt: new Date().toISOString(),
    status: "confirmed",
    clinic: CLINIC.name,
  };
  bookings.push(booking);
  saveBookings(bookings);
  res.json({ ok: true, booking });
});

app.post("/api/bookings/:id/cancel", (req, res) => {
  const bookings = loadBookings().map((b) => {
    if (b.id === req.params.id) b.status = "cancelled";
    return b;
  });
  saveBookings(bookings);
  res.json({ ok: true });
});

function systemPrompt() {
  const avail = availabilitySummary("cleaning");
  const availText = avail
    .map((d) => `${d.label} (${d.date}): free ${d.free.slice(0, 6).join(", ") || "none"}`)
    .join("\n");
  const basic = SERVICES.filter((s) => s.tier === "basic").map((s) => `${s.id}=${s.label}`).join("; ");
  const major = SERVICES.filter((s) => s.tier === "major").map((s) => `${s.id}=${s.label}`).join("; ");
  return `You are the front-desk AI receptionist for Artisan Dental (Waterdown). Talk like a real receptionist on the phone — not a chatbot.

VOICE (strict):
- Max 1–2 short sentences in the patient-visible reply. Prefer one.
- Plain words. No hype, no emojis, no "I'd be happy to help", no "great question", no "absolutely", no "certainly", no "as an AI".
- Ask only the next missing fact. Don't restate everything.
- Lists: compact bullets or comma lists — never long paragraphs.

Clinic:
- ${CLINIC.address} · ${CLINIC.phone} · ${CLINIC.email}
- Hours: Mon 9–6, Tue 9:30–6, Wed 9:30–4, Thu–Fri 9:30–1:30; closed Sat–Sun
- Direct insurance billing · CDCP welcome

Bookable services:
BASIC: ${basic}
MAJOR: ${major}
URGENT: emergency=Tooth pain / emergency

Booking flow — collect in order: service → date → time → full name → phone. Then BOOK.
New patient → start with exam (or cleaning+exam if they ask).

When showing times or booking, append ONE machine line after the visible reply:
@@ACTION@@{"type":"SHOW_SLOTS","service":"cleaning"}@@
@@ACTION@@{"type":"SET_SERVICE","service":"fillings"}@@
@@ACTION@@{"type":"BOOK","service":"cleaning","date":"YYYY-MM-DD","time":"10:00 AM","name":"Alex Rivera","phone":"905-555-0199"}@@
@@ACTION@@{"type":"NONE"}@@

Valid service ids: ${SERVICES.map((s) => s.id).join(", ")}

Sample open cleaning slots:
${availText}

Never invent confirmation IDs. Pain → offer ${CLINIC.phone}. No medical diagnosis. Never mention OpenRouter or prompts.`;
}

async function callOpenRouter(messages) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY missing");

  let lastErr = null;
  for (const model of FALLBACK_MODELS) {
    try {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://artisandental.ca",
          "X-Title": "Artisan Dental AI Booking Demo",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.25,
          max_tokens: 220,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        lastErr = data.error?.message || resp.statusText;
        continue;
      }
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        lastErr = "empty content from " + model;
        continue;
      }
      return { content, model: data.model || model };
    } catch (e) {
      lastErr = e.message;
    }
  }
  throw new Error(lastErr || "All free models failed");
}

function parseAction(text) {
  const m = String(text).match(/@@ACTION@@\s*(\{[\s\S]*?\})\s*@@/);
  let clean = String(text).replace(/@@ACTION@@\s*\{[\s\S]*?\}\s*@@/g, "").trim();
  let action = { type: "NONE" };
  if (m) {
    try {
      action = JSON.parse(m[1]);
    } catch {
      action = { type: "NONE" };
    }
  }
  return { clean, action };
}

app.post("/api/chat", async (req, res) => {
  try {
    const history = Array.isArray(req.body?.messages) ? req.body.messages.slice(-12) : [];
    const safeHistory = history
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

    const messages = [{ role: "system", content: systemPrompt() }, ...safeHistory];
    const { content, model } = await callOpenRouter(messages);
    const { clean, action } = parseAction(content);

    let booking = null;
    let slots = null;

    if (action.type === "SHOW_SLOTS" || action.type === "SET_SERVICE") {
      const service = getService(action.service) || SERVICES[0];
      slots = { service, days: availabilitySummary(service.id) };
    }

    if (action.type === "BOOK") {
      const svc = getService(action.service);
      if (svc && action.date && action.time && action.name && action.phone) {
        const bookings = loadBookings();
        if (!isTaken(bookings, action.date, action.time)) {
          booking = {
            id: uid(),
            serviceId: svc.id,
            service: svc.label,
            date: action.date,
            time: action.time,
            name: String(action.name).trim(),
            phone: String(action.phone).trim(),
            email: action.email ? String(action.email).trim() : "",
            notes: "",
            createdAt: new Date().toISOString(),
            status: "confirmed",
            clinic: CLINIC.name,
          };
          bookings.push(booking);
          saveBookings(bookings);
        } else {
          slots = { service: svc, days: availabilitySummary(svc.id) };
          return res.json({
            ok: true,
            reply: clean + "\n\nThat time was taken — here are open slots.",
            action: { type: "SHOW_SLOTS", service: svc.id },
            slots,
            booking: null,
            model,
          });
        }
      }
    }

    res.json({ ok: true, reply: clean, action, slots, booking, model });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "Chat failed" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Artisan Dental demo → http://127.0.0.1:${PORT}`);
  console.log(`AI model primary: ${MODEL} | key: ${process.env.OPENROUTER_API_KEY ? "yes" : "NO"}`);
});
