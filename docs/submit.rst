===================
Heatmap JSON Schema
===================

Heatmap emits a JSON message to the miracle webserver.

The JSON must include a ``X-User`` header with a UUID for the user.

The UUID should not be related to any other account that the user may
have.

Content in the upload will include URL history as well as session
data.

Each history record corresponds to a recently visited URL.

History Field Definition
~~~~~~~~~~~~~~~~~~~~~~~~

We capture 4 keys currently, but new keys may be added in the future:

lastAccessTime
    The time the URL was accessed, measured in milliseconds since the
    UNIX epoch.

uri
    The URI of the page that was fetched.

title
    The web page title.


.. code-block:: javascript

    {"lastAccessTime": 1468616293,
     "uri": "http://www.google.com/",
     "title": site_title}


A session is defined as the time that a page has been open for.

Each JSON blob for a session will have a JSON blob that looks like
this:

Session Schema
~~~~~~~~~~~~~~

url
    The URL of the page

tab_id
    The browser tab ID that the page was on.  This is a short string
    UID composed of a tab group integer and a tab integer.

session_duration
    The duration that the webpage was open for in milliseconds.

.. code-block:: javascript

    {"url" : "http://some.website.com/and/the/url",
     "tab_id" : "-31-2",
     "session_duration": 2432}


The combined JSON blob looks like this:


.. code-block:: javascript

    {"history" : [{"lastAccessTime": 1468616293,
                   "uri": "http://www.apple.com/",
                   "title": "Apple"},
                  {"lastAccessTime": 1468616293,
                   "uri": "http://www.google.com/",
                   "title": "Google"}],
     "sessions": [{"url" : "http://some.website.com/and/the/url",
                   "tab_id" : "-31-2",
                   "session_duration": 2432},
                  {"url" : "http://foo.website.com/and/the/url",
                   "tab_id" : "-31-1",
                   "session_duration" : 4432}]}

