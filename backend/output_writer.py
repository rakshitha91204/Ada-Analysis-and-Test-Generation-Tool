# output_writer.py
import json

class OutputWriter:
    def __init__(self, filename="analysis_output.json"):
        self.filename = filename

    def write(self, data):
        with open(self.filename, "w") as f:
            json.dump(data, f, indent=4)