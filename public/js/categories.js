/* Moneeey – Category options */
/* ================= Kategória-opciók ================= */
const incomeCategories = [
  { value: "fizetes", label: "Fizetés" }, { value: "mellekjovedelem", label: "Mellékjövedelem" }, { value: "betetkamat", label: "Betét kamat" },
  { value: "kamatjovedelem", label: "Kamatjövedelem" }, { value: "egyebbevetel", label: "Egyéb bevétel" }];
const expenseCategories = [
  { value: "altalanoskiadas", label: "Általános kiadás" }, { value: "elelmiszer", label: "Élelmiszer" }, { value: "lakas", label: "Lakás" },
  { value: "kozlekedes", label: "Közlekedés" }, { value: "szorakozas", label: "Szórakozás" }, { value: "egeszsegugy", label: "Egészségügy" },
  { value: "oktatas", label: "Oktatás" }, { value: "egyebkiadas", label: "Egyéb kiadás" }];
function updateCategoryOptions() {
  const kind = document.getElementById("cashflow-kind"), cat = document.getElementById("cashflow-category");
  if (!kind || !cat) return;
  const cats = kind.value === "income" ? incomeCategories : expenseCategories, cur = normCat(cat.value);
  cat.innerHTML = `<option value="">-- Válassz --</option>`;
  cats.forEach((c) => { const o = document.createElement("option"); o.value = c.value; o.textContent = c.label; if (normCat(c.value) === cur) o.selected = true; cat.appendChild(o); });
}
