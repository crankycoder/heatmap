"use strict";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var pageMod = require("sdk/page-mod");
var self = require("sdk/self");

var libheatmap = require("./lib/heatmap");
var libnetworking = require("./lib/network");
var libdomwatch = require("./lib/domwatch");
var libTabTracker = require("./lib/TabTracker");
var simple_prefs = require("sdk/simple-prefs");

// Register an update listener
function onPrefChange(prefName) {
    console.log("The preference " + prefName + " value has changed!");
    console.log("New pref value: [" + simple_prefs.prefs[prefName] + "]");
    // TODO: invoke libheatmap.updatePrefs
}

// We only want a single tab tracker instance globally
var tabTracker = new libTabTracker.TabTracker();
libheatmap.main();

simple_prefs.on("tokenBlacklist", onPrefChange);

exports.onUnload = function (reason) {
    // Valid reasons are: install, enable, startup, upgrade, downgrade
    //
    console.log("heatmap is unloading because: ["+reason+"]");
    if (reason == 'shutdown') {
        // TODO: flush everything to disk so we don't lose data
    }
};
