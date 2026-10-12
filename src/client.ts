declare const Chart: any;

type ViewMode = "basic" | "full";
type ReportRange = "monthly" | "quarterly" | "yearly";
type Settings = {
    id: number;
    theme: "dark" | "light";
    displayCurrency: "HUF" | "EUR";
    eurHufRate: number;
    incomeGrowth: number;
    expenseGrowth: number;
    assetGrowth: number;
    inflation: number;
    interestTax?: number;
};
type Cashflow = {
    id: number;
    kind: "income" | "expense";
    name: string;
    amount: number;
    startDate: string;
    recurring: number;
    interval: "monthly" | "quarterly" | "yearly";
    note: string;
    category: string;
    enabled: number;
};
type Asset = {
    id: number;
    name: string;
    category: "cash" | "bank" | "etf" | "stock" | "other" | "liability";
    amount: number;
    currency: "HUF" | "EUR";
    note: string;
    quantity?: number | null;
    price?: number | null;
};
type Bond = {
    id: number;
    type: string;
    series: string;
    principal: number;
    annualRate: number;
    purchaseDate: string;
    maturityDate: string;
    couponFrequency:
        | "monthly"
        | "quarterly"
        | "semiannual"
        | "annual"
        | "at_maturity";
    reinvestInterest: number;
    reinvestRate: number;
    notes: string;
    enabled: number;
    liquid?: number;
    rateSteps?: string;
};
type BondTemplate = {
    code: string;
    label: string;
    defaultRate: number;
    couponFrequency: Bond["couponFrequency"];
    suggestedYears: number;
    description: string;
};
type Bootstrap = {
    settings: Settings;
    cashflows: Cashflow[];
    assets: Asset[];
    bonds: Bond[];
    bondCatalog: BondTemplate[];
};
type Snapshot = {
    date: Date;
    basic: number;
    full: number;
    labels: Record<string, number>;
};
type BondEvent = {
    label: string;
    date: Date;
    amount: number;
    type: "coupon" | "maturity";
};

const state: {
    settings: Settings;
    cashflows: Cashflow[];
    assets: Asset[];
    bonds: Bond[];
    bondCatalog: BondTemplate[];
    view: ViewMode;
    reportRange: ReportRange;
    forecastYears: number;
    charts: {
        report?: any;
        forecast?: any;
        allocation?: any;
        spending?: any;
        incomeExpense?: any;
        savingsRate?: any;
    };
} = {
    settings: {
        id: 1,
        theme: "dark",
        displayCurrency: "HUF",
        eurHufRate: 395,
        incomeGrowth: 3,
        expenseGrowth: 2,
        assetGrowth: 6,
        inflation: 3.5,
        interestTax: 0,
    },
    cashflows: [],
    assets: [],
    bonds: [],
    bondCatalog: [],
    view: "basic",
    reportRange: "monthly",
    forecastYears: 5,
    charts: {},
};

const daysInYear = 365.25;

const fmt = (currency: "HUF" | "EUR") =>
    new Intl.NumberFormat("hu-HU", {
        style: "currency",
        currency,
        maximumFractionDigits: currency === "HUF" ? 0 : 2,
    });
const qs = <T extends Element>(sel: string) => document.querySelector(sel) as T;
const css = (v: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const addMonths = (d: Date, m: number) =>
    new Date(d.getFullYear(), d.getMonth() + m, d.getDate());
const addYears = (d: Date, y: number) =>
    new Date(d.getFullYear() + y, d.getMonth(), d.getDate());
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const addDays = (d: Date, n: number) =>
    new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);
const endOfYear = (d: Date) =>
    new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
const yearsBetween = (a: Date, b: Date) =>
    (b.getTime() - a.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
const monthsBetween = (a: Date, b: Date) =>
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
const intervalMonths = (i: Cashflow["interval"]) =>
    i === "monthly" ? 1 : i === "quarterly" ? 3 : 12;

// ================= Állampapír-modell (javított) =================
// Fix/Bónusz MÁP: negyedéves; MÁP Plusz: évente, automatikus tőkésítés; PMÁP: lejáratkor.
// Kifizetési napok a lejárati naphoz igazodnak, az első törtidős kamat napra arányos (nap/365).
// Kamatadó (settings.interestTax) minden kamatból levonódik; kamatsávok: bond.rateSteps ("5.5, 6, 6.5").
const DAY_MS = 86400000;
function parseISO(s: string): Date {
    const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
}
function today0(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY_MS);
function addMonthsClamped(date: Date, months: number): Date {
    const y = date.getFullYear(),
        m = date.getMonth() + months,
        day = date.getDate();
    return new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
}
const num = (v: unknown, d = 0): number => {
    const n = Number(v);
    return v !== null && v !== undefined && v !== "" && Number.isFinite(n) ? n : d;
};
const taxFactor = () => 1 - Math.min(100, Math.max(0, num(state.settings.interestTax))) / 100;

// Format date in local time (not UTC) to avoid off-by-one
const toISODate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function rateSteps(b: Bond): number[] {
    return String(b.rateSteps || "")
        .split(/[;,\s]+/)
        .filter((x) => x !== "")
        .map(Number)
        .filter((x) => Number.isFinite(x) && x >= 0);
}
function holdingYear(pur: Date, date: Date): number {
    let y = Math.max(0, date.getFullYear() - pur.getFullYear() - 1);
    while (addMonthsClamped(pur, 12 * (y + 1)) <= date) y++;
    return y;
}
function rateAt(b: Bond, date: Date): number {
    const st = rateSteps(b);
    if (!st.length) return num(b.annualRate);
    return st[Math.min(holdingYear(parseISO(b.purchaseDate), date), st.length - 1)];
}
function grossInterest(b: Bond, from: Date, to: Date): number {
    const P = num(b.principal),
        pur = parseISO(b.purchaseDate),
        stepped = rateSteps(b).length > 0;
    let total = 0,
        cur = from,
        guard = 0;
    while (cur < to && guard++ < 200) {
        const y = holdingYear(pur, cur);
        const boundary = stepped ? addMonthsClamped(pur, 12 * (y + 1)) : to;
        const end = boundary < to && boundary > cur ? boundary : to;
        total += ((P * rateAt(b, cur)) / 100 * daysBetween(cur, end)) / 365;
        cur = end;
    }
    return total;
}
function bondKind(b: Bond): "mapplus" | "bonus" | "fix" | "pmap" | "other" {
    const t = String(b.type || "").toLowerCase();
    if (t.includes("plusz")) return "mapplus";
    if (t.includes("bónusz") || t.includes("bonusz")) return "bonus";
    if (t.includes("fix")) return "fix";
    if (t.includes("prémium") || t.includes("premium") || t.includes("pmáp") || t.includes("pmap")) return "pmap";
    return "other";
}
const periods = (f: Bond["couponFrequency"]) =>
    f === "monthly" ? 12 : f === "quarterly" ? 4 : f === "semiannual" ? 2 : f === "annual" ? 1 : 0;
const bondFrequencyMonths = (b: Bond): number => {
    switch (bondKind(b)) {
        case "fix":
        case "bonus":
            return 3;
        case "mapplus":
            return 12;
        case "pmap":
            return 0;
        default: {
            const n = periods(b.couponFrequency);
            return n ? 12 / n : 0;
        }
    }
};
function effectiveReinvest(b: Bond): { on: boolean; rate: number } {
    if (bondKind(b) === "mapplus") return { on: true, rate: rateAt(b, today0()) };
    const on = num(b.reinvestInterest) === 1 && num(b.reinvestRate) > 0;
    return { on, rate: on ? num(b.reinvestRate) : 0 };
}
type Coupon = { date: Date; amount: number; periodStart: Date; isMaturity: boolean };
function couponSchedule(b: Bond): Coupon[] {
    const f = bondFrequencyMonths(b);
    if (!f) return [];
    const P = num(b.principal),
        n = 12 / f,
        tf = taxFactor();
    const purchase = parseISO(b.purchaseDate),
        mat = parseISO(b.maturityDate);
    if (!(mat > purchase)) return [];
    const dates: Date[] = [];
    for (let k = 0; k < 2000; k++) {
        const d = addMonthsClamped(mat, -k * f);
        if (d <= purchase) break;
        dates.push(d);
    }
    dates.reverse();
    return dates.map((d, i) => {
        const k = dates.length - 1 - i;
        let periodStart = addMonthsClamped(mat, -(k + 1) * f);
        let amount = (((P * rateAt(b, periodStart)) / 100) / n) * tf;
        if (i === 0 && periodStart < purchase) {
            periodStart = purchase;
            amount = grossInterest(b, purchase, d) * tf;
        }
        return { date: d, amount, periodStart, isMaturity: d.getTime() === mat.getTime() };
    });
}
// felhalmozott (ki nem fizetett) kamat, újrabefektetett egyenleg és kifizetett készpénz-kupon egy adott napon
function bondParts(b: Bond, d: Date): { accrued: number; reinv: number; paidCash: number } {
    const z = { accrued: 0, reinv: 0, paidCash: 0 };
    if (!b.enabled) return z;
    const purchase = parseISO(b.purchaseDate),
        mat = parseISO(b.maturityDate);
    if (d < purchase) return z;
    const f = bondFrequencyMonths(b);
    if (!f) {
        const end = d >= mat ? mat : d;
        const interest = grossInterest(b, purchase, end) * taxFactor();
        return d >= mat ? { accrued: 0, reinv: 0, paidCash: interest } : { accrued: interest, reinv: 0, paidCash: 0 };
    }
    const sched = couponSchedule(b),
        rv = effectiveReinvest(b);
    const rp = rv.on ? (rv.rate / 100 / (12 / f)) * taxFactor() : 0;
    const rpAt = (when: Date) =>
        bondKind(b) === "mapplus" ? (rateAt(b, when) / 100 / (12 / f)) * taxFactor() : rp;
    let bal = 0,
        cash = 0;
    let next: Coupon | null = null;
    for (const c of sched) {
        if (c.date <= d) {
            if (rv.on) bal = bal * (1 + rpAt(c.periodStart)) + c.amount;
            else cash += c.amount;
        } else {
            next = c;
            break;
        }
    }
    let accrued = 0,
        reinvAccr = 0;
    if (next) {
        const len = Math.max(1, daysBetween(next.periodStart, next.date));
        const frac = Math.min(1, Math.max(0, daysBetween(next.periodStart, d) / len));
        accrued = next.amount * frac;
        reinvAccr = bal * rpAt(next.periodStart) * frac;
    }
    return { accrued, reinv: bal + reinvAccr, paidCash: cash };
}

// ---- Kötvény értéke egy napon: tőke + minden addig keletkezett kamat ----
// (ebben a modellben a kuponok nem szerepelnek a cashflow-ban, ezért a kifizetett kuponok is a papír értékét növelik)
function bondValueAt(b: Bond, d: Date) {
    if (!b.enabled || d < parseISO(b.purchaseDate)) return 0;
    const p = bondParts(b, d);
    return num(b.principal) + p.accrued + p.reinv + p.paidCash;
}
const couponAmount = (b: Bond) => {
    const f = bondFrequencyMonths(b);
    return f ? (num(b.principal) * rateAt(b, today0())) / 100 / (12 / f) * taxFactor() : 0;
};
function accruedInterestForBond(b: Bond, now: Date) {
    return bondParts(b, now).accrued;
}
function bondEventsBetween(start: Date, end: Date): BondEvent[] {
    const list: BondEvent[] = [];
    for (const b of state.bonds) {
        if (!b.enabled) continue;
        const maturity = parseISO(b.maturityDate),
            f = bondFrequencyMonths(b),
            rv = effectiveReinvest(b);
        const sched = couponSchedule(b);
        for (const c of sched) {
            if (c.date < start || c.date > end || c.isMaturity) continue;
            list.push({ label: `${bondLabel(b.type)} kupon`, date: new Date(c.date), amount: Math.round(c.amount), type: "coupon" });
        }
        if (maturity >= start && maturity <= end) {
            const parts = bondParts(b, maturity);
            const last = sched.length ? sched[sched.length - 1].amount : 0;
            const interest = f ? (rv.on ? parts.reinv : last) : parts.paidCash;
            list.push({
                label: `${bondLabel(b.type)} lejárat`,
                date: maturity,
                amount: Math.round(num(b.principal) + interest),
                type: "maturity",
            });
        }
    }
    return list.sort((a, b) => a.date.getTime() - b.date.getTime());
}
// havi átlagos, nem újrabefektetett kuponbevétel (a kupon nem minden hónapban érkezik)
function monthlyBondCouponIncome(): number {
    const t = today0();
    return state.bonds.reduce((s, b) => {
        const active = b.enabled && parseISO(b.purchaseDate) <= t && t < parseISO(b.maturityDate);
        if (!active || !bondFrequencyMonths(b) || effectiveReinvest(b).on) return s;
        return s + (((num(b.principal) * rateAt(b, t)) / 100) / 12) * taxFactor();
    }, 0);
}


const toHuf = (amount: number, currency: "HUF" | "EUR") =>
    currency === "EUR" ? amount * state.settings.eurHufRate : amount;
const money = (huf: number) =>
    state.settings.displayCurrency === "EUR"
        ? fmt("EUR").format(huf / state.settings.eurHufRate)
        : fmt("HUF").format(huf);
const bondLabel = (code: string) =>
    state.bondCatalog.find((b) => b.code === code)?.label ?? code;
const categoryLabel = (c: Asset["category"]) =>
    ({
        cash: "Készpénz",
        bank: "Bankszámla",
        etf: "ETF",
        stock: "Részvény",
        other: "Egyéb eszköz",
        liability: "Tartozás",
    })[c];

const cashflowCategoryLabel = (c: string) =>
    ({
        fizetes: "Fizetés",
        mellékjovedelem: "Mellékjövedelem",
        betet_kamat: "Betét kamat",
        kamatjovedelem: "Kamatjövedelem",
        egyeb_bevetel: "Egyéb bevétel",
        altalanos_kiadás: "Általános kiadás",
        elelmiszer: "Élelmiszer",
        lakas: "Lakás",
        kozlekedes: "Közlekedés",
        szórakozas: "Szórakozás",
        egeszsegugy: "Egészségügy",
        oktatás: "Oktatás",
        egyeb_kiadás: "Egyéb kiadás",
    })[c] ?? c;

async function api<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as any).message || "Hiba");
    return data as T;
}

// ---- FIXED: assetValueAt uses compound growth correctly ----
function assetValueAt(a: Asset, d: Date) {
    let value = toHuf(a.amount, a.currency);
    const now = new Date();
    if (d > now && (a.category === "etf" || a.category === "stock")) {
        const y = yearsBetween(now, d);
        value *= Math.pow(1 + state.settings.assetGrowth / 100, y);
    }
    return a.category === "liability" ? -value : value;
}

function isActiveToday(c: Cashflow) {
    return !!c.enabled && new Date(c.startDate) <= new Date();
}
function recurringMonthlyEquivalent(c: Cashflow) {
    return (
        c.amount /
        (c.interval === "monthly" ? 1 : c.interval === "quarterly" ? 3 : 12)
    );
}

// ---- FIXED: cashflowUntil uses correct growth reference date ----
function cashflowUntil(c: Cashflow, snapshot: Date) {
    if (!c.enabled) return 0;
    const start = new Date(c.startDate);
    if (snapshot < start) return 0;
    const sign = c.kind === "income" ? 1 : -1;
    const growth =
        (c.kind === "income"
            ? state.settings.incomeGrowth
            : state.settings.expenseGrowth) / 100;
    if (!c.recurring) return sign * c.amount;
    let total = 0;
    let cur = new Date(start);
    while (cur <= snapshot) {
        // Growth applied from the cashflow start date to each payment date
        const gYears = Math.max(0, yearsBetween(start, cur));
        total += sign * c.amount * Math.pow(1 + growth, gYears);
        cur = addMonths(cur, intervalMonths(c.interval));
    }
    return total;
}

function computeSnapshot(date: Date): Snapshot {
    const cashflow = state.cashflows.reduce(
        (s, c) => s + cashflowUntil(c, date),
        0,
    );
    const bonds = state.bonds.reduce((s, b) => s + bondValueAt(b, date), 0);
    const labels: { [k: string]: number } = {
        cash: 0,
        bank: 0,
        etf: 0,
        stock: 0,
        other: 0,
        liability: 0,
        cashflow,
        bonds,
    };
    for (const a of state.assets) labels[a.category] += assetValueAt(a, date);
    const extra =
        labels.cash +
        labels.bank +
        labels.etf +
        labels.stock +
        labels.other +
        labels.liability;
    return {
        date: new Date(date),
        basic: cashflow + bonds,
        full: cashflow + bonds + extra,
        labels,
    };
}

function buildSnapshots(): Snapshot[] {
    const now = new Date();
    const dates = [
        addMonths(now, -12),
        ...state.cashflows.map((c) => new Date(c.startDate)),
        ...state.bonds.map((b) => new Date(b.purchaseDate)),
    ];
    const min = startOfMonth(
        dates.sort((a, b) => a.getTime() - b.getTime())[0] ??
            addMonths(now, -12),
    );
    const max = endOfMonth(addYears(now, 10));
    const out: Snapshot[] = [];
    for (
        let monthCursor = new Date(min);
        monthCursor <= max;
        monthCursor = addMonths(monthCursor, 1)
    )
        out.push(computeSnapshot(endOfMonth(monthCursor)));
    return out;
}

function currentSnapshot() {
    return computeSnapshot(new Date());
}

// ---- annualBondYield: aktív papírok következő 12 havi (adó utáni) hozama ----
function annualBondYield() {
    const t = today0();
    return state.bonds.reduce((s, b) => {
        if (!b.enabled || !(parseISO(b.purchaseDate) <= t && t < parseISO(b.maturityDate))) return s;
        const rv = effectiveReinvest(b);
        const base = (num(b.principal) * rateAt(b, t)) / 100 * taxFactor();
        const reinv = rv.on ? ((bondParts(b, t).reinv * rv.rate) / 100) * taxFactor() : 0;
        return s + base + reinv;
    }, 0);
}

function annualAssetYield() {
    const now = new Date();
    return state.assets
        .filter(
            (a) =>
                state.view === "full" &&
                (a.category === "etf" || a.category === "stock"),
        )
        .reduce(
            (s, a) =>
                s + assetValueAt(a, now) * (state.settings.assetGrowth / 100),
            0,
        );
}

function theoreticalYield() {
    const annual = annualBondYield() + annualAssetYield();
    return { daily: annual / daysInYear, monthly: annual / 12, annual };
}

function occursWithin(c: Cashflow, start: Date, end: Date) {
    const first = new Date(c.startDate);
    const out: Date[] = [];
    if (!c.enabled) return out;
    if (!c.recurring) {
        if (first >= start && first <= end) out.push(first);
        return out;
    }
    const step = intervalMonths(c.interval);
    let cur = new Date(first);
    while (cur < start) cur = addMonths(cur, step);
    while (cur <= end) {
        out.push(new Date(cur));
        cur = addMonths(cur, step);
    }
    return out;
}

function nextThirtyDaysFlow() {
    const now = new Date();
    const end = addDays(now, 30);
    const cashflowPart = state.cashflows.reduce((sum, c) => {
        const sign = c.kind === "income" ? 1 : -1;
        return sum + occursWithin(c, now, end).length * sign * c.amount;
    }, 0);
    const bondPart = bondEventsBetween(now, end).reduce(
        (sum, e) => sum + e.amount,
        0,
    );
    return cashflowPart + bondPart;
}

function expenseMonthly() {
    return Math.abs(
        state.cashflows.reduce((sum, c) => {
            if (
                !c.enabled ||
                !c.recurring ||
                !isActiveToday(c) ||
                c.kind !== "expense"
            )
                return sum;
            return sum + recurringMonthlyEquivalent(c);
        }, 0),
    );
}

function incomeMonthly() {
    return state.cashflows.reduce((sum, c) => {
        if (
            !c.enabled ||
            !c.recurring ||
            !isActiveToday(c) ||
            c.kind !== "income"
        )
            return sum;
        return sum + recurringMonthlyEquivalent(c);
    }, 0) + monthlyBondCouponIncome();
}

// ---- Savings rate ----
function savingsRate() {
    const inc = incomeMonthly();
    if (inc <= 0) return 0;
    return ((inc - expenseMonthly()) / inc) * 100;
}

function buffer() {
    const target = expenseMonthly() * 6;
    const liquid = state.assets
        .filter((a) => a.category === "cash" || a.category === "bank")
        .reduce((s, a) => s + assetValueAt(a, new Date()), 0);
    return target > 0
        ? {
              percent: Math.min((liquid / target) * 100, 999),
              note: `${money(liquid)} / ${money(target)} cél`,
          }
        : { percent: 0, note: "Adj meg ismétlődő kiadást a buffer célhoz." };
}

function events() {
    const now = new Date();
    return bondEventsBetween(now, addYears(now, 10)).slice(0, 8);
}

function reportData(snaps: Snapshot[]) {
    const future = snaps.filter((s) => s.date >= new Date());
    const step =
        state.reportRange === "monthly"
            ? 1
            : state.reportRange === "quarterly"
              ? 3
              : 12;
    const count =
        state.reportRange === "monthly"
            ? 12
            : state.reportRange === "quarterly"
              ? 8
              : 10;
    const pick = future.filter((_, i) => i % step === 0).slice(0, count);
    return {
        labels: pick.map((x) =>
            state.reportRange === "yearly"
                ? String(x.date.getFullYear())
                : `${x.date.getFullYear()}.${String(x.date.getMonth() + 1).padStart(2, "0")}`,
        ),
        values: pick.map((x) => x[state.view]),
    };
}

function forecastData(snaps: Snapshot[]) {
    const now = new Date();
    const end = addYears(now, state.forecastYears);
    const pick = snaps.filter((s) => s.date >= now && s.date <= end);
    return {
        labels: pick.map(
            (x) =>
                `${x.date.getFullYear()}.${String(x.date.getMonth() + 1).padStart(2, "0")}`,
        ),
        values: pick.map((x) => x[state.view]),
    };
}

function allocation(snapshot: Snapshot) {
    return state.view === "basic"
        ? {
              "Felhalmozott cashflow": snapshot.labels.cashflow,
              Állampapírok: snapshot.labels.bonds,
          }
        : {
              "Felhalmozott cashflow": snapshot.labels.cashflow,
              Állampapírok: snapshot.labels.bonds,
              Készpénz: snapshot.labels.cash,
              Bankszámla: snapshot.labels.bank,
              ETF: snapshot.labels.etf,
              Részvény: snapshot.labels.stock,
              Egyéb: snapshot.labels.other,
              Tartozás: snapshot.labels.liability,
          };
}

// ---- Spending breakdown ----
function spendingBreakdown() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const categories: Record<string, number> = {
        "Általános kiadás": 0,
        Élelmiszer: 0,
        Lakás: 0,
        Közlekedés: 0,
        Szórakozás: 0,
        Egészségügy: 0,
        Oktatás: 0,
        "Egyéb kiadás": 0,
    };
    const catMap: Record<string, string> = {
        altalanos_kiadás: "Általános kiadás",
        elelmiszer: "Élelmiszer",
        lakas: "Lakás",
        kozlekedes: "Közlekedés",
        szórakozas: "Szórakozás",
        egeszsegugy: "Egészségügy",
        oktatás: "Oktatás",
        egyeb_kiadás: "Egyéb kiadás",
    };
    for (const cf of state.cashflows) {
        if (cf.kind !== "expense" || !cf.enabled) continue;
        const startDate = new Date(cf.startDate);
        if (startDate > monthEnd) continue;
        const monthlyAmount = cf.recurring
            ? cf.amount /
              (cf.interval === "yearly"
                  ? 12
                  : cf.interval === "quarterly"
                    ? 3
                    : 1)
            : cf.amount;
        if (
            cf.recurring ||
            (startDate >= monthStart && startDate <= monthEnd)
        ) {
            const catKey = catMap[cf.category] || "Egyéb kiadás";
            categories[catKey] += cf.recurring
                ? monthlyAmount
                : startDate >= monthStart && startDate <= monthEnd
                  ? cf.amount
                  : 0;
        }
    }
    return categories;
}

function incomeBreakdown() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const categories: Record<string, number> = {
        Fizetés: 0,
        Mellékjövedelem: 0,
        "Betét kamat": 0,
        Kamatjövedelem: 0,
        "Egyéb bevétel": 0,
    };
    const catMap: Record<string, string> = {
        fizetes: "Fizetés",
        mellékjovedelem: "Mellékjövedelem",
        betet_kamat: "Betét kamat",
        kamatjovedelem: "Kamatjövedelem",
        egyeb_bevetel: "Egyéb bevétel",
    };
    for (const cf of state.cashflows) {
        if (cf.kind !== "income" || !cf.enabled) continue;
        const startDate = new Date(cf.startDate);
        if (startDate > monthEnd) continue;
        const monthlyAmount = cf.recurring
            ? cf.amount /
              (cf.interval === "yearly"
                  ? 12
                  : cf.interval === "quarterly"
                    ? 3
                    : 1)
            : cf.amount;
        if (
            cf.recurring ||
            (startDate >= monthStart && startDate <= monthEnd)
        ) {
            const catKey = catMap[cf.category] || "Egyéb bevétel";
            categories[catKey] += cf.recurring
                ? monthlyAmount
                : startDate >= monthStart && startDate <= monthEnd
                  ? cf.amount
                  : 0;
        }
    }
    return categories;
}

function chartOpts() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: css("--color-text") } },
            tooltip: {
                callbacks: {
                    label: (ctx: any) =>
                        `${ctx.dataset.label || ctx.label}: ${money(ctx.parsed.y ?? ctx.parsed)}`,
                },
            },
        },
        scales: {
            x: {
                ticks: { color: css("--color-text-muted") },
                grid: { color: "rgba(255,255,255,.05)" },
            },
            y: {
                ticks: {
                    color: css("--color-text-muted"),
                    callback: (v: number) => money(v),
                },
                grid: { color: "rgba(255,255,255,.06)" },
            },
        },
    };
}

function destroyCharts() {
    Object.values(state.charts).forEach((c) => c?.destroy?.());
}

function renderCharts(snaps: Snapshot[]) {
    destroyCharts();
    const rep = reportData(snaps);
    const fore = forecastData(snaps);
    const alloc = allocation(currentSnapshot());

    state.charts.report = new Chart(qs("#report-chart"), {
        type: "bar",
        data: {
            labels: rep.labels,
            datasets: [
                {
                    label: "Vagyon",
                    data: rep.values,
                    backgroundColor: "rgba(92,183,178,.55)",
                    borderColor: "rgba(92,183,178,1)",
                    borderWidth: 1.2,
                    borderRadius: 10,
                },
            ],
        },
        options: chartOpts(),
    });
    state.charts.forecast = new Chart(qs("#forecast-chart"), {
        type: "line",
        data: {
            labels: fore.labels,
            datasets: [
                {
                    label: `${state.forecastYears} éves előrejelzés`,
                    data: fore.values,
                    borderColor: "rgba(92,183,178,1)",
                    backgroundColor: "rgba(92,183,178,.12)",
                    fill: true,
                    tension: 0.28,
                    pointRadius: 0,
                },
            ],
        },
        options: chartOpts(),
    });
    state.charts.allocation = new Chart(qs("#allocation-chart"), {
        type: "doughnut",
        data: {
            labels: Object.keys(alloc),
            datasets: [
                {
                    data: Object.values(alloc),
                    backgroundColor: [
                        "#5cb7b2",
                        "#7d91ff",
                        "#8fd26c",
                        "#ffb357",
                        "#b486ff",
                        "#6ac8ff",
                        "#c8d2d0",
                        "#ff7f88",
                    ],
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: css("--color-text") } },
                tooltip: {
                    callbacks: {
                        label: (ctx: any) =>
                            `${ctx.label}: ${money(ctx.parsed)}`,
                    },
                },
            },
        },
    });

    // ---- NEW: Spending breakdown chart ----
    const spendingData = spendingBreakdown();
    const spendingTotal = Object.values(spendingData).reduce(
        (s, v) => s + v,
        0,
    );
    const spendingParts = Object.entries(spendingData).map(([k, v]) => ({
        name: k,
        value: v,
    }));
    const spendingColors = [
        "#ff9898",
        "#ffb357",
        "#ffd27a",
        "#ff7f88",
        "#be8cff",
        "#8fcb6f",
        "#7487ea",
        "#79b8ff",
    ];

    if (spendingTotal > 0) {
        state.charts.spending = new Chart(qs("#spending-chart"), {
            type: "doughnut",
            data: {
                labels: spendingParts.map((p) => p.name),
                datasets: [
                    {
                        data: spendingParts.map((p) => p.value),
                        backgroundColor: spendingParts.map(
                            (_, i) => spendingColors[i % spendingColors.length],
                        ),
                        borderColor: "#d9e1dc",
                        borderWidth: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "50%",
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: {
                            color: css("--color-text"),
                            boxWidth: 12,
                            padding: 10,
                            font: { size: 10 },
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const val = ctx.parsed;
                                const pct = (
                                    (val / spendingTotal) *
                                    100
                                ).toFixed(1);
                                return `${ctx.label}: ${money(val)} (${pct}%)`;
                            },
                        },
                    },
                },
            },
        });
    }

    // ---- NEW: Income vs Expense chart ----
    const totalIncome = incomeMonthly();
    const totalExpense = expenseMonthly();
    if (qs("#income-expense-chart")) {
        state.charts.incomeExpense = new Chart(qs("#income-expense-chart"), {
            type: "bar",
            data: {
                labels: ["Bevétel összes", "Kiadás összes"],
                datasets: [
                    {
                        label: "Havi (HUF)",
                        data: [totalIncome, totalExpense],
                        backgroundColor: [
                            "rgba(136,223,123,.6)",
                            "rgba(255,112,112,.6)",
                        ],
                        borderColor: [
                            "rgba(136,223,123,1)",
                            "rgba(255,112,112,1)",
                        ],
                        borderWidth: 1,
                        borderRadius: 6,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: css("--color-text") } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) =>
                                `${ctx.dataset.label}: ${money(ctx.parsed.y)}`,
                        },
                    },
                },
                scales: {
                    x: {
                        ticks: { color: css("--color-text-muted") },
                        grid: { color: "rgba(255,255,255,.06)" },
                    },
                    y: {
                        ticks: {
                            color: css("--color-text-muted"),
                            callback: (v) => money(v),
                        },
                        grid: { color: "rgba(255,255,255,.06)" },
                    },
                },
            },
        });
    }

    // ---- NEW: Savings rate gauge ----
    const sr = savingsRate();
    if (qs("#savings-rate-chart")) {
        state.charts.savingsRate = new Chart(qs("#savings-rate-chart"), {
            type: "bar",
            data: {
                labels: ["Megtakarítási ráta"],
                datasets: [
                    {
                        label: "%",
                        data: [sr],
                        backgroundColor:
                            sr >= 20
                                ? "rgba(136,223,123,.7)"
                                : sr >= 10
                                  ? "rgba(255,210,122,.7)"
                                  : "rgba(255,112,112,.7)",
                        borderColor:
                            sr >= 20
                                ? "rgba(136,223,123,1)"
                                : sr >= 10
                                  ? "rgba(255,210,122,1)"
                                  : "rgba(255,112,112,1)",
                        borderWidth: 1,
                        borderRadius: 6,
                        barThickness: 40,
                    },
                    {
                        label: "Cél (20%)",
                        data: [20],
                        backgroundColor: "rgba(121,201,193,.15)",
                        borderColor: "rgba(121,201,193,.4)",
                        borderWidth: 1,
                        borderDash: [6, 4],
                        borderRadius: 6,
                        barThickness: 40,
                    },
                ],
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: css("--color-text") } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) =>
                                `${ctx.dataset.label}: ${ctx.parsed.x.toFixed(1)}%`,
                        },
                    },
                },
                scales: {
                    x: {
                        max: 100,
                        ticks: {
                            color: css("--color-text-muted"),
                            callback: (v) => v + "%",
                        },
                        grid: { color: "rgba(255,255,255,.06)" },
                    },
                    y: {
                        ticks: { color: css("--color-text-muted") },
                        grid: { display: false },
                    },
                },
            },
        });
    }
}

function renderList<T>(
    target: Element,
    items: T[],
    renderer: (x: T) => string,
    empty: string,
) {
    target.className = items.length ? "table-list" : "table-list empty-state";
    target.innerHTML = items.length ? items.map(renderer).join("") : empty;
}
function renderCashflows() {
    renderList(
        qs("#cashflow-list"),
        state.cashflows,
        (x) => {
            const catLabel = x.category
                ? cashflowCategoryLabel(x.category)
                : "Nincs kategória";
            return `<article class="list-item"><div><strong>${x.name}</strong><div class="muted">${catLabel} · ${x.recurring ? "Ismétlődő" : "Egyszeri"} · ${x.recurring ? (x.interval === "monthly" ? "havi" : x.interval === "quarterly" ? "negyedéves" : "éves") : "egyszeri"} · ${x.startDate}</div></div><div><span class="badge">${x.kind === "income" ? "Bevétel" : "Kiadás"}</span></div><div class="${x.kind === "income" ? "positive" : "negative"}"><strong>${money(x.amount)}</strong></div><button class="delete-button" data-kind="cashflow" data-id="${x.id}">Törlés</button></article>`;
        },
        "Még nincs cashflow tétel.",
    );
}
function renderAssets() {
    renderList(
        qs("#asset-list"),
        state.assets,
        (x) =>
            `<article class="list-item"><div><strong>${x.name}</strong><div class="muted">${categoryLabel(x.category)} · ${x.currency}</div></div><div><span class="badge">${categoryLabel(x.category)}</span></div><div class="${x.category === "liability" ? "negative" : ""}"><strong>${x.currency === "EUR" ? fmt("EUR").format(x.amount) : fmt("HUF").format(x.amount)}</strong></div><button class="delete-button" data-kind="asset" data-id="${x.id}">Törlés</button></article>`,
        "Még nincs extra eszköz.",
    );
}
function renderBonds() {
    renderList(
        qs("#bond-list"),
        state.bonds,
        (x) =>
            `<article class="list-item"><div><strong>${bondLabel(x.type)} ${x.series ? `· ${x.series}` : ""}</strong><div class="muted">${x.purchaseDate} → ${x.maturityDate} · ${x.reinvestInterest ? "újrabefektet" : "nem forgat vissza"}</div></div><div><span class="badge">${x.annualRate.toFixed(2)}%</span></div><div><strong>${money(x.principal)}</strong></div><button class="delete-button" data-kind="bond" data-id="${x.id}">Törlés</button></article>`,
        "Még nincs állampapír.",
    );
}

function renderSchedule() {
    const e = events();
    const thirtyDay = nextThirtyDaysFlow();
    const nextCoupon = e.find((item) => item.type === "coupon");
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const accrued = state.bonds.reduce(
        (sum, b) => sum + accruedInterestForBond(b, now),
        0,
    );
    const yearCouponYield = bondEventsBetween(startOfYear(now), endOfYear(now))
        .filter((item) => item.type === "coupon")
        .reduce((sum, item) => sum + item.amount, 0);
    renderList(
        qs("#schedule-list"),
        e,
        (x) =>
            `<article class="list-item"><div><strong>${x.label}</strong><div class="muted">${x.date.toLocaleDateString("hu-HU")}</div></div><div><span class="badge">${x.type === "coupon" ? "Kupon" : "Lejárat"}</span></div><div><strong>${money(x.amount)}</strong></div><div class="muted">közelgő</div></article>`,
        "Még nincs közelgő esemény.",
    );
    qs("#accrued-interest").textContent = money(accrued);
    qs("#next-coupon-summary").textContent = nextCoupon
        ? `${nextCoupon.date.toLocaleDateString("hu-HU")} · ${money(nextCoupon.amount)}`
        : "Nincs közelgő kupon";
    qs("#realized-annual-yield").textContent = money(yearCouponYield);
    qs("#next-bond-event").innerHTML = e[0]
        ? `<strong>${e[0].label}</strong><div class="muted">${e[0].date.toLocaleDateString("hu-HU")} · ${money(e[0].amount)}</div><div class="muted">Következő 30 nap: ${money(thirtyDay)}</div>`
        : `<strong>Nincs közeli esemény</strong><div class="muted">Következő 30 nap: ${money(thirtyDay)}</div>`;
}

function renderKpis(snaps: Snapshot[]) {
    const cur = currentSnapshot();
    const y = theoreticalYield();
    const b = buffer();
    qs("#net-worth").textContent = money(cur[state.view]);
    qs("#daily-growth").textContent = money(y.daily);
    qs("#hourly-growth").textContent = money(y.monthly);
    qs("#monthly-net").textContent = money(y.annual);
    qs("#fx-rate-side").textContent =
        `1 EUR = ${state.settings.eurHufRate.toFixed(2)} HUF`;
    qs("#active-view-side").textContent =
        state.view === "basic" ? "Alap" : "Teljes";
    qs("#buffer-text").textContent = `${b.percent.toFixed(0)}%`;
    (qs("#buffer-bar") as HTMLElement).style.width =
        `${Math.min(b.percent, 100)}%`;
    qs("#buffer-note").textContent = b.note;
}

function applyTheme(theme: "dark" | "light") {
    document.documentElement.setAttribute("data-theme", theme);
    state.settings.theme = state.settings.theme;
    qs("#theme-toggle").textContent = theme === "dark" ? "☾" : "☀";
}
function renderSettings() {
    const f = qs<HTMLFormElement>("#settings-form");
    (f.elements.namedItem("displayCurrency") as HTMLSelectElement).value =
        state.settings.displayCurrency;
    (f.elements.namedItem("eurHufRate") as HTMLInputElement).value = String(
        state.settings.eurHufRate,
    );
    (f.elements.namedItem("incomeGrowth") as HTMLInputElement).value = String(
        state.settings.incomeGrowth,
    );
    (f.elements.namedItem("expenseGrowth") as HTMLInputElement).value = String(
        state.settings.expenseGrowth,
    );
    (f.elements.namedItem("assetGrowth") as HTMLInputElement).value = String(
        state.settings.assetGrowth,
    );
    (f.elements.namedItem("inflation") as HTMLInputElement).value = String(
        state.settings.inflation,
    );
    (f.elements.namedItem("interestTax") as HTMLInputElement).value = String(
        state.settings.interestTax ?? 0,
    );
}
function renderBondTemplates() {
    const s = qs<HTMLSelectElement>("#bond-type");
    if (!s.options.length)
        s.innerHTML = state.bondCatalog
            .map((x) => `<option value="${x.code}">${x.label}</option>`)
            .join("");
    applyTemplate(s.value);
}
function applyTemplate(code: string) {
    const t = state.bondCatalog.find((x) => x.code === code);
    if (!t) return;
    const f = qs<HTMLFormElement>("#bond-form");
    const rate = f.elements.namedItem("annualRate") as HTMLInputElement;
    const coupon = f.elements.namedItem("couponFrequency") as HTMLSelectElement;
    const purchase = f.elements.namedItem("purchaseDate") as HTMLInputElement;
    const maturity = f.elements.namedItem("maturityDate") as HTMLInputElement;
    if (!rate.value || Number(rate.value) === 0)
        rate.value = String(t.defaultRate);
    coupon.value = t.couponFrequency;
    if (!purchase.value) purchase.value = new Date().toISOString().slice(0, 10);
    if (!maturity.value)
        maturity.value = addYears(new Date(), t.suggestedYears)
            .toISOString()
            .slice(0, 10);
    qs("#bond-template-note").textContent = t.description;
}

function render() {
    applyTheme(state.settings.theme);
    renderSettings();
    renderBondTemplates();
    renderCashflows();
    renderAssets();
    renderBonds();
    const snaps = buildSnapshots();
    renderKpis(snaps);
    renderSchedule();
    renderCharts(snaps);
    document
        .querySelectorAll<HTMLElement>("[data-view-toggle]")
        .forEach((b) =>
            b.classList.toggle(
                "is-active",
                b.dataset.viewToggle === state.view,
            ),
        );
    document
        .querySelectorAll<HTMLElement>("[data-report-range]")
        .forEach((b) =>
            b.classList.toggle(
                "is-active",
                b.dataset.reportRange === state.reportRange,
            ),
        );
    document
        .querySelectorAll<HTMLElement>("[data-forecast-years]")
        .forEach((b) =>
            b.classList.toggle(
                "is-active",
                Number(b.dataset.forecastYears) === state.forecastYears,
            ),
        );
}

async function load() {
    const boot = await api<Bootstrap>("/api/bootstrap");
    state.settings = boot.settings;
    state.cashflows = boot.cashflows;
    state.assets = boot.assets;
    state.bonds = boot.bonds;
    state.bondCatalog = boot.bondCatalog;
    render();
}
async function saveSettings(partial?: Partial<Settings>) {
    state.settings = await api<Settings>("/api/settings", {
        method: "POST",
        body: JSON.stringify({ ...state.settings, ...partial }),
    });
    render();
}

function bind() {
    qs("#theme-toggle").addEventListener("click", () => {
        state.settings.theme =
            state.settings.theme === "dark" ? "light" : "dark";
        void saveSettings();
    });
    document.querySelectorAll<HTMLElement>("[data-view-toggle]").forEach((b) =>
        b.addEventListener("click", () => {
            state.view = b.dataset.viewToggle as ViewMode;
            render();
        }),
    );
    document.querySelectorAll<HTMLElement>("[data-report-range]").forEach((b) =>
        b.addEventListener("click", () => {
            state.reportRange = b.dataset.reportRange as ReportRange;
            render();
        }),
    );
    document
        .querySelectorAll<HTMLElement>("[data-forecast-years]")
        .forEach((b) =>
            b.addEventListener("click", () => {
                state.forecastYears = Number(b.dataset.forecastYears);
                render();
            }),
        );
    qs<HTMLSelectElement>("#bond-type").addEventListener("change", (e) =>
        applyTemplate((e.target as HTMLSelectElement).value),
    );
    qs<HTMLFormElement>("#cashflow-form").addEventListener(
        "submit",
        async (e) => {
            e.preventDefault();
            const f = e.currentTarget as HTMLFormElement;
            const d = new FormData(f);
            const item = await api<Cashflow>("/api/cashflows", {
                method: "POST",
                body: JSON.stringify({
                    kind: d.get("kind"),
                    name: d.get("name"),
                    amount: Number(d.get("amount")),
                    startDate: d.get("startDate"),
                    recurring: d.get("recurring") === "on",
                    interval: d.get("interval"),
                    note: d.get("note"),
                    category: d.get("category"),
                }),
            });
            state.cashflows.unshift(item);
            f.reset();
            (f.elements.namedItem("recurring") as HTMLInputElement).checked =
                true;
            render();
        },
    );
    qs<HTMLFormElement>("#asset-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = e.currentTarget as HTMLFormElement;
        const d = new FormData(f);
        const isEq = ["stock", "etf"].includes(String(d.get("category")));
        const q = num(d.get("quantity")),
            p = num(d.get("price")),
            useQp = isEq && q > 0 && p > 0;
        const item = await api<Asset>("/api/assets", {
            method: "POST",
            body: JSON.stringify({
                name: d.get("name"),
                category: d.get("category"),
                quantity: useQp ? q : null,
                price: useQp ? p : null,
                amount: useQp ? Math.round(q * p * 100) / 100 : Number(d.get("amount")),
                currency: d.get("currency"),
                note: d.get("note"),
            }),
        });
        state.assets.unshift(item);
        f.reset();
        render();
    });
    qs<HTMLFormElement>("#bond-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = e.currentTarget as HTMLFormElement;
        const d = new FormData(f);
        const item = await api<Bond>("/api/bonds", {
            method: "POST",
            body: JSON.stringify({
                type: d.get("type"),
                series: d.get("series"),
                principal: Number(d.get("principal")),
                annualRate: Number(d.get("annualRate")),
                purchaseDate: d.get("purchaseDate"),
                maturityDate: d.get("maturityDate"),
                couponFrequency: d.get("couponFrequency"),
                reinvestInterest: d.get("reinvestInterest") === "on" ? 1 : 0,
                reinvestRate: num(d.get("reinvestRate")),
                liquid: d.get("liquid") ? 1 : 0,
                rateSteps: String(d.get("rateSteps") || "").trim(),
                notes: "",
            }),
        });
        state.bonds.push(item);
        f.reset();
        renderBondTemplates();
        render();
    });
    qs<HTMLFormElement>("#settings-form").addEventListener(
        "submit",
        async (e) => {
            e.preventDefault();
            const f = e.currentTarget as HTMLFormElement;
            const d = new FormData(f);
            state.settings.displayCurrency = d.get("displayCurrency") as
                | "HUF"
                | "EUR";
            state.settings.eurHufRate = Number(d.get("eurHufRate"));
            state.settings.incomeGrowth = Number(d.get("incomeGrowth"));
            state.settings.expenseGrowth = Number(d.get("expenseGrowth"));
            state.settings.assetGrowth = Number(d.get("assetGrowth"));
            state.settings.inflation = Number(d.get("inflation"));
            state.settings.interestTax = Math.min(100, Math.max(0, num(d.get("interestTax"))));
            await saveSettings();
        },
    );
    const fxRefreshHandler = async () => {
        try {
            const response = await fetch(
                "https://api.frankfurter.dev/v1/latest?from=EUR&to=HUF",
            );
            const data = await response.json();
            const rate = data?.rates?.HUF;
            if (!rate) throw new Error("Árfolyamfrissítés sikertelen");
            state.settings.eurHufRate = rate;
            await saveSettings({ eurHufRate: rate });
            alert(`Új EUR/HUF árfolyam: ${rate.toFixed(2)}`);
        } catch (err) {
            alert(
                err instanceof Error
                    ? err.message
                    : "Árfolyamfrissítés sikertelen",
            );
        }
    };
    qs("#refresh-fx").addEventListener("click", fxRefreshHandler);
    qs("#refresh-fx-settings").addEventListener("click", fxRefreshHandler);
    document.body.addEventListener("click", async (e) => {
        const target = e.target as HTMLElement;
        const button = target.closest("[data-kind]") as HTMLElement | null;
        if (!button) return;
        const kind = button.dataset.kind;
        const id = Number(button.dataset.id);
        if (kind === "cashflow") {
            await api("/api/cashflows/" + id, { method: "DELETE" });
            state.cashflows = state.cashflows.filter((x) => x.id !== id);
        }
        if (kind === "asset") {
            await api("/api/assets/" + id, { method: "DELETE" });
            state.assets = state.assets.filter((x) => x.id !== id);
        }
        if (kind === "bond") {
            await api("/api/bonds/" + id, { method: "DELETE" });
            state.bonds = state.bonds.filter((x) => x.id !== id);
        }
        render();
    });
}

bind();
void load();

// Piaci lekérdezés eltávolítva (nincs megbízható, kulcs nélküli, ingyenes API).

function setCurrency(currency: "HUF" | "EUR") {
    state.settings.displayCurrency = currency;
    saveSettings({ displayCurrency: currency });
    const hufBtn = document.querySelector(
        "#currency-huf",
    ) as HTMLElement | null;
    const eurBtn = document.querySelector(
        "#currency-eur",
    ) as HTMLElement | null;
    hufBtn?.classList.toggle("is-active", currency === "HUF");
    eurBtn?.classList.toggle("is-active", currency === "EUR");
    render();
}

const hufBtn = document.querySelector(
    "#currency-huf",
) as HTMLButtonElement | null;
const eurBtn = document.querySelector(
    "#currency-eur",
) as HTMLButtonElement | null;
hufBtn?.addEventListener("click", () => setCurrency("HUF"));
eurBtn?.addEventListener("click", () => setCurrency("EUR"));
