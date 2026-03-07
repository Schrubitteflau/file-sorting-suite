const { ipcRenderer } = require('electron');

// https://www.w3schools.com/w3css/tryit.asp?filename=tryw3css_buttons_colors
const buttonColorClasses = [
    "pink", "deep-purple", "blue", "cyan", "teal", "light-green", "sand",
    "yellow", "orange", "brown", "light-grey", "dark-grey", "pale-red", "pale-green",
];

const fileRenderConfig = {
    "video/mp4": `<video controls autoplay><source src="<URL>" type="video/mp4">Video not supported</video>`,
}

document.addEventListener('DOMContentLoaded', () => {
    const $span_sourceDirectory = document.getElementById("source-directory");
    const $div_currentFileRender = document.getElementById("current-file-render");
    const $ul_copyButtons = document.getElementById("copy-buttons");
    const $button_addTargetDirectory = document.getElementById("add-target-directory");
    const $button_skip = document.getElementById("button-skip");
    const $span_remainingCount = document.getElementById("remaining-count");
    const $button_saveProgress = document.getElementById("button-save-progress");

    let sourceDirectory = null;
    let targetDirectories = [];

    ipcRenderer.send("get-source-directory");

    ipcRenderer.on("error", (event, errorMessage) => {
        alert(errorMessage);
    });

    ipcRenderer.on("source-directory", (event, directory) => {
        sourceDirectory = directory;
        $span_sourceDirectory.innerText = sourceDirectory;
    });

    ipcRenderer.on("sync-target-directories", (event, directories) => {
        targetDirectories = directories.map((directory, idx) => ({ directory, buttonColorClass: buttonColorClasses[idx] }));
        renderTargetDirectoryButtons();
    });

    ipcRenderer.on("current-file", (event, { remainingCount, absolutePath, mimes, url }) => {
        $span_remainingCount.innerText = remainingCount;
        renderFile(mimes, absolutePath, url);
    });

    ipcRenderer.on("finished", (event) => {
        alert("Finito");
    });

    $button_addTargetDirectory.addEventListener("click", () => {
        ipcRenderer.send("select-target-directory");
    });

    $button_skip.addEventListener("click", () => {
        ipcRenderer.send("copy-current", null);
    });

    $button_saveProgress.addEventListener("click", () => {
        ipcRenderer.send("save-progress");
    });

    function renderTargetDirectoryButtons() {
        $ul_copyButtons.innerHTML = "";
        for (const { directory, buttonColorClass } of targetDirectories) {
            const $btn = document.createElement("button");
            $btn.innerText = directory;
            $btn.classList.add("w3-button", `w3-${buttonColorClass}`);
            $btn.addEventListener("click", () => {
                ipcRenderer.send("copy-current", directory);
            });
            $ul_copyButtons.appendChild($btn);
        }
    }

    function renderFile(mimes, absolutePath, url) {
        const availableRenders = [];

        function setRender(html) {
            $div_currentFileRender.innerHTML = `<div style="text-decoration: underline;">${absolutePath}</div>${html}`;
        }

        for (const mime of mimes) {
            if (mime in fileRenderConfig) {
                availableRenders.push(fileRenderConfig[mime]);
            }
        }
        if (availableRenders.length === 0) {
            return void setRender(`No renderer for type(s) ${mimes}`);
        }

        if (availableRenders.length > 1) {
            alert(`Several renderers are available for ${absolutePath} of type(s) ${mimes}, using the first one`);
        }
        setRender(availableRenders[0].replace("<URL>", url));
    }
});
