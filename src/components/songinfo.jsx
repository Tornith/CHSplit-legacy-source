import React, {PureComponent} from 'react';

class SongInfo extends PureComponent {
    render() {
        return (
            <React.Fragment>
                <div className={"panel-song" + (this.props.preferences.hideTotalScore ? " small" : "")} id="panel-song">
                    <div className="panel-info">
                        <span className="song-name">{this.props.song.name + this.formatSpeed(this.props.song.speed) + this.formatDifficulty(this.props.song.difficulty) + this.formatInstrument(this.props.song.instrument) + this.formatModifiersString(this.props.song.modifiers)}</span>
                        <div className={"spt" + (this.props.preferences.hideTotalScore ? " hidden" : "")} />
                    </div>
                    <div className={"panel-score" + (this.props.preferences.hideTotalScore ? " hidden" : "")}>
                        <span className="total-score">{this.formatNumbers(this.props.game.score)}</span>
                        {this.props.sectionHolder.get(this.props.game.activeSection) !== undefined && this.props.sectionHolder.get(this.props.game.activeSection).pbScore !== null && <span className={"total-score-difference " + ((this.getLastSectionDifference() >= 0) ? "positive" : "negative")}>{
                            this.formatNumbers(this.getLastSectionDifference(), true)
                        }</span>}
                    </div>
                </div>
                <div className={"panel-progress" + (this.props.preferences.showSongProgressBar ? "" : " hidden")} id="panel-progress">
                    <span className="song-time">{this.formatTime(Math.min(this.props.game.time, this.props.song.length)) + " / " + this.formatTime(this.props.song.length)}</span>
                    <div className="song-progress-bar-wrapper">
                        <div className="song-progress-bar" style={{width: (100 * (this.props.game.time > 0 ? this.props.game.time : 0) / this.props.song.length) + "%"}}>
                            <div className="stripes"/>
                        </div>
                    </div>
                </div>
            </React.Fragment>
        );
    }

    getLastSectionDifference = () => {
        const optShowActDiff = this.props.preferences.showActiveSectionDifference;
        if (optShowActDiff)
            return this.props.game.score - (this.props.sectionHolder.get(this.props.game.activeSection).pbScore);
        else {
            const sectionHolderKeys = Array.from(this.props.sectionHolder.keys());
            const activeSectionIndex = sectionHolderKeys.indexOf(this.props.game.activeSection);
            if (activeSectionIndex > 0){
                const prevSection = this.props.sectionHolder.get(sectionHolderKeys[activeSectionIndex - 1]);
                return prevSection.sectionScore - (prevSection.pbScore !== undefined ? prevSection.pbScore : 0);
            }
            else{
                return undefined;
            }
        }
    };

    formatNumbers(number, plus = false){
        if(number === undefined) return "\xa0";
        return ((plus && number >= 0) ? "+" : "") + number.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
    }

    formatTime(number){
        if (number < 0) number = 0;
        let pad = function(num, size) { return ('000' + num).slice(size * -1); },
            time = parseFloat(number).toFixed(3),
            hours = Math.floor(time / 60 / 60),
            minutes = Math.floor(time / 60) % 60,
            seconds = Math.floor(time - minutes * 60);

        let hoursStr = ((hours !== 0) ? (pad(hours, Math.floor(Math.log10(hours) + 1)) + ':') : "");
        let minutesStr = ((time / 60 >= 10) ? pad(minutes, 2) : pad(minutes, 1)) + ':';
        let secondsStr = pad(seconds, 2);

        return  hoursStr + minutesStr + secondsStr;
    }

    formatSpeed = (speed) => (speed !== 100) ? (" (" + speed + "%)") : "";

    formatInstrument(instrument){
        let outputStr = "";
        switch (instrument) {
            case 0x01: outputStr += "Bass Guitar"; break;
            case 0x02: outputStr += "Rhythm Guitar"; break;
            case 0x03: outputStr += "Guitar Coop"; break;
            case 0x04: outputStr += "6 Fret Guitar"; break;
            case 0x05: outputStr += "6 Fret Bass"; break;
            case 0x07: outputStr += "Keys"; break;
            default: break;
        }
        if (outputStr !== "") return " (" + outputStr + ")";
        else return "";
    }

    formatDifficulty(difficulty){
        let outputStr = "";
        switch (difficulty) {
            case 0x00: outputStr += "Easy"; break;
            case 0x01: outputStr += "Medium"; break;
            case 0x02: outputStr += "Hard"; break;
            default: break;
        }
        if (outputStr !== "") return " (" + outputStr + ")";
        else return "";
    }

    formatModifiersString(modifiers){
        let activeModifiers = [];
        if ((modifiers & 0x2) !== 0) activeModifiers.push("All Strums");
        if ((modifiers & 0x4) !== 0) activeModifiers.push("All HOPOs");
        if ((modifiers & 0x8) !== 0) activeModifiers.push("All Taps");
        if ((modifiers & 0x10) !== 0) activeModifiers.push("All Opens");
        if ((modifiers & 0x20) !== 0) activeModifiers.push("Mirror Mode");
        if ((modifiers & 0x40) !== 0) activeModifiers.push("Note Shuffle");
        if ((modifiers & 0x80) !== 0) activeModifiers.push("HOPOs to Taps");
        if ((modifiers & 0x100) !== 0) activeModifiers.push("Lights Out");
        if ((modifiers & 0x200) !== 0) activeModifiers.push("ModChart Full");
        if ((modifiers & 0x400) !== 0) activeModifiers.push("ModChart Lite");
        if ((modifiers & 0x800) !== 0) activeModifiers.push("ModChart Prep");
        let outputStr = "";
        activeModifiers.forEach((modifier, index) => {
            outputStr += ((index > 0) ? ((index === activeModifiers.length - 1) ? " & " : ", ") : "") + modifier;
        });
        if (outputStr !== "") return " (" + outputStr + ")";
        else return "";
    }
}

export default SongInfo;