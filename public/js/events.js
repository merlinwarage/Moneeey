/* Moneeey – Event handlers */
/* ================= Események ================= */
qsa(".nav-link").forEach((btn) => btn.addEventListener("click", () => section(btn.dataset.section)));
qs("#currency-huf")?.addEventListener("click", async () => { state.settings.displayCurrency = "HUF"; renderAll(); try { await saveSettings({ displayCurrency: "HUF" }); } catch (e) { console.error(e); } });
qs("#currency-eur")?.addEventListener("click", async () => { state.settings.displayCurrency = "EUR"; renderAll(); try { await saveSettings({ displayCurrency: "EUR" }); } catch (e) { console.error(e); } });
qs("#view-basic")?.addEventListener("click", () => { state.view = "basic"; renderAll(); });
qs("#view-full")?.addEventListener("click", () => { state.view = "full"; renderAll(); });
document.getElementById("cashflow-kind")?.addEventListener("change", updateCategoryOptions);
["category", "quantity", "price"].forEach((n) => qs("#asset-form")?.elements[n]?.addEventListener("input", syncAssetForm));

qs("#refresh-fx")?.addEventListener("click", async () => {
  try {
    const r = await fetch("https://api.frankfurter.dev/v1/latest?from=EUR&to=HUF");
    const data = await r.json(); const rate = data?.rates?.HUF;
    if (!rate) throw new Error("Árfolyamfrissítés sikertelen");
    await saveSettings({ eurHufRate: Number(rate) }); renderAll();
  } catch (e) { alert(e instanceof Error ? e.message : "Árfolyamfrissítés sikertelen"); }
});

qs("#cashflow-cancel")?.addEventListener("click", () => { qs("#cashflow-form").reset(); qs("#cashflow-form").recurring.checked = true; resetEdit("cashflow"); });
qs("#bond-cancel")?.addEventListener("click", () => { qs("#bond-form").reset(); resetEdit("bond"); });
qs("#asset-cancel")?.addEventListener("click", () => { qs("#asset-form").reset(); resetEdit("asset"); setTimeout(syncAssetForm); });

qs("#settings-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const rate = num(fd.get("eurHufRate"), 0);
  if (rate <= 0) { alert("Az EUR/HUF árfolyam legyen pozitív."); return; }
  await saveSettings({
    displayCurrency: String(fd.get("displayCurrency")), eurHufRate: rate,
    incomeGrowth: num(fd.get("incomeGrowth")), expenseGrowth: num(fd.get("expenseGrowth")),
    assetGrowth: num(fd.get("assetGrowth")), inflation: num(fd.get("inflation")),
    interestTax: Math.min(100, Math.max(0, num(fd.get("interestTax")))),
  });
  renderAll(); alert("Beállítások mentve");
});

qs("#cashflow-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget, fd = new FormData(form);
  const payload = { kind: String(fd.get("kind")), name: String(fd.get("name")), amount: num(fd.get("amount")), startDate: String(fd.get("startDate")),
    interval: String(fd.get("interval")), recurring: fd.get("recurring") ? 1 : 0, note: String(fd.get("note") || ""), category: String(fd.get("category") || "") };
  if (state.editing.cashflow) { await api(`/api/cashflows/${state.editing.cashflow.id}`, { method: "PUT", body: JSON.stringify(payload) }); resetEdit("cashflow"); }
  else await api("/api/cashflows", { method: "POST", body: JSON.stringify(payload) });
  form.reset(); form.recurring.checked = true; section("cashflow"); await load();
});
qs("#bond-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget, fd = new FormData(form);
  const steps = String(fd.get("rateSteps") || "").trim();
  if (steps && rateSteps({ rateSteps: steps }).length !== steps.split(/[;,\s]+/).filter(Boolean).length) { alert("A kamatsávok csak számok lehetnek, vesszővel elválasztva (pl. 5.5, 6, 6.5)."); return; }
  const payload = { type: String(fd.get("type")), series: String(fd.get("series")), principal: num(fd.get("principal")), annualRate: num(fd.get("annualRate")),
    purchaseDate: String(fd.get("purchaseDate")), maturityDate: String(fd.get("maturityDate")), couponFrequency: String(fd.get("couponFrequency") || "quarterly"),
    reinvestInterest: fd.get("reinvestInterest") ? 1 : 0, reinvestRate: num(fd.get("reinvestRate")), liquid: fd.get("liquid") ? 1 : 0, rateSteps: steps, notes: "" };
  if (payload.maturityDate <= payload.purchaseDate) { alert("A lejárat legyen a vásárlás után."); return; }
  if (state.editing.bond) { await api(`/api/bonds/${state.editing.bond.id}`, { method: "PUT", body: JSON.stringify(payload) }); resetEdit("bond"); }
  else await api("/api/bonds", { method: "POST", body: JSON.stringify(payload) });
  form.reset(); section("bonds"); await load();
});
qs("#asset-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget, fd = new FormData(form);
  const isEq = ["stock", "etf"].includes(String(fd.get("category")));
  const q = num(fd.get("quantity"), 0), p = num(fd.get("price"), 0), useQp = isEq && q > 0 && p > 0;
  const payload = { name: String(fd.get("name")), category: String(fd.get("category")), amount: useQp ? Math.round(q * p * 100) / 100 : num(fd.get("amount")),
    currency: String(fd.get("currency")), note: String(fd.get("note") || ""), quantity: useQp ? q : null, price: useQp ? p : null };
  if (state.editing.asset) { await api(`/api/assets/${state.editing.asset.id}`, { method: "PUT", body: JSON.stringify(payload) }); resetEdit("asset"); }
  else await api("/api/assets", { method: "POST", body: JSON.stringify(payload) });
  form.reset(); section("assets"); await load();
});

document.body.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-kind][data-id]");
  if (btn) {
    const kind = btn.dataset.kind, id = btn.dataset.id;
    const path = kind === "cashflow" ? "cashflows" : kind === "bond" ? "bonds" : "assets";
    await fetch(`/api/${path}/${id}`, { method: "DELETE" });
    if (state.editing[kind] && String(state.editing[kind].id) === String(id)) resetEdit(kind);
    await load(); return;
  }
  const row = e.target.closest(".list-item[data-edit-kind][data-id]");
  if (!row) return;
  const kind = row.dataset.editKind, id = Number(row.dataset.id);
  if (kind === "cashflow") fillCashflowForm(state.cashflows.find((x) => x.id === id));
  if (kind === "bond") fillBondForm(state.bonds.find((x) => x.id === id));
  if (kind === "asset") fillAssetForm(state.assets.find((x) => x.id === id));
});
