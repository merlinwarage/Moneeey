/* Moneeey – Navigation + form helpers */
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
  f.bondMarketRate.value = String(state.settings.bondMarketRate || 99);
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
