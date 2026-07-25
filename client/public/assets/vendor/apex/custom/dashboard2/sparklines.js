// Sparkline 1
var options1 = {
  series: [80],
  chart: {
    type: "radialBar",
    width: 70,
    height: 70,
    sparkline: {
      enabled: true,
    },
  },
  dataLabels: {
    enabled: false,
  },
  plotOptions: {
    radialBar: {
      hollow: {
        margin: 0,
        size: "50%",
      },
      track: {
        margin: 0,
        background: "rgba(0,0,0,0.3)",
      },
      dataLabels: {
        show: false,
      },
    },
  },
  colors: ["#97DBDB", "#d5cdff"],
};

var chart1 = new ApexCharts(document.querySelector("#sparkline1"), options1);
chart1.render();


// Sparkline 2
var options2 = {
  series: [90],
  chart: {
    type: "radialBar",
    width: 70,
    height: 70,
    sparkline: {
      enabled: true,
    },
  },
  dataLabels: {
    enabled: false,
  },
  plotOptions: {
    radialBar: {
      hollow: {
        margin: 0,
        size: "50%",
      },
      track: {
        margin: 0,
        background: "rgba(0,0,0,0.3)",
      },
      dataLabels: {
        show: false,
      },
    },
  },
  colors: ["#CFF5F5", "#d5cdff"],
};

var chart2 = new ApexCharts(document.querySelector("#sparkline2"), options2);
chart2.render();


// Sparkline 3
var options3 = {
  series: [80],
  chart: {
    type: "radialBar",
    width: 70,
    height: 70,
    sparkline: {
      enabled: true,
    },
  },
  dataLabels: {
    enabled: false,
  },
  plotOptions: {
    radialBar: {
      hollow: {
        margin: 0,
        size: "50%",
      },
      track: {
        margin: 0,
        background: "rgba(0,0,0,0.3)",
      },
      dataLabels: {
        show: false,
      },
    },
  },
  colors: ["#97DBDB", "#d5cdff"],
};

var chart3 = new ApexCharts(document.querySelector("#sparkline3"), options3);
chart3.render();