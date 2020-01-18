import React, {PureComponent} from 'react';
import iconCheck from '../svg/form-check.svg';
import iconRadio from '../svg/form-radio.svg';
import iconDropdown from '../svg/form-dropdown.svg';

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
            <seciton className="input-wrapper single horizontal">
                <div className={"input-checkbox" + (this.props.value ? " selected" : "")} onClick={this.action}>
                    <img src={iconCheck} alt={this.props.value ? "Yes" : "No"} />
                </div>
                <label>{this.props.label}</label>
            </seciton>
        );
    }
    action = () => {
        this.props.onInputUpdate(this.props.id, !this.props.value);
    }
}

export class RadioGroup extends FormComponent {
    render() {
        return (
            <seciton className="input-wrapper vertical">
                <label>{this.props.label}</label>
                <seciton className="input-inner">
                    {this.props.options.map((option, index) => {
                        return <Radio id={this.props.id + "_" + index} value={option.value} label={option.label} onSelected={this.selectOption} selected={this.props.value === option.value} />
                    })}
                </seciton>
            </seciton>
        );
    }

    selectOption = (val) => {
        this.props.onInputUpdate(this.props.id, val);
    };
}

class Radio extends PureComponent {
    render() {
        return (
            <seciton className="input-wrapper inner horizontal">
                <div className={"input-radio" + (this.props.selected ? " selected" : "")} onClick={() => {this.props.onSelected(this.props.value)}}>
                    <img src={iconRadio} alt={this.props.selected ? "Yes" : "No"} />
                </div>
                <label>{this.props.label}</label>
            </seciton>
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
            <seciton className="input-wrapper vertical">
                <label>{this.props.label}</label>
                <seciton ref={this.setWrapperRef} className="input-inner input-list-wrapper">
                    <div className={"input-list-selected" + (this.state.opened ? " opened" : "")} onClick={() => {this.setState({opened: !this.state.opened})}}>
                        <div>{this.props.options.find(option => option.value === this.props.value).label}</div>
                        <img src={iconDropdown} alt={"Show all"} />
                    </div>
                    <div className={"input-list-dropdown" + (this.state.opened ? " opened" : " hidden")}>
                        {this.props.options.map((option, index) => {
                            return <ListOption id={this.props.id + "_" + index} value={option.value} label={option.label} onSelected={this.selectOption} selected={this.props.value === option.value} />
                        })}
                    </div>
                </seciton>
            </seciton>
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