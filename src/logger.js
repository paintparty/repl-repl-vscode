const vscode = require('vscode');
//const util = require('./util');

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

function logWrapBU(state) {
  if (state.warning) {
    return warningBlock(state);
  }
  let copied = state[state.logTuple[0]];
  let surfStart = '#_?';

  // quotes and newlines for cljs
  let sp = ' ';

  // escape defs
  let thingToEval = state.isJsComment ?
    '(js/eval "' + state.jsComment + '")'
    :
    getCopiedEscapeDefs(copied);

  // joiner changed to sp
  let applyLog = `(js/console.log "\\n" (quote ${thingToEval}) "\\n\\n =>" ${thingToEval} "\\n\\n")`;
  let isCljc = state.fileExt === "cljc";
  let cljcApplyLog = isCljc ? '#?(:cljs ' + applyLog + ')' : applyLog;
  let newSurf = ['('+surfStart, 'do', cljcApplyLog, '#_.', thingToEval, '#_..)'].join(sp);

  return newSurf;
}

function logWrap(p) {
  // escape defs
  let thingToEval = p.isJsComment ?
    '(js/eval "' + p.jsComment + '")' :
    getCopiedEscapeDefs(p.textToEval);

  // joiner changed to sp
  let applyLog = `(js/console.log "\\n" (quote ${thingToEval}) "\\n\\n =>" ${thingToEval} "\\n\\n")`;
  let isCljc = p.fileExt === "cljc";
  let cljcApplyLog = isCljc ? '#?(:cljs ' + applyLog + ')' : applyLog;
  let ret = `(do ${cljcApplyLog} ${thingToEval})`;

  //return ret;
  return cljcApplyLog;
}


function logBlock2(o) {
  let copied = o.textToEval;
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
  let thingToEval = o.jsComment ?
    '(js/eval "' + o.jsComment + '")' :
    getCopiedEscapeDefs(copied);

  // cljs to pass quoted form to stringify fn
  let thingToEvalDisplay = o.jsComment ?
    '"' + o.jsComment + '"' :
    '(' + strfnName + ' (quote ' + copied + '))';

  // cljs to pass evaled form(result) to stringify fn
  let evalResultLine = '"=>"' + nlTwoSp + '(' + strfnName + ' ' + thingToEval + ')';

  let joiner = nlTwoSp;
  let doubleLineBreak = qnl + qnl;
  let logArgs = [qnl, thingToEvalDisplay, doubleLineBreak, evalResultLine, qnlSp].join(joiner);
  let applyLog = '(apply js/console.log' + nl + ' [' + logArgs + '])';
  let isCljc = o.fileExt === "cljc";
  let cljcApplyLog = isCljc ? '#?(:cljs ' + applyLog + ')' : applyLog;
  let consoleClear = '(js/console.clear)';
  let ecp = '(enable-console-print!)';
  let newSurf = [nl, surfStart, consoleClear, ecp, strfn, cljcApplyLog+')', surfEnd].join("\n");

  return newSurf;
}


function injectNewFn (range, newText) {
  return () => {
    return vscode.window.activeTextEditor.edit(edit => {
      //let evalRange = p.textRange
      edit.replace(range, newText);
      //edit.replace(new vscode.Range(evalRange.start, evalRange.end), new);
    });
  };
}

function getTextInPointRange(state, range) {
  let newRange = new vscode.Range(range.start, range.end);
  let textInRange = state.buff.getText(newRange);
  return textInRange
}

function replaceLogWrapFn (p) {
  return () => {
    return vscode.window.activeTextEditor.edit(edit => {
      edit.replace(p.textRange, p.consoleLogWrappedText);
    });
  };
}

function ghostLogFn2(p) {
  return () => {
    let doc = vscode.window.activeTextEditor.document;
    let newBuffText = doc.getText();
    let newEndPos = doc.positionAt(newBuffText.length);
    p.logBlockRange = new vscode.Range(p.endPos, newEndPos);
    p.logBlockDecorator = vscode.window.createTextEditorDecorationType({
      light: {
        color: "rgba(80, 145, 222, 1)"
      },
      dark: {
        color: "rgba(100, 175, 255, 1)"
      }
    });
    vscode.window.activeTextEditor.setDecorations(p.logBlockDecorator, [{
      range: p.logBlockRange
    }]);
  }
}


function insertTextFn2(p, newSurf) {
  return () => {
    return vscode.window.activeTextEditor.edit(edit => {
      edit.replace(p.logBlockRange, newSurf);
    });
  };
}

function insertBlankTextFn2(p, newSurf) {
  return () => {
    return vscode.window.activeTextEditor.edit(edit => {
      edit.insert(p.endPos, newSurf.replace(/./gm, ' '));
    });
  };
}


function deleteText2(range, p) {
  vscode.window.activeTextEditor.edit(
    edit => {
      edit.delete(range);
      vscode.window.activeTextEditor.setDecorations(p.logBlockDecorator, []);
    }
  );
}

function getDeleteRange(p) {
  const userInsertsFinalNewline = vscode.workspace.getConfiguration().get('files.insertFinalNewline')
  if (userInsertsFinalNewline) {
    const start = p.logBlockRange.start;
    const end = p.logBlockRange.end;
    const newRange = new vscode.Range(start.line, start.character, end.line + 2, 0);
    return newRange;
  } else {
    return p.logBlockRange;
  }
}

function lo (s, o){
  console.log("\n\n"+s, JSON.stringify( o, null, 2 ))
}

function deleteLogBlockFn(p) {
  return (
    function deleteLogBlock(promise) {
      const deleteRange = getDeleteRange(p);
      lo("deleteLogBlockRange!", p.logBlockRange);
      setTimeout(deleteText2, 500, deleteRange, p);
    }
  )
}

function deleteCruftFn(logBlocks) {
  let editor = vscode.window.activeTextEditor;
  return () => {
    return editor.edit(edit => {
      logBlocks.reverse().forEach( range => {
        let r = new vscode.Range(editor.document.positionAt(range[0]), editor.document.positionAt(range[1]));
        lo("range!", r);
        edit.replace(r, "");
      });
    });
  };
}

function rrLogBlocks () {
  // Nuke any cruf rr logblocks
  const documentText = vscode.window.activeTextEditor.document.getText();
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
exports.logBlock2 = logBlock2;
exports.logWrap = logWrap;
exports.insertTextFn2 = insertTextFn2;
exports.insertBlankTextFn2 = insertBlankTextFn2;
exports.ghostLogFn2 = ghostLogFn2;
exports.deleteLogBlockFn = deleteLogBlockFn;
exports.deleteCruftFn = deleteCruftFn;
exports.injectNewFn = injectNewFn;
exports.replaceLogWrapFn = replaceLogWrapFn;
