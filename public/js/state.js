/* Moneeey – State */
/* Moneeey – app.js */
const state = {
  settings: { theme: "dark", displayCurrency: "HUF", eurHufRate: 355.28, incomeGrowth: 3, expenseGrowth: 2, assetGrowth: 6, inflation: 3.5, interestTax: 0, bondMarketRate: 99 },
  cashflows: [], bonds: [], assets: [], view: "basic",
  charts: { wealth: null, allocation: null, quarterly: null, yearly: null, spending: null, incomeExpense: null, savingsRate: null, incomeBreakdown: null },
  editing: { cashflow: null, bond: null, asset: null },
};
