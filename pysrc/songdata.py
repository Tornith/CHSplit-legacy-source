import hashlib
import base64
import re
import utils
from utils import log


class SongData(object):
    def __init__(self, song_info, logger=None):
        self.name = song_info["name"]
        self.artist = song_info["artist"]
        self.length = song_info["length"]
        self.chart_path = song_info["chart_path"]
        self.speed = song_info["speed"]
        self.instrument = song_info["instrument"]
        self.difficulty = song_info["difficulty"]
        self.modifiers = song_info["modifiers"]
        self.logger = logger
        self.sections = self.get_sections()

    def __str__(self):
        return {"song": self.to_dict()}

    def to_dict(self):
        return {
            "name": self.name,
            "artist": self.artist,
            "length": self.length,
            "sections": self.sections,
            "chart_path": self.chart_path,
            "speed": self.speed,
            "instrument": self.instrument,
            "difficulty": self.difficulty,
            "modifiers": self.modifiers
        }

    def get_sections(self):
        if re.match('.+\.chart', self.chart_path):
            sections = utils.get_chart_sections(self.chart_path)
        elif re.match('.+\.mid$', self.chart_path):
            sections = utils.get_midi_sections(self.chart_path)
        else:
            log(self.logger, "error", "Couldn't load chart file at {}".format(self.chart_path))
            return None
        if not sections:
            log(self.logger, "warning",
                "No sections found in chart file. This beat's the point of the program pepeHands")
            sections = [(0, "Song")]
        return sections

    def get_section_from_time(self, time):
        cur_section = self.sections[0] if (len(self.sections) > 0) else None
        for section in self.sections:
            if time >= section[0]:
                cur_section = section
            else:
                return cur_section[0]
        return cur_section[0] if (len(self.sections) > 0) else None

    def get_song_id(self):
        conv_name = "".join(x for x in self.name if x.isalnum())
        return "{}_{}".format(conv_name, self.get_song_hash()[:8])

    def get_song_hash(self):
        hash_md5 = hashlib.md5()
        with open(self.chart_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return base64.b64encode(hash_md5.hexdigest(), "_-")
