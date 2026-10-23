import type { SortFrame } from '../visualizers/algorithms/sorting'

export const TRACE_MARKER = '@@PYDISC_TRACE@@'
export const TRACE_RUNNER_FILE_NAME = 'trace_runner.py'

export type TraceMode = 'items' | 'merge'

/**
 * A Python program that runs the student's main.py under sys.settrace and records how the list being
 * sorted changes. 'items' follows the in-place sorts (a list called `items`); 'merge' follows the
 * recursive merge_sort calls and writes each returned merge back into the original positions.
 * It records only the first top-level call, so the later print() demo calls do not matter.
 */
export function buildTraceRunnerSource(mode: TraceMode): string {
  return `import json
import os
import runpy
import sys

MODE = "${mode}"
MAX_FRAMES = 1500
MAX_ITEMS = 40
USER_FILE = os.path.join(os.getcwd(), "main.py")

frames = []
state = {"done": False, "tracked_id": None, "last": None, "root": None, "stack": [], "array": None}


def add_frame(values, active, note):
    if len(frames) < MAX_FRAMES:
        frames.append({"values": list(values), "active": list(active), "settled": [], "note": note})


def describe(changed, before, after):
    if len(changed) == 2 and before[changed[0]] == after[changed[1]] and before[changed[1]] == after[changed[0]]:
        return "Your code swapped positions %d and %d" % (changed[0], changed[1])
    if len(changed) == 1:
        return "Your code wrote %s at position %d" % (after[changed[0]], changed[0])
    return "Your code updated positions " + ", ".join(str(index) for index in changed)


def is_number_list(value):
    return isinstance(value, list) and len(value) <= MAX_ITEMS and all(isinstance(item, (int, float)) for item in value)


def items_local(frame, event, arg):
    if state["done"]:
        return None
    if event in ("line", "return"):
        items = frame.f_locals.get("items")
        if is_number_list(items) and (state["tracked_id"] is None or id(items) == state["tracked_id"]):
            current = list(items)
            if state["tracked_id"] is None:
                state["tracked_id"] = id(items)
                state["root"] = frame
                state["last"] = current
                add_frame(current, [], "Start: your code made this list")
            elif current != state["last"]:
                changed = [i for i in range(len(current)) if current[i] != state["last"][i]]
                add_frame(current, changed, describe(changed, state["last"], current))
                state["last"] = current
        if event == "return" and frame is state["root"]:
            state["done"] = True
    return items_local


def merge_call(frame):
    values = frame.f_locals.get("values")
    if not is_number_list(values):
        return False
    stack = state["stack"]
    if not stack:
        if state["array"] is not None:
            return False
        state["array"] = list(values)
        add_frame(values, [], "Start: your code was given this list")
        start = 0
    else:
        parent = stack[-1]
        if parent["children"] == 0:
            start = parent["start"]
            parent["left_length"] = len(values)
        else:
            start = parent["start"] + parent["left_length"]
        parent["children"] += 1
    stack.append({"start": start, "length": len(values), "children": 0, "left_length": 0})
    return True


def merge_local(frame, event, arg):
    if state["done"]:
        return None
    if event == "return" and state["stack"]:
        entry = state["stack"].pop()
        if isinstance(arg, list) and len(arg) == entry["length"] and entry["length"] > 1:
            array = state["array"]
            for offset, value in enumerate(arg):
                position = entry["start"] + offset
                array[position] = value
                add_frame(array, [position], "Merged: your code put %s at position %d" % (value, position))
        if not state["stack"]:
            state["done"] = True
    return merge_local


def global_trace(frame, event, arg):
    if state["done"] or frame.f_code.co_filename != USER_FILE:
        return None
    if MODE == "merge":
        if frame.f_code.co_name == "merge_sort" and merge_call(frame):
            return merge_local
        return None
    return items_local


try:
    sys.settrace(global_trace)
    runpy.run_path(USER_FILE, run_name="__main__")
finally:
    sys.settrace(None)

if frames:
    final = frames[-1]["values"]
    count = len(final)
    last_change = [0] * count
    for k in range(1, len(frames)):
        for i in range(count):
            if frames[k]["values"][i] != frames[k - 1]["values"][i]:
                last_change[i] = k
    for k, frame_record in enumerate(frames):
        if k > 0:
            frame_record["settled"] = [i for i in range(count) if k >= last_change[i] and frame_record["values"][i] == final[i]]
    is_sorted = all(final[i] <= final[i + 1] for i in range(count - 1))
    add_frame(final, [], "Your code finished: the list is sorted" if is_sorted else "Your code finished, but the list is not sorted")
    frames[-1]["settled"] = list(range(count)) if is_sorted else []

sys.stdout.write("\\n${TRACE_MARKER}" + json.dumps(frames) + "\\n")
`
}

/** Returns the recorded frames, or null when the run produced none (error, wrong function names, etc.). */
export function parseTraceOutput(stdout: string): SortFrame[] | null {
  const line = stdout.split('\n').reverse().find((candidate) => candidate.startsWith(TRACE_MARKER))
  if (!line) return null
  try {
    const frames = JSON.parse(line.slice(TRACE_MARKER.length)) as SortFrame[]
    return frames.length >= 2 ? frames : null
  } catch {
    return null
  }
}
