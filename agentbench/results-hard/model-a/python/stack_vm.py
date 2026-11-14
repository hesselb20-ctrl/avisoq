def stack_vm(program: str) -> str:
    prog = [p.strip() for p in program.split(';')] if program.strip() else []
    n = len(prog)
    stack = []
    out = []
    pc = 0
    steps = 0
    err = None
    while pc < n:
        if steps >= 1000:
            err = "!steps"
            break
        steps += 1
        parts = prog[pc].split()
        op = parts[0] if parts else ''
        arg = int(parts[1]) if len(parts) > 1 else 0
        pc += 1
        if op == 'push':
            stack.append(arg)
        elif op in ('add', 'sub', 'mul'):
            if len(stack) < 2:
                err = "!stack"
                break
            b = stack.pop()
            a = stack.pop()
            stack.append(a + b if op == 'add' else a - b if op == 'sub' else a * b)
        elif op == 'dup':
            if len(stack) < 1:
                err = "!stack"
                break
            stack.append(stack[-1])
        elif op == 'swap':
            if len(stack) < 2:
                err = "!stack"
                break
            stack[-1], stack[-2] = stack[-2], stack[-1]
        elif op == 'pop':
            if len(stack) < 1:
                err = "!stack"
                break
            stack.pop()
        elif op == 'out':
            if len(stack) < 1:
                err = "!stack"
                break
            out.append(str(stack.pop()))
        elif op == 'jmp' or op == 'jz':
            if op == 'jz':
                if len(stack) < 1:
                    err = "!stack"
                    break
                take = stack.pop() == 0
            else:
                take = True
            if take:
                if arg < 0 or arg > n:
                    err = "!jump"
                    break
                pc = arg
        elif op == 'halt':
            break
    if err:
        out.append(err)
    return ','.join(out)
