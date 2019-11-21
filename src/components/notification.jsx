import React, {Component} from 'react';
import notificationInfo from "../svg/notification-info.svg";
import notificationWarning from "../svg/notification-warning.svg";
import notificationError from "../svg/notification-error.svg";
import notificationUpdate from "../svg/notification-update.svg";
import notificationClose from "../svg/notification-close.svg";

class Notification extends Component {
    render() {
        return (
            <div className={"notification notif-" + this.props.type}>
                <object className="notif-icon" type="image/svg+xml" data={this.getNotificationIcon(this.props.type)}>{this.props.type}</object>
                <div onClick={this.props.action} className="notif-text">{this.props.text}</div>
                <div onClick={() => this.props.closeNotification(this.props.id)}>
                    <object className={"notif-close" + (!this.props.closeable ? " hidden" : "")} type="image/svg+xml" data={notificationClose}>Close</object>
                </div>
            </div>
        );
    }

    getNotificationIcon = (type) => {
        switch (type) {
            case "info": return notificationInfo;
            case "warning": return notificationWarning;
            case "error": return  notificationError;
            case "update": return notificationUpdate;
            default: return notificationInfo
        }
    }
}

export default Notification;