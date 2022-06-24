'use strict'
const vscode = require('vscode');
const logger = require('./logger');
const decorate = require('./decorate');
let pe = require('paredit.js');

var par = vscode.window.createOutputChannel("PAR")

function lo (s, o){
  console.log("\n\n"+s+"\n", JSON.stringify( o, null, 2 ))
}

function lv (s, v){
  console.log("\n\n"+s, v)
}

// Paredit fns ////////////////////////////////////////////////////////////////

function charAtIdx(idx) {
  let char = vscode.window.activeTextEditor.document.getText().substring(idx, idx + 1);
  return char;
}

function select (editor, pos) {
  let start, end;

  if (typeof pos === "number"){
      start = end = pos;

      // console.log("cai", charAtIdx(pos))
  }
  else if (pos instanceof Array){
      start = pos[0], end = pos[1];
      // console.log("carsi", charAtIdx(start))
      // console.log("carsi", charAtIdx(end))
      let chars = vscode.window.activeTextEditor.document.getText().substring(start, end);
      // console.log("chars", chars)
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
        // lo("navigate", res)
        select(textEditor, res);
  }
}

const navigateRange = (fn, ...args) => {
  return ({textEditor, ast, selection}) => {
        let res = fn(ast, selection.start, selection.end, ...args);
        // lo("navigate Range", res)
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

function fileExt() {
  let fileExtMatch = vscode.window.activeTextEditor.document.fileName.match(/.(clj[sc]?)$/);
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

function newRange (range, startOffset, endOffset){
  return new vscode.Range(posForIdx(idxForPos(range.start) + startOffset),
                          posForIdx(idxForPos(range.end) + endOffset));
}

function getOg(){
  let ogPoint = cursorPos();
  return {
    ogPoint: ogPoint,
    ogPointText: charAtIdx(idxForPos(ogPoint))
  }
}

function getCharDetails (_text, textRange) {
  if (textRange && textRange.start && textRange.start.character===null){
    // lv("returning null", null)
    return null;
  }else{
    let editor = vscode.window.activeTextEditor;
    let textRangeStartIdx = editor.document.offsetAt(textRange.start);
    let textRangeEndIdx = editor.document.offsetAt(textRange.end);
    let precedingChar = (textRangeStartIdx !== 0) ? charAtIdx(textRangeStartIdx-1) : null;
    let preceding2Char = (textRangeStartIdx > 1) ? charAtIdx(textRangeStartIdx-2) : null;
    let preceding3Char = (textRangeStartIdx > 2) ? charAtIdx(textRangeStartIdx-3) : null;
    let p2Chars = preceding2Char + precedingChar;
    let p3Chars = preceding3Char + p2Chars;
    let followingChar = charAtIdx(textRangeEndIdx);
    let following2Char = charAtIdx(textRangeEndIdx+1);
    let firstChar = _text.charAt(0);
    let lastChar = _text.charAt(_text.length-1);
    let isString = ( firstChar === '"' && lastChar === '"' );
    let isStringContents = ( precedingChar === '"' && followingChar === '"' );
    let isStringContentsRegex = isStringContents && (preceding2Char === "#");
    let isStringRegex = isString && (precedingChar === "#");
    let isRegex = isStringRegex || isStringContentsRegex;
    //console.log ("hi gcdetails2", _text)
    return {
      textRangeStartIdx,
      textRangeEndIdx,
      precedingChar,
      preceding2Char,
      preceding3Char,
      p2Chars,
      p3Chars,
      followingChar,
      following2Char,
      firstChar,
      lastChar,
      isString,
      isStringContents,
      isStringContentsRegex,
      isStringRegex,
      isRegex
    }
  }
}

function textRangeCharsAndForms(_text, textRange, type){
  let {
    textRangeStartIdx,
    textRangeEndIdx,
    precedingChar,
    preceding2Char,
    preceding3Char,
    p2Chars,
    p3Chars,
    followingChar,
    following2Char,
    firstChar,
    lastChar,
    isString,
    isStringContents,
    isStringContentsRegex,
    isStringRegex,
    isRegex
  } = getCharDetails(_text, textRange);

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
  let isReified = !isString && precedingChar === "@";
  let isSpecialForm = isSet || isAnonFn || isList || isReified;
  let isPrintMacroFnCall = /^\(\?c*\s\S.*/gm.test(_text);
  let isSilentPrintMacroFnCall = /^\(!\?\s\S.*/gm.test(_text);
  let range = textRange;
  let text = _text;
  let commentedRange = undefined;
  let commentedText = undefined;
  let simpleWrapFnName = undefined;

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

  text = vscode.window.activeTextEditor.document.getText(range);

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

function selectCurrentForm(point){
  vsSendCursorToPos(point);
  // console.log("backwardUpSexp")
  backwardUpSexp();
  // console.log("sexpRangeExpansion")
  sexpRangeExpansion();
  let textRange = selectionRange();
  let startChar = charAtIdx(idxForPos(textRange.start))
  if(startChar === '"'){
    // console.log("startChar is \", backwardUpSexp")
    backwardUpSexp();
    // console.log("startChar is \", sexpRangeExpansion")
    sexpRangeExpansion();
  }
}

function getFormLevels(point) {
  let o = {};
  // Select top-level form
  // console.log("rangeForDefun")
  rangeForDefun();
  o.topLevel = textRangeDetails("topLevel");

  // Select current form
  selectCurrentForm(point);
  o.currentForm = textRangeDetails("currentForm");

  vsSendCursorToPos(point);
  sexpRangeExpansion();
  o.currentExpression = textRangeDetails("currentExpression");
  vsSendCursorToPos(point);
  return o;
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


// When point is on a special char "#" or "_", at the start of a
// commented list, set, regex, defrefed symbol, or anon fn.
// Keys are a result of:
// [o.currentExpression.text, o.currentForm.text, o.topLevel.text].join("")
const _igsfKey = {
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

const _sfKey = {
  "@,@,@": {types: ["reified"],
            examples: ["@aaa"],
            pointAtPos: 0},
}

function adjustForCommenting(o){
  let offset = undefined;
  let ce = o.currentExpression
  let key = [ce.text, o.currentForm.text, o.topLevel.text].join(",");
  let follow = ce.followingChar;
  let follow2 = ce.following2Char;
  let first2Chars = `${ce.text}${follow}`;
  let first3Chars = `${first2Chars}${follow2}`;
  let isIgnoredNonSpecialForm = /^#_[^'#@]/.test(first3Chars);
  let _isSpecialForm = ["#(", "'(", "#{"].includes(first2Chars);
  let isDerefed = (key === "@,@,@" && /\S/.test(follow))
  let isSpecialForm = _isSpecialForm || isDerefed;
  let {ogPoint, ogPointText} = getOg();
  let ogPointAdjusted = undefined;
  // "Ignored Special Form"
  let igsf = _igsfKey[key];
  // "Ignored Special Form"
  let sf = _sfKey[key];

  // console.clear()

  // lo("key", key)
  // lo("igsf", igsf)
  // lo("sf", sf)
  // lv("first2Chars", first2Chars)
  // lv("isIgnoredNonSpecialForm", isIgnoredNonSpecialForm)
  //lo("ce", ce)

  // if(["#(", "'(", "#{"].includes(first2Chars)) {
  //   offset = 1;

  if(isSpecialForm) {
    // console.log("Non-Ignored SpecialForm, offset=1")
    offset = 1;
  }else if(isIgnoredNonSpecialForm){
    // console.log("Ignored NonSpecialForm, offset=2")
    offset = 2;
  }else if(igsf){
    if(key === "#,#,#" && ["#", "'", "@"].includes(follow2)){
      // console.log("special form, point on pound, offset=3")
      offset = 3
    }else if (key === "#_,#_,#"){
      if(["#", "'", "@"].includes(follow)){
        // console.log("special form, point on underscore, offset=2")
        offset = 2
      }else{
        // console.log("point on underscore, offset=1")
        offset = 1
      }
    }else if (key === "#,#,#_" || igsf === "@,@,#_"){
      // console.log("point on atsign or special pound, offset = 1")
      offset = 1;
    }else if (key === "#_',#_',#_'"){
      // console.log("point on ', list, offset=1")
      offset = 1;
    }else if (key === "#_',#_',#"){
      // console.log("point on underscore, list, offset=2")
      offset = 2;
    }else{
      //TODO CAN YOU REMOVE THIS DEFAULT?
      // console.log("offset defaulting to 2")
      offset = 2;
    }
  }
  // }else if(sf) {
  //   if(key === "@,@,@"){
  //     if(/\S/.test(follow)){
  //       offset = 1;
  //     }
  //   }
  // }else if(["#(", "#_", "'(", "#{"].includes(first2Chars)) {
  //   console.log("anon fn, ignored (non-special) form, or set");
  //   offset = 1;
  // }
  if (offset) {
    ogPointAdjusted = posForIdx(idxForPos(ogPoint) + offset);
    o = getFormLevels(ogPointAdjusted);
  }
  return o;
}

function revertCursor(n, ogPoint){
  vsSendCursorToPos(posForIdx(idxForPos(ogPoint) + n))
}

function evalForms(o, key) {
  let isCommented = o.currentForm.text === "#" && o.currentForm.followingChar === "_";
  if(isCommented || o.topLevel.isCommented || o.currentForm.isCommented || o.currentExpression.isCommented) {
    vscode.window.showWarningMessage("repl-repl: You cannot eval a commented expression or form")
    vsSendCursorToPos(o.ogPoint)
  }else{
    let id = makeid(15);
    let sexpObj = o[key]
    const printBlock = logger.printBlock(sexpObj, id, o.fileExt);
    injectAndRevert(sexpObj, printBlock, id, o.ogPoint);
  }
}

function hasReplReplPrintMacrosRequire(){
  let doc = vscode.window.activeTextEditor.document;
  let src = doc.getText();
  // console.log(src)
  let nsRe = new RegExp(/\(\s*ns\s+/, 'gm');
  let matchRanges = [];
  var match;
  while (match = nsRe.exec(src)) {
    if(match.index>1){
      let preceding2CharRange = new vscode.Range(posForIdx(match.index-2), posForIdx(match.index))
      if(doc.getText(preceding2CharRange)!=="#_"){
        matchRanges.push([match.index, nsRe.lastIndex])
      }
    }else{
      matchRanges.push([match.index, nsRe.lastIndex])
    }
  }
  // console.log(matchRanges)
  let nsRange = matchRanges[matchRanges.length-1]
  vsSendCursorToPos(posForIdx(nsRange[0]));
  rangeForDefun();
  let nsRangeText = selectedText();
  let requireRe = new RegExp(/\[\s*repl\-repl\.core\s+:refer(?:\-macros)?\s*\[/, 'gm');
  return requireRe.test(nsRangeText);
}

function unIgnore(unIgnoreTarget, o){
  const injectNew = logger.injectNewFn(unIgnoreTarget.commentedRange, unIgnoreTarget.text);
  injectNew();
  let targetRangeStartIdx = idxForPos(o.currentExpression.range.start);
  let ogPointIdx = idxForPos(o.ogPoint);
  let idxDiff = targetRangeStartIdx - ogPointIdx;
  let adjustedRevertOffset = (idxDiff === 1) ? -1 : (idxDiff === 2) ? 0 : -2;
  //lo("x", {target, targetRangeStartIdx, ogPointIdx, idxDiff, revertOffset, adjustedRevertOffset})
  revertCursor(adjustedRevertOffset, o.ogPoint);
}

function removeWrap(o, target) {
  vsSendCursorToPos(posForIdx(idxForPos(o.currentForm.range.end) - 1));
  backwardSexp();
  sexpRangeExpansion();
  let editor = vscode.window.activeTextEditor;
  let newRange = selectionRange();
  let startIdx = editor.document.offsetAt(newRange.start);
  let _precedingChar = (idxForPos(newRange.start) !== 0) ? charAtIdx(startIdx - 1) : null;
  let precedingChar = ["#", "@", "'"].includes(_precedingChar) ? _precedingChar : "";
  let newText = `${precedingChar}${selectedText()}`;
  const injectNew = logger.injectNewFn(target.range, newText);
  injectNew();
  // let targetRangeStartIdx = idxForPos(target.range.start);
  let ogPointIdx = idxForPos(o.ogPoint);
  let idxDiff = ogPointIdx - startIdx;
  let adjustedRevertOffset = idxDiff > 0 ? idxDiff : 0;
  revertCursor(adjustedRevertOffset, target.range.start);
}

function newProfile(opts) {
    const ogPoint = cursorPos();
    let ogChar = charAtIdx(idxForPos(ogPoint));
    opts.peExpand ? vscode.commands.executeCommand("paredit.sexpRangeExpansion") : sexpRangeExpansion();
    let text = selectedText();
    let textRange = selectionRange();
    let charDetails = text!==null ? getCharDetails(text, textRange) : null;
    // lo("charDetails", charDetails);
    let isString = charDetails ? charDetails.isStringContents || charDetails.isString : null
    let firstChar = charDetails && charDetails.firstChar;
    let lastChar = charDetails && charDetails.lastChar;
    let isOnOpeningBrace = ["(", "[", "{",].includes(ogChar);
    let isOnClosingBrace = [")", "]", "}"].includes(ogChar);
    let isList = "("===firstChar && ")"===lastChar;
    let isMap = "{"===firstChar && "}"===lastChar;
    let isVector = "["===firstChar && "]"===lastChar;
    let isQuotedString = "\""===firstChar && "\""===lastChar;
    let isRegex = text.match(/^#".*"$/m);
    let isForm = isList || isMap || isVector;
    let isAfterClosingBrace = [")", "]", "}"].includes(charDetails.lastChar);
    let textIsParCmd = text.match(/^!?\?\+?\s+.*$/m);
    let textIsParCmdPlusRando = text.match(/^!?\?\+?$/m);
    let isInsideWrappedPar =  textIsParCmd || textIsParCmdPlusRando ? true : false;
    let isWrappedPar = text.match(/^\((\!?\?\+?)\s+/) ? true : false;
    let _isIgnoredForm = charDetails && !isString && charDetails.p2Chars === "#_";
    let isOnIgnoredForm1 = charDetails && !isString && text=== "_" && charDetails.precedingChar === "#";
    let isOnIgnoredForm2 = charDetails && !isString && text=== "#" && charDetails.followingChar === "_";
    let isIgnoredForm = _isIgnoredForm || isOnIgnoredForm1 || isOnIgnoredForm2;
    return {
      ogPoint,
      ogChar,
      text,
      textRange,
      charDetails,
      isString,
      isOnOpeningBrace,
      isOnClosingBrace,
      isAfterClosingBrace,
      isWrappedPar,
      isInsideWrappedPar,
      isIgnoredForm,
      isList,
      isMap,
      isVector,
      isForm,
      isQuotedString,
      isRegex
    }
}

function getDeletionRangeAfterBarf(){
  let range = selectionRange();
  // par.appendLine(JSON.stringify(range));
  let curPos = new vscode.Position(range.end.line, range.end.character);
  let nextPos = new vscode.Position(range.end.line, range.end.character + 1);
  let nextPos2 = new vscode.Position(range.end.line, range.end.character + 2);
  let nextLinePos = new vscode.Position(range.end.line+1, 0);
  let curChar = charAtIdx(idxForPos(curPos));
  let nextChar = charAtIdx(idxForPos(nextPos));
  let nextChar2 = charAtIdx(idxForPos(nextPos2));
  par.appendLine(`curChar: \`${curChar}\``);
  par.appendLine(`nextChar: \`${nextChar}\``);
  par.appendLine(`nextChar2: \`${nextChar2}\``);
  let i=0;
  let _pos;
  let _curChar;
  for(i;i<100;i++){
    _pos = new vscode.Position(range.end.line, range.end.character + i);
    _curChar = charAtIdx(idxForPos(_pos));
    par.appendLine(`${i} : \`${_curChar}\``);
    if(_curChar!==" "){break;}
  }
  let newEnd = (
    i > 2          ? new vscode.Position(range.end.line, range.end.character + i) :
    curChar==="?"  ? nextPos2 :
    curChar==="\n" ? nextLinePos :
    nextPos);

  let newRange = new vscode.Range(range.start, newEnd);
  return newRange;
}

const insertText = (editor, position, text,) => {
  if (editor) {
      editor.edit(editBuilder => {
          editBuilder.insert(position, text);
      });
  }
}
const replaceText = (editor, selection, text) => {
  if (editor) {
    editor.edit(editBuilder => {
      editBuilder.replace(selection, text);
    });
  }
}
const deleteText = (editor, range) => {
  if (editor) {
    editor.edit(editBuilder => {
      editBuilder.delete(range);
    });
  }
}

function profileEvalFn(userArg){
  return () => {

    let ext = fileExt();
    if(!["cljs", "cljc", "clj"].includes(ext)){
      vscode.window.showWarningMessage("repl-repl: You must be in a .cljs, .cljc, or .clj file to use this command.")
      return;
    }

    if(userArg === "insert-print-and-return-require") {
      const ogPoint = cursorPos();
      const injectionRange = new vscode.Range(ogPoint, ogPoint);
      const injectNew = logger.injectNewFn(injectionRange, "[par.core :refer-macros [!? ?]]");
      injectNew();
      revertCursor(0, ogPoint)
      return;
    }

    let editor = vscode.window.activeTextEditor;
    let currentLineText = editor.document.lineAt(editor.selection.active.line).text;

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
    let currentPoint =  ogPoint;
    let currentPointChar =  ogPointText;

    sexpRangeExpansion();
    let text = selectedText();
    let textRange = selectionRange();
    let {isRegex, isString, isStringContents} = getCharDetails(text, textRange)

    while (!isRegex && !isString && !isStringContents && ["#", "_", "@"].includes(currentPointChar)) {
      forwardSexp();
      currentPoint = editor.selection.active;
      currentPointChar = charAtIdx(idxForPos(currentPoint))
      // lv("currentPointChar", currentPointChar);
    }

    text = selectedText();
    textRange = selectionRange();

    let o = getFormLevels(currentPoint);

    // lo("ce", o.currentExpression);

    console.clear();

    //o = adjustForCommenting(o)
    o.ogPoint = ogPoint;
    o.ogPointText = ogPointText;
    o.endPos = endPos();
    o.fileExt = ext;


    if(userArg === "toggle-ignore-form"){
      // lo("toggle-ignore-form", o)
      let target = o.currentExpression;
      if (!o.currentExpression.isCommented){
        // lo("toggle-ignore-form", o)
        let unIgnoreTarget = [o.currentForm, o.topLevel].find(x => x.isCommented);
        if (unIgnoreTarget){
          unIgnore(unIgnoreTarget, o);
        }else{
          const injectNew = logger.injectNewFn(o.currentExpression.range, `#_${target.text}`);
          injectNew();
        }
      }else{
        unIgnore(o.currentExpression, o);
      }
      if (o.topLevel.isCommented || o.currentForm.isCommented || target.isCommented ) {
        let uncommentTarget = [o.currentExpression, o.topLevel, o.currentForm].find(o => o.isCommented);
        const injectNew = logger.injectNewFn(uncommentTarget.commentedRange, uncommentTarget.text);
        injectNew();
        let targetRangeStartIdx = idxForPos(target.range.start);
        let ogPointIdx = idxForPos(o.ogPoint);
        let idxDiff = targetRangeStartIdx - ogPointIdx;
        let revertOffset = -2;
        let adjustedRevertOffset = (idxDiff === 1) ? -1 : (idxDiff === 2) ? 0 : -2;
        // lo("x", {target, targetRangeStartIdx, ogPointIdx, idxDiff, revertOffset, adjustedRevertOffset})
        revertCursor(adjustedRevertOffset, o.ogPoint);
      }else if (target) {
        const injectNew = logger.injectNewFn(target.range, `#_${target.text}`);
        injectNew();
      }
   }

   if (userArg === "toggle-console-log-wrap") {
     // check if current expression is console.log wrapped
     let isConsoleLogWrap = /^\(js\/console.log [/s/S]*/.test(o.currentForm.text);

     let target = o.currentExpression;
     if (isConsoleLogWrap) {
       removeWrap(o, o.currentForm);
     } else if (target) {
       const injectNew = logger.injectNewFn(target.range, `(js/console.log ${target.text})`);
       injectNew();
     }
   }

   if (userArg === "toggle-pprint-wrap") {
     // check if current expression is pprint wrapped
     let isPprintWrap = /^\(pprint [/s/S]*/.test(o.currentForm.text);

     let target = o.currentExpression;
     if (isPprintWrap) {
       removeWrap(o, o.currentForm);
     } else if (target) {
       const injectNew = logger.injectNewFn(target.range, `(pprint ${target.text})`);
       injectNew();
     }
   }

   if(userArg === "insert-print-and-return-require") {
     let injectionRange = new vscode.Range(cursorPos(), cursorPos());
    //  lo("ir", injectionRange);
   }

   if(userArg === "toggle-print-and-return-macro") {
      // lo("o.ogPoint", o.ogPoint);

      vsSendCursorToPos(o.ogPoint);

      let isCommented = o.currentForm.text === "#" && o.currentForm.followingChar === "_";
      if(isCommented || o.topLevel.isCommented || o.currentForm.isCommented || o.currentExpression.isCommented) {
        vscode.window.showWarningMessage("repl-repl: Ignored forms cannot be wrapped.");
        return;
      }
      let cf = o.currentForm;
      let ce = o.currentExpression;
      // lo("currentForm", cf);
      // lo("currentExpression", ce);
      if (cf && cf.isPrintMacroFnCall) {
        removeWrap(o, cf);
      }else if (ce.isPrintMacroFnCall){
        removeWrap(o, ce);
      }else if (ce) {
        //wraps target

        vsSendCursorToPos(o.ogPoint)

        // lo("target", target);
        let newText = ce.isSilentPrintMacroFnCall ? ce.text.substring(3).substring(-1) : ce.text
        let printMacro = (o.fileExt === "cljc" || o.fileExt === "clj") ? "?c" : "?";
        const injectNew = logger.injectNewFn(ce.range, `(? ${newText})`);
        injectNew();
      }
   }

  if(userArg === "eval-current-form") {
    evalForms(o, "currentForm");
  }

  if(userArg === "eval-current-form") {
    evalForms(o, "currentForm");
  }

  if(userArg === "eval-on-point") {
    evalForms(o, "currentExpression");
  }

  if(userArg === "eval-outermost-form") {
    evalForms(o, "topLevel");
  }

  setTimeout(()=>vscode.commands.executeCommand("extension.vim_escape"), 100);
  return;

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
  let toggleConsoleLogWrap = vscode.commands.registerCommand('repl-repl.toggle-console-log-wrap',
    () => replrepl('toggle-console-log-wrap')
  );
  let togglePprintWrap = vscode.commands.registerCommand('repl-repl.toggle-pprint-wrap',
    () => replrepl('toggle-pprint-wrap')
  );
  let toggleIgnoreForm = vscode.commands.registerCommand('repl-repl.toggle-ignore-form',
    () => replrepl('toggle-ignore-form')
  );
  let insertPrintAndReturnRequire = vscode.commands.registerCommand('repl-repl.insert-print-and-return-require',
    () => replrepl('insert-print-and-return-require')
  );
  let togglePrintAndReturnMacro = vscode.commands.registerCommand('repl-repl.toggle-print-and-return-macro',
    () => replrepl('toggle-print-and-return-macro')
  );
  let togglePrintAndReturnMacroSilent = vscode.commands.registerCommand('repl-repl.toggle-print-and-return-macro-silent',
    () => replrepl('toggle-print-and-return-macro-silent')
  );
  let doc = vscode.commands.registerCommand('repl-repl.doc',
    () => replrepl('doc')
  );
  context.subscriptions.push(evalOutermostForm);
  context.subscriptions.push(evalCurrentForm);
  context.subscriptions.push(evalOnPoint);
  context.subscriptions.push(toggleIgnoreForm);
  context.subscriptions.push(insertPrintAndReturnRequire);
  context.subscriptions.push(togglePrintAndReturnMacro);
  context.subscriptions.push(togglePrintAndReturnMacroSilent);
  context.subscriptions.push(togglePprintWrap);
  context.subscriptions.push(toggleConsoleLogWrap);
  context.subscriptions.push(doc);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;
