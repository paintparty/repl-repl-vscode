const vscode = require('vscode');

const colors = {
  red : "rgba(255, 193, 193, 0.35)",
  violet: "rgba(223, 193, 255, 0.34)",
  blue : "rgba(193, 236, 255, 0.35)",
  cyan : "rgba(193, 255, 244, 0.5)",
  green : "rgba(193, 255, 195, 0.5)",
  yellow : "rgba(249, 255, 0, 0.5)",
  orange : "rgba(246, 194, 113, 0.35)"
};

function convertHex(hex) {
  if(hex){
    var hex = hex.replace('#', '');
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    let a = hex.substring(6, 8);
    let aInt = parseInt(a);
    let opacity = (a.length === 2 && (aInt !== NaN) && (typeof aInt === 'number')) ? (0.7 * aInt/100) : 1;
    let result = 'rgba(' + r + ',' + g + ',' + b + ',' + opacity + ')';
    return result;
  }
}

// create a decorator type that we use to decorate evaled form
const workSpaceColorCustomizations = vscode.workspace.getConfiguration('workbench.colorCustomizations');
const selectionBackgroundHex = (workSpaceColorCustomizations['editor.selectionBackground']);
const selectionBackground = selectionBackgroundHex?
  convertHex(selectionBackgroundHex) : 'rgb(92,255,160,0.5)';

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
  vscode.window.activeTextEditor.setDecorations(highlight, []);
}

function changeHighlight(color, highlight, range){
  clearEvalFormHighlight(highlight);
  highlight = evalFormHighlight(color);
  vscode.window.activeTextEditor.setDecorations(highlight, [range]);
  return highlight;
}

function evalFormHighlightAnimation(range){
  let highlight = evalFormHighlight("transparent");
  vscode.window.activeTextEditor.setDecorations(highlight, [range]);
  let interval = 50;
  setTimeout(
    () => {
      highlight = changeHighlight(colors.yellow, highlight, range);
      setTimeout(
        () => {
          highlight = changeHighlight( colors.green, highlight, range);
          setTimeout(
            () => {
              highlight = changeHighlight( colors.cyan, highlight, range);
              setTimeout(
                () => {
                  highlight = changeHighlight(colors.blue, highlight, range);
                  setTimeout(
                    () => {
                      highlight = changeHighlight(colors.violet, highlight, range);
                      setTimeout(
                        () => {
                          highlight = changeHighlight(colors.red, highlight, range);
                          setTimeout(
                            () => {
                              highlight = changeHighlight(colors.orange, highlight, range);
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
    0);
}

function highlightEvalForm(rangeToHighlight) {
  evalFormHighlightAnimation(rangeToHighlight);
}

exports.clearEvalFormHighlight = clearEvalFormHighlight;
exports.highlightEvalForm = highlightEvalForm;
