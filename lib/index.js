"use strict";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const xutils = require("shield-studies-addon-utils");
const variationsMod = require("./variations");

var {Cc, Ci, Cu, Cr, Cm, components} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");

var pageMod = require("sdk/page-mod");
var self = require("sdk/self");

var libheatmap = require("./heatmap");
var libnetworking = require("./network");
var libTabTracker = require("./TabTracker");
var simple_prefs = require("sdk/simple-prefs");

/* 2. configuration / setup constants for the study.
 *  These are only ones needed, or supported
 */

function daydiff(first, second) {
    return Math.round((second-first)/(1000*60*60*24));
}

const STUDY_END_DATE = new Date(2016, 10, 15);

const forSetup = {
  name: require("sdk/self").id, // unique for Telemetry
  choices: Object.keys(variationsMod.variations), // names of branches.
  duration: daydiff(STUDY_END_DATE, new Date()),   // in days,
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
    let newPrefVal = simple_prefs.prefs[prefName];
    libheatmap.updatePrefs(newPrefVal);
}

/* 4. usual bootstrap / jetpack main function */
function main(options, callback) {
  xutils.generateTelemetryIdIfNeeded().then(function () {
    xutils.handleStartup(options, thisStudy);
  })

  // addon specific load code should go here, if there is additional.
  // We only want a single tab tracker instance globally
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
    xutils.handleOnUnload(reason, thisStudy);
    var unload_reasons = ['disable', 'uninstall'];

    if (unload_reasons.indexOf(reason) >= 0) {
        // We have to send a message to delete the data because
        // network requests can't be run in the chrome process.

        // TODO: add a guard for the study end date
        var DELETE_SERVER_DATA = "delete-server-data";
        Services.obs.notifyObservers(null, DELETE_SERVER_DATA, {});
        return;
    }
};


exports.main = main;
exports.onUnload = onUnload;
