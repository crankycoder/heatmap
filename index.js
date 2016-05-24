const {Cc, Ci, Cu, Cr, Cm, components} = require("chrome");
var self = require("sdk/self");

// a dummy function, to show how tests work.
// to see how to test this function, look at test/test-index.js
function dummy() {
    var historyComponent = Cc["@mozilla.org/browser/nav-history-service;1"];
    var historyService = historyComponent.getService(Ci.nsINavHistoryService);

    // No query options set will get all history, sorted in database order,
    // which is nsINavHistoryQueryOptions.SORT_BY_NONE.
    var options = historyService.getNewQueryOptions();

    // No query parameters will return everything
    var query = historyService.getNewQuery();

    // execute the query
    var historyResult = historyService.executeQuery(query, options);

    var historyRoot = historyResult.root;
    historyRoot.containerOpen = true;

    // Iterate over the results
    for (let i = 0; i < historyRoot.childCount; i++) {
        let node = root.getChild(i);
        let uri = node.uri;
        let title = node.title;
        let icon = node.icon;
        console.log("["+title+"] - ("+uri+")");
    }
    historyRoot.containerOpen = false;
}

dummy();


console.log("============== dummy worked!");
exports.dummy = dummy;
