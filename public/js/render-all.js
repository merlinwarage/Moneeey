/* Moneeey – renderAll */
function renderAll() {
  setToggle("#currency-huf", state.settings.displayCurrency === "HUF");
  setToggle("#currency-eur", state.settings.displayCurrency === "EUR");
  setToggle("#view-basic", state.view === "basic");
  setToggle("#view-full", state.view === "full");
  safe(function syncSettings() { const sf = qs("#settings-form"); if (sf) { sf.displayCurrency.value = state.settings.displayCurrency; sf.eurHufRate.value = state.settings.eurHufRate; } });
  [updateCategoryOptions, updateFormHints, renderKpis, renderLists, renderCharts, renderFullDetail,
    renderBalanceSheet, renderIncomeStatement, renderBondPortfolio, renderExpenseBreakdown, renderIncomeBreakdown].forEach(safe);
}
