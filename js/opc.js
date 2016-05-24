
var WEBSOCKET_STATES = {
  0: 'connecting',
  1: 'open',
  2: 'closing',
  3: 'closed'
}

p5.OPC = function (host, using_websockify) {
  var self = this;
  this.host = host;
  this.using_websockify = using_websockify;
  this.connect();
  this.pixelLocations = [];

  this._sendPacket = function(pkt) {
    if (self.ws.readyState == 1) {
      var packet = new Uint8Array(pkt);
      self.ws.send(packet.buffer);
    }
  }

  // http://stackoverflow.com/questions/4812686/closing-websocket-correctly-html5-javascript
  window.onbeforeunload = function() {
    websocket.onclose = function () {}; // disable onclose handler first
    websocket.close()
  };
}

p5.OPC.prototype.connect = function() {
  this.ws = new WebSocket("ws://" + (this.host || "localhost:7890"),
                          this.using_websockify ? ['binary', 'base64'] : '');
}
p5.OPC.prototype.close = function() {
  this.ws.close();
}
p5.OPC.prototype.toggleConnection = function() {
  if (this.ws.readyState == 1) {
    this.close();
  } else {
    this.connect();
  }
}

// Set the location of a single LED
p5.OPC.prototype.led = function(index, x, y) {
  // 4 values per pixel (R, G, B, A) in the pixels array
  this.pixelLocations[index] = (x + width * y) * 4;
}

// Set the location of several LEDs arranged in a strip.
// Angle is in radians, measured clockwise from +X.
// (x,y) is the center of the strip.
p5.OPC.prototype.ledStrip = function(index, count, x, y, spacing, angle, reversed) {
  var s = Math.sin(angle);
  var c = Math.cos(angle);
  for (var i = 0; i < count; i++) {
    this.led(reversed ? (index + count - 1 - i) : (index + i),
      Math.round(x + (i - (count-1)/2.0) * spacing * c + 0.5),
      Math.round(y + (i - (count-1)/2.0) * spacing * s + 0.5));
  }
}



// Set the location of several LEDs arranged in a grid. The first strip is
// at 'angle', measured in radians clockwise from +X.
// (x,y) is the center of the grid.
p5.OPC.prototype.ledGrid = function(index, stripLength, numStrips, x, y,
             ledSpacing, stripSpacing, angle, zigzag,
             flip) {
  var s = Math.sin(angle + Math.PI/2);
  var c = Math.cos(angle + Math.PI/2);
  for (var i = 0; i < numStrips; i++) {
    this.ledStrip(index + stripLength * i, stripLength,
      x + (i - (numStrips-1)/2.0) * stripSpacing * c,
      y + (i - (numStrips-1)/2.0) * stripSpacing * s, ledSpacing,
      angle, zigzag && ((i % 2) == 1) != flip);
  }
}

p5.OPC.prototype.getState = function() {
  return WEBSOCKET_STATES[this.ws.readyState];
}

p5.OPC.prototype.handleDraw = function() {
  loadPixels();

  var packet = [];
  for (var i = 0; i < this.pixelLocations.length; i++) {
    var idx = this.pixelLocations[i];
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
  packet.unshift(0, 0, (packet.length >> 8) & 0xFF, packet.length & 0xFF);
  this._sendPacket(packet);

  updatePixels();
}

