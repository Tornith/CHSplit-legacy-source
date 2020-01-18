import React, {PureComponent} from 'react';
import iconMenu from '../svg/icon-menu.svg';
import iconOptions from '../svg/icon-options.svg';
import iconAbout from '../svg/icon-about.svg';
import MenuItem from "./menuitem";
import appInfo from '../appinfo.json';

class Sidebar extends PureComponent {
    render() {
        return (
            <aside className={this.getOpened(this.props.opened)}>
                <button onClick={this.props.onToggle} className="btn-open-menu"><object type="image/svg+xml" data={iconMenu}>Menu</object></button>
                <div className="sidebar-menu">
                    <MenuItem menuName="Options" menuIcon={iconOptions} onSelected={this.props.onMenuSelect} openedSubmenu={this.props.openedSubmenu}/>
                    <MenuItem menuName="About" menuIcon={iconAbout} onSelected={this.props.onMenuSelect} openedSubmenu={this.props.openedSubmenu}/>
                    <span className="version">{appInfo.name + " v" + appInfo.version}</span>
                </div>
            </aside>
        );
    }

    getOpened(opened){
        return (opened) ? "opened" : "";
    }
}

export default Sidebar;