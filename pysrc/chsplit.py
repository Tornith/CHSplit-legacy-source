import sys
import threading
from flask import Flask, jsonify
from cheroot.wsgi import Server as WSGIServer, PathInfoDispatcher
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
log_flask = logging.getLogger('werkzeug')
log_flask.disabled = True


@app.route('/api/song')
def get_song_info():
    # log_main.debug("Call to fetch song info")
    if "song_data" in fsm_main.memory:
        response = fsm_main.memory["song_data"].to_dict()
    else:
        response = {}
    response = jsonify(response)
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response


@app.route('/api/pb')
def get_pb_info():
    # log_main.debug("Call to fetch split file info")
    if "split_file" in fsm_main.memory:
        instrument = fsm_main.memory["song_data"].instrument
        difficulty = fsm_main.memory["song_data"].difficulty
        response = fsm_main.memory["split_file"].get_personal_best(instrument, difficulty)
    else:
        response = {}
    response = jsonify(response)
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response


@app.route('/api/game')
def get_game_info():
    # log_main.debug("Call to fetch game info")
    if "game_data" in fsm_main.memory:
        response = fsm_main.memory["game_data"].to_dict()
    else:
        response = {}
    response = jsonify(response)
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response


@app.route('/api/state')
def get_game_state():
    # log_main.debug("Call to fetch the current program state")
    response = jsonify(fsm_main.current_state.name)
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response


@app.route('/shutdown')
def shutdown_server():
    server.stop()
    thread_fsm.do_run = False
    thread_fsm.join()
    sys.exit(0)


@app.errorhandler(Exception)
def all_exception_handler(error):
    log_main.error("Flask exception: {}".format(traceback.format_exc()))
    response = jsonify({})
    response.headers.add('Access-Control-Allow-Origin', '*')
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
    return in_menu, in_game


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


state_pregame = State("pregame", do=pregame_do)


# State: Game =============================


def game_do(memory):
    # new_addr = memory["instance_manager"].get_address("position")
    # addresses_unchanged = memory["instance_manager"].addresses["position"] == new_addr
    previous_time = memory["game_data"].time
    try:
        memory["game_data"].get_current_data(memory["instance_manager"], memory["song_data"])
    except WindowsError:
        log_main.error("Unexpected pointer change")
        Exception("Unexpected pointer change")
    in_menu = memory["instance_manager"].get_value("in_menu", True) == 1
    in_game = memory["instance_manager"].get_value("in_game", True) == 1
    game_unchanged = previous_time <= memory["game_data"].time
    return in_menu, in_game, game_unchanged


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


state_game = State("game", do=game_do, on_exit=game_exit)


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
    return in_menu, in_game


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


# Transitions =============================
# Loopbacks happen automatically if no matching transition state is found

transitions = {(state_init, True): state_menu,
               (state_menu, (False, True)): state_pregame,
               (state_pregame, True): state_game,
               (state_game, (False, False, True)): state_endscreen,
               (state_game, (True, False, False)): state_menu,
               (state_game, (True, False, True)): state_menu,
               (state_game, (False, True, False)): state_pregame,
               (state_endscreen, (True, False)): state_menu,
               (state_endscreen, (False, True)): state_pregame}


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

    fsm_main = FSMWithMemory(state_init, transitions, memory={"config": config}, logger=log_main)
    thread_fsm = threading.Thread(target=main_loop, args=(fsm_main,))
    thread_fsm.start()

    listening_port = parse_port()
    dispatcher = PathInfoDispatcher({'/': app})
    server = WSGIServer(('127.0.0.1', listening_port), dispatcher)
    server.start()
