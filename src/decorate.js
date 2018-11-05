const vscode = require('vscode');
const util = require('./util');
const colors = {
  red : "rgba(255, 193, 193, 0.3)",
  violet: "rgba(223, 193, 255, 0.3)",
  blue : "rgba(193, 236, 255, 0.3)",
  cyan : "rgba(193, 255, 244, 0.3)",
  green : "rgba(193, 255, 195, 0.3)",
  yellow : "rgba(249, 255, 0, 0.3)",
  orange : "rgba(246, 194, 113, 0.3)"
};

// create a decorator type that we use to decorate evaled form 
const workSpaceColorCustomizations = vscode.workspace.getConfiguration('workbench.colorCustomizations');
const selectionBackgroundHex = (workSpaceColorCustomizations['editor.selectionBackground']);
const selectionBackground = util.convertHex(selectionBackgroundHex) || 'rgb(92,255,160,0.5)';

function evalFormHighlight(color){
  let isUserSelectBg = (color === "selectionBackground");
  let isTransparent = (color === "transparent");
  let bgColorLight = isUserSelectBg ? 
    selectionBackground :  
    isTransparent ?
      'rgba(255,255,255,0.0)' :
      color;
  let bgColorDark = isUserSelectBg ? 
    selectionBackground :  
    isTransparent ?
      'rgba(255,255,255,0.0)' :
      'rgba(255,255,255,0.5)';

  let highlight = vscode.window.createTextEditorDecorationType({
    light: { backgroundColor: bgColorLight},
    dark: { backgroundColor: bgColorDark}
  });
  return highlight;
}

function clearEvalFormHighlight(highlight) {
  let activeEditor = vscode.window.activeTextEditor;
  activeEditor.setDecorations(highlight, []);
}

function changeHighlight(state, color, highlight, range){
  clearEvalFormHighlight(highlight);
  highlight = evalFormHighlight(color);
  state.editor.setDecorations(highlight, [range]);
  return highlight;
}

// Indiana Jones and the triangle of doom... 
function evalFormHighlightAnimation(state, range){
  let highlight = evalFormHighlight("transparent");
  state.editor.setDecorations(highlight, [range]);
  let interval = 50;
  setTimeout(
    () => {
      highlight = changeHighlight(state, colors.cyan, highlight, range);
      setTimeout(
        () => {
          highlight = changeHighlight(state, colors.green, highlight, range);
          setTimeout(
            () => {
              highlight = changeHighlight(state, colors.yellow, highlight, range);
              setTimeout(
                () => {
                  highlight = changeHighlight(state, colors.orange, highlight, range);
                  setTimeout(
                    () => {
                      highlight = changeHighlight(state, colors.red, highlight, range);
                      setTimeout(
                        () => {
                          highlight = changeHighlight(state, colors.violet, highlight, range);
                          setTimeout(
                            () => {
                              highlight = changeHighlight(state, colors.blue, highlight, range);
                              setTimeout(
                                () => {
                                  clearEvalFormHighlight(highlight);
                                }, 
                                interval);
                            }, 
                            interval);
                        }, 
                        interval);
                    }, 
                    interval);
                }, 
                interval);
            }, 
            interval);
        }, 
        interval);
    }, 
    interval);
}

function highlightEvalForm(state) {
  if (state.logTuple && state.logTuple[1] !== "warning") {
    let rangeToHighlight = state[state.logTuple[2]]
    evalFormHighlightAnimation(state, rangeToHighlight);
  }
}

exports.clearEvalFormHighlight = clearEvalFormHighlight;
exports.highlightEvalForm = highlightEvalForm;