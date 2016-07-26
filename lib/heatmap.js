"use strict";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * heatmap.js
 *
 * This javascript module acts as a facade for a DOM event listener
 * and a browser chrome event listener.
 *
 * The intent of this module is to be able to capture any and all user
 * driven events on the browser.  
 *
 * Subscribers can register with the system to receive notifications
 * of new events.  Data serialization is outside the scope of this
 * module.
 */

var {Cc, Ci, Cu, Cr, Cm, components} = require("chrome");
var self = require("sdk/self");
var { setTimeout } = require("sdk/timers");

var self = require("sdk/self");
var pageMod = require("sdk/page-mod");
var simple_prefs = require("sdk/simple-prefs");

var libnetwork = require("./network");
var libfs = require("./fs");


// Blargh. We need NetUtil.jsm to read inputstreams into strings.
// Not actually networking. at all.
Cu.import("resource://gre/modules/NetUtil.jsm");

// FileUtils makes dealing with the profile directory easier
Cu.import("resource://gre/modules/FileUtils.jsm");

// Set the delay to update the logs
var REPEAT_SECONDS = 1;
var REPEAT_DELAY = REPEAT_SECONDS * 1000;

// These constants are required to handle file streams, but aren't
// available through the addons SDK
// Note that these have been converted from octal to base10 because
// JS is terrible.
var PR_RDONLY = 1;
var PR_WRONLY = 2;
var PR_RDWR = 4;
var PR_CREATE_FILE = 8;
var PR_APPEND = 16;
var PR_TRUNCATE = 32;
var PR_SYNC = 64;
var PR_EXCL = 128;

// Globals to keep track of the history
var HISTORY_RECORDS = {}; 
var BEGIN_TIME_uSec = 0;

// Maximum number of records before we flush to disk
// Set this to 1 to flush all the time while debugging.
var FLUSH_SIZE = 100;



// On 3 server side errors, just discard the pending upload
// file and give up.
var MAX_SERVER_ERR = 3;

var RETRY_DELAY_SEC = 1;

/* Any checkpoint timestamp is always going to be in milliseconds
 * since epoch unless the variable name explicitly has uSec in the
 * name, in which case - it's going to be microseconds since epoch.
 *
 * Some JS APIs expect to be using uSeconds instead of milliseconds.
 */
var MEM_CHECKPOINT = 0;

var Heatmap = function() {
};

Heatmap.prototype = {
    usec_to_ms: function(tstamp) {
        /*
         * Converts PlacesDB start_time timestamps from microseconds
         * to milliseconds.
         */
        return tstamp / 1000;
    },
    ms_to_usec: function(tstamp) {
        return tstamp * 1000;
    },
    main_loop: function() {
        /*
         * a main_loop function, to show how tests work.
         * to see how to test this function, look at test/test-index.js
         */
        var {Cc} = require("chrome");
        var historyComponent = Cc["@mozilla.org/browser/nav-history-service;1"];
        var historyService = historyComponent.getService(Ci.nsINavHistoryService);

        // No query options set will get all history, sorted in database order,
        // which is nsINavHistoryQueryOptions.SORT_BY_NONE.
        var options = historyService.getNewQueryOptions();

        // No query parameters will return everything
        var query = historyService.getNewQuery();

        query.beginTimeReference = query.TIME_RELATIVE_EPOCH;
        query.beginTimeReference = query.TIME_RELATIVE_NOW;

        BEGIN_TIME_uSec = this.ms_to_usec(0);
        query.beginTime = BEGIN_TIME_uSec;
        query.endTimeReference = query.TIME_RELATIVE_NOW;
        query.endTime = 0;

        // execute the query
        var historyResult = historyService.executeQuery(query, options);

        var root = historyResult.root;
        root.containerOpen = true;

        // Iterate over the results
        // console.log("Found : " + root.childCount + " results in history.");
        for (let i = 0; i < root.childCount; i++) {
            let node = root.getChild(i);
            let uri = node.uri;
            let title = node.title;
            let icon = node.icon;
            let start_time = this.usec_to_ms(node.time);
            let node_type = node.type; // I think we only want type 2 RESULT_TYPE_FULL_VISIT

            var jBlob = {'start_time': start_time,
                         'uri': uri,
                         'title': title};

            // TODO: skip HISTORY_RECORDS which are older than our checkpoint
            if (HISTORY_RECORDS[jBlob.uri] === undefined) {
                // Annoying.  We don't seem to handle redirects very well.
                console.log("Appending: ["+jBlob.uri+"]");
                HISTORY_RECORDS[jBlob.uri] = jBlob;
            }
            MEM_CHECKPOINT = jBlob.start_time;

            // We should only append if we don't have it in the current
            // history data that is pending.
        }
        if (Object.keys(HISTORY_RECORDS).length > FLUSH_SIZE) {
            this.flushData();
        }
        root.containerOpen = false;

        setTimeout(() => {
            this.main_loop();
        }, REPEAT_DELAY);
    },

    writeCheckPoint: function() {
        /*
         * Given a Javascript array of JSON objects, iterate
         * over all objects and find the greatest start_time.
         * Write out the start_time in milliseconds since epoch
         * to the heatmap.checkpoint file.
         */
        // TODO: rewrite this to use FileUtils instead of the 
        // XPCOM components for file i/o
        let newCheckPoint = 0;
        for each (var item in HISTORY_RECORDS) {
            let normItemTS = item.start_time;
            if (newCheckPoint < normItemTS) {
                newCheckPoint = normItemTS;
            }
        }

        let oldCheckPoint = this.loadCheckPoint();
        if (oldCheckPoint < newCheckPoint) {
            // TODO: refacor this function block into a nice tidy
            // object
            var checkPoint = {};
            checkPoint.checkPoint = newCheckPoint;
            var checkPointJSON = JSON.stringify(checkPoint);

            var short_filename = "heatmap.checkpoint";
            var profileDir = FileUtils.getFile("ProfD", []);
            this.writeStringToFile(short_filename, checkPointJSON);

            console.log("Wrote out ["+checkPointJSON+"] checkpoint to "+ profileDir.path + "/" + short_filename);
        }
    },

    writeStringToFile: function (short_filename, data) {
        var PR_RDONLY = 1;
        var PR_WRONLY = 2;
        var PR_RDWR = 4;
        var PR_CREATE_FILE = 8;
        var PR_APPEND = 16;
        var PR_TRUNCATE = 32;
        var PR_SYNC = 64;
        var PR_EXCL = 128;

        var {Cc} = require("chrome");
        var file = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
        file.append(short_filename);
        var fs = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
        fs.init(file, PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE, -1, 0); // write only, create, truncate
        fs.write(data, data.length);
        fs.close();

        console.log("==== Wrote checkpoint files");
    },
    loadCheckPoint: function() {
        /*
         * Return the checkpoint in milliseconds since epoch. 
         * If no checkpoint exists, return 0.
         */
        var {Cc} = require("chrome");
        var filename = "heatmap.checkpoint";
        var file = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);

        file.append(filename);
        if (!file.exists()) {
            return 0;
        }
        var istream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
        istream.init(file, PR_RDONLY, 1092, 0);

        var value = NetUtil.readInputStreamToString(istream, 
                                                    istream.available());

        let parsedValue = JSON.parse(value);
        istream.close();
        return parsedValue.checkPoint;
    },


    flushData: function() {
        var blob_list = Object.values(HISTORY_RECORDS);

        var serializer = new libfs.Serializer(blob_list);
        serializer.save();

        this.writeCheckPoint();
        HISTORY_RECORDS = {};
    }
};


function main() {
    var hMap = new Heatmap();
    hMap.main_loop();
}

exports.main = main;
