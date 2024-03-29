import React, {Component} from 'react';
import SongInfo from './songinfo'
import Sections from './sections'
import NotificationBar from "./notificationbar";

class Mainbar extends Component {
    render() {
        return (
            <main className={this.getOpened(this.props.sidebarOpened)} onClick={this.props.onSidebarDefocus}>
                <NotificationBar notifications={this.props.notifications}/>
                {(((this.props.renderState === "game" || this.props.renderState === "endscreen") && this.props.song != null && this.props.game != null)) &&
                    <React.Fragment>
                        <SongInfo song={this.props.song} game={this.props.game} sectionHolder={this.props.sectionHolder} preferences={this.props.preferences} gameState={this.props.renderState}/>
                        <Sections song={this.props.song} game={this.props.game} sectionHolder={this.props.sectionHolder} preferences={this.props.preferences} />
                    </React.Fragment>
                }
                {(this.props.renderState === "menu" || (this.props.renderState === "endscreen" && this.props.song == null )) &&
                    <div className="menu-msg">
                        <h2>Start playing a song!</h2> <p>CHSplit will automatically detect that you're playing a song and make the splits for you!</p>
                    </div>
                }
                {this.props.renderState === "init" &&
                    <div className="menu-msg">
                        <h2>Launch the game!</h2> <p>CHSplit will automatically detect that you've launched the game!</p>
                    </div>
                }
                {this.props.renderState === "practice" &&
                    <div className="menu-msg">
                        <h2>Uh oh!</h2> <p>CHSplit can't track your progress yet while you're in practice! Sorry...</p>
                    </div>
                }
            </main>
        );
    }

    getOpened(opened){
        return (opened) ? "sidebarOpened" : "";
    }
}

export default Mainbar;