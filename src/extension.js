'use strict'
const vscode = require('vscode');
const logger = require('./logger');
const util = require('./util');
const decorate = require('./decorate');
const bufferState = require('./state');
const control = require('./control');


function replrepl (userArg) {
  let editor = vscode.window.activeTextEditor;
  if (!editor){return;}

  // Create object that represents the current buffer
  const state = bufferState.getBufferState(editor, userArg); 

  // file is js, no code selected, return silently
  if (!state) {
    return;
  }

  state.logTuple = control.flow(state);
  if (state.logTuple && state.logTuple[1] === "warning") {
    state.warning = state.logTuple[0];
  }

  util.logStateInfo(state);

  // create cljs (or js) code snippet to feed to js/console.log
  const newSurf = logger.logBlock(state); 

  // flash highlight on form to be evaluated.
  decorate.highlightEvalForm(state); 

  // call hofs to create callback fns for insert, save, and delete 
  const injectText = logger.insertTextFn(state, newSurf); 
  const injectBlank = logger.insertBlankTextFn(state, newSurf); 
  const save = util.saveFileFn(state); 
  const ghostLog = logger.ghostLogFn(state); 
  const deleteLogBlock = logger.deleteLogBlockFn(state);

  //const blanko = newSurf.replace(/./gm, 'x');
  injectBlank().then(ghostLog).then(injectText).then(save).then(deleteLogBlock);
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
  //let disposable = vscode.commands.registerCommand('extension.replrepl', replrepl);
  context.subscriptions.push(evalOutermostForm);
  context.subscriptions.push(evalCurrentForm);
  context.subscriptions.push(evalCurrentExpression);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;