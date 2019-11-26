import React, {Component} from 'react';
import SongInfo from './songinfo'
import Sections from './sections'
import NotificationBar from "./notificationbar";

class Mainbar extends Component {
    render() {
        return (
            <main className={this.getOpened(this.props.sidebarOpened)} onClick={this.props.onSidebarDefocus}>
                <NotificationBar notifications={this.props.notifications}/>
                {this.props.renderState === "game" &&
                    <React.Fragment>
                        <SongInfo data={this.props.data}/>
                        <Sections data={this.props.data} sections={this.props.sections}/>
                    </React.Fragment>
                }
                {this.props.renderState === "menu" &&
                    <div className="menu-msg">
                        <h2>Start playing a song!</h2> <p>CHSplit will automatically detect that you're playing a song and make the splits for you!</p>
                    </div>
                }
                {this.props.renderState === "endscreen" &&
                <React.Fragment>
                    <SongInfo data={this.props.data}/>
                    <Sections data={this.props.data} sections={this.props.sections}/>
                </React.Fragment>
                }
            </main>
        );
    }

    getOpened(opened){
        return (opened) ? "sidebarOpened" : "";
    }
}

export default Mainbar;