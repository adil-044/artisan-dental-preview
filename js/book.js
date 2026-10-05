(function () {
  var form = document.getElementById("book-form");
  if (!form) return;

  var statusEl = document.getElementById("form-status");
  var TO = "info@artisandental.ca";

  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var name = val("name");
    var phone = val("phone");
    var email = val("email");
    var service = val("service");
    var when = val("when");
    var notes = val("notes");
    var patient = val("patient");

    if (!name || !phone || !service) {
      if (statusEl) {
        statusEl.className = "form-status err";
        statusEl.textContent = "Name, phone, and visit reason required.";
      }
      return;
    }

    var lines = [
      "Booking request — Artisan Dental",
      "",
      "Name: " + name,
      "Phone: " + phone,
      "Email: " + (email || "(not provided)"),
      "Service: " + service,
      "Preferred: " + (when || "(flexible)"),
    ];
    if (patient) lines.push("Patient: " + patient);
    if (notes) {
      lines.push("");
      lines.push("Notes:");
      lines.push(notes);
    }
    lines.push("");
    lines.push("Sent from artisandental booking page preview.");

    var subject = encodeURIComponent("Booking request — " + name + " (" + service + ")");
    var body = encodeURIComponent(lines.join("\n"));
    var href = "mailto:" + TO + "?subject=" + subject + "&body=" + body;

    if (statusEl) {
      statusEl.className = "form-status ok";
      statusEl.textContent = "Opening your email… If nothing opens, email " + TO + " or call (905) 689-6222.";
    }

    window.location.href = href;
  });
})();
