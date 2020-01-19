from hackManager.hack import Hack
from utils import log


class InstanceManager(object):
    def __init__(self, offset_cfg, logger=None):
        self.offsets = offset_cfg
        self.instance = None
        self.logger = logger

    def attach(self):
        try:
            attempt = Hack("Clone Hero.exe")
            base_addr = "%x" % attempt.base_address
        except ValueError:
            log(self.logger, "warning", "Couldn't attach to process")
            return False
        except TypeError:
            log(self.logger, "warning", "Failed to resolve game adresss")
            return False
        log(self.logger, "info", "Successfully attached to the game process. Base address: {}".format(base_addr))
        self.instance = attempt
        return True

    def get_address(self, value):
        pointer = self.instance.read_pointer(self.get_base_pointer(value))
        return self.offset_address(pointer, value["offsets"])

    def get_static_address(self, value):
        return "%x" % self.get_base_pointer(value)

    def get_base_pointer(self, value):
        return self.instance.module_base_dict[value["base_dll"] + ".dll"] + value["base_offset"]

    def offset_address(self, pointer, offsets):
        res = pointer
        for i in range(len(offsets)):
            try:
                res = self.instance.read_pointer(res[0] + offsets[i])
            except WindowsError:
                raise
        return res[1]

    def get_value(self, name):
        funcs = {'i': (int, self.instance.read_int),
                 'd': (float, self.instance.read_double),
                 'b': (int, self.instance.read_char),
                 's': (str, self.instance.read_string)}
        ptr_info = self.offsets["values"][name]
        var_type = ptr_info["var_type"]
        static = ptr_info["offsets"] is None
        address = self.get_address(ptr_info) if not static else self.get_static_address(ptr_info)
        if var_type == 's':
            value = funcs[var_type][1](int(address, 16), 1000)[0]
            value = str(value).decode("utf-16", errors="ignore").split("\x00")[0]
        else:
            value = funcs[var_type][0](funcs[var_type][1](int(address, 16))[0])
        return value
