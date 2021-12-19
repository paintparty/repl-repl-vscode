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
    return `(symbol (str "'#" (namespace ::x) "/" (quote ${defMatchResult[1]})))`;
  } else {
    let defExpressionMatch = /^def(?:n|record|protocol|multi|type|method)?$/
    let defExpressionMatchResult = defExpressionMatch.exec(copied);
    return (defExpressionMatchResult || cljMacros.has(copied)) ? "'cljs.core/" + copied : copied;
  }
}


function printBlock(o, id, fileExt) {
  // stringify fn
  let strfnName = 'f';
  let thingToEvalDisplay = `(${strfnName}  (quote ${o.text}))`;
  let thingToEval = getCopiedEscapeDefs(o.text);
  let consoleClear = (fileExt === "cljc") ? "" : "(js/console.clear)";
  let printFn = (fileExt === "cljc") ? "println" : "js/console.log";
  let applyLog =`
(apply
 ${printFn}
["\\n"
 ${thingToEvalDisplay}
 "\\n"
 "\\n"
 "=>"
 (${strfnName} ${thingToEval})
 "\\n "])`;


  let newSurf = `
(let [${strfnName} #(if (string? %)
 (str "\\"" % "\\"") %)]
 ${consoleClear}
 ${applyLog}
 ${o.text}) #_"${id}"`;

  return newSurf.replace(/\n/gm, '');
}


function injectNewFn (range, newText) {
  return () => {
    return vscode.window.activeTextEditor.edit(edit => {
      edit.replace(range, newText);
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

function revertPrintBlockFn (o, id) {
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
      edit.replace(new vscode.Range(o.range.start, endPos), o.text);
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
exports.insertTextFn = insertTextFn;
exports.deletePrintBlockFn = deletePrintBlockFn;
exports.injectNewFn = injectNewFn;
exports.revertPrintBlockFn = revertPrintBlockFn;
