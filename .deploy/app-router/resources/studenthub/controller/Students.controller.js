sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (Controller, Filter, FilterOperator, MessageToast, MessageBox) {
  "use strict";

  var SERVICE_PATH = "/odata/v4/student/";

  return Controller.extend("studenthub.nov.controller.Students", {

    onInit: function () {
      this._localModel = this.getOwnerComponent().getModel("local");
      this._localModel.setData({ courses: [] });

      // OData V4 list bindings must use server-side filtering. Some UI5 SDK
      // builds do not default this on bindings created from XML views.
      var oBinding = this.byId("studentsTable").getBinding("items");
      if (oBinding && !oBinding.sOperationMode) {
        oBinding.sOperationMode = "Server";
      }

      this._updateCount();
    },

    /* ---------- Formatters ---------- */

    formatStatusState: function (sStatus) {
      switch (sStatus) {
        case "Active": return "Success";
        case "Inactive": return "Warning";
        case "Suspended": return "Error";
        case "Graduated": return "Information";
        default: return "None";
      }
    },

    formatSuspendIcon: function (sStatus) {
      return sStatus === "Suspended" ? "sap-icon://activate" : "sap-icon://pause";
    },

    formatSuspendTooltip: function (sStatus) {
      return sStatus === "Suspended" ? "Activate student" : "Suspend student";
    },

    /* ---------- Filtering ---------- */

    onSearch: function () {
      this._applyFilters();
    },

    onDepartmentChange: function () {
      this._applyFilters();
    },

    _applyFilters: function () {
      var oBinding = this.byId("studentsTable").getBinding("items");
      if (!oBinding) {
        return;
      }

      var aFilters = [];
      var sQuery = (this.byId("searchField").getValue() || "").trim().toLowerCase();
      var sDepartment = this.byId("departmentFilter").getSelectedKey();

      if (sQuery) {
        aFilters.push(new Filter([
          new Filter("Name", FilterOperator.Contains, sQuery),
          new Filter("Email", FilterOperator.Contains, sQuery),
          new Filter("bpNumber", FilterOperator.Contains, sQuery)
        ], false));
      }
      if (sDepartment) {
        aFilters.push(new Filter("department", FilterOperator.EQ, sDepartment));
      }

      if (!oBinding.sOperationMode) {
        oBinding.sOperationMode = "Server";
      }
      oBinding.filter(aFilters);
      this._updateCount();
    },

    _updateCount: function () {
      var oTable = this.byId("studentsTable");
      if (oTable && oTable.getBinding("items")) {
        this.byId("countText").setText(oTable.getItems().length + " students");
      }
    },

    /* ---------- Navigation and refresh ---------- */

    onNavToCourses: function () {
      this.getOwnerComponent().getRouter().navTo("courses");
    },

    onNavToBusinessPartners: function () {
      this.getOwnerComponent().getRouter().navTo("businessPartners");
    },

    onRefresh: function () {
      this.getOwnerComponent().getModel().refresh();
    },

    /* ---------- OData action helper ---------- */

    _getCsrfToken: function () {
      return fetch(SERVICE_PATH + "$metadata", {
        headers: { "x-csrf-token": "Fetch" },
        credentials: "same-origin"
      }).then(function (oResponse) {
        return oResponse.headers.get("x-csrf-token");
      }).catch(function () {
        return null;
      });
    },

    _callOData: function (sPath, sMethod, oData) {
      var that = this;
      return this._getCsrfToken().then(function (sToken) {
        var oHeaders = {
          "Content-Type": "application/json",
          "Accept": "application/json"
        };
        if (sToken) {
          oHeaders["x-csrf-token"] = sToken;
        }
        return fetch(SERVICE_PATH + sPath, {
          method: sMethod || "POST",
          headers: oHeaders,
          credentials: "same-origin",
          body: sMethod === "GET" ? undefined : JSON.stringify(oData || {})
        });
      }).then(function (oResponse) {
        if (!oResponse.ok) {
          return oResponse.json().then(function (oError) {
            throw new Error((oError.error && oError.error.message) || ("Request failed (" + oResponse.status + ")"));
          }).catch(function (oError) {
            throw oError instanceof Error ? oError : new Error("Request failed (" + oResponse.status + ")");
          });
        }
        if (oResponse.status === 204) {
          return null;
        }
        return oResponse.json().then(function (oResult) {
          // OData V4 function responses wrap the actual result in "value".
          return oResult && Object.prototype.hasOwnProperty.call(oResult, "value")
            ? oResult.value
            : oResult;
        });
      }).catch(function (oError) {
        MessageToast.show(oError.message || "Service call failed");
        throw oError;
      });
    },

    _studentPath: function (sId) {
      return "Students(ID='" + encodeURIComponent(sId) + "')/StudentService.";
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
      this._callOData(this._studentPath(oStudent.ID) + sAction, "POST", {})
        .then(function () {
          MessageToast.show(sSuccessMessage);
          that.onRefresh();
          that._updateCount();
        })
        .catch(function () { /* already reported */ });
    },

    /* ---------- Row actions ---------- */

    onViewCourses: function (oEvent) {
      var oStudent = this._getStudent(oEvent);
      if (!oStudent) {
        return;
      }
      this._coursesStudent = oStudent;
      var that = this;
      this._callOData(this._studentPath(oStudent.ID) + "getEnrolledCourses", "GET")
        .then(function (aCourses) {
          that._localModel.setProperty("/courses", aCourses || []);
          that.byId("enrolledCoursesDialog").setTitle("Enrolled Courses - " + oStudent.Name);
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
      this._callOData(this._studentPath(oStudent.ID) + "dropCourse", "POST", {
        courseCode: oCourse.code
      }).then(function () {
        MessageToast.show("Dropped " + oCourse.code);
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
      this._callOData(this._studentPath(oStudent.ID) + "getAverageCredits", "GET")
        .then(function (nAverage) {
          MessageToast.show(oStudent.Name + " - average credits: " + nAverage);
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
      this._callOData(this._studentPath(oStudent.ID) + "changeDepartment", "POST", {
        Department: sDepartment
      }).then(function () {
        that.byId("changeDepartmentDialog").close();
        MessageToast.show("Department changed to " + sDepartment);
        that.onRefresh();
      }).catch(function () { /* already reported */ });
    },

    onCloseChangeDepartmentDialog: function () {
      this.byId("changeDepartmentDialog").close();
    },

    onStudentCount: function () {
      this._callOData("getStudentCount()", "GET")
        .then(function (nCount) {
          MessageToast.show("Total students: " + nCount);
        })
        .catch(function () { /* already reported */ });
    },

    onOpenDepartmentDialog: function () {
      this._localModel.setProperty("/departmentStudents", []);
      this.byId("departmentDialog").open();
    },

    onSearchByDepartment: function () {
      var sDepartment = this.byId("departmentSearchSelect").getSelectedKey();
      if (!sDepartment) {
        MessageBox.warning("Please select a department.");
        return;
      }
      var that = this;
      this._callOData("getStudentsByDepartment(department='" + encodeURIComponent(sDepartment) + "')", "GET")
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
      this.byId("enrollStudentName").setText("Student: " + oStudent.Name);
      this.byId("courseSelect").setSelectedKey("");
      this.byId("enrollDialog").open();
    },

    onEnroll: function () {
      var sCourseCode = this.byId("courseSelect").getSelectedKey();
      if (!sCourseCode) {
        MessageBox.warning("Please select a course.");
        return;
      }
      var that = this;
      this._callOData(this._studentPath(this._enrollStudent.ID) + "enrollToCourse", "POST", {
        courseCode: sCourseCode
      }).then(function () {
        that.byId("enrollDialog").close();
        MessageToast.show("Enrolled in " + sCourseCode);
        that.onRefresh();
      }).catch(function () { /* already reported */ });
    },

    onGraduate: function (oEvent) {
      this._runOnStudent(oEvent, "graduateStudent", "Student graduated");
    },

    onToggleSuspend: function (oEvent) {
      var oStudent = this._getStudent(oEvent);
      if (!oStudent) {
        return;
      }
      if (oStudent.status === "Suspended") {
        this._runOnStudent(oEvent, "activateStudent", "Student activated");
      } else {
        this._runOnStudent(oEvent, "suspendStudent", "Student suspended");
      }
    },

    onDelete: function (oEvent) {
      var oStudent = this._getStudent(oEvent);
      if (!oStudent) {
        return;
      }
      var that = this;
      MessageBox.confirm("Delete " + oStudent.Name + "?", {
        title: "Delete Student",
        onClose: function (sAction) {
          if (sAction === MessageBox.Action.OK) {
            that._callOData(that._studentPath(oStudent.ID) + "deleteStudent", "POST", {})
              .then(function () {
                MessageToast.show("Student deleted");
                that.onRefresh();
              })
              .catch(function () { /* already reported */ });
          }
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

    onOpenCreateDialog: function () {
      this._editingStudent = null;
      this.byId("createDialog").setTitle("New Student");
      this.byId("createDialog").getBeginButton().setText("Create");
      this.byId("newId").setEditable(true);
      this.byId("newId").setValue("");
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
      this.byId("createDialog").setTitle("Edit Student - " + oStudent.Name);
      this.byId("createDialog").getBeginButton().setText("Save");
      this.byId("newId").setEditable(false);
      this.byId("newId").setValue(oStudent.ID);
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
        ID: this.byId("newId").getValue().trim(),
        name: this.byId("newName").getValue().trim(),
        email: this.byId("newEmail").getValue().trim(),
        department: this.byId("newDepartment").getSelectedKey(),
        status: this.byId("newStatus").getSelectedKey(),
        bpNumber: this.byId("newBpNumber").getValue().trim()
      };

      if (!oPayload.ID || !oPayload.name || !oPayload.email || !oPayload.bpNumber) {
        MessageBox.warning("ID, name, email and BP number are required.");
        return;
      }

      var bEditing = !!this._editingStudent;
      var sAction = bEditing ? "updateStudent" : "createStudent";
      var sMessage = bEditing ? "Student updated" : "Student created";
      var that = this;
      this._callOData(sAction, "POST", oPayload)
        .then(function () {
          that.byId("createDialog").close();
          MessageToast.show(sMessage);
          that.onRefresh();
        })
        .catch(function () { /* already reported */ });
    }

  });
});
