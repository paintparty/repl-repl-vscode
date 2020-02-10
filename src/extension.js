'use strict'
const vscode = require('vscode');
const logger = require('./logger');
//const util = require('./util');
const decorate = require('./decorate');
const bufferState = require('./state');
const control = require('./control');

function selectionRange() {
  let editor = vscode.window.activeTextEditor;
  let start = editor.selection.start;
  let end = editor.selection.end;
  if(start.line===end.line && start.character===end.character){
    return null;
  }else{
    let range = new vscode.Range(start, end);
    return range;
  }
}

function selectedText() {
  let r = selectionRange();
  let selectedText =  r ? vscode.window.activeTextEditor.document.getText(r) : null;
  selectedText = (selectedText && selectedText !== "") ? selectedText : null;
  return selectedText;
}

function charAtIdx(idx) {
  let char = vscode.window.activeTextEditor.document.getText().substring(idx, idx + 1);
  return char;
}

function charAtIdxRange(startIdx, endIdx) {
  let char = vscode.window.activeTextEditor.document.getText().substring(startIdx, endIdx);
  return char;
}

function idxForPos(pos) {
  return vscode.window.activeTextEditor.document.offsetAt(pos);
}

function posForIdx(idx) {
  return vscode.window.activeTextEditor.document.positionAt(idx);
}

function cursorPos() {
  return vscode.window.activeTextEditor.selection.active;
}

function _vsSendCursorToPos(pos, isEnd){
  let adj = isEnd? 1 : 0;
  let newPos = posForIdx(idxForPos(pos) - adj);
  let s = new vscode.Selection(newPos, newPos);
  //lo("_vsSendCursorToPos", pos);
  vscode.window.activeTextEditor.selection = s;
}

function vsSendCursorToPos(pos){
  _vsSendCursorToPos(pos, false);
}

function vsSendCursorToEndPos(pos){
  //lo("_vsSendCursorToEndPos", pos);
  _vsSendCursorToPos(pos, true);
}
function lo (s, o){
  console.log("\n\n"+s, JSON.stringify( o, null, 2 ))
}
function lv (s, v){
  console.log("\n\n"+s, v)
}

function getFormInfo(text){
  let firstChar = text.charAt(0);
  let lastChar = text.charAt(text.length-1);
  let isMap = ( firstChar === '{' && lastChar === '}' );
  let isSexp = ( firstChar === '(' && lastChar === ')' );
  let isVector = ( firstChar === '[' && lastChar === ']' );
  let isString = ( firstChar === '"' && lastChar === '"' );
  let isForm = isMap || isSexp || isVector;
  return {
    firstChar: firstChar,
    lastChar: lastChar,
    isMap: isMap,
    isSexp: isSexp,
    isVector: isVector,
    isString: isString,
    isForm: isForm
  }
}

function isTextInsideString(){
  let text = selectedText();
  let textRange = selectionRange();
  let editor = vscode.window.activeTextEditor;
  let textRangeStartIdx = editor.document.offsetAt(textRange.start);
  let textRangeEndIdx = editor.document.offsetAt(textRange.end);
  let precedingChar = (textRangeStartIdx !== 0) ? charAtIdx(textRangeStartIdx-1) : null;
  //TODO GET LAST IDX OF DOC for 9999
  let followingChar = (textRangeEndIdx !== 9999) ? charAtIdx(textRangeEndIdx) : null;
  return followingChar==='"' && precedingChar==='"';
}

function isInsideForm(){
  vscode.commands.executeCommand("paredit.rangeForDefun");
  return getFormInfo(selectedText()).isForm;
}

function fileExt() {
  let fileExtMatch = vscode.window.activeTextEditor.document.fileName.match(/.(cljs|cljc)$/);
  if (fileExtMatch) {
    return fileExtMatch[1];
  }
}

function endPos() {
  let doc = vscode.window.activeTextEditor.document;
  let buffText = doc.getText();
  return doc.positionAt(buffText.length);
}

function saveFileFn(){
  return(
    function saveFile(promise){
      return vscode.window.activeTextEditor.document.save();
    }
  );
}

/* Invalidate if "#_" */
function validateText(s, range){
  let editor = vscode.window.activeTextEditor;
  if(["#", "'", "\""].includes(s)){
    return null;
  }else if(s === "_"){
    let textRangeStartIdx = editor.document.offsetAt(range.start);
    let precedingChar = (textRangeStartIdx !== 0) ? charAtIdx(textRangeStartIdx-1) : null;
    if (precedingChar==="#"){
      return null
    }
  }else if(s.match(/^;/)){
    lv("starts with ;", s)
    return null;
  }else{
    return s;
  }
}

function profile(userArg){
  let editor = vscode.window.activeTextEditor;
  let o = {
    endPos: endPos(),
    fileExt: fileExt(),
    isStringOutsideForm: false,
    isKeywordOutsideForm: false,
    isSymbolOutsideForm: false,
    isNumberOutsideForm: false,
    isJSComment: false,
    ogPoint: cursorPos()
  };

  if(["log-wrap-outermost-form", "eval-outermost-form", "remove-log-wrap"].includes(userArg)) {
    vscode.commands.executeCommand("paredit.rangeForDefun");
  }else if(["log-wrap-current-form", "eval-current-form"].includes(userArg)) {
    if (isInsideForm()) {
      vsSendCursorToPos(o.ogPoint);
      let isForm = false;
      while (!isForm) {
        vscode.commands.executeCommand("paredit.sexpRangeExpansion");
        isForm = getFormInfo(selectedText()).isForm;
      }
    }
  }else if(["log-wrap-current-expression", "eval-current-expression"].includes(userArg)) {
    vsSendCursorToPos(o.ogPoint);
    vscode.commands.executeCommand("paredit.sexpRangeExpansion");
    // TODO make this work for strings like "   what " (where you have some trimmable whitespace)
    if(isTextInsideString()) {
      vscode.commands.executeCommand("paredit.sexpRangeExpansion");
    }else{

    }
  }

  o.textRange = selectionRange();
  let text = validateText(selectedText(), o.textRange);
  o.text = text;

  lo("textRange", o.textRange);
  lv("text", o.text);

  if(!o.text){
    o.textRange = null
  }

  if(["'", "#"].includes(o.text)){
    vsSendCursorToPos(o.ogPoint);
    vscode.commands.executeCommand("paredit.forwardSexp");
    let offsetIdx = editor.document.offsetAt(editor.selection.active);
    let char = editor.document.getText().substring(offsetIdx, offsetIdx + 1);
    lv("idx2", offsetIdx);
    lv("char", char);
    if(["(", "{"].includes(char)){
      o.text = null
      const formType = (char==="(") ? "list or anonymous function" : "set";
      vscode.window.showWarningMessage("repl-repl: If you are trying to eval a " + formType + ", your cursor must be on or inside brackets");
    }
  }

  if(o.text){
    o.textRangeStartIdx = editor.document.offsetAt(o.textRange.start);
    //console.log("textRangeStartIdx", o.textRangeStartIdx);

    o.textRangeEndIdx = editor.document.offsetAt(o.textRange.end);
    //console.log("textRangeStartIdx", o.textRangeEndIdx);

    o.precedingChar = (o.textRangeStartIdx !== 0) ? charAtIdx(o.textRangeStartIdx-1) : null;
    o.preceding2Char = (o.textRangeStartIdx > 1) ? charAtIdx(o.textRangeStartIdx-2) : null;
    o.preceding3Char = (o.textRangeStartIdx > 2) ? charAtIdx(o.textRangeStartIdx-3) : null;

    let p2Chars = o.preceding2Char + o.precedingChar;
    o.isCommentedForm = ( p2Chars === "#_" ) || ( o.preceding3Char + p2Chars === "#_\n" );
    //console.log("isCommentedForm", o.isCommentedForm);

    o.firstChar = o.text.charAt(0);
    o.lastChar = o.text.charAt(o.text.length-1);
    o.isMap = ( o.firstChar === '{' && o.lastChar === '}' );
    o.isSexp = ( o.firstChar === '(' && o.lastChar === ')' );
    o.isVector = ( o.firstChar === '[' && o.lastChar === ']' );
    o.isForm = o.isMap || o.isSexp || o.isVector;

    if(!o.isForm){
      o.isStringOutsideForm = o.firstChar==='"' && o.lastChar==='"';
      o.isKeywordOutsideForm = o.firstChar===':';
      o.isSymbolOutsideForm = o.firstChar==="'";
      const isNumRe = /^[0-9|.]*$/gm;
      o.isNumberOutsideForm = isNumRe.test(o.text);
    }else{
      o.isSet = o.isMap && o.firstChar === "{" && o.precedingChar === "#";
      o.isAnonFn = o.isSexp && o.precedingChar === "#";
      o.isList = o.isSexp && o.precedingChar === "'";
      const isLogWrapRe = /^\(js\/console.log [/s/S]*/; // include prn, println, pprint, pprint/pprint, js/console.warn, js/console/info
      //convert to position +1
      o.isConsoleLogWrap = isLogWrapRe.test(o.text);
      if(o.isConsoleLogWrap){
        console.log("is ConsoleLogWrap!!!!!")
        //clear selection and place cursor on last index in selection
        vsSendCursorToEndPos(o.textRange.end)

        //clear selection and place cursor on last index in selection
        vscode.commands.executeCommand("paredit.backwardSexp");
        vscode.commands.executeCommand("paredit.backwardSexp");
        vscode.commands.executeCommand("paredit.sexpRangeExpansion");
        o.consoleLogWrappedText = selectedText();

        let lwTextRange = selectionRange();
        let lwTextRangeStartIdx = editor.document.offsetAt(lwTextRange.start);
        let precedingChar = (lwTextRangeStartIdx !== 0) ? charAtIdx(lwTextRangeStartIdx-1) : null;
        let firstChar = o.consoleLogWrappedText.charAt(0);
        let lastChar = o.consoleLogWrappedText.charAt(o.consoleLogWrappedText.length-1);
        let isMap = ( firstChar === '{' && lastChar === '}' );
        let isSexp = ( firstChar === '(' && lastChar === ')' );
        let isSet = isMap && firstChar === "{" && precedingChar === "#";
        let isAnonFn = isSexp && precedingChar === "#";
        let isList = isSexp && precedingChar === "'";
        let newLwTextRange = (isSet || isList || isAnonFn) ?
          new vscode.Range(posForIdx(idxForPos(lwTextRange.start) - 1), lwTextRange.end)
          :
          lwTextRange
        lo("lwTextRange", lwTextRange)
        lo("newLwTextRange", newLwTextRange)
        o.consoleLogWrappedText = vscode.window.activeTextEditor.document.getText(newLwTextRange);
      }
      o.jsComment = (function(){
        vsSendCursorToPos(o.textRange.start)
        vscode.commands.executeCommand("paredit.forwardDownSexp");

        // TODO ADD something following \s\S ?? or make regex find the index ...
        let m = /^\(comment\s+\:js\s+([\s\S]+)/gm;
        if(m.test(o.text)){
          let i = o.text.indexOf(":js")
          console.log("i", i);
          let newStartPos = posForIdx(idxForPos(o.textRange.start) + i + 4)
          let newEndPos = posForIdx(idxForPos(o.textRange.end) - 1)
          let s = new vscode.Selection(newStartPos, newEndPos);
          vscode.window.activeTextEditor.selection = s;
          console.log("jsCommentText", selectedText());
          return selectedText().trim();
        }
      }());
    }
    o.textRange = (o.isSet || o.isList || o.isAnonFn) ?
      new vscode.Range(posForIdx(idxForPos(o.textRange.start) - 1), o.textRange.end)
      :
      o.textRange;
    o.textToEval = vscode.window.activeTextEditor.document.getText(o.textRange)
  }
  vsSendCursorToPos(o.ogPoint);
  return o;
}

function profileEvalFn(userArg){
  return () => {
    let editor = vscode.window.activeTextEditor;
    let cursorPos =  editor.selection.active;
    lv("userArg:", userArg)

    // If point is on commented line, bail.
    // If first char on line is semicolon
    let leadingChar = editor.document.lineAt(cursorPos.line).text.trim().charAt(0);
    let isCommentLine = leadingChar === ";"
    if (isCommentLine){
      lv("", "commented line!");
      vscode.window.showWarningMessage("repl-repl: Commented line")
      return;
    }

    let p = profile(userArg);
    lo("profile", p);

    if(p.textRange) {
      if(p.isConsoleLogWrap){
        if(userArg === "remove-log-wrap"){
          const replaceLogWrap = logger.replaceLogWrapFn(p);
          replaceLogWrap();
          return;
        }else{
          vscode.window.showWarningMessage("repl-repl: Currently inside log wrapped form.");
          return;
        }
      }
      else if(["log-wrap-outermost-form",
          "log-wrap-current-form",
          "log-wrap-current-expression"].includes(userArg)){
        const logWrap = logger.logWrap(p)
        const injectNew = logger.injectNewFn(p.textRange, logWrap);
        injectNew()
      }else{
        decorate.highlightEvalForm(p.textRange);
        const newSurf  = logger.logBlock2(p);
        lv("logBlock", newSurf);
        const injectBlank = logger.insertBlankTextFn2(p, newSurf);
        const ghostLog = logger.ghostLogFn2(p);
        const injectText = logger.insertTextFn2(p, newSurf);
        const save = saveFileFn();
        const deleteLogBlock = logger.deleteLogBlockFn(p);
        injectBlank()
        .then(ghostLog)
        .then(injectText)
        .then(save)
        .then(deleteLogBlock)
        .then(function(){vsSendCursorToPos(p.ogPoint)});
      }
    }
  }
}

function replrepl (userArg) {
  let editor = vscode.window.activeTextEditor;
  if (!editor){
    return;
  }
  const logBlocks = logger.rrLogBlocks();
  const profileEval = profileEvalFn(userArg)
  if(logBlocks.length) {
    const deleteCruft = logger.deleteCruftFn(logBlocks);
    deleteCruft().then(profileEval);
  }else{
    lv("else", 12)
    profileEval();
  }



  //   }else{
  //     // flash highlight on form to be evaluated.
  //     decorate.highlightEvalForm(state);
  //     const newSurf = logger.logBlock(state);
  //     state.logBlock = newSurf;
  //     const injectBlank = logger.insertBlankTextFn(state, newSurf);
  //     const injectText = logger.insertTextFn(state, newSurf);
  //     const save = util.saveFileFn(state);
  //     const ghostLog = logger.ghostLogFn(state);
  //     const deleteLogBlock = logger.deleteLogBlockFn(state);
  //     injectBlank().then(ghostLog).then(injectText).then(save).then(deleteLogBlock);
  //   }

//  if point is within commented form, bail.
//     select outer form
//     get range of selection
//     get range of selection-2 <-> selection
//     is it "#_" ?


//  if point is within logwrap, bail unless its unwrap
//     select outer form
//     get range of selection
//     get range of selection+3
//     is it "(#_?" ?


//  index all strings
//  eval current expression:
//    if point is within string, select current string
//    else select current form
//  logwrap current expression:
//    if point is within string, select current string
//    else select current form


  // let logBlocks = logger.rrLogBlocks(editor);

  // if(logBlocks.length){
  //   vscode.window.activeTextEditor.edit(edit => {
  //     logBlocks.reverse().forEach( range => {
  //         let r = new vscode.Range(editor.document.positionAt(range[0]), editor.document.positionAt(range[1]))
  //         console.log("range!", r)
  //         edit.replace(r, "");
  //     });
  //   })
  // }else{
  //   // Create object that represents the current buffer
  //   const state = bufferState.getBufferState(editor, userArg);

  //   // If file is not .cljs or .cljc, show warning and exit
  //   if (!state) {
  //     vscode.window.showWarningMessage("repl-repl:  File extention must be .cljs or .cljc.")
  //     return;
  //   }

  //   state.logTuple = control.flow(state);
  //   console.log("state", state);

  //   if (state.logTuple && state.logTuple[1] === "warning") {
  //     state.warning = "repl-repl: "+state.logTuple[0];
  //   }

  //   util.logStateInfo(state);
  //   state.copied = state[state.logTuple[0]];

  //   // CF
  //   if (state.warning){
  //     vscode.window.showWarningMessage(state.warning)
  //   }else if (state.rlw){
  //     //console.log(state.blackListedRange);
  //     const replaceLogWrap = logger.replaceLogWrapFn(state);
  //     //const save = util.saveFileFn(state);
  //     replaceLogWrap()
  //   }else if(state.lwof || state.lwcf || state.lwce){
  //     state.logBlock = logger.logWrap(state);
  //     const injectNew = logger.injectNewFn(state);
  //     injectNew()
  //   }else{
  //     // flash highlight on form to be evaluated.
  //     decorate.highlightEvalForm(state);
  //     const newSurf = logger.logBlock(state);
  //     state.logBlock = newSurf;
  //     const injectBlank = logger.insertBlankTextFn(state, newSurf);
  //     const injectText = logger.insertTextFn(state, newSurf);
  //     const save = util.saveFileFn(state);
  //     const ghostLog = logger.ghostLogFn(state);
  //     const deleteLogBlock = logger.deleteLogBlockFn(state);
  //     injectBlank().then(ghostLog).then(injectText).then(save).then(deleteLogBlock);
  //   }
  // }
}

// extension is activated the very first time the command is executed
function activate(context) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  //console.log('Congratulations, your extension "repl-repl" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json

  let evalOutermostForm = vscode.commands.registerCommand('repl-repl.eval-outermost-form',
    () => replrepl('eval-outermost-form')
  );
  let evalCurrentForm = vscode.commands.registerCommand('repl-repl.eval-current-form',
    () => replrepl('eval-current-form')
  );
  let evalCurrentExpression = vscode.commands.registerCommand('repl-repl.eval-current-expression',
    () => replrepl('eval-current-expression')
  );
  let logWrapOuterForm = vscode.commands.registerCommand('repl-repl.log-wrap-outer-form',
    () => replrepl('log-wrap-outermost-form')
  );
  let logWrapCurrentForm = vscode.commands.registerCommand('repl-repl.log-wrap-current-form',
    () => replrepl('log-wrap-current-form')
  );
  let logWrapCurrentExpression = vscode.commands.registerCommand('repl-repl.log-wrap-current-expression',
    () => replrepl('log-wrap-current-expression')
  );
  let removeLogWrap = vscode.commands.registerCommand('repl-repl.remove-log-wrap',
    () => replrepl('remove-log-wrap')
  );
  //let disposable = vscode.commands.registerCommand('extension.replrepl', replrepl);
  context.subscriptions.push(evalOutermostForm);
  context.subscriptions.push(evalCurrentForm);
  context.subscriptions.push(evalCurrentExpression);
  context.subscriptions.push(logWrapOuterForm);
  context.subscriptions.push(logWrapCurrentForm);
  context.subscriptions.push(logWrapCurrentExpression);
  context.subscriptions.push(removeLogWrap);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;
