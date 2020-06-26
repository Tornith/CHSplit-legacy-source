import sqlite3


class SplitDB(object):
    DB_VERSION = 1

    def __init__(self, exec_path=".", version="-1", logger=None):
        self.exec_path = exec_path
        self.version = version
        self.logger = logger
        self.connection = sqlite3.connect(exec_path + "/splits.db")
        self.initialize()

    def initialize(self):
        self.check_up_to_date()

    def create_base_structure(self):
        cursor = self.connection.cursor()
        # Song id = [song_name]_[song_hash]
        cursor.execute("""CREATE TABLE IF NOT EXISTS `songs`(
                            `id` varchar(255) PRIMARY KEY,
                            `name` varchar(255) NULL,
                            `artist` varchar(255) NULL,
                            `hash` varchar(8) NOT NULL,
                            `legacy` bit DEFAULT 0 NOT NULL);""")
        cursor.execute("""CREATE TABLE IF NOT EXISTS `runs`(
                            `song` varchar(255) NOT NULL,
                            `speed` int NOT NULL,
                            `run_no` int NOT NULL,
                            `total_score` bigint NOT NULL,
                            `difficulty` tinyint(3) NOT NULL,
                            `instrument` tinyint(3) NOT NULL,
                            `datetime` datetime NULL,
                            `legacy` bit DEFAULT 0 NOT NULL,
                            PRIMARY KEY (`song`, `run_no`),
                            FOREIGN KEY(`song`) REFERENCES songs(`id`));""")
        cursor.execute("""CREATE TABLE IF NOT EXISTS `sections`(
                            `song` varchar(255) NOT NULL,
                            `index` int NOT NULL,
                            `name` varchar(255) NOT NULL,
                            PRIMARY KEY (`song`, `index`),
                            FOREIGN KEY(`song`) REFERENCES songs(`id`));""")
        cursor.execute("""CREATE TABLE IF NOT EXISTS `splits`(
                            `song` varchar(255) NOT NULL,
                            `run_index` int NOT NULL,
                            `section_index` int NOT NULL,
                            `score` int NOT NULL,
                            PRIMARY KEY (`song`, `run_index`, `section_index`),
                            FOREIGN KEY(`song`, `run_index`) REFERENCES runs(`song`, `run_no`));""")
        self.connection.commit()

    def add_run(self, song, splits, instrument, difficulty):
        pass  # todo

    def add_song(self, song):
        pass  # todo

    def remove_run(self, song, run_id):
        pass  # todo

    def list_songs(self):
        pass  # todo

    def list_runs_by_song(self, song):
        pass  # todo

    def select_run_by_id(self, song, run_id):
        pass  # todo

    def export_run(self, song, run_id):
        pass  # todo

    def export_db(self):
        pass  # todo

    def import_run(self, import_file, song, run_id):
        pass  # todo

    def import_db(self, import_file):
        pass  # todo

    def contains_song(self, song):
        cursor = self.connection.cursor()

    def check_up_to_date(self):
        cursor = self.connection.cursor()
        cursor.execute("PRAGMA user_version")
        version = cursor.fetchone()
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
