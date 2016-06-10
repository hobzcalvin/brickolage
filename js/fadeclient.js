/*
 For testing, do:
 /path/to/this-file> python -m SimpleHTTPServer 8000
 /path/to/websockify> ./websockify.py 7890 localhost:7891
 /path/to/openpixelcontrol> bin/gl_server -l layouts/mylayout.json -p 7891
 */

// Set true if using websockify, which expects a format slightly different
// from the fcserver
var WEBSOCKIFY = true;
var OPC_HOST = (window.location.hostname || 'localhost') + ':7890';

var HEIGHT = 10;
var WIDTH = 40;
// Milliseconds of inactivity before simulating activity
var INACTIVITY_TIMEOUT = 30000;
var INACTIVITY_CHANGE_FRAMES = 600;

var lastFrame;
var lastTouch;

var decaySlider;
var diameterSlider;
var statusSpan;


function setup() {
  opc = new p5.OPC(OPC_HOST, WEBSOCKIFY);
  pixelDensity(1);
  // Bogus values until we call windowResized()
  var canvas = createCanvas(10, 10);
  canvas.parent('#canvasDiv');
  // Do this now so we have it for draw() which is called by resizeCanvas()
  lastFrame = get();

  colorMode(HSB, 1000, 1000, 1000, 1000);
  // Tint makes everything slow!!!
  noTint();

  decaySlider = select('#decaySlider');
  hueSlider = select('#hueSlider');
  satSlider = select('#satSlider');
  brightSlider = select('#brightSlider');
  hueRangeSlider = select('#hueRangeSlider');
  satRangeSlider = select('#satRangeSlider');
  brightRangeSlider = select('#brightRangeSlider');
  diameterSlider = select('#diameterSlider');
  statusSpan = select('#statusSpan');

  // This encompasses all post-resize setup logic, so always call it to start
  windowResized();
  lastTouch = millis();
}

function windowResized() {
  var thediv = select('#uiDiv');
  // Take up full width (since our display is wide).
  // Height of canvas should be twice what it needs to be to fit all the
  // virtual pixels (so users can draw outside the pixels a bit without
  // losing their touch/color/etc.) OR whatever's left in the window after
  // #uiDiv's height--whichever is less. This saves unnecessary pixels when
  // the window is very tall.
  resizeCanvas(windowWidth, Math.min(windowWidth / WIDTH * HEIGHT * 2,
                                     windowHeight - thediv.size().height));
  for (var i = 0; i < 8; i++) {
    opc.ledGrid((8-i-1)*50, HEIGHT, 5, width * (0.5 + i) / 8, height/2, width/WIDTH, width/WIDTH, Math.PI/2, true, true);
  }
  background(0);
  lastFrame = get();
}

function keyPressed() {
  if (keyCode === ESCAPE) {
    opc.toggleConnection();
  }
}
function deviceShaken() {
  opc.toggleConnection();
}

// Object holding new touches that need to be drawn
var touchHistory = {};
// Store of old touches that we'll use if there's inactivity
var touchArchive = [];
// Which index in touchArchive is next
var replayCursor = 0;
// Current touch in touchArchive that we're currently replaying
var currentReplay = null;
// Another boolean to track if we're entering replay right now
var inReplay = false;

function randomRange(baseSlider, rangeSlider, wrap) {
  if (wrap) {
    // For hue, wrapping/"overflowing" around the min/max is ok.
    return (
      // Base value plus/minus up to half the range value.
      (baseSlider.value() + (Math.random() - 0.5) * rangeSlider.value())
       // This makes sure value returned is positive and less than 1000.
       + 1000) % 1000
  } else {
    // For sat/bright, the spread of values is affected by how close the base
    // value is to the bounds. Always allow the width of the range to happen,
    // getting as close to "center" on the base as possible.
    var base = baseSlider.value();
    var range = rangeSlider.value();
    if (base - range/2 < 0) {
      base = range/2;
    } else if (base + range/2 > 999) {
      base = 999 - range/2;
    }
    return (Math.random() - 0.5) * range + base;
  }
}
function newColor() {
  return color(
    randomRange(hueSlider, hueRangeSlider, true),
    randomRange(satSlider, satRangeSlider, false),
    randomRange(brightSlider, brightRangeSlider, false)
  );
}
function randomizeSlider(s) {
  var min = s.attribute('min');
  s.value(Math.random() * (s.attribute('max')-min) + min);
}

function draw() {
  // This points to touchHistory when there's active use; otherwise it holds
  // simulated touches from the touchArchive.
  var touchStore = {};
  if (lastTouch < millis() - INACTIVITY_TIMEOUT) {
    // Is replay starting now, or have we been replaying for a while?
    if (!inReplay || !(frameCount % INACTIVITY_CHANGE_FRAMES)) {
      inReplay = true;
      // Randomize various settings.
      randomizeSlider(decaySlider);
      randomizeSlider(diameterSlider);
      randomizeSlider(hueSlider);
      randomizeSlider(satSlider);
      randomizeSlider(brightSlider);
      randomizeSlider(hueRangeSlider);
      randomizeSlider(satRangeSlider);
      randomizeSlider(brightRangeSlider);
    }
    // We're inactive. If there's no touch currently being replayed and
    // the touchArchive has touches to replay, pick the next one.
    if (!currentReplay && touchArchive.length > 0) {
      // Make sure we pick a reasonable index.
      replayCursor %= touchArchive.length;
      // We'll pick the next index next time.
      currentReplay = touchArchive[replayCursor++];
      // Earliest point in the touch has color data, etc.
      var earliest = currentReplay[currentReplay.length-1];
      // Give it a new random color
      earliest.color = newColor();
      // Give this replay of the touch a random reflection
      earliest.reflect = Math.floor(Math.random() * 4);
      // All timestamps will be subtracted by this for proper replay timing
      var t_offset = earliest.t - millis();
      for (var i in currentReplay) {
        var point = currentReplay[i];
        point.t -= t_offset;
        // Forget these, if any
        delete point.drawn;
        delete point.pendingDelete;
        // Reflect vertical/horizontal
        if (earliest.reflect % 2) {
          point.x = width - point.x;
        }
        if (earliest.reflect < 2) {
          point.y = height - point.y;
        }
      }
    }
    if (currentReplay) {
      // We're in the middle of a replay. Has the last point been drawn?
      if (currentReplay[0].drawn) {
        // Yes; the replay of this touch is over. Pick a new one next time.
        currentReplay = null;
      } else {
        // Still more points in the current replayed touch. Transform this
        // into the faked touchStore (acts like touchHistory) by filtering out
        // all points in the "future" (now that we've offset the timestamps)
        touchStore = {
          0: currentReplay.filter(function(pt) { return pt.t <= millis() })
        };
      }
    }
  } else {
    // Someone's playing! So use the real touchHistory, and forget about
    // whatever we were replaying.
    touchStore = touchHistory;
    currentReplay = null;
    inReplay = false;
  }

  var dia = diameterSlider.value();
  strokeWeight(dia);
  image(lastFrame);
  // Fill background with black at given alpha value to fade the image
  background(0, 1000 - 1000 * Math.pow(decaySlider.value() / 1000, 1/8));

  // Loop through all still-going touches 
  for (var i in touchStore) {
    var touch = touchStore[i];
    // If this touch has multiple points in its path,
    if (touch.length > 1 &&
        // and the latest point has never been drawn,
        !touch[0].drawn) {
      // then draw a line from the latest point to the one before.
      // Color is stored in the earliest history element.
      stroke(touch[touch.length-1].color);
      for (var j = 0; j < touch.length-1; j++) {
        if (!touch[j].drawn) {
          line(touch[j].x, touch[j].y, touch[j+1].x, touch[j+1].y);
          touch[j].drawn = true;
        } else {
          // If this point has been drawn, all previous ones must have been too
          break;
        }
      }
    // Otherwise (only one point, or the last point has been drawn),
    // just draw the latest point as a circle. This means continued
    // touching means continued drawing of the circle.
    } else {
      noStroke();
      // Color is stored in the earliest history element.
      fill(touch[touch.length-1].color);
      ellipse(touch[0].x, touch[0].y, dia, dia);
      touch[0].drawn = true;
    }
    if (touch[0].pendingDelete) {
      // This touch has already ended, but it was kept in touchStore (actually,
      // this must be touchHistory in practice) so we
      // could draw it. Now we should delete it.
      delete touchStore[i];
    }
  } 

  // Save the canvas before OPC does crap to it
  lastFrame = get();
  opc.handleDraw();
  updateFrameRate();
}

var frSum = 0;
var frCount = 0;
function updateFrameRate() {
  frSum += frameRate();
  frCount++;
  if (frCount >= 10) {
    statusSpan.html(opc.getState() + ' | fps:' + Math.round(frSum/frCount));
    frSum = frCount = 0;
  }
}

// One-stop function to handle the current state of touches, which if this is
// called, probably changed in some way.
function handleTouches(ts) {
  lastTouch = millis();
  // Build a new touchHistory array while we delete entries from the old one
  newTH = {};
  for (var i in ts) {
    var touch = ts[i];
    if (touch.x < 0 || touch.x > width || touch.y < 0 || touch.y > height) {
      // Ignore this touch; it's outside the canvas bounds
      continue;
    }
    var record = { t: lastTouch, x: touch.x, y: touch.y };
    if (touch.id in touchHistory) {
      newTH[touch.id] = [record].concat(touchHistory[touch.id]);
      // Remove this touch from old touchHistory; we've seen it.
      delete touchHistory[touch.id];
    } else {
      record.color = newColor();
      newTH[touch.id] = [record]
    }
  }
  // Any remaining touches in touchHistory are now over.
  // However, they may not all have been drawn, meaning they haven't
  // been drawn to the canvas.
  for (var i in touchHistory) {
    if (!touchHistory[i][0].drawn) {
      // Touch still has some drawing left, so keep it in touchHistory but
      // with a flag so draw() knows it can delete it when drawn.
      touchHistory[i][0].pendingDelete = true;
      // Now that this touch is over, its id may be reused (probably only
      // happens for mouse events). So give it a hacky new id.
      newTH[i+'pending'] = touchHistory[i];
    }
    // This touch is technically over, so move it to the history for replay
    touchArchive.push(touchHistory[i]);
  }
  touchHistory = newTH;
}
// Pressed and tragged are the same thing: update with a faked touches object
mousePressed = mouseDragged = function() {
  handleTouches([{x: mouseX, y: mouseY, id:0}]);
}
// Mouse released means no more (faked) touches
mouseReleased = function() {
  handleTouches([]);
}
// Real touch events can just pass along the touches array
touchStarted = touchMoved = touchEnded = function() {
  handleTouches(touches);
}


// Prevent overscrolling on iOS etc.
document.body.addEventListener('touchmove', function(event) {
  // We need the touchmove event for sliders to work properly
  if (event.target.nodeName != "INPUT") {
    event.preventDefault();
  }
}, false); 

