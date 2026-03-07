# file-sorting-suite

This app, built on [Electron](https://www.electronjs.org/), aims to make file sorting easier in your computer. Once you open it, you're asked to select a source directory. For each file present in this directory and its subdirectories, you'll be asked to do something. Either you select another directory as the destination, or you can simply skip it. The app will try to render each file based on its type, detected using the library [magic-bytes.js](https://github.com/LarsKoelpin/magic-bytes). It's particularily useful if you have a big folder with a lot of pictures and videos that you want to sort properly into specific folders.

For security measures, it copies the file instead of moving it, but you can modify the code if needed. Replacing the call [fs.copySync](https://nodejs.org/api/fs.html#fscopyfilesyncsrc-dest-mode) by [fs.renameSync](https://nodejs.org/api/fs.html#fsrenamesyncoldpath-newpath) should be enough.

There are many things that could be improved, in terms of functionnalities as well as the code quality. However, it works well and it's enough for my personal use case, you can't expect much from a niche software coded in a few hours :octopus:
