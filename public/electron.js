const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const menu = electron.Menu;
const globalShortcut = electron.globalShortcut;
const screen = electron.screen;

const path = require('path');
const url = require('url');
const isDev = require('electron-is-dev');

/*************************************************************
 * py process
 *************************************************************/

const PY_DIST_FOLDER = '../pydist';
const PY_FOLDER = '../pysrc';
const PY_MODULE = 'CHSplit'; // without .py suffix

let pyPort = null;

const guessPackaged = () => {
    const fullPath = path.join(__dirname, PY_DIST_FOLDER);
    console.log(fullPath);
    return require('fs').existsSync(fullPath);
};

const getScriptPath = () => {
    if (!guessPackaged()) {
        return path.join(__dirname, PY_FOLDER, PY_MODULE + '.py');
    }
    if (process.platform === 'win32') {
        return path.join(__dirname, PY_DIST_FOLDER, PY_MODULE + '.exe');
    }
    return path.join(__dirname, PY_DIST_FOLDER, PY_MODULE);
};

const selectPort = () => {
    pyPort = 58989;
    return pyPort;
};

const createPyProc = () => {
    let script = getScriptPath();
    let port = '' + selectPort();

    if (guessPackaged()) {
        pyProc = require('child_process').execFile(script, [port], function(err, stdout, stderr) {
            console.log(stdout);
        });
        console.log("packaged")
    } else {
        pyProc = require('child_process').spawn('python', [script, port]);
        console.log("not packaged")
    }

    if (pyProc != null) {
        //console.log(pyProc);
        pyProc.stdout.on('data', function(data) {
            console.log(data.toString());
        });
        console.log('child process success on port ' + port);
    }
};

const exitPyProc = () => {
    pyProc.kill();
    pyProc = null;
    pyPort = null;
};

app.on('ready', createPyProc);
app.on('will-quit', exitPyProc);

/*************************************************************
 * window management
 *************************************************************/

let mainWindow;

function createWindow() {
    app.commandLine.appendSwitch('high-dpi-support', 'true');
    app.commandLine.appendSwitch('force-device-scale-factor', '1');
    mainWindow = new BrowserWindow({width: 500, height: 640, frame: false, webPreferences: { nodeIntegration: true }});
    mainWindow.loadURL(isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, '../build/index.html')}`);
    mainWindow.on('closed', () => mainWindow = null);
}

app.on('ready', () =>{
    createWindow();
    menu.setApplicationMenu(null);
    globalShortcut.register("CmdOrCtrl + Shift + I", () => {mainWindow.webContents.openDevTools()})
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
