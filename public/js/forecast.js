/* Moneeey – Forecast */
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
