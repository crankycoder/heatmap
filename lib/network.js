"use strict";
/*
This module exports a thing that will upload files ot the server.
We should consolidate this with the checkpoint code.

*/
var {Cc, Ci, Cu} = require('chrome');

var ROOT_URL = "https://miracle.services.mozilla.com/v1";

var UPLOAD_URL = ROOT_URL + "/upload";
var DELETE_URL = ROOT_URL + "/delete";

var simple_prefs = require("sdk/simple-prefs");

const DELETE_SERVER_DATA = "delete-server-data";
//
// Blargh. We need NetUtil.jsm to read inputstreams into strings.
// Not actually networking. at all.
Cu.import("resource://gre/modules/NetUtil.jsm");

// TODO: use a library import thing
var PR_RDONLY = 1;

function readStringFromFile(short_filename) {
    var file = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);

    file.append(short_filename);

    if (!file.exists()) {
        return null;
    }
    var stream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
    stream.init(file, PR_RDONLY, 1092, 0);

    var value = NetUtil.readInputStreamToString(stream, 
                                                stream.available());
                                                stream.close();
                                                return value;
}

function getUUID() {
    /*
     * We use our own custom GUID for the user.  It's unrelated to
     * anything other than the specific browser that this addon is
     * installed into.
     */
    var uuid = simple_prefs.prefs.heatmap_uuid;
    if (uuid === undefined) {
        // Generate a UUID if we don't have a user ID yet and
        // stuff it into prefs
        uuid = makeGUID();
        simple_prefs.prefs.heatmap_uuid = uuid;
    }
    return uuid;
}


function deleteServerData() {
    var headers = {'X-User': getUUID()};
    var data = '';
    var Request = require("sdk/request").Request;
    var deleteRequest = Request({
      url: DELETE_URL,
      headers: headers,
      content: data,
      overrideMimeType: 'application/json',
      onComplete: function (response) {
          // TODO: we should send a notification that the chrome
          // process can handle
      }
    });

    // Be a good consumer and check for rate limiting before doing more.
    deleteRequest.post();
}

function makeGUID() {
    /* 
     * Generate a URL friendly 10 character UUID.
     * This code is lifted out of the sync client code in Firefox.
     */
    // 70 characters that are not-escaped URL-friendly
    const code =
        "!()*-.0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz~";

    let guid = "";
    let num = 0;
    let val;

    // Generate ten 70-value characters for a 70^10 (~61.29-bit) GUID
    for (let i = 0; i < 10; i++) {
        // Refresh the number source after using it a few times
        if (i === 0 || i === 5)
            num = Math.random();

        // Figure out which code to use for the next GUID character
        num *= 70;
        val = Math.floor(num);
        guid += code[val];
        num -= val;
    }

    return guid;
}

function uploadFile(short_filename, uploadAttempt) {
    /*
     * Uploads file to the context graph ingestion server
     */

    var file = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
    var data = readStringFromFile(short_filename);
    var headers = {'X-User': getUUID()};
    var Request = require("sdk/request").Request;
    var heatmapRequest = Request({
      url: UPLOAD_URL,
      headers: headers,
      content: data,
      overrideMimeType: 'application/json',
      onComplete: function (response) {
          // We don't actually do anything with the response. We just 
          // upload on a best effort basis.
          // TODO: check response status and delete the local file
      }
    });

    // Be a good consumer and check for rate limiting before doing more.
    heatmapRequest.post();
}

exports.uploadFile = uploadFile;
exports.deleteServerData = deleteServerData;
