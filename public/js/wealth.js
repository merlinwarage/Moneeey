/* Moneeey – Assets / net worth */
/* ================= Eszközök / vagyon (nézettől független) ================= */
const assetHuf = (a) => toHuf(num(a.amount), a.currency);
const sumCat = (cat) => state.assets.filter((a) => a.category === cat).reduce((s, a) => s + assetHuf(a), 0);
const growthAssets = () => state.assets.filter((a) => a.category === "etf" || a.category === "stock");
const investableAssets = () => growthAssets().reduce((s, a) => s + assetHuf(a), 0);
const annualAssetYield = () => investableAssets() * num(state.settings.assetGrowth) / 100;
const bondTotalValue = () => totalBondPrincipal() + accruedInterest() + reinvestedBalanceNow();
const getBondMarketRate = () => {
  const r = num(state.settings.bondMarketRate);
  return (r > 0 && r <= 200) ? r : 99; // default 99%, ha nincs beállítva
};

const bondMarketValue = () => {
  const rate = getBondMarketRate() / 100;
  return totalBondPrincipal() * rate + accruedInterest() + reinvestedBalanceNow();
};
const grossAssetsTotalMarket = () => sumCat("cash") + sumCat("bank") + sumCat("etf") + sumCat("stock") + sumCat("other") + bondMarketValue();
const grossAssetsTotal = () => sumCat("cash") + sumCat("bank") + sumCat("etf") + sumCat("stock") + sumCat("other") + bondTotalValue();
const currentNetWorth = () => grossAssetsTotal() - Math.abs(sumCat("liability"));
function liquidTotal() {
  const la = sumCat("cash") + sumCat("bank");
  const lb = state.bonds.filter((b) => b.enabled && num(b.liquid) === 1).reduce((s, b) => s + num(b.principal), 0);
  return la + lb;
}
function theoreticalYield() { const annual = annualBondYield() + annualAssetYield(); return { annual, monthly: annual / 12, daily: annual / daysInYear }; }
