/*
 * We need configurable options to be outside of the heatmap_consts
 * file as they can be changed on demand.
 */

var simple_prefs = require("sdk/simple-prefs");

function getRootURL() {
    return simple_prefs.prefs["root_url"];
}

function getEncryptFlag() {
    return simple_prefs.prefs["encrypt_data"];
}

exports.getRootURL = getRootURL;
exports.getEncryptFlag = getEncryptFlag;
