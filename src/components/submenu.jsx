import React, {Component} from 'react';
import appInfo from '../appinfo.json';
import iconSpinner from '../svg/icon-spinner.svg';
import { Checkbox, ListGroup, RadioGroup} from './formcomponents';

class Submenu extends Component {
    render() {
        return (
            <div className={"submenu-wrapper " + ((this.props.openedSubmenu == null) ? "" : "opened")}>
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
                    <ListGroup id={"selectedVersion"} label={"Game version:"} options={[
                        {label:"v23.2.2", value:"23_2_2"},
                        {label:"v23.1", value:"23_1"},
                        {label:"v22.4", value:"22_4"},
                        {label:"v22.3", value:"22_3"},
                        {label:"v22.2", value:"22_2"},
                        {label:"v22.1", value:"22_1"},
                        {label:"v21.7", value:"21_7"},
                        {label:"v21.6", value:"21_6"},
                        {label:"v21.5", value:"21_5"},
                        {label:"v21.4", value:"21_4"},
                        {label:"v21.3", value:"21_3"},
                        {label:"v21.2", value:"21_2"},
                        {label:"v21.1", value:"21_1"},
                        {label:"v20.0", value:"20"},
                        {label:"v19.0", value:"19"},
                        {label:"v18.0", value:"18"},
                        {label:"v17.0", value:"17"},
                        {label:"v16.0", value:"16"},
                        {label:"v15.0", value:"15"},
                        {label:"v14.0", value:"14"},
                        {label:"v13.0", value:"13"},
                        {label:"v12.0", value:"12"},
                        {label:"v11.0", value:"11"},
                        {label:"v10.0", value:"10"},
                        {label:"v9.0", value:"9"},
                        {label:"v8.0", value:"8"},
                        {label:"v7.0", value:"7"},
                        {label:"v6.0", value:"6"},
                        {label:"v5.0", value:"5"},
                        {label:"v4.0", value:"4"},
                        {label:"v3.0", value:"3"},
                        {label:"v2.0", value:"2"},
                        {label:"v1.0", value:"1_0"}]}
                                value={this.props.preferences.selectedVersion} onInputUpdate={this.props.onPreferenceUpdate} />
                    <hr/>
                    <Checkbox id={"alwaysOnTop"} label={"Always on top"} value={this.props.preferences.alwaysOnTop} onInputUpdate={this.props.onPreferenceUpdate} />
                    <Checkbox id={"showSingleSection"} label={"Show single section score"} value={this.props.preferences.showSingleSection} onInputUpdate={this.props.onPreferenceUpdate} />
                    <Checkbox id={"showActiveSectionDifference"} label={"Show active section difference"} value={this.props.preferences.showActiveSectionDifference} onInputUpdate={this.props.onPreferenceUpdate} />
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

export default Submenu;