===================
Heatmap JSON Schema
===================

Heatmap emits a JSON message to the miracle webserver.

The JSON must include a ``X-User`` header with a UUID for the user.

The UUID should not be related to any other account that the user may
have.

Content in the upload includes URL history generated in the order
that page session are terminated. 

Currently, web page sessions are strictly defined by the duration
that the page is open for.  A full browser shutdown is considered a
session termination even if tabs are restored the next time Firefox
is restarted.

Session Schema
~~~~~~~~~~~~~~

start_time
    The time the URL was accessed, measured in milliseconds since the
    UNIX epoch.  

url
    The URL of the page

tab_id
    The browser tab ID that the page was on.  This is a short string
    UID composed of a tab group integer and a tab integer.

duration
    The duration that the webpage was open for in milliseconds.

.. code-block:: javascript

    {"sessions": [{"start_time": 1468616293,
                   "url" : "http://some.website.com/and/the/url",
                   "tab_id" : "-31-2",
                   "duration": 2432},
                  {"start_time": 1468616293,
                   "url" : "http://foo.website.com/and/the/url",
                   "tab_id" : "-31-1",
                   "duration" : 4432}]}

