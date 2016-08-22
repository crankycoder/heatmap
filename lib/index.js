"use strict";

/* globals Services */

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const xutils = require("shield-studies-addon-utils");
const variationsMod = require("./variations");

var {Cu} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");

var libheatmap = require("./heatmap");
var simple_prefs = require("sdk/simple-prefs");

const STUDY_END_DATE = new Date(2016, 10, 15);

const DELETE_SERVER_DATA = require("./heatmap_consts").DELETE_SERVER_DATA;

/* 2. configuration / setup constants for the study.
 *  These are only ones needed, or supported
 */

function daydiff(first, second) {
    return Math.round((second-first)/(1000*60*60*24));
}

const forSetup = {
  name: require("sdk/self").id, // unique for Telemetry
  choices: Object.keys(variationsMod.variations), // names of branches.
  duration: 90,
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
    // Manually check the current date to see if we should expire
    // ourself.
    if (daydiff(STUDY_END_DATE, new Date()) <= 0) {
        xutils.die();
        return;
    }
    
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
    Services.obs.notifyObservers(null, DELETE_SERVER_DATA, {});
});


function onUnload(reason) {
    // Valid reasons are: install, enable, startup, upgrade, downgrade
    xutils.handleOnUnload(reason, thisStudy);
    var unload_reasons = ['disable', 'uninstall'];

    if (unload_reasons.indexOf(reason) >= 0) {
        // We have to send a message to delete the data because
        // network requests can't be run in the chrome process.
        // Also check that we have at least 1 day left in the study
        // to delete the data.  Data deletes on the last day of the
        // study are not honored because of timezone issues.
        if (daydiff(STUDY_END_DATE, new Date()) > 0) {
            Services.obs.notifyObservers(null, DELETE_SERVER_DATA, {});
        }
    }
}

exports.main = main;
exports.onUnload = onUnload;
