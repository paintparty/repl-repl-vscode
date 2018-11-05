const util = require('./util');
const form = require('./form');

function fatalWarnings(state) {
  if (!state.fileExt) {
    state.fatalWarning = "File must have a valid file extension such as .cljs, .cljc, .js, or .ts"
    return true;
  }
}

function adjustOgPointIdx(state) {
  if (state.isCursorAtHeadOfSelection) { state.ogPointIdx--; }
}

function setUserCommandCode(state) {
  state.ecf = state.userArg === "eval-current-form";
  state.eof = state.userArg === "eval-outermost-form";
  state.ece = state.userArg === "eval-current-expression";
}

const stateProps = [
  "fileExt",
  "isCljx",
  "isJs",
  "buff",
  "buffText",
  "selection",
  "selectionRange",
  "selectedText",
  "endPos",
  "endOffset",
  "ogPoint",
  "isCursorAtTailOfSelection",
  "isCursorAtHeadOfSelection",
  "isJsWithNoSelectedText",
  "ogPointIdx"
];

const nullProps = [
  "isBlacklisted",
  "isNotBlacklisted",
  "isInsideForm",
  "isInExpression",
  "isNotJsCommentInExpression",
  "isJsComment",
  "isNotJsComment",
  "isOutsideForm",
  "isCommentRange",
  "isIgnoredFormRange",
  "isPointOnExpression",
  "isPointNotOnExpression",
  "isStringRange",
  "jsComment",
  "jsCommentEvalRange",
  "jsCommentSelectedText",
  "logTuple",
  "rangeCurrentExpression",
  "rangeCurrentForm",
  "rangeOuterForm",
  "textCurrentExpression",
  "textCurrentForm",
  "textOuterForm",
  "warning",
  "fatalWarning"
];

function nPropsReducer(acc, v) {
  acc[v] = null;
  return acc;
}

function getBufferState(editor, userArg) {

  let acc = { editor: editor, userArg: userArg };

  let rf = util.reducerFn(util);

  let state = nullProps.reduce(nPropsReducer, stateProps.reduce(rf, acc));

  if (fatalWarnings(state)) {
    return;
  }
  setUserCommandCode(state);
  adjustOgPointIdx(state);

  // add relevant form & text props to state
  form.addFormRange(state);

  // add relevant props wrt current expression on point
  form.addExpressionRange(state);
  return state;
}
exports.getBufferState = getBufferState;
