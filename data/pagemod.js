"use strict";

var rootElement = document.documentElement;

// Just copy the top level HTML and send it over the port
var htmlText = rootElement.outerHTML;
self.port.emit("rootElement", htmlText);
