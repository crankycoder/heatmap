/* globals Services, Locale */

const tabs = require("sdk/tabs");
const {Cu} = require("chrome");
const self = require("sdk/self");
const {uuid} = require("sdk/util/uuid");

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Locale.jsm");

const TAB_SESSION_COMPLETE = "tab-session-complete";
const USER_ACTION_EVENT = "user-action-event";

function TabTracker() {
    /*
     * A session is defined as the time between the 'activate' event
     * for a page and the end is marked by a call to
     * 'navigateAwayFromPage'.
     *
     * NAFP can be triggerd by any of these events:
     *  - a page is refreshed, no total time has been set and logReady is invoked.
     *  - logActivate is invoked when the a new tab gains focus
     *  - logDeactivate when a tab group window has been closed
     *  - logClose when a tab has been closed
     */

    /* Fields
        _tabData.url = tab.url;
        _tabData.tab_id = tab.id;
        _tabData.load_reason = loadReason;
        _tabData.unload_reason = unloadReason;
     */
  this._tabData = {};

  this.onOpen = this.onOpen.bind(this);
  this._addListeners();
  console.log("TabTracker init completed");
}

TabTracker.prototype = {
    /*
     * this._openTabs keeps track of tab.id to an object
     * which has the following attributes:
     *          - url (URL)
     *          - active (boolean)
     */
    _openTabs: {},

    get tabData() {
        return this._tabData;
    },

    _addListeners() {
        tabs.on("open", this.onOpen);
    },

    _removeListeners() {
        for (let id in this._openTabs) {
            let tab = this._openTabs[id].tab;
            tab.removeListener("ready", this.logReady);
            tab.removeListener("pageshow", this.logPageShow);
            tab.removeListener("activate", this.logActivate);
            tab.removeListener("deactivate", this.logDeactivate);
            tab.removeListener("close", this.logClose);
        }
        tabs.removeListener("load", this.onLoad);
    },

    _clearTabData() {
        // keep history and bookmarks sizes of the current tabData
        this._tabData = {};
    },

    _setCommonProperties(payload, url) {
        payload.addon_version = self.version;
        payload.locale = Locale.getLocale();
    },


    _initTabSession(tab, loadReason) {
        this._tabData.url = tab.url;
        this._tabData.tab_id = tab.id;
        this._tabData.load_reason = loadReason;
    },

    navigateAwayFromPage(tab, reason) {
        // we can't use tab.url, because it's pointing to a new url of the page
        // we have to use the URL stored in this._openTabs object
        this._setCommonProperties(this._tabData, this._openTabs[tab.id].url);
        this._tabData.action = "heatmap_session";

        // unload_reason could be set in "handleUserEvent" for certain user events
        // in order to provide the more specific reasons other than "navigation"
        this._tabData.unload_reason = this._tabData.unload_reason || reason;

        if (this._tabData.start_time) {
            this._tabData.session_duration = (Date.now() - this._tabData.start_time);
            delete this._tabData.start_time;
        }
        delete this._tabData.active;
        let jsonTabData = JSON.stringify(this._tabData);
        console.log("Session has ended: " + jsonTabData);
        Services.obs.notifyObservers(null, TAB_SESSION_COMPLETE, jsonTabData);
        this._clearTabData();

    },

    logReady(tab) {
        // If an inactive tab is done loading, we don't care. It's session would have
        // already ended, likely with an 'unfocus' unload reason.
        if (tabs.activeTab.id === tab.id) {
            if (!this._tabData.url) {
                this._tabData.load_reason = "newtab";
            } else if (!this._tabData.session_duration) {
                // The page content has been reloaded but a total time wasn't set.
                // This is due to a page refresh. Let's set the total time now.
                this.navigateAwayFromPage(tab, "refresh");
                this._tabData.load_reason = "refresh";
            }
            this.logActivate(tab);
            return;
        }
    },

    logPageShow(tab) {
        // 'pageshow' events are triggered whenever 'ready' events are triggered as well
        // as whenever a user hits the 'back' button on the browser. The 'ready' event
        // is emitted before this 'pageshow' event in cases when both are triggered.
        // Thus, if we get here and load_reason still has not been set, then we know
        // we got here due to a click of the 'back' button.
        if (!this._tabData.load_reason) {
            // logReady will start a new session and set the 'load_reason' as 'newtab'.
            // we do not use 'back_button' for the 'load_reason' due to a known issue:
            // https://github.com/mozilla/activity-stream/issues/808
            this.logReady(tab);
        }
    },

    logActivate(tab) {
        // note that logActivate may be called from logReady handler when page loads
        // but also from "activate" event, when the tab gains focus, in which case
        // we need to restore tab_id and url, because they could have been errased
        // by a call navigateAwayFromPage() caused by another tab
        this._initTabSession(tab, this._tabData.load_reason || "focus");
        this._tabData.start_time = Date.now();

        // URL stored in this._openTabs object keeps the previous URL after the tab.url
        // is replaced with a different page URL, as in click action of page reload
        this._openTabs[tab.id].url = tab.url;
        this._openTabs[tab.id].active = true;
    },

    logDeactivate(tab) {
        // If there is no activeTab, that means we closed the whole window
        // we already log "close", so no need to log deactivate as well.
        if (!tabs.activeTab) {
            return;
        }

        this.navigateAwayFromPage(tab, "unfocus");
        this._openTabs[tab.id].active = false;
    },

    logClose(tab) {
        // check whether this tab is inactive or not, don't send the close ping
        // if it's inactive as an "unfocus" one has already been sent by logDeactivate.
        // Note that the test !tabs.activeTab won't work here when the user closes
        // the window
        if (!this._openTabs[tab.id].active) {
            return;
        }
        this.navigateAwayFromPage(tab, "close");

        // get rid of that tab reference
        delete this._openTabs[tab.id];
    },

    onOpen(tab) {
        console.log("onOpen invoked");
        this._openTabs[tab.id] = {tab: tab, url: tab.url, active: true};

        this.logReady = this.logReady.bind(this);
        this.logPageShow = this.logPageShow.bind(this);
        this.logActivate = this.logActivate.bind(this);
        this.logDeactivate = this.logDeactivate.bind(this);
        this.logClose = this.logClose.bind(this);

        tab.on("ready", this.logReady);
        tab.on("pageshow", this.logPageShow);
        tab.on("activate", this.logActivate);
        tab.on("deactivate", this.logDeactivate);
        tab.on("close", this.logClose);
    },
};

exports.TabTracker = TabTracker;
