import React, {PureComponent} from 'react';
import iconMenu from '../svg/icon-menu.svg';
import iconOptions from '../svg/icon-options.svg';
import iconAbout from '../svg/icon-about.svg';
import iconImport from '../svg/icon-import.svg';
import iconExport from '../svg/icon-export.svg';
import iconList from '../svg/icon-list.svg';
import MenuItem from "./menuitem";
import appInfo from '../appinfo.json';

class Sidebar extends PureComponent {
    render() {
        return (
            <aside className={this.getOpened(this.props.opened)} onClick={this.props.onSubmenuDefocus}>
                <button onClick={this.props.onToggle} className="btn-open-menu"><object type="image/svg+xml" data={iconMenu}>Menu</object></button>
                <div className="sidebar-menu sidebar-menu-top">
                    <MenuItem menuLabel="Browse Splits" menuName="Splits" menuIcon={iconList} onSelected={this.props.onMenuSelect} openedSubmenu={this.props.openedSubmenu}/>
                    <MenuItem menuLabel="Import Splits" menuName="Import Splits" menuIcon={iconImport} onSelected={this.props.onMenuSelect} openedSubmenu={this.props.openedSubmenu}/>
                    <MenuItem menuLabel="Export Splits" menuName="Export Splits" menuIcon={iconExport} onSelected={this.props.onMenuSelect} openedSubmenu={this.props.openedSubmenu}/>
                </div>
                <div className="sidebar-menu sidebar-menu-bottom">
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