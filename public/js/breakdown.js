/* Moneeey – Breakdowns */
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
