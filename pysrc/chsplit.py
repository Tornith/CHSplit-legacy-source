import sys
import threading
from flask import Flask, jsonify
from flask_cors import cross_origin
from flask_socketio import SocketIO
# from cheroot.wsgi import Server as WSGIServer, PathInfoDispatcher
from finitestatemachine import FSMWithMemory, State
from instancemanager import InstanceManager
from songdata import SongData
from gamedata import GameData
from splitfile import SplitFile
import utils
import os
import time
import logging
import re
import traceback
import json
import random


# Script args =============================

def parse_port():
    port = 58989
    try:
        if len(sys.argv) > 1:
            port = int(sys.argv[1])
    except ValueError as e:
        log_main.error("Invalid port number: {}".format(sys.argv[1]))
    return port


def exec_path():
    path = "."
    try:
        if len(sys.argv) > 2:
            path = sys.argv[2]
    except ValueError as e:
        log_main.error("Invalid directory name: {}".format(sys.argv[2]))
    return path


# Logging =================================

log_main = logging.getLogger(__name__)
log_main.setLevel(logging.INFO)

formatter = logging.Formatter('%(asctime)s  %(levelname)-8s %(message)s', '%Y-%m-%d %H:%M:%S')

# Create 'logs' folder if it doesn't exist
if not os.path.isdir(exec_path() + '/logs'):
    os.makedirs(exec_path() + '/logs')

# Backup old log files
if os.path.isfile(exec_path() + '/logs/oldest.log'):
    os.remove(exec_path() + '/logs/oldest.log')
if os.path.isfile(exec_path() + '/logs/older.log'):
    os.rename(exec_path() + '/logs/older.log', exec_path() + '/logs/oldest.log')
if os.path.isfile(exec_path() + '/logs/old.log'):
    os.rename(exec_path() + '/logs/old.log', exec_path() + '/logs/older.log')
if os.path.isfile(exec_path() + '/logs/latest.log'):
    os.rename(exec_path() + '/logs/latest.log', exec_path() + '/logs/old.log')

file_handler = logging.FileHandler(exec_path() + '/logs/latest.log')
file_handler.setFormatter(formatter)

log_main.addHandler(file_handler)


# Flask ==================================

app = Flask(__name__)
sio = SocketIO(app, cors_allowed_origins="*")
log_flask = logging.getLogger('werkzeug')
log_flask.disabled = True


def send_data(data, name, event_name):
    if name is None:
        message = data
    elif not isinstance(data, list) and not isinstance(name, list):
        message = {name: data}
    elif isinstance(data, list) and isinstance(name, list):
        message = dict(zip(name, data))
    else:
        log_main.error("Invalid data send message: data={}, names={}".format(data, name))
        return False
    sio.emit(event_name, json.dumps(message), json=True)
    return True


def send_single(data, event_name, jsonify=False):
    if jsonify:
        data = json.dumps(data)
    sio.emit(event_name, data, json=jsonify)


@sio.on('connect')
def handle_handshake():
    log_main.info("SocketIO connection established")


@sio.on('REQUEST_DATA')
def request_data(data_id):
    log_main.info("Manual data request: {}".format(data_id))
    if data_id == "state":
        log_main.debug("state: {}".format(fsm_main.current_state.name))
        send_data(fsm_main.current_state.name, "state", "REQUEST_RESPONSE_STATE")
    elif data_id == "song":
        song_data = fsm_main.memory["song_data"].to_dict()
        pb_data = fsm_main.memory["split_file"].get_personal_best(song_data["instrument"], song_data["difficulty"])
        log_main.debug("song: {}".format(song_data))
        log_main.debug("pb: {}".format(pb_data))
        send_data([song_data, pb_data], ["song", "pb"], "REQUEST_RESPONSE_SONG")
    elif data_id == "game":
        game_data = fsm_main.memory["game_data"].to_dict()
        log_main.debug("game: {}".format(game_data))
        send_data(game_data, "game", "REQUEST_RESPONSE_GAME")


@sio.on('SHUTDOWN')
def shutdown_server():
    sio.stop()
    thread_fsm.do_run = False
    thread_fsm.join()
    sys.exit(0)


@app.errorhandler(Exception)
@cross_origin()
def all_exception_handler(error):
    log_main.error("Flask exception: {}".format(traceback.format_exc()))
    response = json.dumps({})
    return response, 500


# States ==================================
# State: Init =============================

def init_entry(memory, previous_state):
    if not os.path.isdir(exec_path() + '/splits'):
        os.makedirs(exec_path() + '/splits')
        log_main.info("Created splits folder")
    offsets = utils.load_ini_file(exec_path() + '/offsets.' + memory["config"]["config"]["game_version"] + '.ini')
    if offsets is None:
        log_main.critical("Offset file not found")
        raise Exception("Offset file not found")
    memory["offsets"] = offsets
    memory["instance_manager"] = InstanceManager(memory["offsets"], logger=log_main)


def init_do(memory):
    result = memory["instance_manager"].attach()
    if not result:
        time.sleep(0.5)
    return result


def init_exit(memory, next_state):
    if not memory["instance_manager"].load_addresses(True):
        log_main.error("Couldn't retrieve base addresses, try selecting the appropriate game version")
        raise Exception("Couldn't retrieve base addresses")


state_init = State("init", on_entry=init_entry, on_exit=init_exit, do=init_do)


# State: Menu =============================

def menu_do(memory):
    in_menu = memory["instance_manager"].get_value("in_menu", True) != 0
    in_game = memory["instance_manager"].get_value("in_game", True) != 0
    in_practice = memory["instance_manager"].get_value("in_practice", True) != 0
    return in_menu, in_game, in_practice


state_menu = State("menu", do=menu_do)


# State: Pre-game =========================

def pregame_do(memory):
    if not memory["instance_manager"].load_addresses():
        return False
    song_ini = utils.get_song_ini(memory["instance_manager"].get_value("path"))
    if song_ini is None:
        log_main.error("Couldn't retrieve song ini")
        raise Exception("Couldn't retrieve song ini")
    song_info = {}
    try:
        song_info["name"] = song_ini["song"]["name"]
        song_info["length"] = memory["instance_manager"].get_value("length")
        path = memory["instance_manager"].get_value("path")
        if os.path.exists(path + "/notes.chart"):
            path = path + "/notes.chart"
        elif os.path.exists(path + "/notes.mid"):
            path = path + "/notes.mid"
        else:
            log_main.error("Couldn't retrieve notes file")
            raise Exception("Couldn't retrieve notes file")
        song_info["chart_path"] = path
        song_info["speed"] = memory["instance_manager"].get_value("speed")
        song_info["instrument"] = memory["instance_manager"].get_value("instrument")
        song_info["difficulty"] = memory["instance_manager"].get_value("difficulty")
        song_info["modifiers"] = memory["instance_manager"].get_value("modifiers")
    except WindowsError:
        log_main.error("Couldn't retrieve song info")
        return False
    log_main.info("Song info: {}".format(song_info))
    memory["song_data"] = SongData(song_info, logger=log_main)
    memory["game_data"] = GameData(logger=log_main)
    memory["split_file"] = \
        SplitFile(song_info["name"], song_info["speed"], memory["song_data"].get_song_hash(),
                  exec_path=exec_path(), logger=log_main)
    log_main.info("Chart hash: {}".format(memory["song_data"].get_song_hash()))
    log_main.info("Chart sections: {}".format(memory["song_data"].to_dict()["sections"]))
    log_main.debug("Loaded splits: {}".format(memory["split_file"].splits))
    return True


def pregame_exit(memory, next_state):
    song_data = memory["song_data"].to_dict()
    pb_data = memory["split_file"].get_personal_best(song_data["instrument"], song_data["difficulty"])
    send_data([song_data, pb_data], ["song", "pb"], "TRANSFER_SONG_DATA")


state_pregame = State("pregame", do=pregame_do, on_exit=pregame_exit)


# State: Game =============================

def game_entry(memory, previous_state):
    memory["prev_game_data"] = {
        "score": -1,
        "time": -1,
        "splits_len": -1,
        "active_section": None
    }


def game_do(memory):
    # new_addr = memory["instance_manager"].get_address("position")
    # addresses_unchanged = memory["instance_manager"].addresses["position"] == new_addr
    try:
        memory["game_data"].get_current_data(memory["instance_manager"], memory["song_data"])
        # if memory["previous_score"] != memory["game_data"].score or previous_splits_length != len(memory["game_data"].splits):
        #     game_data = memory["game_data"].to_dict()
        #     send_data(game_data, "game", "TRANSFER_GAME_DATA")
    except WindowsError:
        log_main.error("Unexpected pointer change")

    send_game_changes(memory["prev_game_data"], memory["game_data"])

    in_menu = memory["instance_manager"].get_value("in_menu", True) == 1
    in_game = memory["instance_manager"].get_value("in_game", True) == 1
    in_practice = memory["instance_manager"].get_value("in_practice", True) == 1

    if memory["prev_game_data"]["time"] > memory["game_data"].time and memory["game_data"].time < 0:
        game_restart(memory)
        sio.emit("GAME_EVENT", "restart")
    memory["prev_game_data"]["time"] = memory["game_data"].time
    memory["prev_game_data"]["score"] = memory["game_data"].score
    memory["prev_game_data"]["splits_len"] = len(memory["game_data"].splits)
    memory["prev_game_data"]["active_section"] = memory["game_data"].activeSection
    return in_menu, in_game, in_practice


def game_exit(memory, next_state):
    if next_state != state_endscreen:
        if "song_data" in memory:
            log_main.info("Clearing song data...")
            del memory["song_data"]
        if "game_data" in memory:
            log_main.info("Clearing game data...")
            del memory["game_data"]
        if "split_file" in memory:
            log_main.info("Clearing split file data...")
            del memory["split_file"]


def game_restart(memory):
    log_main.info("Game restart")
    if "game_data" in memory:
        log_main.info("Clearing game data...")
        memory["game_data"] = GameData(logger=log_main)


def send_game_changes(prev, cur):
    if prev["score"] != cur.score:
        send_single(cur.score, "TRANSFER_GAME_DATA[score]")
    if int(prev["time"]) < int(cur.time):
        send_single(cur.time, "TRANSFER_GAME_DATA[time]")
    if prev["active_section"] is not None and prev["splits_len"] < len(cur.splits):
        send_single("{}:{}".format(prev["active_section"], cur.splits[prev["active_section"]]), "TRANSFER_GAME_DATA[newSplit]")
    if prev["active_section"] is not None and prev["active_section"] < cur.activeSection:
        send_single(cur.activeSection, "TRANSFER_GAME_DATA[activeSection]")


state_game = State("game", do=game_do, on_entry=game_entry, on_exit=game_exit)


# State: End screen =======================

def ends_entry(memory, previous_state):
    memory["game_data"].split(memory["song_data"].sections[-1][0])
    splits = memory["game_data"].splits
    instrument = memory["song_data"].instrument
    difficulty = memory["song_data"].difficulty
    memory["split_file"].add_splits(splits, instrument, difficulty)
    status = memory["split_file"].save_file()
    if not status:
        log_main.error("Couldn't save split file")
        raise Exception("Couldn't save split file")


def ends_do(memory):
    in_menu = memory["instance_manager"].get_value("in_menu", True) != 0
    in_game = memory["instance_manager"].get_value("in_game", True) != 0
    in_practice = memory["instance_manager"].get_value("in_practice", True) != 0
    return in_menu, in_game, in_practice


def ends_exit(memory, next_state):
    if "song_data" in memory:
        log_main.info("Clearing song data...")
        del memory["song_data"]
    if "game_data" in memory:
        log_main.info("Clearing game data...")
        del memory["game_data"]
    if "split_file" in memory:
        log_main.info("Clearing split file data...")
        del memory["split_file"]


state_endscreen = State("endscreen", on_entry=ends_entry, do=ends_do, on_exit=ends_exit)


# State: Practice =========================

def practice_do(memory):
    in_menu = memory["instance_manager"].get_value("in_menu", True) != 0
    in_game = memory["instance_manager"].get_value("in_game", True) != 0
    in_practice = memory["instance_manager"].get_value("in_practice", True) != 0
    return in_menu, in_game, in_practice


state_practice = State("practice", do=practice_do)


# On Every Exit ===========================

def send_state_message(memory, next_state):
    send_single(next_state.name, "TRANSFER_STATE_DATA")


# Transitions =============================
# Loopbacks happen automatically if no matching transition state is found

transitions = {(state_init, True): state_menu,
               (state_menu, (False, True, False)): state_pregame,
               (state_menu, (False, True, True)): state_practice,
               (state_pregame, True): state_game,
               (state_game, (False, False, False)): state_endscreen,
               (state_game, (True, False, False)): state_menu,
               (state_game, (False, True, True)): state_practice,
               (state_endscreen, (True, False, False)): state_menu,
               (state_endscreen, (False, True, False)): state_pregame,
               (state_endscreen, (False, True, True)): state_practice,
               (state_practice, (False, True, False)): state_pregame,
               (state_practice, (True, False, False)): state_menu,
               (state_practice, (True, False, True)): state_menu}


# Loop ====================================


def main_loop(fsm):
    try:
        log_main.info("Main loop started")
        thread = threading.currentThread()
        forced_exit = False
        while getattr(thread, "do_run", True) and not forced_exit:
            forced_exit = fsm.tick()
            time.sleep(0.1)
    except Exception as e:
        log_main.critical(e, exc_info=True)


# Main ====================================


if __name__ == '__main__':
    # Load config file
    config = utils.load_ini_file(exec_path() + '/config.ini')
    if config is None:
        log_main.warning("No config file found, generating default config file.")
        utils.generate_default_cfg()
        config = utils.load_ini_file(exec_path() + '/config.ini')
    log_main.info("Config file loaded")
    if not re.match('\d+(_\d+)*', config["config"]["game_version"]):
        log_main.critical("Invalid config value of game_version")
        raise ValueError("Invalid config value of game_version")
    debug_mode = config["config"]["debug_mode"] == "true"
    if debug_mode:
        log_main.setLevel(logging.DEBUG)
        log_main.addHandler(logging.StreamHandler(sys.stdout))
        # log_flask.disabled = False
        log_main.info("DEBUG MODE: true")
    else:
        log_main.info("DEBUG MODE: false")

    fsm_main = FSMWithMemory(state_init, transitions, memory={"config": config}, logger=log_main,
                             on_every_exit=send_state_message)
    thread_fsm = threading.Thread(target=main_loop, args=(fsm_main,))
    thread_fsm.start()

    listening_port = parse_port()
    sio.run(app, port=listening_port)
    '''dispatcher = PathInfoDispatcher({'/': sio})
    server = WSGIServer(('127.0.0.1', listening_port), dispatcher)
    server.start()'''

