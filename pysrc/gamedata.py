from utils import log


class GameData(object):
    def __init__(self, logger=None):
        self.score = 0
        self.position = -1
        self.time = -1
        self.splits = {}
        self.activeSection = None
        self.logger = logger

    def __str__(self):
        return {"game": self.to_dict()}

    def to_dict(self):
        return {
            "score": self.score,
            "position": self.position,
            "time": self.time,
            "splits": self.splits,
            "activeSection": self.activeSection
        }

    def split(self, previous_section):
        if previous_section not in self.splits:
            log(self.logger, "info", "Split: {} with score {}".format(previous_section, self.score))
            self.splits[previous_section] = self.score

    def get_current_data(self, instance_manager, song):
        previous_section = self.activeSection
        err = "Unknown"
        try:
            err = "Score"
            self.score = instance_manager.get_value("score")
            err = "Position"
            self.position = instance_manager.get_value("position")
            err = "Time"
            self.time = instance_manager.get_value("time")
            err = "Active section"
            self.activeSection = song.get_section_from_time(self.position)
            if previous_section is not None and \
                    self.activeSection not in self.splits and \
                    previous_section != self.activeSection:
                self.split(previous_section)
            return True
        except WindowsError:
            log(self.logger, "error", "Couldn't retrieve game data: {}".format(err))
            return False
