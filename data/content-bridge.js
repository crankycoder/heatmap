"use strict";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
/* globals unsafeWindow, cloneInto */

unsafeWindow.navigator.heatmap_addon = true;

window.addEventListener("content-to-addon", function(event) {
  self.port.emit("content-to-addon", JSON.parse(event.detail));
}, false);

self.port.on("addon-to-content", function(data) {
  const clonedData = cloneInto(data, document.defaultView);
  window.dispatchEvent(
    new CustomEvent("addon-to-content", {detail: clonedData})
  );
});

window.addEventListener("pagehide", function() {
    /*
     * The pagehide event is fired when a session history entry is
     * being traversed from.
     * https://developer.mozilla.org/en-US/docs/Web/Events/pagehide
     */
  self.port.emit("content-to-addon", {type: "pagehide"});
}, false);

window.addEventListener("click", function(event) {
    // TODO: do we want to know anything about *what* was clicked?
  self.port.emit("content-to-addon", {type: "click"});
});

document.onreadystatechange = function() {
  self.port.emit("content-to-addon", {type: "NOTIFY_PERFORMANCE", data: "DOC_READY_STATE=" + document.readyState});
};
