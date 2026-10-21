/* Moneeey – Save / load */
/* ================= Mentés / betöltés ================= */
async function saveSettings(patch) {
  const merged = { ...state.settings, ...patch };
  const saved = await api("/api/settings", { method: "POST", body: JSON.stringify(merged) });
  state.settings = { ...merged, ...saved, eurHufRate: num(saved.eurHufRate, merged.eurHufRate) };
}
async function load() {
  const data = await api("/api/bootstrap");
  state.settings = { ...state.settings, ...data.settings };
  state.cashflows = data.cashflows; state.bonds = data.bonds; state.assets = data.assets;
  renderAll(); safe(fillSettingsForm); safe(syncAssetForm);
}
