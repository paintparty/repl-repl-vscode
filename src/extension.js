'use strict'
const vscode = require('vscode');
const logger = require('./logger');
const util = require('./util');
const decorate = require('./decorate');
const bufferState = require('./state');
const control = require('./control');

function replrepl (userArg) {
  let editor = vscode.window.activeTextEditor;
  if (!editor){
    return;
  }

  let logBlocks = logger.rrLogBlocks(editor);

  if(logBlocks.length){
    vscode.window.activeTextEditor.edit(edit => {
      logBlocks.reverse().forEach( range => {
          let r = new vscode.Range(editor.document.positionAt(range[0]), editor.document.positionAt(range[1]))
          console.log("range!", r)
          edit.replace(r, "");
      });
    })
  }else{
    // Create object that represents the current buffer
    const state = bufferState.getBufferState(editor, userArg);

    // If file is not .cljs or .cljc, show warning and exit
    if (!state) {
      vscode.window.showWarningMessage("repl-repl:  File extention must be .cljs or .cljc.")
      return;
    }

    state.logTuple = control.flow(state);
    console.log("state", state);

    if (state.logTuple && state.logTuple[1] === "warning") {
      state.warning = "repl-repl: "+state.logTuple[0];
    }

    util.logStateInfo(state);
    state.copied = state[state.logTuple[0]];

    // CF
    if (state.warning){
      vscode.window.showWarningMessage(state.warning)
    }else if (state.rlw){
      //console.log(state.blackListedRange);
      const replaceLogWrap = logger.replaceLogWrapFn(state);
      //const save = util.saveFileFn(state);
      replaceLogWrap()
    }else if(state.lwof || state.lwcf || state.lwce){
      state.logBlock = logger.logWrap(state);
      const injectNew = logger.injectNewFn(state);
      injectNew()
    }else{
      // flash highlight on form to be evaluated.
      decorate.highlightEvalForm(state);
      const newSurf = logger.logBlock(state);
      state.logBlock = newSurf;
      const injectBlank = logger.insertBlankTextFn(state, newSurf);
      const injectText = logger.insertTextFn(state, newSurf);
      const save = util.saveFileFn(state);
      const ghostLog = logger.ghostLogFn(state);
      const deleteLogBlock = logger.deleteLogBlockFn(state);
      injectBlank().then(ghostLog).then(injectText).then(save).then(deleteLogBlock);
    }
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
    () => replrepl('log-wrap-outer-form')
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
