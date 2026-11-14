_STEP_LIMIT = 1000
_NEEDS = {"add": 2, "sub": 2, "mul": 2, "swap": 2, "dup": 1, "pop": 1, "out": 1, "jz": 1}


def stack_vm(program: str) -> str:
    if program == "":
        return ""
    prog = program.split(";")
    n = len(prog)
    out = []
    st = []
    pc = 0
    steps = 0
    while pc < n:
        if steps >= _STEP_LIMIT:
            out.append("!steps")
            break
        steps += 1
        parts = prog[pc].split()
        if not parts:
            pc += 1
            continue
        op = parts[0]
        need = _NEEDS.get(op, 0)
        if len(st) < need:
            out.append("!stack")
            break
        if op == "push":
            st.append(int(parts[1]))
        elif op == "add":
            b = st.pop()
            a = st.pop()
            st.append(a + b)
        elif op == "sub":
            b = st.pop()
            a = st.pop()
            st.append(a - b)
        elif op == "mul":
            b = st.pop()
            a = st.pop()
            st.append(a * b)
        elif op == "dup":
            st.append(st[-1])
        elif op == "swap":
            st[-1], st[-2] = st[-2], st[-1]
        elif op == "pop":
            st.pop()
        elif op == "out":
            out.append(str(st.pop()))
        elif op == "jmp" or (op == "jz" and st.pop() == 0):
            target = int(parts[1])
            if target < 0 or target > n:
                out.append("!jump")
                break
            pc = target
            continue
        elif op == "jz":
            pass
        elif op == "halt":
            break
        pc += 1
    return ",".join(out)
