import type { Component } from 'vue'
import BigOVisualizer from '../visualizers/panels/BigOVisualizer.vue'
import BinarySearchVisualizer from '../visualizers/panels/BinarySearchVisualizer.vue'
import GridSearchVisualizer from '../visualizers/panels/GridSearchVisualizer.vue'
import LinkedListVisualizer from '../visualizers/panels/LinkedListVisualizer.vue'
import RecursionVisualizer from '../visualizers/panels/RecursionVisualizer.vue'
import SortingVisualizer from '../visualizers/panels/SortingVisualizer.vue'
import StackQueueVisualizer from '../visualizers/panels/StackQueueVisualizer.vue'

export interface LabCourse {
  id: string
  group: 'Sorting' | 'Visualizers'
  title: string
  tagline: string
  visualizer: Component
  visualizerProps?: Record<string, unknown>
  /** The code the student types, ten lines at a time. */
  code: string
  /** What the finished file prints, used for the tests and shown after Run. */
  expectedOutput: string
}

export const LAB_COURSES: LabCourse[] = [
  {
    id: 'sort-bubble', group: 'Sorting', title: 'Bubble sort', tagline: 'Swap neighbours until nothing moves',
    visualizer: SortingVisualizer, visualizerProps: { fixedAlgorithm: 'bubble' },
    code: `def bubble_sort(values):
    items = list(values)
    count = len(items)
    for end in range(count - 1, 0, -1):
        swapped = False
        for i in range(end):
            if items[i] > items[i + 1]:
                items[i], items[i + 1] = items[i + 1], items[i]
                swapped = True
        if not swapped:
            break
    return items


print(bubble_sort([5, 2, 9, 1, 7]))
print(bubble_sort([]))
`,
    expectedOutput: '[1, 2, 5, 7, 9]\n[]\n',
  },
  {
    id: 'sort-insertion', group: 'Sorting', title: 'Insertion sort', tagline: 'Slide each item left into place',
    visualizer: SortingVisualizer, visualizerProps: { fixedAlgorithm: 'insertion' },
    code: `def insertion_sort(values):
    items = list(values)
    for current in range(1, len(items)):
        item = items[current]
        index = current
        while index > 0 and items[index - 1] > item:
            items[index] = items[index - 1]
            index -= 1
        items[index] = item
    return items


print(insertion_sort([5, 2, 9, 1, 7]))
print(insertion_sort([3, 3, 1]))
`,
    expectedOutput: '[1, 2, 5, 7, 9]\n[1, 3, 3]\n',
  },
  {
    id: 'sort-selection', group: 'Sorting', title: 'Selection sort', tagline: 'Pick the smallest, put it first',
    visualizer: SortingVisualizer, visualizerProps: { fixedAlgorithm: 'selection' },
    code: `def selection_sort(values):
    items = list(values)
    for start in range(len(items) - 1):
        smallest = start
        for i in range(start + 1, len(items)):
            if items[i] < items[smallest]:
                smallest = i
        if smallest != start:
            items[start], items[smallest] = items[smallest], items[start]
    return items


print(selection_sort([5, 2, 9, 1, 7]))
print(selection_sort([2, 1]))
`,
    expectedOutput: '[1, 2, 5, 7, 9]\n[1, 2]\n',
  },
  {
    id: 'sort-quick', group: 'Sorting', title: 'Quick sort', tagline: 'Partition around a pivot, recurse on both sides',
    visualizer: SortingVisualizer, visualizerProps: { fixedAlgorithm: 'quick' },
    code: `def quick_sort(values):
    items = list(values)
    sort_range(items, 0, len(items) - 1)
    return items


def sort_range(items, low, high):
    if low >= high:
        return
    pivot = items[high]
    boundary = low
    for i in range(low, high):
        if items[i] < pivot:
            items[i], items[boundary] = items[boundary], items[i]
            boundary += 1
    items[boundary], items[high] = items[high], items[boundary]
    sort_range(items, low, boundary - 1)
    sort_range(items, boundary + 1, high)


print(quick_sort([5, 2, 9, 1, 7, 2]))
print(quick_sort([]))
`,
    expectedOutput: '[1, 2, 2, 5, 7, 9]\n[]\n',
  },
  {
    id: 'sort-merge', group: 'Sorting', title: 'Merge sort', tagline: 'Split in half, then merge sorted halves',
    visualizer: SortingVisualizer, visualizerProps: { fixedAlgorithm: 'merge' },
    code: `def merge_sort(values):
    if len(values) <= 1:
        return list(values)
    middle = len(values) // 2
    left = merge_sort(values[:middle])
    right = merge_sort(values[middle:])
    return merge(left, right)


def merge(left, right):
    merged = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            merged.append(left[i])
            i += 1
        else:
            merged.append(right[j])
            j += 1
    return merged + left[i:] + right[j:]


print(merge_sort([5, 2, 9, 1, 7, 2]))
print(merge_sort([4]))
`,
    expectedOutput: '[1, 2, 2, 5, 7, 9]\n[4]\n',
  },
  {
    id: 'binary-search', group: 'Visualizers', title: 'Binary search', tagline: 'Halve a sorted list on every step',
    visualizer: BinarySearchVisualizer,
    code: `def binary_search(sorted_values, target):
    low = 0
    high = len(sorted_values) - 1
    while low <= high:
        middle = (low + high) // 2
        if sorted_values[middle] == target:
            return middle
        if sorted_values[middle] < target:
            low = middle + 1
        else:
            high = middle - 1
    return -1


numbers = [2, 5, 8, 11, 14, 17, 20]
print(binary_search(numbers, 14))
print(binary_search(numbers, 6))
`,
    expectedOutput: '4\n-1\n',
  },
  {
    id: 'search-bfs', group: 'Visualizers', title: 'Pathfinding: BFS', tagline: 'A queue explores in rings, so paths are shortest',
    visualizer: GridSearchVisualizer, visualizerProps: { fixedKind: 'bfs' },
    code: `from collections import deque


def bfs(grid, start, goal):
    rows, columns = len(grid), len(grid[0])
    waiting = deque([start])
    came_from = {start: None}
    while waiting:
        current = waiting.popleft()
        if current == goal:
            path = []
            while current is not None:
                path.append(current)
                current = came_from[current]
            return path[::-1]
        row, column = current
        for r, c in ((row - 1, column), (row, column + 1), (row + 1, column), (row, column - 1)):
            if 0 <= r < rows and 0 <= c < columns:
                if grid[r][c] != "#" and (r, c) not in came_from:
                    came_from[(r, c)] = current
                    waiting.append((r, c))
    return None


maze = ["S..#", ".#..", "...G"]
print(len(bfs(maze, (0, 0), (2, 3))) - 1)
`,
    expectedOutput: '5\n',
  },
  {
    id: 'search-dfs', group: 'Visualizers', title: 'Pathfinding: DFS', tagline: 'A stack dives deep, then backs up',
    visualizer: GridSearchVisualizer, visualizerProps: { fixedKind: 'dfs' },
    code: `def dfs(grid, start, goal):
    rows, columns = len(grid), len(grid[0])
    waiting = [start]
    came_from = {start: None}
    while waiting:
        current = waiting.pop()
        if current == goal:
            path = []
            while current is not None:
                path.append(current)
                current = came_from[current]
            return path[::-1]
        row, column = current
        for r, c in ((row - 1, column), (row, column + 1), (row + 1, column), (row, column - 1)):
            if 0 <= r < rows and 0 <= c < columns:
                if grid[r][c] != "#" and (r, c) not in came_from:
                    came_from[(r, c)] = current
                    waiting.append((r, c))
    return None


maze = ["S..#", ".#..", "...G"]
print(dfs(maze, (0, 0), (2, 3)) is not None)
`,
    expectedOutput: 'True\n',
  },
  {
    id: 'recursion-fib', group: 'Visualizers', title: 'Recursion: Fibonacci', tagline: 'A function that calls itself, and counts the calls',
    visualizer: RecursionVisualizer,
    code: `calls = 0


def fib(n):
    global calls
    calls += 1
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)


print(fib(7))
print(calls)
`,
    expectedOutput: '13\n41\n',
  },
  {
    id: 'stack-queue', group: 'Visualizers', title: 'Stack and queue', tagline: 'Match brackets with a stack, serve a line with a queue',
    visualizer: StackQueueVisualizer,
    code: `from collections import deque


def brackets_balanced(text):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for character in text:
        if character in "([{":
            stack.append(character)
        elif character in pairs:
            if not stack or stack.pop() != pairs[character]:
                return False
    return not stack


print(brackets_balanced("{[()]}"))
print(brackets_balanced("{[(])}"))
line = deque()
line.append("Ada")
line.append("Linus")
print(line.popleft())
`,
    expectedOutput: 'True\nFalse\nAda\n',
  },
  {
    id: 'linked-list', group: 'Visualizers', title: 'Linked list', tagline: 'Nodes that point to the next node',
    visualizer: LinkedListVisualizer,
    code: `class Node:
    def __init__(self, value, next_node=None):
        self.value = value
        self.next = next_node


def prepend(head, value):
    return Node(value, head)


def reverse(head):
    previous = None
    current = head
    while current is not None:
        following = current.next
        current.next = previous
        previous = current
        current = following
    return previous


def to_list(head):
    items = []
    while head is not None:
        items.append(head.value)
        head = head.next
    return items


chain = prepend(prepend(prepend(None, 3), 2), 1)
print(to_list(chain))
print(to_list(reverse(chain)))
`,
    expectedOutput: '[1, 2, 3]\n[3, 2, 1]\n',
  },
  {
    id: 'big-o', group: 'Visualizers', title: 'Big-O: duplicates', tagline: 'The same question at O(n^2) and O(n)',
    visualizer: BigOVisualizer,
    code: `def has_duplicate_slow(values):
    for i in range(len(values)):
        for j in range(i + 1, len(values)):
            if values[i] == values[j]:
                return True
    return False


def has_duplicate_fast(values):
    seen = set()
    for value in values:
        if value in seen:
            return True
        seen.add(value)
    return False


data = [4, 8, 15, 16, 23, 8]
print(has_duplicate_slow(data))
print(has_duplicate_fast(data))
`,
    expectedOutput: 'True\nTrue\n',
  },
]

export const findCourse = (courseId: string): LabCourse | undefined => LAB_COURSES.find((course) => course.id === courseId)
