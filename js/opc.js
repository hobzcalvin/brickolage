
var WEBSOCKET_STATES = {
  0: 'connecting',
  1: 'open',
  2: 'closing',
  3: 'closed'
}

p5.OPC = function (host) {
  var self = this;

  var _sendPacket = function(pkt) {
    if (self.ws.readyState == 1) {
      var packet = new Uint8Array(pkt);
      self.ws.send(packet.buffer);
    }
  }

  var _baseConnect = function() {
    self.ws = new WebSocket("ws://" + (self.host || "localhost:7890"),
                            self.using_websockify ? ['binary', 'base64'] : ['fcserver']);
  }

  this.connect = function() {
    // First, try without using_websockify, as if we're talking to a real
    // FadeCandy board.
    self.using_websockify = false;
    _baseConnect();
    self.ws.onerror = function(err) {
      // That didn't work; clear this error handler (avoid infinite loop!)
      // and try using_websockify this time. This will fall back to setups
      // using websockify as a proxy to a true openpixelcontrol server.
      self.using_websockify = true;
      self.ws.onerror = null;
      _baseConnect();
    }
  }
  this.close = function() {
    self.ws.close();
  }
  this.toggleConnection = function() {
    if (self.ws.readyState == 1) {
      self.close();
    } else {
      self.connect();
    }
  }

  // Set the location of a single LED
  this.led = function(index, x, y) {
    // 4 values per pixel (R, G, B, A) in the pixels array
    self.pixelLocations[index] = (x + width * y) * 4;
  }

  // Set the location of several LEDs arranged in a strip.
  // Angle is in radians, measured clockwise from +X.
  // (x,y) is the center of the strip.
  this.ledStrip = function(index, count, x, y, spacing, angle, reversed) {
    var s = Math.sin(angle);
    var c = Math.cos(angle);
    for (var i = 0; i < count; i++) {
      self.led(reversed ? (index + count - 1 - i) : (index + i),
        Math.round(x + (i - (count-1)/2.0) * spacing * c + 0.5),
        Math.round(y + (i - (count-1)/2.0) * spacing * s + 0.5));
    }
  }



  // Set the location of several LEDs arranged in a grid. The first strip is
  // at 'angle', measured in radians clockwise from +X.
  // (x,y) is the center of the grid.
  this.ledGrid = function(index, stripLength, numStrips, x, y,
                          ledSpacing, stripSpacing, angle, zigzag,
                          flip) {
    var s = Math.sin(angle + Math.PI/2);
    var c = Math.cos(angle + Math.PI/2);
    for (var i = 0; i < numStrips; i++) {
      self.ledStrip(index + stripLength * i, stripLength,
        x + (i - (numStrips-1)/2.0) * stripSpacing * c,
        y + (i - (numStrips-1)/2.0) * stripSpacing * s, ledSpacing,
        angle, zigzag && ((i % 2) == 1) != flip);
    }
  }

  this.getState = function() {
    return WEBSOCKET_STATES[self.ws.readyState];
  }

  this.preDraw = function() {
    // Remove the pixel-indicator dots we added in handleDraw so the
    // canvas is restored to its original state. This lets callers
    // perform operations on the canvas without needing to handle
    // the fact that we draw on it.
    loadPixels();
    for (var i = 0; i < self.pixelLocations.length; i++) {
      var idx = self.pixelLocations[i];
      if (idx !== undefined) {
        pixels[idx] ^= 0xFF;
        pixels[idx+1] ^= 0xFF;
        pixels[idx+2] ^= 0xFF;
      }
    }
    updatePixels();
  }

  this.handleDraw = function() {
    loadPixels();

    var packet = [];
    for (var i = 0; i < self.pixelLocations.length; i++) {
      var idx = self.pixelLocations[i];
      if (idx === undefined) {
        // Handle missing indices by sending blank LED values
        packet.push(0, 0, 0);
      } else {
        packet.push(pixels[idx], pixels[idx+1], pixels[idx+2]);
        pixels[idx] ^= 0xFF;
        pixels[idx+1] ^= 0xFF;
        pixels[idx+2] ^= 0xFF;
      }
    }
    if (self.using_websockify) {
      // gl_server expects the packet length, as is the OPC standard
      packet.unshift(0, 0, (packet.length >> 8) & 0xFF, packet.length & 0xFF);
    } else {
      // fcserver expects 0s because the TCP packet already defines length
      packet.unshift(0, 0, 0, 0);
    }
    _sendPacket(packet);

    updatePixels();
  }

  // http://stackoverflow.com/questions/4812686/closing-websocket-correctly-html5-javascript
  window.onbeforeunload = function() {
    websocket.onclose = function () {}; // disable onclose handler first
    websocket.close()
  };

  // ACTUAL CONSTRUCTOR STUFF
  this.host = host;
  this.connect();
  this.pixelLocations = [];
}
