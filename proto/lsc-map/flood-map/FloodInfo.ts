/// <amd-dependency path="esri/core/tsSupport/declareExtendsHelper" name="__extends" />
/// <amd-dependency path="esri/core/tsSupport/decorateHelper" name="__decorate" />

import {
  declared,
  property,
  subclass
} from "esri/core/accessorSupport/decorators";

import Graphic = require("esri/Graphic");

import Accessor = require("esri/core/Accessor");
import watchUtils = require("esri/core/watchUtils");
import promiseUtils = require("esri/core/promiseUtils");
import Evented = require("esri/core/Evented");

import Locator = require("esri/tasks/Locator");

import MapView = require("esri/views/MapView");

import FeatureLayer = require("esri/layers/FeatureLayer");
import MapImageLayer = require("esri/layers/MapImageLayer");

import Point = require("esri/geometry/Point");

interface FloodInfo extends Accessor, Evented {}

const SEARCH_PARAM = "search";

@subclass("FloodInfo")
class FloodInfo extends declared(Accessor, Evented) {
  //--------------------------------------------------------------------------
  //
  //  Lifecycle
  //
  //--------------------------------------------------------------------------

  initialize() {
    const searchTerm = this._getUrlParameter(SEARCH_PARAM);

    this._set("searchTerm", searchTerm);

    const searchPromise = searchTerm && this._addressToLocation(searchTerm);

    this._viewReadyHandle = watchUtils.whenTrue(this, "view.ready", () =>
      this._getFloodHazardsFeatureLayer("hazards.fema.gov", 28).then(() =>
        searchPromise.then(location => this.queryFloodLocation(location))
      )
    );

    this._viewClickHandle = watchUtils.on(
      this,
      "view",
      "click",
      (event: __esri.MapViewClickEvent) => this._viewClicked(event)
    );
  }

  destroy() {
    const { _viewClickHandle, _viewReadyHandle } = this;

    _viewReadyHandle && _viewReadyHandle.remove();
    _viewClickHandle && _viewClickHandle.remove();

    this._removeFloodGraphics();
  }

  //--------------------------------------------------------------------------
  //
  //  Variables
  //
  //--------------------------------------------------------------------------

  _viewReadyHandle: IHandle = null;

  _viewClickHandle: IHandle = null;

  _mapMarker: Graphic = null;

  _secondaryMapMarker: Graphic = null;

  //--------------------------------------------------------------------------
  //
  //  Properties
  //
  //--------------------------------------------------------------------------

  //----------------------------------
  //  floodLayer
  //----------------------------------

  @property({
    readOnly: true
  })
  floodLayer: FeatureLayer = null;

  //----------------------------------
  //  locator
  //----------------------------------

  @property({
    type: Locator
  })
  locator = new Locator({
    url: "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer"
  });

  //----------------------------------
  //  results
  //----------------------------------

  @property({
    readOnly: true
  })
  results: object[] = null;

  //----------------------------------
  //  searchTerm
  //----------------------------------

  @property({
    readOnly: true
  })
  searchTerm: string = null;

  //----------------------------------
  //  view
  //----------------------------------

  @property({
    type: MapView
  })
  view: MapView = null;

  //--------------------------------------------------------------------------
  //
  //  Public Methods
  //
  //--------------------------------------------------------------------------

  locateAndQueryFloodLocation(searchTerm: string): IPromise<object[]> {
    return this._addressToLocation(searchTerm).then(location => {
      this._setUrlParameter(SEARCH_PARAM, searchTerm);
      this._set("searchTerm", searchTerm);
      return this.queryFloodLocation(location);
    });
  }

  queryFloodLocation(location: Point): IPromise<object[]> {
    const { floodLayer, view } = this;

    this._removeFloodGraphics();

    view.popup.close();

    if (!location) {
      const error = new Error("Could not find the location");
      this._set("results", null);
      this.emit("query-error", error);
      return promiseUtils.reject(error);
    }

    if (!floodLayer) {
      const error = new Error("A flooding layer is required to query");
      this._set("results", null);
      this.emit("query-error", error);
      return promiseUtils.reject(error);
    }

    const graphic = new Graphic({
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

    const query = floodLayer.createQuery();

    query.returnGeometry = false;
    query.geometry = location;

    return floodLayer
      .queryFeatures(query)
      .then(featureSet => {
        const { features } = featureSet;

        const floodData = features.map(feature => feature.attributes);

        this.emit("query-results", {
          floodData
        });

        this._set("results", floodData);

        return floodData;
      })
      .catch(error => {
        this._set("results", null);

        this.emit("query-error", error);

        return error;
      });
  }

  //--------------------------------------------------------------------------
  //
  //  Private Methods
  //
  //--------------------------------------------------------------------------

  private _getUrlParameter(name: string): string {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    const regex = new RegExp("[\\?&]" + name + "=([^&#]*)");
    const results = regex.exec(location.search);
    return results === null
      ? ""
      : decodeURIComponent(results[1].replace(/\+/g, " "));
  }

  private _setUrlParameter(name: string, value: string): void {
    const href = window.location.href;
    const sep = href.indexOf("?") > -1 ? "&" : "?";
    const modifiedHref =
      href.indexOf(`${name}=`) > -1 ? href : `${href}${sep}${name}=`;
    const regExp = new RegExp(name + "(.+?)(&|$)", "g");
    const newUrl = modifiedHref.replace(regExp, name + "=" + value + "$2");
    window.history.pushState("", "", newUrl);
  }

  private _addressToLocation(address: string): IPromise<Point> {
    const { locator, view } = this;

    return locator
      .addressToLocations({
        maxLocations: 1,
        address: { SingleLine: address },
        outFields: ["Addr_type", "Match_addr", "StAddr", "City"]
      } as any)
      .then(addresses => {
        const address = addresses && addresses[0];
        const extent = address && address.extent;
        const location = address && address.location;

        view.when(() => {
          view.goTo({
            target: extent || location,
            scale: 50000
          });
        });

        return location;
      });
  }

  private _locationToAddress(
    location: Point
  ): IPromise<__esri.AddressCandidate> {
    const { locator } = this;

    return locator.locationToAddress(location, 1500);
  }

  private _viewClicked(event: __esri.MapViewClickEvent): void {
    event.stopPropagation();

    const { _secondaryMapMarker, view } = this;

    view.popup.close();

    _secondaryMapMarker && view.graphics.remove(_secondaryMapMarker);

    const promise = this._locationToAddress(event.mapPoint).then(candidate => {
      const graphic = new Graphic({
        geometry: event.mapPoint,
        attributes: candidate.attributes,
        popupTemplate: {
          content: this._getPopupContent.bind(this),
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

      this._secondaryMapMarker = graphic;

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
  }

  private _getPopupContent(event: { graphic: Graphic }): HTMLElement {
    const { graphic } = event;

    const label = graphic.get<string>("attributes.LongLabel");

    const contentNode = document.createElement("div");

    contentNode.innerHTML = `<p>${label}</p>`;

    const searchLinkNode = document.createElement("a");
    contentNode.appendChild(searchLinkNode);

    searchLinkNode.textContent = "Search this location";
    searchLinkNode.href = "#";
    searchLinkNode.addEventListener("click", event => {
      event.preventDefault();

      const point = graphic.geometry as Point;

      this.view.goTo({
        target: point,
        scale: 50000
      });

      const { latitude, longitude } = point;

      const searchTerm = `Y:${latitude.toFixed(4)}, X:${longitude.toFixed(4)}`;

      this._setUrlParameter(SEARCH_PARAM, searchTerm);

      this._set("searchTerm", searchTerm);

      this.queryFloodLocation(point);
    });

    return contentNode;
  }

  private _getLayerFromView(layerUrl: string): IPromise<MapImageLayer> {
    const { view } = this;

    const { layers } = view.map;

    const matchedLayer = layers.find(
      layer =>
        layer.type === "map-image" &&
        (layer as MapImageLayer).url.indexOf(layerUrl) > -1
    );

    return matchedLayer ? matchedLayer.load() : null;
  }

  private _getFloodHazardsFeatureLayer(
    layerUrl: string,
    sublayerId: number
  ): IPromise<FeatureLayer> {
    return this._getLayerFromView(layerUrl)
      .then(femaHazardsLayer => {
        if (!femaHazardsLayer) {
          return null;
        }

        const sublayers = femaHazardsLayer.allSublayers;

        sublayers.forEach(sublayer => {
          if (sublayer.id !== 28) {
            sublayer.visible = false;
          }
        });

        const floodHazardZones = sublayers.find(
          sublayer => sublayer.id === sublayerId
        );

        if (!floodHazardZones) {
          return null;
        }

        return floodHazardZones.createFeatureLayer();
      })
      .then(floodLayer => {
        this._set("floodLayer", floodLayer);
        return floodLayer;
      });
  }

  private _removeFloodGraphics(): void {
    const { _mapMarker, _secondaryMapMarker, view } = this;

    view.graphics.removeMany([_mapMarker, _secondaryMapMarker]);
  }
}

export = FloodInfo;
