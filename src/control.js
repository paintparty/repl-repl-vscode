const s = {
  "jsjs" : ["selectedText", "selectedText", "selectionRange", "eval-js-in-js"],
  "ejs" : ["jsComment", "jsComment", "rangeOuterForm", "eval-js"],
  "ecf" : ["textCurrentForm", "textCurrentForm", "rangeCurrentForm", "eval-current-form"],
  "eof" : ["textOuterForm", "textOuterForm", "rangeOuterForm", "eval-outer-form"],
  "ece" : ["textCurrentExpression", "textCurrentExpression", "rangeCurrentExpression", "eval-current-expression"],
  "ece-warn" : ["If you are trying to eval an expression within a form, the cursor must be within the range of an expression.", "warning"],
  "ece-outside-warn" : ["If you are trying to eval an expression outside a form, the cursor must be within the range of an expression.", "warning"],
  "ejs-warn" : ["If you are tryin to eval a snippet of js within a (comment :js ...) form, you need to select the js to be evaluated.", "warning"],
  "isBlacklisted" : ["The code you are trying to evaluate is within a comment or ignored form range.", "warning"],
  "jsNoSelection" : ["You need to select a snippet of JS in order to repl it.", "warning"]
};

const cf = {
  isCljx : {
    isInsideForm : {
      isNotJsComment:{
        ecf: "ecf",
        eof: "eof",
        ece: {
          isPointOnExpression : "ece",
          consoleWarning : "ece-warn"
        }
      },
      isJsComment:{
        ecf: "ejs",
        eof: "ejs",
        ece: "ejs"
      }
    },
    isOutsideForm : {
      isNotBlacklisted :{
        ecf: {
         isPointOnExpression : "ece",
         consoleWarning : "ece-outside-warn"
        },
        eof: {
         isPointOnExpression : "ece",
         consoleWarning : "ece-outside-warn"
        },
        ece: {
         isPointOnExpression : "ece",
         consoleWarning : "ece-outside-warn"
        }
      },
      isBlacklisted: {
        isStringRange :{
          ecf: "ece",
          eof: "ece",
          ece: "ece"
        },
        consoleWarning : "isBlacklisted"
      }
    }
  },
  isJs :{
    selectedText :{
      ecf: "jsjs",
      eof: "jsjs",
      ece: "jsjs"
    },
    consoleWarning : "jsNoSelection"
  }
}

function controlFlow(state, m){
 const keys = m.consoleWarning ?
    Object.keys(m).filter(key => key!=="consoleWarning") :
    Object.keys(m);

  for(let key of keys){
    if(state[key]){
      let v = m[key];
      if(typeof v === 'object'){
        return controlFlow(state, v);
        break;
      }else if(typeof v === 'string'){
        return v
        break;
      }
    }
  }
  return m.consoleWarning;
}

function flow(state){
  return s[controlFlow(state, cf)];
}

exports.flow = flow;
