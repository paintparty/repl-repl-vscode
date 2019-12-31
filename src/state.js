const util = require('./util');
const form = require('./form');

function adjustOgPointIdx(state) {
  if (state.isCursorAtHeadOfSelection) { state.ogPointIdx--; }
}

function setUserCommandCode(state) {
  state.ecf = state.userArg === "eval-current-form";
  state.eof = state.userArg === "eval-outermost-form";
  state.ece = state.userArg === "eval-current-expression";
  state.lwcf = state.userArg === "log-wrap-current-form";
  state.lwof = state.userArg === "log-wrap-outer-form";
  state.lwce = state.userArg === "log-wrap-current-expression";
  state.rlw = state.userArg === "remove-log-wrap";
}

const stateProps = [
  "fileExt",
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
  "ogPointIdx"
];

const nullProps = [
  "isBlacklisted",
  "isNotBlacklisted",
  "isInsideForm",
  "isInExpression",
  "isInsideFn",
  "isNotJsCommentInExpression",
  "isJsComment",
  "isNotJsComment",
  "isOutsideForm",
  "isCommentRange",
  "isIgnoredFormRange",
  "isLogWrapped",
  "isPointOnExpression",
  "isPointNotOnExpression",
  "isPointFollowingForm",
  "isPointFollowingExpression",
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
  "warning"
];

function nPropsReducer(acc, v) {
  acc[v] = null;
  return acc;
}

function getBufferState(editor, userArg) {

  let acc = { editor: editor, userArg: userArg };

  let rf = util.reducerFn(util);

  let state = nullProps.reduce(nPropsReducer, stateProps.reduce(rf, acc));

  if (!(state.fileExt === "cljs" || state.fileExt === "cljc")) {
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
