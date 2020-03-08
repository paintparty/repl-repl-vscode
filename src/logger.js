const vscode = require('vscode');

function lo (s, o){
  console.log("\n\n"+s, JSON.stringify( o, null, 2 ))
}

function lv (s, v){
  console.log("\n\n"+s, v)
}

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


function doc (s, id) {
  let block = `
(let [{ns :ns fn-name :name arglists :arglists doc :doc} (meta #'${s})
 args (interpose "\\n" (map #(str "(" (.join (clj->js (cons (name fn-name) %)) " ") ")") arglists))
 fully-qualified (symbol (str (name ns) "/" (name fn-name)))]

 (apply
 js/console.log
 (concat
 ["\\n"
 ${s}
 "\\n"
 "\\n"
 fully-qualified
 "\\n"
 "\\n"]

  args

  ["\\n"
  "\\n"
  doc
  "\\n"
  "\\n"
  (str "https://cljs.github.io/api/" fully-qualified)
  "\\n"
  "\\n"
  (str "https://clojure.docs.org/" fully-qualified)
  "\\n\\n"]))) #_"${id}"`

  return block.replace(/\n/gm, '');
}



function printWrapSimple(o) {
  let applyLog = `(js/console.log ${o.textToEval})`;
  let isCljc = o.fileExt === "cljc";
  let cljcApplyLog = isCljc ? '#?(:cljs ' + applyLog + ')' : applyLog;
  return cljcApplyLog;
}

function printWrap(o) {
  // escape defs
  let thingToEval = o.isJsComment ?
    '(js/eval "' + o.jsComment + '")' :
    getCopiedEscapeDefs(o.textToEval);

  let applyLog = `(js/console.log "\\n" (quote ${thingToEval}) "\\n\\n =>" ${thingToEval} "\\n\\n")`;
  let isCljc = o.fileExt === "cljc";
  let cljcApplyLog = isCljc ? '#?(:cljs ' + applyLog + ')' : applyLog;
  return cljcApplyLog;
}


function printBlock(o, id) {
  // stringify fn
  let strfnName = 'f';

  // cljs to pass quoted form to stringify fn
  let thingToEvalDisplay = o.jsComment ?
    `"${o.jsComment}"` : `(${strfnName}  (quote ${o.textToEval}))`;

  // escape defs
  let thingToEval = o.jsComment ?
    `(js/eval "${o.jsComment}")` : getCopiedEscapeDefs(o.textToEval);

  let applyLog =`
(apply
 js/console.log
["\\n"
 ${thingToEvalDisplay}
 "\\n"
 "\\n"
 "=>"
 (${strfnName} ${thingToEval})
 "\\n "])`;

  let cljcApplyLog = (o.fileExt === "cljc") ? '#?(:cljs ' + applyLog + ')' : applyLog;

  let newSurf = `
(let [${strfnName} #(if (string? %)
 (str "\\"" % "\\"") %)]
 (js/console.clear)
 ${cljcApplyLog}
 ${o.textToEval}) #_"${id}"`;

  return newSurf.replace(/\n/gm, '');
}


function injectNewFn (range, newText) {
  return () => {
    return vscode.window.activeTextEditor.edit(edit => {
      edit.replace(range, newText);
    });
  };
}

function replacePrintWrapFn (p) {
  return () => {
    return vscode.window.activeTextEditor.edit(edit => {
      edit.replace(p.textRange, p.consolePrintWrappedText);
    });
  };
}

function deletePrintBlockFn (p) {
  return (
    function deletePrintBlock(promise) {
      const deleteRange = getDeleteRange(p);
      setTimeout(deleteText, 500, deleteRange, p);
    }
  )
}

function revertPrintBlockFn (p, id) {
  return () => {
    return vscode.window.activeTextEditor.edit(edit => {
      const documentText = vscode.window.activeTextEditor.document.getText();
      let re = new RegExp(`_"${id}"`, 'gm');
      var match;
      var matchRanges = [];
      while (match = re.exec(documentText)) {
         matchRanges.push([match.index, re.lastIndex])
      }
      const endPos = vscode.window.activeTextEditor.document.positionAt(matchRanges[0][1]);
      edit.replace(new vscode.Range(p.textRange.start, endPos), p.textToEval);
    });
  };
}

function insertTextFn(p, newSurf) {
  return () => {
    return vscode.window.activeTextEditor.edit(edit => {
      edit.replace(p.printBlockRange, newSurf);
    });
  };
}

function deleteText(range, p) {
  vscode.window.activeTextEditor.edit(
    edit => {
      edit.delete(range);
      vscode.window.activeTextEditor.setDecorations(p.printBlockDecorator, []);
    }
  );
}

function getDeleteRange(p) {
  const userInsertsFinalNewline = vscode.workspace.getConfiguration().get('files.insertFinalNewline')
  if (userInsertsFinalNewline) {
    const start = p.printBlockRange.start;
    const end = p.printBlockRange.end;
    const newRange = new vscode.Range(start.line, start.character, end.line + 2, 0);
    return newRange;
  } else {
    return p.printBlockRange;
  }
}

function deletePrintBlockFn(p) {
  return (
    function deletePrintBlock(promise) {
      const deleteRange = getDeleteRange(p);
      setTimeout(deleteText, 500, deleteRange, p);
    }
  )
}

exports.printBlock = printBlock;
exports.printWrap = printWrap;
exports.printWrapSimple = printWrapSimple;
exports.doc = doc;
exports.insertTextFn = insertTextFn;
exports.deletePrintBlockFn = deletePrintBlockFn;
exports.injectNewFn = injectNewFn;
exports.revertPrintBlockFn = revertPrintBlockFn;
exports.replacePrintWrapFn = replacePrintWrapFn;
