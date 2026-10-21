/* Moneeey – Utils, API, formatting */
const qs = (s) => document.querySelector(s);
const qsa = (s) => Array.from(document.querySelectorAll(s));
const num = (v, d = 0) => { const n = Number(v); return v !== null && v !== "" && v !== undefined && Number.isFinite(n) ? n : d; };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safe = (fn) => { try { fn(); } catch (err) { console.error(`[${fn.name || "render"}]`, err); } };

const api = async (url, options) => {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Hiba");
  return data;
};

const toHuf = (amount, currency) => (currency === "EUR" ? amount * num(state.settings.eurHufRate, 1) : amount);
const fmtHUF = new Intl.NumberFormat("hu-HU", { style: "currency", currency: "HUF", maximumFractionDigits: 0 });
const fmtEUR = new Intl.NumberFormat("hu-HU", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const money = (huf) => state.settings.displayCurrency === "EUR" ? fmtEUR.format(huf / num(state.settings.eurHufRate, 1)) : fmtHUF.format(huf);
const HUF = (v) => money(Math.round(v));
const pct = (v, d = 1) => `${num(v).toFixed(d)}%`;
const setToggle = (sel, active) => { const el = qs(sel); if (el) el.classList.toggle("active", active); };

const trashIcon = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 7h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M10 11v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M14 11v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6 7l1 11a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
