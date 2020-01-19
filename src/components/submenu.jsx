import React, {Component} from 'react';
import appInfo from '../appinfo.json';
import iconSpinner from '../svg/icon-spinner.svg';
import {Checkbox, ListGroupAJAX, RadioGroup} from './formcomponents';
import fetch from "./fetchWithTimeout";

class Submenu extends Component {
    render() {
        return (
            <div className={"submenu-wrapper" + (this.props.preferences.showAnimations ? "" : " no-anim") + ((this.props.openedSubmenu == null) ? "" : " opened")}>
                <SubmenuOptions opened={this.props.openedSubmenu === "Options"} preferences={this.props.preferences} onPreferenceUpdate={this.props.onPreferenceUpdate}/>
                <SubmenuAbout opened={this.props.openedSubmenu === "About"} newUpdate={this.props.newUpdate} checkForUpdates={this.props.checkForUpdates}/>
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
                    <ListGroupAJAX id={"selectedGameVersion"} label={"Game version:"} getOptions={this.getGameVersions} value={this.props.preferences.selectedGameVersion} onInputUpdate={this.props.onPreferenceUpdate} />
                    <hr/>
                    <Checkbox id={"alwaysOnTop"} label={"Always on top"} value={this.props.preferences.alwaysOnTop} onInputUpdate={this.props.onPreferenceUpdate} />
                    <Checkbox id={"showActiveSectionDifference"} label={"Always show active section difference"} value={this.props.preferences.showActiveSectionDifference} onInputUpdate={this.props.onPreferenceUpdate} />
                    <Checkbox id={"showActiveSectionScore"} label={"Show current score in an active section"} value={this.props.preferences.showActiveSectionScore} onInputUpdate={this.props.onPreferenceUpdate} />
                    <Checkbox id={"showSongProgressBar"} label={"Show song's progress bar"} value={this.props.preferences.showSongProgressBar} onInputUpdate={this.props.onPreferenceUpdate} />
                    <Checkbox id={"showAnimations"} label={"Show animations"} value={this.props.preferences.showAnimations} onInputUpdate={this.props.onPreferenceUpdate} />
                    <Checkbox id={"enableAutoscroll"} label={"Autoscroll to active section"} value={this.props.preferences.enableAutoscroll} onInputUpdate={this.props.onPreferenceUpdate} />
                    <hr/>
                    <RadioGroup id={"styleChosen"} label={"Application theme:"} options={[
                        {label:"Light theme", value:"defaultLight"},
                        {label:"Dark theme", value:"defaultDark"}]}
                                value={this.props.preferences.styleChosen} onInputUpdate={this.props.onPreferenceUpdate} />
                </div>
            </div>
        );
    }

    getGameVersions = async () =>{
        let uri = 'https://chsplit.tornith.cz/gameVersions.json';
        let h = new Headers();
        h.append('Accept', 'application/json');
        let req = new Request(uri, {method: "POST", headers: h, mode: "cors"});

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
                        <button className={"update-button" + (this.props.newUpdate ? " new-version" : "")} onClick={this.props.newUpdate ? this.getNewVersion : this.checkUpdates} disabled={(this.state.checkedUpToDate || this.state.checkingUpToDate) ? (!this.props.newUpdate) : false}>
                            {(this.props.newUpdate ? "New version available!" : (this.state.checkedUpToDate ? "Up to date" : (this.state.checkingUpToDate ? "Checking" : "Check for updates")))}
                            {this.state.checkingUpToDate ? <object type="image/svg+xml" data={iconSpinner}>...</object> : ""}
                        </button>
                    </p>
                    <p>&copy; 2019 Tornith, All rights reserved.</p>
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
            console.log("Connection error: Couldn't check for updates " + e);
        });
    };

    getNewVersion = () =>{
        return false;
    };
}

async function getGameVersions(){
    let uri = 'https://chsplit.tornith.cz/game_versions.json';
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
        console.error(e);
        return false;
    });
};

export default Submenu;