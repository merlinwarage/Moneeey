/* Moneeey – Bond model */
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
