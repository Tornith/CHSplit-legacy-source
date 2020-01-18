import React, {PureComponent} from 'react';
import iconCheck from '../svg/form-check.svg';
import iconRadio from '../svg/form-radio.svg';
import iconDropdown from '../svg/form-dropdown.svg';
import iconRefresh from "../svg/icon-refresh.svg";

class FormComponent extends PureComponent{
    static defaultProps = {
        value: undefined,
        id: "invalidID",
        label: "Missing label"
    };
}

export class Checkbox extends FormComponent {
    render() {
        return (
            <section className="input-wrapper checkbox single horizontal">
                <div className={"input-checkbox" + (this.props.value ? " selected" : "")} onClick={this.action}>
                    <img src={iconCheck} alt={this.props.value ? "Yes" : "No"} />
                </div>
                <label>{this.props.label}</label>
            </section>
        );
    }
    action = () => {
        this.props.onInputUpdate(this.props.id, !this.props.value);
    }
}

export class RadioGroup extends FormComponent {
    render() {
        return (
            <section className="input-wrapper radio-group vertical">
                <label>{this.props.label}</label>
                <section className="input-inner">
                    {this.props.options.map((option, index) => {
                        return <Radio key={this.props.id + "_" + index} id={this.props.id + "_" + index} value={option.value} label={option.label} onSelected={this.selectOption} selected={this.props.value === option.value} />
                    })}
                </section>
            </section>
        );
    }

    selectOption = (val) => {
        this.props.onInputUpdate(this.props.id, val);
    };
}

class Radio extends PureComponent {
    render() {
        return (
            <section className="input-wrapper radio inner horizontal">
                <div className={"input-radio" + (this.props.selected ? " selected" : "")} onClick={() => {this.props.onSelected(this.props.value)}}>
                    <img src={iconRadio} alt={this.props.selected ? "Yes" : "No"} />
                </div>
                <label>{this.props.label}</label>
            </section>
        );
    }
}

export class ListGroup extends FormComponent {
    constructor(props){
        super(props);
        this.state = {
            opened: false
        };
        this.setWrapperRef = this.setWrapperRef.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
    }

    componentDidMount() {
        document.addEventListener('mousedown', this.handleClickOutside);
    }

    componentWillUnmount() {
        document.removeEventListener('mousedown', this.handleClickOutside);
    }

    setWrapperRef(node) {
        this.wrapperRef = node;
    }

    handleClickOutside(event) {
        if (this.wrapperRef && !this.wrapperRef.contains(event.target)) {
            this.setState({opened: false});
        }
    }

    render() {
        return (
            <section className="input-wrapper list vertical">
                <label>{this.props.label}</label>
                <section ref={this.setWrapperRef} className="input-inner">
                    <div className="input-list-wrapper">
                        <div className={"input-list-selected" + (this.state.opened ? " opened" : "")} onClick={() => {this.setState({opened: !this.state.opened})}}>
                            <div>{this.props.options.find(option => option.value === this.props.value).label}</div>
                            <img src={iconDropdown} alt={"Show all"} />
                        </div>
                        <div className={"input-list-dropdown" + (this.state.opened ? " opened" : " hidden")}>
                            {this.props.options.map((option, index) => {
                                return <ListOption id={this.props.id + "_" + index} value={option.value} label={option.label} onSelected={this.selectOption} selected={this.props.value === option.value} />
                            })}
                        </div>
                    </div>
                </section>
            </section>
        );
    }

    selectOption = (val) => {
        this.props.onInputUpdate(this.props.id, val);
        this.setState({opened: false});
    };
}

class ListOption extends PureComponent {
    render() {
        return (
            <div className={"input-list-option" + (this.props.selected ? " selected" : "")} onClick={() => {this.props.onSelected(this.props.value)}}>
                {this.props.label}
            </div>
        );
    }
}

export class ListGroupAJAX extends ListGroup {
    constructor(props){
        super(props);
        this.state = {
            options: undefined
        }
    }

    componentDidMount() {
        super.componentDidMount();
        this.props.getOptions().then((res) => {
            this.setState({options: res});
        });
    }

    render() {
        return (
            <section className="input-wrapper list-sync vertical">
                <label>{this.props.label}</label>
                <section className="input-inner">
                    <div className="input-list-wrapper" ref={this.setWrapperRef}>
                        <div className={"input-list-selected" + (this.state.opened ? " opened" : "")} onClick={() => {this.setState({opened: !this.state.opened})}}>
                            <div>
                                {Array.isArray(this.state.options) ? (this.state.options.find(option => option.value === this.props.value).label) : ""}
                            </div>
                            <img src={iconDropdown} alt={"Show all"} />
                        </div>
                        {Array.isArray(this.state.options) ? <div className={"input-list-dropdown" + (this.state.opened ? " opened" : " hidden")}>
                            {this.state.options.map((option, index) => {
                                return <ListOption key={this.props.id + "_" + index} id={this.props.id + "_" + index} value={option.value} label={option.label} onSelected={this.selectOption} selected={this.props.value === option.value} />
                            })}
                        </div> : ""}
                    </div>
                    <button className={"input-list-refresh"}><img src={iconRefresh} alt="Refresh" /></button>
                </section>
            </section>
        );
    }
}