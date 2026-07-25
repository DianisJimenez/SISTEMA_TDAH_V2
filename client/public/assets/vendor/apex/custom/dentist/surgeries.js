var options1 = {
  chart: {
    height: 170,
    type: 'radar',
    toolbar: {
      show: false,
    },
    offsetY: 0
  },
  series: [{
    name: 'Total Surgeries',
    data: [25, 98, 56, 22, 75, 19, 86],
  }],
  labels: ['General', 'Hernia', 'Plastic', 'Trauma', 'Endocrine', 'Bariatric', 'Orthopedic'],
  plotOptions: {
    radar: {
      size: 60,
      polygons: {
        fill: {
          colors: ["#28A6A7", "#44B3B4", "#60C0C1", "#7CCECE", "#97DBDB", "#B3E8E8", "#CFF5F5"]
        },
      }
    }
  },
  colors: ["#28A6A7", "#44B3B4", "#60C0C1", "#7CCECE", "#97DBDB", "#B3E8E8", "#CFF5F5"],
  stroke: {
    width: 2,
    curve: 'straight',
  },
  markers: {
    size: 4,
    strokeColor: ["#28A6A7", "#44B3B4", "#60C0C1", "#7CCECE", "#97DBDB", "#B3E8E8", "#CFF5F5"],
    colors: ['#fff'],
    strokeWidth: 1,
  },
  grid: {
    padding: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
  },
  tooltip: {
    y: {
      formatter: function (val) {
        return val
      }
    },
    theme: 'dark',
  },
  yaxis: {
    tickAmount: 6,
    labels: {
      formatter: function (val, i) {
        if (i % 5 === 0) {
          return val
        }
      }
    }
  }
}
var chart = new ApexCharts(document.querySelector("#surgeries"), options1);
chart.render();