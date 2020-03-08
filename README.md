# repl-repl <img src="https://i.github-camo.com/cb2621ba4177e63c57d8b725403a35b770b59406/68747470733a2f2f7261772e67697468756275736572636f6e74656e742e636f6d2f7061696e7470617274792f7265706c2d7265706c2d61746f6d2f76302e312e392f696d616765732f72722d737469636b65722e6a7067" height="80px" align="right" />

&nbsp;
**repl-repl** makes it dead simple to evaluate Clojurescript code directly from your editor.
Instant feedback with syntax highlighting is delivered straight to your Chrome DevTools console.
&nbsp;


<img style="max-width:100%" src="https://i.github-camo.com/e0c46604d0a1f5f0d49a16fc9c8b959f62e5ffb0/68747470733a2f2f7261772e67697468756275736572636f6e74656e742e636f6d2f7061696e7470617274792f7265706c2d7265706c2d61746f6d2f76302e312e31302f696d616765732f7265706c2d7265706c2d73637265656e2d332e676966" alt="repl-repl example animation"/>


## Usage ##
This extension is designed to be used in tandem with hot-reloading ClojureScript build frameworks such as [figwheel](https://figwheel.org/), [shadow-cljs](http://shadow-cljs.org/), and [boot](https://github.com/adzerk-oss/boot-reload).

IMPORTANT: Make sure you have [enabled custom formatters in Chrome DevTools](http://www.mattzeunert.com/2016/02/19/custom-chrome-devtools-object-formatters.html). This is necessary because formatting and syntax highlighting of the evaluated code in Chrome DevTools Console relies on [cljs-devtools](https://github.com/binaryage/cljs-devtools), which is bundled with Figwheel by default.

if you are using [shadow-cljs](http://shadow-cljs.org/) or [boot](https://github.com/adzerk-oss/boot-reload), include [cljs-devtools](https://github.com/binaryage/cljs-devtools) as a dependency in your project, and make sure that you've enabled cljs-devtools in your project. Again, you will need to [enable custom formatters in Chrome DevTools](http://www.mattzeunert.com/2016/02/19/custom-chrome-devtools-object-formatters.html).

&nbsp;

Based on where the cursor is, you can do one of the following:

***Evaluate On Point***<br>
Default keybinding: `cmd-enter` (mac), `alt-enter` (windows & linux)

***Evaluate Current Form***<br>
Default keybinding: `cmd-alt-enter` (mac), `alt-ctrl-enter` (windows & linux)

***Evaluate Outermost Form***<br>
Default keybinding: `ctrl-cmd-alt-enter` (mac), `shift-ctrl-alt-enter` (windows & linux)

***Print Wrap Symbol With Annotation***<br>
This command will wrap the outermost form in an annotated `js/console.log` form.

***Print Wrap On Point***<br>
This command will wrap the current form in an annotated `js/console.log` form.

***Remove Print Wrap***<br>
This command will remove the `js/console.log` form around an expression or form.

Feel free customize these keybindings to suit your needs.
&nbsp;

You can also access the commands above by opening the command pallette ( `cmd-shift-p` or `ctrl-shift-p`) and searching for "repl-repl"

&nbsp;

Copyright © 2018-2020 JC

Example animation features the [FiraCode](https://github.com/tonsky/FiraCode) font by [tonsky](https://github.com/tonsky)
