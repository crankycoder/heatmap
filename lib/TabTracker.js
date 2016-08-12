/* globals Services, Locale */

const tabs = require("sdk/tabs");
const {Cu} = require("chrome");
const self = require("sdk/self");
const {uuid} = require("sdk/util/uuid");

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Locale.jsm");

const TAB_SESSION_COMPLETE = "tab-session-complete";

function TabTracker() {
    /*
     * A session is defined as the time between the 'activate' event
     * for a page and the end is marked by a call to
     * 'navigateAwayFromPage'.
     *
     * NAFP can be triggerd by any of these events:
     *  - a page is refreshed, no total time has been set and logReady is invoked.
     *  - logActivate is invoked when the a new tab gains focus
     *  - logClose when a tab has been closed
     */

    /* Canonical list of fields is:
       https://github.com/mozilla/activity-stream/blob/master/data_dictionary.md
        _tabData.url = tab.url;
        _tabData.tab_id = tab.id;
        _tabData.start_time = ms from epoch starttime
        _tabData.duration = session duration in milliseconds
     */
  this._tabData = {};

  this.logReady = this.logReady.bind(this);
  this.logPageShow = this.logPageShow.bind(this);
  this.logActivate = this.logActivate.bind(this);
  this.logClose = this.logClose.bind(this);

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

    /*
     * For a tab scoped dictionary of data
     */
    tabData(tab) {
        if (!this._tabData[tab.id]) {
            this._tabData[tab.id] = {};
        }
        return this._tabData[tab.id];
    },
    
    _logMethod(methodName, tab) {
        console.log(methodName + ": ["+tab.id+"] : " + tab.url);
    },

    _addListeners() {
        tabs.on("ready", this.logReady);
    },

    _removeListeners() {
        for (let id in this._openTabs) {
            let tab = this._openTabs[id].tab;
            tab.removeListener("ready", this.logReady);
            tab.removeListener("pageshow", this.logPageShow);
            tab.removeListener("activate", this.logActivate);
            tab.removeListener("close", this.logClose);
        }
        tabs.removeListener("load", this.onLoad);
    },

    clearTabData(tab) {
        // keep history and bookmarks sizes of the current tabData
        delete this._tabData[tab.id];
        console.log("Removed tab.id["+tab.id+"] from tabData");
    },


    _initTabSession(tab) {
        console.log("Session started for tab: ["+tab.id+"] : " + tab.url);
        this.tabData(tab).url = tab.url;
        this.tabData(tab).tab_id = tab.id;
        this.tabData(tab).start_time = Math.ceil(Date.now() / 1000);
    },

    navigateAwayFromPage(tab) {
        if (tab.url === 'about:newtab' || tab.url == 'about:newtab') {
            console.log("about:newtab detected and short circuiting");
            // Do nothing but clear the tab data
            // this is just a newtab, who cares.
            this.clearTabData(tab);
            return;
        }

        if (this.tabData(tab).start_time) {
            this.tabData(tab).duration = Math.ceil((Date.now()/1000) - this.tabData(tab).start_time);
        }
        let jsonTabData = JSON.stringify(this.tabData(tab));
        console.log("Session ended for tab: ["+tab.id+"] = " + jsonTabData);
        Services.obs.notifyObservers(null, TAB_SESSION_COMPLETE, jsonTabData);
        console.log("Observers notified!");
        this.clearTabData(tab);
    },

    logReady(tab) {
        this._logMethod("logReady", tab);

        if (this.tabData(tab).url) {
            // If the tab already has URL, then this is a manually
            // typed in link.  Close the session, then continue
            this.navigateAwayFromPage(tab);
        }

        this._openTabs[tab.id] = {tab: tab, url: tab.url, active: true};
        
        // We initialize the tab session when the content is first
        // made ready.  
        this._initTabSession(tab);

        tab.on("pageshow", this.logPageShow);
        tab.on("activate", this.logActivate);
        tab.on("close", this.logClose);
    },

    logPageShow(tab) {
        this._logMethod("logPageShow", tab);
        // 'pageshow' events are triggered whenever 'ready' events are triggered as well
        // as whenever a user hits the 'back' button on the browser. The 'ready' event
        // is emitted before this 'pageshow' event in cases when both are triggered.
        // Thus, if we get here and load_reason still has not been set, then we know
        // we got here due to a click of the 'back' button.
    },

    logActivate(tab) {
        console.log("logActivate: ["+tab.id+"]");

        // URL stored in this._openTabs object keeps the previous URL after the tab.url
        // is replaced with a different page URL, as in click action of page reload
        this._openTabs[tab.id].url = tab.url;
    },


    logClose(tab) {
        this._logMethod("logClose", tab);
        this.navigateAwayFromPage(tab);

        // get rid of that tab reference
        delete this._openTabs[tab.id];
    },

};

exports.TabTracker = TabTracker;
