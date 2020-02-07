import mido
import mido.messages.checks
import re
import configparser
import requests
import os
from yaml import Loader, load


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
        if s != (len(string)-1):
            section_name += " "
    return int(string[0]), section_name[:-1].decode("utf-8", 'ignore')


def get_chart_sections(file_path):
    chart = open(file_path, "r")
    file_list = list(chart)
    cur_index = file_list.index("[Events]\n")
    section_arr = []
    while "}" not in file_list[cur_index]:
        if re.match('[ \s]*\d+ = E "section .+"', file_list[cur_index]):
            section_arr.append(get_section_info(file_list[cur_index]))
        cur_index += 1
    return section_arr


def get_midi_sections(file_path):
    mid = mido.MidiFile(file_path, clip=True)
    section_dict = []
    for i, track in enumerate(mid.tracks):
        if track.name == "EVENTS":
            time_sum = 0
            for msg in track:
                time_sum += msg.time
                if isinstance(msg, mido.midifiles.meta.MetaMessage) and msg.type == 'text' and "section" in msg.text:
                    section_name = msg.text.split("section ")[1].replace("]", "")
                    section_dict.append((time_sum, section_name))
    return section_dict


def get_song_ini(file_path):
    song_info = configparser.RawConfigParser()
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
    try:
        with open(name) as yaml_file:
            return load(yaml_file, Loader=Loader)
    except IOError:
        return None


def get_offset_file_ajax(version, path):
    url = 'https://raw.githubusercontent.com/Tornith/CHSplit/master/remote/offsets/offsets.{}.yml'.format(version)
    try:
        offset_data = requests.get(url, timeout=5)
    except requests.RequestException:
        return False
    if offset_data.status_code == 200:
        try:
            with open(path, 'wb') as f:
                f.write(offset_data.text)
                f.flush()
                return True
        except WindowsError:
            return False
    else:
        return False


def get_local_offset_file_list(path):
    file_list = os.listdir(path)
    output = []
    for f in file_list:
        if re.match('(offsets\.).+(\.yml)', f):
            yaml = load_yaml_file(path + "/" + f)
            if yaml is not None:
                output.append({'game_version': yaml['game_version'],
                               'game_label': yaml['game_label'],
                               'file_category': yaml['file_category']})
    return output


def reverse_insort(a, x, lo=0, hi=None):
    if lo < 0:
        raise ValueError('lo must be non-negative')
    if hi is None:
        hi = len(a)
    while lo < hi:
        mid = (lo+hi)//2
        if x > a[mid]:
            hi = mid
        else:
            lo = mid+1
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


def generate_default_cfg():
    with open("config.ini", 'w+') as config:
        config.write("[config]\ngame_version=23_2_2\ndebug_mode=true")
