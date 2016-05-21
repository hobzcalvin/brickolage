
p5.OPC = function (host, using_websockify) {
  var ws = new WebSocket("ws://" + (host || "localhost:7890"),
                         using_websockify ? ['binary', 'base64'] : '');
  var connected = false;

  ws.onopen = function () {
    connected = true;
  };
  ws.onclose = function () {
    connected = false;
  };
  ws.onerror = function (error) {
    console.log('WebSocket Error ' + error);
  };

  this._sendPacket = function(pkt) {
    if (connected) {
      var packet = new Uint8Array(pkt);
      ws.send(packet.buffer);
    }
  }

  // http://stackoverflow.com/questions/4812686/closing-websocket-correctly-html5-javascript
  window.onbeforeunload = function() {
    websocket.onclose = function () {}; // disable onclose handler first
    websocket.close()
  };
}

p5.OPC.prototype.handleDraw = function() {
  loadPixels();

  var packet = [];
  for (var i = 0; i < 400; i++) {
    packet.push(pixels[i*4], pixels[i*4+1], pixels[i*4+2]);
  }
  packet.unshift(0, 0, (packet.length >> 8) & 0xFF, packet.length & 0xFF);
  this._sendPacket(packet);

  updatePixels();

  textSize(12);
  fill(255);
  stroke(0);
  text('fps:'+Math.round(frameRate()), 0, 14);
}

