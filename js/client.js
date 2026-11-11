/* ==========================================================
   Réservation en ligne (côté clientes)
   ========================================================== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = { step: 1, serviceId: null, staffId: "any", date: null, time: null, booking: null };

/* ---------- Infos du salon ---------- */
$$("[data-salon]").forEach((el) => (el.textContent = SALON[el.dataset.salon] || ""));
$$("[data-salon-href=phone]").forEach((el) => (el.href = "tel:" + SALON.phone.replace(/\s/g, "")));
(function hoursLine() {
  const names = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const parts = [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => SALON.hours[d])
    .map((d) => `${names[d]} ${Util.fmtTime(SALON.hours[d][0])}–${Util.fmtTime(SALON.hours[d][1])}`);
  $("#hours-line").textContent = parts.join(" · ");
})();

/* ---------- Navigation entre étapes ---------- */
const STEP_NAMES = ["Soin", "Créneau", "Coordonnées", "Confirmé"];

function go(step) {
  state.step = step;
  $$("[data-step]").forEach((s) => s.classList.toggle("hidden", Number(s.dataset.step) !== step));
  $("#steps").innerHTML = STEP_NAMES.map((n, i) => {
    const cls = i + 1 === step ? "active" : i + 1 < step ? "done" : "";
    return `<span class="step-pill ${cls}">${i + 1}. ${n}</span>`;
  }).join("");
  if (step === 2) renderStep2();
  if (step === 3) renderSummary($("#summary"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
$$("[data-back]").forEach((b) => b.addEventListener("click", () => go(state.step - 1)));

/* ---------- Étape 1 : prestations ---------- */
function renderServices() {
  let html = "";
  for (const [cat, list] of Catalog.categories()) {
    html += `<h3 class="cat-title">${Util.esc(cat)}</h3><div class="service-list">`;
    html += list.map((s) => `
      <button class="service" data-id="${s.id}">
        <span><strong>${Util.esc(s.name)}</strong><br><span class="meta">${Util.fmtDuration(s.duration)}</span></span>
        <span class="price">${Util.euro(s.price)}</span>
      </button>`).join("");
    html += `</div>`;
  }
  $("#services").innerHTML = html;
  $$("#services .service").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.serviceId = btn.dataset.id;
      state.time = null;
      go(2);
    })
  );
}

/* ---------- Étape 2 : esthéticienne, jour, heure ---------- */
function bookableDays() {
  const days = [];
  for (let i = 0; i < SALON.bookingWindowDays; i++) {
    const iso = Util.addDays(Util.today(), i);
    const open = !!Catalog.hours(iso);
    const staffOk = state.staffId === "any"
      ? Catalog.staffWorking(iso).length > 0
      : Catalog.staffWorking(iso).some((s) => s.id === state.staffId);
    days.push({ iso, available: open && staffOk && Availability.slots(iso, state.serviceId, state.staffId, { online: true }).length > 0 });
  }
  return days;
}

function renderStep2() {
  const s = Catalog.service(state.serviceId);
  $("#chosen-service").innerHTML = `<strong>${Util.esc(s.name)}</strong> · ${Util.fmtDuration(s.duration)} · ${Util.euro(s.price)}`;

  // Esthéticiennes
  const chips = [{ id: "any", name: "Peu importe" }, ...SALON.staff];
  $("#staff-chips").innerHTML = chips
    .map((c) => `<button class="chip ${state.staffId === c.id ? "selected" : ""}" data-id="${c.id}">${Util.esc(c.name)}</button>`)
    .join("");
  $$("#staff-chips .chip").forEach((b) =>
    b.addEventListener("click", () => {
      state.staffId = b.dataset.id;
      state.time = null;
      renderStep2();
    })
  );

  // Jours
  const days = bookableDays();
  if (!state.date || !days.find((d) => d.iso === state.date && d.available)) {
    state.date = days.find((d) => d.available)?.iso || null;
  }
  $("#days").innerHTML = days.map((d) => {
    const dt = Util.parseISO(d.iso);
    return `<button class="day ${d.iso === state.date ? "selected" : ""}" data-iso="${d.iso}" ${d.available ? "" : "disabled"}>
      <div class="dow">${dt.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")}</div>
      <div class="num">${dt.getDate()}</div>
      <div class="mon">${dt.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}</div>
    </button>`;
  }).join("");
  $$("#days .day").forEach((b) =>
    b.addEventListener("click", () => {
      state.date = b.dataset.iso;
      state.time = null;
      renderStep2();
    })
  );
  $("#days .day.selected")?.scrollIntoView({ block: "nearest", inline: "nearest" });

  renderSlots();
}

function renderSlots() {
  const box = $("#slots");
  if (!state.date) {
    box.innerHTML = `<div class="empty">Aucun créneau disponible pour le moment. Appelez-nous au ${Util.esc(SALON.phone)} !</div>`;
    return;
  }
  $("#slots-label").textContent = "Heure — " + Util.fmtDate(state.date, { weekday: "long", day: "numeric", month: "long" });
  const slots = Availability.slots(state.date, state.serviceId, state.staffId, { online: true });
  const groups = [
    ["Matin", (m) => m < 12 * 60],
    ["Après-midi", (m) => m >= 12 * 60 && m < 17 * 60],
    ["Fin de journée", (m) => m >= 17 * 60],
  ];
  box.innerHTML = groups.map(([label, test]) => {
    const list = slots.filter((s) => test(Util.toMin(s.time)));
    if (!list.length) return "";
    return `<div class="slot-group"><h4>${label}</h4><div class="slots">
      ${list.map((s) => `<button class="slot" data-time="${s.time}">${Util.fmtTime(s.time)}</button>`).join("")}
    </div></div>`;
  }).join("") || `<div class="empty">Plus de créneau ce jour-là, essayez un autre jour.</div>`;

  $$("#slots .slot").forEach((b) =>
    b.addEventListener("click", () => {
      state.time = b.dataset.time;
      go(3);
    })
  );
}

/* ---------- Étape 3 : coordonnées ---------- */
function renderSummary(el, booking) {
  const s = Catalog.service(state.serviceId);
  const staffId = booking?.staffId || (state.staffId !== "any" ? state.staffId : null);
  el.innerHTML = `<dl>
    <dt>Soin</dt><dd>${Util.esc(s.name)} (${Util.fmtDuration(s.duration)})</dd>
    <dt>Date</dt><dd>${Util.fmtDate(state.date)}</dd>
    <dt>Heure</dt><dd>${Util.fmtTime(state.time)}</dd>
    <dt>Avec</dt><dd>${staffId ? Util.esc(Catalog.staff(staffId).name) : "La première esthéticienne disponible"}</dd>
    <dt>Tarif</dt><dd>${Util.euro(s.price)} <span class="muted small">(à régler à l'institut)</span></dd>
  </dl>`;
}

$("#contact-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  const err = $("#form-error");
  const phone = f.phone.value.trim();
  const missing = [];
  if (!f.first.value.trim()) missing.push("prénom");
  if (!f.last.value.trim()) missing.push("nom");
  if (phone.replace(/\D/g, "").length < 9) missing.push("téléphone valide");
  if (f.email.value && !f.email.checkValidity()) missing.push("e-mail valide");
  if (missing.length) {
    err.textContent = "Merci d'indiquer : " + missing.join(", ") + ".";
    err.classList.remove("hidden");
    return;
  }
  err.classList.add("hidden");

  // On revérifie que le créneau est toujours libre
  const slot = Availability.slots(state.date, state.serviceId, state.staffId, { online: true }).find((s) => s.time === state.time);
  if (!slot) {
    alert("Désolé, ce créneau vient d'être réservé. Merci d'en choisir un autre.");
    go(2);
    return;
  }
  const service = Catalog.service(state.serviceId);
  state.booking = Store.add({
    date: state.date,
    start: state.time,
    duration: service.duration,
    serviceId: service.id,
    staffId: state.staffId === "any" ? Availability.pickStaff(state.date, slot.staffIds) : state.staffId,
    staffRequested: state.staffId !== "any",
    price: service.price,
    source: "enligne",
    client: {
      name: `${f.first.value.trim()} ${f.last.value.trim()}`,
      phone,
      email: f.email.value.trim(),
    },
    notes: f.notes.value.trim(),
  });
  renderSummary($("#confirm-summary"), state.booking);
  f.reset();
  go(4);
});

/* ---------- Étape 4 : confirmation ---------- */
$("#restart-btn").addEventListener("click", () => {
  Object.assign(state, { serviceId: null, staffId: "any", date: null, time: null, booking: null });
  go(1);
});

$("#ics-btn").addEventListener("click", () => {
  const b = state.booking;
  if (!b) return;
  const s = Catalog.service(b.serviceId);
  const stamp = (iso, hhmm) => iso.replace(/-/g, "") + "T" + hhmm.replace(":", "") + "00";
  const end = Util.toHHMM(Util.toMin(b.start) + b.duration);
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Institut//RDV//FR", "BEGIN:VEVENT",
    `UID:${b.id}@institut`, `DTSTAMP:${now}`,
    `DTSTART:${stamp(b.date, b.start)}`, `DTEND:${stamp(b.date, end)}`,
    `SUMMARY:${s.name} – ${SALON.name}`, `LOCATION:${SALON.address.replace(/,/g, "\\,")}`,
    `DESCRIPTION:Tél. ${SALON.phone}`, "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = "rendez-vous.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

renderServices();
go(1);
