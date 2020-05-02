import React, {Component} from 'react';
import appInfo from '../appinfo.json';
import iconSpinner from '../svg/icon-spinner.svg';
import {Checkbox, ListGroupAJAX, RadioGroup} from './formcomponents';
import fetch from "./fetchWithTimeout";
import {compareVersions} from './utils'

class Submenu extends Component {
    constructor(props){
        super(props);
    }
    render() {
        return (
            <div className={"submenu-wrapper" + (this.props.preferences.showAnimations ? "" : " no-anim") + ((this.props.openedSubmenu == null) ? "" : " opened")}>
                <SubmenuOptions opened={this.props.openedSubmenu === "Options"} preferences={this.props.preferences} onPreferenceUpdate={this.props.onPreferenceUpdate} socket={this.props.socket} manualRequest={this.props.manualRequest}/>
                <SubmenuAbout opened={this.props.openedSubmenu === "About"} newUpdate={this.props.newUpdate} checkForUpdates={this.props.checkForUpdates} openLink={this.props.openLink} getNewVersion={this.props.getNewVersion}/>
                <SubmenuSplits opened={this.props.openedSubmenu === "Splits"} />
            </div>
        );
    }
}

class SubmenuOptions extends Component {
    render() {
        return (
            <div className={"submenu-content " + (this.props.opened ? "opened" : "")}>
                <h2>Options</h2>
                <div className="submenu-subcontent">
                    <ListGroupAJAX id={"selectedGameVersion"} label={"Game version:"} getOptions={this.getGameVersions} value={this.props.preferences.selectedGameVersion} onInputUpdate={this.props.onPreferenceUpdate} restartRequired/>
                    <hr/>
                    <Checkbox id={"alwaysOnTop"} label={"Always on top"} value={this.props.preferences.alwaysOnTop} onInputUpdate={this.props.onPreferenceUpdate} />
                    <Checkbox id={"showActiveSectionDifference"} label={"Always show active section difference"} value={this.props.preferences.showActiveSectionDifference} onInputUpdate={this.props.onPreferenceUpdate} />
                    <Checkbox id={"showActiveSectionScore"} label={"Show current score in an active section"} value={this.props.preferences.showActiveSectionScore} onInputUpdate={this.props.onPreferenceUpdate} />
                    <Checkbox id={"lastSectionAnchored"} label={"Anchor last section to the bottom"} value={this.props.preferences.lastSectionAnchored} onInputUpdate={this.props.onPreferenceUpdate} />
                    <Checkbox id={"showSongProgressBar"} label={"Show song's progress bar"} value={this.props.preferences.showSongProgressBar} onInputUpdate={this.props.onPreferenceUpdate} />
                    <Checkbox id={"hideTotalScore"} label={"Hide the total score panel"} value={this.props.preferences.hideTotalScore} onInputUpdate={this.props.onPreferenceUpdate} />
                    <Checkbox id={"showAnimations"} label={"Show animations"} value={this.props.preferences.showAnimations} onInputUpdate={this.props.onPreferenceUpdate} />
                    <Checkbox id={"enableAutoscroll"} label={"Auto-scroll to active section"} value={this.props.preferences.enableAutoscroll} onInputUpdate={this.props.onPreferenceUpdate} />
                    <Checkbox id={"disableHardwareAcceleration"} label={"Disable hardware acceleration"} value={this.props.preferences.disableHardwareAcceleration} onInputUpdate={this.props.onPreferenceUpdate} restartRequired/>
                    <hr/>
                    <RadioGroup id={"styleChosen"} label={"Application theme:"} options={[
                        {label:"Light theme", value:"defaultLight"},
                        {label:"Dark theme", value:"defaultDark"}]}
                                value={this.props.preferences.styleChosen} onInputUpdate={this.props.onPreferenceUpdate} restartRequired/>
                </div>
            </div>
        );
    }

    getGameVersions = async () => {
        const ajaxURI = 'https://raw.githubusercontent.com/Tornith/CHSplit/master/remote/gameVersions.json';
        let localList = [], ajaxList = [];
        const promiseLocal = this.getLocalGameVersionList().then((list) => {
            localList = list;
        });
        const promiseAJAX = this.getAJAXGameVersionList(ajaxURI).then((list) => {
            list.forEach(header => {
                header.options = header.options.filter(opt => {
                    let min_ver = ("min_version" in opt) ? opt["min_version"] : "-1.0";
                    let max_ver = ("max_version" in opt) ? opt["max_version"] : "9999.0";
                    return compareVersions(appInfo.version, min_ver, true) >= 0 &&
                        compareVersions(appInfo.version, max_ver, true) < 0;
                });
            });
            ajaxList = list;
        });
        return new Promise(((resolve, reject) => {
            Promise.allSettled([promiseLocal, promiseAJAX]).then(() => {
                resolve(this.mergeGameVerLists(localList, ajaxList));
            }).catch(e => {
                console.error(e);
                reject(e);
            });
        }));
    };

    getLocalGameVersionList = async () => {
        return new Promise((resolve, reject) => {
            this.props.manualRequest("offset_list").then((list) => {
                let localList = [];
                const parsedList = JSON.parse(list);
                let grouped = {};
                parsedList["offset_list"].forEach((entry) => {
                    if (grouped.hasOwnProperty(entry["file_category"])) grouped[entry["file_category"]].push(entry);
                    else grouped[entry["file_category"]] = [entry];
                });
                Object.keys(grouped).forEach((key) => {
                    let section = {header: key, options:[]};
                    grouped[key].forEach((entry) => {
                        if (compareVersions(appInfo.version, entry["min_version"], true) >= 0 &&
                            compareVersions(appInfo.version, entry["max_version"], true) < 0) {
                            section.options.push({
                                label: entry["game_label"],
                                value: entry["game_version"],
                                local: true
                            });
                        }
                    });
                    localList.push(section);
                });
                resolve(localList);
            }).catch(e => {
                console.error(e);
                reject(e);
            });
        });
    };

    getAJAXGameVersionList = async (uri) => {
        let h = new Headers();
        h.append('Accept', 'application/json');
        let req = new Request(uri, {method: "GET", headers: h});

        return new Promise((resolve, reject) => {
            fetch(req).then((response) => {
                if (response.ok) {
                    resolve(response.json());
                } else {
                    reject('HTTP Error: Couldn\'t fetch version data');
                }
            }).catch(reason => {
                console.error(reason);
                reject(reason);
            })
        });
    };

    mergeGameVerLists = (l1, l2) => {
        const sectionOrder = ["StrikeLine", "Clone Hero", "CHLauncher", "Custom"];
        const listSort = (list, a, b) => {return list.indexOf(a) === -1 ? 1 : list.indexOf(b) === -1 ? -1 : list.indexOf(a) - list.indexOf(b)};
        const entrySort = (a, b) => {
            const numsA = a.match(/(\d+)/g);
            const numsB = b.match(/(\d+)/g);
            if (numsA !== null && numsB !== null){
                let res = 0;
                for(let i = 0; i < Math.min(numsA.length, numsB.length); i++){
                    res = numsA[i] - numsB[i];
                    if (res !== 0) break;
                }
                if (res === 0){
                    return ("" + a).localeCompare(b);
                }
                return res;
            }
        };

        let output = [];
        [...l1, ...l2.filter(sct => {
            return l1.every(sct2 => sct.header !== sct2.header);
        })].sort((a, b) => {return listSort(sectionOrder, a.header, b.header)})
            .forEach(section1 => {
            let merged = {header: section1.header, options: [...section1.options]};
            const section2 = l2.find(ob => ob.header === section1.header);
            if (section2 !== undefined){
                const lel = section2.options.filter(opt => !section1.options.some(x => x.value === opt.value));
                merged.options = merged.options.concat(lel);
            }
            merged.options.sort((a, b) => entrySort(b.value, a.value));
            output.push(merged);
        });
        return output;
    }
}

class SubmenuAbout extends Component {
    state = {
        checkedUpToDate: false,
        checkingUpToDate: false
    };

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (!prevProps.opened && this.props.opened){
            this.setState({checkedUpToDate: false, checkingUpToDate: false});
        }
    }

    render() {
        return (
            <div className={"submenu-content " + (this.props.opened ? "opened" : "")}>
                <h2>About</h2>
                <div className="submenu-subcontent">
                    <div className="about-logo">
                        <span className="about-logo-title">CHSplit</span>
                        <span className="about-logo-version">&nbsp;v{appInfo.version}</span>
                    </div>
                    <p>
                        <button className={"update-button" + (this.props.newUpdate ? " new-version" : "")} onClick={this.props.newUpdate ? this.props.getNewVersion : this.checkUpdates} disabled={(this.state.checkedUpToDate || this.state.checkingUpToDate) ? (!this.props.newUpdate) : false}>
                            {(this.props.newUpdate ? "New version available!" : (this.state.checkedUpToDate ? "Up to date" : (this.state.checkingUpToDate ? "Checking" : "Check for updates")))}
                            {this.state.checkingUpToDate ? <object type="image/svg+xml" data={iconSpinner}>...</object> : ""}
                        </button>
                    </p>
                    <p>CHSplit &copy; 2020 Tornith, All rights reserved.</p>
                    <hr/>
                    <p className={"about-buttons"}>
                        <button onClick={() => {this.props.openLink("https://github.com/Tornith/CHSplit")}}>GitHub Page</button>
                        <button onClick={() => {this.props.openLink("https://github.com/Tornith/CHSplit/issues")}}>Report Bugs</button>
                        <button onClick={() => {this.props.openLink("https://github.com/Tornith/CHSplit/blob/master/CHANGELOG.md")}}>Changelog</button>
                    </p>
               </div>
            </div>
        );
    }

    checkUpdates = () => {
        this.setState({checkingUpToDate: true});
        this.props.checkForUpdates.call().then(() => {
            this.setState({checkingUpToDate: false, checkedUpToDate: true});
        }).catch((e) => {
            this.setState({checkingUpToDate: false, checkedUpToDate: false});
            console.error("Connection error: Couldn't check for updates " + e);
        });
    };
}

class SubmenuSplits extends Component {
    render() {
        return (
            <div className={"submenu-content " + (this.props.opened ? "opened" : "")}>
                <h2>Splits Browser</h2>
                <div className="submenu-subcontent">

                </div>
            </div>
        );
    }
}

export default Submenu;