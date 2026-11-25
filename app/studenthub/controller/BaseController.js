sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast"
], function (Controller, MessageToast) {
  "use strict";

  var STUDENT_SERVICE = "/odata/v4/student/";

  /**
   * Shared helpers for every page: top navigation and calls to the
   * Student service that are not covered by data binding.
   */
  return Controller.extend("studenthub.nov.controller.BaseController", {

    getRouter: function () {
      return this.getOwnerComponent().getRouter();
    },

    /* ---------- Top navigation ---------- */

    onNav: function (oEvent) {
      var sRoute = oEvent.getSource().data("route");
      this.getRouter().navTo(sRoute);
    },

    /** Highlights the nav button of the current page. */
    markNav: function (sPageId, sRoute) {
      this.byId(sPageId).getHeaderContent().forEach(function (oControl) {
        if (oControl.data && oControl.data("route")) {
          oControl.toggleStyleClass("hubNavActive", oControl.data("route") === sRoute);
        }
      });
    },

    /** Shortcut for translated texts: this.t("key", [args]). */
    t: function (sKey, aArgs) {
      return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
    },

    /* ---------- Shared formatters ---------- */

    formatInitials: function (sName) {
      return (sName || "").split(/\s+/).filter(Boolean).slice(0, 2).map(function (s) {
        return s.charAt(0).toUpperCase();
      }).join("");
    },

    formatStatusState: function (sStatus) {
      switch (sStatus) {
        case "Active": return "Success";
        case "Inactive": return "Warning";
        case "Suspended": return "Error";
        case "Graduated": return "Information";
        default: return "None";
      }
    },

    formatStatusIcon: function (sStatus) {
      switch (sStatus) {
        case "Active": return "sap-icon://sys-enter-2";
        case "Inactive": return "sap-icon://pending";
        case "Suspended": return "sap-icon://media-pause";
        case "Graduated": return "sap-icon://education";
        default: return "";
      }
    },

    /** Avatar colour per department so lists are easier to scan. */
    formatDeptColor: function (sDepartment) {
      switch (sDepartment) {
        case "CSE": return "Accent6";
        case "ECE": return "Accent8";
        case "MBA": return "Accent1";
        default: return "Accent10";
      }
    },

    /** ISO date / OData V2 "/Date(…)/" → localized medium date. */
    formatDate: function (vDate) {
      if (!vDate) {
        return "";
      }
      var aMatch = /\/Date\((-?\d+)/.exec(vDate);
      var oDate = aMatch ? new Date(Number(aMatch[1])) : new Date(vDate);
      return isNaN(oDate.getTime()) ? String(vDate) : oDate.toLocaleDateString(undefined, {
        year: "numeric", month: "short", day: "numeric"
      });
    },

    /* ---------- Student service over fetch ---------- */

    _fetchCsrfToken: function () {
      return fetch(STUDENT_SERVICE + "$metadata", {
        headers: { "x-csrf-token": "Fetch" },
        credentials: "same-origin"
      }).then(function (oResponse) {
        return oResponse.headers.get("x-csrf-token");
      }).catch(function () {
        return null;
      });
    },

    /**
     * Calls the Student service and resolves with the JSON body
     * (the "value" array or scalar is unwrapped). Errors are shown as a toast.
     */
    callStudentService: function (sPath, sMethod, oData) {
      sMethod = sMethod || "POST";
      var pToken = sMethod === "GET" ? Promise.resolve(null) : this._fetchCsrfToken();
      return pToken.then(function (sToken) {
        var oHeaders = { "Content-Type": "application/json", "Accept": "application/json" };
        if (sToken) {
          oHeaders["x-csrf-token"] = sToken;
        }
        return fetch(STUDENT_SERVICE + sPath, {
          method: sMethod,
          headers: oHeaders,
          credentials: "same-origin",
          body: sMethod === "GET" || sMethod === "DELETE" ? undefined : JSON.stringify(oData || {})
        });
      }).then(function (oResponse) {
        if (!oResponse.ok) {
          return oResponse.json().catch(function () { return {}; }).then(function (oError) {
            var sMessage = (oError.error && oError.error.message) || ("Request failed (" + oResponse.status + ")");
            if (oResponse.status === 403) {
              sMessage = "You are not allowed to do this (" + sMessage + ")";
            }
            throw new Error(sMessage);
          });
        }
        if (oResponse.status === 204) {
          return null;
        }
        return oResponse.json().then(function (oResult) {
          return oResult && Object.prototype.hasOwnProperty.call(oResult, "value") ? oResult.value : oResult;
        });
      }).catch(function (oError) {
        MessageToast.show(oError.message || "Service call failed");
        throw oError;
      });
    }
  });
});
