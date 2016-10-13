The marionette tests aim to instrument the heatmap addon in a variety
of ways to verify that the addon is collecting data in predictable
verifiable ways.

Test cases:


Single tab use cases
--------------------


The simple case
* Open a tab
* Go to a URL
* Close the tab
* assert that close time - open time is approximately equal to the
  time emitted from the heatmap addon


The common surfing case
* Open a tab
* Go to a URL
* Click the hyperlink
* Assert that the dwell time for the first URL is the time between
  click and open.

Multi-tab use cases
-------------------

Open link in new tab (background tab)
* Open a tab
* Go to a URL
* Click the hyperlink
* Assert that no data has been emitted because tab switch has not
  occured.

Open link in new tab (foreground tab)
* Open a tab
* Go to a URL
* Click the hyperlink
* Assert that data is emitted for the dwell time of the first tab

TODO: Switching tabs does not cause session duration time to change
TODO: Dwell time per pre-opened tab is recorded
TODO: Scroll data is captured
TODO: Capture which objects are clicked in the DOM
TODO: Referrer is captured
