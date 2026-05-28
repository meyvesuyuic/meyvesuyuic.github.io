import sys

def check_braces(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    stack = []
    lines = content.split('\n')
    
    for i, line in enumerate(lines):
        for j, char in enumerate(line):
            if char in '{[(':
                stack.append((char, i + 1, j + 1))
            elif char in '}])':
                if not stack:
                    print(f"Unmatched {char} at line {i+1}, col {j+1}")
                    return
                last_char, last_line, last_col = stack.pop()
                if (char == '}' and last_char != '{') or \
                   (char == ']' and last_char != '[') or \
                   (char == ')' and last_char != '('):
                    print(f"Mismatched {char} at line {i+1}, col {j+1}. Expected match for {last_char} at {last_line}:{last_col}")
                    return

    if stack:
        for char, line, col in stack:
            print(f"Unclosed {char} starting at line {line}, col {col}")
    else:
        print("All braces matched perfectly.")

if __name__ == "__main__":
    check_braces(sys.argv[1])
