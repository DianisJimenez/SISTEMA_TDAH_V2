var options = {
  chart: {
    height: 300,
    width: '100%',
    type: 'bar',
    toolbar: {
      show: false,
    },
  },
  plotOptions: {
    bar: {
      horizontal: false,
      distributed: true,
      columnWidth: '50%',
      borderRadius: 4,
    },
  },
  dataLabels: {
    enabled: false
  },
  stroke: {
    show: true,
    width: 0,
    colors: [
      "#28A6A7", "#44B3B4", "#60C0C1", "#7CCECE", "#97DBDB", "#B3E8E8", "#CFF5F5"]
  },
  series: [{
    name: 'Contract',
    data: [2000, 4000, 8000, 12000, 9000]
  }],
  legend: {
    show: false,
  },
  xaxis: {
    categories: ["Cardiology", "Orthopedics", "Neurology", "Gastroenterology", "Anatomy"],
  },
  yaxis: {
    show: false,
  },
  fill: {
    colors: [
      "#28A6A7", "#44B3B4", "#60C0C1", "#7CCECE", "#97DBDB", "#B3E8E8", "#CFF5F5"],
  },
  tooltip: {
    y: {
      formatter: function (val) {
        return + val
      }
    }
  },
  grid: {
    show: false,
    xaxis: {
      lines: {
        show: true
      }
    },
    yaxis: {
      lines: {
        show: false,
      }
    },
  },
  colors: ['#ffffff'],
}
var chart = new ApexCharts(
  document.querySelector("#employees"),
  options
);
chart.render();