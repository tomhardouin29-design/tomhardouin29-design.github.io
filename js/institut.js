/* ==========================================================
   Espace institut : planning, RDV sur place, récap du jour
   ========================================================== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ROW = 18; // hauteur en px d'un quart d'heure dans le planning
const view = { date: Util.today(), tab: "planning" };

$$("[data-salon]").forEach((el) => (el.textContent = SALON[el.dataset.salon] || ""));

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}

const durationOf = (b) => b.duration || Catalog.service(b.serviceId)?.duration || 30;
const priceOf = (b) => Number(b.price ?? Catalog.service(b.serviceId)?.price ?? 0);
const serviceName = (b) => Catalog.service(b.serviceId)?.name || "Prestation";
const staffName = (id) => Catalog.staff(id)?.name || "—";
const sum = (arr, f) => arr.reduce((t, x) => t + f(x), 0);

/* ---------- Navigation ---------- */
function setDate(iso) {
  view.date = iso;
  render();
}
$("#prev-day").onclick = () => setDate(Util.addDays(view.date, -1));
$("#next-day").onclick = () => setDate(Util.addDays(view.date, 1));
$("#today-btn").onclick = () => setDate(Util.today());
$("#date-input").onchange = (e) => e.target.value && setDate(e.target.value);

$$(".tab").forEach((t) =>
  t.addEventListener("click", () => {
    view.tab = t.dataset.tab;
    $$(".tab").forEach((x) => x.classList.toggle("active", x === t));
    $("#tab-planning").classList.toggle("hidden", view.tab !== "planning");
    $("#tab-recap").classList.toggle("hidden", view.tab !== "recap");
    render();
  })
);

/* ---------- Rendu général ---------- */
function render() {
  $("#day-title").textContent = Util.fmtDate(view.date, { weekday: "long", day: "numeric", month: "long" });
  $("#date-input").value = view.date;
  if (view.tab === "planning") renderPlanning();
  else renderRecap();
}

/* ---------- Planning ---------- */
function renderPlanning() {
  const list = Store.byDate(view.date);
  const active = list.filter((b) => b.status !== "annule");
  const done = list.filter((b) => b.status === "honore");

  $("#day-kpis").innerHTML = [
    ["Rendez-vous", active.length, `${list.filter((b) => b.source === "enligne" && b.status !== "annule").length} pris en ligne`],
    ["Honorés", done.length, `${list.filter((b) => b.status === "confirme").length} restant(s) à pointer`],
    ["Encaissé", Util.euro(sum(done, priceOf)), `prévu : ${Util.euro(sum(active.filter((b) => b.status !== "absent"), priceOf))}`],
    ["Absences", list.filter((b) => b.status === "absent").length, `${list.filter((b) => b.status === "annule").length} annulation(s)`],
  ].map(([l, v, s]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="sub">${s}</div></div>`).join("");

  renderAgenda(list);
  renderDayList(list);
  renderDemoBox();
}

function renderAgenda(list) {
  const hours = Catalog.hours(view.date);
  $("#closed-msg").classList.toggle("hidden", !!hours);
  $("#agenda-wrap").classList.toggle("hidden", !hours && !list.length);

  const [o, c] = hours || ["09:00", "19:00"];
  const open = Math.floor(Util.toMin(o) / 60) * 60;
  const close = Math.ceil(Util.toMin(c) / 60) * 60;
  const height = ((close - open) / 15) * ROW;
  const working = Catalog.staffWorking(view.date).map((s) => s.id);
  const agenda = $("#agenda");
  agenda.style.gridTemplateColumns = `56px repeat(${SALON.staff.length}, minmax(150px, 1fr))`;
  agenda.style.setProperty("--hour", ROW * 4 + "px");

  let html = `<div class="head"></div>`;
  html += SALON.staff.map((s) => `<div class="head"><span class="dot" style="background:${s.color}"></span>${Util.esc(s.name)}</div>`).join("");

  // Colonne des heures
  html += `<div class="times" style="height:${height}px">`;
  for (let t = open + 60; t < close; t += 60) html += `<span style="top:${((t - open) / 15) * ROW}px">${Util.toHHMM(t)}</span>`;
  html += `</div>`;

  const nowTop = view.date === Util.today() ? ((Util.nowMinutes() - open) / 15) * ROW : -1;

  for (const s of SALON.staff) {
    const off = !working.includes(s.id);
    html += `<div class="col ${off ? "off" : ""}" data-staff="${s.id}" style="height:${height}px">`;
    if (nowTop > 0 && nowTop < height) html += `<div class="now-line" style="top:${nowTop}px"></div>`;
    for (const b of list.filter((x) => x.staffId === s.id)) {
      const top = ((Util.toMin(b.start) - open) / 15) * ROW;
      const h = Math.max((durationOf(b) / 15) * ROW - 2, ROW - 2);
      const end = Util.toHHMM(Util.toMin(b.start) + durationOf(b));
      const tag = b.source === "enligne" ? "🌐" : b.source === "telephone" ? "📞" : "🏠";
      const short = durationOf(b) <= 30;
      html += `<div class="bk ${short ? "short" : ""} ${STATUS[b.status]?.cls || ""}" data-id="${b.id}" style="--c:${s.color};top:${top}px;height:${h}px" title="${b.start}–${end} · ${Util.esc(b.client?.name)} — ${Util.esc(serviceName(b))}">
        <span class="tag">${tag}${b.status === "honore" ? " ✓" : ""}</span>
        ${short
          ? `<span class="t">${b.start}</span> <b>${Util.esc(b.client?.name)}</b> · ${Util.esc(serviceName(b))}`
          : `<span class="t">${b.start}–${end}</span><br><b>${Util.esc(b.client?.name)}</b><br>${Util.esc(serviceName(b))}`}
      </div>`;
    }
    html += `</div>`;
  }
  agenda.innerHTML = html;

  $$(".bk", agenda).forEach((el) =>
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      openBooking({ id: el.dataset.id });
    })
  );
  $$(".col:not(.off)", agenda).forEach((col) =>
    col.addEventListener("click", (e) => {
      const y = e.clientY - col.getBoundingClientRect().top;
      const t = open + Math.floor(y / ROW) * 15;
      openBooking({ staffId: col.dataset.staff, time: Util.toHHMM(t), date: view.date });
    })
  );
}

function renderDayList(list) {
  if (!list.length) {
    $("#day-list").innerHTML = `<div class="empty">Aucun rendez-vous ce jour-là.</div>`;
    return;
  }
  $("#day-list").innerHTML = `<table>
    <thead><tr><th>Heure</th><th>Cliente</th><th>Prestation</th><th>Avec</th><th>Origine</th><th>Statut</th><th class="num">Prix</th></tr></thead>
    <tbody>${list.map((b) => `
      <tr class="clickable" data-id="${b.id}">
        <td>${b.start}</td>
        <td><strong>${Util.esc(b.client?.name)}</strong>${b.client?.phone ? `<br><span class="small muted">${Util.esc(b.client.phone)}</span>` : ""}</td>
        <td>${Util.esc(serviceName(b))}${b.notes ? `<br><span class="small muted">📝 ${Util.esc(b.notes)}</span>` : ""}</td>
        <td>${Util.esc(staffName(b.staffId))}</td>
        <td><span class="badge src">${SOURCE[b.source] || "—"}</span></td>
        <td><span class="badge ${STATUS[b.status]?.cls}">${STATUS[b.status]?.label}</span>${b.payment && b.status === "honore" ? `<br><span class="small muted">${Util.esc(b.payment)}</span>` : ""}</td>
        <td class="num">${Util.euro(priceOf(b))}</td>
      </tr>`).join("")}
    </tbody></table>`;
  $$("#day-list tr[data-id]").forEach((tr) => tr.addEventListener("click", () => openBooking({ id: tr.dataset.id })));
}

/* ---------- Fenêtre de RDV ---------- */
const dlg = $("#bk-dialog");
const F = {
  name: $("#bk-name"), phone: $("#bk-phone"), service: $("#bk-service"), staff: $("#bk-staff"),
  source: $("#bk-source"), date: $("#bk-date"), time: $("#bk-time"), price: $("#bk-price"),
  pay: $("#bk-pay"), notes: $("#bk-notes"),
};
let editing = null;
let priceTouched = false;

// Remplissage des listes
F.service.innerHTML = [...Catalog.categories()].map(([cat, list]) =>
  `<optgroup label="${Util.esc(cat)}">${list.map((s) => `<option value="${s.id}">${Util.esc(s.name)} — ${Util.fmtDuration(s.duration)} — ${Util.euro(s.price)}</option>`).join("")}</optgroup>`
).join("");
F.staff.innerHTML = SALON.staff.map((s) => `<option value="${s.id}">${Util.esc(s.name)}</option>`).join("");
F.pay.innerHTML += SALON.paymentMethods.map((p) => `<option>${Util.esc(p)}</option>`).join("");
$("#bk-status").innerHTML = Object.entries(STATUS).map(([k, v]) =>
  `<input type="radio" name="bk-status" id="st-${k}" value="${k}"><label for="st-${k}">${v.label}</label>`
).join("");
const getStatus = () => $("input[name=bk-status]:checked")?.value || "confirme";
const setStatus = (v) => ($(`#st-${v}`).checked = true);

function fillTimes(wanted) {
  const iso = F.date.value;
  const service = Catalog.service(F.service.value);
  if (!iso || !service) return;
  const hours = Catalog.hours(iso) || ["09:00", "19:00"];
  const open = Util.toMin(hours[0]), close = Util.toMin(hours[1]);
  const opts = [];
  for (let t = open; t + service.duration <= close; t += SALON.slotStep) {
    const free = Availability.isFree(iso, F.staff.value, t, t + service.duration, editing?.id);
    opts.push({ v: Util.toHHMM(t), free });
  }
  if (wanted && !opts.some((o) => o.v === wanted)) {
    opts.push({ v: wanted, free: true, out: true });
    opts.sort((a, b) => a.v.localeCompare(b.v));
  }
  F.time.innerHTML = opts.map((o) =>
    `<option value="${o.v}" ${o.free ? "" : "disabled"}>${o.v}${o.free ? (o.out ? " (hors horaires)" : "") : " — occupé"}</option>`
  ).join("");
  const target = opts.find((o) => o.v === wanted && o.free) || opts.find((o) => o.free && (!wanted || o.v >= wanted)) || opts.find((o) => o.free);
  F.time.value = target ? target.v : "";
  checkWarnings();
}

function checkWarnings() {
  const iso = F.date.value;
  const msgs = [];
  if (!Catalog.hours(iso)) msgs.push("L'institut est normalement fermé ce jour-là.");
  if (!Catalog.staffWorking(iso).some((s) => s.id === F.staff.value)) msgs.push(`${staffName(F.staff.value)} ne travaille normalement pas ce jour-là.`);
  if (!F.time.value) msgs.push(`Aucun créneau libre pour ${staffName(F.staff.value)} ce jour-là avec cette prestation.`);
  const w = $("#bk-warn");
  w.innerHTML = msgs.map(Util.esc).join("<br>");
  w.classList.toggle("hidden", !msgs.length);
  $("#bk-save").disabled = !F.time.value;
}

F.service.onchange = () => {
  if (!priceTouched) F.price.value = Catalog.service(F.service.value).price;
  fillTimes(F.time.value);
};
F.staff.onchange = F.date.onchange = () => fillTimes(F.time.value);
F.price.oninput = () => (priceTouched = true);
$("#bk-status").addEventListener("change", () => {
  if (getStatus() === "honore" && !F.pay.value) F.pay.value = SALON.paymentMethods[0];
});

function openBooking({ id, staffId, time, date }) {
  editing = id ? Store.get(id) : null;
  priceTouched = !!editing;
  const b = editing;
  $("#bk-title").textContent = b ? "Rendez-vous" : "Nouveau rendez-vous";
  $("#bk-delete").classList.toggle("hidden", !b);
  F.name.value = b?.client?.name || "";
  F.phone.value = b?.client?.phone || "";
  F.service.value = b?.serviceId || SALON.services[0].id;
  F.date.value = b?.date || date || view.date;

  const working = Catalog.staffWorking(F.date.value);
  F.staff.value = b?.staffId || staffId || working[0]?.id || SALON.staff[0].id;
  F.source.value = b?.source || "surplace";
  F.price.value = b ? priceOf(b) : Catalog.service(F.service.value).price;
  F.pay.value = b?.payment || "";
  F.notes.value = b?.notes || "";
  setStatus(b?.status || "confirme");

  // Par défaut, le prochain quart d'heure si on crée un RDV pour aujourd'hui
  let wanted = b?.start || time;
  if (!wanted && F.date.value === Util.today()) wanted = Util.toHHMM(Math.ceil(Util.nowMinutes() / 15) * 15);
  fillTimes(wanted);

  $("#bk-meta").textContent = b
    ? `Créé le ${new Date(b.createdAt).toLocaleString("fr-FR")}${b.source === "enligne" ? " par la cliente en ligne" : ""}` +
      (b.client?.email ? ` · ${b.client.email}` : "") + (b.staffRequested ? " · esthéticienne demandée" : "")
    : "";
  dlg.showModal();
  if (!b) F.name.focus();
}

$("#new-btn").onclick = () => openBooking({ date: view.date });
$$("[data-close]", dlg).forEach((b) => (b.onclick = () => dlg.close()));

$("#bk-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!F.name.value.trim()) {
    F.name.focus();
    return;
  }
  if (!F.time.value) return;
  const service = Catalog.service(F.service.value);
  const data = {
    date: F.date.value,
    start: F.time.value,
    duration: service.duration,
    serviceId: service.id,
    staffId: F.staff.value,
    source: F.source.value,
    status: getStatus(),
    price: Number(F.price.value) || 0,
    payment: F.pay.value,
    notes: F.notes.value.trim(),
    client: { ...(editing?.client || {}), name: F.name.value.trim(), phone: F.phone.value.trim() },
  };
  if (editing) Store.update(editing.id, data);
  else Store.add(data);
  dlg.close();
  toast(editing ? "Rendez-vous mis à jour" : "Rendez-vous ajouté");
  if (data.date !== view.date) view.date = data.date;
  render();
});

$("#bk-delete").onclick = () => {
  if (!editing) return;
  if (!confirm(`Supprimer définitivement le RDV de ${editing.client?.name} ?\n(Pour garder une trace, préférez le statut « Annulé ».)`)) return;
  Store.remove(editing.id);
  dlg.close();
  toast("Rendez-vous supprimé");
  render();
};

/* ---------- Récapitulatif ---------- */
function computeRecap(iso) {
  const list = Store.byDate(iso);
  const done = list.filter((b) => b.status === "honore");
  const r = {
    list, done,
    pending: list.filter((b) => b.status === "confirme"),
    absent: list.filter((b) => b.status === "absent"),
    cancelled: list.filter((b) => b.status === "annule"),
    ca: sum(done, priceOf),
    online: list.filter((b) => b.source === "enligne" && b.status !== "annule").length,
    onsite: list.filter((b) => b.source !== "enligne" && b.status !== "annule").length,
    lostRevenue: sum(list.filter((b) => b.status === "absent"), priceOf),
  };
  r.avg = done.length ? r.ca / done.length : 0;
  r.clients = new Set(done.map((b) => (b.client?.name || "").toLowerCase())).size;

  r.byStaff = SALON.staff.map((s) => {
    const mine = done.filter((b) => b.staffId === s.id);
    return { name: s.name, count: mine.length, ca: sum(mine, priceOf), minutes: sum(mine, durationOf) };
  }).filter((x) => x.count || Catalog.staffWorking(iso).some((s) => s.name === x.name));

  const group = (arr, key) => {
    const m = new Map();
    arr.forEach((b) => {
      const k = key(b);
      const g = m.get(k) || { name: k, count: 0, ca: 0 };
      g.count++;
      g.ca += priceOf(b);
      m.set(k, g);
    });
    return [...m.values()].sort((a, b) => b.ca - a.ca);
  };
  r.byPay = group(done, (b) => b.payment || "Non renseigné");
  r.byService = group(done, serviceName);
  return r;
}

function recapText(iso, r, meta) {
  const L = [];
  L.push(`📋 RÉCAP DE LA JOURNÉE — ${SALON.name}`);
  L.push(Util.fmtDate(iso));
  L.push("");
  L.push(`💶 Chiffre d'affaires : ${Util.euro(r.ca)}`);
  L.push(`✅ Prestations réalisées : ${r.done.length} (${r.clients} cliente${r.clients > 1 ? "s" : ""})`);
  L.push(`🧾 Panier moyen : ${Util.euro(r.avg)}`);
  L.push(`🌐 RDV pris en ligne : ${r.online} · 🏠 sur place / tél. : ${r.onsite}`);
  L.push(`❌ Absences : ${r.absent.length}${r.absent.length ? ` (${Util.euro(r.lostRevenue)} non réalisés)` : ""} · Annulations : ${r.cancelled.length}`);
  if (r.pending.length) L.push(`⚠️ RDV non pointés : ${r.pending.length}`);

  if (r.byStaff.length) {
    L.push("", "👩 PAR ESTHÉTICIENNE");
    r.byStaff.forEach((s) => L.push(`• ${s.name} : ${s.count} presta. · ${Util.fmtDuration(s.minutes)} · ${Util.euro(s.ca)}`));
  }
  if (r.byPay.length) {
    L.push("", "💳 ENCAISSEMENTS");
    r.byPay.forEach((p) => L.push(`• ${p.name} : ${Util.euro(p.ca)} (${p.count})`));
    if (meta.cash) L.push(`• Fond de caisse fin de journée : ${Util.euro(meta.cash)}`);
  }
  if (r.byService.length) {
    L.push("", "💆 PRESTATIONS");
    r.byService.forEach((s) => L.push(`• ${s.name} ×${s.count} : ${Util.euro(s.ca)}`));
  }
  const missed = [...r.absent, ...r.cancelled];
  if (missed.length) {
    L.push("", "🚫 ABSENCES & ANNULATIONS");
    missed.forEach((b) => L.push(`• ${b.start} ${b.client?.name} — ${serviceName(b)} (${STATUS[b.status].label.toLowerCase()})${b.client?.phone ? " · " + b.client.phone : ""}`));
  }
  if (r.pending.length) {
    L.push("", "⚠️ À POINTER");
    r.pending.forEach((b) => L.push(`• ${b.start} ${b.client?.name} — ${serviceName(b)} (${staffName(b.staffId)})`));
  }
  if (meta.notes) L.push("", "📝 REMARQUES", meta.notes);
  if (meta.author) L.push("", `Rédigé par ${meta.author}`);
  return L.join("\n");
}

function table(head, rows, foot) {
  if (!rows.length) return `<div class="empty">Rien à signaler.</div>`;
  return `<table><thead><tr>${head.map((h, i) => `<th class="${i ? "num" : ""}">${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i ? "num" : ""}">${c}</td>`).join("")}</tr>`).join("")}</tbody>
    ${foot ? `<tfoot><tr>${foot.map((c, i) => `<td class="${i ? "num" : ""}">${c}</td>`).join("")}</tr></tfoot>` : ""}</table>`;
}

function renderRecap() {
  const iso = view.date;
  const r = computeRecap(iso);
  const meta = Store.recap(iso);

  // Alertes
  let alerts = "";
  if (r.pending.length) {
    alerts += `<div class="alert">⚠️ <strong>${r.pending.length} rendez-vous</strong> n'ont pas encore été pointés (honoré / absente).
      Pensez à les mettre à jour dans le planning avant d'envoyer le récap.</div>`;
  }
  if (!r.list.length) alerts += `<div class="alert info">Aucun rendez-vous enregistré ce jour-là.</div>`;
  $("#recap-alerts").innerHTML = alerts;

  $("#recap-kpis").innerHTML = [
    ["Chiffre d'affaires", Util.euro(r.ca), `${r.done.length} prestation(s)`],
    ["Panier moyen", Util.euro(r.avg), `${r.clients} cliente(s)`],
    ["En ligne / sur place", `${r.online} / ${r.onsite}`, "rendez-vous"],
    ["Absences", r.absent.length, r.absent.length ? `${Util.euro(r.lostRevenue)} perdus` : `${r.cancelled.length} annulation(s)`],
  ].map(([l, v, s]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="sub">${s}</div></div>`).join("");

  $("#recap-staff").innerHTML = table(
    ["Esthéticienne", "Presta.", "Temps", "CA"],
    r.byStaff.map((s) => [Util.esc(s.name), s.count, Util.fmtDuration(s.minutes), Util.euro(s.ca)]),
    r.byStaff.length ? ["Total", r.done.length, Util.fmtDuration(sum(r.byStaff, (s) => s.minutes)), Util.euro(r.ca)] : null
  );
  $("#recap-pay").innerHTML = table(
    ["Mode", "Nb", "Montant"],
    r.byPay.map((p) => [Util.esc(p.name), p.count, Util.euro(p.ca)]),
    r.byPay.length ? ["Total", r.done.length, Util.euro(r.ca)] : null
  );
  $("#recap-services").innerHTML = table(
    ["Prestation", "Nb", "CA"],
    r.byService.map((s) => [Util.esc(s.name), s.count, Util.euro(s.ca)])
  );
  $("#recap-missed").innerHTML = table(
    ["Cliente", "Heure", "Statut"],
    [...r.absent, ...r.cancelled].map((b) => [
      `${Util.esc(b.client?.name)}<br><span class="small muted">${Util.esc(serviceName(b))}${b.client?.phone ? " · " + Util.esc(b.client.phone) : ""}</span>`,
      b.start,
      `<span class="badge ${STATUS[b.status].cls}">${STATUS[b.status].label}</span>`,
    ])
  );

  // Champs libres
  const author = $("#recap-author");
  author.innerHTML = `<option value="">—</option>` + SALON.staff.map((s) => `<option>${Util.esc(s.name)}</option>`).join("");
  author.value = meta.author || "";
  $("#recap-notes").value = meta.notes || "";
  $("#recap-cash").value = meta.cash ?? "";
  $("#recap-sent").textContent = meta.sentAt ? `✓ Envoyé le ${new Date(meta.sentAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}` : "Pas encore envoyé";

  $("#recap-text").textContent = recapText(iso, r, meta);
}

function saveRecapFields() {
  Store.saveRecap(view.date, {
    author: $("#recap-author").value,
    notes: $("#recap-notes").value.trim(),
    cash: $("#recap-cash").value === "" ? null : Number($("#recap-cash").value),
  });
  const meta = Store.recap(view.date);
  $("#recap-text").textContent = recapText(view.date, computeRecap(view.date), meta);
}
["#recap-author", "#recap-notes", "#recap-cash"].forEach((s) => $(s).addEventListener("input", saveRecapFields));

function currentRecapText() {
  saveRecapFields();
  return $("#recap-text").textContent;
}
function markSent() {
  Store.saveRecap(view.date, { sentAt: new Date().toISOString() });
  renderRecap();
}
function confirmPending() {
  const n = computeRecap(view.date).pending.length;
  return !n || confirm(`${n} rendez-vous ne sont pas encore pointés. Envoyer le récap quand même ?`);
}

$("#send-mail").onclick = () => {
  if (!confirmPending()) return;
  const subject = `Récap ${SALON.name} — ${Util.fmtDate(view.date, { weekday: "long", day: "numeric", month: "long" })}`;
  location.href = `mailto:${encodeURIComponent(SALON.recapEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(currentRecapText())}`;
  markSent();
};
$("#send-wa").onclick = () => {
  if (!confirmPending()) return;
  window.open("https://wa.me/?text=" + encodeURIComponent(currentRecapText()), "_blank");
  markSent();
};
$("#copy-recap").onclick = async () => {
  const text = currentRecapText();
  try {
    await navigator.clipboard.writeText(text);
    toast("Récap copié — il n'y a plus qu'à le coller !");
  } catch {
    const r = document.createRange();
    r.selectNodeContents($("#recap-text"));
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    toast("Texte sélectionné : faites Ctrl+C / Cmd+C");
  }
};
$("#print-recap").onclick = () => window.print();
$("#export-csv").onclick = () => {
  const rows = [["Date", "Heure", "Cliente", "Téléphone", "Prestation", "Esthéticienne", "Origine", "Statut", "Prix", "Paiement", "Notes"]];
  Store.byDate(view.date).forEach((b) => rows.push([
    b.date, b.start, b.client?.name, b.client?.phone, serviceName(b), staffName(b.staffId),
    SOURCE[b.source], STATUS[b.status]?.label, priceOf(b).toFixed(2).replace(".", ","), b.payment, b.notes,
  ]));
  const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `recap-${view.date}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

/* ---------- Données de démonstration ---------- */
function renderDemoBox() {
  const box = $("#demo-box");
  if (Store.all().length) {
    box.innerHTML = "";
    return;
  }
  box.innerHTML = `<div class="alert info">Le planning est vide. Vous voulez voir à quoi ça ressemble ?
    <button class="btn sm" id="demo-btn" style="margin-left:8px">Charger des RDV de démonstration</button></div>`;
  $("#demo-btn").onclick = () => {
    loadDemo();
    render();
    toast("Données de démo chargées");
  };
}

function loadDemo() {
  const names = ["Camille Martin", "Julie Bernard", "Sophie Petit", "Laura Durand", "Manon Leroy", "Chloé Moreau",
    "Inès Simon", "Clara Laurent", "Sarah Michel", "Léna Garcia", "Emma David", "Alice Bertrand", "Zoé Roux", "Lucie Fournier"];
  let n = 0;
  for (let d = -3; d <= 4; d++) {
    const iso = Util.addDays(Util.today(), d);
    if (!Catalog.hours(iso)) continue;
    const count = 7 + ((d + 10) % 4);
    for (let i = 0; i < count; i++) {
      const service = SALON.services[(n * 7 + i * 3) % SALON.services.length];
      const slots = Availability.slots(iso, service.id, "any", { ignoreNow: true });
      if (!slots.length) continue;
      const slot = slots[(i * 5 + n) % slots.length];
      const past = d < 0 || (d === 0 && Util.toMin(slot.time) + service.duration < Util.nowMinutes());
      let status = "confirme";
      if (past) status = n % 11 === 3 ? "absent" : n % 13 === 5 ? "annule" : "honore";
      Store.add({
        date: iso, start: slot.time, duration: service.duration, serviceId: service.id,
        staffId: slot.staffIds[n % slot.staffIds.length],
        source: ["enligne", "surplace", "enligne", "telephone"][n % 4],
        status, price: service.price,
        payment: status === "honore" ? SALON.paymentMethods[n % 3] : "",
        client: { name: names[n % names.length], phone: `06 ${pad(10 + (n * 7) % 89)} ${pad((n * 13) % 100)} ${pad((n * 29) % 100)} ${pad((n * 3) % 100)}` },
        notes: n % 9 === 0 ? "Première visite" : "",
      });
      n++;
    }
  }
}

/* ---------- Mises à jour automatiques ---------- */
// Si une réservation arrive depuis un autre onglet, on rafraîchit
window.addEventListener("storage", (e) => {
  if (e.key === Store.KEY && !dlg.open) render();
});
// Ligne « maintenant » du planning
setInterval(() => view.tab === "planning" && !dlg.open && renderPlanning(), 60000);

render();
