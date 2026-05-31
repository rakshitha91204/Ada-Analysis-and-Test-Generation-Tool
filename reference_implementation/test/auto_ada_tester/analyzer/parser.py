# parser.py
class Parser:
    def __init__(self, units):
        self.units = units

    def extract_ast(self):
        ast_data = {}
        for unit in self.units:
            ast_data[unit.filename] = unit.root.kind_name
        return ast_data