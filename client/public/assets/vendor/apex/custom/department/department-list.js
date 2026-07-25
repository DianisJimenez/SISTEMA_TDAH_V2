var options = {
  chart: {
    width: 360,
    type: "pie",
  },
  labels: ["Cardiology", "Orthopedics", "Neurology", "Gastroenterology", "Anatomy"],
  series: [50, 40, 30, 20, 10],
  legend: {
    position: "bottom",
  },
  dataLabels: {
    enabled: false,
  },
  stroke: {
    width: 0,
  },
  colors: [
    "#28A6A7", "#44B3B4", "#60C0C1", "#7CCECE", "#97DBDB", "#B3E8E8", "#CFF5F5"
  ],
};
var chart = new ApexCharts(document.querySelector("#total-department"), options);
chart.render();