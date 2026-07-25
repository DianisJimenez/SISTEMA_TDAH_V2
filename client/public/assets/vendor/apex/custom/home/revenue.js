var options = {
  chart: {
    height: 285,
    type: "line",
    toolbar: {
      show: false,
    },
  },
  dataLabels: {
    enabled: false,
  },
  stroke: {
    width: 5,
  },
  series: [
    {
      name: "Patients",
      data: [0, 20, 70, 25, 100, 90, 160],
    },
    {
      name: "Income",
      data: [0, 50, 40, 90, 60, 120, 50],
    }
  ],
  grid: {
    borderColor: "#d8dee6",
    strokeDashArray: 5,
    xaxis: {
      lines: {
        show: true,
      },
    },
    yaxis: {
      lines: {
        show: false,
      },
    },
    padding: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
  },
  xaxis: {
    categories: [
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ],
  },
  yaxis: {
    labels: {
      show: false,
    },
  },
  colors: ["#28A6A7", "#97DBDB", "#B3E8E8", "#CFF5F5"],
  markers: {
    size: 0,
    opacity: 0.3,
    colors: ["#28A6A7", "#97DBDB", "#B3E8E8", "#CFF5F5"],
    strokeColor: "#ffffff",
    strokeWidth: 1,
    hover: {
      size: 7,
    },
  },
  tooltip: {
    y: {
      formatter: function (val) {
        return val;
      },
    },
    theme: 'dark',
  },
};

var chart = new ApexCharts(document.querySelector("#revenue"), options);

chart.render();