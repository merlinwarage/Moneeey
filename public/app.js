/* Moneeey – app.js */
const state = {
  settings: { theme: "dark", displayCurrency: "HUF", eurHufRate: 355.28, incomeGrowth: 3, expenseGrowth: 2, assetGrowth: 6, inflation: 3.5, interestTax: 0 },
  cashflows: [], bonds: [], assets: [], view: "basic",
  charts: { wealth: null, allocation: null, quarterly: null, yearly: null, spending: null, incomeExpense: null, savingsRate: null, incomeBreakdown: null },
  editing: { cashflow: null, bond: null, asset: null },
};

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

function section(name) {
  qsa(".section").forEach((x) => x.classList.toggle("is-visible", x.dataset.screen === name));
  qsa(".nav-link").forEach((x) => x.classList.toggle("is-active", x.dataset.section === name));
  if (name === "settings") fillSettingsForm();
}

/* ================= Űrlap-segédek ================= */
function updateFormHints() {
  const set = (sel, txt) => { const el = qs(sel); if (el) el.textContent = txt; };
  const vis = (sel, on) => { const el = qs(sel); if (el) el.classList.toggle("is-visible", on); };
  const e = state.editing;
  set("#cashflow-edit-hint", e.cashflow ? `Szerkesztés alatt: ${e.cashflow.name}` : "");
  set("#bond-edit-hint", e.bond ? `Szerkesztés alatt: ${e.bond.type} · ${e.bond.series}` : "");
  set("#asset-edit-hint", e.asset ? `Szerkesztés alatt: ${e.asset.name}` : "");
  vis("#cashflow-editbar", Boolean(e.cashflow)); vis("#bond-editbar", Boolean(e.bond)); vis("#asset-editbar", Boolean(e.asset));
  set("#cashflow-submit", e.cashflow ? "Cashflow frissítése" : "Tétel mentése");
  set("#bond-submit", e.bond ? "Papír frissítése" : "Papír mentése");
  set("#asset-submit", e.asset ? "Eszköz frissítése" : "Eszköz mentése");
}
function fillCashflowForm(item) {
  const f = qs("#cashflow-form");
  f.kind.value = item.kind; f.name.value = item.name; f.amount.value = item.amount; f.startDate.value = item.startDate;
  f.interval.value = item.interval; f.recurring.checked = Boolean(item.recurring); f.note.value = item.note || "";
  updateCategoryOptions(); f.category.value = item.category || "";
  state.editing.cashflow = item; updateFormHints(); section("cashflow");
}
function fillBondForm(item) {
  const f = qs("#bond-form");
  f.type.value = item.type; f.series.value = item.series; f.principal.value = item.principal; f.annualRate.value = item.annualRate;
  f.purchaseDate.value = item.purchaseDate; f.maturityDate.value = item.maturityDate;
  f.reinvestInterest.checked = Boolean(item.reinvestInterest);
  f.reinvestRate.value = item.reinvestRate || 0;
  f.liquid.checked = Boolean(item.liquid);
  if (item.couponFrequency) f.couponFrequency.value = item.couponFrequency;
  f.rateSteps.value = item.rateSteps || "";
  state.editing.bond = item; updateFormHints(); section("bonds");
}
function fillAssetForm(item) {
  const f = qs("#asset-form");
  f.name.value = item.name; f.category.value = item.category; f.amount.value = item.amount; f.currency.value = item.currency; f.note.value = item.note || "";
  f.quantity.value = item.quantity ?? ""; f.price.value = item.price ?? "";
  state.editing.asset = item; syncAssetForm(); updateFormHints(); section("assets");
}
function resetEdit(type) { state.editing[type] = null; updateFormHints(); }
function fillSettingsForm() {
  const f = qs("#settings-form"); if (!f) return;
  f.displayCurrency.value = state.settings.displayCurrency;
  f.eurHufRate.value = String(state.settings.eurHufRate);
  f.incomeGrowth.value = String(state.settings.incomeGrowth);
  f.expenseGrowth.value = String(state.settings.expenseGrowth);
  f.assetGrowth.value = String(state.settings.assetGrowth);
  f.inflation.value = String(state.settings.inflation);
  f.interestTax.value = String(state.settings.interestTax ?? 0);
}
function syncAssetForm() {
  const f = qs("#asset-form"); if (!f) return;
  const isEq = f.category.value === "stock" || f.category.value === "etf";
  qsa("#asset-form .asset-qp").forEach((el) => (el.style.display = isEq ? "" : "none"));
  const q = num(f.quantity.value, 0), p = num(f.price.value, 0);
  const auto = isEq && q > 0 && p > 0;
  f.amount.readOnly = auto;
  if (auto) f.amount.value = String(Math.round(q * p * 100) / 100);
}

/* ================= Állampapír-modell =================
   - Fix MÁP / Bónusz MÁP: negyedéves; kifizetési napok a lejárati naphoz igazodnak
   - Az első (törtidős) kamat napra arányos (nap/365), a többi: éves kamat / periódusszám
   - MÁP Plusz: évente egyszer, automatikusan tőkésítve (kamatos kamat, a papíron belül)
   - PMÁP / lejáratkor fizető: nincs időközi kifizetés, kamat lejáratkor (egyszerű kamat)
   - ÚJRABEFEKTETÉS: csak a MAI NAP UTÁNI kuponokra számol (a múltbeli kuponokból már vettél papírt,
     amit külön tételként felvettél). A MÁP Plusz kivétel: ott a tőkésítés a papíron belül történik.
   - Sávos kamat: "Kamatsávok" mező; Kamatadó: Beállítások */
const taxFactor = () => 1 - Math.min(100, Math.max(0, num(state.settings.interestTax))) / 100;
function rateSteps(b) {
  return String(b.rateSteps || "").split(/[;,\s]+/).filter((x) => x !== "").map(Number).filter((x) => Number.isFinite(x) && x >= 0);
}
function holdingYear(pur, date) {
  let y = Math.max(0, date.getFullYear() - pur.getFullYear() - 1);
  while (addMonthsClamped(pur, 12 * (y + 1)) <= date) y++;
  return y;
}
function rateAt(b, date) {
  const st = rateSteps(b); if (!st.length) return num(b.annualRate);
  return st[Math.min(holdingYear(parseISO(b.purchaseDate), date), st.length - 1)];
}
function grossInterest(b, from, to) {
  const P = num(b.principal), pur = parseISO(b.purchaseDate), stepped = rateSteps(b).length > 0;
  let total = 0, cur = from, guard = 0;
  while (cur < to && guard++ < 200) {
    const y = holdingYear(pur, cur);
    const boundary = stepped ? addMonthsClamped(pur, 12 * (y + 1)) : to;
    const end = boundary < to && boundary > cur ? boundary : to;
    total += (P * rateAt(b, cur) / 100 * daysBetween(cur, end)) / 365;
    cur = end;
  }
  return total;
}
function bondKind(b) {
  const t = String(b.type || "").toLowerCase();
  if (t.includes("plusz")) return "mapplus";
  if (t.includes("bónusz") || t.includes("bonusz")) return "bonus";
  if (t.includes("fix")) return "fix";
  if (t.includes("prémium") || t.includes("premium") || t.includes("pmáp") || t.includes("pmap")) return "pmap";
  return "other";
}
function bondFrequencyMonths(b) {
  switch (bondKind(b)) {
    case "fix": case "bonus": return 3;
    case "mapplus": return 12;
    case "pmap": return 0;
    default: {
      const m = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12, at_maturity: 0, atmaturity: 0 }[b.couponFrequency];
      return m === undefined ? 12 : m;
    }
  }
}
function effectiveReinvest(b) {
  if (bondKind(b) === "mapplus") return { on: true, rate: rateAt(b, today0()) };
  const on = num(b.reinvestInterest) === 1 && num(b.reinvestRate) > 0;
  return { on, rate: on ? num(b.reinvestRate) : 0 };
}
function couponSchedule(b) {
  const f = bondFrequencyMonths(b); if (!f) return [];
  const P = num(b.principal), n = 12 / f, tf = taxFactor();
  const purchase = parseISO(b.purchaseDate), mat = parseISO(b.maturityDate);
  if (!(mat > purchase)) return [];
  const dates = [];
  for (let k = 0; k < 2000; k++) { const d = addMonthsClamped(mat, -k * f); if (d <= purchase) break; dates.push(d); }
  dates.reverse();
  return dates.map((d, i) => {
    const k = dates.length - 1 - i;
    let periodStart = addMonthsClamped(mat, -(k + 1) * f);
    let amount = (P * rateAt(b, periodStart) / 100 / n) * tf;
    if (i === 0 && periodStart < purchase) { periodStart = purchase; amount = grossInterest(b, purchase, d) * tf; }
    return { date: d, amount, periodStart, isMaturity: d.getTime() === mat.getTime() };
  });
}
// felhalmozott (ki nem fizetett) kamat, újrabefektetett egyenleg (csak jövőbeli kuponokból), kifizetett készpénz-kupon
function bondParts(b, d) {
  const z = { accrued: 0, reinv: 0, paidCash: 0 };
  if (!b.enabled) return z;
  const purchase = parseISO(b.purchaseDate), mat = parseISO(b.maturityDate);
  if (d < purchase) return z;
  const f = bondFrequencyMonths(b);
  if (!f) {
    const end = d >= mat ? mat : d;
    const interest = grossInterest(b, purchase, end) * taxFactor();
    return d >= mat ? { accrued: 0, reinv: 0, paidCash: interest } : { accrued: interest, reinv: 0, paidCash: 0 };
  }
  const sched = couponSchedule(b), rv = effectiveReinvest(b), isPlus = bondKind(b) === "mapplus";
  const rp = rv.on ? (rv.rate / 100 / (12 / f)) * taxFactor() : 0;
  const rpAt = (when) => (isPlus ? (rateAt(b, when) / 100 / (12 / f)) * taxFactor() : rp);
  const t0 = today0();
  let bal = 0, cash = 0, next = null;
  for (const c of sched) {
    if (c.date <= d) {
      if (rv.on) { if (isPlus || c.date > t0) bal = bal * (1 + rpAt(c.periodStart)) + c.amount; }
      else cash += c.amount;
    } else { next = c; break; }
  }
  let accrued = 0, reinvAccr = 0;
  if (next) {
    const len = Math.max(1, daysBetween(next.periodStart, next.date));
    const frac = Math.min(1, Math.max(0, daysBetween(next.periodStart, d) / len));
    accrued = next.amount * frac;
    reinvAccr = bal * rpAt(next.periodStart) * frac;
  }
  return { accrued, reinv: bal + reinvAccr, paidCash: cash };
}
const isActiveBond = (b, d) => b.enabled && parseISO(b.purchaseDate) <= d && d < parseISO(b.maturityDate);
const totalBondPrincipal = () => state.bonds.reduce((s, b) => s + (b.enabled ? num(b.principal) : 0), 0);
function accruedInterest() { const t = today0(); return state.bonds.reduce((s, b) => s + bondParts(b, t).accrued, 0); }
function reinvestedBalanceNow() { const t = today0(); return state.bonds.reduce((s, b) => s + bondParts(b, t).reinv, 0); }
function bondYieldParts(b) {
  const t = today0(); if (!isActiveBond(b, t)) return { base: 0, reinv: 0 };
  const rv = effectiveReinvest(b);
  return { base: num(b.principal) * rateAt(b, t) / 100 * taxFactor(), reinv: rv.on ? bondParts(b, t).reinv * rv.rate / 100 * taxFactor() : 0 };
}
const annualBondBaseYield = () => state.bonds.reduce((s, b) => s + bondYieldParts(b).base, 0);
const annualBondReinvestYield = () => state.bonds.reduce((s, b) => s + bondYieldParts(b).reinv, 0);
const annualBondYield = () => annualBondBaseYield() + annualBondReinvestYield();

function bondEvents() {
  const today = today0(), horizon = addMonthsClamped(today, 96);
  const out = [];
  for (const b of state.bonds) {
    if (!b.enabled) continue;
    const mat = parseISO(b.maturityDate), P = num(b.principal), f = bondFrequencyMonths(b), rv = effectiveReinvest(b);
    const label = `${b.type} · ${b.series}`;
    const kindLabel = f === 1 ? "Havi kupon" : f === 3 ? "Negyedéves kupon" : f === 6 ? "Féléves kupon" : "Éves kamat";
    const sched = couponSchedule(b);
    for (const c of sched) {
      if (c.date < today || c.date > horizon || c.isMaturity) continue;
      out.push({ label, kind: rv.on ? `${kindLabel} · újrabefektetés` : kindLabel, type: "coupon", date: c.date, amount: Math.round(c.amount), couponPart: c.amount });
    }
    if (mat >= today && mat <= horizon) {
      const parts = bondParts(b, mat);
      const lastCoupon = sched.length ? sched[sched.length - 1].amount : 0;
      const interestPart = f ? (rv.on ? parts.reinv : lastCoupon) : parts.paidCash;
      out.push({ label, kind: rv.on ? "Lejárat · tőke + újrabefektetett kamat" : "Lejárat · tőke + utolsó kamat", type: "maturity", date: mat, amount: Math.round(P + interestPart), couponPart: f ? lastCoupon : interestPart, bond: b });
    }
  }
  return out.sort((a, b) => a.date - b.date).slice(0, 60);
}
function nextCouponInfo() {
  const e = bondEvents().find((x) => x.couponPart > 0);
  return e ? `${toISODate(e.date)} · ${HUF(e.couponPart)}` : "Nincs";
}
function thisYearCoupons() {
  const y = new Date().getFullYear(); let s = 0;
  for (const b of state.bonds) {
    if (!b.enabled) continue;
    const sched = couponSchedule(b);
    if (sched.length) s += sched.filter((c) => c.date.getFullYear() === y).reduce((a, c) => a + c.amount, 0);
    else { const mat = parseISO(b.maturityDate); if (mat.getFullYear() === y) s += bondParts(b, mat).paidCash; }
  }
  return s;
}

/* ================= Cashflow ================= */
const normCat = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const monthBounds = () => { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth(), 1), new Date(n.getFullYear(), n.getMonth() + 1, 0)]; };
function cashflowMonthly(kind) {
  const [ms, me] = monthBounds();
  return state.cashflows.filter((c) => c.enabled && c.kind === kind).reduce((s, c) => {
    const start = parseISO(c.startDate);
    if (c.recurring) return start > me ? s : s + num(c.amount) / intervalMonths(c.interval);
    return start >= ms && start <= me ? s + num(c.amount) : s;
  }, 0);
}
function monthlyBondCouponIncome() {
  const t = today0();
  return state.bonds.reduce((s, b) => {
    if (!isActiveBond(b, t) || !bondFrequencyMonths(b) || effectiveReinvest(b).on) return s;
    return s + num(b.principal) * rateAt(b, t) / 100 / 12 * taxFactor();
  }, 0);
}
const monthlyIncome = () => cashflowMonthly("income") + monthlyBondCouponIncome();
const monthlyExpense = () => cashflowMonthly("expense");
const monthlyNet = () => monthlyIncome() - monthlyExpense();
const savingsRate = () => { const inc = monthlyIncome(); return inc > 0 ? ((inc - monthlyExpense()) / inc) * 100 : 0; };

/* ================= Eszközök / vagyon (nézettől független) ================= */
const assetHuf = (a) => toHuf(num(a.amount), a.currency);
const sumCat = (cat) => state.assets.filter((a) => a.category === cat).reduce((s, a) => s + assetHuf(a), 0);
const growthAssets = () => state.assets.filter((a) => a.category === "etf" || a.category === "stock");
const investableAssets = () => growthAssets().reduce((s, a) => s + assetHuf(a), 0);
const annualAssetYield = () => investableAssets() * num(state.settings.assetGrowth) / 100;
const bondTotalValue = () => totalBondPrincipal() + accruedInterest() + reinvestedBalanceNow();
const grossAssetsTotal = () => sumCat("cash") + sumCat("bank") + sumCat("etf") + sumCat("stock") + sumCat("other") + bondTotalValue();
const currentNetWorth = () => grossAssetsTotal() - Math.abs(sumCat("liability"));
function liquidTotal() {
  const la = sumCat("cash") + sumCat("bank");
  const lb = state.bonds.filter((b) => b.enabled && num(b.liquid) === 1).reduce((s, b) => s + num(b.principal), 0);
  return la + lb;
}
function theoreticalYield() { const annual = annualBondYield() + annualAssetYield(); return { annual, monthly: annual / 12, daily: annual / daysInYear }; }

/* ================= Előrejelzés ================= */
const deflate = (nominal, years) => nominal / Math.pow(1 + num(state.settings.inflation) / 100, years);
function futureCashflows(horizonEnd) {
  const now = today0(), out = [];
  for (const c of state.cashflows) {
    if (!c.enabled) continue;
    const sign = c.kind === "income" ? 1 : -1;
    const g = num(c.kind === "income" ? state.settings.incomeGrowth : state.settings.expenseGrowth) / 100;
    const start = parseISO(c.startDate);
    const push = (d) => out.push({ date: d, amount: sign * num(c.amount) * Math.pow(1 + g, Math.max(0, yearsBetween(now, d))) });
    if (!c.recurring) { if (start > now && start <= horizonEnd) push(start); continue; }
    const step = intervalMonths(c.interval);
    for (let k = 0; k < 2000; k++) { const d = addMonthsClamped(start, k * step); if (d > horizonEnd) break; if (d > now) push(d); }
  }
  return out;
}
function forecastSeries(stepMonths, count) {
  const now = today0(), base = currentNetWorth();
  const dates = []; for (let i = 1; i <= count; i++) dates.push(addMonthsClamped(now, i * stepMonths));
  const flows = futureCashflows(dates[dates.length - 1]);
  const sumParts = (d) => state.bonds.reduce((s, b) => { const p = bondParts(b, d); return s + p.accrued + p.reinv + p.paidCash; }, 0);
  const bondNow = sumParts(now);
  const g = num(state.settings.assetGrowth) / 100, inv = investableAssets();
  const nominal = [], real = [], labels = [];
  for (const d of dates) {
    const years = yearsBetween(now, d);
    const contrib = flows.filter((f) => f.date <= d).reduce((s, f) => s + f.amount, 0);
    const v = base + (sumParts(d) - bondNow) + inv * (Math.pow(1 + g, years) - 1) + contrib;
    nominal.push(Math.round(v)); real.push(Math.round(deflate(v, years))); labels.push(ym(d));
  }
  return { labels, nominal, real };
}

/* ================= Bontások ================= */
const INCOME_LABELS = { fizetes: "Fizetés", mellekjovedelem: "Mellékjövedelem", betetkamat: "Betét kamat", kamatjovedelem: "Kamatjövedelem", egyebbevetel: "Egyéb bevétel" };
const EXPENSE_LABELS = { altalanoskiadas: "Általános kiadás", elelmiszer: "Élelmiszer", lakas: "Lakás", kozlekedes: "Közlekedés", szorakozas: "Szórakozás", egeszsegugy: "Egészségügy", oktatas: "Oktatás", egyebkiadas: "Egyéb kiadás" };
const translateCategory = (cat) => INCOME_LABELS[normCat(cat)] || EXPENSE_LABELS[normCat(cat)] || cat;
function breakdown(kind) {
  const labels = kind === "income" ? INCOME_LABELS : EXPENSE_LABELS;
  const fallback = kind === "income" ? "Egyéb bevétel" : "Egyéb kiadás";
  const out = {}; Object.values(labels).forEach((l) => (out[l] = 0));
  const [ms, me] = monthBounds();
  for (const c of state.cashflows) {
    if (c.kind !== kind || !c.enabled) continue;
    const start = parseISO(c.startDate);
    let amt = 0;
    if (c.recurring) { if (start <= me) amt = num(c.amount) / intervalMonths(c.interval); }
    else if (start >= ms && start <= me) amt = num(c.amount);
    out[labels[normCat(c.category)] || fallback] += amt;
  }
  if (kind === "income") out["Állampapír kupon (havi átlag)"] = monthlyBondCouponIncome();
  return out;
}
const spendingBreakdown = () => breakdown("expense");
const incomeBreakdown = () => breakdown("income");

/* ================= KPI-k ================= */
function renderKpis() {
  const set = (sel, v) => { const el = qs(sel); if (el) el.textContent = v; };
  const y = theoreticalYield();
  set("#net-worth", money(currentNetWorth()));
  set("#daily-yield", money(y.daily)); set("#monthly-yield", money(y.monthly)); set("#yearly-yield", money(y.annual));
  set("#accrued-interest", money(accruedInterest()));
  set("#next-coupon", nextCouponInfo());
  set("#year-coupon", money(thisYearCoupons()));
  set("#fx-side", `1 EUR = ${num(state.settings.eurHufRate).toFixed(2)} HUF`);
  set("#view-side", state.view === "basic" ? "Alap" : "Teljes");
  set("#savings-rate", `${savingsRate().toFixed(1)}%`);
  set("#monthly-net-display", HUF(monthlyNet()));
  const liquid = liquidTotal(), exp = monthlyExpense(), target = exp * 6;
  set("#emergency-fund", target > 0 ? `${((liquid / target) * 100).toFixed(0)}%` : "N/A");
  set("#monthly-income-display", HUF(monthlyIncome()));
  set("#monthly-expense-display", HUF(exp));
  set("#liquid-assets-display", HUF(liquid));
  set("#emergency-target", HUF(target));
  set("#months-covered", exp > 0 ? (liquid / exp).toFixed(1) : "–");
}

/* ================= Listák ================= */
const categoryLabel = (c) => ({ cash: "Készpénz", bank: "Bankszámla", etf: "ETF", stock: "Részvény", other: "Egyéb eszköz", liability: "Tartozás" }[c] || c);
function listHtml(items, map, empty = "Nincs adat.") { return items.length ? items.map(map).join("") : `<div class="muted empty">${empty}</div>`; }
function renderLists() {
  const cashflowHtml = listHtml(state.cashflows, (x) => `
    <div class="list-item is-editable" data-edit-kind="cashflow" data-id="${x.id}">
      <div><strong>${esc(x.name)}</strong><div class="muted">${x.category ? translateCategory(x.category) : "Nincs kategória"} · ${x.recurring ? "Ismétlődő · " + intervalLabel(x.interval) : "Egyszeri"} · ${esc(x.startDate)}</div></div>
      <div><span class="badge">${x.kind === "income" ? "Bevétel" : "Kiadás"}</span></div>
      <div class="amount-stack"><div class="amount-pill ${x.kind === "income" ? "income" : "expense"}">${money(num(x.amount))}</div>
      <button class="icon-button" aria-label="Törlés" title="Törlés" data-kind="cashflow" data-id="${x.id}">${trashIcon}</button></div>
    </div>`, "Még nincs cashflow tétel.");
  const bondHtml = listHtml(state.bonds, (x) => {
    const rv = effectiveReinvest(x), st = rateSteps(x);
    const note = (bondKind(x) === "mapplus" ? "Automatikus tőkésítés" : rv.on ? `Újrabefektetés ${rv.rate.toFixed(2)}%` : "Nincs újrabefektetés") + (st.length ? ` · sávok: ${st.join(" / ")}%` : "");
    return `
    <div class="list-item is-editable" data-edit-kind="bond" data-id="${x.id}">
      <div><strong>${esc(x.type)} ${esc(x.series)}</strong><div class="muted">${esc(x.purchaseDate)} → ${esc(x.maturityDate)}</div><div class="breakdown-note">${note}</div></div>
      <div><span class="badge">${rateAt(x, today0()).toFixed(2)}%</span></div>
      <div class="amount-stack"><div class="amount-pill income">${money(num(x.principal))}</div>
      <button class="icon-button" aria-label="Törlés" title="Törlés" data-kind="bond" data-id="${x.id}">${trashIcon}</button></div>
    </div>`;
  }, "Még nincs állampapír.");
  const assetHtml = listHtml(state.assets, (x) => {
    const qp = num(x.quantity) > 0 && num(x.price) > 0 ? ` · ${num(x.quantity)} db × ${num(x.price)} ${esc(x.currency)}` : "";
    return `
    <div class="list-item is-editable" data-edit-kind="asset" data-id="${x.id}">
      <div><strong>${esc(x.name)}</strong><div class="muted">${categoryLabel(x.category)} · ${esc(x.currency)}${qp}</div></div>
      <div class="breakdown-note">${x.category === "liability" ? "Kötelezettség" : "Eszköz"}</div>
      <div class="amount-stack"><div class="amount-pill ${x.category === "liability" ? "expense" : "income"}">${money(assetHuf(x))}</div>
      <button class="icon-button" aria-label="Törlés" title="Törlés" data-kind="asset" data-id="${x.id}">${trashIcon}</button></div>
    </div>`;
  }, "Még nincs extra eszköz.");
  const calendarHtml = listHtml(bondEvents(), (e) => `
    <div class="calendar-item"><div><strong>${esc(e.label)}</strong><div class="muted">${e.kind}</div></div>
    <div class="date-badge">${toISODate(e.date)}</div><div class="value">${money(e.amount)}</div></div>`, "Nincs közelgő állampapír esemény.");
  const put = (sel, html) => { const el = qs(sel); if (el) el.innerHTML = html; };
  put("#cashflow-list", cashflowHtml); put("#cashflow-list-editor", cashflowHtml);
  put("#bond-list", bondHtml); put("#bond-list-editor", bondHtml);
  put("#asset-list", assetHtml);
  put("#bond-calendar", `<div class="calendar-list">${calendarHtml}</div>`);
}

/* ================= Chartok ================= */
const TXT = "#edf3ef", MUTED = "#97a59d", GRID = "rgba(255,255,255,.06)";
const axisOpts = () => ({
  x: { ticks: { color: MUTED }, grid: { color: GRID } },
  y: { ticks: { color: MUTED, callback: (v) => money(v) }, grid: { color: GRID } },
});
function renderCharts() {
  Object.keys(state.charts).forEach((k) => { if (state.charts[k]) { state.charts[k].destroy(); state.charts[k] = null; } });
  const mk = (id, cfg) => { const c = document.getElementById(id); return c ? new Chart(c, cfg) : null; };
  const step = (fn) => safe(fn);

  step(function wealthChart() {
    const w = forecastSeries(1, 12), now = currentNetWorth();
    state.charts.wealth = mk("wealth-chart", { type: "bar", data: { labels: ["Jelenleg", ...w.labels], datasets: [
      { label: "Vagyon (nominális)", data: [Math.round(now), ...w.nominal], backgroundColor: "rgba(121,201,193,.55)", borderColor: "rgba(121,201,193,1)", borderWidth: 1, borderRadius: 8 },
      { label: "Vagyon (reálérték, inflációval)", data: [Math.round(now), ...w.real], backgroundColor: "rgba(255,210,122,.35)", borderColor: "rgba(255,210,122,1)", borderWidth: 1, borderRadius: 8 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: TXT } } }, scales: axisOpts() } });
  });
  step(function allocationChart() {
    const alloc = {
      "Készpénz": sumCat("cash"), "Bankszámla": sumCat("bank"), "ETF": sumCat("etf"), "Részvény": sumCat("stock"), "Egyéb eszköz": sumCat("other"),
      "Állampapír (tőke)": totalBondPrincipal(), "Állampapír kamat (felhalm. + újrabef.)": accruedInterest() + reinvestedBalanceNow(),
    };
    const keys = Object.keys(alloc).filter((k) => alloc[k] > 0);
    state.charts.allocation = mk("allocation-chart", { type: "doughnut", data: { labels: keys, datasets: [{ data: keys.map((k) => Math.round(alloc[k])), backgroundColor: ["#7fd4cc", "#ffd27a", "#7487ea", "#be8cff", "#79b8ff", "#8fcb6f", "#b6e08f"], borderColor: "#d9e1dc", borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: 56, plugins: { legend: { position: "top", labels: { color: TXT, boxWidth: 14, padding: 12 } }, tooltip: { callbacks: { label: (c) => `${c.label}: ${money(c.parsed)}` } } } } });
  });
  step(function quarterlyChart() {
    const q = forecastSeries(3, 8);
    state.charts.quarterly = mk("quarterly-chart", { type: "line", data: { labels: q.labels, datasets: [
      { label: "Negyedéves vagyon (nominális)", data: q.nominal, borderColor: "#7fd4cc", backgroundColor: "rgba(127,212,204,.18)", fill: true, tension: 0.28, pointRadius: 4, pointHoverRadius: 6 },
      { label: "Reálérték (inflációval korrigálva)", data: q.real, borderColor: "#ffd27a", backgroundColor: "rgba(255,210,122,.12)", borderDash: [6, 4], fill: false, tension: 0.28, pointRadius: 3, pointHoverRadius: 5 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: TXT } } }, scales: axisOpts() } });
  });
  step(function yearlyChart() {
    const y = forecastSeries(12, 6);
    state.charts.yearly = mk("yearly-chart", { type: "line", data: { labels: y.labels, datasets: [
      { label: "Éves vagyon (nominális)", data: y.nominal, borderColor: "#7487ea", backgroundColor: "rgba(116,135,234,.18)", fill: true, tension: 0.24, pointRadius: 4, pointHoverRadius: 6 },
      { label: "Reálérték (inflációval korrigálva)", data: y.real, borderColor: "#ffd27a", backgroundColor: "rgba(255,210,122,.12)", borderDash: [6, 4], fill: false, tension: 0.24, pointRadius: 3, pointHoverRadius: 5 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: TXT } } }, scales: axisOpts() } });
  });
  const donut = (id, data, colors) => {
    const parts = Object.entries(data).filter(([, v]) => v > 0), total = parts.reduce((s, [, v]) => s + v, 0);
    if (!total) return null;
    return mk(id, { type: "doughnut", data: { labels: parts.map((p) => p[0]), datasets: [{ data: parts.map((p) => Math.round(p[1])), backgroundColor: parts.map((_, i) => colors[i % colors.length]), borderColor: "#d9e1dc", borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: 50, plugins: { legend: { position: "bottom", labels: { color: TXT, boxWidth: 12, padding: 10, font: { size: 10 } } },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${HUF(c.parsed)} (${((c.parsed / total) * 100).toFixed(1)}%)` } } } } });
  };
  step(function spendingChart() { state.charts.spending = donut("spending-chart", spendingBreakdown(), ["#ff9898", "#ffb357", "#ffd27a", "#ff7f88", "#be8cff", "#8fcb6f", "#7487ea", "#79b8ff"]); });
  step(function incomeChart() { state.charts.incomeBreakdown = donut("income-breakdown-chart", incomeBreakdown(), ["#8fcb6f", "#7fd4cc", "#ffd27a", "#7487ea", "#be8cff", "#79b8ff"]); });
  step(function incomeExpenseChart() {
    state.charts.incomeExpense = mk("income-expense-chart", { type: "bar", data: { labels: ["Bevétel összesen", "Kiadás összesen"], datasets: [{ label: "Havi", data: [Math.round(monthlyIncome()), Math.round(monthlyExpense())], backgroundColor: ["rgba(136,223,123,.6)", "rgba(255,112,112,.6)"], borderColor: ["rgba(136,223,123,1)", "rgba(255,112,112,1)"], borderWidth: 1, borderRadius: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: TXT } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${HUF(c.parsed.y)}` } } }, scales: axisOpts() } });
  });
  step(function savingsChart() {
    const sr = savingsRate();
    state.charts.savingsRate = mk("savings-rate-chart", { type: "bar", data: { labels: ["Megtakarítási ráta"], datasets: [
      { label: "Jelenlegi", data: [sr], backgroundColor: sr >= 20 ? "rgba(136,223,123,.7)" : sr >= 10 ? "rgba(255,210,122,.7)" : "rgba(255,112,112,.7)", borderRadius: 6, barThickness: 40 },
      { label: "Cél (20%)", data: [20], backgroundColor: "rgba(121,201,193,.15)", borderColor: "rgba(121,201,193,.4)", borderWidth: 1, borderDash: [6, 4], borderRadius: 6, barThickness: 40 }] },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: TXT } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.x.toFixed(1)}%` } } },
        scales: { x: { min: Math.min(0, sr), max: 100, ticks: { color: MUTED, callback: (v) => v + "%" }, grid: { color: GRID } }, y: { ticks: { color: MUTED }, grid: { display: false } } } } });
  });
}

/* ================= Kimutatások ================= */
function renderBalanceSheet() {
  const c = qs("#balance-sheet-body"); if (!c) return;
  const principal = totalBondPrincipal(), acc = accruedInterest(), rb = reinvestedBalanceNow();
  const liab = Math.abs(sumCat("liability"));
  const totalAssets = grossAssetsTotal();
  const row = (l, v) => `<div class="balance-row"><span>${l}</span><span class="balance-val">${HUF(v)}</span></div>`;
  c.innerHTML = `<div class="balance-section"><h3 class="balance-title">Eszközök</h3>
    ${row("Készpénz", sumCat("cash"))}${row("Bankszámla", sumCat("bank"))}${row("ETF", sumCat("etf"))}${row("Részvények", sumCat("stock"))}${row("Egyéb eszközök", sumCat("other"))}
    ${row("Állampapírok (tőke)", principal)}${row("Felhalmozott kamat", acc)}${row("Újrabefektetett kamat", rb)}
    <div class="balance-row balance-total"><span><strong>Eszközök összesen</strong></span><span class="balance-val"><strong>${HUF(totalAssets)}</strong></span></div></div>
    <div class="balance-divider"></div>
    <div class="balance-section"><h3 class="balance-title">Kötelezettségek</h3>${row("Tartozások", liab)}
    <div class="balance-row balance-total"><span><strong>Kötelezettségek összesen</strong></span><span class="balance-val"><strong>${HUF(liab)}</strong></span></div></div>
    <div class="balance-divider"></div>
    <div class="balance-net-worth"><span><strong>Tiszta vagyon</strong></span><span class="balance-val"><strong>${HUF(totalAssets - liab)}</strong></span></div>`;
}
function renderIncomeStatement() {
  const c = qs("#income-statement-body"); if (!c) return;
  const inc = monthlyIncome(), exp = monthlyExpense(), net = inc - exp;
  const rows = (o, cls) => Object.entries(o).filter(([, v]) => v > 0).map(([k, v]) => `<div class="balance-row"><span>${k}</span><span class="balance-val ${cls}">${HUF(v)}</span></div>`).join("");
  c.innerHTML = `<div class="balance-section"><h3 class="balance-title">Havi jövedelemkimutatás</h3>
    <div class="balance-row balance-total"><span><strong>Bevételek összesen</strong></span><span class="balance-val income-val"><strong>${HUF(inc)}</strong></span></div>${rows(incomeBreakdown(), "income-val")}</div>
    <div class="balance-divider"></div>
    <div class="balance-section"><h3 class="balance-title">Havi kiadások</h3>
    <div class="balance-row balance-total"><span><strong>Kiadások összesen</strong></span><span class="balance-val expense-val"><strong>${HUF(exp)}</strong></span></div>${rows(spendingBreakdown(), "expense-val")}</div>
    <div class="balance-divider"></div>
    <div class="balance-net-worth ${net >= 0 ? "positive" : "negative"}"><span><strong>Nettó havi eredmény</strong></span><span class="balance-val"><strong>${HUF(net)}</strong></span></div>`;
}
function renderBondPortfolio() {
  const c = qs("#bond-portfolio-body"); if (!c) return;
  const enabled = state.bonds.filter((b) => b.enabled);
  if (!enabled.length) { c.innerHTML = `<div class="muted">Nincs aktív állampapír.</div>`; return; }
  const t = today0();
  const rows = enabled.map((b) => {
    const f = bondFrequencyMonths(b), sched = couponSchedule(b);
    const nextC = sched.find((x) => x.date >= t);
    const freqTxt = f === 0 ? "lejáratkor" : f === 1 ? "havi" : f === 3 ? "negyedéves" : f === 6 ? "féléves" : "éves";
    const rv = effectiveReinvest(b);
    const nextTxt = f === 0 ? toISODate(parseISO(b.maturityDate)) : nextC ? toISODate(nextC.date) : "-";
    return `<div class="balance-row"><span>${esc(b.type)} ${esc(b.series)}</span><span class="balance-val">${HUF(num(b.principal))}${rv.on ? ` · újrabefektetés ${rv.rate.toFixed(2)}%` : ""}</span></div>
      <div class="balance-row"><span>Kamatláb (mai)</span><span class="balance-val">${rateAt(b, t).toFixed(2)}% · ${freqTxt}</span></div>
      <div class="balance-row"><span>Következő kupon${taxFactor() < 1 ? " (nettó)" : ""}</span><span class="balance-val">${f === 0 ? "lejáratkor" : HUF(nextC ? nextC.amount : 0)}</span></div>
      <div class="balance-row"><span>Következő kifizetés</span><span class="balance-val">${nextTxt}</span></div>`;
  }).join("");
  const y = annualBondYield();
  c.innerHTML = `${rows}<div class="balance-divider"></div><div class="balance-section">
    <div class="balance-row balance-total"><span><strong>Összes állampapír névérték</strong></span><span class="balance-val"><strong>${HUF(totalBondPrincipal())}</strong></span></div>
    <div class="balance-row"><span>Elméleti éves hozam${taxFactor() < 1 ? " (adó után)" : ""}</span><span class="balance-val income-val">${HUF(y)}</span></div>
    <div class="balance-row"><span>Elméleti heti hozam</span><span class="balance-val income-val">${HUF((y / daysInYear) * 7)}</span></div>
    <div class="balance-row"><span>Elméleti napi hozam</span><span class="balance-val income-val">${HUF(y / daysInYear)}</span></div></div>`;
}
function renderBreakdownBox(sel, data, color, emptyTxt) {
  const c = qs(sel); if (!c) return;
  const total = Object.values(data).reduce((s, v) => s + v, 0);
  if (total <= 0) { c.innerHTML = `<div class="muted">${emptyTxt}</div>`; return; }
  c.innerHTML = Object.entries(data).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([name, value]) => {
    const p = ((value / total) * 100).toFixed(1);
    return `<div class="breakdown-row"><div class="breakdown-label"><span>${name}</span><span class="breakdown-pct">${p}%</span></div>
      <div class="breakdown-bar"><div class="breakdown-bar-fill" style="width:${Math.min(100, parseFloat(p))}%;${color ? "background:" + color : ""}"></div></div>
      <div class="breakdown-amount">${HUF(value)}</div></div>`;
  }).join("");
}
const renderExpenseBreakdown = () => renderBreakdownBox("#expense-breakdown-body", spendingBreakdown(), "", "Nincs adat a kiadásokhoz.");
const renderIncomeBreakdown = () => renderBreakdownBox("#income-breakdown-body", incomeBreakdown(), "rgba(136,223,123,.6)", "Nincs adat a bevételekhez.");

/* ================= Teljes nézet: részletes kártya ================= */
function renderFullDetail() {
  const card = qs("#full-detail-card"); if (!card) return;
  const full = state.view === "full";
  card.style.display = full ? "" : "none";
  if (!full) return;
  const body = qs("#full-detail-body"); if (!body) return;
  const t = today0(), gross = grossAssetsTotal(), liab = Math.abs(sumCat("liability")), net = gross - liab;
  const th = (a) => `<th style="text-align:${a};padding:6px 8px;font-weight:600;color:var(--color-text-muted,#97a59d);white-space:nowrap">`;
  const td = (a) => `<td style="text-align:${a};padding:6px 8px;border-top:1px solid rgba(255,255,255,.06);white-space:nowrap">`;
  const table = (heads, rows) => `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.92em"><thead><tr>${heads.map((h, i) => `${th(i ? "right" : "left")}${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `${td(i ? "right" : "left")}${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const h3 = (x) => `<h3 class="balance-title" style="margin:18px 0 6px">${x}</h3>`;
  const comp = [["Készpénz", sumCat("cash")], ["Bankszámla", sumCat("bank")], ["ETF", sumCat("etf")], ["Részvény", sumCat("stock")], ["Egyéb eszköz", sumCat("other")],
    ["Állampapír (tőke)", totalBondPrincipal()], ["Állampapír felhalmozott kamat", accruedInterest()], ["Állampapír újrabefektetett kamat", reinvestedBalanceNow()]];
  let html = h3("Vagyon összetétele") + table(["Tétel", "Érték", "Arány"], [
    ...comp.filter(([, v]) => v !== 0).map(([n, v]) => [n, HUF(v), gross > 0 ? pct((v / gross) * 100) : "–"]),
    ["<strong>Eszközök összesen</strong>", `<strong>${HUF(gross)}</strong>`, "100%"],
    ["Tartozások", `−${HUF(liab)}`, gross > 0 ? pct((liab / gross) * 100) : "–"],
    ["<strong>Tiszta vagyon</strong>", `<strong>${HUF(net)}</strong>`, ""]]);
  const bonds = state.bonds.filter((b) => b.enabled);
  if (bonds.length) {
    const evs = bondEvents();
    html += h3("Állampapírok részletesen") + table(["Papír", "Tőke", "Felhalm. kamat", "Újrabef. egyenleg", "Jelenlegi érték", "Kamat (mai)", "Éves hozam", "Lejárat", "Lejáratkor"],
      bonds.map((b) => {
        const p = bondParts(b, t), y = bondYieldParts(b), ev = evs.find((e) => e.type === "maturity" && e.bond === b);
        const left = yearsBetween(t, parseISO(b.maturityDate));
        return [`${esc(b.type)} ${esc(b.series)}`, HUF(num(b.principal)), HUF(p.accrued), HUF(p.reinv), HUF(num(b.principal) + p.accrued + p.reinv), pct(rateAt(b, t), 2),
          HUF(y.base + y.reinv), `${toISODate(parseISO(b.maturityDate))} (${left > 0 ? left.toFixed(1) + " év" : "lejárt"})`, ev ? HUF(ev.amount) : "–"];
      }));
    const tf = taxFactor();
    if (tf < 1) {
      const netY = annualBondYield(), grossY = netY / tf;
      html += `<div class="muted" style="margin-top:6px">Kamatadó ${pct(num(state.settings.interestTax))}: éves bruttó hozam ${HUF(grossY)}, adó ${HUF(grossY - netY)}, nettó ${HUF(netY)}.</div>`;
    }
  }
  const eq = state.assets.filter((a) => a.category === "stock" || a.category === "etf");
  if (eq.length) {
    const eqTotal = eq.reduce((s, a) => s + assetHuf(a), 0), g = num(state.settings.assetGrowth);
    html += h3("Részvény és ETF pozíciók") + table(["Megnevezés", "Típus", "Darab", "Árfolyam", "Érték (HUF)", "Súly", "Várt éves növekedés"],
      eq.map((a) => [esc(a.name), categoryLabel(a.category), num(a.quantity) > 0 ? String(num(a.quantity)) : "–", num(a.price) > 0 ? `${num(a.price)} ${esc(a.currency)}` : "–", HUF(assetHuf(a)),
        eqTotal > 0 ? pct((assetHuf(a) / eqTotal) * 100) : "–", HUF(assetHuf(a) * g / 100)]));
    html += `<div class="muted" style="margin-top:6px">Összesen ${HUF(eqTotal)} (${gross > 0 ? pct((eqTotal / gross) * 100) : "–"} a bruttó eszközökből), feltételezett növekedés ${pct(g)} / év.</div>`;
  }
  const eurTotal = state.assets.filter((a) => a.currency === "EUR" && a.category !== "liability").reduce((s, a) => s + assetHuf(a), 0);
  const liquid = liquidTotal();
  html += h3("Deviza és likviditás") + table(["Mutató", "Érték", "Arány"], [
    ["HUF eszközök", HUF(gross - eurTotal), gross > 0 ? pct(((gross - eurTotal) / gross) * 100) : "–"],
    ["EUR eszközök (árfolyamkockázat)", HUF(eurTotal), gross > 0 ? pct((eurTotal / gross) * 100) : "–"],
    ["Likvid (készpénz, bank, likvid papír)", HUF(liquid), gross > 0 ? pct((liquid / gross) * 100) : "–"],
    ["Lekötött / nem likvid", HUF(gross - liquid), gross > 0 ? pct(((gross - liquid) / gross) * 100) : "–"]]);
  const ms = [1, 3, 5].map((y) => ({ y, ...forecastSeries(12, y) }));
  const last = (o) => ({ n: o.nominal[o.nominal.length - 1], r: o.real[o.real.length - 1], l: o.labels[o.labels.length - 1] });
  html += h3("Előrejelzés mérföldkövek") + table(["Időpont", "Nominális", "Reálérték (infláció után)", "Változás a mai vagyonhoz"],
    ms.map((o) => { const v = last(o); return [`${o.y} év (${v.l})`, HUF(v.n), HUF(v.r), `${v.n - net >= 0 ? "+" : "−"}${HUF(Math.abs(v.n - net))}`]; }));
  html += `<div class="muted" style="margin-top:6px">Feltételezések: infláció ${pct(num(state.settings.inflation))}, bevétel-növekedés ${pct(num(state.settings.incomeGrowth))}, kiadás-növekedés ${pct(num(state.settings.expenseGrowth))}, eszköz-növekedés ${pct(num(state.settings.assetGrowth))}; a megtakarítás 0% hozamot kap; a kuponok újrabefektetése csak a mai nap utáni kuponokra számol.</div>`;
  body.innerHTML = html;
}

function renderAll() {
  setToggle("#currency-huf", state.settings.displayCurrency === "HUF");
  setToggle("#currency-eur", state.settings.displayCurrency === "EUR");
  setToggle("#view-basic", state.view === "basic");
  setToggle("#view-full", state.view === "full");
  safe(function syncSettings() { const sf = qs("#settings-form"); if (sf) { sf.displayCurrency.value = state.settings.displayCurrency; sf.eurHufRate.value = state.settings.eurHufRate; } });
  [updateCategoryOptions, updateFormHints, renderKpis, renderLists, renderCharts, renderFullDetail,
    renderBalanceSheet, renderIncomeStatement, renderBondPortfolio, renderExpenseBreakdown, renderIncomeBreakdown].forEach(safe);
}

/* ================= Kategória-opciók ================= */
const incomeCategories = [
  { value: "fizetes", label: "Fizetés" }, { value: "mellekjovedelem", label: "Mellékjövedelem" }, { value: "betetkamat", label: "Betét kamat" },
  { value: "kamatjovedelem", label: "Kamatjövedelem" }, { value: "egyebbevetel", label: "Egyéb bevétel" }];
const expenseCategories = [
  { value: "altalanoskiadas", label: "Általános kiadás" }, { value: "elelmiszer", label: "Élelmiszer" }, { value: "lakas", label: "Lakás" },
  { value: "kozlekedes", label: "Közlekedés" }, { value: "szorakozas", label: "Szórakozás" }, { value: "egeszsegugy", label: "Egészségügy" },
  { value: "oktatas", label: "Oktatás" }, { value: "egyebkiadas", label: "Egyéb kiadás" }];
function updateCategoryOptions() {
  const kind = document.getElementById("cashflow-kind"), cat = document.getElementById("cashflow-category");
  if (!kind || !cat) return;
  const cats = kind.value === "income" ? incomeCategories : expenseCategories, cur = normCat(cat.value);
  cat.innerHTML = `<option value="">-- Válassz --</option>`;
  cats.forEach((c) => { const o = document.createElement("option"); o.value = c.value; o.textContent = c.label; if (normCat(c.value) === cur) o.selected = true; cat.appendChild(o); });
}

/* ================= Mentés / betöltés ================= */
async function saveSettings(patch) {
  const merged = { ...state.settings, ...patch };
  const saved = await api("/api/settings", { method: "POST", body: JSON.stringify(merged) });
  state.settings = { ...merged, ...saved, eurHufRate: num(saved.eurHufRate, merged.eurHufRate) };
}
async function load() {
  const data = await api("/api/bootstrap");
  state.settings = { ...state.settings, ...data.settings };
  state.cashflows = data.cashflows; state.bonds = data.bonds; state.assets = data.assets;
  renderAll(); safe(fillSettingsForm); safe(syncAssetForm);
}

/* ================= Események ================= */
qsa(".nav-link").forEach((btn) => btn.addEventListener("click", () => section(btn.dataset.section)));
qs("#currency-huf")?.addEventListener("click", async () => { state.settings.displayCurrency = "HUF"; renderAll(); try { await saveSettings({ displayCurrency: "HUF" }); } catch (e) { console.error(e); } });
qs("#currency-eur")?.addEventListener("click", async () => { state.settings.displayCurrency = "EUR"; renderAll(); try { await saveSettings({ displayCurrency: "EUR" }); } catch (e) { console.error(e); } });
qs("#view-basic")?.addEventListener("click", () => { state.view = "basic"; renderAll(); });
qs("#view-full")?.addEventListener("click", () => { state.view = "full"; renderAll(); });
document.getElementById("cashflow-kind")?.addEventListener("change", updateCategoryOptions);
["category", "quantity", "price"].forEach((n) => qs("#asset-form")?.elements[n]?.addEventListener("input", syncAssetForm));

qs("#refresh-fx")?.addEventListener("click", async () => {
  try {
    const r = await fetch("https://api.frankfurter.dev/v1/latest?from=EUR&to=HUF");
    const data = await r.json(); const rate = data?.rates?.HUF;
    if (!rate) throw new Error("Árfolyamfrissítés sikertelen");
    await saveSettings({ eurHufRate: Number(rate) }); renderAll();
  } catch (e) { alert(e instanceof Error ? e.message : "Árfolyamfrissítés sikertelen"); }
});

qs("#cashflow-cancel")?.addEventListener("click", () => { qs("#cashflow-form").reset(); qs("#cashflow-form").recurring.checked = true; resetEdit("cashflow"); });
qs("#bond-cancel")?.addEventListener("click", () => { qs("#bond-form").reset(); resetEdit("bond"); });
qs("#asset-cancel")?.addEventListener("click", () => { qs("#asset-form").reset(); resetEdit("asset"); setTimeout(syncAssetForm); });

qs("#settings-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const rate = num(fd.get("eurHufRate"), 0);
  if (rate <= 0) { alert("Az EUR/HUF árfolyam legyen pozitív."); return; }
  await saveSettings({
    displayCurrency: String(fd.get("displayCurrency")), eurHufRate: rate,
    incomeGrowth: num(fd.get("incomeGrowth")), expenseGrowth: num(fd.get("expenseGrowth")),
    assetGrowth: num(fd.get("assetGrowth")), inflation: num(fd.get("inflation")),
    interestTax: Math.min(100, Math.max(0, num(fd.get("interestTax")))),
  });
  renderAll(); alert("Beállítások mentve");
});

qs("#cashflow-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget, fd = new FormData(form);
  const payload = { kind: String(fd.get("kind")), name: String(fd.get("name")), amount: num(fd.get("amount")), startDate: String(fd.get("startDate")),
    interval: String(fd.get("interval")), recurring: fd.get("recurring") ? 1 : 0, note: String(fd.get("note") || ""), category: String(fd.get("category") || "") };
  if (state.editing.cashflow) { await api(`/api/cashflows/${state.editing.cashflow.id}`, { method: "PUT", body: JSON.stringify(payload) }); resetEdit("cashflow"); }
  else await api("/api/cashflows", { method: "POST", body: JSON.stringify(payload) });
  form.reset(); form.recurring.checked = true; section("cashflow"); await load();
});
qs("#bond-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget, fd = new FormData(form);
  const steps = String(fd.get("rateSteps") || "").trim();
  if (steps && rateSteps({ rateSteps: steps }).length !== steps.split(/[;,\s]+/).filter(Boolean).length) { alert("A kamatsávok csak számok lehetnek, vesszővel elválasztva (pl. 5.5, 6, 6.5)."); return; }
  const payload = { type: String(fd.get("type")), series: String(fd.get("series")), principal: num(fd.get("principal")), annualRate: num(fd.get("annualRate")),
    purchaseDate: String(fd.get("purchaseDate")), maturityDate: String(fd.get("maturityDate")), couponFrequency: String(fd.get("couponFrequency") || "quarterly"),
    reinvestInterest: fd.get("reinvestInterest") ? 1 : 0, reinvestRate: num(fd.get("reinvestRate")), liquid: fd.get("liquid") ? 1 : 0, rateSteps: steps, notes: "" };
  if (payload.maturityDate <= payload.purchaseDate) { alert("A lejárat legyen a vásárlás után."); return; }
  if (state.editing.bond) { await api(`/api/bonds/${state.editing.bond.id}`, { method: "PUT", body: JSON.stringify(payload) }); resetEdit("bond"); }
  else await api("/api/bonds", { method: "POST", body: JSON.stringify(payload) });
  form.reset(); section("bonds"); await load();
});
qs("#asset-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget, fd = new FormData(form);
  const isEq = ["stock", "etf"].includes(String(fd.get("category")));
  const q = num(fd.get("quantity"), 0), p = num(fd.get("price"), 0), useQp = isEq && q > 0 && p > 0;
  const payload = { name: String(fd.get("name")), category: String(fd.get("category")), amount: useQp ? Math.round(q * p * 100) / 100 : num(fd.get("amount")),
    currency: String(fd.get("currency")), note: String(fd.get("note") || ""), quantity: useQp ? q : null, price: useQp ? p : null };
  if (state.editing.asset) { await api(`/api/assets/${state.editing.asset.id}`, { method: "PUT", body: JSON.stringify(payload) }); resetEdit("asset"); }
  else await api("/api/assets", { method: "POST", body: JSON.stringify(payload) });
  form.reset(); section("assets"); await load();
});

document.body.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-kind][data-id]");
  if (btn) {
    const kind = btn.dataset.kind, id = btn.dataset.id;
    const path = kind === "cashflow" ? "cashflows" : kind === "bond" ? "bonds" : "assets";
    await fetch(`/api/${path}/${id}`, { method: "DELETE" });
    if (state.editing[kind] && String(state.editing[kind].id) === String(id)) resetEdit(kind);
    await load(); return;
  }
  const row = e.target.closest(".list-item[data-edit-kind][data-id]");
  if (!row) return;
  const kind = row.dataset.editKind, id = Number(row.dataset.id);
  if (kind === "cashflow") fillCashflowForm(state.cashflows.find((x) => x.id === id));
  if (kind === "bond") fillBondForm(state.bonds.find((x) => x.id === id));
  if (kind === "asset") fillAssetForm(state.assets.find((x) => x.id === id));
});

section("dashboard");
load();
