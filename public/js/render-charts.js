/* Moneeey – Charts */
/* ================= Chartok ================= */
const TXT = "#edf3ef",
    MUTED = "#97a59d",
    GRID = "rgba(255,255,255,.06)";

// Chart.js hit-testing fix for CSS zoom (see fit.js)
Chart.register({
    id: "zoomFix",
    beforeEvent(chart, args) {
        const e = args.event,
            n = e.native;
        if (!n) return;
        const p = (n.touches && n.touches[0]) || n;
        if (p.clientX == null) return;
        const c = chart.canvas,
            r = c.getBoundingClientRect();
        if (!r.width || !r.height) return;
        e.x = (p.clientX - r.left) * (c.offsetWidth / r.width);
        e.y = (p.clientY - r.top) * (c.offsetHeight / r.height);
        args.inChartArea = chart.isPointInArea(e);
    },
});

const axisOpts = () => ({
    x: { ticks: { color: MUTED }, grid: { color: GRID } },
    y: {
        ticks: { color: MUTED, callback: (v) => money(v) },
        grid: { color: GRID },
    },
});
const moneyTooltip = () => ({
    callbacks: { label: (c) => `${c.dataset.label}: ${money(c.parsed.y)}` },
});
const centerTotal = {
    id: "centerTotal",
    afterDraw(chart, _args, opts) {
        if (!opts?.text) return;
        const {
            ctx,
            chartArea: { left, right, top, bottom },
        } = chart;
        const cx = (left + right) / 2,
            cy = (top + bottom) / 2;
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = MUTED;
        ctx.font = "12px sans-serif";
        ctx.fillText("Összesen", cx, cy - 12);
        ctx.fillStyle = TXT;
        ctx.font = "600 16px sans-serif";
        ctx.fillText(opts.text, cx, cy + 8);
        ctx.restore();
    },
};

function renderCharts() {
    Object.keys(state.charts).forEach((k) => {
        if (state.charts[k]) {
            state.charts[k].destroy();
            state.charts[k] = null;
        }
    });
    const mk = (id, cfg) => {
        const c = document.getElementById(id);
        return c ? new Chart(c, cfg) : null;
    };
    const step = (fn) => safe(fn);

    step(function wealthChart() {
        const w = forecastSeries(1, 12),
            now = currentNetWorth();
        state.charts.wealth = mk("wealth-chart", {
            type: "bar",
            data: {
                labels: ["Jelenleg", ...w.labels],
                datasets: [
                    {
                        label: "Vagyon (nominális)",
                        data: [Math.round(now), ...w.nominal],
                        backgroundColor: "rgba(121,201,193,.55)",
                        borderColor: "rgba(121,201,193,1)",
                        borderWidth: 1,
                        borderRadius: 8,
                    },
                    {
                        label: "Vagyon (reálérték, inflációval)",
                        data: [Math.round(now), ...w.real],
                        backgroundColor: "rgba(255,210,122,.35)",
                        borderColor: "rgba(255,210,122,1)",
                        borderWidth: 1,
                        borderRadius: 8,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: TXT } },
                    tooltip: moneyTooltip(),
                },
                scales: axisOpts(),
            },
        });
    });
    step(function allocationChart() {
        const alloc = {
            Készpénz: sumCat("cash"),
            Bankszámla: sumCat("bank"),
            ETF: sumCat("etf"),
            Részvény: sumCat("stock"),
            "Egyéb eszköz": sumCat("other"),
            "Állampapír (tőke)": totalBondPrincipal(),
            "Állampapír kamat (felhalm. + újrabef.)":
                accruedInterest() + reinvestedBalanceNow(),
        };
        const keys = Object.keys(alloc).filter((k) => alloc[k] > 0);
        state.charts.allocation = mk("allocation-chart", {
            type: "doughnut",
            data: {
                labels: keys,
                datasets: [
                    {
                        data: keys.map((k) => Math.round(alloc[k])),
                        backgroundColor: [
                            "#7fd4cc",
                            "#ffd27a",
                            "#7487ea",
                            "#be8cff",
                            "#79b8ff",
                            "#8fcb6f",
                            "#b6e08f",
                        ],
                        borderColor: "#d9e1dc",
                        borderWidth: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: 56,
                plugins: {
                    legend: {
                        position: "top",
                        labels: { color: TXT, boxWidth: 14, padding: 12 },
                    },
                    tooltip: {
                        callbacks: {
                            label: (c) => `${c.label}: ${money(c.parsed)}`,
                        },
                    },
                },
            },
        });
    });
    step(function quarterlyChart() {
        const q = forecastSeries(3, 8);
        state.charts.quarterly = mk("quarterly-chart", {
            type: "line",
            data: {
                labels: q.labels,
                datasets: [
                    {
                        label: "Negyedéves vagyon (nominális)",
                        data: q.nominal,
                        borderColor: "#7fd4cc",
                        backgroundColor: "rgba(127,212,204,.18)",
                        fill: true,
                        tension: 0.28,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                    },
                    {
                        label: "Reálérték (inflációval korrigálva)",
                        data: q.real,
                        borderColor: "#ffd27a",
                        backgroundColor: "rgba(255,210,122,.12)",
                        borderDash: [6, 4],
                        fill: false,
                        tension: 0.28,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: TXT } },
                    tooltip: moneyTooltip(),
                },
                scales: axisOpts(),
            },
        });
    });
    step(function yearlyChart() {
        const y = forecastSeries(12, 6);
        state.charts.yearly = mk("yearly-chart", {
            type: "line",
            data: {
                labels: y.labels,
                datasets: [
                    {
                        label: "Éves vagyon (nominális)",
                        data: y.nominal,
                        borderColor: "#7487ea",
                        backgroundColor: "rgba(116,135,234,.18)",
                        fill: true,
                        tension: 0.24,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                    },
                    {
                        label: "Reálérték (inflációval korrigálva)",
                        data: y.real,
                        borderColor: "#ffd27a",
                        backgroundColor: "rgba(255,210,122,.12)",
                        borderDash: [6, 4],
                        fill: false,
                        tension: 0.24,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: TXT } },
                    tooltip: moneyTooltip(),
                },
                scales: axisOpts(),
            },
        });
    });
    const donut = (id, data, colors) => {
        const parts = Object.entries(data).filter(([, v]) => v > 0),
            total = parts.reduce((s, [, v]) => s + v, 0);
        const canvas = document.getElementById(id);
        if (!canvas) return null;
        if (!total) {
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = MUTED;
            ctx.font = "14px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Nincs adat", canvas.width / 2, canvas.height / 2);
            return null;
        }
        const legendPos = window.innerWidth < 760 ? "bottom" : "right";
        return mk(id, {
            type: "doughnut",
            plugins: [centerTotal],
            data: {
                labels: parts.map((p) => p[0]),
                datasets: [
                    {
                        data: parts.map((p) => Math.round(p[1])),
                        backgroundColor: parts.map(
                            (_, i) => colors[i % colors.length],
                        ),
                        borderColor: "#121817",
                        borderWidth: 3,
                        hoverOffset: 6,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "62%",
                layout: { padding: 8 },
                plugins: {
                    centerTotal: { text: HUF(total) },
                    legend: {
                        position: legendPos,
                        labels: {
                            color: TXT,
                            boxWidth: 12,
                            boxHeight: 12,
                            padding: 10,
                            font: { size: 12 },
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: (c) =>
                                `${c.label}: ${HUF(c.parsed)} (${((c.parsed / total) * 100).toFixed(1)}%)`,
                        },
                    },
                },
            },
        });
    };
    step(function spendingChart() {
        state.charts.spending = donut("spending-chart", spendingBreakdown(), [
            "#ff9898",
            "#ffb357",
            "#ffd27a",
            "#ff7f88",
            "#be8cff",
            "#8fcb6f",
            "#7487ea",
            "#79b8ff",
        ]);
    });
    step(function incomeChart() {
        state.charts.incomeBreakdown = donut(
            "income-breakdown-chart",
            incomeBreakdown(),
            ["#8fcb6f", "#7fd4cc", "#ffd27a", "#7487ea", "#be8cff", "#79b8ff"],
        );
    });
    step(function incomeExpenseChart() {
        state.charts.incomeExpense = mk("income-expense-chart", {
            type: "bar",
            data: {
                labels: ["Bevétel összesen", "Kiadás összesen"],
                datasets: [
                    {
                        label: "Havi",
                        data: [
                            Math.round(monthlyIncome()),
                            Math.round(monthlyExpense()),
                        ],
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
                    legend: { labels: { color: TXT } },
                    tooltip: {
                        callbacks: {
                            label: (c) =>
                                `${c.dataset.label}: ${HUF(c.parsed.y)}`,
                        },
                    },
                },
                scales: axisOpts(),
            },
        });
    });
    step(function savingsChart() {
        const sr = savingsRate();
        state.charts.savingsRate = mk("savings-rate-chart", {
            type: "bar",
            data: {
                labels: ["Megtakarítási ráta"],
                datasets: [
                    {
                        label: "Jelenlegi",
                        data: [sr],
                        backgroundColor:
                            sr >= 20
                                ? "rgba(136,223,123,.7)"
                                : sr >= 10
                                  ? "rgba(255,210,122,.7)"
                                  : "rgba(255,112,112,.7)",
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
                    legend: { labels: { color: TXT } },
                    tooltip: {
                        callbacks: {
                            label: (c) =>
                                `${c.dataset.label}: ${c.parsed.x.toFixed(1)}%`,
                        },
                    },
                },
                scales: {
                    x: {
                        min: Math.min(0, sr),
                        max: 100,
                        ticks: { color: MUTED, callback: (v) => v + "%" },
                        grid: { color: GRID },
                    },
                    y: { ticks: { color: MUTED }, grid: { display: false } },
                },
            },
        });
    });
}
