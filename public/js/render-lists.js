/* Moneeey – List rendering */
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
