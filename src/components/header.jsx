import React, {Component} from 'react';
import iconClose from '../svg/window-close.svg';
import iconMaximize from '../svg/window-maximize.svg';
import iconMinimize from '../svg/window-minimize.svg';
const { remote } = window.require('electron');

class Header extends Component {
    render() {
        return (
            <header id="header">
                <div className="logo">CHSplit</div>
                <div className="window-buttons-wrapper">
                    <button onClick={() => {remote.getCurrentWindow().minimize()}} className="window-button minimize">
                        <object type="image/svg+xml" data={iconMinimize}>Minimize</object>
                    </button>
                    <button onClick={() => {remote.getCurrentWindow().isMaximized() ? remote.getCurrentWindow().unmaximize() : remote.getCurrentWindow().maximize()}} className="window-button maximize">
                        <object type="image/svg+xml" data={iconMaximize}>Maximize</object>
                    </button>
                    <button onClick={() => {remote.app.quit()}} className="window-button close">
                        <object type="image/svg+xml" data={iconClose}>Close</object>
                    </button>
                </div>
            </header>
        );
    }
}

export default Header;