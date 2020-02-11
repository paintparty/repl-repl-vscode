# repl-repl <img src="https://i.github-camo.com/cb2621ba4177e63c57d8b725403a35b770b59406/68747470733a2f2f7261772e67697468756275736572636f6e74656e742e636f6d2f7061696e7470617274792f7265706c2d7265706c2d61746f6d2f76302e312e392f696d616765732f72722d737469636b65722e6a7067" height="80px" align="right" />

&nbsp;
**repl-repl** makes it dead simple to evaluate Clojurescript code directly from your editor.
Instant feedback with syntax highlighting is delivered straight to your Chrome DevTools console.
&nbsp;


<img style="max-width:100%" src="https://i.github-camo.com/e0c46604d0a1f5f0d49a16fc9c8b959f62e5ffb0/68747470733a2f2f7261772e67697468756275736572636f6e74656e742e636f6d2f7061696e7470617274792f7265706c2d7265706c2d61746f6d2f76302e312e31302f696d616765732f7265706c2d7265706c2d73637265656e2d332e676966" alt="repl-repl example animation"/>


## Usage ##
This extension is designed to be used in tandem with [Figwheel](https://figwheel.org/).

IMPORTANT: Make sure you have [enabled custom formatters in Chrome DevTools](http://www.mattzeunert.com/2016/02/19/custom-chrome-devtools-object-formatters.html). This is necessary because formatting and syntax highlighting of the evaluated code in Chrome DevTools Console relies on [cljs-devtools](https://github.com/binaryage/cljs-devtools), which is bundled with Figwheel by default.

This extension will also work with [shadow-cljs](http://shadow-cljs.org/) or [boot](https://github.com/adzerk-oss/boot-reload), although you will need to include [cljs-devtools](https://github.com/binaryage/cljs-devtools) as a dependency in your project, and make sure that you've enabled cljs-devtools in your project. Again, you will need to [enable custom formatters in Chrome DevTools](http://www.mattzeunert.com/2016/02/19/custom-chrome-devtools-object-formatters.html).

&nbsp;

Based on where the cursor is, you can do one of the following:

***Evaluate Outermost Form***
Default keybinding: `cmd-enter` (mac), `alt-enter` (windows & linux)

***Evaluate Current Form***
Default keybinding: `cmd-alt-enter` (mac), `alt-ctrl-enter` (windows & linux)

***Evaluate Current Expression***
Default keybinding: `ctrl-cmd-alt-enter` (mac), `shift-ctrl-alt-enter` (windows & linux)

***Log Wrap Outer Form***
This command will wrap the outermost form in an annotated `js/console.log` form.

***Log Wrap Current Form***
This command will wrap the current form in an annotated `js/console.log` form.

***Log Wrap Current Expression***
This command will wrap the current expression in an annotated `js/console.log` form.

***Remove Log Wrap***
This command will remove the `js/console.log` form around an expression or form that was previously wrapped by one of the log wrapping commands listed above.

Feel free customize these keybindings to suit your needs.
&nbsp;

You can also access the commands above by opening the command pallette ( `cmd-shift-p` or `ctrl-shift-p`) and searching for "repl-repl"

&nbsp;

Copyright © 2018 JC
Example animation features the [FiraCode](https://github.com/tonsky/FiraCode) font by [tonsky](https://github.com/tonsky)
