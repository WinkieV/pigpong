"use strict"

const allId = 'all';  // main SVG element ID
let allElem;  // main SVG element
let allLft, allRgt; // left/right edges of full canvas

const pigStartId = 'pig-start'; // large pig in waiting phase
const pigStartSmileId = 'pig-smile', pigStartSmirkId = 'pig-smirk';
let pigStartCountdown = 0; // @<=pigStartCountdownMax, countdown to smirk
const pigStartCountdownMin = 2, pigStartCountdownMax = 6; // 0<@1<=@2
const pigStartSmirkDuration = 750; // pig smirk duration (in milliseconds)

const pigNormalId = 'pig-normal';
const pigNormalTightBBId = 'tight-bb';
let pigR; // pig radius
let pigXIni, pigYIni;
let pigXCur, pigYCur;
let pigACur;  // current rotation angle (in degrees)
let pigDirectionX = +1.0; // horizontal direction, +1 for left-to-right, -1 for right-to-left
let pigSpeedXCur = 0.0; // current (horizontal) pig speed
const pigSpeedXMin = 300 / 1000, pigSpeedXMax = pigSpeedXMin * 2.5; // 0<@1<=@2, min./max. horizontal speed (in SVG units per millisecond)
const pigSpeedXHit = 1.15;  // 1<=@, speedup factor at each control hit
const pigRotateDist = 350;  // 0<@, full rotation distance (in SVG units)
let   pigTangentCur = 0.0;  // pigTangentMin<=@<=pigTangentMax, tangent (vertical speed in relation to horizontal speed)
const pigTangentMin = -Math.tan(60.0 * (Math.PI/180)), pigTangentMax = -pigTangentMin; // @1<0 && 0<@2, min./max. tangent
const pigTangentBumpMin = -Math.tan(7 * (Math.PI / 180)), pigTangentBumpMax = -pigTangentBumpMin; // @1<0 && 0<@2, tangent bump
const pigTangentScaleMin = 0.65, pigTangentScaleMax = 2.2; // 0<@1<1<@2
const pigScaleMin = 1.0, pigScaleMax = 3.0;
let pigTranslate, pigRotate, pigScale;

const creekWavesIds = ['waves-0', 'waves-1', 'waves-2', 'waves-3']; // creek water animation
const creekWavesInterval = 300.0; // in milliseconds
let creekWavesUpdateLast = 0.0; // last update, initially ancient time to force update on first frame
let creekWaveCurrent = 0; // 0<=@<creekWavesIds.length

// game phases
const PHASE = {
  waiting: 0,
  startup: 1,
  playing: 2,
  cooling: 3
};
let phase = PHASE.waiting;

// startup phase
const startupDuration = 3000.0; // in milliseconds
let startupTimestamp = 0.0;  // dummy for now

// playing phase
let frameTimestamp = 0.0; // timestamp last frame, in milliseconds, dummy for now

let playerLft = false, playerRgt = false;  // is left and/or right a human player?

let isDraggingLft = false, isDraggingRgt = false;  // is left and/or right player dragging the mouse?

const scoresIdsLft = ['left-0', 'left-1', 'left-2', 'left-3', 'left-4', 'left-5', 'left-6', 'left-7', 'left-8', 'left-9', 'left-10', 'left-11'];  // game scores on farm house
const scoresIdsRgt = ['right-0', 'right-1', 'right-2', 'right-3', 'right-4', 'right-5', 'right-6', 'right-7', 'right-8', 'right-9', 'right-10', 'right-11'];
const scoreMax = 11;
let scoreLft = 0, scoreRgt = 0;

const instructionsId = 'instructions';  // instructions on farm house

const controlLftId = 'control-left'; // controls include both gate and circle behind it
const controlRgtId = 'control-right';
const controlLftCirc = 'circle-left'; // control "circle"
const controlRgtCirc = 'circle-right';
const controlGateLftId = 'gate-left';
let controlLftBB, controlRgtBB; // bounding boxes at their initial positions, not corrected for their current position
let controlH2;  // control height/2
let controlGateW; // width of gate only (for hit detection -> short sides of gate)
const controlSpeedYMaxNorm = pigSpeedXMin * 0.90, // 0<@, max. vertical speed during normal playing (full length playing field), in SVG units per millisecond
      controlSpeedYMaxServ = 2.6 * controlSpeedYMaxNorm; // controlSpeedYMaxNorm < @, as above, but for when serve is toward computer player (only half the length of the playing field)
let controlSpeedYMaxCurr = controlSpeedYMaxServ; // 0<@, current max. vertical speed of computer player control
let controlYRnd = 0.0; // -controlH2 <= @<= +controlH2, random delta-Y for hitting the control by computer player
let controlLftYIni, controlRgtYIni;
let controlLftYCur, controlRgtYCur;
let controlLftTranslate, controlRgtTranslate;

// playfield limit values to be set in init phase
const playfieldId = 'playfield';
let playfieldLft, playfieldRgt, playfieldTop, playfieldBot, playfieldMidX;

// cooling phase
const coolingDuration = 3000.0; // in milliseconds
let coolingTimestamp = 0.0; // dummy for now

// game audio
const audioContext = new (window.AudioContext || window.webkitAudioContext)();  // use HTML5 audio
const audioGameTuneId = 'game-tune', audioPigHit1Id = 'sound-pig-hit-1', audioPigHit2Id = 'sound-pig-hit-2', audioPigServeId = 'sound-pig-serve', audioCheerId = 'sound-cheer';
let audioGameTune, audioGameTuneSource; // HTML5 audio needed for gapless loop on all major platforms
let audioPigHit1, audioPigHit2;
let audioPigServe, audioCheer;

// initialize for start phase
function initialize() {
  // 'all' SVG element
  allElem = document.getElementById(allId);

  // left/right boundaries
  const allBB = allElem.getBBox();
  allLft = allBB.x;
  allRgt = allBB.x + allBB.width;

  // hide playfield
  document.getElementById(playfieldId).setAttribute('visibility', 'hidden');
  
  // hide creek animation states all-but-the-first
  document.getElementById(creekWavesIds[0]).setAttribute('visibility', 'visible');
  for (let i = 1; i < creekWavesIds.length; i++)
    document.getElementById(creekWavesIds[i]).setAttribute('visibility', 'hidden');

  window.requestAnimationFrame(creekWavesAdvance);

  // large pig smile/smirk toggle
  setInterval(pigStartTimeout, pigStartSmirkDuration);

  // animate control circles
  document.getElementById(controlLftCirc).classList.add('circle-left-pulsating');
  document.getElementById(controlRgtCirc).classList.add('circle-right-pulsating');

  // set playfield limit values
  const playfieldBB = document.getElementById(playfieldId).getBBox();
  playfieldLft = playfieldBB.x;
  playfieldRgt = playfieldBB.x + playfieldBB.width;
  playfieldTop = playfieldBB.y;
  playfieldBot = playfieldBB.y + playfieldBB.height;
  playfieldMidX = playfieldBB.x + playfieldBB.width/2;

  // set controls initial values
  let controlLftElem = document.getElementById(controlLftId),
      controlRgtElem = document.getElementById(controlRgtId),
      controlGateLftBB = document.getElementById(controlGateLftId).getBBox();
  controlLftBB = controlLftElem.getBBox();
  controlRgtBB = controlRgtElem.getBBox();
  controlH2 = controlLftBB.height/2;
  controlGateW = controlGateLftBB.width;
  controlLftYIni = controlLftBB.y + controlH2;
  controlRgtYIni = controlRgtBB.y + controlH2;
  controlLftTranslate = allElem.createSVGTransform(); controlLftTranslate.setTranslate(0, 0);
  controlRgtTranslate = allElem.createSVGTransform(); controlRgtTranslate.setTranslate(0, 0);
  controlLftElem.transform.baseVal.insertItemBefore(controlLftTranslate, 0);  // as first transform
  controlRgtElem.transform.baseVal.insertItemBefore(controlRgtTranslate, 0);

  // set pig initial values
  const pigBB = document.getElementById(pigNormalTightBBId).getBBox();
  pigR = pigBB.height/2;
  pigXIni = pigBB.x + pigR;
  pigYIni = pigBB.y + pigR;

  let pigElem = document.getElementById(pigNormalId);
  pigTranslate = allElem.createSVGTransform(); pigTranslate.setTranslate(0, 0);
  pigRotate = allElem.createSVGTransform(); pigRotate.setRotate(0, 0, 0);
  pigScale = allElem.createSVGTransform(); pigScale.setScale(1, 1);
  pigElem.transform.baseVal.insertItemBefore(pigScale, 0);
  pigElem.transform.baseVal.insertItemBefore(pigRotate, 0);
  pigElem.transform.baseVal.insertItemBefore(pigTranslate, 0);

  // audio
  audioGameTune = document.getElementById(audioGameTuneId); // game tune loop
  audioGameTune.loop = true;
  audioGameTune.volume = 0.5;
  audioGameTuneSource = audioContext.createMediaElementSource(audioGameTune);
  audioGameTuneSource.connect(audioContext.destination);
  audioPigServe = document.getElementById(audioPigServeId); // sound when pig is served
  audioPigHit1 = document.getElementById(audioPigHit1Id); // sound when pig hits control
  audioPigHit2 = document.getElementById(audioPigHit2Id);
  audioCheer = document.getElementById(audioCheerId); // after final (end)score is reached, only when human player wins

  // set mouse handlers
  document.getElementById(allId).addEventListener('mousedown', mouseDown);
  document.getElementById(allId).addEventListener('mouseup', mouseUp);
  document.getElementById(allId).addEventListener('mousemove', mouseMove);

  // set touch handlers
  document.getElementById(allId).addEventListener('touchstart', touchStart);
  document.getElementById(allId).addEventListener('touchend', touchEnd);
  document.getElementById(allId).addEventListener('touchmove', touchMove);

  // start game animation
  window.requestAnimationFrame(gameAdvance);

  startWaiting();
}

// creek animation
function creekWavesAdvance(timestamp) {
  // ready for next wave?
  if (creekWavesInterval <= timestamp-creekWavesUpdateLast) {
    // hide current wave
    document.getElementById(creekWavesIds[creekWaveCurrent]).setAttribute('visibility', 'hidden');

    // show next wave
    creekWavesUpdateLast = timestamp;
    creekWaveCurrent = (creekWaveCurrent + 1) % creekWavesIds.length;
    document.getElementById(creekWavesIds[creekWaveCurrent]).setAttribute('visibility', 'visible');  
  }

  window.requestAnimationFrame(creekWavesAdvance);
}

// large pig smile/smirk toggle
function pigStartTimeout() {
  if (phase !== PHASE.waiting)
    return;

  pigStartCountdown--;
  if (pigStartCountdown === 0) {
    document.getElementById(pigStartSmileId).setAttribute('visibility', 'hidden');
    document.getElementById(pigStartSmirkId).setAttribute('visibility', 'visible');
  } else if (pigStartCountdown < 0) {
    document.getElementById(pigStartSmileId).setAttribute('visibility', 'visible');
    document.getElementById(pigStartSmirkId).setAttribute('visibility', 'hidden');
    pigStartCountdown = pigStartCountdownMin + Math.round(Math.random() * (pigStartCountdownMax - pigStartCountdownMin));
  }
}

// core game animation
function gameAdvance(timestamp) {
  switch (phase) {
    case PHASE.startup: startupAdvance(timestamp); break;
    case PHASE.playing: playingAdvance(timestamp); break;
    case PHASE.cooling: coolingAdvance(timestamp); break;
  }

 window.requestAnimationFrame(gameAdvance);
}

function startupAdvance(timestamp) {
  const elapsed = timestamp - startupTimestamp;

  // update pig animation
  if (0 <= elapsed && elapsed <= startupDuration) {
    const h = 0.5 * startupDuration, // half duration, 0<@
          u = elapsed <= h ? elapsed : startupDuration-elapsed, // elapsed time relative to half duration, 0<=@<h
          f = u / h,  // fraction of elapsed time relative to half duration, 0<=@<1
          g = Math.sin(f * (Math.PI / 2)),  // smoothened, 0<=@<1
          s = pigScaleMin + g*(pigScaleMax-pigScaleMin);  // scale, pigScaleMin<=@<=pigScaleMax

    // scale relative to origin of pig
    let mtx = allElem.createSVGMatrix();
    mtx.a = s; mtx.b = 0; 
    mtx.c = 0; mtx.d = s;
    mtx.e = -pigXCur * (s - 1.0); // scale corrected delta-x
    mtx.f = -pigYCur * (s - 1.0); // as above, but for delta-y
    pigScale.setMatrix(mtx);
  }

  // done with startup?
  if (startupDuration < elapsed) {
    // reset scale
    pigScale.setScale(1.0, 1.0);

    // can no longer add another player
    document.getElementById(controlLftCirc).classList.remove('circle-left-pulsating');
    document.getElementById(controlRgtCirc).classList.remove('circle-right-pulsating');

    // serve to human player
    const lftToRgt = (playerLft&&playerRgt) ? (Math.random()<0.5) : playerRgt;
    serve(lftToRgt, timestamp);

    // initial frame time stamp and start of next phase
    frameTimestamp = timestamp;
    phase = PHASE.playing;
  }
}

function playingAdvance(timestamp) {
  const elapsed = timestamp - frameTimestamp;
  if (elapsed <= 0.0)
    return;

  // last frame
  frameTimestamp = timestamp;

  // update computer player, if any
  if (!playerLft || !playerRgt) {
    const isLft = !playerLft;
    const controlYCur = isLft ? controlLftYCur : controlRgtYCur, 
          controlDTry = (pigYCur - (controlYCur + controlYRnd)),
          controlDMax = elapsed * controlSpeedYMaxCurr, // 0<=@, max. (abs) delta-Y (in SVG units)
          controlDLim = Math.abs(controlDTry) < controlDMax ? controlDTry : (0.0 <= controlDTry ? +controlDMax : -controlDMax); // speed limited delta-Y

    // preferred new Y position of control (unclamped)
    const controlYNew = controlYCur + controlDLim;

    // clamp to valid range
    const controlYTop = playfieldTop + controlH2, 
          controlYBot = playfieldBot - controlH2,
          controlYLim = Math.max( Math.min(controlYNew,controlYBot), controlYTop ) ;
    
    // update position of computer control
    if (isLft) {
      controlLftYCur = controlYLim;
      controlLftTranslate.setTranslate(0, controlLftYCur - controlLftYIni);
    } else {
      controlRgtYCur = controlYLim;
      controlRgtTranslate.setTranslate(0, controlRgtYCur - controlRgtYIni);
    }
  }

  // save pig position
  const pigXOld = pigXCur, pigYOld = pigYCur;

  // was pig inside play field?
  const pigInField = playfieldLft < (pigXCur-pigR) && (pigXCur+pigR) < playfieldRgt;

  // update pig position
  const pigXDif = elapsed * pigSpeedXCur,
        pigYDif = pigXDif * pigTangentCur;
  pigXCur += pigXDif * pigDirectionX;
  pigYCur += pigYDif;

  // bounce at top or bottom?
  let pigTop = pigYCur - pigR, pigBot = pigYCur + pigR;
  const hitTop = pigTop < playfieldTop, hitBot = playfieldBot < pigBot;
  if (hitTop || hitBot) {
    const bounceY = 2 * (hitTop ? playfieldTop - pigTop : playfieldBot - pigBot);
    pigYCur += bounceY;
    pigTop = pigYCur - pigR; pigBot = pigYCur + pigR;
    pigTangentCur = -pigTangentCur;
  }

  // update pig rotation
  const pigDDif = Math.sqrt(pigXDif*pigXDif + pigYDif*pigYDif), // travel distance (in SVG units)
        pigADif = (pigDDif / pigRotateDist) * 360;  // rotation delta angle (in degrees)
  pigACur += (0.0<=pigTangentCur ? +pigADif : -pigADif);

  // pig outside playfield?
  const pigLft = pigXCur - pigR, pigRgt = pigXCur + pigR;
  const outLft = pigLft <= playfieldLft, outRgt = playfieldRgt <= pigRgt;
  if (outLft || outRgt) {
    // hit control?
    const controlYCur = outLft ? controlLftYCur : controlRgtYCur;
    const controlTop = controlYCur - controlH2, controlBot = controlYCur + controlH2;
    if (pigInField && controlTop<=pigBot && pigTop<=controlBot) {
      // no bounce-off control (simply clip to range)
      pigXCur = outLft ? playfieldLft + pigR : playfieldRgt - pigR;

      // reverse direction and speed up
      pigDirectionX *= -1;
      pigSpeedXCur = Math.min(pigSpeedXCur*pigSpeedXHit, pigSpeedXMax);

      // change angle depending on hit position (reward taking risk)
      const t = Math.abs(pigYCur - controlYCur) / (controlH2 + pigR); // 0<=@<=1, interpolation fraction
      const pigTangentScale = pigTangentScaleMin + t * (pigTangentScaleMax - pigTangentScaleMin);
      const pigTangentBump  = pigTangentBumpMin + Math.random() * (pigTangentBumpMax - pigTangentBumpMin); // pigTangentBumpMin<=@<pigTangentBumpMax
      pigTangentCur = pigTangentCur * pigTangentScale + pigTangentBump;
      pigTangentCur = Math.min( Math.max(pigTangentCur, pigTangentMin), pigTangentMax ); // clamp to valid range

      // set max. speed of computer player control
      // and compute next random offset at control of computer player, if any
      controlSpeedYMaxCurr = controlSpeedYMaxNorm;
      controlYRnd = -controlH2 + Math.random() * (controlH2*2); // -controlH2 <= @ < +controlH2

      // play pig hit sound 1 or 2 
      const audioPigHit = Math.random() < 0.85 ? audioPigHit1 : audioPigHit2;
      audioPigHit.play();
    } else { 
      // might have hit the top or bottom of the control gate
      // note: code below does not deal with moving the control gate over the pig (could be done in control movement handler)
      const controlGateLft = outLft ? playfieldLft - controlGateW : playfieldRgt, 
            controlGateRgt = controlGateLft + controlGateW;
      const controlGateStraddle = 0 < pigDirectionX ? (pigXOld - pigR) < controlGateRgt : controlGateLft < (pigXOld + pigR); // pig straddles control gate?
      if (controlGateStraddle && (((pigYOld+pigR)<controlTop && controlTop<pigBot) || (controlBot<(pigYOld-pigR) && pigTop<controlBot))) {
        pigYCur = 0.0 < pigTangentCur ? controlTop - pigR : controlBot + pigR;
        pigTangentCur = -pigTangentCur;
      }
    }
  } 

  // left full field?
  if (pigRgt<allLft || allRgt<pigLft) {
    // update score
    bumpScore(outRgt);

    // end of game?
    if (scoreLft === scoreMax || scoreRgt === scoreMax) {
      // stop game tune
      audioGameTune.pause();
      audioGameTune.currentTime = 0;

      // hide pig
      document.getElementById(pigNormalId).setAttribute('visibility', 'hidden');

      // play win cheer if human player wins
      const winLft = scoreLft === scoreMax;
      if (winLft ? playerLft : playerRgt)
        audioCheer.play();

      // animate winning score
      if (winLft)
        document.getElementById(scoresIdsLft[scoreMax]).classList.add('winLeft');
      else
        document.getElementById(scoresIdsRgt[scoreMax]).classList.add('winRight');

      // next phase
      coolingTimestamp = timestamp;
      phase = PHASE.cooling;
      return;
    }

    // serve
    serve(outRgt);
  }

  pigRotate.setRotate(pigACur, pigXIni, pigYIni);
  pigTranslate.setTranslate(pigXCur - pigXIni, pigYCur - pigYIni);
}

function coolingAdvance(timestamp) {
  const elapsed = timestamp - coolingTimestamp;

  // done with cooling?
  if (coolingDuration <= elapsed) {
    // remove animated winning score
    document.getElementById(scoresIdsLft[scoreMax]).classList.remove('winLeft');
    document.getElementById(scoresIdsRgt[scoreMax]).classList.remove('winRight');

    // show instructions
    document.getElementById(instructionsId).setAttribute('visibility', 'visible');

    // next phase
    startWaiting();
  }
}

// check bounding box containment
function withinBBox(bBox, x, y) {
  const left = bBox.x, right = bBox.x + bBox.width, top = bBox.y, bottom = bBox.y + bBox.height;
  
  return !(x < left || right < x || y < top || bottom < y);
}

function newSVGPoint(x, y) { 
  let p = allElem.createSVGPoint();
  p.x = x;
  p.y = y;
  return p;
}

// mapping device to SVG space
function svgPosition(devX, devY) {
  const devpos = newSVGPoint(devX, devY);
  return devpos.matrixTransform(allElem.getScreenCTM().inverse());
}

// INTERACTION HANDLERS

function handleDown(devX, devY) { 
  const svgPos = svgPosition(devX,devY);
  const controlLftClicked = withinBBox(controlLftBB, svgPos.x, svgPos.y + (controlLftYIni - controlLftYCur)), // test against initial bounding box position, so need correction
        controlRgtClicked = withinBBox(controlRgtBB, svgPos.x, svgPos.y + (controlRgtYIni - controlRgtYCur)); // as above

  // dragging flags
  isDraggingLft = isDraggingLft || controlLftClicked;
  isDraggingRgt = isDraggingRgt || controlRgtClicked;

  // waiting or startup?
  if (phase === PHASE.waiting || phase === PHASE.startup) {
    if (!playerLft && controlLftClicked) {
      playerLft = true;
      document.getElementById(controlLftCirc).classList.remove('circle-left-pulsating');
    } else if (!playerRgt && controlRgtClicked) {
      playerRgt = true;
      document.getElementById(controlRgtCirc).classList.remove('circle-right-pulsating');
    }

    // need to move from waiting -> startup?
    if (phase === PHASE.waiting && (playerLft || playerRgt)) {
      // remove instructions 
      document.getElementById(instructionsId).setAttribute('visibility', 'hidden');

      // show scoreboard
      document.getElementById(scoresIdsLft[scoreLft]).setAttribute('visibility', 'visible');
      document.getElementById(scoresIdsRgt[scoreRgt]).setAttribute('visibility', 'visible');

      // play game tune
      // audio context is suspended prior to user interaction (in some browsers);
      // resume audio context within interaction handling
      audioContext.resume();
      audioGameTune.play();

      // next phase
      pigACur = 0.0;
      pigRotate.setRotate(pigACur, pigXIni, pigYIni);
      pigXCur = pigXIni; pigYCur = pigYIni;
      pigTranslate.setTranslate(pigXCur-pigXIni, pigYCur-pigYIni);
      document.getElementById(pigStartId).setAttribute('visibility', 'hidden');
      document.getElementById(pigStartSmileId).setAttribute('visibility', 'hidden');
      document.getElementById(pigStartSmirkId).setAttribute('visibility', 'hidden');
      document.getElementById(pigNormalId).setAttribute('visibility', 'visible');
      startupTimestamp = performance.now();
      phase = PHASE.startup;
    }
  }
}

function handleUp(devX, devY) {
  const svgPos = svgPosition(devX, devY);
  if (svgPos.x < playfieldMidX)
    isDraggingLft = false;
  else
    isDraggingRgt = false;
}

function handleMove(devX, devY) {
  const svgPos = svgPosition(devX, devY);

  // startup or playing?
  if (phase === PHASE.startup || phase === PHASE.playing) {
    const isLft = svgPos.x < playfieldMidX;
    if (!( isLft ? playerLft && isDraggingLft : playerRgt && isDraggingRgt ))
      return;

    let yNew = svgPos.y;
    // clamp to valid range
    const yTop = playfieldTop + controlH2, yBot = playfieldBot - controlH2;
    if (yNew < yTop)
      yNew = yTop;
    else if (yBot < yNew)
      yNew = yBot;

    const yIni = isLft ? controlLftYIni : controlRgtYIni;
    if (isLft)
      controlLftYCur = yNew;
    else
      controlRgtYCur = yNew;
    let controlTransform = isLft ? controlLftTranslate : controlRgtTranslate;
    controlTransform.setTranslate(0, yNew - yIni);
  }
}

// MOUSE HANDLERS

function mouseDown(e) {
  handleDown(e.clientX, e.clientY);
  e.preventDefault();
  return false;
}

function mouseUp(e) {
  handleUp(e.clientX, e.clientY);
  e.preventDefault();
  return false;
}

function mouseMove(e) {
  handleMove(e.clientX, e.clientY);
  e.preventDefault();
  return false;
}

// TOUCH HANDLERS

function touchStart(e) {
  if (0 < e.targetTouches.length) {
    const touch = e.targetTouches[0];
    handleDown(touch.clientX, touch.clientY);
  }
  e.preventDefault();
  return false;
}

function touchEnd(e) {
  if (0 < e.targetTouches.length) {
    const touch = e.targetTouches[0];
    handleUp(touch.clientX, touch.clientY);
  }
  e.preventDefault();
  return false;
}

function touchMove(e) {
  const touch = e.targetTouches[0];
  handleMove(touch.clientX, touch.clientY);
  e.preventDefault();
  return false;
}

function bumpScore(lft) {
  const scoreOld  = lft ? scoreLft : scoreRgt;
  const scoresIds = lft ? scoresIdsLft : scoresIdsRgt;
  if ((scoreOld + 1) < scoresIds.length) {
    document.getElementById(scoresIds[scoreOld  ]).setAttribute('visibility', 'hidden');
    document.getElementById(scoresIds[scoreOld+1]).setAttribute('visibility', 'visible');
    if(lft)
      scoreLft++;
    else
      scoreRgt++;
  }
}

// serve the pig
function serve(lftToRgt) {
  // horizontal direction
  pigDirectionX = lftToRgt ? +1 : -1;

  // start at lowest speed
  pigSpeedXCur = pigSpeedXMin;

  // vertical direction (as tangent to horizontal direction)
  pigTangentCur = pigTangentMin + Math.random()*(pigTangentMax-pigTangentMin); // pigTangentMin<=@<pigTangentMax

  // starting angle
  pigACur = 0.0;
  pigRotate.setRotate(pigACur, pigXIni, pigYIni);

  // starting position (start at middle line, but keep the last vertical position)
  pigXCur = pigXIni;
  pigTranslate.setTranslate(pigXIni-pigXCur, pigYIni-pigYCur);

  // if serving toward computer player, bump its max. speed as it has only half the playing field length to respond
  const towardComputer = 0.0 < pigDirectionX ? !playerRgt : !playerLft;
  controlSpeedYMaxCurr = towardComputer ? controlSpeedYMaxServ : controlSpeedYMaxNorm;

  // play pig serve sound
  audioPigServe.play();
}

// start waiting phase
function startWaiting() {
  // hide scores
  for (const id of scoresIdsLft)
    document.getElementById(id).setAttribute('visibility', 'hidden');  
  for (const id of scoresIdsRgt)
    document.getElementById(id).setAttribute('visibility', 'hidden');

  // hide playing pig and show large pig
  document.getElementById(pigNormalId).setAttribute('visibility', 'hidden');
  document.getElementById(pigStartId).setAttribute('visibility', 'visible'); 
  pigStartCountdown = 0;
  document.getElementById(pigStartSmileId).setAttribute('visibility', 'visible');
  document.getElementById(pigStartSmirkId).setAttribute('visibility', 'hidden');

  // reset controls to initial position
  controlLftYCur = controlLftYIni;
  controlRgtYCur = controlRgtYIni;
  controlLftTranslate.setTranslate(0, controlLftYCur - controlLftYIni);
  controlRgtTranslate.setTranslate(0, controlRgtYCur - controlRgtYIni);

  // animate control circles
  document.getElementById(controlLftCirc).classList.add('circle-left-pulsating');
  document.getElementById(controlRgtCirc).classList.add('circle-right-pulsating');

  // reset pig coordinates to initial position
  pigXCur = pigXIni;
  pigYCur = pigYIni;
  pigTranslate.setTranslate(pigXCur - pigXIni, pigYCur - pigYIni);

  // reset pig rotation
  pigRotate.setRotate(0.0, pigXIni, pigYIni);

  // reset scores and player(s)
  playerLft = false;
  playerRgt = false;
  scoreLft = 0;
  scoreRgt = 0;

  phase = PHASE.waiting;
}