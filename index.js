const {Cc, Ci, Cu, Cr, Cm, components} = require("chrome");
var self = require("sdk/self");
var { setTimeout } = require("sdk/timers");
Cu.import("resource://gre/modules/Http.jsm", this);

// Blargh. We need NetUtil.jsm to read inputstreams into strings.
// Not actually networking. at all.
Cu.import("resource://gre/modules/NetUtil.jsm");

// FileUtils makes dealing with the profile directory easier
Cu.import("resource://gre/modules/FileUtils.jsm");

// Use async tasks for uploading data
Cu.import("resource://gre/modules/DeferredTask.jsm");

var prefsvc = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);
var simple_prefs = require("sdk/simple-prefs");

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

var HISTORY_RECORDS = {}; 
var BEGIN_TIME_uSec = 0;

// Maximum number of records before we flush to disk
var FLUSH_SIZE = 1;


var UPLOAD_URL = 'https://contextgraph.stage.mozaws.net/'

// On 3 server side errors, just discard the file and give up.
var MAX_SERVER_ERR = 3;
var RETRY_DELAY_SEC = 1;

/* Any checkpoint timestamp is always going to be in milliseconds
 * since epoch unless the variable name explicitly has uSec in the
 * name, in which case - it's going to be microseconds since epoch.
 *
 * Some JS APIs expect to be using uSeconds instead of milliseconds.
 */
var MEM_CHECKPOINT = 0;

/*
 * Ok, this is probably a terrible idea - but we're just going to nab
 * the user ID out of the sync preferences under the 
 * 'services.sync.account' pref. That ought to give us the user's
 * email address.
 *
 * If no email address can be found, return an empty string.
 */
function getUUID() {
    var uuid = simple_prefs.prefs.cg_slurp_uuid;
    if (uuid === undefined) {
        // Generate a UUID if we don't have a user ID yet and
        // stuff it into prefs
        uuid = makeGUID();
        simple_prefs.prefs.cg_slurp_uuid = uuid;
    }
    return uuid;
}

/* Generate a URL friendly 10 character UUID.
 * This code is lifted out of the sync client code in Firefox.
 */
function makeGUID() {
    // 70 characters that are not-escaped URL-friendly
    const code =
        "!()*-.0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz~";

        let guid = "";
        let num = 0;
        let val;

        // Generate ten 70-value characters for a 70^10 (~61.29-bit) GUID
        for (let i = 0; i < 10; i++) {
            // Refresh the number source after using it a few times
            if (i == 0 || i == 5)
                num = Math.random();

            // Figure out which code to use for the next GUID character
            num *= 70;
            val = Math.floor(num);
            guid += code[val];
            num -= val;
        }

        return guid;
}

// Converts PlacesDB lastAccessTime timestamps from microseconds
// to milliseconds
function usec_to_ms(tstamp) {
    return tstamp / 1000;
}

function ms_to_usec(tstamp) {
    return tstamp * 1000;
}

// a main_loop function, to show how tests work.
// to see how to test this function, look at test/test-index.js
function main_loop() {
    var historyComponent = Cc["@mozilla.org/browser/nav-history-service;1"];
    var historyService = historyComponent.getService(Ci.nsINavHistoryService);

    let NUM_DAYS = 30;

    // No query options set will get all history, sorted in database order,
    // which is nsINavHistoryQueryOptions.SORT_BY_NONE.
    var options = historyService.getNewQueryOptions();

    // No query parameters will return everything
    var query = historyService.getNewQuery();

    var diskCheckPoint = 0;

    // Use in-memory checkpoint if available,
    // disk based checkpoint next, otherwise - fallback to a default
    // of NUM_DAYS amount of user history.
    query.beginTimeReference = query.TIME_RELATIVE_EPOCH;
    BEGIN_TIME_uSec = ms_to_usec(MEM_CHECKPOINT);
    if (BEGIN_TIME_uSec === 0) {
        // Disk checkpoints use epoch time stamps
        diskCheckPoint = loadCheckPoint();
        query.beginTimeReference = query.TIME_RELATIVE_EPOCH;
        BEGIN_TIME_uSec = diskCheckPoint;
    }
    if (BEGIN_TIME_uSec === 0) {
        // Default lookup is just relative to the current time
        query.beginTimeReference = query.TIME_RELATIVE_NOW;
        let begin_time_ms = -24*60*60*1000*NUM_DAYS;
        BEGIN_TIME_uSec = ms_to_usec(begin_time_ms);
    }

    // always try to filter out the last known URL by adding 1
    // microsecond
    query.beginTime = BEGIN_TIME_uSec + 1; 
    query.endTimeReference = query.TIME_RELATIVE_NOW;
    query.endTime = 0;

    // execute the query
    var historyResult = historyService.executeQuery(query, options);

    var root = historyResult.root;
    root.containerOpen = true;

    // Iterate over the results
    console.log("Found : " + root.childCount + " results in history.");
    for (let i = 0; i < root.childCount; i++) {
        let node = root.getChild(i);
        let uri = node.uri;
        let title = node.title;
        let icon = node.icon;
        let lastAccessTime = usec_to_ms(node.time);
        let date = new Date(lastAccessTime*1000);
        let node_type = node.type; // I think we only want type 2 RESULT_TYPE_FULL_VISIT

        var jBlob = {'lastAccessTime': lastAccessTime,
                     'uri': uri,
                     'date': date,
                     'title': title};
                     
        // TODO: skip HISTORY_RECORDS which are older than our checkpoint
        if (HISTORY_RECORDS[jBlob.uri] === undefined) {
            // Annoying.  We don't seem to handle redirects very well.
            console.log("Appending: ["+jBlob.uri+"]");
            HISTORY_RECORDS[jBlob.uri] = jBlob;
        }
        MEM_CHECKPOINT = jBlob.lastAccessTime;

        // We should only append if we don't have it in the current
        // history data that is pending.
    }
    if (Object.keys(HISTORY_RECORDS).length > FLUSH_SIZE) {
        flushData();
    }
    root.containerOpen = false;

    setTimeout(function() {
        main_loop();
    }, REPEAT_DELAY);
}

/*
 * Given a Javascript array of JSON objects, iterate
 * over all objects and find the greatest lastAccessTime.
 * Write out the lastAccessTime in milliseconds since epoch
 * to the cg_slurp.checkpoint file.
 */
function writeCheckPoint() {
    // TODO: rewrite this to use FileUtils instead of the 
    // XPCOM components for file i/o
    let newCheckPoint = 0;
    for each (var item in HISTORY_RECORDS) {
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

        var short_filename = "cg_slurp.checkpoint";
        var profileDir = FileUtils.getFile("ProfD", []);

        writeStringToFile(short_filename, checkPointJSON);

        console.log("Wrote out ["+checkPointJSON+"] checkpoint to "+ profileDir.path + "/" + short_filename);
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

    var value = NetUtil.readInputStreamToString(istream, 
                                                istream.available());

    let parsedValue = JSON.parse(value);
    istream.close();
    return parsedValue.checkPoint;
}

function dateStamp(d) {
    function pad(n) {return n<10 ? '0'+n : n}
    return d.getUTCFullYear()+
         + pad(d.getUTCMonth()+1)+
         + pad(d.getUTCDate())+'T'
         + pad(d.getUTCHours())+
         + pad(d.getUTCMinutes())+
         + pad(d.getUTCSeconds())+'Z'
}

function flushData() {
    var blob_list = Object.values(HISTORY_RECORDS);
    blob_list.sort(function(a, b) { 
        return a.lastAccessTime - b.lastAccessTime;
    });

    var jsonString = JSON.stringify(blob_list);
    var latest_item = blob_list[blob_list.length-1];
    let stamp = dateStamp(latest_item.date);

    var short_filename = "cg_slurp.history_"+stamp+".json";
    var profileDir = FileUtils.getFile("ProfD", []);
    writeStringToFile(short_filename, jsonString);
    writeCheckPoint();
    HISTORY_RECORDS = {};


}

function readStringFromFile(short_filename) {

    var file = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);

    file.append(short_filename);

    if (!file.exists()) {
        return null;
    }
    var stream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
    stream.init(file, PR_RDONLY, 0444, 0);

    var value = NetUtil.readInputStreamToString(stream, 
                                                stream.available());
    stream.close();
    return value;
}

function writeStringToFile(short_filename, data) {
    var file = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
    file.append(short_filename);
    var fs = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
    fs.init(file, PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE, 0664, 0); // write only, create, truncate
    fs.write(data, data.length);
    fs.close();

    console.log("==== Flushed ["+data.length+"] records to disk in ["+file+"].");

    // Spin up an async task to upload this file.
    uploadFile(short_filename, 0);
}


/*
 */
function uploadFile(short_filename, uploadAttempt) {

    console.log("uploadFile invoked!");
    var file = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
    var data = readStringFromFile(short_filename);
    var headers = {'X-User': getUUID()};

    var Request = require("sdk/request").Request;

    console.log("Posting with data : " + data);
    var latestTweetRequest = Request({
      url: UPLOAD_URL,
      headers: headers,
      content: data,
      overrideMimeType: 'application/json',
      onComplete: function (response) {
          console.log("Got response status: ["+response.status+"]");
          console.log("Got response status: ["+response.statusText+"]");
          for (var headerName in response.headers) {
              console.log(headerName + ":" + response.headers[headerName]);
          }
          console.log("Got response text: ["+response.text+"]");
      }
    });

    // Be a good consumer and check for rate limiting before doing more.
    latestTweetRequest.post();
    console.log("upload is done!");
}

main_loop();

console.log("============== main_loop worked!");
exports.main_loop = main_loop;
exports.onUnload = function (reason) {
    console.log("cg_slurp is unloading because: ["+reason+"]");
    if (reason == 'shutdown') {
        // TODO: flush everything to disk so we don't lose data
    }
};

