import React, {PureComponent} from 'react';
import Section from "./section";

const scrollToSection = (elem) => document.getElementById('panel-sections')
    .scrollTo(0, document.getElementById(elem).offsetTop - (document.getElementById('panel-sections').offsetHeight/2) + (document.getElementById(elem).offsetHeight/2));

class Sections extends PureComponent {
    render() {
        return (
            <div className="panel-sections" id="panel-sections">
                { Array.from(this.props.sectionHolder, ([key, value]) => value).map(section => (
                    <Section key={section.time}
                             time={section.time}
                             name={section.name}
                             active={section.active}
                             score={section.sectionScore}
                             pb={section.pbScore}
                             totalScore={this.props.game.score}
                             onBecomeActive={this.handleScrollTo}
                    />
                ))}
            </div>
        );
    }

    handleScrollTo(sectionID){
        console.log(sectionID);
        scrollToSection("section-" + sectionID);
    }
}

export default Sections;