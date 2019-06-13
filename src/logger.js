const vscode = require('vscode');

// reserve various defs
function getCopiedEscapeDefs(copied) {
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
    return defExpressionMatchResult ? "'cljs.core/" + copied : copied;
  }
}

function warningBlock(state) {
  if (state.isJs) {
    return 'console.clear()\nconsole.warn(\n"' + state.warning + '")';
  } else {
    return '(js/console.clear)\n(enable-console-print!)\n(js/console.warn\n  "' + state.warning + '")';
  }
}

function jsBlock(state) {
  if (state.warning) {
    return warningBlock(state);
  }
  let result = 'eval(`' + state.selectedText + '`)';
  let surfStart = '// rr_______';
  let surfEnd = '// _______rr';

  let q = '`';
  let nl = '\n';
  let qnl = '`\n`';
  let qnlSp = '`\n `';
  let sp = ' ';
  let nlTwoSp = nl + sp + sp;
  let joiner = `,${nlTwoSp}`;
  let doubleLineBreak = q + '\\n\\n' + q;
  let thingToEvalDisplay = q + state.selectedText + q;
  let thingToEval = q + '=>' + q + ',' + nlTwoSp + result;
  let logArgs = [qnl, thingToEvalDisplay, doubleLineBreak, thingToEval, qnlSp].join(joiner);
  let applyLog = `console.log.apply(${nl}console, [\n${logArgs}\n])`;
  let consoleClear = 'console.clear()';
  let newSurf = [consoleClear, surfStart, applyLog, surfEnd].join("\n");
  return newSurf;
}



function cljxBlock(state) {

  if (state.warning) {
    return warningBlock(state);
  }
  let copied = state[state.logTuple[0]];
  let surfStart = '; repl-repl output start';
  let surfEnd = '; repl-repl output end';

  // quotes and newlines for cljs
  let sp = ' ';
  let qsp = '" "';
  let nl = '\n';
  let qnl = '"\\n"';
  let qnlSp = '"\\n "';
  let qdq = '"\\""';
  let nlTwoSp = nl + sp + sp;

  // cljx stringify fn
  let strfnName = 'rr';
  let strfn = '(let [' + strfnName + ' (fn [v] (if (string? v) (str ' + qdq + ' v ' + qdq + ') v))]';

  // escape cljx defs
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
  let applyLog = '(apply js/console.log ' + nl + ' [' + logArgs + '])';
  let isCljc = state.fileExt === "cljc";
  let cljxApplyLog = isCljc ? '#?(:cljs ' + applyLog + ')' : applyLog;
  let consoleClear = '(js/console.clear)';
  let ecp = '(enable-console-print!)';
  let newSurf = [nl, surfStart, consoleClear, ecp, strfn, cljxApplyLog, ')', surfEnd].join("\n");

  return newSurf;
}

function logBlock(state) {
  return (state.fileExt === 'js') ?
    jsBlock(state) :
    cljxBlock(state);
}

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

exports.warningBlock = warningBlock;
exports.cljxBlock = cljxBlock;
exports.jsBlock = jsBlock;
exports.logBlock = logBlock;
exports.insertTextFn = insertTextFn;
exports.insertBlankTextFn = insertBlankTextFn;
exports.ghostLogFn = ghostLogFn;
exports.deleteLogBlockFn = deleteLogBlockFn;
