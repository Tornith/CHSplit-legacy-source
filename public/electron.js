const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const menu = electron.Menu;
const globalShortcut = electron.globalShortcut;
const screen = electron.screen;

const path = require('path');
const url = require('url');
const psTree = require('ps-tree');
const isDev = require('electron-is-dev');
const rq = require('request-promise');

const portable_path = process.env.PORTABLE_EXECUTABLE_DIR;
const exec_path = (portable_path === undefined) ? path.join(__dirname, '../') : portable_path;
console.log(exec_path);

/*************************************************************
 * py process
 *************************************************************/

const PY_DIST_FOLDER = '../pydist';
const PY_FOLDER = '../pysrc';
const PY_MODULE = 'CHSplit'; // without .py suffix

let pyPort = null;
let pyProc = null;

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
        pyProc = require('child_process').execFile(script, [port, exec_path], function(err, stdout, stderr) {
            console.log(stdout);
        });
        console.log("packaged");
        pyProc.on('exit', () => {
            console.log("exitiing child rpcoes");
        })
    } else {
        pyProc = require('child_process').spawn('python', [script, port, exec_path]);
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
    rq('http://127.0.0.1:' + pyPort + '/shutdown').then(() => {
        console.log("Successfully shut down the API server");
    }).catch((e) => {
        console.error(e);
    }).finally(() => {
        killProcesses(pyProc);
        pyProc = null;
        pyPort = null;
    });
};

const killProcesses = (process) => {
    psTree(process.pid, function (err, children) {
        require('child_process').spawn('kill', ['-9'].concat(children.map(function (p) { return p.PID })));
    });
};

app.on('ready', createPyProc);
app.on('before-quit', exitPyProc);

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
