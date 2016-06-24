"use strict";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * This module acts as a shim to receive port messages from the
 * content script and forward them into the main heatmap.js module.
 */

function DOMWatcher() {
    this.listeners = [];
}

DOMWatcher.prototype = {
    registerEventListener: function(callback) {
        // TODO: add the listener to the list of callbacks
        // store this in a list
        for (var i=0; i < this.listeners.length; i++) {
            var cb = this.listeners[i];
            if (cb === callback) {
                return;
            }
        }

        // Add the callback if it isn't aleady registered
        this.listeners.push(callback);
    },
    receiveEvent: function(event) {
        // TODO: iterate over the list of listeners and pass a copy of
        // the event
        for each (var cb in this.listeners) {
            try {
                cb(event);
            }
            catch(err) {
                console.log("Error forwarding event: [" + err + "]");
            }
        }
    },
    unregisterEventListener: function(callback) {
        // TODO: unregister the listener from the list
        for (var i=0; i < this.listeners.length; i++) {
            var cb = this.listeners[i];
            if (cb === callback) {
                // This modifies the listeners list in place and
                // removes a list of length Y for split(x, y);
                this.listeners.splice(i, 1);
                return;
            }
        }
    }
};

var domWatcher = new DOMWatcher();

exports.registerEventListener = domWatcher.registerEventListener;

