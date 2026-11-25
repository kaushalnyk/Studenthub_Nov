sap.ui.define([
  "studenthub/nov/controller/BaseController",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (Controller, Filter, FilterOperator, MessageToast, MessageBox) {
  "use strict";

  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return Controller.extend("studenthub.nov.controller.Students", {

    onInit: function () {
      this._localModel = this.getOwnerComponent().getModel("local");
      this._localModel.setData({
        courses: [],
        departmentStudents: [],
        stats: { total: 0, Active: 0, Inactive: 0, Suspended: 0, Graduated: 0 }
      });
      this._statusFilter = "";
      this.markNav("studentsPage", "students");
      this.getRouter().getRoute("students").attachPatternMatched(this._loadStats, this);
    },

    /* ---------- KPI tiles ---------- */

    _loadStats: function () {
      var that = this;
      this.callStudentService("Students?$select=ID,status&$top=5000", "GET")
        .then(function (aStudents) {
          var oStats = { total: aStudents.length, Active: 0, Inactive: 0, Suspended: 0, Graduated: 0 };
          aStudents.forEach(function (oStudent) {
            if (Object.prototype.hasOwnProperty.call(oStats, oStudent.status)) {
              oStats[oStudent.status]++;
            }
          });
          that._localModel.setProperty("/stats", oStats);
        })
        .catch(function () { /* already reported */ });
    },

    onKpiPress: function (oEvent) {
      var sStatus = oEvent.getSource().data("status");
      this._statusFilter = this._statusFilter === sStatus ? "" : sStatus;
      ["All", "Active", "Inactive", "Suspended", "Graduated"].forEach(function (sKey) {
        var bSelected = (sKey === "All" ? "" : sKey) === this._statusFilter;
        this.byId("kpi" + sKey).toggleStyleClass("hubKpiSelected", bSelected);
      }, this);
      this._applyFilters();
    },

    onRowPress: function (oEvent) {
      var oStudent = oEvent.getSource().getBindingContext().getObject();
      this.getRouter().navTo("studentDetail", { id: oStudent.ID });
    },

    onUpdateFinished: function (oEvent) {
      var iTotal = oEvent.getParameter("total");
      this.byId("countText").setText(this.t(iTotal === 1 ? "studentCountOne" : "studentCountMany", [iTotal]));
    },

    /* ---------- Formatters ---------- */

    formatSuspendIcon: function (sStatus) {
      return sStatus === "Suspended" ? "sap-icon://media-play" : "sap-icon://media-pause";
    },

    formatSuspendText: function (sStatus) {
      return this.t(sStatus === "Suspended" ? "activateStudent" : "suspendStudent");
    },

    /* ---------- Filtering ---------- */

    onSearch: function () {
      this._applyFilters();
    },

    onDepartmentChange: function () {
      this._applyFilters();
    },

    onClearFilters: function () {
      this.byId("searchField").setValue("");
      this.byId("departmentFilter").setSelectedKey("");
      this._statusFilter = "";
      ["All", "Active", "Inactive", "Suspended", "Graduated"].forEach(function (sKey) {
        this.byId("kpi" + sKey).removeStyleClass("hubKpiSelected");
      }, this);
      this._applyFilters();
    },

    _applyFilters: function () {
      var oBinding = this.byId("studentsTable").getBinding("items");
      if (!oBinding) {
        return;
      }

      var aFilters = [];
      var sQuery = (this.byId("searchField").getValue() || "").trim();
      var sDepartment = this.byId("departmentFilter").getSelectedKey();

      if (sQuery) {
        aFilters.push(new Filter([
          new Filter({ path: "Name", operator: FilterOperator.Contains, value1: sQuery, caseSensitive: false }),
          new Filter({ path: "Email", operator: FilterOperator.Contains, value1: sQuery, caseSensitive: false }),
          new Filter({ path: "bpNumber", operator: FilterOperator.Contains, value1: sQuery, caseSensitive: false })
        ], false));
      }
      if (sDepartment) {
        aFilters.push(new Filter("department", FilterOperator.EQ, sDepartment));
      }
      if (this._statusFilter) {
        aFilters.push(new Filter("status", FilterOperator.EQ, this._statusFilter));
      }

      oBinding.filter(aFilters);
    },

    onRefresh: function () {
      this.getOwnerComponent().getModel().refresh();
      this._loadStats();
    },

    /* ---------- Helpers ---------- */

    _studentPath: function (sId) {
      return "Students(" + encodeURIComponent(sId) + ")/StudentService.";
    },

    _getStudent: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext();
      return oContext ? oContext.getObject() : null;
    },

    _runOnStudent: function (oEvent, sAction, sSuccessMessage) {
      var oStudent = this._getStudent(oEvent);
      if (!oStudent) {
        return;
      }
      var that = this;
      this.callStudentService(this._studentPath(oStudent.ID) + sAction, "POST", {})
        .then(function () {
          MessageToast.show(sSuccessMessage);
          that.onRefresh();
        })
        .catch(function () { /* already reported */ });
    },

    /* ---------- Row actions ---------- */

    onOpenMoreMenu: function (oEvent) {
      var oButton = oEvent.getSource();
      oButton.getDependents()[0].openBy(oButton);
    },

    onViewCourses: function (oEvent) {
      var oStudent = this._getStudent(oEvent);
      if (!oStudent) {
        return;
      }
      this._coursesStudent = oStudent;
      var that = this;
      this.callStudentService(this._studentPath(oStudent.ID) + "getEnrolledCourses()", "GET")
        .then(function (aCourses) {
          that._localModel.setProperty("/courses", aCourses || []);
          that.byId("enrolledCoursesDialog").setTitle(that.t("enrolledCoursesOf", [oStudent.Name]));
          that.byId("enrolledCoursesDialog").open();
        })
        .catch(function () { /* already reported */ });
    },

    onDropCourse: function (oEvent) {
      var oCourse = oEvent.getSource().getBindingContext("local").getObject();
      var oStudent = this._coursesStudent;
      if (!oCourse || !oStudent) {
        return;
      }
      var that = this;
      this.callStudentService(this._studentPath(oStudent.ID) + "dropCourse", "POST", {
        courseCode: oCourse.code
      }).then(function () {
        MessageToast.show(that.t("droppedCourse", [oCourse.code]));
        that._localModel.setProperty("/courses", that._localModel.getProperty("/courses").filter(function (c) {
          return c.code !== oCourse.code;
        }));
        that.onRefresh();
      }).catch(function () { /* already reported */ });
    },

    onAverageCredits: function (oEvent) {
      var oStudent = this._getStudent(oEvent);
      if (!oStudent) {
        return;
      }
      var that = this;
      this.callStudentService(this._studentPath(oStudent.ID) + "getAverageCredits()", "GET")
        .then(function (nAverage) {
          MessageToast.show(that.t("averageCreditsOf", [oStudent.Name, nAverage]));
        })
        .catch(function () { /* already reported */ });
    },

    onOpenChangeDepartmentDialog: function (oEvent) {
      var oStudent = this._getStudent(oEvent);
      if (!oStudent) {
        return;
      }
      this._changeStudent = oStudent;
      this.byId("changeDeptStudentName").setText(oStudent.Name + " (" + oStudent.department + ")");
      this.byId("changeDepartmentSelect").setSelectedKey(oStudent.department);
      this.byId("changeDepartmentDialog").open();
    },

    onChangeDepartment: function () {
      var oStudent = this._changeStudent;
      if (!oStudent) {
        return;
      }
      var sDepartment = this.byId("changeDepartmentSelect").getSelectedKey();
      var that = this;
      this.callStudentService(this._studentPath(oStudent.ID) + "changeDepartment", "POST", {
        Department: sDepartment
      }).then(function () {
        that.byId("changeDepartmentDialog").close();
        MessageToast.show(that.t("departmentChanged", [sDepartment]));
        that.onRefresh();
      }).catch(function () { /* already reported */ });
    },

    onCloseChangeDepartmentDialog: function () {
      this.byId("changeDepartmentDialog").close();
    },

    onStudentCount: function () {
      var that = this;
      this.callStudentService("getStudentCount()", "GET")
        .then(function (nCount) {
          MessageToast.show(that.t("totalStudents", [nCount]));
        })
        .catch(function () { /* already reported */ });
    },

    onOpenDepartmentDialog: function () {
      this._localModel.setProperty("/departmentStudents", []);
      this.byId("departmentDialog").open();
      this.onSearchByDepartment();
    },

    onSearchByDepartment: function () {
      var sDepartment = this.byId("departmentSearchSelect").getSelectedKey();
      if (!sDepartment) {
        return;
      }
      var that = this;
      this.callStudentService("getStudentsByDepartment(department='" + encodeURIComponent(sDepartment) + "')", "GET")
        .then(function (aStudents) {
          that._localModel.setProperty("/departmentStudents", aStudents || []);
        })
        .catch(function () { /* already reported */ });
    },

    onCloseDepartmentDialog: function () {
      this.byId("departmentDialog").close();
    },

    onOpenEnrollDialog: function (oEvent) {
      var oStudent = this._getStudent(oEvent);
      if (!oStudent) {
        return;
      }
      this._enrollStudent = oStudent;
      this.byId("enrollStudentName").setText(oStudent.Name);
      this.byId("courseSelect").setSelectedKey(null).setValue("");
      this.byId("enrollDialog").open();
    },

    onEnroll: function () {
      var sCourseCode = this.byId("courseSelect").getSelectedKey();
      if (!sCourseCode) {
        this.byId("courseSelect").setValueState("Error").setValueStateText(this.t("pickCourse"));
        return;
      }
      this.byId("courseSelect").setValueState("None");
      var that = this;
      this.callStudentService(this._studentPath(this._enrollStudent.ID) + "enrollToCourse", "POST", {
        courseCode: sCourseCode
      }).then(function () {
        that.byId("enrollDialog").close();
        MessageToast.show(that.t("enrolledIn", [sCourseCode]));
        that.onRefresh();
      }).catch(function () { /* already reported */ });
    },

    onGraduate: function (oEvent) {
      this._runOnStudent(oEvent, "graduateStudent", this.t("studentGraduated"));
    },

    onToggleSuspend: function (oEvent) {
      var oStudent = this._getStudent(oEvent);
      if (!oStudent) {
        return;
      }
      if (oStudent.status === "Suspended") {
        this._runOnStudent(oEvent, "activateStudent", this.t("studentActivated"));
      } else {
        this._runOnStudent(oEvent, "suspendStudent", this.t("studentSuspended"));
      }
    },

    onDelete: function (oEvent) {
      var oStudent = this._getStudent(oEvent);
      if (!oStudent) {
        return;
      }
      var that = this;
      MessageBox.warning(this.t("confirmDeleteStudent", [oStudent.Name]), {
        title: this.t("deleteTitle"),
        actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
        emphasizedAction: MessageBox.Action.DELETE,
        onClose: function (sAction) {
          if (sAction !== MessageBox.Action.DELETE) {
            return;
          }
          that.callStudentService(that._studentPath(oStudent.ID) + "deleteStudent", "POST", {})
            .then(function () {
              MessageToast.show(that.t("studentDeleted"));
              that.onRefresh();
            })
            .catch(function () { /* already reported */ });
        }
      });
    },

    /* ---------- Dialog open / close ---------- */

    onCloseEnrollDialog: function () {
      this.byId("enrollDialog").close();
    },

    onCloseCoursesDialog: function () {
      this.byId("enrolledCoursesDialog").close();
    },

    _resetFormStates: function () {
      ["newName", "newEmail", "newBpNumber"].forEach(function (sId) {
        this.byId(sId).setValueState("None");
      }, this);
    },

    onOpenCreateDialog: function () {
      this._editingStudent = null;
      this._resetFormStates();
      this.byId("createDialog").setTitle(this.t("createStudent"));
      this.byId("createDialog").getBeginButton().setText(this.t("create"));
      this.byId("newId").setEditable(true).setValue("");
      this.byId("newName").setValue("");
      this.byId("newEmail").setValue("");
      this.byId("newDepartment").setSelectedKey("CSE");
      this.byId("newStatus").setSelectedKey("Active");
      this.byId("newBpNumber").setValue("");
      this.byId("createDialog").open();
    },

    onEditStudent: function (oEvent) {
      var oStudent = this._getStudent(oEvent);
      if (!oStudent) {
        return;
      }
      this._editingStudent = oStudent;
      this._resetFormStates();
      this.byId("createDialog").setTitle(this.t("editStudentOf", [oStudent.Name]));
      this.byId("createDialog").getBeginButton().setText(this.t("save"));
      this.byId("newId").setEditable(false).setValue(oStudent.ID);
      this.byId("newName").setValue(oStudent.Name);
      this.byId("newEmail").setValue(oStudent.Email);
      this.byId("newDepartment").setSelectedKey(oStudent.department);
      this.byId("newStatus").setSelectedKey(oStudent.status === "Suspended" ? "Inactive" : oStudent.status);
      this.byId("newBpNumber").setValue(oStudent.bpNumber);
      this.byId("createDialog").open();
    },

    onCloseCreateDialog: function () {
      this.byId("createDialog").close();
    },

    onSaveNewStudent: function () {
      var oPayload = {
        ID: this.byId("newId").getValue().trim() || (this._editingStudent ? "" : window.crypto.randomUUID()),
        name: this.byId("newName").getValue().trim(),
        email: this.byId("newEmail").getValue().trim(),
        department: this.byId("newDepartment").getSelectedKey(),
        status: this.byId("newStatus").getSelectedKey(),
        bpNumber: this.byId("newBpNumber").getValue().trim()
      };

      var bValid = true;
      var fnCheck = function (sId, bOk, sMessageKey) {
        this.byId(sId).setValueState(bOk ? "None" : "Error").setValueStateText(bOk ? "" : this.t(sMessageKey));
        bValid = bValid && bOk;
      }.bind(this);
      fnCheck("newName", !!oPayload.name, "requiredField");
      fnCheck("newEmail", EMAIL_PATTERN.test(oPayload.email), "invalidEmail");
      fnCheck("newBpNumber", !!oPayload.bpNumber, "requiredField");
      if (!bValid) {
        return;
      }

      var bEditing = !!this._editingStudent;
      var sMessage = this.t(bEditing ? "studentUpdated" : "studentCreated");
      var that = this;
      this.callStudentService(bEditing ? "updateStudent" : "createStudent", "POST", oPayload)
        .then(function () {
          that.byId("createDialog").close();
          MessageToast.show(sMessage);
          that.onRefresh();
        })
        .catch(function () { /* already reported */ });
    }

  });
});
