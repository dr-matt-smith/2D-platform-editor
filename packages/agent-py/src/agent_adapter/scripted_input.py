"""ScriptedInput — a faithful port of src/play/scriptedInput.js.

Implements the v9 Input shape (is_down / was_pressed / end_frame) but
reads from a recording instead of a keyboard.

Recording shape: a list of {"frame": int, "key": str, "down": bool}.
"""


class ScriptedInput:
    def __init__(self, recording=None):
        recording = recording or []
        # Defensive copy + stable sort by frame, matching the JS sort.
        self._events = sorted(recording, key=lambda e: e["frame"])
        self._cursor = 0
        self.held = set()
        self.pressed = set()
        self._frame = -1

    def advance(self, frame):
        """Apply all events with frame <= `frame` not yet applied, after
        clearing the one-shot pressed set on a new frame. Idempotent
        within a frame; frames are expected to be monotone-increasing.
        """
        if frame > self._frame:
            self.pressed.clear()
            self._frame = frame
        while (
            self._cursor < len(self._events)
            and self._events[self._cursor]["frame"] <= frame
        ):
            e = self._events[self._cursor]
            self._cursor += 1
            if e["down"]:
                # pressed-edge only when not already held (v9 _onKeyDown).
                if e["key"] not in self.held:
                    self.pressed.add(e["key"])
                self.held.add(e["key"])
            else:
                self.held.discard(e["key"])

    def is_down(self, key):
        return key in self.held

    def was_pressed(self, key):
        return key in self.pressed

    def end_frame(self):
        # No-op — advance() handles the clear at frame-start (shape parity).
        pass

    def dispose(self):
        pass
