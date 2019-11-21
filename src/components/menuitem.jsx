import React, {Component} from 'react';

class MenuItem extends Component {
    render() {
        return (
            <button className={"btn-menu " + ((this.props.openedSubmenu === this.props.menuName) ? "selected" : "")} onClick={() => this.props.onSelected(this.props.menuName)}><object type="image/svg+xml" data={this.props.menuIcon}/>{this.props.menuName}</button>
        );
    }
}

export default MenuItem;