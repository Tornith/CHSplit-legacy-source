import React, {Component} from 'react';
import appInfo from '../appinfo.json';
import iconSpinner from '../svg/icon-spinner.svg';

class Submenu extends Component {
    render() {
        return (
            <div className={"submenu-wrapper " + ((this.props.openedSubmenu == null) ? "" : "opened")}>
                <SubmenuOptions opened={this.props.openedSubmenu === "Options"}/>
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