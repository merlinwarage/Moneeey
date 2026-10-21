/* Moneeey – Cashflow */
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
