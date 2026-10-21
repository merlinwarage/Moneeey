/* Moneeey – Date helpers */
/* ================= Dátum segédek (helyi idő) ================= */
const DAY_MS = 86400000;
const daysInYear = 365.25;
function parseISO(s) { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); }
function today0() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
const toISODate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const daysBetween = (a, b) => Math.round((b - a) / DAY_MS);
const yearsBetween = (a, b) => (b - a) / (DAY_MS * daysInYear);
function addMonthsClamped(date, months) {
  const y = date.getFullYear(), m = date.getMonth() + months, day = date.getDate();
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(day, last));
}
const intervalMonths = (i) => (i === "monthly" ? 1 : i === "quarterly" ? 3 : 12);
const intervalLabel = (i) => (i === "monthly" ? "havi" : i === "quarterly" ? "negyedéves" : "éves");
