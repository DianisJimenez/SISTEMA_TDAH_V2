var options = {
  chart: {
    width: 250,
    type: "donut",
  },
  labels: ["Male", "Female", "Kids"],
  series: [20, 45, 65],
  legend: {
    position: "bottom",
  },
  dataLabels: {
    enabled: false,
  },
  stroke: {
    width: 0,
  },
  colors: ["#28A6A7", "#44B3B4", "#60C0C1", "#7CCECE", "#97DBDB", "#B3E8E8", "#CFF5F5"],
};
var chart = new ApexCharts(document.querySelector("#gender"), options);
chart.render();