import re

_NUM = re.compile(r'-?(?:0|[1-9][0-9]*)')


class _Bad(Exception):
    pass


def json_canon(s: str) -> str:
    n = len(s)
    pos = [0]

    def peek():
        return s[pos[0]] if pos[0] < n else ''

    def ws():
        while pos[0] < n and s[pos[0]] == ' ':
            pos[0] += 1

    def expect(ch):
        if peek() != ch:
            raise _Bad()
        pos[0] += 1

    def string():
        expect("'")
        j = s.find("'", pos[0])
        if j < 0:
            raise _Bad()
        val = s[pos[0]:j]
        pos[0] = j + 1
        return val

    def value():
        ws()
        c = peek()
        if c == '{':
            pos[0] += 1
            items = {}
            ws()
            if peek() == '}':
                pos[0] += 1
                return '{}'
            while True:
                ws()
                key = string()
                ws()
                expect(':')
                val = value()
                items[key] = val
                ws()
                c = peek()
                if c == ',':
                    pos[0] += 1
                    continue
                if c == '}':
                    pos[0] += 1
                    break
                raise _Bad()
            return '{' + ','.join("'%s':%s" % (k, items[k]) for k in sorted(items)) + '}'
        if c == '[':
            pos[0] += 1
            elems = []
            ws()
            if peek() == ']':
                pos[0] += 1
                return '[]'
            while True:
                elems.append(value())
                ws()
                c = peek()
                if c == ',':
                    pos[0] += 1
                    continue
                if c == ']':
                    pos[0] += 1
                    break
                raise _Bad()
            return '[' + ','.join(elems) + ']'
        if c == "'":
            return "'" + string() + "'"
        if c == '-' or ('0' <= c <= '9' and c != ''):
            m = _NUM.match(s, pos[0])
            if not m:
                raise _Bad()
            pos[0] = m.end()
            return str(int(m.group()))
        for word in ('true', 'false', 'null'):
            if s.startswith(word, pos[0]):
                pos[0] += len(word)
                return word
        raise _Bad()

    try:
        result = value()
        ws()
        if pos[0] != n:
            return 'error'
        return result
    except _Bad:
        return 'error'
