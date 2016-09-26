"use strict";

/* globals Services, NetUtil */

const DOCUMENT_ONREADY = require("./heatmap_consts").DOCUMENT_ONREADY;

var fathom = require("fathom-web");

var {Cu} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");

function processHTML(subject, topic, data) {
    // TODO: process the data here
    var htmlData = data;
    console.log(htmlData);
}

Services.obs.addObserver(processHTML, DOCUMENT_ONREADY, false);
