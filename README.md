# It's Brickolage!

See a live version at http://hobzcalvin.github.io/brickolage

## Running
To run this web-app you can point a browser to `file://path/to/this-file/index.html`
or run `/path/to/this-file> python -m SimpleHTTPServer 8000`
and visit `http://localhost:8000`
or try mongoose on Windows (using included mongoose.conf file). The .exe file should live in this directory.

For testing without a FadeCandy, do:
```
/path/to/websockify> ./websockify.py 7890 localhost:7891
/path/to/openpixelcontrol> bin/gl_server -l layouts/mylayout.json -p 7891
```

For use with a real FadeCandy board:
```
/path/to/fadecandy/bin> ./fcserver-osx /path/to/config-file.json
```

The OPC object in `brickolage.js` will try to connect to a FadeCandy board, then fall back to a websockify host.

## Use
This webapp should work on any sufficiently fast web browser.
Android tablets and iPads are great. It is not yet optimized for mobile screens.

## Philosophy
I got tired of dealing with provisioning profiles, incompatible iOS versions, and other issues with iPad apps. This webapp can be served by any sort of machine, including a Raspberry Pi, and viewed by any browser, even mobile phones of participants.

## See it in action
The Brickolage Wall appears at [Loves Company](https://www.facebook.com/lovescompany/) on the fourth Friday of every month at Underground SF, San Francisco.
