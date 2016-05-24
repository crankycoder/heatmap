const {Cc, Ci, Cu, Cr, Cm, components} = require("chrome");
var self = require("sdk/self");
var { setTimeout } = require("sdk/timers");


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

    var root = historyResult.root;
    root.containerOpen = true;

    // Iterate over the results
    for (let i = 0; i < root.childCount; i++) {
        let node = root.getChild(i);
        let uri = node.uri;
        let title = node.title;
        let icon = node.icon;
        let lastAccessTime = node.time;
        let node_type = node.type; // I think we only want type 2 RESULT_TYPE_FULL_VISIT
        console.log("("+node_type+")" + lastAccessTime+": ["+uri+"] - ("+title+")");
    }
    root.containerOpen = false;

    setTimeout(function() {
        dummy();
    }, 1000);
    console.log("Scheduled a dummy() run");
}

dummy();

console.log("============== dummy worked!");
exports.dummy = dummy;
