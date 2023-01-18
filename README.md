:warning: THIS EXTENSION HAS BEEN DEPRECATED AND MAY NO LONGER WORK THE WAY YOU EXPECT IT TO.

An extension with similar functionality which is tailored to working with the [Clojure(Script) library Par](https://github.com/paintparty/par) is slated be released in Feb '23.

<br>

<br>

# repl-repl <img src="https://raw.githubusercontent.com/paintparty/repl-repl-vscode/master/images/rr-sticker-225.png" height="80px" align="right" />

&nbsp;
**repl-repl** makes it dead simple to evaluate Clojurescript code directly from your editor.
Instant feedback with syntax highlighting is delivered straight to your Chrome DevTools console.
&nbsp;

<!--
<img style="max-width:100%" src="https://i.github-camo.com/e0c46604d0a1f5f0d49a16fc9c8b959f62e5ffb0/68747470733a2f2f7261772e67697468756275736572636f6e74656e742e636f6d2f7061696e7470617274792f7265706c2d7265706c2d61746f6d2f76302e312e31302f696d616765732f7265706c2d7265706c2d73637265656e2d332e676966" alt="repl-repl example animation"/>
-->

## Usage ##
This extension is designed to be used in tandem with hot-reloading ClojureScript workflow and the [par](https://github.com/paintparty/par) debugging macro.

IMPORTANT: Make sure you have [enabled custom formatters in Chrome DevTools](http://www.mattzeunert.com/2016/02/19/custom-chrome-devtools-object-formatters.html). This is necessary because formatting and syntax highlighting of the evaluated code in Chrome DevTools Console relies on [cljs-devtools](https://github.com/binaryage/cljs-devtools).


&nbsp;

Based on where the cursor is, you can do one of the following:

***Evaluate On Point***<br>
Default keybinding: `cmd-enter` (mac), `alt-enter` (windows & linux)

***Evaluate Current Form***<br>
Default keybinding: `cmd-alt-enter` (mac), `alt-ctrl-enter` (windows & linux)

***Evaluate Outermost Form***<br>
Default keybinding: `ctrl-cmd-alt-enter` (mac), `shift-ctrl-alt-enter` (windows & linux)

***Toggle js/console.log Wrap***<br>
This command will toggle a `js/console.log` wrap around the current form.

***Toggle pprint Wrap***<br>
This command will toggle a `pprint` wrap around the current form.

***Toggle Ignore Form***<br>
This command will toggle `#_` in front of an expression or form.

***Insert Print-And-Return Require***<br>
This command will insert a require form for the par.core macro.

Customize these keybindings to suit your needs.
&nbsp;

You can also access the commands above by opening the command pallette ( `cmd-shift-p` or `ctrl-shift-p`) and searching for "repl-repl"

&nbsp;

Copyright © 2018-2022 JC

Example animation features the [FiraCode](https://github.com/tonsky/FiraCode) font by [tonsky](https://github.com/tonsky)
