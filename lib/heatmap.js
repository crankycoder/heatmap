"use strict";

/* globals Services, Locale */

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
var porn_js = require("./pornbf");

var bf = require("./bloomfilter.js"),
    BloomFilter = bf.BloomFilter,
    fnv_1a = bf.fnv_1a,
    fnv_1a_b = bf.fnv_1a_b;

// Clobber the string prototype so we can use replaceAll
String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

// TODO: this constant is duplicated across the codebase
const TAB_SESSION_COMPLETE = "tab-session-complete";

// Blargh. We need NetUtil.jsm to read inputstreams into strings.
// Not actually networking. at all.
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/Services.jsm");

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
var FLUSH_SIZE = 1;



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
    this.black_list = {};

    try {
        console.log("Loading Porn Bloom filter");
        let array = JSON.parse(porn_js.porn_js);
        this.porn_filter = new BloomFilter(array, 3);
        console.log("Porn Bloom filter loaded!");
    } catch (err) {
        console.log(err);
    }
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

    loadPornfilter: function() {
        /*
         * Return the checkpoint in milliseconds since epoch. 
         * If no checkpoint exists, return 0.
         */

        return parsedValue.checkPoint;
    },

    // Clean up the URL from a number of
    // privacy revealing problems.
    clean_url: function(urlstring) {
        console.log("Cleaning URL: " + urlstring);
        // Remove any basic auth URLs
        let basic_auth = new RegExp("http.?:\/\/.*:.*@.*");
        if (basic_auth.test(urlstring)) {
            console.log("basic auth URL dropped : " + urlstring);
            return "";
        }

        //  Porn filtering
        var url = require("sdk/url").URL(urlstring);
        if (url.hostname) {
            var host_parts = url.hostname.split(".").reverse();
            var short_host = host_parts[1] + '.' + host_parts[0];
            console.log("Porno filter for ["+short_host+"]");
            if (this.porn_filter.test(short_host)) {
                console.log("oh noes! you're looking at naughty bits!");
                return "";
            }
        }

        // Filter out tokens
        console.log("Filtering user tokens from URL: " + urlstring);
        for (var prop in this.black_list) { 
            console.log("Filtering for token ["+prop+"]");
            let termRE = new RegExp("http.*"+prop);
            if (termRE.test(urlstring)) {
                urlstring = urlstring.replaceAll(prop, '[USERNAME]');
            }
        }
        return urlstring;
    },

    observe: function(subject, topic, data) {
        console.log("data received!");
        console.log("Subject: " + subject);
        console.log("Topic: " + topic);
        console.log("Data: " + data);
        let jsondata = JSON.parse(data);
        var url = jsondata.url;

        console.log("URL: " + url);
        HISTORY_RECORDS[url] = data;
    },

    updatePrefs: function(new_bl) {
        let partsOfStr = new_bl.split(',');

        // Reset the black_list
        this.black_list = {};
        for (var prop in this.black_list) { 
            if (this.black_list.hasOwnProperty(prop)) { 
                delete this.black_list[prop]; 
            }
        }
        console.log("Cleared blacklist");
        for each (var item in partsOfStr) {
            this.black_list[item] = 1;
            console.log("Added black list term: ["+item+"]");
        }
    },

    main_loop: function() {
        if (Object.keys(HISTORY_RECORDS).length > FLUSH_SIZE) {
            this.flushData();
        }
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

        // Make a copy of the records
        var tmpRECORDS = HISTORY_RECORDS;

        for (var url in HISTORY_RECORDS) {
            let jsondata = JSON.parse(HISTORY_RECORDS[url]);
            var origURL = url;

            console.log("PRE: Cleaning URL: " + url);
            url = this.clean_url(url);
            if (url.length == 0){
                // This URL was cleaned up and discarded entirely
                delete tmpRECORDS[origURL];
                console.log("Discarded URL: " + origURL);
            } else {
                // Clobber the URL in the payload
                jsondata.url = url;
                tmpRECORDS[origURL] = JSON.stringify(jsondata);
            }
        }

        console.log("flushData() invoked");

        var blob_list = Object.values(tmpRECORDS);

        var serializer = new libfs.Serializer(blob_list);
        serializer.save();

        this.writeCheckPoint();
        HISTORY_RECORDS = {};
    }
};

try {
    console.log("Creating new Heatmap");
    var hMap = new Heatmap();
    console.log("done Creating new Heatmap");
} catch (err) {
    console.log(err);
}

function main() {
    console.log("main() invoked");
    Services.obs.addObserver(hMap.observe, TAB_SESSION_COMPLETE);
    hMap.main_loop();
    console.log("main() completed and main_loop has started!");
}

exports.main = main;
exports.updatePrefs = hMap.updatePrefs.bind(hMap);
