import React, {Component} from 'react';

class Section extends Component {
    constructor(props){
        super(props);
        this.scrollRef = React.createRef()
    }

    render() {
        return (
            <div className={"section " + (this.props.active ? "active" : "")} id={"section-" + this.props.time}>
                <div className="section-name">{this.formatSection(this.props.name)}</div>
                <div className={"section-diff " + this.getDifferenceClass()}>
                    {this.getDifferenceScoreValue()}
                </div>
                <div className={"section-score " + ((this.hasScore() || this.props.active) ? "" : "pb-score")}>
                    {this.getTotalScoreValue()}
                </div>
            </div>
        );
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (!prevProps.active && this.props.active){
            this.props.onBecomeActive(this.props.time);
        }
    }

    hasScore = () => {
        return (this.props.score !== undefined)
    };

    getDifferenceClass = () => {
        const score = (this.props.active ? this.props.totalScore : this.props.score);
        const pb = (this.props.pb !== undefined ? this.props.pb : 0);
        return ((score - pb > 0) ? "positive" : (score - pb === 0) ? "zero" : "negative");
    };

    getDifferenceScoreValue = () => {
        if (this.hasScore()) return this.formatNumbers(this.props.score - (this.props.pb != null ? this.props.pb : 0), true);
        else {
            if (this.props.active) return this.formatNumbers(this.props.totalScore - (this.props.pb != null ? this.props.pb : 0), true);
            else return "";
        }
    };

    getTotalScoreValue = () => {
        if (this.hasScore()) return this.formatNumbers(this.props.score);
        else{
            if (this.props.active) return this.formatNumbers(this.props.totalScore);
            else{
                return (this.props.pb != null) ? this.formatNumbers(this.props.pb) : ""
            }
        }
    };

    formatSection(name){
        return name.replace(/_/g," ").replace(/\w\S*/g, function(txt){
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
    }

    formatNumbers(number, plus = false){
        if (number === undefined) return "";
        return ((plus && number >= 0) ? "+" : "") + number.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
    }
}

export default Section;