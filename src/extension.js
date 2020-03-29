'use strict'
const vscode = require('vscode');
const logger = require('./logger');
const decorate = require('./decorate');
let pe = require('paredit.js');

// Paredit fns ////////////////////////////////////////////////////////////////

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

const sexpRangeExpansion = wrapPareditCommand(navigateRange(pe.navigator.sexpRangeExpansion));
const forwardDownSexp = wrapPareditCommand(navigate(pe.navigator.forwardDownSexp));
const backwardSexp = wrapPareditCommand(navigate(pe.navigator.backwardSexp));
const forwardSexp = wrapPareditCommand(navigate(pe.navigator.forwardSexp));
const rangeForDefun = wrapPareditCommand(navigate(pe.navigator.rangeForDefun));
const backwardUpSexp = wrapPareditCommand(navigate(pe.navigator.backwardUpSexp));

// Repl Repl Utility Fns //////////////////////////////////////////////////////
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
      vscode.window.activeTextEditor.document.save();
    }
  );
}

function isStartOfReifiedSymbol(s, range){
  let editor = vscode.window.activeTextEditor;
  if(s === "@"){
    let textRangeStartIdx = editor.document.offsetAt(range.start);
    let followingChar = charAtIdx(textRangeStartIdx+1);
    return (followingChar !== " ");
  }
}

function isStartOfSpecialForm(s, range){
  let editor = vscode.window.activeTextEditor;
  if(["#", "'", "@"].includes(s)){
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
  forwardDownSexp();
  // TODO ADD something following \s\S ?? or make regex find the index ...
  let m = /^\(comment\s+\:js\s+([\s\S]+)/gm;
  if(m.test(o.text)){
    let i = o.text.indexOf(":js")
    let newStartPos = posForIdx(idxForPos(o.textRange.start) + i + 4)
    let newEndPos = posForIdx(idxForPos(o.textRange.end) - 1)
    let s = new vscode.Selection(newStartPos, newEndPos);
    vscode.window.activeTextEditor.selection = s;
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
  rangeForDefun();
  return getFormInfo(selectedText()).isForm;
}


function selectPrintWrapArg () {
  forwardDownSexp();
  forwardSexp();
  forwardSexp();
  sexpRangeExpansion();
}


function newRange (range, startOffset, endOffset){
  return new vscode.Range(posForIdx(idxForPos(range.start) + startOffset),
                          posForIdx(idxForPos(range.end) + endOffset));
}

function textRangeCharsAndForms(_text, textRange, type){
  // lv("type", type)
  // lv("textRange", textRange)
  // lv("text", _text)
  let endPosition = endPos();
  let fileExtension = fileExt();
  // let isStringOutsideForm = false;
  // let isKeywordOutsideForm = false;
  // let isSymbolOutsideForm = false;
  // let isNumberOutsideForm = false;
  let isJSComment = false;
  let editor = vscode.window.activeTextEditor;
  let textRangeStartIdx = editor.document.offsetAt(textRange.start);
  let textRangeEndIdx = editor.document.offsetAt(textRange.end);
  let precedingChar = (textRangeStartIdx !== 0) ? charAtIdx(textRangeStartIdx-1) : null;
  let preceding2Char = (textRangeStartIdx > 1) ? charAtIdx(textRangeStartIdx-2) : null;
  let preceding3Char = (textRangeStartIdx > 2) ? charAtIdx(textRangeStartIdx-3) : null;
  let p2Chars = preceding2Char + precedingChar;
  let p3Chars = preceding3Char + p2Chars;
  // Todo, case near EOF
  let followingChar = charAtIdx(textRangeEndIdx);
  let following2Char = charAtIdx(textRangeEndIdx+1);
  let firstChar = _text.charAt(0);
  let lastChar = _text.charAt(_text.length-1);
  let isString = ( firstChar === '"' && lastChar === '"' );
  let isStringContents = ( precedingChar === '"' && followingChar === '"' );
  let isStringContentsRegex = isStringContents && (preceding2Char === "#");
  let isStringRegex = isString && (precedingChar === "#");
  let isRegex = isStringRegex || isStringContentsRegex;
  let isCommentedSpecialForm = ["#_#", "#_'", "#_@", "#_%", "#_\n", "#_\""].includes(p3Chars);
  let isCommentedSymbol = ( firstChar === '_' && precedingChar === '#' );
  let isCommentedForm = ( p2Chars === "#_" );
  let isCommented = isCommentedSpecialForm || isCommentedSymbol || isCommentedForm;
  let isMap = ( firstChar === '{' && lastChar === '}' );
  let isSexp = ( firstChar === '(' && lastChar === ')' );
  let isVector = (firstChar === '[' && lastChar === ']' );
  let isForm = isMap || isSexp || isVector;
  let isSet = isMap && firstChar === "{" && precedingChar === "#";
  let isAnonFn = isSexp && precedingChar === "#";
  let isList = isSexp && precedingChar === "'";
  let isReified = !isString && !isForm && precedingChar === "@";
  let isSpecialForm = isSet || isAnonFn || isList || isReified;
  let isPrintMacroFnCall = /^\(\?\s\S.*/gm.test(_text);
  let isSilentPrintMacroFnCall = /^\(!\?\s\S.*/gm.test(_text);
  let range = textRange;
  let text = _text;
  let commentedRange = undefined;
  let commentedText = undefined;

  if(isCommented){
    if (isCommentedSpecialForm && isStringContentsRegex) {
      commentedRange = newRange(range, -4, 0);
    }else if (isCommentedSpecialForm) {
      commentedRange = newRange(range, -3, 0);
    }else if (isStringContents) {
      commentedRange = newRange(range, -3, 1);
    }else if (isString || isCommentedForm) {
      commentedRange = newRange(range, -2, 0);
    }else if (isCommentedSymbol) {
      commentedRange = newRange(range, -1, 0);
    }
    commentedText = vscode.window.activeTextEditor.document.getText(commentedRange);
  }

  if (isStringContentsRegex) {
    range = newRange(range, -2, 1);
  }else if (isSpecialForm || isStringRegex) {
    range = newRange(range, -1, 0);
  }else if (isCommentedSymbol) {
    range = newRange(range, 1, 0);
  }else if (isStringContents) {
    range = newRange(range, -1, 1);
  }

  // lv("og text", text)
  // lv("type", type)
  text = vscode.window.activeTextEditor.document.getText(range);
  // lv("text with new range", text)

  return {
    type,
    text,
    commentedText,
    range,
    commentedRange,
    textRangeStartIdx,
    textRangeEndIdx,
    precedingChar,
    preceding2Char,
    preceding3Char,
    followingChar,
    following2Char,
    firstChar,
    lastChar,
    isMap,
    isSexp,
    isSet,
    isVector,
    isString,
    isStringContents,
    isStringRegex,
    isStringContentsRegex,
    isRegex,
    isCommentedSpecialForm,
    isCommentedSymbol,
    isCommentedForm,
    isCommented,
    isForm,
    isAnonFn,
    isList,
    isReified,
    isSpecialForm,
    isSilentPrintMacroFnCall,
    isPrintMacroFnCall
  }
}


function textRangeDetails(type){
  let text = selectedText();
  let textRange = selectionRange();
  return textRangeCharsAndForms(text, textRange, type);
}


function getFormLevels(point) {
  let o = {};
  rangeForDefun();
  o.topLevel = textRangeDetails("topLevel");
  vsSendCursorToPos(point);
  backwardUpSexp();
  sexpRangeExpansion();
  o.currentForm = {
    range: selectionRange(),
    text: selectedText()
  }
  o.currentForm = textRangeDetails("currentForm");
  vsSendCursorToPos(point);
  sexpRangeExpansion();
  o.currentExpression = textRangeDetails("currentExpression");
  vsSendCursorToPos(point);
  return o;
}


function consolePrintWrappedText(o){
  //clear selection and place cursor on last index in selection
  vsSendCursorToEndPos(o.textRange.end)
  //clear selection and place cursor on last index in selection
  backwardSexp();
  sexpRangeExpansion();
  if (selectedText() === '"\\n\\n"'){
    vsSendCursorToEndPos(o.textRange.end)
    backwardSexp();
    backwardSexp();
    sexpRangeExpansion();
  }
  let {textRange, isSet, isAnonFn, isList} = textRangeDetails();
  let newLwTextRange = (isSet || isList || isAnonFn) ?
    new vscode.Range(posForIdx(idxForPos(textRange.start) - 1), textRange.end)
    :
    textRange
  return vscode.window.activeTextEditor.document.getText(newLwTextRange);
}


function makeid(length) {
  var result           = '';
  var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for ( var i = 0; i < length; i++ ) {
     result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function injectAndRevert(o, s, id, ogPoint){
  const injectNew = logger.injectNewFn(o.range, s);
  const revert = logger.revertPrintBlockFn(o, id);
  const save = saveFileFn();
  injectNew()
  .then(save)
  .then(
    function(){
      setTimeout(function(){
        revert().then(function(){
          decorate.highlightEvalForm(o.range);
          vsSendCursorToPos(ogPoint);
        });
      }, 500);
    });
}

function selectPrintWrap(o){
  rangeForDefun();
  let outerFormText = selectedText();
  if(/\(js\/console.log /.test(selectedText())) {
    console.log("has console.log inside")
    vsSendCursorToPos(o.ogPoint);
    if(isInsideForm()) {
      vsSendCursorToPos(o.ogPoint);
      let isPrintWrap = false;
      let isOuterFormTextMatch = false;
      while (!isPrintWrap && !isOuterFormTextMatch) {
        sexpRangeExpansion();
        let currentText = selectedText();
        isPrintWrap = (/^\(js\/console.log .*/.test(currentText));
        isOuterFormTextMatch = (currentText === outerFormText)
        if (isPrintWrap){
          return;
        }else if(isOuterFormTextMatch){
          vsSendCursorToPos(o.ogPoint);
          return;
        }
      }
    }
  }else{
    vsSendCursorToPos(o.ogPoint);
    return;
  }
}

function removePrintWrap(p){
  if(p.isConsolePrintWrap){
    const replacePrintWrap = logger.replacePrintWrapFn(p);
    replacePrintWrap()
    .then(
      function(){
        try{
          vscode.commands.executeCommand("calva-fmt.formatCurrentForm");
        }catch(e){
          console.warn("Repl-Repl attempted to execute 'Calva: Format Current Form', in order to reformat the unwrapped print block. Most likely Calva is not installed");
          console.error(e);
        }
      }
    )
    return;
  }else{
    vscode.window.showWarningMessage("repl-repl: Point must be inside a print-wrapped form.");
    return;
  }
}

const selectTextFns = {

  "eval-current-form": (o) => {
    if (isInsideForm()) {
      vsSendCursorToPos(o.ogPoint);
      let isForm = false;
      while (!isForm) {
        sexpRangeExpansion();
        isForm = getFormInfo(selectedText()).isForm;
      }
    }
  },

  "eval-on-point": (o) => {
    vsSendCursorToPos(o.ogPoint);
    sexpRangeExpansion();
    // TODO make this work for strings like "   wtf " (where you have some trimmable whitespace)
    if(isTextInsideString()) {
      sexpRangeExpansion();
    }
  },

  "eval-outermost-form": rangeForDefun,

  "print-wrap-symbol-with-annotation": sexpRangeExpansion,

  "print-wrap-on-point": sexpRangeExpansion,

  "doc": sexpRangeExpansion

}

function modifySelectionForSpecialForms(o){
  // If we try to eval-outermost-form (or eval-current-form on top-level)
  // while point is on the first 2 chars of a set, list, or anon fn,
  // we will need to modify selection
  if(isStartOfSpecialForm(selectedText(), selectionRange())){
    vsSendCursorToPos(o.ogPoint);
    forwardDownSexp();
    sexpRangeExpansion();
    sexpRangeExpansion();
    sexpRangeExpansion();
  }

  if(isStartOfReifiedSymbol(selectedText(), selectionRange())){
    sexpRangeExpansion();
  }
}

function setTextAndRange(o){
  o.textRange = selectionRange();
  let text = validateText(selectedText(), o.textRange);
  o.text = text;

  if(!o.text){
    o.textRange = null
  }
}

function modifyForListsSetsOrAnonFns(o){
  let editor = vscode.window.activeTextEditor;
  if(["'", "#"].includes(o.text)){
    vsSendCursorToPos(o.ogPoint);
    forwardSexp();
    let offsetIdx = editor.document.offsetAt(editor.selection.active);
    let char = editor.document.getText().substring(offsetIdx, offsetIdx + 1);
    if(["(", "{"].includes(char)){
      o.text = null
      const formType = (char==="(") ? "list or anonymous function" : "set";
      vscode.window.showWarningMessage("repl-repl: If you are trying to eval a " + formType + ", your cursor must be on or inside brackets");
    }
  }
}

function addRangeForPrintWrap(o){
  let selectedPrintWrap = selectedText();
  o.isConsolePrintWrap = (selectedPrintWrap && (selectedPrintWrap !== ""));
  if(o.isConsolePrintWrap){
    o.textRange = selectionRange();
    let text = validateText(selectedText(), o.textRange);
    o.text = text;

    if(!o.text){
      o.textRange = null
    }
    o.consolePrintWrappedText = consolePrintWrappedText(o);
  }
}

// When point is on a special char "#", on commented set, regex, or anon fn.
// keys are a result of running:
// [o.currentExpression.text, o.currentForm.text, o.topLevel.text].join("")
const _cft = {
  "#,#,#":       {types: ["reified", "anon-fn", "string", "set", "list", "regex", "number"],
                  examples: ["#_@aaa", "#_#(inc %)", "#_\"hello\"", "#_#{1 2 3}", "#_'(1 2 3)", "#\"\d", "12"],
                  pointAtPos: 0},

  "#,#,#_":      {types: ["anon-fn", "set", "regex"],
                  examples: ["#_#(inc %)", "#_#{1 2 3}", "#_#\"\d"],
                  pointAtPos: 2},

  "#_,#_,#":     {types: ["anon-fn", "set", "regex"],
                  examples: ["#_#(inc %)", "#_#{1 2 3}", "#_#\"\d"],
                  pointAtPos: 1},

  "@,@,#_":      {types: ["reified"],
                  examples: ["#_@aaa"],
                  pointAtPos: 2},

  "#_',#_',#":   {types: ["reified", "anon-fn", "string", "set", "regex", "number"],
                  examples: ["#_@aaa", "#_#(inc %)", "#_\"hello\"", "#_#{1 2 3}", "#\"\d", "12"],
                  pointAtPos: 1},

  "#_',#_',#_'": {types: ["list"],
                  examples: ["#_'(1 2 3)"],
                  pointAtPos: 2}
}


function getOg(o){
  let ogPoint = cursorPos();
  return {
    ogPoint: ogPoint,
    ogPointText: charAtIdx(idxForPos(ogPoint))
  }
}


function adjustForCommenting(o){
  let {ogPoint, ogPointText} = getOg();
  let ogPointAdjusted = undefined;
  let offset = undefined;
  // lo("first texts", [o.currentExpression.text, o.currentForm.text, o.topLevel.text].join(","));
  let cftKey = [o.currentExpression.text, o.currentForm.text, o.topLevel.text].join(",");
  // lv("cftKey", cftKey)
  let cft = _cft[ cftKey ];
  let follow = o.currentExpression.followingChar;
  let follow2 = o.currentExpression.following2Char;
  //  lo("cft", cft)
  //  lv("following2Char", follow2);
  //  lv("followingChar", follow);
  //  lv("includes?", ["#", "'", "@"].includes(follow2))

  if(cft){
    if(cftKey === "#,#,#" && ["#", "'", "@"].includes(follow2)){
      console.log("special form, point on pound, offset=3")
      offset = 3
    }else if (cftKey === "#_,#_,#"){
      if(["#", "'", "@"].includes(follow)){
        console.log("special form, point on underscore, offset=2")
        offset = 2
      }else{
        console.log("point on underscore, offset=1")
        offset = 1
      }
    }else if (cftKey === "#,#,#_" || cft === "@,@,#_"){
      console.log("point on atsign or special pound, offset = 1")
      offset = 1;
    }else if (cftKey === "#_',#_',#_'"){
      console.log("point on ', list, offset=1")
      offset = 1;
    }else if (cftKey === "#_',#_',#"){
      console.log("point on underscore, list, offset=2")
      offset = 2;
    }else{
      console.log("offset defaulting to 2")
      offset = 2;
    }

    // lv("offset", offset)
    ogPointAdjusted = posForIdx(idxForPos(ogPoint) + offset);
    console.log("RERUNNING!!!!")
    // lv("ogPoint text", ogPointText)
    // lv("ogPoint text adjusted", charAtIdx(idxForPos(ogPointAdjusted)))
    o = getFormLevels(ogPointAdjusted);
    // lo("new texts", [o.currentExpression.text, o.currentForm.text, o.topLevel.text].join(","));
  }else{
    
  }
  // lo("currentExpression", o.currentExpression)
  return o;
}


// function profile(userArg){

//   modifySelectionForSpecialForms(o);
//   setTextAndRange(o);
//   modifyForListsSetsOrAnonFns(o);

//   if(o.text){
//     let details = textRangeCharsAndForms(o.text, o.textRange)

//     //MUTATING o to add textRange and form details
//     Object.assign(o, details);
//     let p2Chars = o.preceding2Char + o.precedingChar;
//     o.isCommentedForm = ( p2Chars === "#_" ) || ( o.preceding3Char + p2Chars === "#_\n" );

//     if(!o.isForm){
//       o.isStringOutsideForm = o.firstChar==='"' && o.lastChar==='"';
//       o.isKeywordOutsideForm = o.firstChar===':';
//       o.isSymbolOutsideForm = o.firstChar==="'";
//       const isNumRe = /^[0-9|.]*$/gm;
//       o.isNumberOutsideForm = isNumRe.test(o.text);
//     }else{
//       o.isSet = o.isMap && o.firstChar === "{" && o.precedingChar === "#";
//       o.isAnonFn = o.isSexp && o.precedingChar === "#";
//       o.isList = o.isSexp && o.precedingChar === "'";

//       o.jsComment = jsComment(o);
//     }
//     // convert start pos to -1
//     o.textRange = (o.isSet || o.isList || o.isAnonFn || o.isReified) ?
//       new vscode.Range(posForIdx(idxForPos(o.textRange.start) - 1), o.textRange.end)
//       :
//       o.textRange;
//     o.textToEval = vscode.window.activeTextEditor.document.getText(o.textRange)
//   }
//   vsSendCursorToPos(o.ogPoint);
//   return o;
// }


function revertCursor(n, ogPoint){
  vsSendCursorToPos(posForIdx(idxForPos(ogPoint) + n))
}

function profileEvalFn(userArg){
  return () => {
    let editor = vscode.window.activeTextEditor;
    let cursorPos =  editor.selection.active;
    let currentLineText = editor.document.lineAt(cursorPos.line).text;
    // If point is on commented line(first char on line is semicolon), bail.
    let leadingChar = currentLineText.trim().charAt(0);
    let isCommentLine = leadingChar === ";"
    let isBlankLine = (currentLineText === "" || !currentLineText);
    if (isCommentLine){
      vscode.window.showWarningMessage("repl-repl: Commented line")
      return;
    }else if (isBlankLine){
      vscode.window.showWarningMessage("repl-repl: Blank line")
      return;
    }

    let {ogPoint, ogPointText} = getOg();
    let o = getFormLevels(ogPoint);

    o = adjustForCommenting(o)
    o.ogPoint = ogPoint;
    o.ogPointText = ogPointText;

    if(userArg === "uncomment"){
      let target = [o.currentExpression, o.topLevel, o.currentForm].find(o => o.isCommented);
      if(target){
        const injectNew = logger.injectNewFn(target.commentedRange, target.text);
          injectNew();
      }else{
          vscode.window.showWarningMessage("repl-repl: Point is currently not on a commented form. A commented form must be an expression prepended with \"#_\"");
      }
    }

    if(userArg === "comment"){
      let target = o.currentExpression;
      if (o.topLevel.isCommented || o.currentForm.isCommented || target.isCommented ) {
          vscode.window.showWarningMessage("repl-repl: Point is currently on, or in, a commented form.");
      }else if (target) {
        const injectNew = logger.injectNewFn(target.range, `#_${target.text}`);
        injectNew();
      }
    }

    if(userArg === "print-macro-wrap"){
      let target = o.currentExpression;
      if (target.isPrintMacroFnCall) {
          vscode.window.showWarningMessage("repl-repl: Point is currently on, or in, a print macro fn call.");
      }else if (target) {
        let newText = target.isSilentPrintMacroFnCall ? target.text.substring(3).substring(-1) : target.text
        const injectNew = logger.injectNewFn(target.range, `(? ${newText})`);
        injectNew();
      }
    }

    if(userArg === "remove-print-macro-wrap"){
      let target = [o.currentExpression, o.currentForm, o.topLevel].find(o => o.isPrintMacroFnCall || o.isSilentPrintMacroFnCall);
      if (!target) {
        vscode.window.showWarningMessage("repl-repl: Point is currently not in a print macro fn call.");
      }else{
        vsSendCursorToPos(posForIdx(idxForPos(target.range.end)-1))
        backwardSexp();
        sexpRangeExpansion();
        const injectNew = logger.injectNewFn(target.range, selectedText());
        injectNew();
        let revertOffset = target.isPrintMacroFnCall ? -3 : -4;
        revertCursor(revertOffset, o.ogPoint);
      }
    }

    function evalForms(sexpObj) {
      let id = makeid(15);
      const printBlock = logger.printBlock(sexpObj, id);
      injectAndRevert(sexpObj, printBlock, id, o.ogPoint);
    }

    if(userArg === "eval-current-form") {
      evalForms(o.currentForm);
    }

    if(userArg === "eval-on-point") {
      evalForms(o.currentExpression);
    }

    if(userArg === "eval-outermost-form") {
      evalForms(o.topLevel);
    }

    if(userArg === "doc") {
      let id = makeid(15);
      let {range} = o.topLevel;
      let {text} = o.currentExpression;
      let printBlock = `(use '[cljs.repl :only [doc]]) (console.clear) (doc ${text}) #_"${id}"`;
      let injectionRange = new vscode.Range(range.end, range.end);
      injectAndRevert({range: injectionRange}, printBlock, id, o.ogPoint);
    }

    //lo("o", o)

    return;
    // if (userArg === "remove-print-wrap") {
    //   selectPrintWrap(o);
    //   addRangeForPrintWrap(o)
    //   vsSendCursorToPos(o.ogPoint);
    //   return o;
    // }else{
    //   selectTextFns[userArg](o);
    // }
      // possibly move this logic down into branching below?

  //   if (userArg === "remove-print-wrap") {
  //     removePrintWrap(p);

  //   }else if(p.textRange) {
  //     if(p.isConsolePrintWrap && (userArg !== "remove-print-wrap")){
  //       vscode.window.showWarningMessage("repl-repl: Currently inside print wrapped form.");

  //     }else if (userArg ==="print-wrap-symbol-with-annotation"){
  //       if (!p.isForm) {
  //         const printWrap = logger.printWrap(p);
  //         const injectNew = logger.injectNewFn(p.textRange, printWrap);
  //         injectNew();
  //       }else{
  //         vscode.window.showWarningMessage("repl-repl: Point is currently on a form. In order to create an annoted print-wrap, point must be on a symbol, number, string, or keyword.");
  //       }

  //     }else if (userArg ==="print-wrap-on-point"){
  //       const printWrapSimple = logger.printWrapSimple(p);
  //       const injectNew = logger.injectNewFn(p.textRange, printWrapSimple);
  //       injectNew();

  //     }else if (userArg === "doc"){
  //       if(!p.isForm && !p.isString && !p.isAnonFn && !p.isReified && !p.isCommentedForm && !p.isConsolePrintWrap && !p.isJSComment){
  //         let id = makeid(15);
  //         const docBlock = logger.doc(p.textToEval, id);
  //         injectAndRevert(p, docBlock, id);
  //       }else{
  //         vscode.window.showWarningMessage("repl-repl: In order to , the cursor must be on a function symbol");
  //       }
  //     }else{
  //       let id = makeid(15);
  //       const printBlock = logger.printBlock(p, id);
  //       injectAndRevert(p, printBlock, id);
  //     }
  //   }
   }
}


function replrepl (userArg) {
  let editor = vscode.window.activeTextEditor;
  if (!editor){
    return;
  }
  profileEvalFn(userArg)();
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
  let evalOnPoint = vscode.commands.registerCommand('repl-repl.eval-on-point',
    () => replrepl('eval-on-point')
  );
  let printWrapOnPoint = vscode.commands.registerCommand('repl-repl.print-wrap-on-point',
    () => replrepl('print-wrap-on-point')
  );
  let printMacroWrap = vscode.commands.registerCommand('repl-repl.print-macro-wrap',
    () => replrepl('print-macro-wrap')
  );
  let printWrapSymbolWithAnnotation = vscode.commands.registerCommand('repl-repl.print-wrap-symbol-with-annotation',
    () => replrepl('print-wrap-symbol-with-annotation')
  );
  let removePrintMacroWrap = vscode.commands.registerCommand('repl-repl.remove-print-macro-wrap',
    () => replrepl('remove-print-macro-wrap')
  );
  let removePrintWrap = vscode.commands.registerCommand('repl-repl.remove-print-wrap',
    () => replrepl('remove-print-wrap')
  );
  let comment = vscode.commands.registerCommand('repl-repl.comment',
    () => replrepl('comment')
  );
  let uncomment = vscode.commands.registerCommand('repl-repl.uncomment',
    () => replrepl('uncomment')
  );
  let doc = vscode.commands.registerCommand('repl-repl.doc',
    () => replrepl('doc')
  );
  context.subscriptions.push(evalOutermostForm);
  context.subscriptions.push(evalCurrentForm);
  context.subscriptions.push(evalOnPoint);
  context.subscriptions.push(removePrintWrap);
  context.subscriptions.push(removePrintMacroWrap);
  context.subscriptions.push(uncomment);
  context.subscriptions.push(comment);
  context.subscriptions.push(doc);
  context.subscriptions.push(printWrapOnPoint);
  context.subscriptions.push(printMacroWrap);
  context.subscriptions.push(printWrapSymbolWithAnnotation);

}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;
