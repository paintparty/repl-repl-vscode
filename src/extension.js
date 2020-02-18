'use strict'
const vscode = require('vscode');
const logger = require('./logger');
const decorate = require('./decorate');
let pe = require('paredit.js');

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
  vscode.window.activeTextEditor.selection = s;
}

function vsSendCursorToPos(pos){
  _vsSendCursorToPos(pos, false);
}

function vsSendCursorToEndPos(pos){
  _vsSendCursorToPos(pos, true);
}

function lo (s, o){
  console.log("\n\n"+s, JSON.stringify( o, null, 2 ))
}

function lv (s, v){
  console.log("\n\n"+s, v)
}


function isTextInsideString(){
  let textRange = selectionRange();
  let editor = vscode.window.activeTextEditor;
  let textRangeStartIdx = editor.document.offsetAt(textRange.start);
  let textRangeEndIdx = editor.document.offsetAt(textRange.end);
  let precedingChar = (textRangeStartIdx !== 0) ? charAtIdx(textRangeStartIdx-1) : null;
  //TODO GET LAST IDX OF DOC for 9999
  let followingChar = (textRangeEndIdx !== 9999) ? charAtIdx(textRangeEndIdx) : null;
  return followingChar==='"' && precedingChar==='"';
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

function isStartOfSpecialForm(s, range){
  let editor = vscode.window.activeTextEditor;
  // return null if text is one of these: [# ' "]
  if(["#", "'"].includes(s)){
    let textRangeStartIdx = editor.document.offsetAt(range.start);
    let followingChar = charAtIdx(textRangeStartIdx+1);
    return ["(", "{"].includes(followingChar);
   }
}

/* Invalidate if "#_" */
function validateText(s, range){
  let editor = vscode.window.activeTextEditor;

  // return null if text is one of these: [# ' "]
  if(["#", "'", "\""].includes(s)){
    let textRangeStartIdx = editor.document.offsetAt(range.start);
    let followingChar = charAtIdx(textRangeStartIdx+1);
    return null;

  // return null if `#_` is used to comment out form
  }else if(s === "_"){
    let textRangeStartIdx = editor.document.offsetAt(range.start);
    let precedingChar = (textRangeStartIdx !== 0) ? charAtIdx(textRangeStartIdx-1) : null;
    if (precedingChar==="#"){
      return null
    }

  // return null if comment
  }else if(s.match(/^;/)){
    return null;

  // return null if % binding inside anon fn
  }else if(s.match(/^%/)){
    return null;

  // return valid text
  }else{
    return s;
  }
}

function jsComment(o){
  vsSendCursorToPos(o.textRange.start)
  vscode.commands.executeCommand("repl-repl.utilForwardDownSexp");
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
}

function getFormInfo(text){
  let firstChar = text.charAt(0);
  let lastChar = text.charAt(text.length-1);
  let isMap = ( firstChar === '{' && lastChar === '}' );
  let isSexp = ( firstChar === '(' && lastChar === ')' );
  let isVector = (firstChar === '[' && lastChar === ']' );
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

function isInsideForm(){
  vscode.commands.executeCommand("repl-repl.utilRangeForDefun");
  return getFormInfo(selectedText()).isForm;
}

function textRangeCharsAndForms(text, textRange){
  let editor = vscode.window.activeTextEditor;
  let textRangeStartIdx = editor.document.offsetAt(textRange.start);
  let textRangeEndIdx = editor.document.offsetAt(textRange.end);
  let precedingChar = (textRangeStartIdx !== 0) ? charAtIdx(textRangeStartIdx-1) : null;
  let preceding2Char = (textRangeStartIdx > 1) ? charAtIdx(textRangeStartIdx-2) : null;
  let preceding3Char = (textRangeStartIdx > 2) ? charAtIdx(textRangeStartIdx-3) : null;
  let { firstChar, lastChar, isMap, isSexp, isVector, isString, isForm } = getFormInfo(text)
  let isSet = isMap && firstChar === "{" && precedingChar === "#";
  let isAnonFn = isSexp && precedingChar === "#";
  let isList = isSexp && precedingChar === "'";
  let isReified = !isString && !isForm && precedingChar === "@";
  return {
    textRangeStartIdx,
    textRangeEndIdx,
    precedingChar,
    preceding2Char,
    preceding3Char,
    firstChar,
    lastChar,
    isMap,
    isSexp,
    isSet,
    isVector,
    isString,
    isForm,
    isAnonFn,
    isList,
    isReified
  }
}

function textRangeDetails(){
  let text = selectedText();
  let textRange = selectionRange();
  return Object.assign({textRange}, textRangeCharsAndForms(text, textRange));
}

function consoleLogWrappedText(o){
  //clear selection and place cursor on last index in selection
  vsSendCursorToEndPos(o.textRange.end)
  //clear selection and place cursor on last index in selection
  vscode.commands.executeCommand("repl-repl.utilBackwardSexp");
  vscode.commands.executeCommand("repl-repl.utilBackwardSexp");
  vscode.commands.executeCommand("repl-repl.utilSexpRangeExpansion");
  let {textRange, isSet, isAnonFn, isList} = textRangeDetails();
  let newLwTextRange = (isSet || isList || isAnonFn) ?
    new vscode.Range(posForIdx(idxForPos(textRange.start) - 1), textRange.end)
    :
    textRange
  return vscode.window.activeTextEditor.document.getText(newLwTextRange);
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

  if(userArg === "remove-log-wrap"){
    vscode.commands.executeCommand("repl-repl.utilRangeForDefun");
    let outerFormText = selectedText();
    if (/^\(js\/console.log "\\n"/.test(outerFormText)){
      //do nothing.
    }else if (/\(js\/console.log "\\n"/.test(selectedText())){
      vsSendCursorToPos(o.ogPoint);
      if(isInsideForm()) {
        vsSendCursorToPos(o.ogPoint);
        let isLogWrap = false;
        let isOuterFormTextMatch = false;
        while (!isLogWrap && !isOuterFormTextMatch) {
          vscode.commands.executeCommand("repl-repl.utilSexpRangeExpansion");
          let currentText = selectedText();
          isLogWrap = (/^\(js\/console.log "\\n"/.test(currentText));
          if (isLogWrap) {
          }
          isOuterFormTextMatch = (currentText === outerFormText)
          if(isOuterFormTextMatch){
            vsSendCursorToPos(o.ogPoint);
            o.cursorNotInLogWrap = true;
            return o;
          }
        }
      }
    }
  }else if(["log-wrap-outermost-form",
            "eval-outermost-form"].includes(userArg)) {
    vscode.commands.executeCommand("repl-repl.utilRangeForDefun");
  }else if(["log-wrap-current-form",
            "eval-current-form"].includes(userArg)) {
    if (isInsideForm()) {
      vsSendCursorToPos(o.ogPoint);
      let isForm = false;
      while (!isForm) {
        vscode.commands.executeCommand("repl-repl.utilSexpRangeExpansion");
        isForm = getFormInfo(selectedText()).isForm;
      }
    }
  }else if(["log-wrap-current-expression", "eval-current-expression"].includes(userArg)) {
    vsSendCursorToPos(o.ogPoint);
    vscode.commands.executeCommand("repl-repl.utilSexpRangeExpansion");
    // TODO make this work for strings like "   wtf " (where you have some trimmable whitespace)
    if(isTextInsideString()) {
      vscode.commands.executeCommand("repl-repl.utilSexpRangeExpansion");
    }else{

    }
  }

  // If we try to eval-outermost-form (or eval-current-form on top-level)
  // while point is on the first 2 chars of a set, list, or anon fn,
  // we will need to modify selection
  if(isStartOfSpecialForm(selectedText(), selectionRange())){
    vsSendCursorToPos(o.ogPoint);
    vscode.commands.executeCommand("repl-repl.utilForwardDownSexp");
    vscode.commands.executeCommand("repl-repl.utilSexpRangeExpansion");
    vscode.commands.executeCommand("repl-repl.utilSexpRangeExpansion");
    vscode.commands.executeCommand("repl-repl.utilSexpRangeExpansion");
  }

  o.textRange = selectionRange();
  let text = validateText(selectedText(), o.textRange);
  o.text = text;

  if(!o.text){
    o.textRange = null
  }

  //lo("textrange", o.textRange)
  //lo("text", o.text)

  if(["'", "#"].includes(o.text)){
    vsSendCursorToPos(o.ogPoint);
    vscode.commands.executeCommand("repl-repl.utilForwardSexp");
    let offsetIdx = editor.document.offsetAt(editor.selection.active);
    let char = editor.document.getText().substring(offsetIdx, offsetIdx + 1);
    if(["(", "{"].includes(char)){
      o.text = null
      const formType = (char==="(") ? "list or anonymous function" : "set";
      vscode.window.showWarningMessage("repl-repl: If you are trying to eval a " + formType + ", your cursor must be on or inside brackets");
    }
  }

  if(o.text){
    let details = textRangeCharsAndForms(o.text, o.textRange)
    //MUTATING o
    Object.assign(o, details);
    let p2Chars = o.preceding2Char + o.precedingChar;
    o.isCommentedForm = ( p2Chars === "#_" ) || ( o.preceding3Char + p2Chars === "#_\n" );

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
        o.consoleLogWrappedText = consoleLogWrappedText(o);
      }
      o.jsComment = jsComment(o);
    }
    o.textRange = (o.isSet || o.isList || o.isAnonFn || o.isReified) ?
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

    // If point is on commented line, bail.
    // If first char on line is semicolon
    let leadingChar = editor.document.lineAt(cursorPos.line).text.trim().charAt(0);
    let isCommentLine = leadingChar === ";"
    if (isCommentLine){
      vscode.window.showWarningMessage("repl-repl: Commented line")
      return;
    }
    //lo("profile", p);
    let p = profile(userArg);
    //lo("profile", p);
    if (p.cursorNotInLogWrap){
      vscode.window.showWarningMessage("repl-repl: The cursor must be inside a form that has been log-wrapped by repl-repl.");
      return;
    }


    if(p.textRange){
      if(p.isConsoleLogWrap && (userArg !== "remove-log-wrap")){
        vscode.window.showWarningMessage("repl-repl: Currently inside log wrapped form.");
      }else if(userArg === "remove-log-wrap"){
        if(p.isConsoleLogWrap){
          const replaceLogWrap = logger.replaceLogWrapFn(p);
          replaceLogWrap();
          return;
        }
      }else if(["log-wrap-outermost-form",
          "log-wrap-current-form",
          "log-wrap-current-expression"].includes(userArg)){
        const logWrap = logger.logWrap(p)
        const injectNew = logger.injectNewFn(p.textRange, logWrap);
        injectNew()
      }else{
        decorate.highlightEvalForm(p.textRange);
        const newSurf  = logger.logBlock(p);
        const injectBlank = logger.insertBlankTextFn(p, newSurf);
        const ghostLog = logger.ghostLogFn(p);
        const injectText = logger.insertTextFn(p, newSurf);
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

function select (editor, pos) {
  let start, end;

  if (typeof pos === "number"){
      start = end = pos;
  }
  else if (pos instanceof Array){
      start = pos[0], end = pos[1];
  }

  let pos1 = editor.document.positionAt(start),
      pos2 = editor.document.positionAt(end),
      sel  = new vscode.Selection(pos1, pos2);

  editor.selection = sel;
  editor.revealRange(sel);
}


const navigate = (fn, ...args) => {
  return ({textEditor, ast, selection}) => {
        let res = fn(ast, selection.cursor, ...args);
        select(textEditor, res);
  }
}

const navigateRange = (fn, ...args) => {
  return ({textEditor, ast, selection}) => {
        let res = fn(ast, selection.start, selection.end, ...args);
        select(textEditor, res);
  }
}

function getSelection (editor) {
  return { start:  editor.document.offsetAt(editor.selection.start),
           end:    editor.document.offsetAt(editor.selection.end),
           cursor: editor.document.offsetAt(editor.selection.active) };
}

function wrapPareditCommand(fn) {
  return () => {
      let textEditor = vscode.window.activeTextEditor;
      let src = textEditor.document.getText();
      fn({ textEditor: textEditor,
           src:        src,
           ast:        pe.parse(src),
           selection:  getSelection(textEditor) });
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
    profileEval();
  }
}

// extension is activated the very first time the command is executed
function activate(context) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  //console.log('Congratulations, your extension "repl-repl" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json
  let utilSexpRangeExpansion = vscode.commands.registerCommand('repl-repl.utilSexpRangeExpansion',
    wrapPareditCommand(navigateRange(pe.navigator.sexpRangeExpansion))
  );

  let utilForwardDownSexp = vscode.commands.registerCommand('repl-repl.utilForwardDownSexp',
    wrapPareditCommand(navigate(pe.navigator.forwardDownSexp))
  );
  let utilBackwardSexp = vscode.commands.registerCommand('repl-repl.utilBackwardSexp',
    wrapPareditCommand(navigate(pe.navigator.backwardSexp))
  );
  let utilForwardSexp = vscode.commands.registerCommand('repl-repl.utilForwardSexp',
    wrapPareditCommand(navigate(pe.navigator.forwardSexp))
  );
  let utilRangeForDefun = vscode.commands.registerCommand('repl-repl.utilRangeForDefun',
    wrapPareditCommand(navigate(pe.navigator.rangeForDefun))
  );
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
  context.subscriptions.push(utilSexpRangeExpansion);
  context.subscriptions.push(utilForwardDownSexp);
  context.subscriptions.push(utilBackwardSexp);
  context.subscriptions.push(utilForwardSexp);
  context.subscriptions.push(utilRangeForDefun);
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
