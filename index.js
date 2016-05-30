const {Cc, Ci, Cu, Cr, Cm, components} = require("chrome");
var self = require("sdk/self");
var { setTimeout } = require("sdk/timers");


// Set the delay to update the logs
var REPEAT_SECONDS = 1;
var REPEAT_DELAY = REPEAT_SECONDS * 1000;

var PR_RDONLY = 0x01;
var PR_WRONLY = 0x02;
var PR_RDWR = 0x04;
var PR_CREATE_FILE = 0x08;
var PR_APPEND = 0x10;
var PR_TRUNCATE = 0x20;
var PR_SYNC = 0x40;
var PR_EXCL = 0x80;

// Converts PlacesDB lastAccessTime timestamps from microseconds
// to milliseconds
function uSecToMS(tstamp) {
    return tstamp / 1000000;
}

// a dummy function, to show how tests work.
// to see how to test this function, look at test/test-index.js
function dummy() {
    var historyComponent = Cc["@mozilla.org/browser/nav-history-service;1"];
    var historyService = historyComponent.getService(Ci.nsINavHistoryService);

    let NUM_DAYS = 30;

    // No query options set will get all history, sorted in database order,
    // which is nsINavHistoryQueryOptions.SORT_BY_NONE.
    var options = historyService.getNewQueryOptions();


    // No query parameters will return everything
    var query = historyService.getNewQuery();
    query.beginTimeReference = query.TIME_RELATIVE_EPOCH;

    // TODO: modify NUM_DAYS to use the last checkpoint date
    // if it exists
    query.beginTime = 24*60*60*1000000*(NUM_DAYS);

    // execute the query
    var historyResult = historyService.executeQuery(query, options);

    var root = historyResult.root;
    root.containerOpen = true;

    var lastCheckPoint = loadCheckPoint();

    // Iterate over the results
    var records = [];
    for (let i = 0; i < root.childCount; i++) {
        let node = root.getChild(i);
        let uri = node.uri;
        let title = node.title;
        let icon = node.icon;
        let lastAccessTime = uSecToMS(node.time);
        let node_type = node.type; // I think we only want type 2 RESULT_TYPE_FULL_VISIT

        var jBlob = {'lastAccessTime': lastAccessTime,
                     'uri': uri,
                     'title': title};
        // TODO: skip records which are older than our checkpoint
        if (jBlob.lastAccessTime > lastCheckPoint) {
            records.push(jBlob);
            console.log("Journalling: ["+jBlob.uri+"]");
        }
    }
    if (records.length > 0) {
        serializeData(records);
    }
    root.containerOpen = false;


    setTimeout(function() {
        dummy();
    }, REPEAT_DELAY);
}

/*
 * Given a Javascript array of JSON objects, iterate
 * over all objects and find the greatest lastAccessTime.
 * Write out the lastAccessTime in milliseconds since epoch
 * to the cg_slurp.checkpoint file.
 */
function writeCheckPoint(records) {
    let newCheckPoint = 0;
    for each (var item in records) {
        let normItemTS = item.lastAccessTime;
        if (newCheckPoint < normItemTS) {
            newCheckPoint = normItemTS;
        }
    }

    let oldCheckPoint = loadCheckPoint();
    if (oldCheckPoint < newCheckPoint) {
        var checkPoint = {};
        checkPoint.checkPoint = newCheckPoint;
        var checkPointJSON = JSON.stringify(checkPoint);
        var filename = "cg_slurp.checkpoint";
        var file = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
        file.append(filename);
        var fs = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
        fs.init(file, PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE, 0664, 0); // write only, create, truncate
        fs.write(checkPointJSON, checkPointJSON.length);
        fs.close();
        console.log("Wrote out ["+checkPointJSON+"] checkpoint to "+ filename);
    }
}


/*
 * Return the checkpoint in milliseconds since epoch. 
 * If no checkpoint exists, return 0.
 */
function loadCheckPoint() {
    var filename = "cg_slurp.checkpoint";

    var file = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);

    file.append(filename);
    if (!file.exists()) {
        return 0;
    }
    var istream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
    istream.init(file, PR_RDONLY, 0444, 0);
    istream.QueryInterface(Ci.nsILineInputStream);

    let line = {};
    istream.readLine(line);

    let value = line.value;
    let parsedValue = JSON.parse(value);
    istream.close();
    return parsedValue.checkPoint;

}

function serializeData(data) {
    var jsonString = JSON.stringify(data);
    var filename = "cg_slurp.history.json";
    var file = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
    file.append(filename);
    var fs = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
    fs.init(file, PR_WRONLY | PR_CREATE_FILE | PR_APPEND, 0664, 0); // write only, create, append
    fs.write(jsonString, jsonString.length);

    // Force a new line
    fs.write("\n", 1);
    fs.close();
    writeCheckPoint(data);
}

dummy();

console.log("============== dummy worked!");
exports.dummy = dummy;
