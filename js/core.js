/* ==========================================================
   Fonctions communes : dates, stockage, disponibilités
   ========================================================== */

const pad = (n) => String(n).padStart(2, "0");

const Util = {
  toMin(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  },
  toHHMM(min) {
    return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
  },
  isoDate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },
  today() {
    return Util.isoDate(new Date());
  },
  parseISO(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  },
  addDays(iso, n) {
    const d = Util.parseISO(iso);
    d.setDate(d.getDate() + n);
    return Util.isoDate(d);
  },
  weekday(iso) {
    return Util.parseISO(iso).getDay();
  },
  fmtDate(iso, opts = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) {
    const s = Util.parseISO(iso).toLocaleDateString("fr-FR", opts);
    return s.charAt(0).toUpperCase() + s.slice(1);
  },
  fmtTime(hhmm) {
    return hhmm.replace(":", "h");
  },
  euro(n) {
    return (Number(n) || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  },
  fmtDuration(min) {
    const h = Math.floor(min / 60), m = min % 60;
    if (!h) return `${m} min`;
    return m ? `${h}h${pad(m)}` : `${h}h`;
  },
  esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  },
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },
  nowMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  },
};

const Catalog = {
  service(id) {
    return SALON.services.find((s) => s.id === id);
  },
  staff(id) {
    return SALON.staff.find((s) => s.id === id);
  },
  categories() {
    const map = new Map();
    SALON.services.forEach((s) => {
      if (!map.has(s.cat)) map.set(s.cat, []);
      map.get(s.cat).push(s);
    });
    return map;
  },
  hours(iso) {
    return SALON.hours[Util.weekday(iso)] || null;
  },
  staffWorking(iso) {
    const wd = Util.weekday(iso);
    return SALON.staff.filter((s) => s.days.includes(wd));
  },
};

/* ---------- Stockage ----------
   Les données sont enregistrées dans le navigateur (localStorage).
   Pour que les RDV en ligne des clientes arrivent sur l'ordinateur
   de l'institut, il faut brancher ces fonctions sur un serveur ou une
   base en ligne (Firebase, Supabase…) : seul cet objet est à remplacer. */
const Store = {
  KEY: "salon.bookings.v1",
  RECAP_KEY: "salon.recaps.v1",

  _read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  _write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      alert("Impossible d'enregistrer les données dans ce navigateur.");
    }
  },

  all() {
    return Store._read(Store.KEY, []);
  },
  byDate(iso) {
    return Store.all()
      .filter((b) => b.date === iso)
      .sort((a, b) => a.start.localeCompare(b.start));
  },
  get(id) {
    return Store.all().find((b) => b.id === id);
  },
  add(booking) {
    const list = Store.all();
    const b = { id: Util.uid(), createdAt: new Date().toISOString(), status: "confirme", ...booking };
    list.push(b);
    Store._write(Store.KEY, list);
    return b;
  },
  update(id, patch) {
    const list = Store.all();
    const i = list.findIndex((b) => b.id === id);
    if (i < 0) return null;
    list[i] = { ...list[i], ...patch, updatedAt: new Date().toISOString() };
    Store._write(Store.KEY, list);
    return list[i];
  },
  remove(id) {
    Store._write(Store.KEY, Store.all().filter((b) => b.id !== id));
  },

  recap(iso) {
    return Store._read(Store.RECAP_KEY, {})[iso] || {};
  },
  saveRecap(iso, patch) {
    const all = Store._read(Store.RECAP_KEY, {});
    all[iso] = { ...(all[iso] || {}), ...patch };
    Store._write(Store.RECAP_KEY, all);
  },
};

const STATUS = {
  confirme: { label: "Prévu",   cls: "st-confirme" },
  honore:   { label: "Honoré",  cls: "st-honore" },
  absent:   { label: "Absente", cls: "st-absent" },
  annule:   { label: "Annulé",  cls: "st-annule" },
};

const SOURCE = {
  enligne:   "En ligne",
  surplace:  "Sur place",
  telephone: "Téléphone",
};

/* ---------- Disponibilités ---------- */
const Availability = {
  // Un RDV occupe-t-il le créneau [start, end[ pour cette esthéticienne ?
  isFree(iso, staffId, start, end, ignoreId = null) {
    return !Store.byDate(iso).some((b) => {
      if (b.staffId !== staffId || b.status === "annule" || b.id === ignoreId) return false;
      const bs = Util.toMin(b.start);
      const be = bs + (b.duration || Catalog.service(b.serviceId)?.duration || 30);
      return start < be && bs < end;
    });
  },

  /* Renvoie la liste des créneaux libres : [{ time: "10:15", staffIds: [...] }]
     opts.online : applique le délai minimum de réservation */
  slots(iso, serviceId, staffId = "any", opts = {}) {
    const hours = Catalog.hours(iso);
    const service = Catalog.service(serviceId);
    if (!hours || !service) return [];

    const open = Util.toMin(hours[0]);
    const close = Util.toMin(hours[1]);
    const duration = opts.duration || service.duration;
    const staffList = Catalog.staffWorking(iso).filter((s) => staffId === "any" || s.id === staffId);

    let minStart = open;
    if (iso === Util.today() && !opts.ignoreNow) {
      const notice = opts.online ? SALON.minNoticeMinutes : 0;
      minStart = Math.max(open, Util.nowMinutes() + notice);
    } else if (iso < Util.today() && opts.online) {
      return [];
    }

    const out = [];
    for (let t = open; t + duration <= close; t += SALON.slotStep) {
      if (t < minStart) continue;
      const free = staffList.filter((s) => Availability.isFree(iso, s.id, t, t + duration, opts.ignoreId));
      if (free.length) out.push({ time: Util.toHHMM(t), staffIds: free.map((s) => s.id) });
    }
    return out;
  },

  // Choisit l'esthéticienne la moins chargée parmi celles disponibles
  pickStaff(iso, staffIds) {
    const load = (id) => Store.byDate(iso).filter((b) => b.staffId === id && b.status !== "annule").length;
    return [...staffIds].sort((a, b) => load(a) - load(b))[0];
  },
};
