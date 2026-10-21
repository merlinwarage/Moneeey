/* Moneeey – KPI rendering */
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
