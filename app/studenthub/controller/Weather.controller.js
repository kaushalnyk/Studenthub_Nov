sap.ui.define([
  "studenthub/nov/controller/BaseController",
  "sap/m/MessageToast",
  "sap/m/HBox",
  "sap/m/VBox",
  "sap/m/Text",
  "sap/m/Image"
], function (Controller, MessageToast, HBox, VBox, Text, Image) {
  "use strict";

  // Unbound action on the WeatherService (calls OpenWeatherMap directly via CAP)
  var SERVICE = "/odata/v4/weather/getWeather";

  // Theme classes applied to the card, one per weather condition
  var THEMES = "wClear wClouds wRain wSnow wStorm wMist";

  // Official OpenWeatherMap condition icons (served from their CDN)
  var ICON_BASE = "https://openweathermap.org/img/wn/";

  return Controller.extend("studenthub.nov.controller.Weather", {

    onInit: function () {
      this.markNav("weatherPage", "weather");
    },

    onGetWeather: function () {
      var that = this;
      var city = this.byId("wCity").getValue().trim();
      if (!city) {
        MessageToast.show(this.t("weatherCityRequired"));
        return;
      }

      var box = this.byId("wResult");
      box.removeAllItems();
      box.setVisible(false);
      box.setBusy(true);

      return fetch(SERVICE, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ City: city })
      }).then(function (oResponse) {
        return oResponse.json().catch(function () { return null; });
      }).then(function (oData) {
        if (!oData || oData.error || oData.Temperature === undefined) {
          throw new Error((oData && oData.error && oData.error.message) || that.t("weatherFailed"));
        }
        box.removeStyleClass(THEMES);
        box.addStyleClass(that._themeFor(oData.Description));
        box.addItem(that._buildResult(oData));
        box.setVisible(true);
        that.byId("wEmpty").setVisible(false);
      }).catch(function (oError) {
        that.byId("wEmpty").setVisible(true);
        MessageToast.show(oError.message || that.t("weatherFailed"));
      }).finally(function () {
        box.setBusy(false);
      });
    },

    /* ---------- card building ---------- */

    _buildResult: function (oData) {
      var oIcon = new Image({
        src: ICON_BASE + (oData.Icon || "01d") + "@4x.png",
        width: "7rem",
        height: "7rem",
        densityAware: false,
        alt: oData.Description || "Weather"
      });
      oIcon.addStyleClass("weatherIcon");

      var oCity = new Text({
        text: oData.City + (oData.Country ? ", " + oData.Country : "")
      });
      oCity.addStyleClass("weatherCity");

      var oTemp = new Text({ text: this._num(oData.Temperature) });
      oTemp.addStyleClass("weatherTemp");

      var oUnit = new Text({ text: "°C" });
      oUnit.addStyleClass("weatherUnit");

      var oTempRow = new HBox({ items: [oTemp, oUnit] });
      oTempRow.addStyleClass("weatherTempRow");

      var oFeels = new Text({
        text: this.t("weatherFeelsLike") + " " + this._num(oData.FeelsLike) + "°C"
      });
      oFeels.addStyleClass("weatherFeels");

      var oDesc = new Text({ text: oData.Description || "" });
      oDesc.addStyleClass("weatherDesc");

      var oText = new VBox({ items: [oCity, oTempRow, oDesc, oFeels] });
      oText.addStyleClass("weatherMainText");

      var oMain = new HBox({ items: [oIcon, oText] });
      oMain.addStyleClass("weatherMain");

      var oMetrics = new HBox({
        wrap: "Wrap",
        items: [
          this._metric(this.t("weatherHumidity"), this._num(oData.Humidity) + "%"),
          this._metric(this.t("weatherPressure"), this._num(oData.Pressure) + " hPa"),
          this._metric(this.t("weatherWind"), this._num(oData.Wind) + " m/s")
        ]
      });
      oMetrics.addStyleClass("weatherMetrics");

      var oCard = new VBox({ items: [oMain, oMetrics] });
      oCard.addStyleClass("weatherContent");
      return oCard;
    },

    _metric: function (sLabel, sValue) {
      var oLabel = new Text({ text: sLabel });
      oLabel.addStyleClass("weatherMetricLabel");

      var oValue = new Text({ text: sValue });
      oValue.addStyleClass("weatherMetricValue");

      var oBox = new VBox({ items: [oLabel, oValue] });
      oBox.addStyleClass("weatherMetric");
      return oBox;
    },

    /* ---------- helpers ---------- */

    _num: function (v) {
      var n = Number(v);
      return isFinite(n) ? String(Math.round(n * 10) / 10) : "--";
    },

    _themeFor: function (sDesc) {
      var d = String(sDesc || "").toLowerCase();
      if (d.indexOf("thunder") >= 0) return "wStorm";
      if (d.indexOf("snow") >= 0 || d.indexOf("sleet") >= 0) return "wSnow";
      if (d.indexOf("rain") >= 0 || d.indexOf("drizzle") >= 0) return "wRain";
      if (d.indexOf("cloud") >= 0) return "wClouds";
      if (d.indexOf("mist") >= 0 || d.indexOf("fog") >= 0 ||
          d.indexOf("haze") >= 0 || d.indexOf("smoke") >= 0) return "wMist";
      return "wClear";
    }

  });
});
