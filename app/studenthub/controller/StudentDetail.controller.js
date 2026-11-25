sap.ui.define([
  "studenthub/nov/controller/BaseController",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (BaseController, JSONModel, MessageToast, MessageBox) {
  "use strict";

  return BaseController.extend("studenthub.nov.controller.StudentDetail", {

    onInit: function () {
      this._detailModel = new JSONModel({
        courses: [],
        availableCourses: [],
        courseCount: 0,
        totalCredits: 0,
        averageCredits: 0
      });
      this.getView().setModel(this._detailModel, "detail");
      this.markNav("studentDetailPage", "students");
      this.getRouter().getRoute("studentDetail").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function (oEvent) {
      this._studentId = oEvent.getParameter("arguments").id;
      this.getView().bindElement({ path: "/Students(" + this._studentId + ")" });
      this._loadCourses();
    },

    _actionPath: function (sAction) {
      return "Students(" + this._studentId + ")/StudentService." + sAction;
    },

    /* ---------- Data ---------- */

    _loadCourses: function () {
      var that = this;
      return Promise.all([
        this.callStudentService(this._actionPath("getEnrolledCourses()"), "GET"),
        this.callStudentService("Courses?$select=code,title&$orderby=code", "GET")
      ]).then(function (aResults) {
        var aEnrolled = aResults[0] || [];
        var aAll = aResults[1] || [];
        var aEnrolledCodes = aEnrolled.map(function (oCourse) { return oCourse.code; });
        var iTotal = aEnrolled.reduce(function (iSum, oCourse) { return iSum + (oCourse.credits || 0); }, 0);
        that._detailModel.setData({
          courses: aEnrolled,
          availableCourses: aAll.filter(function (oCourse) { return aEnrolledCodes.indexOf(oCourse.code) === -1; }),
          courseCount: aEnrolled.length,
          totalCredits: iTotal,
          averageCredits: aEnrolled.length ? Number((iTotal / aEnrolled.length).toFixed(1)) : 0
        });
        that.byId("detailCourseSelect").setSelectedKey(null).setValue("");
      }).catch(function () { /* already reported */ });
    },

    _refreshStudent: function () {
      var oBinding = this.getView().getElementBinding();
      if (oBinding) {
        oBinding.refresh();
      }
    },

    /* ---------- Actions ---------- */

    onNavBack: function () {
      this.getRouter().navTo("students");
    },

    onEnroll: function () {
      var sCode = this.byId("detailCourseSelect").getSelectedKey();
      if (!sCode) {
        MessageToast.show(this.t("pickCourse"));
        return;
      }
      var that = this;
      this.callStudentService(this._actionPath("enrollToCourse"), "POST", { courseCode: sCode })
        .then(function () {
          MessageToast.show(that.t("enrolledIn", [sCode]));
          that._loadCourses();
        })
        .catch(function () { /* already reported */ });
    },

    onDropCourse: function (oEvent) {
      var oCourse = oEvent.getSource().getBindingContext("detail").getObject();
      var that = this;
      MessageBox.confirm(this.t("confirmDropCourse", [oCourse.code, oCourse.title]), {
        title: this.t("dropCourse"),
        onClose: function (sAction) {
          if (sAction !== MessageBox.Action.OK) {
            return;
          }
          that.callStudentService(that._actionPath("dropCourse"), "POST", { courseCode: oCourse.code })
            .then(function () {
              MessageToast.show(that.t("droppedCourse", [oCourse.code]));
              that._loadCourses();
            })
            .catch(function () { /* already reported */ });
        }
      });
    },

    onToggleSuspend: function () {
      var oStudent = this.getView().getBindingContext().getObject();
      var bActivate = oStudent.status === "Suspended";
      var that = this;
      this.callStudentService(this._actionPath(bActivate ? "activateStudent" : "suspendStudent"), "POST", {})
        .then(function () {
          MessageToast.show(that.t(bActivate ? "studentActivated" : "studentSuspended"));
          that._refreshStudent();
        })
        .catch(function () { /* already reported */ });
    },

    onGraduate: function () {
      var that = this;
      this.callStudentService(this._actionPath("graduateStudent"), "POST", {})
        .then(function () {
          MessageToast.show(that.t("studentGraduated"));
          that._refreshStudent();
        })
        .catch(function () { /* already reported */ });
    },

    onDelete: function () {
      var oStudent = this.getView().getBindingContext().getObject();
      var that = this;
      MessageBox.warning(this.t("confirmDeleteStudent", [oStudent.Name]), {
        title: this.t("deleteTitle"),
        actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
        emphasizedAction: MessageBox.Action.DELETE,
        onClose: function (sAction) {
          if (sAction !== MessageBox.Action.DELETE) {
            return;
          }
          that.callStudentService(that._actionPath("deleteStudent"), "POST", {})
            .then(function () {
              MessageToast.show(that.t("studentDeleted"));
              that.getOwnerComponent().getModel().refresh();
              that.getRouter().navTo("students");
            })
            .catch(function () { /* already reported */ });
        }
      });
    }
  });
});
