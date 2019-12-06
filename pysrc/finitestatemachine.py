from utils import log


class State(object):
    def __init__(self, name, do=(lambda *args: None), on_entry=(lambda *args: None), on_exit=(lambda *args: None)):
        self.name = name
        self.on_entry = on_entry
        self.on_exit = on_exit
        self.do = do

    def on_entry(self, args):
        return self.on_entry(*args)

    def on_exit(self, args):
        return self.on_exit(*args)

    def do(self, args):
        return self.do(*args)


class FiniteStateMachine(object):
    def __init__(self, initial_state, transitions, final_states=None,
                 on_every_entry=(lambda *args: None), on_every_exit=(lambda *args: None), logger=None):
        self.initial_state = initial_state
        self.final_states = final_states
        self.current_state = None
        self.transitions = transitions
        self.on_every_entry = on_every_entry
        self.on_every_exit = on_every_exit
        self.logger = logger

    def tick(self):
        if self.final_states is not None and self.current_state in self.final_states:
            log(self.logger, "info", "Reached a final state")
            return True
        else:
            self.do()
            return False

    def do(self):
        if self.current_state is None:
            self.current_state = self.initial_state
            log(self.logger, "info", "State: {}, call: on_entry".format(self.initial_state.name))
            self.on_every_entry(None)
            self.initial_state.on_entry(None)
        output = self.current_state.do()
        if (self.current_state, output) in self.transitions:
            next_state = self.transitions[(self.current_state, output)]
        else:
            next_state = self.current_state
        if self.current_state != next_state:
            log(self.logger, "info", "Transitioning from {} into {} under {} transition conditions"
                .format(self.current_state, next_state, output))
            self.transition(next_state)

    def transition(self, next_state):
        log(self.logger, "info", "State: {}, call: on_exit".format(self.current_state.name))
        self.current_state.on_exit(next_state)
        self.on_every_exit(next_state)

        previous_state = self.current_state
        self.current_state = next_state

        log(self.logger, "info", "State: {}, call: on_entry".format(next_state.name))
        self.on_every_entry(previous_state)
        next_state.on_entry(previous_state)

    def get_current_state(self):
        return self.current_state.name


class FSMWithMemory(FiniteStateMachine):
    def __init__(self, initial_state, transitions, final_states=None,
                 on_every_entry=(lambda *args: None), on_every_exit=(lambda *args: None), memory=None, logger=None):
        super(FSMWithMemory, self).__init__(initial_state, transitions, final_states,
                                            on_every_entry, on_every_exit, logger)
        if memory is None:
            memory = {}
        self.memory = memory

    def do(self):
        if self.current_state is None:
            self.current_state = self.initial_state
            log(self.logger, "info", "State: {}, call: on_entry".format(self.initial_state.name))
            self.on_every_entry(self.memory, None)
            self.initial_state.on_entry(self.memory, None)
        output = self.current_state.do(self.memory)
        if (self.current_state, output) in self.transitions:
            next_state = self.transitions[(self.current_state, output)]
        else:
            next_state = self.current_state
        if self.current_state != next_state:
            self.transition(next_state)

    def transition(self, next_state):
        log(self.logger, "info", "State: {}, call: on_exit".format(self.current_state.name))
        self.current_state.on_exit(self.memory, next_state)
        self.on_every_exit(self.memory, next_state)

        previous_state = self.current_state
        self.current_state = next_state

        log(self.logger, "info", "State: {}, call: on_entry".format(next_state.name))
        self.on_every_entry(self.memory, previous_state)
        next_state.on_entry(self.memory, previous_state)
