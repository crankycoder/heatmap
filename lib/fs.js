"use strict";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * fs.js
 *
 * This javascript module provides two classes: 
 *  - `Checkpoint` to manage a checkpoint to determine if inbound data
 *    has been persisted.
 *  - `Serializer` to write JSON data and read JSON data from a file.
 *
 
 */

var libnetwork = require("./network");

// FileUtils makes dealing with the profile directory easier
var {Cc, Ci, Cu, Cr, Cm, components} = require("chrome");
Cu.import("resource://gre/modules/FileUtils.jsm");

function Checkpoint() {
}

Checkpoint.prototype = {
};

function Serializer(blob_list) {
    this.blob_list = blob_list;
    this.blob_list.sort(function(a, b) { 
        return a.lastAccessTime - b.lastAccessTime;
    });

    this.latest_item = this.blob_list[this.blob_list.length-1];
    let tmpDate = new Date(this.latest_item.start_time);
    console.log("Generated tmpDate: " + tmpDate);
    this.short_filename = "heatmap.history_" + this.dateStamp(tmpDate) + ".json";

}

Serializer.prototype = {
    dateStamp: function(d) {
        function pad(n) {
            return n<10 ? '0'+n : n;
        }

        return d.getUTCFullYear()+
             pad(d.getUTCMonth()+1)+
             pad(d.getUTCDate())+'T'+
             pad(d.getUTCHours())+
             pad(d.getUTCMinutes())+
             pad(d.getUTCSeconds())+'Z';
    },

    save: function() {
        var jsonString = JSON.stringify({'sessions': this.blob_list});
        var profileDir = FileUtils.getFile("ProfD", []);
        this.writeStringToFile(jsonString);
    },

    writeStringToFile: function (data) {
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
        file.append(this.short_filename);
        var fs = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
        fs.init(file, PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE, -1, 0); // write only, create, truncate
        fs.write(data, data.length);
        fs.close();

        console.log("==== Flushed ["+data.length+"] records to disk in ["+file+"].");

        // Spin up an async task to upload this file.
        libnetwork.uploadFile(this.short_filename, 0);
    }

};

exports.Serializer = Serializer;
exports.Checkpoint = Checkpoint;
