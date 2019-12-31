const vscode = require('vscode');
const util = require('./util');

// reserve various defs
function getCopiedEscapeDefs(copied) {
  let cljMacros = new Set(['defn', 'def', 'and', 'if', 'let']);
  let nsRe = /^\(\s*ns\s+\S+[\s\S]*\)$/
  if (nsRe.test(copied)) {
    return "nil"
  }
  // just match on current regex. if true, turn into array
  let defMatch = /^\(\s*def(?:n|record|protocol|multi|type|method)?\s+(?:\^\S+\s+)*(?:\#\^\{.*\}\s)*(\S+)[\s\S]*\)$/
  let defMatchResult = defMatch.exec(copied);
  if (defMatchResult) {
    return '(symbol (str (namespace ::x) "/" (quote ' + defMatchResult[1] + ')))';
  } else {
    let defExpressionMatch = /^def(?:n|record|protocol|multi|type|method)?$/
    let defExpressionMatchResult = defExpressionMatch.exec(copied);
    return (defExpressionMatchResult || cljMacros.has(copied)) ? "'cljs.core/" + copied : copied;
  }
}

function warningBlock(state) {
  return '(js/console.clear)\n(enable-console-print!)\n(js/console.warn\n  "' + state.warning + '")';
}

function logWrap(state) {
  if (state.warning) {
    return warningBlock(state);
  }
  let copied = state[state.logTuple[0]];
  let surfStart = '#_?';

  // quotes and newlines for cljs
  let sp = ' ';

  // escape defs
  let thingToEval = state.isJsComment ?
    '(js/eval "' + state.jsComment + '")' :
    getCopiedEscapeDefs(copied);

  // joiner changed to sp
  let applyLog = `(js/console.log "\\n" (quote ${thingToEval}) "\\n\\n =>" ${thingToEval} "\\n\\n")`;
  let isCljc = state.fileExt === "cljc";
  let cljcApplyLog = isCljc ? '#?(:cljs ' + applyLog + ')' : applyLog;
  let newSurf = ['('+surfStart, 'do', cljcApplyLog, '#_.', thingToEval, '#_..)'].join(sp);

  return newSurf;
}


function logBlock(state) {
  if (state.warning) {
    return warningBlock(state);
  }
  let copied = state[state.logTuple[0]];
  let surfStart = '#___rr-start';
  let surfEnd = '#___rr-end';

  // quotes and newlines for cljs
  let sp = ' ';
  let nl = '\n';
  let qnl = '"\\n"';
  let qnlSp = '"\\n "';
  let qdq = '"\\""';
  let nlTwoSp = nl + sp + sp;

  // stringify fn
  let strfnName = 'rr';
  let strfn = '(let [' + strfnName + ' (fn [v] (if (string? v) (str ' + qdq + ' v ' + qdq + ') v))]';

  // escape defs
  let thingToEval = state.isJsComment ?
    '(js/eval "' + state.jsComment + '")' :
    getCopiedEscapeDefs(copied);

  // cljs to pass quoted form to stringify fn
  let thingToEvalDisplay = state.isJsComment ?
    '"' + state.jsComment + '"' :
    '(' + strfnName + ' (quote ' + copied + '))';

  // cljs to pass evaled form(result) to stringify fn
  let evalResultLine = '"=>"' + nlTwoSp + '(' + strfnName + ' ' + thingToEval + ')';

  let joiner = nlTwoSp;
  let doubleLineBreak = qnl + qnl;
  let logArgs = [qnl, thingToEvalDisplay, doubleLineBreak, evalResultLine, qnlSp].join(joiner);
  let applyLog = '(apply js/console.log' + nl + ' [' + logArgs + '])';
  let isCljc = state.fileExt === "cljc";
  let cljcApplyLog = isCljc ? '#?(:cljs ' + applyLog + ')' : applyLog;
  let consoleClear = '(js/console.clear)';
  let ecp = '(enable-console-print!)';
  let newSurf = [nl, surfStart, consoleClear, ecp, strfn, cljcApplyLog+')', surfEnd].join("\n");

  return newSurf;
}

function injectNewFn (state) {
  return () => {
    return vscode.window.activeTextEditor.edit(edit => {
      let evalRange = state[state.logTuple[2]]
      edit.replace(new vscode.Range(evalRange.start, evalRange.end), state.logBlock);
    });
  };
}

function replaceLogWrapFn (state) {
  return () => {
    return vscode.window.activeTextEditor.edit(edit => {
      let r = state.blackListedRange.range;
      let wrappedText = util.getTextInPointRange(state, r);
      let re = /\#_\. ([\s\S]*) \#_\.\./gm;
      let m = re.exec(wrappedText);
      let wrappedValue = ( m && m.length > 1 ) ? m[1] : null;
      edit.replace(new vscode.Range(r.start, r.end), wrappedValue);
    });
  };
}

// Setup decoration for the range we are inserting logblock into
function ghostLogFn(state) {
  return () => {
    let newBuffText = state.buff.getText();
    let newEndPos = state.buff.positionAt(newBuffText.length);
    state.logBlockRange = new vscode.Range(state.endPos, newEndPos);
    state.logBlockDecorator = vscode.window.createTextEditorDecorationType({
      light: {
        color: "rgba(80, 145, 222, 1)"
      },
      dark: {
        color: "rgba(100, 175, 255, 1)"
      }
    });
    state.editor.setDecorations(state.logBlockDecorator, [{
      range: state.logBlockRange
    }]);
  }
}

function insertTextFn(state, newSurf) {
  return () => {
    return vscode.window.activeTextEditor.edit(edit => {
      //console.log(state)
      edit.replace(state.logBlockRange, newSurf);
    });
  };
}

function insertBlankTextFn(state, newSurf) {
  return () => {
    return vscode.window.activeTextEditor.edit(edit => {
      edit.insert(state.endPos, newSurf.replace(/./gm, ' '));
    });
  };
}

function deleteText(range, state) {
  vscode.window.activeTextEditor.edit(
    edit => {
      edit.delete(range);
      state.editor.setDecorations(state.logBlockDecorator, []);
    }
  );
}

function getDeleteRange(state) {
  const userInsertsFinalNewline = vscode.workspace.getConfiguration().get('files.insertFinalNewline')
  if (userInsertsFinalNewline) {
    const start = state.logBlockRange.start;
    const end = state.logBlockRange.end;
    const newRange = new vscode.Range(start.line, start.character, end.line + 2, 0);
    return newRange;
  } else {
    return state.logBlockRange;
  }
}

function deleteLogBlockFn(state) {
  return (
    function deleteLogBlock(promise) {
      const deleteRange = getDeleteRange(state);
      setTimeout(deleteText, 500, deleteRange, state);
    }
  )
}

function rrLogBlocks (editor) {
  // Nuke any cruf rr logblocks
  const documentText = editor.document.getText();
  let matchRanges = [];
  let re = /(\#___rr-start[\s\S]*?\#___rr-end)/gm;
  var match;

  while (match = re.exec(documentText)) {
     matchRanges.push([match.index, re.lastIndex])
  }
  return matchRanges;
}

exports.rrLogBlocks = rrLogBlocks;
exports.warningBlock = warningBlock;
exports.logBlock = logBlock;
exports.logWrap = logWrap;
exports.insertTextFn = insertTextFn;
exports.insertBlankTextFn = insertBlankTextFn;
exports.ghostLogFn = ghostLogFn;
exports.deleteLogBlockFn = deleteLogBlockFn;

exports.injectNewFn = injectNewFn;
exports.replaceLogWrapFn = replaceLogWrapFn;
