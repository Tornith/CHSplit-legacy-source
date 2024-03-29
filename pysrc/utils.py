import os
import re

import configparser
import mido
import mido.messages.checks
import requests
from hashlib import sha256, sha384
from pickle import dumps
from packaging.version import parse as parse_version
from yaml import safe_load, YAMLError


# Sorry but there's no other way... Some original GH songs have corrupted MIDIs?
def check_data_byte_patch(value):
    if not isinstance(value, mido.messages.checks.Integral):
        raise TypeError('data byte must be int')
    elif not 0 <= value <= 127:
        print ValueError('data byte must be in range 0..127')


mido.messages.checks.check_data_byte = check_data_byte_patch


def get_section_info(string):
    string = string.split()
    section_name = ""
    for s in range(4, len(string)):
        section_name += string[s]
        if s != (len(string) - 1):
            section_name += " "
    return int(string[0]), section_name[:-1].decode("utf-8", 'ignore')


def get_chart_sections(file_path):
    chart = open(file_path, "r")
    file_list = list(chart)
    cur_index = file_list.index("[Events]\n")
    section_arr = []
    while "}" not in file_list[cur_index]:
        if re.match('[ \\s]*\\d+ = E "section .+"', file_list[cur_index]):
            section_arr.append(get_section_info(file_list[cur_index]))
        cur_index += 1
    return section_arr


def get_midi_sections(file_path):
    # dump_midi_info(file_path)
    mid = mido.MidiFile(file_path, clip=True)
    section_dict = []
    for i, track in enumerate(mid.tracks):
        if track.name == "EVENTS":
            time_sum = 0
            for msg in track:
                time_sum += msg.time
                if isinstance(msg, mido.midifiles.meta.MetaMessage) and msg.type == 'text':
                    if "section" in msg.text:
                        section_name = msg.text.split("section ")[1].replace("]", "")
                        section_dict.append((time_sum, section_name))
                    elif "prc_" in msg.text:
                        section_name = msg.text.split("prc_")[1].replace("]", "")
                        section_dict.append((time_sum, section_name))
    return section_dict


def dump_midi_info(file_path):
    mid = mido.MidiFile(file_path, clip=True)
    for i, track in enumerate(mid.tracks):
        if track.name == "EVENTS":
            time_sum = 0
            for msg in track:
                time_sum += msg.time
                if isinstance(msg, mido.midifiles.meta.MetaMessage) and msg.type == 'text':
                    print msg.text


def get_song_ini(file_path):
    song_info = configparser.RawConfigParser(strict=False)
    try:
        song_info.read(file_path + "/song.ini", encoding='utf-8')
    except configparser.MissingSectionHeaderError:
        try:
            song_info.read(file_path + "/song.ini", encoding='utf-8-sig')
        except configparser.MissingSectionHeaderError:
            return None
    song_info = {k.lower(): v for k, v in song_info.items()}
    return song_info if song_info else None


def load_ini_file(name):
    config = configparser.ConfigParser()
    config.read(name)
    return config if config.sections() else None


def load_yaml_file(name):
    if not os.path.exists(name):
        return None
    try:
        with open(name) as yaml_file:
            return safe_load(yaml_file)
    except (IOError, YAMLError):
        return None


def get_offset_file_ajax(game_version, path, current_offset_version):
    url = 'https://raw.githubusercontent.com/Tornith/CHSplit/master/remote/offsets/offsets.{}.yml'.format(game_version)
    try:
        offset_data = requests.get(url, timeout=5)
    except requests.RequestException:
        return False
    if offset_data.status_code == 200:
        try:
            yml = safe_load(offset_data.text)
        except YAMLError:
            return False
        if yml["file_version"] > current_offset_version:
            try:
                with open(path, 'wb') as f:
                    f.write(offset_data.text)
                    f.flush()
                    return True
            except WindowsError:
                return False
        else:
            return False
    else:
        return False


def get_local_offset_file_list(path):
    file_list = os.listdir(path)
    output = []
    for f in file_list:
        if re.match('(offsets\\.).+(\\.yml)', f):
            yaml = load_yaml_file(path + "/" + f)
            if yaml is not None:
                output.append({'game_version': yaml['game_version'],
                               'game_label': yaml['game_label'],
                               'file_category': yaml['file_category'],
                               'min_version': yaml['min_version'] if 'min_version' in yaml else "-1.0",
                               'max_version': yaml['max_version'] if 'max_version' in yaml else "9999.0"})
    return output


def reverse_insort(a, x, lo=0, hi=None):
    if lo < 0:
        raise ValueError('lo must be non-negative')
    if hi is None:
        hi = len(a)
    while lo < hi:
        mid = (lo + hi) // 2
        if x > a[mid]:
            hi = mid
        else:
            lo = mid + 1
    a.insert(lo, x)


def log(logger, level, msg):
    if logger is not None:
        if level == 'debug':
            logger.debug(msg)
        elif level == 'info':
            logger.info(msg)
        elif level == 'warning':
            logger.warning(msg)
        elif level == 'error':
            logger.error(msg)
        elif level == 'critical':
            logger.critical(msg)
        else:
            logger.debug("I messed up something lmao -- {}".format(msg))


def compare_versions(str1, str2, ignore_dev=False):
    if ignore_dev:
        str1 = str1.split('-')[0]
        str2 = str2.split('-')[0]
    if parse_version(str1) == parse_version(str2):
        return 0
    elif parse_version(str1) > parse_version(str2):
        return 1
    else:
        return -1


def generate_run_integrity_hash(run_info, splits, chsplit_ver, db_ver):
    song_info_hash = sha256(b"{}{}{}{}{}"
                            .format(run_info[0], run_info[1], run_info[2], run_info[3], run_info[4])).hexdigest()
    song_integrity = sha256(b"{}: song-info=({}, {}, {}, {}); checksum={}"
                            .format(run_info[0], run_info[1], run_info[2], run_info[3], run_info[4],
                                    song_info_hash)).hexdigest()

    splits_dump = dumps(splits)
    splits_hash = sha256(splits_dump).hexdigest()
    run_info_hash = sha256(b"{}{}{}{}{}{}"
                           .format(run_info[5], run_info[6], run_info[7], run_info[8], run_info[9],
                                   splits_hash)).hexdigest()
    run_integrity = sha256(b"{}: run-info=({}, {}, {}, {}, {}); splits={}; checksum={}"
                           .format(run_info[0], run_info[5], run_info[6], run_info[7], run_info[8], run_info[9],
                                   splits_dump, run_info_hash)).hexdigest()

    return sha384(
        song_info_hash + song_integrity + splits_hash + run_info_hash + run_integrity + str(chsplit_ver) + str(db_ver))\
        .hexdigest().decode("hex").encode("base64").replace('\n', '')


def generate_songlist_integrity_hash(songlist):
    songlist_hash = sha384()
    for song, runs in songlist.items():
        songlist_hash.update(song)
        for run in runs:
            songlist_hash.update(run["IHash"])
    return songlist_hash.hexdigest().decode("hex").encode("base64").replace('\n', '')
