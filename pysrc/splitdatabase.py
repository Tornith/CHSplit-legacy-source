import sqlite3
from datetime import datetime
from utils import log


class SplitDB(object):
    DB_VERSION = 1

    def __init__(self, db_name="splits.db", exec_path=".", version="-1", logger=None):
        self.exec_path = exec_path
        self.version = version
        self.logger = logger
        self.connection = sqlite3.connect(exec_path + "/" + db_name)

        self.initialize()

    def initialize(self):
        log(self.logger, "info", "Initializing DB...")
        self.check_up_to_date()

    def create_base_structure(self):
        cursor = self.connection.cursor()
        log(self.logger, "info", "Creating table <songs>")
        cursor.execute("""CREATE TABLE IF NOT EXISTS songs(
                            `id` varchar(255) PRIMARY KEY,
                            `name` varchar(255) NULL,
                            `artist` varchar(255) NULL,
                            `hash` varchar(8) NOT NULL,
                            `legacy` bit DEFAULT 0 NOT NULL);""")
        log(self.logger, "info", "Creating table <runs>")
        cursor.execute("""CREATE TABLE IF NOT EXISTS runs(
                            `run_id` INTEGER PRIMARY KEY AUTOINCREMENT,
                            `song` varchar(255) NOT NULL,
                            `speed` int NOT NULL,
                            `player` varchar(255) NULL,
                            `total_score` bigint NOT NULL,
                            `difficulty` unsigned tinyint(3) NOT NULL,
                            `instrument` unsigned tinyint(3) NOT NULL,
                            `datetime` datetime NULL,
                            `legacy` bit DEFAULT 0 NOT NULL,
                            FOREIGN KEY(`song`) REFERENCES songs(`id`));""")
        log(self.logger, "info", "Creating table <sections>")
        cursor.execute("""CREATE TABLE IF NOT EXISTS sections(
                            `song` varchar(255) NOT NULL,
                            `index` bigint NOT NULL,
                            `name` varchar(255) NOT NULL,
                            PRIMARY KEY (`song`, `index`),
                            FOREIGN KEY(`song`) REFERENCES songs(`id`));""")
        log(self.logger, "info", "Creating table <splits>")
        cursor.execute("""CREATE TABLE IF NOT EXISTS splits(
                            `run_index` int NOT NULL,
                            `song` varchar(255) NOT NULL,
                            `section_index` bigint NOT NULL,
                            `score` int NOT NULL,
                            PRIMARY KEY (`song`, `run_index`, `section_index`),
                            FOREIGN KEY (`song`) REFERENCES songs(`song`),
                            FOREIGN KEY (`run_index`) REFERENCES runs(`run_id`),
                            FOREIGN KEY (`song`, `section_index`) REFERENCES sections(`song`, `index`));""")
        log(self.logger, "info", "Done creating the base database structure!")
        self.connection.commit()

    def add_run(self, song, game, commit=True):
        cursor = self.connection.cursor()

        if not self.contains_song(song):
            self.add_song(song, commit=False)

        song_info = song.to_dict()
        game_info = game.to_dict()

        total_score = game_info["splits"][max(game_info["splits"], key=game_info["splits"].get)]
        time = datetime.now().strftime("%B %d, %Y %I:%M%p")

        cursor.execute("""INSERT INTO runs 
                        (`song`, `speed`, `player`, `total_score`, `difficulty`, `instrument`, `datetime`) VALUES 
                        (?, ?, ?, ?, ?, ?, ?)""",
                       (song.get_song_id(), song_info["speed"], game_info["player"],
                        total_score, song_info["difficulty"], song_info["instrument"], time))

        run_id = cursor.execute("SELECT last_insert_rowid();").fetchone()[0]

        self.add_splits(song, run_id, game_info["splits"], commit=False)

        if commit:
            self.connection.commit()
        log(self.logger, "info", "Successfully inserted run: '{}' of song: '{}' into database!"
            .format(run_id, song.get_song_id()))

    def add_splits(self, song, run_id, splits, commit=True):
        cursor = self.connection.cursor()

        for i, split in splits.items():
            cursor.execute("INSERT INTO splits (`run_index`, `song`, `section_index`, `score`) VALUES (?, ?, ?, ?)",
                           (run_id, song.get_song_id(), i, split))

        if commit:
            self.connection.commit()

    def add_song(self, song, commit=True):
        cursor = self.connection.cursor()

        song_info = song.to_dict()
        cursor.execute("INSERT INTO songs (`id`, `name`, `artist`, `hash`) VALUES (?, ?, ?, ?)",
                       (song.get_song_id(), song_info["name"], song_info["artist"], song.get_song_hash()))

        self.add_sections(song, song_info["sections"], commit=False)

        if commit:
            self.connection.commit()

    def add_sections(self, song, sections, commit=True):
        cursor = self.connection.cursor()

        for section in sections:
            cursor.execute("INSERT INTO sections (`song`, `index`, `name`) VALUES (?, ?, ?)",
                           (song.get_song_id(), section[0], section[1]))
        if commit:
            self.connection.commit()

    def remove_run(self, song, run_id, commit=True):
        pass  # todo

    def list_songs(self):
        pass  # todo

    def list_runs_by_song(self, song):
        pass  # todo

    def select_run_by_id(self, run_id):
        pass  # todo

    def select_splits_by_id(self, run_id):
        cursor = self.connection.cursor()
        cursor.execute("SELECT `section_index`, `score` FROM splits WHERE `run_index` = ? ORDER BY `section_index`",
                       (run_id,))
        return dict(cursor.fetchall())

    def export_run(self, run_id):
        pass  # todo

    def export_db(self):
        pass  # todo

    def import_run(self, import_file, song, run_id, commit=True):
        pass  # todo

    def import_db(self, import_file, commit=True):
        pass  # todo

    def contains_song(self, song):
        cursor = self.connection.cursor()
        cursor.execute("SELECT COUNT(`id`) FROM songs WHERE `id` = ?", (song.get_song_id(),))
        count = cursor.fetchone()[0]
        return count > 0

    def get_personal_best(self, song):
        cursor = self.connection.cursor()

        song_id = song.get_song_id()
        song_speed = song.to_dict()["speed"]

        cursor.execute("SELECT `run_id`, MAX(`total_score`) FROM runs WHERE `song` = ? and `speed` = ?",
                       (song_id, song_speed))

        pb_id = cursor.fetchone()[0]

        if pb_id is None:
            return {}

        return self.select_splits_by_id(pb_id)

    def check_up_to_date(self):
        cursor = self.connection.cursor()
        cursor.execute("PRAGMA user_version")
        version = cursor.fetchone()[0]
        print "DBVersion: {}".format(version)
        if version < self.DB_VERSION:
            if version == 0:
                cursor.execute("PRAGMA user_version = {}".format(self.DB_VERSION))
                self.connection.commit()
                self.create_base_structure()
            else:
                pass  # todo update db
        elif version > self.DB_VERSION:
            pass  # todo run in compatibility mode?

    def legacy_import(self, split_file):
        pass  # todo

    def close_conn(self):
        self.connection.close()
