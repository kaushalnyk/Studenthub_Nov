sap.ui.define([
  "studenthub/nov/controller/BaseController",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (BaseController, Filter, FilterOperator, MessageToast, MessageBox) {
  "use strict";

  return BaseController.extend("studenthub.nov.controller.Enrollments", {

    onInit: function () {
      this.markNav("enrollmentsPage", "enrollments");
      this.getRouter().getRoute("enrollments").attachPatternMatched(this._onRouteMatched, this);
    },

    /** "#/enrollments/CS101" opens the page filtered to one course. */
    _onRouteMatched: function (oEvent) {
      var sCourse = (oEvent.getParameter("arguments") || {}).course || "";
      this.byId("enrollCourseFilter").setSelectedKey(sCourse);
      if (!sCourse) {
        this.byId("enrollCourseFilter").setValue("");
      }
      this.onFilter();
      this.getOwnerComponent().getModel().refresh();
    },

    onUpdateFinished: function (oEvent) {
      var iTotal = oEvent.getParameter("total");
      this.byId("enrollCount").setText(this.t(iTotal === 1 ? "enrollmentCountOne" : "enrollmentCountMany", [iTotal]));
    },

    /* ---------- Filters ---------- */

    onFilter: function () {
      var aFilters = [];
      var sQuery = (this.byId("enrollSearch").getValue() || "").trim();
      var sCourse = this.byId("enrollCourseFilter").getSelectedKey();
      var sDepartment = this.byId("enrollDeptFilter").getSelectedKey();

      if (sQuery) {
        aFilters.push(new Filter({ path: "student/Name", operator: FilterOperator.Contains, value1: sQuery, caseSensitive: false }));
      }
      if (sCourse) {
        aFilters.push(new Filter("course_code", FilterOperator.EQ, sCourse));
      }
      if (sDepartment) {
        aFilters.push(new Filter("student/department", FilterOperator.EQ, sDepartment));
      }
      this.byId("enrollmentsTable").getBinding("items").filter(aFilters);
    },

    onClearFilters: function () {
      this.byId("enrollSearch").setValue("");
      this.byId("enrollCourseFilter").setSelectedKey(null).setValue("");
      this.byId("enrollDeptFilter").setSelectedKey("");
      this.getRouter().navTo("enrollments", {}, true);
      this.onFilter();
    },

    onRefresh: function () {
      this.getOwnerComponent().getModel().refresh();
    },

    onOpenStudent: function (oEvent) {
      var sId = oEvent.getSource().getBindingContext().getProperty("student/ID");
      this.getRouter().navTo("studentDetail", { id: sId });
    },

    /* ---------- Add / remove (reuse the student's bound actions) ---------- */

    onOpenAdd: function () {
      this.byId("addStudent").setSelectedKey(null).setValue("");
      var sCourse = this.byId("enrollCourseFilter").getSelectedKey();
      this.byId("addCourse").setSelectedKey(sCourse || null);
      if (!sCourse) {
        this.byId("addCourse").setValue("");
      }
      this.byId("addEnrollmentDialog").open();
    },

    onCloseAdd: function () {
      this.byId("addEnrollmentDialog").close();
    },

    onAdd: function () {
      var sStudentId = this.byId("addStudent").getSelectedKey();
      var sCourse = this.byId("addCourse").getSelectedKey();
      if (!sStudentId || !sCourse) {
        MessageBox.warning(this.t("pickBoth"));
        return;
      }
      var that = this;
      this.callStudentService("Students(" + sStudentId + ")/StudentService.enrollToCourse", "POST", { courseCode: sCourse })
        .then(function () {
          that.byId("addEnrollmentDialog").close();
          MessageToast.show(that.t("enrolledIn", [sCourse]));
          that.onRefresh();
        })
        .catch(function () { /* already reported */ });
    },

    onRemove: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext();
      var sStudentId = oContext.getProperty("student/ID");
      var sName = oContext.getProperty("student/Name");
      var sCourse = oContext.getProperty("course/code");
      var that = this;
      MessageBox.confirm(this.t("confirmRemoveEnrollment", [sName, sCourse]), {
        title: this.t("removeEnrollment"),
        onClose: function (sAction) {
          if (sAction !== MessageBox.Action.OK) {
            return;
          }
          that.callStudentService("Students(" + sStudentId + ")/StudentService.dropCourse", "POST", { courseCode: sCourse })
            .then(function () {
              MessageToast.show(that.t("removedEnrollment", [sName, sCourse]));
              that.onRefresh();
            })
            .catch(function () { /* already reported */ });
        }
      });
    }
  });
});
