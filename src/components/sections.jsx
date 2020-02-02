import React, {PureComponent} from 'react';
import Section from "./section";

const scrollToSection = (elem) => document.getElementById('panel-sections')
    .scrollTo(0, document.getElementById(elem).offsetTop - (document.getElementById('panel-sections').offsetHeight/2) + (document.getElementById(elem).offsetHeight/2));

class Sections extends PureComponent {
    constructor(props){
        super(props);
        this.handleScrollTo = this.handleScrollTo.bind(this);
    }
    render() {
        return (
            <div className={"panel-sections" + (this.props.preferences.lastSectionAnchored ? " last-anchored" : "")} id="panel-sections">
                { Array.from(this.props.sectionHolder, ([key, value]) => value).map(section => (
                    <Section key={section.time}
                             time={section.time}
                             name={section.name}
                             active={section.active}
                             score={section.sectionScore}
                             pb={section.pbScore}
                             totalScore={this.props.game.score}
                             onBecomeActive={this.handleScrollTo}
                             preferences={this.props.preferences}
                    />
                ))}
            </div>
        );
    }
    handleScrollTo = (sectionID) => {
        if (!(this.props.preferences.lastSectionAnchored && (this.props.song.sections[this.props.song.sections.length - 1][0] === sectionID))) {
            scrollToSection("section-" + sectionID);
        }
    }
}

export default Sections;