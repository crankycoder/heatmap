Context Graph Experiment Data Practices
=======================================

This document describes the set of practices we’ve put in place to
protect the participants of this study. We are excited to see what we can
build with this project.

A random selection of Firefox users using English localization will
receive an offer to participate. For Firefox users who agree to
participate, we begin collecting information about page visits for the
duration of the study or until the user turns the experiment off.

The data sent from the client to the server
consists of a URL, an identifier for the tab that contains the URL,
the time visited, and the amount of time spent on the page. Details on
the exact format of this data may be found at [github.com/mozilla/heatmap/docs/submit.rst](https://github.com/mozilla/heatmap/blob/master/docs/submit.rst).
All raw data for a single user is stored together.

Here are the practices we have put in place for how we collect and
handle this data.

* All user data is encrypted while in transit and while stored on any server accessible from the internet.

* Participants are given a random ID for the experiment that is not associated with any other identifier. It is used to keep a specific user's data together on the server and to allow a user to request that their data be deleted. That ID will not appear in request logs or anywhere associated with an IP address.

* As part of the addon process, we will ask participants to provide any common usernames they may have. This information will not be sent to the server and will only be used within the Firefox client.

* URLs containing one or more of the provided usernames will be sent to the server with that username replaced by [USERNAME]. We will use these URLs to identify patterns so that we can remove similarly identifying URLs from the data set. This helps us further anonymize the data for other participants who may not have provided this information.

* Any URLs containing a basic-auth string will be filtered out by the client and not sent to the server.

* URLs belonging to any domain commonly associated with pornographic material will be filtered out at the client and not sent to the server. Note that domains that have pornographic content along with other material will not be filtered.

* Collection of data will stop 3 months after the study begins. Raw data associated with this project will be deleted 9 months after the study ends.

* Participants may remove themselves from the collection process after initially opting in. This will delete the collected data from the server. To opt out, type about:addons into the location bar, and press enter. Find Context Graph Experiment in the addons list and click the `Remove` button.

* Only a small number of developers will have access to the raw data and raw data will remain in a single (virtual) location. Code to generate aggregate output will be run through these developers, and they'll monitor that code and the resulting output for any potentially identifying information. All code run against the collected data will be publicly available. 

* When we release information publicly, we do so to improve our products and foster an open web. If we share aggregate information from this study we will disclose it in a way that minimizes the risk of study participants being identified.
