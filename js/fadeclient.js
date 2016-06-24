/*
 To run this web-app you can point a browser to:
   file://path/to/this-file/index.html
 or run:
   /path/to/this-file> python -m SimpleHTTPServer 8000
   and visit:
   http://localhost:8000
 or try mongoose on Windows (using included mongoose.conf file).
   the .exe file should live in this directory.

 For testing without a FadeCandy, do:
   /path/to/websockify> ./websockify.py 7890 localhost:7891
   /path/to/openpixelcontrol> bin/gl_server -l layouts/mylayout.json -p 7891

 For use with a real FadeCandy board:
   /path/to/fadecandy/bin> ./fcserver-osx /path/to/config-file.json

 The OPC object will try to connect to a FadeCandy board, then fall back
 to a websockify host.
 */

var OPC_HOST = (window.location.hostname || 'localhost') + ':7890';

var HEIGHT = 10;
var WIDTH = 40;
// Milliseconds of inactivity before simulating activity
var INACTIVITY_TIMEOUT = 15000;
var INACTIVITY_CHANGE_FRAMES = 600;
// This could probably be anything!
var COLOR_MAX = 1000;

var lastTouch;
var widthMin;
var widthRange;

var statusSpan;

function setup() {
  opc = new p5.OPC(OPC_HOST);
  pixelDensity(1);
  // Bogus values until we call windowResized()
  var canvas = createCanvas(10, 10);
  canvas.parent('#canvasDiv');

  colorMode(HSB, COLOR_MAX, COLOR_MAX, COLOR_MAX, COLOR_MAX);
  // Tint makes everything slow!!!
  noTint();

  statusSpan = select('#statusSpan');

  // Get the slider DOM elements
  decaySlider = document.getElementById('decaySlider');
  widthSlider = document.getElementById('widthSlider');
  hueSlider = document.getElementById('hueSlider');
  satSlider = document.getElementById('satSlider');
  brightSlider = document.getElementById('brightSlider');
  hueRangeSlider = document.getElementById('hueRangeSlider');
  satRangeSlider = document.getElementById('satRangeSlider');
  brightRangeSlider = document.getElementById('brightRangeSlider');

  // Initialize sliders
  initializeSlider(decaySlider);
  initializeSlider(widthSlider);
  initializeBaseAndRangeSliders(hueSlider, hueRangeSlider, true);
  initializeBaseAndRangeSliders(satSlider, satRangeSlider, false);
  initializeBaseAndRangeSliders(brightSlider, brightRangeSlider, false);

  // Some special initialization for hue/sat slider handlers
  hueSlider.noUiSlider.on('update', function(val) {
    satSlider.style.background = 'linear-gradient(90deg, ' +
      '#FFFFFF, hsl(' + val/COLOR_MAX*360 + ', 100%, 50%))';
  });
  hueSlider.noUiSlider.on('update', updateBrightSlider);
  satSlider.noUiSlider.on('update', updateBrightSlider);

  // Initial values for sliders
  decaySlider.noUiSlider.set(COLOR_MAX * 4 / 5);
  widthSlider.noUiSlider.set(COLOR_MAX / 5);
  hueSlider.noUiSlider.set(COLOR_MAX * Math.random());
  hueRangeSlider.noUiSlider.set(COLOR_MAX / 10);
  satSlider.noUiSlider.set(COLOR_MAX);
  satRangeSlider.noUiSlider.set(COLOR_MAX / 5);
  brightSlider.noUiSlider.set(COLOR_MAX);
  brightRangeSlider.noUiSlider.set(COLOR_MAX / 5);

  // This encompasses all post-resize setup logic, so always call it to start
  windowResized();
  lastTouch = millis();
}

function initializeSlider(s) {
  noUiSlider.create(s, {
    start: 0,
    range: {
      min: 0,
      max: COLOR_MAX
    },
    behaviour: 'snap'
  });
}
function initializeBaseAndRangeSliders(slider, rangeSlider, wrap) {
  initializeSlider(slider);
  initializeSlider(rangeSlider);
  // Because the 'update' handler is fired when connected, we can't connect
  // it until both sliders are initialized. Now they are!
  [slider, rangeSlider].forEach(function(s) {
    s.noUiSlider.on('update', function() {
      updateRangeIndicator(slider, rangeSlider, wrap);
    });
  });
}

function clearCanvas() {
  background(0);
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
  clearCanvas();

  // Update these parameters for determining what the width slider means
  widthMin = width/WIDTH / 2;
  widthRange = width/WIDTH * HEIGHT;
}

function toggleConnection() {
  opc.toggleConnection();
  clearCanvas();
}
function keyPressed() {
  if (keyCode === ESCAPE) {
    toggleConnection();
  }
}
function deviceShaken() {
  toggleConnection();
}

function updateRangeIndicator(slider, rangeSlider, wrap) {
  // Make sure these are numbers
  var baseVal = +slider.noUiSlider.get();
  var rangeVal = +rangeSlider.noUiSlider.get();
  // Where to place pips indicating range
  var values = [];
  // Min/max values, which get big pips
  var minVal, maxVal;
  if (rangeVal == 0) {
    // Just one pip
    values.push(baseVal);
    // This one pip's value will match minVal; maxVal is unused
    minVal = baseVal;
    maxVal = null;
    // Remember the 'range' on the slider for later lookup.
    slider.min = slider.max = baseVal;
  } else {
    if (!wrap) {
      // For sat/bright, the spread of values is affected by how close the base
      // value is to the bounds. Always allow the width of the range to happen,
      // getting as close to "center" on the base as possible.
      if (baseVal - rangeVal/2 < 0) {
        baseVal = rangeVal/2;
      } else if (baseVal + rangeVal/2 > COLOR_MAX) {
        baseVal = COLOR_MAX - rangeVal/2;
      }
    }
    // For hue, we can just use % to wrap the values around the color wheel.
    // This may be < 0
    minVal = baseVal - rangeVal/2;
    // This may be > COLOR_MAX
    maxVal = baseVal + rangeVal/2;
    // Go from min to max, stepping by an arbitrary density
    for (var i = minVal; i < maxVal; i += COLOR_MAX / 50) {
      // Only do this if needed because the + / % thing adds float inaccuracy!
      if (i < 0 || i > COLOR_MAX) {
        // Ensure pushed value is between 0 and COLOR_MAX
        values.push((i + COLOR_MAX) % COLOR_MAX);
      } else {
        values.push(i);
      }
    }
    // Remember these values on the slider for later lookup.
    // Do this before we correct them to in-range; we want this for easier
    // color computation later. So hueSlider's min,max may be -50,50 or
    // 950,1050, which are equivalent and both fine. randomRange() corrects
    // its return value to [0, COLOR_MAX].
    slider.min = minVal;
    slider.max = maxVal;
    if (wrap) {
      // Now that the loop is over, correct min/max to in-range values.
      // (If we aren't wrapping these values should already be in range,
      // and we don't want to correct maxVal=COLOR_MAX to 0.)
      // Also, only correct if needed (and we corrected above in the for loop)
      // because the correction adds float error!
      if (minVal < 0) {
        minVal = (minVal + COLOR_MAX) % COLOR_MAX;
      }
      if (maxVal > 0) {
        maxVal %= COLOR_MAX;
      }
    }
    // We need this test because very close pip values will confuse the
    // NoUiSlider and cause an infinite loop!
    if (Math.abs(maxVal - minVal) < 0.01) {
      // We're basically covering the whole range; cool. No need to show
      // large pips: clear out min/max so they're never matched.
      minVal = null;
      maxVal = null;
    } else {
      // We should explicitly add maxVal here so we can match it below and
      // show a big pip.
      values.push(maxVal);
    }
  }
  // Remove old set of pips (doesn't do this on its own??)
  var oldPips = slider.querySelectorAll('.noUi-pips');
  Array.prototype.forEach.call(oldPips, function(el) {
    el.parentNode.removeChild(el);
  });
  slider.noUiSlider.pips({
    mode: 'values',
    values: values,
    // This sets the density of the smallest pips, which we can't turn off.
    // We hide them anyway, so just create as few as possible.
    density: 10000,
    format: { to: function() { return '' } },
    filter: function(v) {
      // Big pip if min or max; small pip otherwise
      return v === minVal || v === maxVal ? 1 : 2;
    }
  });
  // Sigh, okay. If there are no large pips and minVal isn't null
  // (if it was we wouldn't want to show *any* large pips)
  // that means the single large one was replaced
  // by a tiny one (which we don't show). Upgrade that one.
  if (minVal !== null &&
      slider.querySelectorAll('.noUi-marker-large').length == 0) {
    var pips = slider.querySelectorAll('.noUi-marker-normal');
    if (pips.length > 0) {
      pips[pips.length-1].classList.remove('noUi-marker-normal');
      pips[pips.length-1].classList.add('noUi-marker-large');
    }
  }
};

function updateBrightSlider() {
  var satPercent = satSlider.noUiSlider.get()/COLOR_MAX*100;
  brightSlider.style.background = 'linear-gradient(90deg, #000000, ' +
    'hsl(' + hueSlider.noUiSlider.get()/COLOR_MAX*360 + ', ' +
         satPercent + '%, ' + (100 - satPercent/2) + '%))';
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

function oldRandomRange(baseSlider, rangeSlider, wrap) {
  if (wrap) {
    // For hue, wrapping/"overflowing" around the min/max is ok.
    return (
      // Base value plus/minus up to half the range value.
      (baseSlider.value() + (Math.random() - 0.5) * rangeSlider.value())
       // This makes sure value returned is positive and less than COLOR_MAX.
       + COLOR_MAX) % COLOR_MAX
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
function randomRange(s) {
  var val = s.min + Math.random() * (s.max - s.min);
  // Only correct if needed so values equal to COLOR_MAX aren't
  // corrected to zero.
  if (val < 0 || val > COLOR_MAX) {
    val = (val + COLOR_MAX) % COLOR_MAX;
  }
  return val;
}
function newColor() {
  return color(
    randomRange(hueSlider),
    randomRange(satSlider),
    randomRange(brightSlider)
  );
}
function randomizeSlider(s) {
  s.noUiSlider.set(Math.random() * COLOR_MAX);
}

function draw() {
  opc.preDraw();
  // This points to touchHistory when there's active use; otherwise it holds
  // simulated touches from the touchArchive.
  var touchStore = {};
  if (lastTouch < millis() - INACTIVITY_TIMEOUT) {
    // Is replay starting now, or have we been replaying for a while?
    if (!inReplay || !(frameCount % INACTIVITY_CHANGE_FRAMES)) {
      inReplay = true;
      // Randomize various settings.
      randomizeSlider(decaySlider);
      randomizeSlider(widthSlider);
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

  var drawWidth = widthSlider.noUiSlider.get() / COLOR_MAX * widthRange + widthMin;
  strokeWeight(drawWidth);
  // Fill background with black at given alpha value to fade the image
  background(0, COLOR_MAX - COLOR_MAX * Math.pow(decaySlider.noUiSlider.get() / COLOR_MAX, 1/8));

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
      ellipse(touch[0].x, touch[0].y, drawWidth, drawWidth);
      touch[0].drawn = true;
    }
    if (touch[0].pendingDelete) {
      // This touch has already ended, but it was kept in touchStore (actually,
      // this must be touchHistory in practice) so we
      // could draw it. Now we should delete it.
      delete touchStore[i];
    }
  } 

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

