/* Moneeey – Statements */
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
