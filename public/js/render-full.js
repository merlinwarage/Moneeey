/* Moneeey – Full view detail */
/* ================= Teljes nézet: részletes kártya ================= */
function renderFullDetail() {
  const card = qs("#full-detail-card"); if (!card) return;
  const full = state.view === "full";
  card.style.display = full ? "" : "none";
  if (!full) return;
  const body = qs("#full-detail-body"); if (!body) return;
  const t = today0(), gross = grossAssetsTotal(), liab = Math.abs(sumCat("liability")), net = gross - liab;
  const th = (a) => `<th style="text-align:${a};padding:6px 8px;font-weight:600;color:var(--color-text-muted,#97a59d);white-space:nowrap">`;
  const td = (a) => `<td style="text-align:${a};padding:6px 8px;border-top:1px solid rgba(255,255,255,.06);white-space:nowrap">`;
  const table = (heads, rows) => `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.92em"><thead><tr>${heads.map((h, i) => `${th(i ? "right" : "left")}${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `${td(i ? "right" : "left")}${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const h3 = (x) => `<h3 class="balance-title" style="margin:18px 0 6px">${x}</h3>`;
  const comp = [["Készpénz", sumCat("cash")], ["Bankszámla", sumCat("bank")], ["ETF", sumCat("etf")], ["Részvény", sumCat("stock")], ["Egyéb eszköz", sumCat("other")],
    ["Állampapír (tőke)", totalBondPrincipal()], ["Állampapír felhalmozott kamat", accruedInterest()], ["Állampapír újrabefektetett kamat", reinvestedBalanceNow()]];
  let html = h3("Vagyon összetétele") + table(["Tétel", "Érték", "Arány"], [
    ...comp.filter(([, v]) => v !== 0).map(([n, v]) => [n, HUF(v), gross > 0 ? pct((v / gross) * 100) : "–"]),
    ["<strong>Eszközök összesen</strong>", `<strong>${HUF(gross)}</strong>`, "100%"],
    ["Tartozások", `−${HUF(liab)}`, gross > 0 ? pct((liab / gross) * 100) : "–"],
    ["<strong>Tiszta vagyon</strong>", `<strong>${HUF(net)}</strong>`, ""]]);
  const bonds = state.bonds.filter((b) => b.enabled);
  if (bonds.length) {
    const evs = bondEvents();
    html += h3("Állampapírok részletesen") + table(["Papír", "Tőke", "Felhalm. kamat", "Újrabef. egyenleg", "Jelenlegi érték", "Kamat (mai)", "Éves hozam", "Lejárat", "Lejáratkor"],
      bonds.map((b) => {
        const p = bondParts(b, t), y = bondYieldParts(b), ev = evs.find((e) => e.type === "maturity" && e.bond === b);
        const left = yearsBetween(t, parseISO(b.maturityDate));
        return [`${esc(b.type)} ${esc(b.series)}`, HUF(num(b.principal)), HUF(p.accrued), HUF(p.reinv), HUF(num(b.principal) + p.accrued + p.reinv), pct(rateAt(b, t), 2),
          HUF(y.base + y.reinv), `${toISODate(parseISO(b.maturityDate))} (${left > 0 ? left.toFixed(1) + " év" : "lejárt"})`, ev ? HUF(ev.amount) : "–"];
      }));
    const tf = taxFactor();
    if (tf < 1) {
      const netY = annualBondYield(), grossY = netY / tf;
      html += `<div class="muted" style="margin-top:6px">Kamatadó ${pct(num(state.settings.interestTax))}: éves bruttó hozam ${HUF(grossY)}, adó ${HUF(grossY - netY)}, nettó ${HUF(netY)}.</div>`;
    }
  }
  const eq = state.assets.filter((a) => a.category === "stock" || a.category === "etf");
  if (eq.length) {
    const eqTotal = eq.reduce((s, a) => s + assetHuf(a), 0), g = num(state.settings.assetGrowth);
    html += h3("Részvény és ETF pozíciók") + table(["Megnevezés", "Típus", "Darab", "Árfolyam", "Érték (HUF)", "Súly", "Várt éves növekedés"],
      eq.map((a) => [esc(a.name), categoryLabel(a.category), num(a.quantity) > 0 ? String(num(a.quantity)) : "–", num(a.price) > 0 ? `${num(a.price)} ${esc(a.currency)}` : "–", HUF(assetHuf(a)),
        eqTotal > 0 ? pct((assetHuf(a) / eqTotal) * 100) : "–", HUF(assetHuf(a) * g / 100)]));
    html += `<div class="muted" style="margin-top:6px">Összesen ${HUF(eqTotal)} (${gross > 0 ? pct((eqTotal / gross) * 100) : "–"} a bruttó eszközökből), feltételezett növekedés ${pct(g)} / év.</div>`;
  }
  const eurTotal = state.assets.filter((a) => a.currency === "EUR" && a.category !== "liability").reduce((s, a) => s + assetHuf(a), 0);
  const liquid = liquidTotal();
  html += h3("Deviza és likviditás") + table(["Mutató", "Érték", "Arány"], [
    ["HUF eszközök", HUF(gross - eurTotal), gross > 0 ? pct(((gross - eurTotal) / gross) * 100) : "–"],
    ["EUR eszközök (árfolyamkockázat)", HUF(eurTotal), gross > 0 ? pct((eurTotal / gross) * 100) : "–"],
    ["Likvid (készpénz, bank, likvid papír)", HUF(liquid), gross > 0 ? pct((liquid / gross) * 100) : "–"],
    ["Lekötött / nem likvid", HUF(gross - liquid), gross > 0 ? pct(((gross - liquid) / gross) * 100) : "–"]]);
  const ms = [1, 3, 5].map((y) => ({ y, ...forecastSeries(12, y) }));
  const last = (o) => ({ n: o.nominal[o.nominal.length - 1], r: o.real[o.real.length - 1], l: o.labels[o.labels.length - 1] });
  html += h3("Előrejelzés mérföldkövek") + table(["Időpont", "Nominális", "Reálérték (infláció után)", "Változás a mai vagyonhoz"],
    ms.map((o) => { const v = last(o); return [`${o.y} év (${v.l})`, HUF(v.n), HUF(v.r), `${v.n - net >= 0 ? "+" : "−"}${HUF(Math.abs(v.n - net))}`]; }));
  html += `<div class="muted" style="margin-top:6px">Feltételezések: infláció ${pct(num(state.settings.inflation))}, bevétel-növekedés ${pct(num(state.settings.incomeGrowth))}, kiadás-növekedés ${pct(num(state.settings.expenseGrowth))}, eszköz-növekedés ${pct(num(state.settings.assetGrowth))}; a megtakarítás 0% hozamot kap; a kuponok újrabefektetése csak a mai nap utáni kuponokra számol.</div>`;
  body.innerHTML = html;
}
