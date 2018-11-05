const vscode = require('vscode');

function logStateInfo(state) {
}

function convertHex(hex) {
  var hex = hex.replace('#', '');
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  let a = hex.substring(6, 8);
  let aInt = parseInt(a);
  let opacity = (a.length === 2 && (aInt !== NaN) && (typeof aInt === 'number')) ? (0.7 * aInt/100) : 1;
  let result = 'rgba(' + r + ',' + g + ',' + b + ',' + opacity + ')';
  return result;
}

function numRange(left, right, inclusive) {
  let range = [];
  let ascending = left < right;
  let end = !inclusive ? right : ascending ? right + 1 : right - 1;
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i);
  }
  return range;
}

function toPointRange(state, range) {
  return {
    start: posForIdx(state, range.start),
    end: posForIdx(state, range.end),
  };
}

function toIdxRange(state, pointRange) {
  let start = idxForPos(state, pointRange.start);
  let end = idxForPos(state, pointRange.end);
  return { start: start, end: end - 1 };
}

function getCursorOffset(editor){
  let buff = editor.document;
  return buff.offsetAt(editor.selection.active);  
}

function vsSendCursorToPos(pos){
  let s = new vscode.Selection(pos, pos);
  vscode.window.activeTextEditor.selection = s;
}

function saveFileFn(state){
  return(
    function saveFile(promise){return state.buff.save();}
  );
}

const multiSelectWarning = '\nrepl-repl cannot evaluate multiple selections.' +
  '\n\nPlease use a single selection or evaluate a form ' +
  'by firing repl-repl when your cursor is within the form. ' +
  '\n\nA "form" is an unquoted section of code beginning with (, ' +
  '[, or {, and ending with the respective balancing bracket.\n\n';

function expressionAtIdx(str, re, cursorIdx, formStartIdx) {
  let isValidString = (typeof str === "string" && str !== "");
  let isValidRegex = (re instanceof RegExp);
  let indicesAreValid = (typeof cursorIdx === "number" && typeof formStartIdx === "number");
  if (!isValidString) {
    return;
  }
  if (!isValidRegex) {
    return;
  }
  if (!indicesAreValid) {
    return;
  }
  let match;
  while ((match = re.exec(str)) !== null) {
    let startIdx = match.index + formStartIdx;
    let endIdx = re.lastIndex + formStartIdx;
    if (startIdx <= cursorIdx && endIdx > cursorIdx) {
      return {
        matchedString: match[0],
        idx: match.index,
        lastIndex: re.lastIndex,
        startIdx: startIdx,
        endIdx: endIdx
      };
    }
  }
}

function reducerFn(ns) {
  return (
    (acc, v) => {
      acc[v] = ns[v](acc);
      return acc;
    }
  );
}

function isJsWithNoSelectedText(state) {
  let ext = state.fileExt;
  return ((ext === 'js' || ext === 'jsx') && !state.selectedText)
}

function fileExt(state) {
  let fileExtMatch = state.editor.document.fileName.match(/.(cljs|cljc|js|jsx)$/);
  if (fileExtMatch) {
    return fileExtMatch[1];
  }
}

function isCljx(state) {
  let ext = state.fileExt;
  return (ext === "cljs" || ext === "cljc");
}

function isJs(state) {
  let ext = state.fileExt;
  return (ext === "js" || ext === "jsx");
}

function selection(state) {
 return state.editor.selection;
}

function selectionRange(state) {
  let start = state.selection.start;
  let end = state.selection.end;
  if(start.line===end.line && start.character===end.character){
    return null;
  }else{
    let range = new vscode.Range(start, end);
    return range; 
  }
}

function selectedText(state) {
  let selectedText =  state.selectionRange ? state.buff.getText(state.selectionRange) : null;
  selectedText = (selectedText && selectedText !== "") ? selectedText : null;
  return selectedText;
}

function buff(state) {
  return state.editor.document;
}

function buffText(state) {
  let buffText = state.buff.getText();
  return buffText;
}

function endPos(state) {
  let endPos = state.buff.positionAt(state.buffText.length);
  return endPos;
}

function idxForPos(state, pos) {
  let idx = state.buff.offsetAt(pos);
  return idx;
}

function endOffset(state) {
  let endOffset = idxForPos(state, state.endPos);
  return endOffset;
}

function cursorPos(state) {
  return state.editor.selection.active;
}

function ogPoint(state) {
  let ogPoint = cursorPos(state);
  return ogPoint;
}

function ogPointIdx(state) {
  let ogPointIdx = idxForPos(state, state.ogPoint);
  return ogPointIdx;
}

function isCursorAtTailOfSelection(state) {
  let isCursorAtTailOfSelection = state.selectedText ?
    (state.selectionRange.start.line === state.ogPoint.line &&
      state.selectionRange.start.character === state.ogPoint.character) :
    null;
  return isCursorAtTailOfSelection;
}

function isCursorAtHeadOfSelection(state) {
  return (state.selectedText && !state.isCursorAtTailOfSelection);
}

function posForIdx(state, idx) {
  return state.buff.positionAt(idx);
}

function charAtIdx(state, idx) {
  let char = state.buffText.substring(idx, idx + 1);
  return char;
}

function getTextInPointRange(state, range) {
  let newRange = new vscode.Range(range.start, range.end);
  let textInRange = state.buff.getText(newRange);
  return textInRange
}
// VS Code specific end


// VS Code specific
exports.getTextInPointRange = getTextInPointRange;
exports.cursorPos = cursorPos;
exports.charAtIdx = charAtIdx;
exports.idxForPos = idxForPos;
exports.posForIdx = posForIdx;
exports.fileExt = fileExt;
exports.isCljx = isCljx;
exports.isJs = isJs;
exports.isCursorAtHeadOfSelection = isCursorAtHeadOfSelection;
exports.isCursorAtTailOfSelection = isCursorAtTailOfSelection;
exports.ogPoint = ogPoint;
exports.ogPointIdx = ogPointIdx;
exports.endPos = endPos;
exports.endOffset = endOffset;
exports.buff = buff;
exports.buffText = buffText;
exports.selectedText = selectedText;
exports.selection = selection;
exports.selectionRange = selectionRange;
// End VS Code specific

exports.logStateInfo = logStateInfo;
exports.isJsWithNoSelectedText = isJsWithNoSelectedText;
exports.convertHex = convertHex;
exports.expressionAtIdx = expressionAtIdx;
exports.numRange = numRange;
exports.toPointRange = toPointRange;
exports.toIdxRange = toIdxRange;
exports.getCursorOffset = getCursorOffset;
exports.vsSendCursorToPos = vsSendCursorToPos;
exports.saveFileFn = saveFileFn;
exports.reducerFn = reducerFn;