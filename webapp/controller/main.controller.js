sap.ui.define([
    "pcc/custfiles/zcustomerfilesv2/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/ui/core/library",
    "sap/ui/core/syncStyleClass",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/format/DateFormat",
    "pcc/custfiles/zcustomerfilesv2/utils/formatter",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/MessagePopover",
    "sap/m/MessagePopoverItem",
    "sap/base/util/merge"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (BaseController, JSONModel, Fragment, CoreLibrary, syncStyleClass, Filter, FilterOperator, d, formatter,
        MessageToast, MessageBox, MessagePopover, MessagePopoverItem, merge) {
        "use strict";

        return BaseController.extend("pcc.custfiles.zcustomerfilesv2.controller.main", {
            onInit: function () {

                this.sEmployeeNumber = null; //Selected EmployeeNumber
                // Get Component
                this.oComponent = this.getOwnerComponent();
                // Get global model
                this.oODataModel = this.getOwnerComponent().getModel();
                //Define an Main Model
                this._MainModel = new JSONModel({
                    busy: false,
                    isFileListLoading: false,
                    isEmployeeLoading: false,
                    defaultStartDate: new Date(),
                    FilesTableItems: [],
                    fileProcessTypeFilterList: [],
                    fileProcessTypeTableFilter: [],
                    fileTypeFilterList: [],
                    fileTypeTableFilter: []
                });
                // Set main model using BaseController       
                this.setModel(this._MainModel, "main");
                //this._initLocalModel();

                this.getRouter().getRoute("main").attachPatternMatched(this._onRouteMatched, this);

            },
            getDateSixMonthsBack: function () {
                var d = new Date();
                d.setMonth(d.getMonth() - 12);
                d.setDate(1);

                return d;
            },
            _initLocalModel: function () {
                this._MainModel.setProperty("/defaultStartDate", this.getDateSixMonthsBack());
            },
            _initMainModelBinding: function () {
                this.getFilesList();
            },
            _onRouteMatched: function (E) {

                this.oODataModel.metadataLoaded().then(function () {
                    this._initMainModelBinding();
                }.bind(this));
            },
            dateFormat: function (D) {
                // Format dates true to avoid TimeZone calculation issues
                var oDateFormat = d.getDateTimeInstance({
                    pattern: "yyyy-MM-dd"
                    //	UTC: true
                });
                return oDateFormat.format(D);
            },
            getFilesList: function () {
                var defaultStartDate = this.getModel("main").getProperty("/defaultStartDate");

                this._MainModel.setProperty("/isFilesTableLoading", true);
                this.readFileList(defaultStartDate).then(function (r) {
                });
            },
            onDateChangedFileList: function (E) {
                var n = d.getDateInstance().parse(E.getParameter("newValue")),
                    o = E.getSource();

                if (n) {
                    this._MainModel.setProperty("/defaultStartDate", n);
                    this.getFilesList();
                } else {
                    n = new Date(Date.UTC(2000, 0, 1));
                    this._MainModel.setProperty("/defaultStartDate", n);
                }
            },
            onSearchFile: function (oEvent) {
                var oSource = oEvent.getSource();
                var sValue = oSource.getValue();
                // build filter array
                var aFilter = [];

                // filter binding
                var l = this.getView().byId("FilesTable").getBinding("items");
                if (sValue) {
                    aFilter.push(new Filter("FileName", FilterOperator.Contains, sValue));
                    l.filter(aFilter);
                }else{
                    l.filter([]);
                }
            },
            onDeletePress: function (oEvent) {
                var oSource = oEvent.getSource().getBindingContext("main");
                var oFile = oSource.getModel().getProperty(oSource.getPath());
                this._MainModel.setProperty("/isFilesTableLoading", true);
                try {
                    this.oODataModel.read("/FileDeleteSet(FileName='" + oFile.FileName + "',FilePath='" + oFile.FilePath + "')", {
                        success: function (oResponse) {                            
                            this.getFilesList();      
                            this._MainModel.setProperty("/isFilesTableLoading", false);                      
                        }.bind(this),
                        error: function (oError) {
                            // something went wrong
                            // show error message
                            MessageBox.error(this.getResourceBundle().getText("errorMessageUnableToDeleteFile"), oError);
                        }.bind(this)
                    });

                } catch (err) {
                    // something went wrong
                    // show error message
                    MessageBox.error(this.getResourceBundle().getText("errorMessageUnableToDeleteFile"), err);
                }
                
            },

            onDownloadPress: function (oEvent) {
                var oSource = oEvent.getSource().getBindingContext("main");
                var oFile = oSource.getModel().getProperty(oSource.getPath());

                try {
                    this.oODataModel.read("/FileAttachmentSet(FileName='" + oFile.FileName + "',FilePath='" + oFile.FilePath + "')", {
                        success: function (oResponse) {
                            if (oResponse &&
                                oResponse.hasOwnProperty("__metadata") &&
                                oResponse.__metadata.hasOwnProperty("media_src") &&
                                oResponse.__metadata.media_src) {
                                // 1. the URI of the main OData service (as stored in the manifest.json)
                                var sServiceUri = this.getOwnerComponent().getManifestEntry("/sap.app/dataSources/mainService/uri");
                                // 2. the URL of the OData call to get the attachment
                                var oAnchor = document.createElement("a");
                                var sLink = oResponse.__metadata.media_src;
                                oAnchor.href = sLink;
                                var sUrl = oAnchor.pathname;
                                // 3. the URL of the metadata of the main OData service
                                var sDataPath = "";
                                var oModel = this.getModel();
                                if (oModel) {
                                    if (oModel.getMetadataUrl) {
                                        // the main model has a getter for the URL of the metadata/service 
                                        sDataPath = oModel.getMetadataUrl();
                                    } else if (oModel.sServiceUrl) {
                                        // the main model has a variable for the metadata/service URL
                                        sDataPath = oModel.sServiceUrl;
                                    }
                                    // now we need to 'strip and combine' to create the correct URL
                                    // 1. strip dots from the metadata/service URL
                                    sDataPath = sDataPath.replace("..", "");
                                    // 2. strip the URI of the main OData service of manifest.json
                                    // from the metadata/service URL
                                    sDataPath = sDataPath.substr(0, sDataPath.indexOf(sServiceUri));
                                    // 3. combine metadata/service URL with URL of OData call to get the attachment
                                    sUrl = sDataPath.concat(sUrl);

                                    // finally we pass the actual call to the UI5 framework
                                    // and we make sure double slashes are avoided in the URL
                                    sap.m.URLHelper.redirect(sUrl.replace("//", "/"), true);
                                }
                            }
                        }.bind(this),
                        error: function (oError) {
                            // something goes wrong
                            // show error message
                            MessageBox.error(this.getResourceBundle().getText("errorMessageUnableToOpenAttachment"), err);
                        }.bind(this)
                    });

                } catch (err) {
                    // something goes wrong
                    // show error message
                    MessageBox.error(this.getResourceBundle().getText("errorMessageUnableToOpenAttachment"), err);
                }
            },
            onProcessTypeComboBox: function (m) {
                var o = m.getSource(),
                    selectedItems = o.getSelectedKeys();

                var l = this.getView().byId("FilesTable").getBinding("items");
                if (selectedItems === undefined || selectedItems.length === 0) {
                    l.filter([]);
                    this._MainModel.setProperty("/fileProcessTypeTableFilter", []);
                } else {
                    var aFilter = [];
                    if (selectedItems) {
                        var len = selectedItems.length,
                            i;
                        for (i = 0; i < len; i++) {
                            aFilter.push(new Filter("ProcessType", FilterOperator.EQ, selectedItems[i]));
                        }
                    }
                    l.filter(aFilter);
                    this._MainModel.setProperty("/fileProcessTypeTableFilter", aFilter);

                }
            },
            onTypeComboBox: function (m) {
                var o = m.getSource(),
                    selectedItems = o.getSelectedKeys();

                var l = this.getView().byId("FilesTable").getBinding("items");
                if (selectedItems === undefined || selectedItems.length === 0) {
                    l.filter([]);
                    this._MainModel.setProperty("/fileTypeTableFilter", []);
                } else {
                    var aFilter = [];
                    if (selectedItems) {
                        var len = selectedItems.length,
                            i;
                        for (i = 0; i < len; i++) {
                            aFilter.push(new Filter("Type", FilterOperator.EQ, selectedItems[i]));
                        }
                    }
                    l.filter(aFilter);
                    this._MainModel.setProperty("/fileTypeTableFilter", aFilter);

                }
            },            
            readFileList: function (defaultStartDate) {
                return new Promise(function (resolve, reject) {
                    this.oODataModel.read("/FileSet", {
                        filters: [
                            new Filter("StartDate", FilterOperator.EQ, this.dateFormat(defaultStartDate)),
                        ],
                        success: function (r) {
                            var aList = r.results;
                            this._MainModel.setProperty("/FilesTableItems", aList);
                            this.setFileProcessTypeFilterList(aList);
                            this.setFileTypeFilterList(aList);
                            this._MainModel.setProperty("/isFilesTableLoading", false);
                            resolve(r);
                        }.bind(this),
                        error: function (oError) {
                            resolve(oError);
                        }
                    });
                }.bind(this));
            },
            setFileProcessTypeFilterList: function (L) {
                if (L) {
                    var flags = [],
                        K = [],
                        l = L.length,
                        i;
                    for (i = 0; i < l; i++) {
                        if (flags[L[i].ProcessType])
                            continue;
                        flags[L[i].ProcessType] = true;
                        K.push(L[i]);
                    }
                }
                //Set file Process Type list  with unique Type property values
                this._MainModel.setProperty("/fileProcessTypeFilterList", K);
            },
            setFileTypeFilterList: function (L) {
                if (L) {
                    var flags = [],
                        K = [],
                        l = L.length,
                        i;
                    for (i = 0; i < l; i++) {
                        if (flags[L[i].Type])
                            continue;
                        flags[L[i].Type] = true;
                        K.push(L[i]);
                    }
                }
                //Set file Process Type list  with unique Type property values
                this._MainModel.setProperty("/fileTypeFilterList", K);
            },            
        });
    });
