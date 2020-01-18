const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const menu = electron.Menu;
const globalShortcut = electron.globalShortcut;

const path = require('path');
const psTree = require('ps-tree');
const isDev = require('electron-is-dev');
const url = require('url');
const rq = require('request-promise');
const unhandled = require('electron-unhandled');
const fs = require('fs');
const yaml = require('js-yaml');

const portable_path = process.env.PORTABLE_EXECUTABLE_DIR;
const exec_path = (portable_path === undefined) ? path.join(__dirname, '../') : portable_path;

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

const createPyProc = (config) => {
    let script = getScriptPath();
    let port = '' + selectPort();
    const config_str = JSON.stringify(config);
    if (guessPackaged()) {
        pyProc = require('child_process').execFile(script, [exec_path, port, config_str], function(err, stdout, stderr) {
            console.log(stdout);
        });
        console.log("packaged");
        pyProc.on('exit', () => {
            console.log("exitiing child rpcoes");
        })
    } else {
        pyProc = require('child_process').spawn('python', [script, exec_path, port, config_str]);
        console.log("not packaged")
    }

    if (pyProc != null) {
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

/*************************************************************
 * window management
 *************************************************************/

let mainWindow;

function createWindow() {
    app.commandLine.appendSwitch('high-dpi-support', 'true');
    app.commandLine.appendSwitch('force-device-scale-factor', '1');
    mainWindow = new BrowserWindow({width: 500, height: 640, frame: false, webPreferences: { nodeIntegration: true }});
    mainWindow.loadURL(isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, '../build/index.html')}`);
    /*mainWindow.loadURL(url.format({
        pathname: isDev ? '127.0.0.1:3000' : path.join(__dirname, '../build/index.html'),
        protocol: isDev ? 'http:' : 'file:',
        slashes: true
    }));*/
    mainWindow.on('closed', () => mainWindow = null);
}

function loadConfig(){
    const defaultPreferences = yaml.safeLoad(fs.readFileSync(path.join(__dirname, "..", "src", "defaultConfig.yml"), 'utf8')).config;
    const configPath = path.join(__dirname, "..", "config.yml");
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

function saveConfig(){
    writeConfigFile(config, path.join(__dirname, "..", "config.yml"));
}

app.on('ready', () =>{
    global.config = loadConfig();
    global.saveConfig = saveConfig;
    createPyProc(config);
    createWindow();
    menu.setApplicationMenu(null);
    globalShortcut.register("CmdOrCtrl + Shift + I", () => {mainWindow.webContents.openDevTools()});
    // React Dev Tools
    if (isDev){
        BrowserWindow.addDevToolsExtension(
            path.join('C:\\Users\\Michal\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Extensions\\fmkadmapgofadopljbjfkapdkoienihi\\4.4.0_0')
        )
    }
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

app.on('before-quit', () =>{
    exitPyProc();
});

unhandled();