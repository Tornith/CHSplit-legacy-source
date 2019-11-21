from hackManager.hack import Hack
from utils import log


class InstanceManager(object):
    def __init__(self, offset_cfg, logger=None):
        self.offsets = offset_cfg
        self.instance = None
        self.addresses = None
        self.base_addresses = None
        self.logger = logger

    def attach(self):
        try:
            attempt = Hack("Clone Hero.exe")
        except ValueError:
            log(self.logger, "warning", "Couldn't attach to process")
            return False
        base_addr = "%x" % attempt.base_address
        log(self.logger, "info", "Successfully attached to the game process. Base address: {}".format(base_addr))
        self.instance = attempt
        return True

    def load_addresses(self, only_base_address=False):
        name = None
        try:
            addresses = {}
            for name in self.offsets.sections():
                if only_base_address and self.offsets[name]["offsets"] == "NULL":
                    addresses[name] = self.get_static_address(name)
                elif not only_base_address and self.offsets[name]["offsets"] != "NULL":
                    addresses[name] = self.get_address(name)
        except WindowsError:
            log(self.logger, "warning", "Couldn't retrieve address: {}".format(name if name is not None else "Unknown"))
            return False
        if only_base_address:
            self.base_addresses = addresses
        else:
            self.addresses = addresses
        log(self.logger, "info", "Successfully retrieved addresses")
        return True

    def get_address(self, name):
        pointer = self.instance.read_pointer(self.get_base_pointer(name))
        offset = self.get_offset_array(name)
        return self.offset_address(pointer, offset)

    def get_static_address(self, name):
        return "%x" % self.get_base_pointer(name)

    def get_base_pointer(self, name):
        base_offset = int(self.offsets[name]["base_offset"], 16)
        return self.instance.module_base_dict[self.offsets[name]["base_dll"] + ".dll"] + base_offset

    def get_offset_array(self, name):
        if self.offsets[name]["offsets"] == "NULL":
            return []
        return [int(i, 16) for i in (self.offsets[name]["offsets"].split(", "))]

    def offset_address(self, pointer, offsets):
        res = pointer
        for i in range(len(offsets)):
            try:
                res = self.instance.read_pointer(res[0] + offsets[i])
            except WindowsError:
                raise
        return res[1]

    def get_value(self, name, static_address=False):
        funcs = {'i': (int, self.instance.read_int),
                 'd': (float, self.instance.read_double),
                 'b': (int, self.instance.read_char),
                 's': (str, self.instance.read_string)}
        var_type = self.offsets[name]["var_type"]
        if var_type == 's':
            if not static_address:
                dictionary = self.addresses
            else:
                dictionary = self.base_addresses
            value = funcs[var_type][1](int(dictionary[name], 16), 1000)[0]
            value = str(value).decode("utf-16", errors="ignore").split("\x00")[0]
        else:
            if not static_address:
                dictionary = self.addresses
            else:
                dictionary = self.base_addresses
            value = funcs[var_type][0](funcs[var_type][1](int(dictionary[name], 16))[0])
        return value
