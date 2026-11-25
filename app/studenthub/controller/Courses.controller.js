sap.ui.define([
  "studenthub/nov/controller/BaseController",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (BaseController, JSONModel, Filter, FilterOperator, MessageToast, MessageBox) {
  "use strict";

  return BaseController.extend("studenthub.nov.controller.Courses", {

    onInit: function () {
      this._seatsModel = new JSONModel({ byCourse: {}, courseCount: 0, taken: 0, free: 0 });
      this.getView().setModel(this._seatsModel, "seats");
      this.markNav("coursesPage", "courses");
      this.getRouter().getRoute("courses").attachPatternMatched(this._loadSeats, this);
    },

    /* ---------- Seat usage ---------- */

    _loadSeats: function () {
      var that = this;
      Promise.all([
        this.callStudentService("Enrollments?$select=ID,course_code&$top=10000", "GET"),
        this.callStudentService("Courses?$select=code,capacity&$top=5000", "GET")
      ]).then(function (aResults) {
        var oByCourse = {};
        aResults[0].forEach(function (oEnrollment) {
          oByCourse[oEnrollment.course_code] = (oByCourse[oEnrollment.course_code] || 0) + 1;
        });
        var iCapacity = aResults[1].reduce(function (iSum, oCourse) { return iSum + (oCourse.capacity || 0); }, 0);
        that._seatsModel.setData({
          byCourse: oByCourse,
          courseCount: aResults[1].length,
          taken: aResults[0].length,
          free: Math.max(iCapacity - aResults[0].length, 0)
        });
      }).catch(function () { /* already reported */ });
    },

    formatSeatPercent: function (sCode, iCapacity, oByCourse) {
      var iTaken = (oByCourse && oByCourse[sCode]) || 0;
      return iCapacity ? Math.min(100, Math.round(iTaken / iCapacity * 100)) : 0;
    },

    formatSeatText: function (sCode, iCapacity, oByCourse) {
      return ((oByCourse && oByCourse[sCode]) || 0) + " / " + (iCapacity || "–");
    },

    formatSeatState: function (sCode, iCapacity, oByCourse) {
      var iPercent = this.formatSeatPercent(sCode, iCapacity, oByCourse);
      if (iPercent >= 100) {
        return "Error";
      }
      return iPercent >= 80 ? "Warning" : "Success";
    },

    /* ---------- List ---------- */

    onSearch: function () {
      var sQuery = (this.byId("courseSearch").getValue() || "").trim();
      var aFilters = sQuery ? [new Filter([
        new Filter({ path: "code", operator: FilterOperator.Contains, value1: sQuery, caseSensitive: false }),
        new Filter({ path: "title", operator: FilterOperator.Contains, value1: sQuery, caseSensitive: false }),
        new Filter({ path: "teacher", operator: FilterOperator.Contains, value1: sQuery, caseSensitive: false })
      ], false)] : [];
      this.byId("coursesTable").getBinding("items").filter(aFilters);
    },

    onRefresh: function () {
      this.getOwnerComponent().getModel().refresh();
      this._loadSeats();
    },

    onViewStudents: function (oEvent) {
      var sCode = oEvent.getSource().getBindingContext().getProperty("code");
      this.getRouter().navTo("enrollments", { course: sCode });
    },

    /* ---------- Create / edit ---------- */

    _openDialog: function (oCourse) {
      this._editCode = oCourse ? oCourse.code : null;
      var oDialog = this.byId("courseDialog");
      oDialog.setTitle(oCourse ? this.t("editCourseOf", [oCourse.code]) : this.t("newCourse"));
      this.byId("courseSaveButton").setText(this.t(oCourse ? "save" : "create"));
      this.byId("courseCode").setValue(oCourse ? oCourse.code : "").setEditable(!oCourse);
      this.byId("courseTitle").setValue(oCourse ? oCourse.title : "");
      this.byId("courseTeacher").setValue(oCourse ? oCourse.teacher : "");
      this.byId("courseCredits").setValue(oCourse ? oCourse.credits : 3);
      this.byId("courseCapacity").setValue(oCourse ? oCourse.capacity : 40);
      oDialog.open();
    },

    onOpenCreate: function () {
      this._openDialog(null);
    },

    onOpenEdit: function (oEvent) {
      this._openDialog(oEvent.getSource().getBindingContext().getObject());
    },

    onCloseDialog: function () {
      this.byId("courseDialog").close();
    },

    onSave: function () {
      var oPayload = {
        code: this.byId("courseCode").getValue().trim().toUpperCase(),
        title: this.byId("courseTitle").getValue().trim(),
        teacher: this.byId("courseTeacher").getValue().trim(),
        credits: this.byId("courseCredits").getValue(),
        capacity: this.byId("courseCapacity").getValue()
      };
      if (!oPayload.code || !oPayload.title) {
        MessageBox.warning(this.t("courseRequired"));
        return;
      }
      var bEdit = !!this._editCode;
      var sPath = bEdit ? "Courses('" + encodeURIComponent(this._editCode) + "')" : "Courses";
      if (bEdit) {
        delete oPayload.code;
      }
      var that = this;
      this.callStudentService(sPath, bEdit ? "PATCH" : "POST", oPayload)
        .then(function () {
          that.byId("courseDialog").close();
          MessageToast.show(that.t(bEdit ? "courseUpdated" : "courseCreated"));
          that.onRefresh();
        })
        .catch(function () { /* already reported */ });
    },

    onDelete: function (oEvent) {
      var oCourse = oEvent.getSource().getBindingContext().getObject();
      var iTaken = (this._seatsModel.getProperty("/byCourse")[oCourse.code]) || 0;
      if (iTaken) {
        MessageBox.warning(this.t("courseHasStudents", [oCourse.code, iTaken]));
        return;
      }
      var that = this;
      MessageBox.confirm(this.t("confirmDeleteCourse", [oCourse.code, oCourse.title]), {
        title: this.t("deleteCourse"),
        onClose: function (sAction) {
          if (sAction !== MessageBox.Action.OK) {
            return;
          }
          that.callStudentService("Courses('" + encodeURIComponent(oCourse.code) + "')", "DELETE")
            .then(function () {
              MessageToast.show(that.t("courseDeleted"));
              that.onRefresh();
            })
            .catch(function () { /* already reported */ });
        }
      });
    }
  });
});
