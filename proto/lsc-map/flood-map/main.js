require(["esri/WebMap", "esri/views/MapView", "flood-map/FloodInfo"], function (
  WebMap,
  MapView,
  FloodInfo
) {
  var webmap = new WebMap({
    portalItem: {
      // id: "1ce6e891ac0a4d8dbcdfc4268f7c6c2b" // Live Version
      id: "572e3f76bd5b42f2b269fb58bd35f706" // Test Version
    }
  });

  var view = new MapView({
    map: webmap,
    container: "viewDiv"
  });

  var floodInfo = new FloodInfo({
    view: view
  });

  floodInfo.on("query-results", function (event) {
    var floodData = event.floodData;

    var html =
      floodData && floodData[0] ? "<p><strong>Flood Zone:</strong> " + floodData[0].FLD_ZONE + "</p>" : "";

    document.getElementById("map-results").innerHTML = html;
  });

  floodInfo.on("query-error", function (event) {
    console.log(event);
  });

  var formNode = document.getElementById("map-search-form");
  var inputNode = document.getElementById("map-search");

  if (formNode && inputNode) {
    formNode.addEventListener("submit", function (event) {
      event.preventDefault();
      floodInfo.locateAndQueryFloodLocation(inputNode.value);
    });

    floodInfo.watch("searchTerm", function (searchTerm) {
      inputNode.value = searchTerm;
    });

    inputNode.value = floodInfo.searchTerm;
  }
});
