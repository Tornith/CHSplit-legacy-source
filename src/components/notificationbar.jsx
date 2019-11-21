import React, {Component} from 'react';

class NotificationBar extends Component {
    render() {
        return (
            <div className="notification-bar">
                {this.props.notifications}
            </div>
        );
    }
}

export default NotificationBar;