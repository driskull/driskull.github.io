/// <amd-dependency path="esri/core/tsSupport/declareExtendsHelper" name="__extends" />
/// <amd-dependency path="esri/core/tsSupport/decorateHelper" name="__decorate" />
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
define(["require", "exports", "esri/core/tsSupport/declareExtendsHelper", "esri/core/tsSupport/decorateHelper", "esri/core/accessorSupport/decorators", "esri/Graphic", "esri/core/Accessor", "esri/core/watchUtils", "esri/core/promiseUtils", "esri/core/Evented", "esri/tasks/Locator", "esri/views/MapView"], function (require, exports, __extends, __decorate, decorators_1, Graphic, Accessor, watchUtils, promiseUtils, Evented, Locator, MapView) {
    "use strict";
    var SEARCH_PARAM = "search";
    var FloodInfo = /** @class */ (function (_super) {
        __extends(FloodInfo, _super);
        function FloodInfo() {
            //--------------------------------------------------------------------------
            //
            //  Lifecycle
            //
            //--------------------------------------------------------------------------
            var _this = _super !== null && _super.apply(this, arguments) || this;
            //--------------------------------------------------------------------------
            //
            //  Variables
            //
            //--------------------------------------------------------------------------
            _this._viewReadyHandle = null;
            _this._viewClickHandle = null;
            _this._mapMarker = null;
            _this._secondaryMapMarker = null;
            //--------------------------------------------------------------------------
            //
            //  Properties
            //
            //--------------------------------------------------------------------------
            //----------------------------------
            //  floodLayer
            //----------------------------------
            _this.floodLayer = null;
            //----------------------------------
            //  locator
            //----------------------------------
            _this.locator = new Locator({
                url: "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer"
            });
            //----------------------------------
            //  results
            //----------------------------------
            _this.results = null;
            //----------------------------------
            //  searchTerm
            //----------------------------------
            _this.searchTerm = null;
            //----------------------------------
            //  view
            //----------------------------------
            _this.view = null;
            return _this;
        }
        FloodInfo.prototype.initialize = function () {
            var _this = this;
            var searchTerm = this._getUrlParameter(SEARCH_PARAM);
            this._set("searchTerm", searchTerm);
            var searchPromise = searchTerm && this._addressToLocation(searchTerm);
            this._viewReadyHandle = watchUtils.whenTrue(this, "view.ready", function () {
                return _this._getFloodHazardsFeatureLayer("hazards.fema.gov", 28).then(function () {
                    return searchPromise.then(function (location) { return _this.queryFloodLocation(location); });
                });
            });
            this._viewClickHandle = watchUtils.on(this, "view", "click", function (event) { return _this._viewClicked(event); });
        };
        FloodInfo.prototype.destroy = function () {
            var _a = this, _viewClickHandle = _a._viewClickHandle, _viewReadyHandle = _a._viewReadyHandle;
            _viewReadyHandle && _viewReadyHandle.remove();
            _viewClickHandle && _viewClickHandle.remove();
            this._removeFloodGraphics();
        };
        //--------------------------------------------------------------------------
        //
        //  Public Methods
        //
        //--------------------------------------------------------------------------
        FloodInfo.prototype.locateAndQueryFloodLocation = function (searchTerm) {
            var _this = this;
            return this._addressToLocation(searchTerm).then(function (location) {
                _this._setUrlParameter(SEARCH_PARAM, searchTerm);
                _this._set("searchTerm", searchTerm);
                return _this.queryFloodLocation(location);
            });
        };
        FloodInfo.prototype.queryFloodLocation = function (location) {
            var _this = this;
            var _a = this, floodLayer = _a.floodLayer, view = _a.view;
            this._removeFloodGraphics();
            view.popup.close();
            if (!location) {
                var error = new Error("Could not find the location");
                this._set("results", null);
                this.emit("query-error", error);
                return promiseUtils.reject(error);
            }
            if (!floodLayer) {
                var error = new Error("A flooding layer is required to query");
                this._set("results", null);
                this.emit("query-error", error);
                return promiseUtils.reject(error);
            }
            var graphic = new Graphic({
                geometry: location,
                symbol: {
                    type: "picture-marker",
                    url: "flood-map/images/map-marker.png",
                    width: "35px",
                    height: "49px",
                    yoffset: "25px"
                }
            });
            this._mapMarker = graphic;
            view.graphics.add(graphic);
            var query = floodLayer.createQuery();
            query.returnGeometry = false;
            query.geometry = location;
            return floodLayer
                .queryFeatures(query)
                .then(function (featureSet) {
                var features = featureSet.features;
                var floodData = features.map(function (feature) { return feature.attributes; });
                _this.emit("query-results", {
                    floodData: floodData
                });
                _this._set("results", floodData);
                return floodData;
            })
                .catch(function (error) {
                _this._set("results", null);
                _this.emit("query-error", error);
                return error;
            });
        };
        //--------------------------------------------------------------------------
        //
        //  Private Methods
        //
        //--------------------------------------------------------------------------
        FloodInfo.prototype._getUrlParameter = function (name) {
            name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
            var regex = new RegExp("[\\?&]" + name + "=([^&#]*)");
            var results = regex.exec(location.search);
            return results === null
                ? ""
                : decodeURIComponent(results[1].replace(/\+/g, " "));
        };
        FloodInfo.prototype._setUrlParameter = function (name, value) {
            var href = window.location.href;
            var sep = href.indexOf("?") > -1 ? "&" : "?";
            var modifiedHref = href.indexOf(name + "=") > -1 ? href : "" + href + sep + name + "=";
            var regExp = new RegExp(name + "(.+?)(&|$)", "g");
            var newUrl = modifiedHref.replace(regExp, name + "=" + value + "$2");
            window.history.pushState("", "", newUrl);
        };
        FloodInfo.prototype._addressToLocation = function (address) {
            var _a = this, locator = _a.locator, view = _a.view;
            return locator
                .addressToLocations({
                maxLocations: 1,
                address: { SingleLine: address },
                outFields: ["Addr_type", "Match_addr", "StAddr", "City"]
            })
                .then(function (addresses) {
                var address = addresses && addresses[0];
                var extent = address && address.extent;
                var location = address && address.location;
                view.when(function () {
                    view.goTo({
                        target: extent || location,
                        scale: 50000
                    });
                });
                return location;
            });
        };
        FloodInfo.prototype._locationToAddress = function (location) {
            var locator = this.locator;
            return locator.locationToAddress(location, 1500);
        };
        FloodInfo.prototype._viewClicked = function (event) {
            var _this = this;
            event.stopPropagation();
            var _a = this, _secondaryMapMarker = _a._secondaryMapMarker, view = _a.view;
            view.popup.close();
            _secondaryMapMarker && view.graphics.remove(_secondaryMapMarker);
            var promise = this._locationToAddress(event.mapPoint).then(function (candidate) {
                var graphic = new Graphic({
                    geometry: event.mapPoint,
                    attributes: candidate.attributes,
                    popupTemplate: {
                        content: _this._getPopupContent.bind(_this),
                        title: ""
                    },
                    symbol: {
                        type: "picture-marker",
                        url: "flood-map/images/map-marker-secondary.png",
                        width: "42px",
                        height: "42px",
                        yoffset: "16px"
                    }
                });
                _this._secondaryMapMarker = graphic;
                view.graphics.add(graphic);
                return [graphic];
            });
            view.popup.actions.removeAll();
            view.popup.dockOptions = {
                buttonEnabled: false
            };
            view.popup.open({
                location: event.mapPoint,
                promises: [promise]
            });
        };
        FloodInfo.prototype._getPopupContent = function (event) {
            var _this = this;
            var graphic = event.graphic;
            var label = graphic.get("attributes.LongLabel");
            var contentNode = document.createElement("div");
            contentNode.innerHTML = "<p>" + label + "</p>";
            var searchLinkNode = document.createElement("a");
            contentNode.appendChild(searchLinkNode);
            searchLinkNode.textContent = "Search this location";
            searchLinkNode.href = "#";
            searchLinkNode.addEventListener("click", function (event) {
                event.preventDefault();
                var point = graphic.geometry;
                _this.view.goTo({
                    target: point,
                    scale: 50000
                });
                var latitude = point.latitude, longitude = point.longitude;
                var searchTerm = "Y:" + latitude.toFixed(4) + ", X:" + longitude.toFixed(4);
                _this._setUrlParameter(SEARCH_PARAM, searchTerm);
                _this._set("searchTerm", searchTerm);
                _this.queryFloodLocation(point);
            });
            return contentNode;
        };
        FloodInfo.prototype._getLayerFromView = function (layerUrl) {
            var view = this.view;
            var layers = view.map.layers;
            var matchedLayer = layers.find(function (layer) {
                return layer.type === "map-image" &&
                    layer.url.indexOf(layerUrl) > -1;
            });
            return matchedLayer ? matchedLayer.load() : null;
        };
        FloodInfo.prototype._getFloodHazardsFeatureLayer = function (layerUrl, sublayerId) {
            var _this = this;
            return this._getLayerFromView(layerUrl)
                .then(function (femaHazardsLayer) {
                if (!femaHazardsLayer) {
                    return null;
                }
                var sublayers = femaHazardsLayer.allSublayers;
                sublayers.forEach(function (sublayer) {
                    if (sublayer.id !== 28) {
                        sublayer.visible = false;
                    }
                });
                var floodHazardZones = sublayers.find(function (sublayer) { return sublayer.id === sublayerId; });
                if (!floodHazardZones) {
                    return null;
                }
                return floodHazardZones.createFeatureLayer();
            })
                .then(function (floodLayer) {
                _this._set("floodLayer", floodLayer);
                return floodLayer;
            });
        };
        FloodInfo.prototype._removeFloodGraphics = function () {
            var _a = this, _mapMarker = _a._mapMarker, _secondaryMapMarker = _a._secondaryMapMarker, view = _a.view;
            view.graphics.removeMany([_mapMarker, _secondaryMapMarker]);
        };
        __decorate([
            decorators_1.property({
                readOnly: true
            })
        ], FloodInfo.prototype, "floodLayer", void 0);
        __decorate([
            decorators_1.property({
                type: Locator
            })
        ], FloodInfo.prototype, "locator", void 0);
        __decorate([
            decorators_1.property({
                readOnly: true
            })
        ], FloodInfo.prototype, "results", void 0);
        __decorate([
            decorators_1.property({
                readOnly: true
            })
        ], FloodInfo.prototype, "searchTerm", void 0);
        __decorate([
            decorators_1.property({
                type: MapView
            })
        ], FloodInfo.prototype, "view", void 0);
        FloodInfo = __decorate([
            decorators_1.subclass("FloodInfo")
        ], FloodInfo);
        return FloodInfo;
    }(decorators_1.declared(Accessor, Evented)));
    return FloodInfo;
});
//# sourceMappingURL=FloodInfo.js.map