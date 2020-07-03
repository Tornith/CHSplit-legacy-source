import React, {PureComponent} from 'react';
import iconCheck from '../svg/form-check.svg';
import iconRadio from '../svg/form-radio.svg';
import iconDropdown from '../svg/form-dropdown.svg';
import iconDownload from "../svg/icon-download.svg";

class FormComponent extends PureComponent{
    static defaultProps = {
        value: undefined,
        id: "invalidID",
        label: "Missing label",
        description: undefined,
        restartRequired: false
    };

    generateDescription = () => {
        if (this.props.description !== undefined){
            return(
                <div className={"options-help-wrapper"}>
                    <div className={"options-help-button"}>?</div>
                    <div className={"options-help-description"}>{this.props.description}</div>
                </div>
            );
        }
    };
}

export class Checkbox extends FormComponent {
    state = {
        changed: false
    };
    render() {
        return (
            <section className={"input-wrapper checkbox single horizontal" + (this.props.restartRequired ? " restart-required" : "") + (this.state.changed ? " changed" : "")}>
                <div className={"input-checkbox" + (this.props.value ? " selected" : "")} onClick={this.action}>
                    <img src={iconCheck} alt={this.props.value ? "Yes" : "No"} />
                </div>
                <label>
                    {this.props.label}
                    {this.generateDescription()}
                </label>
            </section>
        );
    }
    action = () => {
        this.props.onInputUpdate(this.props.id, !this.props.value);
        this.setState({changed: true});
    }
}

export class RadioGroup extends FormComponent {
    state = {
        changed: false
    };
    render() {
        return (
            <section className={"input-wrapper radio-group vertical" + (this.props.restartRequired ? " restart-required" : "") + (this.state.changed ? " changed" : "")}>
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
        this.setState({changed: true});
    };
}

class Radio extends PureComponent {
    render() {
        return (
            <section className={"input-wrapper radio inner horizontal"}>
                <div className={"input-radio" + (this.props.selected ? " selected" : "")} onClick={this.action}>
                    <img src={iconRadio} alt={this.props.selected ? "Yes" : "No"} />
                </div>
                <label>{this.props.label}</label>
            </section>
        );
    }

    action = () => {
        this.props.onSelected(this.props.value);
    }
}

export class ListGroup extends FormComponent {
    constructor(props){
        super(props);
        this.state = {
            opened: false,
            changed: false
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
        const selectedOption = this.findSelectedOption();
        return (
            <section className={"input-wrapper list-sync vertical" + (this.props.restartRequired ? " restart-required" : "") + (this.state.changed ? " changed" : "")}>
                <label>{this.props.label}</label>
                <section className="input-inner">
                    <div className="input-list-wrapper" ref={this.setWrapperRef}>
                        <div className={"input-list-selected" + (this.state.opened ? " opened" : "") + ((selectedOption === undefined) ? " red-highlight" : "")} onClick={() => {this.setState({opened: !this.state.opened})}}>
                            <div>{(selectedOption !== undefined) ? selectedOption.label : ""}</div>
                            <img src={iconDropdown} alt={"Show all"} />
                        </div>
                        {Array.isArray(this.props.options) ? <div className={"input-list-dropdown" + (this.state.opened ? " opened" : " collapsed")}>
                            {this.props.options.map((section, section_index) => {
                                return (
                                    <React.Fragment key={section_index}>
                                        {(this.props.options.length > 1) ? (<div className={"input-list-section-header"}>{section.header}</div>) : ""}
                                        {section.options.map((option, index) => {
                                            return <ListOption id={this.props.id + "_" + section_index + "_" + index}
                                                               key={this.props.id + "_" + section_index + "_" + index}
                                                               value={option.value} label={option.label}
                                                               onSelected={this.selectOption}
                                                               selected={this.props.value === option.value} />
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </div> : ""}
                    </div>
                </section>
            </section>
        );
    }

    selectOption = (val) => {
        this.props.onInputUpdate(this.props.id, val);
        this.setState({opened: false, changed: true});
    };

    findSelectedOption = () => {
        if (Array.isArray(this.props.options)) return this.props.options.map(section => section.options).flat().find(option => option.value === this.props.value);
        else return undefined;
    }
}

class ListOption extends PureComponent {
    render() {
        return (
            <div className={"input-list-option" + (this.props.selected ? " selected" : "") + (this.props.highlighted ? " highlighted" : "")} onClick={() => {this.props.onSelected(this.props.value)}}>
                <span>{this.props.label}</span>
                {this.props.highlighted && <img className={"icon"} src={iconDownload} alt={"Downloadable"} />}
            </div>
        );
    }
}

export class ListGroupAJAX extends ListGroup {
    constructor(props){
        super(props);
        this.state = {
            options: undefined,
            changed: false
        }
    }

    componentDidMount() {
        super.componentDidMount();
        this.props.getOptions().then((res) => {
            this.setState({options: res});
        });
    }

    render() {
        const selectedOption = this.findSelectedOption();
        return (
            <section className={"input-wrapper list-sync vertical" + (this.props.restartRequired ? " restart-required" : "") + (this.state.changed ? " changed" : "")}>
                <label>{this.props.label}</label>
                <section className="input-inner">
                    <div className="input-list-wrapper" ref={this.setWrapperRef}>
                        <div className={"input-list-selected" + (this.state.opened ? " opened" : "") + ((selectedOption === undefined) ? " red-highlight" : "")} onClick={() => {this.setState({opened: !this.state.opened})}}>
                            <div>{(selectedOption !== undefined) ? selectedOption.label : ""}</div>
                            <img src={iconDropdown} alt={"Show all"} />
                        </div>
                        {Array.isArray(this.state.options) ? <div className={"input-list-dropdown" + (this.state.opened ? " opened" : " collapsed")}>
                            {this.state.options.map((section, section_index) => {
                                return (
                                    <React.Fragment key={section_index}>
                                        {(this.state.options.length > 1) ? (<div className={"input-list-section-header"}>{section.header}</div>) : ""}
                                        {section.options.map((option, index) => {
                                            return <ListOption id={this.props.id + "_" + section_index + "_" + index}
                                                               key={this.props.id + "_" + section_index + "_" + index}
                                                               value={option.value} label={option.label}
                                                               onSelected={this.selectOption}
                                                               selected={this.props.value === option.value}
                                                               highlighted={!option.hasOwnProperty("local") || !option.local}/>
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </div> : ""}
                    </div>
                </section>
            </section>
        );
    }

    findSelectedOption = () => {
        if (Array.isArray(this.state.options)) return this.state.options.map(section => section.options).flat().find(option => option.value === this.props.value);
        else return undefined;
    }
}