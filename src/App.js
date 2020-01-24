import React, {Component} from 'react';
import Header from './components/header';
import Sidebar from './components/sidebar';
import Mainbar from './components/mainbar';
import Submenu from "./components/submenu";
import fetch from './components/fetchWithTimeout';
import appInfo from "./appinfo";
import Notification from "./components/notification";
import io from 'socket.io-client';

let open = window.require("open");
if (process.env.NODE_ENV !== 'production') {
    const whyDidYouRender = require('@welldone-software/why-did-you-render/dist/no-classes-transpile/umd/whyDidYouRender.min.js');
    whyDidYouRender(React);
}

const socketURL = "http://127.0.0.1:58989";

class App extends Component {
    constructor(props){
        super(props);
        const preferences = this.loadConfigFile();
        this.state = {
            sidebarOpened: false,
            submenuOpenedType: null,
            gameState: null,
            sectionHolder: new Map(),
            song: null,
            game: {score: 0, time: -1, activeSection: undefined, splits: {}},
            pb: null,
            notifications: [],
            newUpdate: false,
            socket: null,
            preferences: preferences
        };
        import("./css/" + this.state.preferences.styleChosen + ".css");
    }

    componentDidMount() {
        this.checkUpToDate().then(() => {
            if (this.state.newUpdate) this.pushNotification("update", "A new version of CHSplit is available! Click here to download it!", "update", true, () => {getNewVersion(); this.removeNotification("update");});
        }).catch((e) => {
            console.log("Connection error: Couldn't check for updates " + e);
        });
        this.initSocket().then(() => {
            this.setupListeners();
            this.retrieveAllData();
        });
    }

    async initSocket(){
        const socket = io(socketURL);
        this.setState({socket});
        await socket.on('connect', async () => {
            console.log("SocketIO connection established");
        });
    };

    setupListeners = () => {
        this.state.socket.on('TRANSFER_DATA', (data) => {
            const parsedData = this.parseTransferredData(data);
            this.addDataToState(parsedData);
        });
        this.state.socket.on('TRANSFER_SONG_DATA', (data) => {
            const parsedData = this.parseTransferredData(data);
            this.addDataToState(parsedData);
            this.setState({sectionHolder: new Map()});
            this.initializeSectionObjects();
        });
        this.state.socket.on('TRANSFER_GAME_DATA', (data) => {
            const parsedData = this.parseTransferredData(data);
            let game = {score: parsedData.score === undefined ? 0 : parsedData.score,
                        time: parsedData.time === undefined ? -1.0 : parsedData.time,
                        activeSection: parsedData.activeSection,
                        splits: parsedData.splits === undefined ? {} : parsedData.splits};
            this.setState({game});
        });
        this.state.socket.on('TRANSFER_GAME_DATA[score]', (data) => {
            if (this.state.score !== parseInt(data)){
                this.setState({game:{...this.state.game, score: parseInt(data)}});
                //this.updateSplitsInfo();
            }
        });
        this.state.socket.on('TRANSFER_GAME_DATA[time]', (data) => {
            if (this.state.game.time !== parseFloat(data)){
                this.setState({game:{...this.state.game, time: parseFloat(data)}});
            }
        });
        this.state.socket.on('TRANSFER_GAME_DATA[newSplit]', (data) => {
            const splitInfo = data.split(":");
            if (!(parseInt(splitInfo[0]) in this.state.game.splits)) {
                let newSplits = {};
                Object.assign(newSplits, this.state.game.splits);
                newSplits[parseInt(splitInfo[0])] = parseInt(splitInfo[1]);
                this.setState(prevState => ({
                    game: {...prevState.game,
                        splits: newSplits
                    }
                }));
                //this.updateAllCurrentSplits();
            }
        });
        this.state.socket.on('TRANSFER_GAME_DATA[activeSection]', (data) => {
            if (this.state.game.activeSection !== parseInt(data)) {
                this.setState({game:{...this.state.game, activeSection: parseInt(data)}});
                this.updateAllCurrentSplits();
            }
        });
        this.state.socket.on('TRANSFER_STATE_DATA', (data) => {
            if (this.state.gameState !== data) {
                this.handleChangeOfState(data);
                this.setState({gameState: data});
            }
        });
        this.state.socket.on('GAME_EVENT', (event) => {
            this.handleRaisedEvent(event);
        });
    };

    retrieveAllData = () => {
        this.manualRequest("state").then((gameState) => {
            let parsedData = JSON.parse(gameState);
            this.setState({ gameState: parsedData.state });
            if (parsedData.state === "game" || gameState.state === "endscreen"){
                const promiseSong = this.manualRequest("song").then((songData) => {
                    const data = this.parseTransferredData(songData);
                    this.addDataToState(data);
                });
                const promiseGame = this.manualRequest("game").then((gameData) => {
                    const data = this.parseTransferredData(gameData);
                    this.addDataToState(data);
                });
                Promise.all([promiseSong, promiseGame]).then(() => {
                    this.initializeSectionObjects();
                    this.updateAllCurrentSplits();
                });
            }
        });
    };

    parseTransferredData = (data) => {
        return JSON.parse(data);
    };

    addDataToState(data){
        for (let key in data){
            if (data.hasOwnProperty(key)){
                this.setState({[key]: data[key]});
            }
        }
    };

    handleRaisedEvent = (event) => {
        if (event === "gameRestart"){
            this.clearSplits();
        }
    };

    manualRequest(data, timeout=2000){
        return new Promise((resolve, reject) => {
            let timer;

            this.state.socket.emit("REQUEST_DATA", data);

            function responseHandler(response){
                resolve(response);
                clearTimeout(timer);
            }
            this.state.socket.once("REQUEST_RESPONSE_" + data.toUpperCase(), responseHandler);

            timer = setTimeout(() => {
                reject(new Error("Request timeout: couldn't fetch " + data));
                this.state.socket.removeListener('REQUEST_RESPONSE_' + data.toUpperCase(), responseHandler);
            }, timeout);
        })
    }

    initializeSectionObjects = () => {
        const songSections = this.state.song.sections;
        const pbSplits = this.state.pb;
        const sectionHolder = this.state.sectionHolder;
        songSections.forEach((section) => {
            let sectionInfo = {
                name: section[1],
                time: section[0],
                active: false,
                sectionScore: undefined,
                pbScore: (!isDictEmpty(pbSplits)) ? pbSplits[section[0]] : null
            };
            sectionHolder.set(section[0], sectionInfo);
        });
        this.setState({sectionHolder});
    };

    updateAllCurrentSplits = () => {
        const currentSplits = this.state.game.splits;
        const activeSection = this.state.game.activeSection;
        let newMap = new Map(this.state.sectionHolder);
        for (const [position, score] of Object.entries(currentSplits)) {
            newMap.get(parseInt(position)).sectionScore = score;
        }
        newMap.forEach((value => {value.active = false}));
        console.log(activeSection);
        console.log(this.state.song.sections[0][0]);
        newMap.get(activeSection !== undefined ? activeSection : this.state.song.sections[0][0]).active = true;
        if (this.state.sectionHolder !== newMap)
            this.setState({sectionHolder: newMap});
    };

    clearSplits = () => {
        const {sectionHolder} = this.state;
        sectionHolder.forEach((value => {value.sectionScore = undefined}));
    };

    handleToggleSidebar = () => {
        const sidebarOpened = !this.state.sidebarOpened;
        if(!sidebarOpened && this.state.submenuOpenedType != null) this.setState({submenuOpenedType: null});
        this.setState({sidebarOpened});
    };

    handleToggleSubmenu = (submenuType) =>{
        if(this.state.submenuOpenedType === null || this.state.submenuOpenedType !== submenuType){
            this.setState({submenuOpenedType: submenuType});
        }
        else{
            this.setState({submenuOpenedType: null});
        }
    };

    handleChangeOfState = (newState) => {
        if (newState === "menu"){
            this.resetSongData();
        }
    };

    resetSongData = () => {
        this.setState({
            song: null,
            game: {score: 0, time: -1, activeSection: undefined, splits: {}},
            pb: null
        })
    };

    render() {
        return (
            <React.Fragment>
                <Header />
                <section className={"app-body" + (this.state.preferences.showAnimations ? "" : " no-anim")}>
                    <Sidebar opened={this.state.sidebarOpened}
                             openedSubmenu={this.state.submenuOpenedType}
                             onToggle={this.handleToggleSidebar}
                             onMenuSelect={this.handleToggleSubmenu}
                             onSubmenuDefocus={(this.state.submenuOpenedType != null ? () => this.handleToggleSubmenu(null) : undefined)}
                    />
                    <Mainbar song={this.state.song}
                             game={this.state.game}
                             notifications={this.state.notifications}
                             renderState={this.state.gameState}
                             sectionHolder={this.state.sectionHolder}
                             sidebarOpened={this.state.sidebarOpened}
                             onSidebarDefocus={(this.state.sidebarOpened ? this.handleToggleSidebar : undefined)}
                             preferences={this.state.preferences}
                    />
                </section>
                <Submenu openedSubmenu={this.state.submenuOpenedType} newUpdate={this.state.newUpdate} checkForUpdates={this.checkUpToDate} preferences={this.state.preferences} onPreferenceUpdate={this.updatePreference}/>
            </React.Fragment>
        );
    }

    pushNotification = (id, text, type, closeable, action) => {
        let curNotifs = this.state.notifications;
        if (curNotifs.filter(x => (x.props.text === text)).length === 0){
            curNotifs.push(<Notification key={id} id={id} text={text} type={type} closeable={closeable} action={action} closeNotification={this.removeNotification} />);
            this.setState({notifications: curNotifs});
        }
    };

    removeNotification = (notification) => {
        console.log("removing " + notification);
        let filtered = this.state.notifications.filter(x => (x.props.id !== notification));
        this.setState({notifications: filtered});
    };

    loadConfigFile = () => {
        return window.require("electron").remote.getGlobal('config');
    };

    updatePreference = (id, val) =>{
        this.setState(prevState => ({
            preferences: {...prevState.preferences,
                [id]: val
            }
        }));
        window.require("electron").remote.getGlobal('config')[id] = val;
        window.require("electron").remote.getGlobal('updateConfig')(id, val);
    };

    checkUpToDate = async () => {
        let uri = 'https://raw.githubusercontent.com/Tornith/CHSplit/master/version.json';
        let h = new Headers();
        h.append('Accept', 'application/json');
        let req = new Request(uri, {method: "GET", headers: h});

        await fetch(req).then((response) => {
            if (response.ok){
                return response.json();
            }
            else{
                console.error("HTTP Error: Couldn't fetch version data");
            }
        }).then(data => {
            const parsed = JSON.parse(JSON.stringify(data));
            const hierarchy = ["dev", "alpha", "beta", "rc"];
            const newest = (hierarchy.some(val => appInfo.version.includes(val))) ? parsed.version : parsed.stableVersion;
            const result = (compareVersions(appInfo.version, newest) < 0);
            this.setState({newUpdate: result});
            return result;
        }).catch((e) => {
            console.error(e);
            return false;
        });
    };
}

const compareVersions = (a, b) => {
    const hierarchy = ["dev", "alpha", "beta", "rc"];
    const regex = new RegExp(`(\\d+)(\\.\\d+)+((-)([(` + hierarchy.join(")(") + `)]+)(\\.\d+)*)?`, 'gi');
    if (!a.match(regex) || !b.match(regex)) return undefined;
    if (a === b) return 0;

    const softParseInt = (int) => isNaN(parseInt(int)) ? int : parseInt(int);
    const splitVersionArray = (arr) => arr.split('-').map(value => value.split('.'))
        .map((value) => value.map(value => softParseInt(value)));
    const arrCmp = (arr1, arr2) => {
        const modArr1 = arr1.concat(Array(Math.max(0, arr2.length - arr1.length)).fill(0));
        const modArr2 = arr2.concat(Array(Math.max(0, arr1.length - arr2.length)).fill(0));
        return modArr1.map((val, index) =>
            (parseInt(val) - parseInt(modArr2[index]))
        ).find(value => value !== 0) || 0;
    };

    const ver1 = splitVersionArray(a);
    const ver2 = splitVersionArray(b);

    const baseVer = arrCmp(ver1[0], ver2[0]);

    if (baseVer === 0 && (ver1.length > 1 || ver2.length > 1)){
        if (ver1.length !== ver2.length) return (ver1.length < ver2.length) ? 1 : -1;
        else {
            const subVerPhase = hierarchy.indexOf(ver1[1][0]) - hierarchy.indexOf(ver2[1][0]);
            if (subVerPhase !== 0) return subVerPhase;
            else {
                ver1[1].shift();
                ver2[1].shift();
                return arrCmp(ver1[1], ver2[1]);
            }
        }
    }
    return baseVer;
};

const getNewVersion = () => {
    const newVersionURL = "https://github.com/Tornith/CHSplit/releases/latest";
    open(newVersionURL);
};

const isDictEmpty = (dict) => {
    return Object.keys(dict).length === 0;
};

export default App;
