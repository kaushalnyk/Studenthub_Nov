sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (Controller, MessageToast, MessageBox) {
  "use strict";

  var SERVICE_PATH = "/odata/v4/david-s4/";

  return Controller.extend("studenthub.nov.controller.BusinessPartners", {

    onInit: function () {
      this._bpModel = this.getOwnerComponent().getModel("bp");
      this._bpModel.setData({ partners: [], details: {} });
      this._loadPartners();
    },

    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("students");
    },

    onRefresh: function () {
      this._loadPartners();
    },

    /* ---------- OData helper ---------- */

    _callS4: function (sPath, sMethod, oData) {
      var that = this;
      return fetch(SERVICE_PATH + sPath, {
        method: sMethod || "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        credentials: "same-origin",
        body: sMethod === "GET" ? undefined : JSON.stringify(oData || {})
      }).then(function (oResponse) {
        if (!oResponse.ok) {
          return oResponse.json().then(function (oError) {
            throw new Error((oError.error && oError.error.message) || ("Request failed (" + oResponse.status + ")"));
          }).catch(function (oError) {
            throw oError instanceof Error ? oError : new Error("Request failed (" + oResponse.status + ")");
          });
        }
        return oResponse.status === 204 ? null : oResponse.json();
      }).catch(function (oError) {
        MessageToast.show(oError.message || "S/4 service call failed");
        throw oError;
      });
    },

    _loadPartners: function (sFilter) {
      var sUrl = "DavidBusinessPartners?$top=50" + (sFilter ? "&$filter=" + sFilter : "");
      var that = this;
      return this._callS4(sUrl, "GET").then(function (oData) {
        that._bpModel.setProperty("/partners", (oData && oData.value) || []);
        that.byId("bpCountText").setText(((oData && oData.value) || []).length + " partners");
      }).catch(function () { /* already reported */ });
    },

    _setPartners: function (oData) {
      var aPartners = (oData && oData.value) || [];
      this._bpModel.setProperty("/partners", aPartners);
      this.byId("bpCountText").setText(aPartners.length + " partners");
    },

    _bpPath: function (sId) {
      return "DavidBusinessPartners(BusinessPartner='" + encodeURIComponent(sId) + "')/DavidS4Service.";
    },

    _getPartner: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("bp");
      return oContext ? oContext.getObject() : null;
    },

    /* ---------- Search / filters ---------- */

    onSearchName: function (oEvent) {
      var sName = (oEvent.getSource().getValue() || "").trim();
      var sFilter = sName
        ? "contains(BusinessPartnerFullName,'" + encodeURIComponent(sName) + "')"
        : "";
      this._loadPartners(sFilter);
    },

    onCategoryChange: function (oEvent) {
      var sCategory = oEvent.getSource().getSelectedKey();
      if (!sCategory) {
        this._loadPartners();
        return;
      }
      var that = this;
      this._callS4("getBusinessPartnersByCategory", "POST", { category: sCategory })
        .then(function (oData) {
          that._setPartners(oData);
        })
        .catch(function () { /* already reported */ });
    },

    onLatest: function () {
      var nCount = parseInt(this.byId("latestCount").getValue(), 10) || 10;
      var that = this;
      this._callS4("getLatestBusinessPartners", "POST", { count: nCount })
        .then(function (oData) {
          that._setPartners(oData);
        })
        .catch(function () { /* already reported */ });
    },

    onOpenUuidDialog: function () {
      this.byId("bpUuidInput").setValue("");
      this.byId("bpUuidDialog").open();
    },

    onCloseUuidDialog: function () {
      this.byId("bpUuidDialog").close();
    },

    onSearchByUuid: function () {
      var sUuid = this.byId("bpUuidInput").getValue().trim();
      if (!sUuid) {
        MessageBox.warning("Please enter a UUID.");
        return;
      }
      var that = this;
      this._callS4("getBusinessPartnerByUUID", "POST", { BusinessPartnerUUID: sUuid })
        .then(function (oPartner) {
          that.byId("bpUuidDialog").close();
          that._bpModel.setProperty("/details", oPartner || {});
          that.byId("bpDetailsDialog").open();
        })
        .catch(function () { /* already reported */ });
    },

    /* ---------- Bound actions ---------- */

    onBpDetails: function (oEvent) {
      var oPartner = this._getPartner(oEvent);
      if (!oPartner) {
        return;
      }
      var that = this;
      this._callS4(this._bpPath(oPartner.BusinessPartner) + "getBusinessPartnerDetails", "POST", {
        BusinessPartner: oPartner.BusinessPartner
      }).then(function (oDetails) {
        that._bpModel.setProperty("/details", oDetails || {});
        that.byId("bpDetailsDialog").open();
      }).catch(function () { /* already reported */ });
    },

    onBpName: function (oEvent) {
      var oPartner = this._getPartner(oEvent);
      if (!oPartner) {
        return;
      }
      this._callS4(this._bpPath(oPartner.BusinessPartner) + "getBusinessPartnerName", "POST", {
        BusinessPartner: oPartner.BusinessPartner
      }).then(function (sName) {
        MessageToast.show("Name: " + sName);
      }).catch(function () { /* already reported */ });
    },

    onBpExists: function (oEvent) {
      var oPartner = this._getPartner(oEvent);
      if (!oPartner) {
        return;
      }
      this._callS4(this._bpPath(oPartner.BusinessPartner) + "checkBusinessPartnerExists", "POST", {
        BusinessPartner: oPartner.BusinessPartner
      }).then(function (bExists) {
        MessageToast.show(bExists ? "Business partner exists" : "Business partner not found");
      }).catch(function () { /* already reported */ });
    },

    onCloseDetailsDialog: function () {
      this.byId("bpDetailsDialog").close();
    }

  });
});
