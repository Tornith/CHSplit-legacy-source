import React, {Component} from 'react';
import Header from './components/header';
import Sidebar from './components/sidebar';
import Mainbar from './components/mainbar';
import Submenu from "./components/submenu";
import fetch from './components/fetchWithTimeout';
import appInfo from "./appinfo";
import Notification from "./components/notification";
import io from 'socket.io-client'
import OrderedDict from "js-ordered-dict";

let open = window.require("open");

const socketURL = "http://127.0.0.1:58989";

class App extends Component {
    state = {
        sidebarOpened: false,
        submenuOpenedType: null,
        gameState: null,
        sectionHolder: new Map(),
        activeSection: null,
        song: null,
        game: null,
        pb: null,
        /*forceReload: false,*/
        notifications: [],
        newUpdate: false,
        socket: null
    };

    componentDidMount() {
        this.checkUpToDate().then(() => {
            if (this.state.newUpdate) this.pushNotification("update", "A new version of CHSplit is available! Click here to download it!", "update", true, () => {getNewVersion(); this.removeNotification("update");});
        }).catch((e) => {
            console.log("Connection error: Couldn't check for updates " + e);
        });
        this.initSocket().then(() => {
            this.setupListeners();
            this.initialStateCheck();
        });
        /*this.timerGameState = setInterval(
            () => { this.doAppTick(); },
            250
        );*/
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
            this.handleTransferredData(data);
        });
        this.state.socket.on('TRANSFER_SONG_DATA', (data) => {
            this.handleTransferredData(data);
            this.setState({sectionHolder: new Map()});
            this.initializeSectionObjects(this.state.song.sections);
        });
        this.state.socket.on('TRANSFER_GAME_DATA', (data) => {
            this.handleTransferredData(data);
            this.updateSplitsInfo();
        });
        this.state.socket.on('GAME_EVENT', (event) => {
            this.handleRaisedEvent(event);
        });
    };

    initialStateCheck = () => {
        this.manualRequest("state").then((gameState) => {
            let parsedData = JSON.parse(gameState);
            this.setState({ gameState: parsedData.state });
            if (parsedData.state === "game" || gameState.state === "endscreen"){
                const promiseSong = this.manualRequest("song").then((songData) => {
                    this.handleTransferredData(songData);
                });
                const promiseGame = this.manualRequest("game").then((gameData) => {
                    this.handleTransferredData(gameData);
                });
                Promise.all([promiseSong, promiseGame]).then(() => {
                    this.initializeSectionObjects(this.state.song.sections);
                    this.updateSplitsInfo();
                });
            }
        });
    };

    handleTransferredData = (data) => {
        let parsedData = JSON.parse(data);
        console.log(parsedData);
        for (let key in parsedData){
            if (parsedData.hasOwnProperty(key))
                this.setState({[key]: parsedData[key]});
        }
    };

    handleRaisedEvent = (event) => {
        console.log(event)
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

    initializeSectionObjects = (songSections, pbSplits) => {
        const sectionHolder = this.state.sectionHolder;
        songSections.forEach((section) => {
            let sectionInfo = {
                name: section[1],
                time: section[0],
                active: false,
                sectionScore: undefined,
                pbScore: (pbSplits != null) ? pbSplits[section[0]] : null
            };
            sectionHolder.set(section[0], sectionInfo);
        });
        this.setState({sectionHolder});
    };

    updateAllCurrentSplits = (currentSplits) => {
        const sectionHolder = this.state.sectionHolder;
        for (const [position, score] of Object.entries(currentSplits)) {
            sectionHolder.get(parseInt(position)).sectionScore = score;
        }
        this.setState({sectionHolder});
    };

    updateSplitsInfo = () => {
        const {sectionHolder, game, activeSection} = this.state;
        if (game.activeSection !== activeSection){
            this.updateAllCurrentSplits(game.splits);
            if (activeSection !== null) sectionHolder.get(activeSection).active = false;
            sectionHolder.get(game.activeSection).active = true;
            this.setState({activeSection: game.activeSection})
        }
        sectionHolder.get(game.activeSection).sectionScore = game.score;
        this.setState(sectionHolder)
    };

    /*componentWillUnmount() {
        clearInterval(this.timerGameState);
    }

    doAppTick = () => {
        this.getGameState().then(() => {
            switch (this.state.gameState) {
                case "init":
                    break;
                case "menu":
                    this.resetGameData();
                    break;
                case "pregame":
                    break;
                case "game":
                    if (!this.state.sections.length || this.state.forceReload){
                        const fetchSong = this.fetchData('song');
                        const fetchPB = this.fetchData('pb');
                        const fetchGame = this.fetchData('game');
                        Promise.all([fetchSong, fetchPB, fetchGame]).then(() => {
                            const sections = this.loadSections(this.state.song["sections"], this.state.pb, this.state.game["splits"]);
                            this.setState({sections});
                            this.setState({forceReload: false});
                        });
                    }
                    else{
                        this.updateSections()
                    }
                    break;
                case "endscreen":
                    this.setState({forceReload: true});
                    break;
                case "practice":
                    break;
                default:
                    console.error("Unexpected error: Invalid game state (" + this.state.gameState + ")");
                    this.pushNotification("invalid_gamestate", "Unexpected error: Invalid game state: " + this.state.gameState + ".", "error", true);
            }
        }).catch((e) => {
            console.error("Unable to retrieve game state " + e);
            //this.pushNotification("Unexpected error: Unable to retrieve game state.", "error", true);
            this.setState({gameState: "init"});
        });
    };

    async fetchData(id){
        await fetch(apiUri + '/api/' + id).then(response =>
            response.json().then(data => {
                let parsedData = JSON.parse(JSON.stringify(data));
                this.setState({[id]: parsedData});
            })
        ).catch((e) => {
            console.error("Request timeout: couldn't fetch " + id + " data " + e);
            //this.pushNotification("Request timeout: couldn't fetch " + id + " data.", "error", true);
        });
    }

    loadSections = (sections, pbSplits, curSplits) => {
        let holder = [];
        if (sections.length > 0){
            sections.forEach((section) => {
                holder.push({
                    name: section[1],
                    time: section[0],
                    active: (parseInt(section[0]) === this.state.game.activeSection),
                    splitScore: ((section[0] in curSplits) ? curSplits[section[0]] : undefined),
                    pbScore: (pbSplits != null) ? pbSplits[section[0]] : null
                });
            });
        }
        return holder;
    };

    async updateSections(){
        await this.fetchData('game').catch((e) => {
            console.error("Unable to retrieve section info");
        });
    };

    async getGameState(){
        await fetch(apiUri + '/api/state').then(response =>
            response.json().then(data => {
                this.setState({gameState: data})
            })
        ).catch((e) => {
            console.error("Request timeout: Couldn't fetch game state data " + e);
            //this.pushNotification("Request timeout: Couldn't fetch game state data.", "error", true);
        });
    };

    resetGameData = () => {
        console.log("Resetting game data...");
        const defaultState = {
            sections: [],
            song: null,
            game: null,
            pb: null
        };
        this.setState({sections: defaultState["sections"], song: defaultState["song"], game: defaultState["song"], pb: defaultState["pb"]});
    };*/



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

    render() {
        return (
            <React.Fragment>
                <Header />
                <section className="app-body">
                    <Sidebar opened={this.state.sidebarOpened}
                             openedSubmenu={this.state.submenuOpenedType}
                             onToggle={this.handleToggleSidebar}
                             onMenuSelect={this.handleToggleSubmenu}
                             onSubmenuDefocus={(this.state.submenuOpenedType != null ? () => this.handleToggleSubmenu(null) : undefined)}
                    />
                    <Mainbar data={{'song': this.state.song, 'pb': this.state.pb, 'game': this.state.game}}
                             notifications={this.state.notifications}
                             renderState={this.state.gameState}
                             sectionHolder={this.state.sectionHolder}
                             sidebarOpened={this.state.sidebarOpened}
                             onSidebarDefocus={(this.state.sidebarOpened ? this.handleToggleSidebar : undefined)}
                    />
                </section>
                <Submenu openedSubmenu={this.state.submenuOpenedType} newUpdate={this.state.newUpdate} checkForUpdates={this.checkUpToDate}/>
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

    checkUpToDate = async () => {
        let uri = 'https://chsplit.tornith.cz/version.json';
        let h = new Headers();
        h.append('Accept', 'application/json');
        let req = new Request(uri, {method: "POST", headers: h, mode: "cors"});

        await fetch(req).then((response) => {
            if (response.ok){
                return response.json();
            }
            else{
                console.error("HTTP Error: Couldn't fetch version data");
            }
        }).then(data => {
            const parsed = JSON.parse(JSON.stringify(data));
            const result = (this.compareVersions(appInfo.version, parsed.version) > 0);
            this.setState({newUpdate: result});
            return result;
        }).catch((e) => {
            return false;
        });
    };

    compareVersions(ver1, ver2){
        const regex = new RegExp(`[0-9]+(\\.[0-9]+)*(([ab]|(rc))?\\d*)?`, 'gi');
        if (!ver1.match(regex) || !ver2.match(regex)) return false;
        ver1 = ver1.replace("a", "|1.").replace("b", "|2.").replace("rc", "|3.").replace(new RegExp(`((\\.0)+$)|((\\.0)+(?=\\|))`), "");
        ver2 = ver2.replace("a", "|1.").replace("b", "|2.").replace("rc", "|3.").replace(new RegExp(`((\\.0)+$)|((\\.0)+(?=\\|))`), "");
        const splitVer1 = ver1.split('|')[0].split('.');
        const splitVer2 = ver2.split('|')[0].split('.');
        const cmpVersion = this.compareArrays(splitVer1, splitVer2);
        if (cmpVersion !== 0) return cmpVersion;
        if (ver1.split('|').length === 2 && ver2.split('|').length === 2){
            const subver1 = ver1.split('|')[1].split('.').filter(x => (x !== ""));
            const subver2 = ver2.split('|')[1].split('.').filter(x => (x !== ""));
            const cmpSubVersion = this.compareArrays(subver1, subver2);
            if (cmpSubVersion !== 0) return cmpSubVersion;
        }
        else if (ver1.split('|').length !== ver2.split('|').length){
            return (ver1.split('|').length > ver2.split('|').length) ? 1 : -1;
        }
        else return 0;
    }

    compareArrays(arr1, arr2){
        for (let i = 0; i < Math.min(arr1.length, arr2.length); i++){
            let cmp = parseInt(arr2[i]) - parseInt(arr1[i]);
            if (cmp !== 0) return cmp;
        }
        if (arr1.length !== arr2.length){
            return (arr1.length < arr2.length) ? 1 : -1;
        }
        return 0;
    }
}

const getNewVersion = () => {
    const newVersionURL = "https://chsplit.tornith.cz/get_version.php?version=newest";
    open(newVersionURL);
};

export default App;
