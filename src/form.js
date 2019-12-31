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
  //console.log("findClosingBraceIdx...")
  //console.log("stack", stack)
  let cur, i, targetOpeningBrace;
  for (i = startIdx + 1; i < state.endOffset; i++) {
    cur = util.charAtIdx(state, i);
    //console.log("cur", cur)
    if (!state.blackListedPos[i]) {
      targetOpeningBrace = stack[stack.length - 1];
      //console.log("targetOpeningBrace", targetOpeningBrace)
      if (cur === closingChars[targetOpeningBrace]) {
        //console.log("cur === ", closingChars[targetOpeningBrace])
        stack.pop();
        //console.log("stack was popped", stack)
      } else if ((allBraces.indexOf(cur) > -1)) {
        stack.push(cur);
        //console.log("cur is another opening brace, stack was pushed:", stack)
      }
    }
    if (stack.length === 0) {
      //console.log("stack is 0, breaking out and returning", i)
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

function isRangeStartBlackListed(range, state) {
  //console.log("isRangeStartBlackListed")
  //console.log(range.start)
  return state.blackListedPos[range.start];
}

function isRangeStartInLogWrap(range, state) {
  //console.log("isRangeStartInLogWrap")
  //console.log(range.start)
  return state.logWrappedPos[range.start];
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

function flagLogWrapRange(range, state, logWrappedRangeIdx, wrappedValue) {
  // Create a range of idexes that cover the characters to flag
  let rangeArr = util.numRange(range.start, range.end, true);
  rangeArr.forEach(function (idx) {
    state.logWrappedPos[idx] = logWrappedRangeIdx;
  });
}

function findLogWrappedRange(range, state) {
  const openingBraceIdx = range.start;
  const closingBraceIdx = findClosingBraceIdx(openingBraceIdx, state);
  const logWrapRange = {
    start: range.start,
    end: closingBraceIdx + 1
  };
  return logWrapRange;
}

function flagLogWrapped(state, range){
  let idxRange = findLogWrappedRange(range, state);
  console.log("flagLogWrapped", idxRange)
  let pointRange = util.toPointRange(state, idxRange);
  let updatedIdxRange = util.toIdxRange(state, pointRange);
  let wrappedText = util.getTextInPointRange(state, pointRange);
  let re = /\#_\. ([\s\S]*) \#_\.\./gm;
  let m = re.exec(wrappedText);
  let wrappedValue = ( m && m.length > 1 ) ? m[1] : null;

  state.logWrappedRangesByIdx.push({
    range: pointRange,
    wrappedValue: wrappedValue
  });

  flagLogWrapRange(updatedIdxRange, state, state.logWrappedRangesByIdx.length - 1);
}

function blackListRange(range, state, blackListedRangeIdx) {
  // Create a range of idexes that cover the characters to blacklist
  let rangeArr = util.numRange(range.start, range.end, true);
  console.log("rangeArr", rangeArr);
  rangeArr.forEach(function (idx) {
    console.log("blacklisting at blackListedPos[", idx, "] =", blackListedRangeIdx)
    state.blackListedPos[idx] = blackListedRangeIdx;
  });
}

function blackListRangeByType(state, range, type, rangeFn) {
  if (!isRangeStartBlackListed(range, state)) {
    // If a rangeFn is supplied, this will find the end of the range
    let idxRange = rangeFn ? rangeFn(range, state) : range;

    // convert index-based range to point range
    let pointRange = util.toPointRange(state, idxRange);

    // update index range for blacklisting
    let updatedIdxRange = util.toIdxRange(state, pointRange);

    //jconsole.log("blacklisting", type, ": ", util.getTextInPointRange(state, pointRange))

    state.blackListedRangesByIdx.push({
      type: type,
      range: pointRange
    });

    blackListRange(updatedIdxRange, state, state.blackListedRangesByIdx.length - 1);
  }else{
    console.log("Already blacklisted, so NOT blacklisting", type )
  }
}

function bufferScan(state, type, rangeFn) {
  //console.log("scanning buffer by type: ", type)
  const reByType = {
    "string": /\#"([^"]|\\")*"|"([^\\"]|\\\\|\\")*"/gm,
    "comment": /;.*/g,
    "ignoredForm": /\#_\(|\#_\[|\#_\{/gm,
    "logWrap": /(\(#_\?[\s\S]*?\#_..\))/gm,
    //"logWrap": /\(#_\? /gm,
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
  // while (m = re.exec(state.buffText)) {
  //   if (type === "logWrap") {
  //     console.log({start: m.index, end: re.lastIndex})
  //     //flagLogWrapped(state, {start: m.index, end: re.lastIndex});
  //   }else{
  //     blackListRangeByType(state, {
  //       start: m.index,
  //       end: re.lastIndex
  //     }, type, rangeFn);
  //   }
  // }
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

function setupLogWrapProps(state) {
  state.logWrapOffsets = Object.create(null);
  state.logWrappedPos = new Array();
  state.logWrappedPos.length = state.endOffset;
  state.allLogPos = new Array();
  state.allLogPos.length = state.endOffset;
  state.logWrappedRangesByIdx = [{}];
  state.curDepthIdx = new Array();
}

function findLogWrapRange(range, state) {
  const openingBraceIdx = range.end - 1;
  const closingBraceIdx = findClosingBraceIdx(openingBraceIdx, state);
  const ignoredFormRange = {
    start: range.start,
    end: closingBraceIdx + 1
  };
  return ignoredFormRange;
}

function blackListAndIndexForms(state) {
  setupBlackListProps(state);
  setupLogWrapProps(state);

  // blacklist cljs comment ranges
  bufferScan(state, "comment");

  // blacklist cljs ignored forms
  bufferScan(state, "ignoredForm", findIgnoredFormOrMetaMapRange);

  // blacklist regex literal ranges or string ranges
  bufferScan(state, "string");

  // flag logwraps
  bufferScan(state, "logWrap")

  // blacklist cljs metadata maps
  bufferScan(state, "metaMap", findIgnoredFormOrMetaMapRange);

  // index forms
  let i = 0;
  for (i; i < state.endOffset; i++) {
    indexForms(i, state);
  }

  // TODO
  "Strings are NOT getting blacklisted"
  "Keywords, symbols, and numbers are getting blacklisted, with incorrect ranges"



  // get blacklist range object
  state.blackListedRangeIdx = state.blackListedPos[state.ogPointIdx];
  state.blackListedRange = state.blackListedRangesByIdx[state.blackListedRangeIdx];

  console.log("state.blackListedRange", state.blackListedRange)

  if (state.blackListedRange) {
    state.isBlacklisted = true;
    state.isCommentRange = state.blackListedRange.type === "comment";
    state.isIgnoredFormRange = state.blackListedRange.type === "ignoredForm";
    state.isStringRange = state.blackListedRange.type === "string";
    state.isLogWrapped = state.blackListedRange.type === "logWrap";
  console.log("state.blackListedRange", state.blackListedRange)
  console.log("state.isBlacklisted", state.isBlacklisted)
  console.log("state.isStringRange", state.isStringRange)
  }


  // get logWrapped range object
  // state.logWrappedRangeIdx = state.logWrappedPos[state.ogPointIdx];
  // state.logWrappedRange = state.logWrappedRangesByIdx[state.logWrappedRangeIdx];

  // if (state.logWrappedRange) {
  //   state.isLogWrapped = true;
  // }
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
    let coreMacros = new Set(['defn', 'def', 'and', 'if'])
    state.isNotCoreMacro = !coreMacros.has(state.textCurrentExpression)
  }
}

// Evaluate an expression outside form (var, symbol, keyword, number, etc.)
function evalExpressionOutsideForm(state) {
  //console.log("heres")
  let point = state.isPointFollowingExpression ? state.ogPointIdx - 1 : state.ogPointIdx;
  if (state.isStringRange) {
    state.rangeCurrentExpression = state.blackListedRange.range;
    state.textCurrentExpression = util.getTextInPointRange(state, state.rangeCurrentExpression);
    console.log("evalExpressionOutsideForm", "state.rangeCurrentExpression", state.rangeCurrentExpression)
    return;
  }
  //console.log("here")
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
  if (state.isJsComment || state.isCommentRange || state.isIgnoredFormRange) {
    state.isPointNotOnExpression = false;
    state.rangeCurrentExpression = null;
    return;
  }

  if (state.isInsideForm) {
    evalExpressionInsideForm(state);
  }
  console.log("addExpressionRange")
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
  state.isNotInsideFn = !state.isInsideFn;
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
