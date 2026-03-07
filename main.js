const { app, BrowserWindow, dialog, ipcMain, protocol } = require('electron');
const { filetypeinfo } = require("magic-bytes.js");
const fs = require("fs");
const path = require("path");

/** @type {BrowserWindow} */
let win;

/** @type {DirectoryWalker} */
let sourceDirectoryWalker = null;

/** @type {string[]} */
let targetDirectories = [];

class DirectoryWalker {
    constructor(directory) {
        this.directory = directory;
        /** @type {FileHandler[]} */
        this.files = fs.readdirSync(directory, { recursive: true })
            .map(relativePath => new FileHandler(path.join(this.directory, relativePath)));
        this.currentIndex = -1;
    }

    /** @returns {FileHandler | null} */
    get currentFile() {
        if (this.currentIndex >= this.files.length) return null;
        return this.files[this.currentIndex];
    }

    /** @returns {number} */
    get remainingCount() {
        return this.files.length - this.currentIndex;
    }

    /** @returns {FileHandler | null} */
    findNextRegularFile() {
        while (true) {
            this.currentIndex++;
            const current = this.currentFile;
            if (current === null) {
                break;
            }
            if (current.type === "file") {
                return current;
            }
        }

        return null;
    }
}

if (fs.existsSync("./currentProgress.json")) {
    const { sourceDirectory, fileIndex, targetDirectories: targetDirs } = JSON.parse(fs.readFileSync("./currentProgress.json", "utf-8"));
    targetDirectories = targetDirs;
    sourceDirectoryWalker = new DirectoryWalker(sourceDirectory);
    sourceDirectoryWalker.currentIndex = fileIndex;
}

const createWindow = () => {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: app.isPackaged,
        }
    });

    win.loadFile('index.html')
}

app.whenReady().then(() => {
    createWindow();

    // protocol.handle('atom', (request) => {
    //     const filePath = request.url.slice('atom://'.length)
    //     return net.fetch(url.pathToFileURL(path.join(__dirname, filePath)).toString())
    // })

    protocol.registerFileProtocol("file-loader", (request, callback) => {
        const url = request.url.replace("file-loader://", "");
        try {
          return callback(url);
        } catch (err) {
          console.error(error);
          return callback(404);
        }
      });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
        win.webContents.openDevTools();
    });

    win.webContents.send("sync-target-directories", targetDirectories)
});

class FileHandler {
    /**
     * @param {string} absolutePath
     */
    constructor(absolutePath) {
        /** @type {string} */
        this.absolutePath = absolutePath;
        /** @type {"directory" | "file"} */
        this._type = null;
        this._fileTypeInfo = null;
        this._copyTo = null;
    }

    copyTo(targetDirectory) {
        // Append the name of the file to targetDirectory
        const targetPath = path.join(targetDirectory, path.basename(this.absolutePath));
        this._copyTo = targetPath;
        try {
            if (fs.existsSync(targetPath)) {
                throw new Error(`File ${targetPath} already exists : can't overwrite it`);
            }
            fs.copyFileSync(this.absolutePath, targetPath);
        } catch (err) {
            console.error(`Failed to copy ${this.absolutePath} to ${targetPath} : `, err);
            win.webContents.send("error", `Failed to copy ${this.absolutePath} to ${targetPath} : ${err.message}`);
        }
    }

    get type() {
        if (this._type === null) {
            // We don't care about special files
            this._type = fs.statSync(this.absolutePath).isFile() ? "file" : "directory";
        }
        return this._type;
    }

    get mimes() {
        if (this._fileTypeInfo === null) {
            const fd = fs.openSync(this.absolutePath, "r");
            const buffer = Buffer.alloc(100);
            fs.readSync(fd, buffer, 0, 100, 0);
            this._fileTypeInfo = filetypeinfo(buffer);
        }
        return this._fileTypeInfo.map(info => info.mime);
    }
}


app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

ipcMain.on("get-source-directory", (event) => {
    if (sourceDirectoryWalker !== null) return;
    const directory = dialog.showOpenDialogSync(win, {properties: ["openDirectory"]})[0];
    event.sender.send("source-directory", directory);
    sourceDirectoryWalker = new DirectoryWalker(directory);
    ipcSendNextFile(event.sender);
});

ipcMain.on("select-target-directory", (event) => {
    const directory = dialog.showOpenDialogSync(win, {properties: ["openDirectory"]})[0];
    targetDirectories.push(directory);
    event.sender.send("sync-target-directories", targetDirectories);
});

ipcMain.on("copy-current", (event, targetDir) => {
    const current = sourceDirectoryWalker.currentFile;

    if (targetDir === null) {
        console.log(`Skipping current ${current.absolutePath}`);
    } else {
        console.log(`Copy current file ${current.absolutePath} to ${targetDir}`);
        current.copyTo(targetDir);
    }

    ipcSendNextFile(event.sender);
});

if (fs.existsSync("./currentProgress.json")) {
    const { sourceDirectory, fileIndex, targetDirectories: targetDirs } = JSON.parse(fs.readFileSync("./currentProgress.json", "utf-8"));
    targetDirectories = targetDirs;
    sourceDirectoryWalker = new DirectoryWalker(sourceDirectory);
    sourceDirectoryWalker.currentIndex = fileIndex;
}

ipcMain.on("save-progress", (event) => {
    const content =  {
        sourceDirectory: sourceDirectoryWalker.directory,
        fileIndex: sourceDirectoryWalker.currentIndex,
        targetDirectories
    };

    fs.writeFileSync("./currentProgress.json", JSON.stringify(content, null, 4));
});

/**
 * @param {Electron.WebContents} sender
 */
function ipcSendNextFile(sender) {
    const next = sourceDirectoryWalker.findNextRegularFile();

    if (next === null) {
        sender.send("finished");
    } else {
        sender.send("current-file", {
            remainingCount: sourceDirectoryWalker.remainingCount,
            absolutePath: next.absolutePath,
            mimes: next.mimes,
            url: encodeURI("file-loader://" + next.absolutePath)
        });
    }
}