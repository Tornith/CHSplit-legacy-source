import React, {Component} from 'react';
import Section from "./section";

const scrollToSection = (elem) => document.getElementById('panel-sections')
    .scrollTo(0, document.getElementById(elem).offsetTop - (document.getElementById('panel-sections').offsetHeight/2) + (document.getElementById(elem).offsetHeight/2));

class Sections extends Component {
    render() {
        return (
            <div className="panel-sections" id="panel-sections">
                { this.props.sections.map(section => (
                    <Section key={section.time}
                             name={section.name}
                             time={section.time}
                             active={section.active}
                             score={section.splitScore}
                             pb={section.pbScore}
                             totalScore={this.props.data.game.score}
                             onBecomeActive={this.handleScrollTo}
                    />
                ))}
            </div>
        );
    }

    handleScrollTo = (sectionID) => {
        scrollToSection("section-" + sectionID);
    }
}

export default Sections;