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

// We only want a single tab tracker instance globally
var tabTracker = new libTabTracker.TabTracker();

function main_func(options, callbacks) {
    var page = pageMod.PageMod({
        include: "*",
        contentScriptWhen: "start",
        contentScriptFile: [self.data.url("content-bridge.js")],
        contentScriptOptions: {
            showOptions: true
        },
        onAttach: function(worker) {
            worker.port.on("heatmap_event", function(addonMessage) {
                console.log("Addon received message: ["+addonMessage+"]");
            });
            
            // TODO: spin up the history reader
            libheatmap.main();
        }
    });

    console.log("main_func was evaluated");

}


exports.onUnload = function (reason) {
    // Valid reasons are: install, enable, startup, upgrade, downgrade
    //
    console.log("heatmap is unloading because: ["+reason+"]");
    if (reason == 'shutdown') {
        // TODO: flush everything to disk so we don't lose data
    }
};

exports.main = main_func;
