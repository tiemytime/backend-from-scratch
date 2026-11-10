# 01. The Terminal

Before backend, get comfortable in the terminal. Servers, logs, Docker and deployments all live here.

Each idea is written twice:
- **In plain words** for the intuition
- **Technically** for the real terms you'll see in docs and interviews

Main source: Julia Evans' zine *The Secret Rules of the Terminal* (wizardzines.com).

---

## 1. The big picture: 4 pieces work together

When you type `python3 hi.py` and see `hello world`, four separate things are involved:

| Piece | In plain words | Technically | Example |
|---|---|---|---|
| Terminal emulator | The window. Turns your keys into bytes and draws text on screen. | A GUI program that renders bytes and escape codes | Alacritty, Ghostty, iTerm |
| TTY driver | A middle layer that handles Ctrl+C, shows what you type, lets you backspace | Part of the OS kernel, sits between emulator and programs | the kernel |
| Shell | Reads your command, finds the program, starts it | A program that parses commands, expands wildcards and variables, runs processes | zsh, bash, fish |
| Programs | The thing that actually runs | Any process | python3, vim, node |

The flow:

```
key press → emulator → bytes → TTY driver → program
program output → bytes → TTY driver → emulator draws it
```

**Everything between them is just bytes.**

---

## 2. stdin, stdout, stderr (the 3 pipes)

**In plain words:** every program is like a cook with three tubes.

```
            ┌──────────┐
  0 IN ───► │  program │ ───► 1 OUT  (the food: normal results)
            │  (cook)  │ ───► 2 ERR  (complaints: errors, warnings)
            └──────────┘
```

| Number | Name | In plain words | Default |
|---|---|---|---|
| 0 | stdin | Order slip coming in | your keyboard |
| 1 | stdout | Normal results going out | your screen |
| 2 | stderr | Error messages going out | your screen too |

**Why two output pipes?** So you can keep results and errors apart. If you save results to a file, you don't want error messages mixed into your data.

**Technically:** these are *file descriptors* 0, 1, 2 that every process gets when it starts.

Try it:

```bash
ls /home /doesnotexist
```

You see a listing (stdout) and an error (stderr). Both show on screen, but through different pipes.

**Why it matters for backend:** servers write their logs to stdout/stderr. Docker, cloud platforms and `docker logs` collect exactly these two pipes.

---

## 3. Redirects: point the pipes somewhere else

| Command | In plain words |
|---|---|
| `cmd > file.txt` | Send normal output into a file (replaces the file) |
| `cmd >> file.txt` | Same, but **add to the end** of the file |
| `cmd 2> errors.txt` | Send only the errors into a file |
| `cmd > all.txt 2>&1` | Send output to a file, and errors **to the same place**. Everything in one file. |
| `cmd < input.txt` | Read input from a file instead of the keyboard |

`2>&1` looks scary but just means: **"pipe 2, go wherever pipe 1 is going."**

```bash
ls /home /doesnotexist > out.txt        # error still on screen, listing in file
ls /home /doesnotexist > out.txt 2>&1   # nothing on screen, both in file
```

---

## 4. Pipes `|`: "and then"

**In plain words:** `|` means **"and then"**. Read commands left to right like a sentence.

**Technically:** a pipe connects one program's stdout to the next program's stdin.

```bash
cat app.log | grep error | wc -l
```

> "Show the log, **and then** keep lines with 'error', **and then** count them."

Small tools chained together = powerful one-liners. Like an assembly line.

---

## 5. Don't memorize commands. Remember the question.

Each command answers one everyday question. Think of them as verbs:

| Your question | Command | Verb |
|---|---|---|
| Show me what's in this file | `cat file` | show |
| Find lines that have this word | `grep word` | search (like Ctrl+F) |
| How many lines? | `wc -l` | count |
| First / last few lines | `head` / `tail` | top / bottom |
| Put them in order | `sort` | sort |
| Let me scroll through it | `less file` | read slowly (`/` search, `q` quit) |

Practice:

```bash
printf "INFO server started\nINFO user logged in\nERROR database timeout\nINFO user logged out\nERROR payment failed\nINFO server started\n" > ~/practice.log

cat ~/practice.log                        # show
cat ~/practice.log | grep ERROR           # show, then search
cat ~/practice.log | grep ERROR | wc -l   # show, then search, then count → 2
cat ~/practice.log | tail -2              # show, then last 2 lines
```

### When you forget a command

| Tool | What it does |
|---|---|
| `tldr grep` | Short practical examples ("too long; didn't read"). Use this first. |
| `man grep` | The full official manual (long) |
| `Ctrl+R` | Search commands you typed before |

---

## 6. Locations: `~`, `/`, `.`, `..`

Think of folders like rooms in a house.

| Symbol | In plain words | Example |
|---|---|---|
| `/` | The very top of the whole computer (main door) | `/home`, `/usr/bin` |
| `~` | Your home folder (shortcut for `/home/yourname`) | `~/Desktop` |
| `.` | The folder you're in right now ("here") | `./script.sh` |
| `..` | One folder up (parent room) | `cd ..` |

```bash
pwd       # where am I?
ls        # what's in here?
cd ~      # take me home
echo ~    # prints your full home path
```

---

## 7. Working with files

| Command | In plain words |
|---|---|
| `mkdir test` | make a folder |
| `mkdir -p a/b/c` | make nested folders (no error if they exist) |
| `touch a.txt` | make an empty file |
| `cp a.txt b.txt` | copy |
| `mv a.txt c.txt` | move or rename |
| `rm c.txt` | delete. **No trash can, it's gone.** |

---

## 8. PATH: where the shell looks for programs

**In plain words:** when you type `python3`, the shell doesn't magically know where it lives. It has a **list of folders** and checks them **one by one, in order**, like checking your pocket, then your bag, then the drawer for your keys. First match wins.

**Technically:** `PATH` is an environment variable: a colon-separated list of directories.

```bash
echo $PATH                    # raw list
echo "$PATH" | tr ':' '\n'    # one folder per line
which python3                 # which file runs
which -a python3              # ALL matches, in order
type ls                       # what the shell will REALLY run (alias? builtin? file?)
```

| Situation | What it means |
|---|---|
| `command not found` | Shell checked every folder on PATH, found nothing |
| Wrong version runs | An older copy sits in an earlier folder |

Adding a folder:

```bash
export PATH=$PATH:/my/dir   # at the end: fallback
export PATH=/my/dir:$PATH   # at the start: takes priority over system versions
```

Extras:
- **`type` vs `which`:** the shell checks aliases and builtins (like `cd`) before files on PATH. `type` shows the truth.
- **zsh `path` array:** zsh lets you edit `$path` as a list, and it syncs to `$PATH` automatically.
- **Hash cache:** the shell remembers where it found a program. If it keeps running an old one after you install a new one, run `hash -r`.

---

## 9. Job control: running things in the background

`npm run dev` "takes over" your terminal. These give it back:

| Action | In plain words |
|---|---|
| `Ctrl+C` | Stop it (kill) |
| `Ctrl+Z` | Pause it, give me my terminal |
| `bg` | Resume the paused program in the background |
| `fg` | Bring it back to the front |
| `cmd &` | Start it in the background right away |
| `jobs` | List background jobs |

---

## 10. Escape codes

**In plain words:** most bytes are text, but some byte sequences are **instructions** like "make text green" or "hide the cursor". Like `**bold**` in markdown: the stars aren't shown, they change how text looks.

**Technically:** they all start with the ESC character (byte 27). These all mean the same byte:

| Notation | Why |
|---|---|
| `\033` | 27 in octal |
| `\x1b` | 27 in hex |
| `^[` | how terminals display it |
| `\e` | shortcut |
| `ESC` | its name |

```bash
printf '\e[32mI am green\e[0m normal again\n'
```

Your keys send escape codes too. Run `cat`, press arrow keys: you'll see `^[[A`, `^[[B`. (Ctrl+C to quit.)

### Broken terminal? Use `reset`

If a program crashes after hiding the cursor or changing colors, your terminal stays broken.

```bash
printf '\e[?25l'   # cursor disappears
reset              # fixed
```

`reset` fixes two layers:
- `tput reset` prints "reset everything" escape codes, which fixes the **emulator**
- `stty sane` resets the **TTY driver** (e.g. turns echo back on if typing became invisible)

Same thing happens when you `cat` a binary file: random bytes get read as escape codes.

---

## 11. Gotcha: always quote URLs

```bash
curl https://httpbin.org/cookies/set?user=me
# zsh: no matches found
```

**Why:** in zsh, `?` is a wildcard ("any single character"). The shell treated the URL as a filename pattern and failed **before curl even ran**. The shell rewrites your command first; that's its job.

**Fix:** quote it.

```bash
curl 'https://httpbin.org/cookies/set?user=me'
```

Characters that mean something to the shell: `?` `*` (wildcards), `&` (background), `|` (pipe), `>` `<` (redirects), `$` (variables).

---

## 12. nvim survival guide

nvim has **modes**: one for typing text, one for commands.

| Keys | Meaning |
|---|---|
| `i` | insert mode (start typing) |
| `Esc` | back to command mode |
| `:w` | save (write) |
| `:q` | quit |
| `:wq` | save and quit |
| `:q!` | quit **without** saving (escape hatch) |
| `gg` | jump to first line |
| `:8` | jump to line 8 |
| `dd` / `8dd` | delete 1 line / 8 lines |
| `o` | new line below, in insert mode |
| `Ctrl+Shift+V` | paste (in most Linux terminals) |

**Stuck?** `Esc` a few times, then `:q!` and Enter.

---

## 13. Read the error message

Errors usually tell you exactly what's wrong.

```
/home/me/server.js:1
  mkdir -p ~/backend-learning
           ^
SyntaxError: Unexpected token '~'
```

- `server.js:1` → file and **line number**
- `^` → points at the problem
- `SyntaxError` → "this isn't valid code" (here: shell commands pasted into a JS file)

---

## What matters most for backend

1. stdin / stdout / stderr → how logs work
2. Redirects and pipes → daily debugging (`... | grep error`, `> log.txt 2>&1`)
3. Job control → running servers
4. PATH → most "command not found" / wrong-version bugs
5. Quoting → avoiding weird shell errors
