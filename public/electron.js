const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const menu = electron.Menu;
const globalShortcut = electron.globalShortcut;

const path = require('path');
const pstree = require('ps-tree');
const isDev = require('electron-is-dev');
const unhandled = require('electron-unhandled');
const fs = require('fs');
const yaml = require('js-yaml');
const windowStateKeeper = require('electron-window-state');
const portfinder = require('portfinder');
const socketio = require('socket.io-client');

const portable_path = process.env.PORTABLE_EXECUTABLE_DIR;
const exec_path = (portable_path === undefined) ? path.join(__dirname, '..') : portable_path;

/*************************************************************
 * py process
 *************************************************************/

const PY_DIST_FOLDER = '../pydist';
const PY_FOLDER = '../pysrc';
const PY_MODULE = 'CHSplit'; // without .py suffix

let pids = [];
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

const selectPort = async () => {
    return await portfinder.getPortPromise({port: 58989});
};

const createPyProc = (config) => {
    let script = getScriptPath();
    const config_str = JSON.stringify(config);
    config_str.replace("\"", "'");
    /*selectPort().then((res) => {*/
        let port = '' + 58989;
        pyPort = port;
        global.port = port;
        if (guessPackaged()) {
            pyProc = require('child_process').execFile(script, [exec_path, port, config_str], function(err, stdout, stderr) {
                console.log(stdout);
                console.log(stderr);
            });
            console.log("packaged");
            pyProc.on('exit', () => {
                console.log("Exiting child process");
            });
            console.log("packaged");
        } else {
            pyProc = require('child_process').spawn('python', [script, exec_path, port, config_str]);
            console.log("not packaged")
        }

        if (pyProc != null) {
            pids.push(pyProc.pid);
            console.log(pyProc.pid);
            pyProc.stdout.on('data', (data) => {
                console.log(data.toString());
            });
            pyProc.stderr.on('data', (data) => {
                console.log(data.toString());
            });
            pyProc.on('exit', () => {
                console.log("Exiting child process");
            });
            console.log('child process success on port ' + port);
        }
    /*});*/
};

const killProcesses = () => {
    //Shutdown the server
    const port = "http://127.0.0.1:" + pyPort;
    socketio.connect(port, {query: "shutdown"});
    pyProc = null;
};

/*************************************************************
 * window management
 *************************************************************/

let mainWindow;

function createWindow(config) {
    app.commandLine.appendSwitch('high-dpi-support', 'true');
    app.commandLine.appendSwitch('force-device-scale-factor', '1');
    app.commandLine.appendSwitch ("disable-http-cache");

    let prevWindowState = windowStateKeeper({
        defaultWidth: 500,
        defaultHeight: 640
    });

    mainWindow = new BrowserWindow({
        x: prevWindowState.x,
        y: prevWindowState.y,
        width: prevWindowState.width,
        height: prevWindowState.height,
        frame: false, webPreferences: { nodeIntegration: true }});
    if (config.alwaysOnTop){
        mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
        mainWindow.setVisibleOnAllWorkspaces(true);
        mainWindow.fullScreenable = false;
    }
    mainWindow.loadURL(isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, '../build/index.html')}`);
    mainWindow.on('closed', () => {
        mainWindow = null;
        killProcesses();
        app.quit();
    });
    prevWindowState.manage(mainWindow);
}

function loadConfig(){
    const defaultPreferences = yaml.safeLoad(fs.readFileSync(path.join(__dirname, "defaultConfig.yml"), 'utf8')).config;
    const configPath = path.join(exec_path, "config.yml");
    if (fs.existsSync(configPath)){
        try{
            let yml = yaml.safeLoad(fs.readFileSync(configPath, 'utf8'));
            if (yml === undefined){
                writeConfigFile(defaultPreferences, configPath);
                return defaultPreferences;
            }
            else {
                verifyConfigIntegrity(yml.config, defaultPreferences, configPath);
                return yml.config;
            }
        } catch(e) {
            console.error(e);
        }
    } else {
        writeConfigFile(defaultPreferences, configPath);
        return defaultPreferences;
    }
}

function verifyConfigIntegrity(config, defaultConfig, configPath){
    Object.entries(defaultConfig).forEach(([key, value]) => {
        if(!(key in config)){
            config[key] = value;
        }
    });
    writeConfigFile(config, configPath);
}

function writeConfigFile(config, path){
    const str = yaml.safeDump({config: config});
    fs.writeFileSync(path, str, (err) => {
        if(err){
            console.error(err);
        }
    });
}

function updateConfig(id, val){
    if(id === "alwaysOnTop"){
        if (val){
            mainWindow.setAlwaysOnTop(true, "floating", 1);
            mainWindow.setVisibleOnAllWorkspaces(true);
        }
        else{
            mainWindow.setAlwaysOnTop(false);
            mainWindow.setVisibleOnAllWorkspaces(false);
        }
    }
    writeConfigFile(config, path.join(exec_path, "config.yml"));
}

function reloadApp(){
    mainWindow.reload();
    if (!isDev) createPyProc(config);
}

global.config = loadConfig();
if (config.disableHardwareAcceleration){
    app.disableHardwareAcceleration();
}

app.on('ready', () =>{
    if (!app.requestSingleInstanceLock()){
        app.quit();
    }
    else{
        global.updateConfig = updateConfig;
        createPyProc(config);
        createWindow(config);
        menu.setApplicationMenu(null);
        globalShortcut.register("CmdOrCtrl + Shift + I", () => {mainWindow.webContents.openDevTools()});
        globalShortcut.register("CmdOrCtrl + R", () => {reloadApp()});
        // React Dev Tools
        if (isDev){
            BrowserWindow.addDevToolsExtension(
                path.join('C:\\Users\\Michal\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Extensions\\fmkadmapgofadopljbjfkapdkoienihi\\4.4.0_0')
            )
        }
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

app.on('window-all-closed', () => {
    killProcesses();
});

unhandled();