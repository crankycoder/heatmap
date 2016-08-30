"use strict";

/* globals Services */

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

console.log("addon is starting");

const xutils = require("shield-studies-addon-utils");
const variationsMod = require("./variations");

var {Cu} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");

var libheatmap = require("./heatmap");
var libnetworking = require("./network");
var libdomwatch = require("./domwatch");
var libTabTracker = require("./TabTracker");
var simple_prefs = require("sdk/simple-prefs");

console.log("*************************** heatmap started");
var simple_prefs = require("sdk/simple-prefs");

const STUDY_END_DATE = require("./heatmap_consts").STUDY_END_DATE;
const DELETE_SERVER_DATA = require("./heatmap_consts").DELETE_SERVER_DATA;
const UNINSTALL_ADDON = require("./heatmap_consts").UNINSTALL_ADDON;

/* 2. configuration / setup constants for the study.
 *  These are only ones needed, or supported
 */

function daydiff(first, second) {
    return Math.round((second-first)/(1000*60*60*24));
}

const forSetup = {
  name: require("sdk/self").id, // unique for Telemetry
  choices: Object.keys(variationsMod.variations), // names of branches.
  duration: 90,   // in days,
  /* Get surveyUrl from Strategy + Insights */
  surveyUrl: "https://qsurvey.mozilla.com/s3/Page-Suggestions-Shield-Study"
};

// 3. Study Object (module singleton);
var ourConfig = xutils.xsetup(forSetup);
let thisStudy = new xutils.Study(ourConfig, variationsMod);

// 3a (optional). Watch for changes and reporting
xutils.Reporter.on("report",(d)=>console.debug("telemetry", d));
thisStudy.on("change",(newState)=>console.debug("newState:", newState));

// Register an update listener
function onPrefChange(prefName) {
    console.log("The preference " + prefName + " value has changed!");
    let newPrefVal = simple_prefs.prefs[prefName];
    console.log("New pref value: [" + newPrefVal + "]");
    // TODO: change this to user Services.notifyObservers
    libheatmap.updatePrefs(newPrefVal);
}

function observe(subject, topic, data) {
    switch (topic) {
        case UNINSTALL_ADDON:
            xutils.die();
            break;
    }
}

/* 4. usual bootstrap / jetpack main function */
function main(options, callback) {
    Services.obs.addObserver(observe, UNINSTALL_ADDON);

    xutils.generateTelemetryIdIfNeeded().then(function() {
        xutils.handleStartup(options, thisStudy);
    })

    // addon specific load code should go here, if there is additional.
    // We only want a single tab tracker instance globally
    libheatmap.main();
    simple_prefs.on("black_list", onPrefChange);

    console.debug(`special addon loading code: ${options.loadReason}`)
    console.debug(JSON.stringify(simple_prefs, null, 2))
}

simple_prefs.on("deleteData", function() {
    // Note that we explicitly try to delete server data and uninstall the addon.
    Services.obs.notifyObservers(null, DELETE_SERVER_DATA, {});
    Services.obs.notifyObservers(null, UNINSTALL_ADDON, {});
});


function onUnload(reason) {
    // Valid reasons are: install, enable, startup, upgrade, downgrade
    //
    console.log("heatmap is unloading because: ["+reason+"]");
    xutils.handleOnUnload(reason, thisStudy);
    var unload_reasons = ['disable', 'uninstall'];

    if (unload_reasons.indexOf(reason) >= 0) {
        // We have to send a message to delete the data because
        // network requests can't be run in the chrome process.
        Services.obs.notifyObservers(null, DELETE_SERVER_DATA, {});
        return;
    }
}

exports.main = main;
exports.onUnload = onUnload;
