// Africa
$(function () {
  $("#mapAfrica").vectorMap({
    map: "africa_mill",
    backgroundColor: "transparent",
    scaleColors: ["#28A6A7"],
    zoomOnScroll: false,
    zoomMin: 1,
    hoverColor: true,
    series: {
      regions: [
        {
          values: gdpData,
          scale: ["#28A6A7"],
          normalizeFunction: "polynomial",
        },
      ],
    },
  });
});
