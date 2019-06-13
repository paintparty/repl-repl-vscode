const util = require('./util');
const vscode = require('vscode');

function reTestOpeningBracket(char) {
  return /\(|\[|\{/.test(char);
}

function reTestClosingBracket(char) {
  return /\)|\]|\}/.test(char);
}

function charAtIndex(idx, buffText) {
  return buffText.substring(idx, idx + 1);
}

function findClosingBraceIdx(startIdx, state) {
  let closingChars = {
    "(": ")",
    "{": "}",
    "[": "]"
  };
  let allBraces = ["(", ")", "{", "}", "[", "]"];
  let openingBraceChar = util.charAtIdx(state, startIdx);
  let stack = [openingBraceChar];
  let cur, i, targetOpeningBrace;
  for (i = startIdx + 1; i < state.endOffset; i++) {
    cur = util.charAtIdx(state, i);
    if (!state.blackListedPos[i]) {
      targetOpeningBrace = stack[stack.length - 1];
      if (cur === closingChars[targetOpeningBrace]) {
        stack.pop();
      } else if ((allBraces.indexOf(cur) > -1)) {
        stack.push(cur);
      }
    }
    if (stack.length === 0) {
      break;
    }
  }
  return i;
}

function indexForms(i, state) {
  let char = charAtIndex(i, state.buffText);
  let skip = state.blackListedPos[i];
  if (!skip) {
    if (reTestOpeningBracket(char)) {
      state.curDepthIdx.push(i);
    }
  }
  state.allPos[i] = state.curDepthIdx.map(function (v) {
    return v
  });
  if (!skip) {
    if (reTestClosingBracket(char)) {
      state.curDepthIdx.pop();
    }
  }
}

function idxIsInForm(state, idx) {
  return state.allPos[idx].length;
}

function stepFwdCondition(state, counter, formOffset) {
  let formStartsArray = state.allPos[counter];
  if (Array.isArray(formStartsArray)) {
    return formStartsArray[0] === formOffset;
  } else {
    return false;
  }
}

function rangeOuterForm(state) {
  let point = state.isPointFollowingForm || state.isPointFollowingExpression ?
    state.ogPointIdx - 1 :
    state.ogPointIdx;
  let formStartsArray = state.allPos[point];
  let depth = formStartsArray.length;
  if (!depth) {
    return;
  }

  if (depth === 1 && state.rangeCurrentForm) {
    return state.rangeCurrentForm;
  }

  let formOffset = formStartsArray[0];
  let counter = formStartsArray[0];

  const stepFwd = function stepFwd() {
    counter++;
  }
  while (stepFwdCondition(state, counter, formOffset)) {
    stepFwd();
  }

  return {
    start: util.posForIdx(state, formOffset),
    end: util.posForIdx(state, counter)
  };
}

function endOfFormCondition(state, counter, depth) {
  let formStartsArray = state.allPos[counter];
  if (!Array.isArray(formStartsArray)) {
    return false;
  }
  let bools;
  try {
    bools = formStartsArray.length > (depth - 1);
  } catch (error) {
    //console.log("endOfFormCondition", error);
  }

  return bools;
}


function rangeCurrentForm(state, checkPreceding) {
  let point = checkPreceding ? state.ogPointIdx - 1 : state.ogPointIdx
  let formStartsArray = state.allPos[point];

  let depth = formStartsArray.length;
  if (!depth) {
    return;
  }

  let formOffset = formStartsArray[depth - 1];
  let counter = point;

  while (endOfFormCondition(state, counter, depth)) {
    counter++;
  }
  return {
    start: util.posForIdx(state, formOffset),
    end: util.posForIdx(state, counter)
  };
}


function blackListRange(range, state, blackListedRangeIdx) {
  let rangeArr = util.numRange(range.start, range.end, true);
  rangeArr.forEach(function (idx) {
    state.blackListedPos[idx] = blackListedRangeIdx;
  });
}

function isRangeStartBlackListed(range, state) {
  return state.blackListedPos[range.start];
}


function blackListRangeByType(state, range, type, rangeFn) {
  if (!isRangeStartBlackListed(range, state)) {
    let idxRange = rangeFn ? rangeFn(range, state) : range;
    let pointRange = util.toPointRange(state, idxRange);
    let updatedIdxRange = util.toIdxRange(state, pointRange);
    state.blackListedRangesByIdx.push({
      type: type,
      range: pointRange
    });

    blackListRange(updatedIdxRange, state, state.blackListedRangesByIdx.length - 1);
  }
}

function findIgnoredFormOrMetaMapRange(range, state) {
  const openingBraceIdx = range.end - 1;
  const closingBraceIdx = findClosingBraceIdx(openingBraceIdx, state);
  const ignoredFormRange = {
    start: range.start,
    end: closingBraceIdx + 1
  };
  return ignoredFormRange;
}

function addCharsForHashSet(text, formOffset, state) {
  if (/^\{/.test(text)) {
    if (util.charAtIdx(state, formOffset - 1) === "#") {
      return "#" + text;
    }
  }
}

function addCharsForReaderConds(text, formOffset, state) {
  if (/^\(/.test(text)) {
    let hasPound = util.charAtIdx(state, formOffset - 2) === "#";
    let hasQuestionMark = util.charAtIdx(state, formOffset - 1) === "?";
    if (hasPound && hasQuestionMark) {
      return "#?" + text;
    }
  }
}

function prependSpecialChars(state, rangeProp) {
  let range = state[rangeProp];
  if (!range) {
    return null;
  }

  let text = util.getTextInPointRange(state, range);
  let formOffset = util.idxForPos(state, range.start);
  return addCharsForHashSet(text, formOffset, state) || addCharsForReaderConds(text, formOffset, state) || text
}


function setJsComment(state) {

  let textInRange = util.getTextInPointRange(state, state.rangeOuterForm);
  let m = /^\(comment\s+\:js\s+([\s\S]+)/gm.exec(textInRange);
  if (m) {
    let startOffset = textInRange.indexOf(m[1]);
    let startIdx = util.idxForPos(state, state.rangeCurrentForm.start) + startOffset;
    let endIdx = util.idxForPos(state, state.rangeCurrentForm.end);
    state.jsCommentEvalRange = util.toPointRange(state, {
      start: startIdx,
      end: endIdx
    });
    state.jsComment = m[1].slice(0, -1);
    state.jsCommentSelectedText = state.selectedText;
    state.isJsComment = true;
    state.isNotJsComment = false;
  } else {
    state.jsComment = null;
    state.isJsComment = false;
    state.isNotJsComment = true;
  }
  return m;
}

function bufferScan(state, type, rangeFn) {
  const reByType = {
    "string": /\#"([^"]|\\")*"|"([^\\"]|\\\\|\\")*"/gm,
    "comment": /;.*/g,
    "ignoredForm": /\#_\(|\#_\[|\#_\{/gm,
    "metaMap": /\#\^{/g
  }
  const re = reByType[type];
  let m;
  while (m = re.exec(state.buffText)) {
    blackListRangeByType(state, {
      start: m.index,
      end: re.lastIndex
    }, type, rangeFn);
  }
}

function setupBlackListProps(state) {
  state.blackListedOffsets = Object.create(null);
  state.blackListedPos = new Array();
  state.blackListedPos.length = state.endOffset;
  state.allPos = new Array();
  state.allPos.length = state.endOffset;
  state.blackListedRangesByIdx = [{}];
  state.curDepthIdx = new Array();
}

function blackListAndIndexForms(state) {
  setupBlackListProps(state);

  // blacklist regex literal ranges or string ranges
  bufferScan(state, "string");

  // blacklist cljs comment ranges
  bufferScan(state, "comment");

  // blacklist cljs ignored forms
  bufferScan(state, "ignoredForm", findIgnoredFormOrMetaMapRange);

  // blacklist cljs metadata maps
  bufferScan(state, "metaMap", findIgnoredFormOrMetaMapRange);

  // index forms
  let i = 0;
  for (i; i < state.endOffset; i++) {
    indexForms(i, state);
  }

  // get blacklist range object
  state.blackListedRangeIdx = state.blackListedPos[state.ogPointIdx];
  state.blackListedRange = state.blackListedRangesByIdx[state.blackListedRangeIdx];

  if (state.blackListedRange) {
    state.isBlacklisted = true;
    state.isCommentRange = state.blackListedRange.type === "comment";
    state.isIgnoredFormRange = state.blackListedRange.type === "ignoredForm";
    state.isStringRange = state.blackListedRange.type === "string";
  }
}


function charExistsAtIdx(state, idx) {
  let char = state.buffText.substring(idx, idx + 1);
  let isValid = /[^\s\n]/.test(char);
  return isValid;
}


// Evaluate an expression inside form (var, symbol, keyword, number, etc.)
function evalExpressionInsideForm(state) {
  let point = state.isPointFollowingExpression ? state.ogPointIdx - 1 : state.ogPointIdx;
  let formContents = state.textCurrentForm.substr(1).slice(0, -1);
  let rangeStartIndex = util.idxForPos(state, state.rangeCurrentForm.start);
  let rangeContentsStartIndex = rangeStartIndex + 1;
  let re = /\#"([^"]|\\")*"|"([^\\"]|\\\\|\\")*"|([^\s\"]+)/gm;
  let expObj = util.expressionAtIdx(
    formContents,
    re,
    point,
    rangeContentsStartIndex
  );

  if (expObj) {
    let start = util.posForIdx(state, expObj.startIdx);
    let end = util.posForIdx(state, expObj.endIdx);
    state.isPointOnExpression = true;
    state.rangeCurrentExpression = {
      start: start,
      end: end
    };
    state.textCurrentExpression = expObj.matchedString;
  }
}

// Evaluate an expression outside form (var, symbol, keyword, number, etc.)
function evalExpressionOutsideForm(state) {
  let point = state.isPointFollowingExpression ? state.ogPointIdx - 1 : state.ogPointIdx;
  if (state.isStringRange) {
    state.rangeCurrentExpression = state.blackListedRange.range;
    state.textCurrentExpression = util.getTextInPointRange(state, state.rangeCurrentExpression);
    return;
  }
  let idxEnd = point;
  let idxStart = point;

  if (charExistsAtIdx(state, point)) {
    idxEnd++;
    idxStart--;
    while (!idxIsInForm(state, idxEnd) && charExistsAtIdx(state, idxEnd)) {
      idxEnd++;
    }
    while (!idxIsInForm(state, idxStart) && charExistsAtIdx(state, idxStart)) {
      idxStart--;
    }
    idxStart++;
    state.isPointOnExpression = true;
    state.rangeCurrentExpression = util.toPointRange(state, {
      start: idxStart,
      end: idxEnd
    });
    state.textCurrentExpression = util.getTextInPointRange(state, state.rangeCurrentExpression);
  }
}

// Evaluate an expression inside a form (string, var, symbol, keyword, number, etc.)
function addExpressionRange(state) {
  if (state.isJs) {
    return;
  }
  if (state.isJsComment || state.isCommentRange || state.isIgnoredFormRange) {
    state.isPointNotOnExpression = false;
    state.rangeCurrentExpression = null;
    return;
  }

  if (state.isInsideForm) {
    evalExpressionInsideForm(state);
  }

  if (state.isOutsideForm) {
    evalExpressionOutsideForm(state);
  }
}

function outsideForm(state) {
  if (state.blackListedRangeIdx) {
    if (state.blackListedRange.type === "string") {
      state.rangeCurrentExpression = state.blackListedRange.range;
      state.textCurrentExpression = util.getTextInPointRange(state, state.rangeCurrentExpression);
    }
  } else {
    state.isNotBlacklisted = true;
  }
}

function insideForm(state) {
  state.rangeOuterForm = rangeOuterForm(state)
  state.isInsideFn = isInsideFn(state);
  setJsComment(state);
  state.textCurrentForm = prependSpecialChars(state, "rangeCurrentForm");
  state.textOuterForm = (state.rangeCurrentForm === state.rangeOuterForm) ?
    state.textCurrentForm :
    prependSpecialChars(state, "rangeOuterForm");
  state.textOuterForm = util.getTextInPointRange(state, state.rangeOuterForm);
}


function isPointFollowingExpression(state) {
  if (state.ogPointIdx === 0) {
    return null;
  }
  let cc = state.buffText.substring(state.ogPointIdx, state.ogPointIdx + 1);
  let pc = state.buffText.substring(state.ogPointIdx - 1, state.ogPointIdx);
  let blackListedRangeIdx = state.blackListedPos[state.ogPointIdx];
  let blackListedRangeObj = state.blackListedRangesByIdx[blackListedRangeIdx];
  //console.log("blackListedRangeObj", blackListedRangeObj);
  let isWithinString = (blackListedRangeObj && blackListedRangeObj.type === "string");
  let ccIsClosing = (cc === ")" || cc === "]" || cc === "}");
  let ccIsCR = (cc === "↵" || cc === "\n" || cc === "\r" || cc === "\r\n");
  let ccIsBlank = cc === " ";
  let pcIsClosing = (pc === ")" || pc === "]" || pc === "}");
  let pcIsBlankOrClosing = (pc === " " || pcIsClosing);

  return (!isWithinString && (ccIsBlank || ccIsClosing || ccIsCR) && !pcIsBlankOrClosing) ?
    true : null;
}


function isPointFollowingForm(state) {
  if (state.ogPointIdx === 0) {
    return null;
  }
  let formStartsArray = state.allPos[state.ogPointIdx - 1];
  //console.log("isPointFollowingForm,  formStartsArray => ", formStartsArray);
  let depth = formStartsArray.length;

  if (!depth) {
    return null;
  }

  let pc = state.buffText.substring(state.ogPointIdx - 1, state.ogPointIdx);
  let pcIsClosing = (pc === ")" || pc === "]" || pc === "}");

  return pcIsClosing;
}

function isInsideFn(state) {
  const start = state.rangeOuterForm.start;
  const line = start.line;
  const char = start.character;
  const range = new vscode.Range(line, char, line, char + 5);
  const text = util.getTextInPointRange(state, range);
  return text === `(defn`
}

function addFormRange(state) {
  if (state.isJs) {
    return;
  }

  // add blacklisting info to state
  blackListAndIndexForms(state);

  // add range info to state
  state.isPointFollowingForm = isPointFollowingForm(state);
  state.isPointFollowingExpression = isPointFollowingExpression(state);
  state.rangeCurrentForm = rangeCurrentForm(state, state.isPointFollowingForm);
  state.isInsideForm = state.rangeCurrentForm ? true : false;
  state.isOutsideForm = (!state.rangeCurrentForm);

  if (state.isInsideForm) {
    insideForm(state);
  } else {
    outsideForm(state);
  }
}

exports.addExpressionRange = addExpressionRange;
exports.addFormRange = addFormRange;
