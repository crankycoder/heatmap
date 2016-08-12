"use strict";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

console.log("addon is starting");
var {Cc, Ci, Cu, Cr, Cm, components} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");

var pageMod = require("sdk/page-mod");
var self = require("sdk/self");

var libheatmap = require("./lib/heatmap");
var libnetworking = require("./lib/network");
var libdomwatch = require("./lib/domwatch");
var libTabTracker = require("./lib/TabTracker");
var simple_prefs = require("sdk/simple-prefs");

console.log("*************************** heatmap started");

// Register an update listener
function onPrefChange(prefName) {
    console.log("The preference " + prefName + " value has changed!");
    let newPrefVal = simple_prefs.prefs[prefName];
    console.log("New pref value: [" + newPrefVal + "]");
    // TODO: change this to user Services.notifyObservers
    libheatmap.updatePrefs(newPrefVal);
}

simple_prefs.on("deleteData", function() {
    var DELETE_SERVER_DATA = "delete-server-data";
    Services.obs.notifyObservers(null, DELETE_SERVER_DATA, {});
});


// We only want a single tab tracker instance globally
console.log("tab tracker is starting up");
var tabTracker = new libTabTracker.TabTracker();
libheatmap.main();
simple_prefs.on("black_list", onPrefChange);

exports.onUnload = function (reason) {
    // Valid reasons are: install, enable, startup, upgrade, downgrade
    //
    console.log("heatmap is unloading because: ["+reason+"]");
    var unload_reasons = ['disable', 'uninstall'];

    if (unload_reasons.indexOf(reason) >= 0) {
        // We have to send a message to delete the data because
        // network requests can't be run in the chrome process.
        var DELETE_SERVER_DATA = "delete-server-data";
        Services.obs.notifyObservers(null, DELETE_SERVER_DATA, {});
        return;
    }
};
