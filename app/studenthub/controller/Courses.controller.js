sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function (Controller) {
  "use strict";

  return Controller.extend("studenthub.nov.controller.Courses", {

    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("students");
    },

    onRefresh: function () {
      this.getOwnerComponent().getModel().refresh();
    }

  });
});
