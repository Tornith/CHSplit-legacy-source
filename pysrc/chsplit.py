import sys
import threading
from gevent import pywsgi, monkey
from geventwebsocket.handler import WebSocketHandler
from socketio import Server, WSGIApp
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
import json
import argparse

# Gevent monkey patch =====================

monkey.patch_all()


# Parsing arguments =======================

def json_str(v):
    if isinstance(v, dict):
        return v
    try:
        return json.loads(v)
    except ValueError:
        print "Invalid config file:"
        raise argparse.ArgumentTypeError('JSON string expected.')


parser = argparse.ArgumentParser(prog="chsplit", description="The CHSplit backend")
parser.add_argument("path", type=str, help="the CHSplit executable path")
parser.add_argument("port", type=int, help="the port to run the backend API at")
parser.add_argument("config", type=json_str, help="the config in JSON format")
args = parser.parse_args()

# Logging =================================

log_main = logging.getLogger(__name__)
log_main.setLevel(logging.INFO)

formatter = logging.Formatter('%(asctime)s  %(levelname)-8s %(message)s')

# Create 'logs' folder if it doesn't exist
if not os.path.isdir(args.path + '/logs'):
    os.makedirs(args.path + '/logs')

# Backup old log files
if os.path.isfile(args.path + '/logs/oldest.log'):
    os.remove(args.path + '/logs/oldest.log')
if os.path.isfile(args.path + '/logs/older.log'):
    os.rename(args.path + '/logs/older.log', args.path + '/logs/oldest.log')
if os.path.isfile(args.path + '/logs/old.log'):
    os.rename(args.path + '/logs/old.log', args.path + '/logs/older.log')
if os.path.isfile(args.path + '/logs/latest.log'):
    os.rename(args.path + '/logs/latest.log', args.path + '/logs/old.log')

file_handler = logging.FileHandler(args.path + '/logs/latest.log')
file_handler.setFormatter(formatter)

log_main.addHandler(file_handler)


# Flask ==================================

sio = Server(async_mode='gevent', cors_allowed_origins="*")
app = WSGIApp(sio)

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
    msg_dump = json.dumps(message)
    log_main.debug("Sent {}\n\tMessage: {}".format(event_name, msg_dump))
    sio.emit(event_name, msg_dump, json=True)
    return True


def send_single(data, event_name, jsonify=False):
    if jsonify:
        data = json.dumps(data)
    sio.emit(event_name, data, json=jsonify)


@sio.on('REQUEST_DATA')
def request_data(sid, data_id):
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
def shutdown_server(sid):
    wsgi_server.stop()
    thread_fsm.do_run = False
    thread_fsm.join()
    sys.exit(0)


@sio.on('callback')
def acknowledge_success(sid, data):
    log_main.debug("DATA: {}".format(data))


@sio.event
def connect(sid, environ):
    print('connect ', sid)


@sio.event
def disconnect(sid):
    print('disconnect ', sid)


# States ==================================
# State: Init =============================

def init_entry(memory, previous_state):
    if not os.path.isdir(args.path + '/splits'):
        os.makedirs(args.path + '/splits')
        log_main.info("Created splits folder")
    if not os.path.isdir(args.path + '/offsets'):
        os.makedirs(args.path + '/offsets')
        log_main.info("Created offsets folder")
    offsets_path = args.path + 'offsets/offsets.' + memory["config"]["selectedGameVersion"] + '.yml'
    log_main.debug(offsets_path)
    offsets = utils.load_yaml_file(offsets_path)
    if offsets is None:
        log_main.info("Offset file not downloaded, downloading for game version: {}"
                      .format(memory["config"]["selectedGameVersion"]))
        utils.get_offset_file_ajax(memory["config"]["selectedGameVersion"], offsets_path)
        offsets = utils.load_yaml_file(offsets_path)
        if offsets is None:
            log_main.critical("Offset file not found; Invalid game version: {}"
                              .format(memory["config"]["selectedGameVersion"]))
            raise Exception("Offset file not found")
    memory["offsets"] = offsets
    memory["instance_manager"] = InstanceManager(memory["offsets"], logger=log_main)


def init_do(memory):
    if memory["instance_manager"].instance is None and not memory["instance_manager"].attach():
        time.sleep(0.5)
        return False
    return True


state_init = State("init", on_entry=init_entry, do=init_do)


# State: Menu =============================

def menu_do(memory):
    in_menu = memory["instance_manager"].get_value("in_menu") != 0
    in_game = memory["instance_manager"].get_value("in_game") != 0
    in_practice = memory["instance_manager"].get_value("in_practice") != 0
    return in_menu, in_game, in_practice


state_menu = State("menu", do=menu_do)


# State: Pre-game =========================

def pregame_do(memory):
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
                  exec_path=args.path, logger=log_main)
    log_main.info("Chart hash: {}".format(memory["song_data"].get_song_hash()))
    log_main.info("Chart sections: {}".format(memory["song_data"].to_dict()["sections"]))
    log_main.debug("Loaded splits: {}".format(memory["split_file"].splits))
    return True


def pregame_exit(memory, next_state):
    song_data = memory["song_data"].to_dict()
    pb_data = memory["split_file"].get_personal_best(song_data["instrument"], song_data["difficulty"])
    game_data = memory["game_data"].to_dict()
    send_data([song_data, pb_data], ["song", "pb"], "TRANSFER_SONG_DATA")
    send_data(game_data, "game", "TRANSFER_GAME_DATA")


state_pregame = State("pregame", do=pregame_do, on_exit=pregame_exit)


# State: Game =============================

def game_entry(memory, previous_state):
    memory["probe"] = threading.Thread(target=game_probe, args=(memory,))
    memory["probe_run"] = True
    memory["probe_reset"] = False
    memory["previous_game_data"] = {
        "score": -1,
        "time": -1,
        "splits_len": 0,
        "active_section": -1
    }
    memory["probe"].start()


def game_do(memory):
    try:
        memory["game_data"].get_current_data(memory["instance_manager"], memory["song_data"])
    except WindowsError:
        log_main.error("Unexpected pointer change")

    in_menu = memory["instance_manager"].get_value("in_menu") == 1
    in_game = memory["instance_manager"].get_value("in_game") == 1
    in_practice = memory["instance_manager"].get_value("in_practice") == 1

    if (not in_menu and in_game) and memory["previous_game_data"]["time"] > memory["game_data"].time:
        game_restart(memory)

    return in_menu, in_game, in_practice


def game_exit(memory, next_state):
    memory["probe_run"] = False
    memory["probe"].join()
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
        send_data(memory["game_data"].to_dict(), "game", "TRANSFER_GAME_DATA")
        send_single("gameRestart", "GAME_EVENT")
    memory["probe_reset"] = True


def game_probe(memory):
    prev = memory["previous_game_data"]
    cur = memory["game_data"]
    while memory["probe_run"]:
        if int(prev["time"]) < int(cur.time):
            send_single(cur.time, "TRANSFER_GAME_DATA[time]")
            prev["time"] = cur.time
        if prev["score"] != cur.score:
            send_single(cur.score, "TRANSFER_GAME_DATA[score]")
            prev["score"] = cur.score
        if prev["active_section"] != -1 and prev["splits_len"] < len(cur.splits):
            send_single("{}:{}".format(prev["active_section"], cur.splits[prev["active_section"]]),
                        "TRANSFER_GAME_DATA[newSplit]")
            prev["splits_len"] = len(cur.splits)
        if cur.activeSection is not None and prev["active_section"] < cur.activeSection:
            send_single(cur.activeSection, "TRANSFER_GAME_DATA[activeSection]")
            prev["active_section"] = cur.activeSection
        if memory["probe_reset"]:
            memory["previous_game_data"] = {
                "score": -1,
                "time": -1,
                "splits_len": 0,
                "active_section": -1
            }
            prev = memory["previous_game_data"]
            cur = memory["game_data"]
            memory["probe_reset"] = False
        time.sleep(0.1)


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
    in_menu = memory["instance_manager"].get_value("in_menu") != 0
    in_game = memory["instance_manager"].get_value("in_game") != 0
    in_practice = memory["instance_manager"].get_value("in_practice") != 0
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
    in_menu = memory["instance_manager"].get_value("in_menu") != 0
    in_game = memory["instance_manager"].get_value("in_game") != 0
    in_practice = memory["instance_manager"].get_value("in_practice") != 0
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
    if args.config["debugMode"]:
        log_main.setLevel(logging.DEBUG)
        log_main.addHandler(logging.StreamHandler(sys.stdout))
        # log_flask.disabled = False
        log_main.info("DEBUG MODE: true")
    else:
        log_main.info("DEBUG MODE: false")

    fsm_main = FSMWithMemory(state_init, transitions, memory={"config": args.config}, logger=log_main,
                             on_every_exit=send_state_message)
    thread_fsm = threading.Thread(target=main_loop, args=(fsm_main,))
    thread_fsm.start()

    wsgi_server = pywsgi.WSGIServer(('127.0.0.1', args.port), app, handler_class=WebSocketHandler)
    wsgi_server.serve_forever()
    # app.run(threaded=True, host='127.0.0.1', port=listening_port)
