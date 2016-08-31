"use strict";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

console.log("addon is starting");

const xutils = require("shield-studies-addon-utils");
const variationsMod = require("./variations");

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

/* 2. configuration / setup constants for the study.
 *  These are only ones needed, or supported
 */
// TODO compute days until experiment end
const forSetup = {
  name: require("sdk/self").id, // unique for Telemetry
  choices: Object.keys(variationsMod.variations), // names of branches.
  duration: 90,   // in days,
  /* Get surveyUrl from Strategy + Insights */
  surveyUrl: "https://qsurvey.mozilla.com/s3/Shield-Study-Example-Survey"
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

/* 4. usual bootstrap / jetpack main function */
function main(options, callback) {
  xutils.generateTelemetryIdIfNeeded().then(function () {
    xutils.handleStartup(options, thisStudy);
  })

  // addon specific load code should go here, if there is additional.
  // We only want a single tab tracker instance globally
  console.log("tab tracker is starting up");
  var tabTracker = new libTabTracker.TabTracker();
  libheatmap.main();
  simple_prefs.on("black_list", onPrefChange);

  console.debug(`special addon loading code: ${options.loadReason}`)
  console.debug(JSON.stringify(simple_prefs, null, 2))
}

simple_prefs.on("deleteData", function() {
    var DELETE_SERVER_DATA = "delete-server-data";
    Services.obs.notifyObservers(null, DELETE_SERVER_DATA, {});
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
        var DELETE_SERVER_DATA = "delete-server-data";
        Services.obs.notifyObservers(null, DELETE_SERVER_DATA, {});
        return;
    }
};


exports.main = main;
exports.onUnload = onUnload;
