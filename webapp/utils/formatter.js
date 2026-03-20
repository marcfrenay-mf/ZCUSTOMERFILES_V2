sap.ui.define([
    "sap/ui/model/odata/type/Decimal",
    "sap/ui/core/format/DateFormat",
    "sap/ui/core/format/NumberFormat",
    "sap/ui/core/LocaleData",
], function (D, d, N, L) {
    "use strict";
    const endOfTimeDef = new Date(9999, 11, 31);
    
    return {
        formatDate: function (oDate) {
            var dateFormat = d.getInstance({ style: "medium" });
            var endOfTime = dateFormat.format(endOfTimeDef);

            if (oDate === endOfTime) {
                return;
            } else {
                return oDate;
            }
        },
    };
}, true);