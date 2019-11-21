import pickle
from datetime import datetime
import utils
import os
from utils import log


class SplitFile(object):
    def __init__(self, song_name, speed, chart_hash, logger=None):
        self.name = song_name
        self.speed = speed
        self.hash = chart_hash
        self.splits = {}
        self.logger = logger
        self.load_file()

    def load_file(self):
        conv_name = "".join(x for x in self.name if x.isalnum())
        path = "../splits/" + conv_name + "_" + str(self.speed) + "." + self.hash[:8] + ".splits"
        if os.path.isfile(path):
            try:
                with open(path, 'rb') as split_file:
                    self.splits = pickle.load(split_file)
                    log(self.logger, "info", "Successfully loaded splits file at {}".format(path))
                    return True
            except EnvironmentError:
                log(self.logger, "error", "Couldn't load splits file at {}".format(path))
                return False
        else:
            return False

    def save_file(self):
        conv_name = "".join(x for x in self.name if x.isalnum())
        path = "../splits/" + conv_name + "_" + str(self.speed) + "." + self.hash[:8] + ".splits"
        try:
            with open(path, 'wb') as split_file:
                pickle.dump(self.splits, split_file)
                log(self.logger, "info", "Successfully saved splits file at {}".format(path))
                return True
        except EnvironmentError:
            log(self.logger, "error", "Couldn't save splits file at {}".format(path))
            return False

    def add_splits(self, splits, instrument, difficulty):
        final_score = splits[max(splits, key=splits.get)]
        song_run = (final_score, datetime.now(), splits)
        if (difficulty, instrument) not in self.splits:
            self.splits[(difficulty, instrument)] = [song_run]
        else:
            utils.reverse_insort(self.splits[(difficulty, instrument)], song_run)

    def get_personal_best(self, instrument, difficulty):
        if (difficulty, instrument) in self.splits:
            return self.splits[(difficulty, instrument)][0][2]
        else:
            return {}
