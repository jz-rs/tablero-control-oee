//Tasa ideal para Performance (unid/hora)
const IDEAL_RATE_UNITS_PER_HOUR = 120;

//Dataset se cargará desde data.json
let dataset = [];

//Utilidades
function safeDiv(num, den) { return den === 0 ? 0 : num / den; }
function computeAvailability(r) { return safeDiv((r.planned_hours - r.downtime_hours), r.planned_hours); }
function computePerformance(r) { return safeDiv(r.production_units, IDEAL_RATE_UNITS_PER_HOUR * r.runtime_hours); }
function computeQuality(r) { return safeDiv(r.good_units, r.production_units); }
function computeOEE(r) { return computeAvailability(r) * computePerformance(r) * computeQuality(r); }
function computeUtilization(r) { return safeDiv(r.runtime_hours, r.planned_hours); }
function computeFailureRate(r) { return safeDiv(r.failures, r.production_units); }
function computeMTBF(r) { return r.failures === 0 ? r.runtime_hours : (r.runtime_hours / r.failures); }
function computeMarketShare(r) { return safeDiv(r.sales_internal, r.sales_market_total); }

function computeGrowth(series) {
  const out = [0];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const cur = series[i];
    out.push(safeDiv(cur - prev, Math.max(prev, 1)));
  }
  return out;
}

//KPI helpers
function toPct(x, digits = 1) { return x.toFixed(digits) + "%"; }

function setKpiCard(id, value, thresholds, inverse = false) {
  const el = document.getElementById(id);
  el.textContent = toPct(value, 1);
  const card = el.closest(".kpi-card");
  card.classList.remove("good", "warn", "bad");
  const v = value;

  if (!inverse) {
    if (v >= thresholds.good) card.classList.add("good");
    else if (v >= thresholds.warn) card.classList.add("warn");
    else card.classList.add("bad");
  } else {
    if (v <= thresholds.good) card.classList.add("good");
    else if (v <= thresholds.warn) card.classList.add("warn");
    else card.classList.add("bad");
  }
}

function initHeaderKPIs() {
  const last = dataset[dataset.length - 1];

  const Av = computeAvailability(last) * 100;
  const Pe = computePerformance(last) * 100;
  const Qa = computeQuality(last) * 100;

  const OEE = (Av / 100) * (Pe / 100) * (Qa / 100) * 100;
  const Util = computeUtilization(last) * 100;
  const Fail = computeFailureRate(last) * 100;
  const MS = computeMarketShare(last) * 100;

  document.getElementById("kpi-oee").textContent = toPct(OEE, 1);
  document.getElementById("kpi-oee-sub").textContent =
    `Disp ${toPct(Av)} · Perf ${toPct(Pe)} · Cal ${toPct(Qa)}`;

  setKpiCard("kpi-oee", OEE, { good: 70, warn: 60 });
  setKpiCard("kpi-util", Util, { good: 85, warn: 75 });

  const el = document.getElementById("kpi-fallos");
  const card = el.closest(".kpi-card");
  el.textContent = toPct(Fail, 2);
  card.classList.remove("good", "warn", "bad");

  if (Fail <= 0.05) card.classList.add("good");
  else if (Fail <= 0.10) card.classList.add("warn");
  else card.classList.add("bad");

  document.getElementById("kpi-ms").textContent = toPct(MS, 2);
  setKpiCard("kpi-ms", MS, { good: 16, warn: 14 });
}

//Gráficos
function makeCharts() {
  const labels = dataset.map(d => d.period);

  const seriesOEE = dataset.map(d => computeOEE(d) * 100);
  const seriesAvailability = dataset.map(d => computeAvailability(d) * 100);
  const seriesPerformance = dataset.map(d => computePerformance(d) * 100);
  const seriesQuality = dataset.map(d => computeQuality(d) * 100);

  const seriesUtil = dataset.map(d => computeUtilization(d) * 100);
  const seriesFailRate = dataset.map(d => computeFailureRate(d) * 100);

  const seriesOwnSales = dataset.map(d => d.sales_internal);
  const seriesMarketTotal = dataset.map(d => d.sales_market_total);

  const seriesMS = dataset.map(d => computeMarketShare(d) * 100);

  const seriesGrowthOwn = computeGrowth(seriesOwnSales).map(x => x * 100);
  const seriesGrowthMkt = computeGrowth(seriesMarketTotal).map(x => x * 100);
  const seriesRelPerf = seriesGrowthOwn.map((v, i) => v - seriesGrowthMkt[i]);

  //OEE
  new Chart(document.getElementById("chartOEE"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "OEE (%)", data: seriesOEE },
        { label: "Disponibilidad (%)", data: seriesAvailability },
        { label: "Performance (%)", data: seriesPerformance },
        { label: "Calidad (%)", data: seriesQuality }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + "%" } } }
    }
  });

  //Utilización y Fallos
  new Chart(document.getElementById("chartUTIL_FAIL"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Utilización (%)", data: seriesUtil },
        { label: "Tasa de fallos (%)", data: seriesFailRate }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: { y: { beginAtZero: true, ticks: { callback: v => v + "%" } } }
    }
  });

  //Market Share y Mercado
  new Chart(document.getElementById("chartMS"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Ventas propias", data: seriesOwnSales },
        { label: "Mercado total", data: seriesMarketTotal }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } }
    }
  });

  //Crecimiento relativo
  new Chart(document.getElementById("chartGrowth"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Crecimiento interno (%)", data: seriesGrowthOwn },
        { label: "Crecimiento mercado (%)", data: seriesGrowthMkt },
        { label: "Desempeño relativo (pp)", data: seriesRelPerf }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } },
      scales: { y: { ticks: { callback: v => v + "%" } } }
    }
  });
}

//Carga de datos
document.addEventListener("DOMContentLoaded", () => {
  fetch("data.json")
    .then(response => response.json())
    .then(data => {
      dataset = data;
      initHeaderKPIs();
      makeCharts();
    })
    .catch(err => console.error("Error cargando data.json", err));
});