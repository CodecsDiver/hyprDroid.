import type { Component } from 'vue'
import type { TraceMode } from './traceRunner'
import BigOVisualizer from '../visualizers/panels/BigOVisualizer.vue'
import BinarySearchVisualizer from '../visualizers/panels/BinarySearchVisualizer.vue'
import GridSearchVisualizer from '../visualizers/panels/GridSearchVisualizer.vue'
import LinkedListVisualizer from '../visualizers/panels/LinkedListVisualizer.vue'
import RecursionVisualizer from '../visualizers/panels/RecursionVisualizer.vue'
import DpTableVisualizer from '../visualizers/panels/DpTableVisualizer.vue'
import GraphVisualizer from '../visualizers/panels/GraphVisualizer.vue'
import NQueensVisualizer from '../visualizers/panels/NQueensVisualizer.vue'
import SortingVisualizer from '../visualizers/panels/SortingVisualizer.vue'
import StackQueueVisualizer from '../visualizers/panels/StackQueueVisualizer.vue'

export type LabSection = 'Beginner Deep End' | 'Bigger Algorithms'

export interface LabCourse {
  id: string
  /** The big heading in the course list. Beginner Deep End is where lessons drop you straight into the code. */
  section: LabSection
  group: 'Sorting' | 'Visualizers' | 'Heaps' | 'Graphs and paths' | 'Dynamic programming' | 'Backtracking'
  title: string
  tagline: string
  visualizer: Component
  visualizerProps?: Record<string, unknown>
  /** The code the student types, ten lines at a time. */
  code: string
  /** When set, Run also traces the student's own code and the visualizer plays what it really did. */
  trace?: TraceMode
  /** What the finished file prints, used for the tests and shown after Run. */
  expectedOutput: string
}

export const LAB_COURSES: LabCourse[] = [
  {
    id: 'sort-bubble', section: 'Beginner Deep End', group: 'Sorting', title: 'Bubble sort', tagline: 'Swap neighbours until nothing moves',
    trace: 'items', visualizer: SortingVisualizer, visualizerProps: { fixedAlgorithm: 'bubble' },
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
    id: 'sort-insertion', section: 'Beginner Deep End', group: 'Sorting', title: 'Insertion sort', tagline: 'Slide each item left into place',
    trace: 'items', visualizer: SortingVisualizer, visualizerProps: { fixedAlgorithm: 'insertion' },
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
    id: 'sort-selection', section: 'Beginner Deep End', group: 'Sorting', title: 'Selection sort', tagline: 'Pick the smallest, put it first',
    trace: 'items', visualizer: SortingVisualizer, visualizerProps: { fixedAlgorithm: 'selection' },
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
    id: 'sort-quick', section: 'Beginner Deep End', group: 'Sorting', title: 'Quick sort', tagline: 'Partition around a pivot, recurse on both sides',
    trace: 'items', visualizer: SortingVisualizer, visualizerProps: { fixedAlgorithm: 'quick' },
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
    id: 'sort-merge', section: 'Beginner Deep End', group: 'Sorting', title: 'Merge sort', tagline: 'Split in half, then merge sorted halves',
    trace: 'merge', visualizer: SortingVisualizer, visualizerProps: { fixedAlgorithm: 'merge' },
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
    id: 'binary-search', section: 'Beginner Deep End', group: 'Visualizers', title: 'Binary search', tagline: 'Halve a sorted list on every step',
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
    id: 'search-bfs', section: 'Beginner Deep End', group: 'Visualizers', title: 'Pathfinding: BFS', tagline: 'A queue explores in rings, so paths are shortest',
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
    id: 'search-dfs', section: 'Beginner Deep End', group: 'Visualizers', title: 'Pathfinding: DFS', tagline: 'A stack dives deep, then backs up',
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
    id: 'recursion-fib', section: 'Beginner Deep End', group: 'Visualizers', title: 'Recursion: Fibonacci', tagline: 'A function that calls itself, and counts the calls',
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
    id: 'stack-queue', section: 'Beginner Deep End', group: 'Visualizers', title: 'Stack and queue', tagline: 'Match brackets with a stack, serve a line with a queue',
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
    id: 'linked-list', section: 'Beginner Deep End', group: 'Visualizers', title: 'Linked list', tagline: 'Nodes that point to the next node',
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
    id: 'big-o', section: 'Beginner Deep End', group: 'Visualizers', title: 'Big-O: duplicates', tagline: 'The same question at O(n^2) and O(n)',
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
  {
    id: 'sort-heap', section: 'Bigger Algorithms', group: 'Heaps', title: 'Heap sort', tagline: 'Build a heap, then pull the biggest to the end',
    trace: 'items', visualizer: SortingVisualizer, visualizerProps: { fixedAlgorithm: 'heap' },
    code: `def sift_down(items, start, end):
    root = start
    while True:
        child = 2 * root + 1
        if child > end:
            return
        if child + 1 <= end and items[child] < items[child + 1]:
            child += 1
        if items[root] >= items[child]:
            return
        items[root], items[child] = items[child], items[root]
        root = child


def heap_sort(values):
    items = list(values)
    count = len(items)
    for start in range(count // 2 - 1, -1, -1):
        sift_down(items, start, count - 1)
    for end in range(count - 1, 0, -1):
        items[0], items[end] = items[end], items[0]
        sift_down(items, 0, end - 1)
    return items


print(heap_sort([5, 2, 9, 1, 7, 3]))
print(heap_sort([]))
`,
    expectedOutput: "[1, 2, 3, 5, 7, 9]\n[]\n",
  },
  {
    id: 'search-astar', section: 'Bigger Algorithms', group: 'Graphs and paths', title: 'Pathfinding: A*', tagline: 'A priority queue and a guess head straight for the goal',
    visualizer: GridSearchVisualizer, visualizerProps: { fixedKind: 'astar' },
    code: `import heapq


def a_star(grid, start, goal):
    rows, columns = len(grid), len(grid[0])

    def guess(point):
        return abs(point[0] - goal[0]) + abs(point[1] - goal[1])

    queue = [(guess(start), 0, start)]
    best = {start: 0}
    while queue:
        _, cost, current = heapq.heappop(queue)
        if current == goal:
            return cost
        if cost > best[current]:
            continue
        row, column = current
        for r, c in ((row - 1, column), (row, column + 1), (row + 1, column), (row, column - 1)):
            if 0 <= r < rows and 0 <= c < columns and grid[r][c] != "#":
                new_cost = cost + 1
                if new_cost < best.get((r, c), 10**9):
                    best[(r, c)] = new_cost
                    heapq.heappush(queue, (new_cost + guess((r, c)), new_cost, (r, c)))
    return -1


maze = ["S..#", ".#..", "...G"]
print(a_star(maze, (0, 0), (2, 3)))
print(a_star(["S#G"], (0, 0), (0, 2)))
`,
    expectedOutput: "5\n-1\n",
  },
  {
    id: 'graph-dijkstra', section: 'Bigger Algorithms', group: 'Graphs and paths', title: 'Dijkstra: shortest roads', tagline: 'Always finish the closest node, then relax its roads',
    visualizer: GraphVisualizer, visualizerProps: { mode: 'dijkstra' },
    code: `import heapq


def dijkstra(graph, source):
    distance = {node: float("inf") for node in graph}
    distance[source] = 0
    queue = [(0, source)]
    while queue:
        cost, node = heapq.heappop(queue)
        if cost > distance[node]:
            continue
        for neighbour, weight in graph[node].items():
            new_cost = cost + weight
            if new_cost < distance[neighbour]:
                distance[neighbour] = new_cost
                heapq.heappush(queue, (new_cost, neighbour))
    return distance


roads = {
    "A": {"B": 4, "C": 2},
    "B": {"C": 1, "D": 5},
    "C": {"D": 8, "E": 10},
    "D": {"E": 2, "F": 6},
    "E": {"F": 3},
    "F": {},
}
print(dijkstra(roads, "A"))
`,
    expectedOutput: "{'A': 0, 'B': 4, 'C': 2, 'D': 9, 'E': 11, 'F': 14}\n",
  },
  {
    id: 'graph-topological', section: 'Bigger Algorithms', group: 'Graphs and paths', title: 'Topological sort', tagline: 'Do tasks only after everything they depend on',
    visualizer: GraphVisualizer, visualizerProps: { mode: 'topo' },
    code: `from collections import deque


def topological_order(graph):
    incoming = {node: 0 for node in graph}
    for node in graph:
        for neighbour in graph[node]:
            incoming[neighbour] += 1
    ready = deque(sorted(node for node in graph if incoming[node] == 0))
    order = []
    while ready:
        node = ready.popleft()
        order.append(node)
        for neighbour in graph[node]:
            incoming[neighbour] -= 1
            if incoming[neighbour] == 0:
                ready.append(neighbour)
    return order if len(order) == len(graph) else None


tasks = {
    "wake": ["shower", "coffee"],
    "shower": ["dress"],
    "coffee": ["leave"],
    "dress": ["leave"],
    "leave": [],
}
print(topological_order(tasks))
print(topological_order({"a": ["b"], "b": ["a"]}))
`,
    expectedOutput: "['wake', 'shower', 'coffee', 'dress', 'leave']\nNone\n",
  },
  {
    id: 'dp-lcs', section: 'Bigger Algorithms', group: 'Dynamic programming', title: 'Longest common subsequence', tagline: 'Fill a table: each cell reuses smaller answers',
    visualizer: DpTableVisualizer, visualizerProps: { kind: 'lcs' },
    code: `def lcs_length(first, second):
    rows, columns = len(first), len(second)
    table = [[0] * (columns + 1) for _ in range(rows + 1)]
    for i in range(1, rows + 1):
        for j in range(1, columns + 1):
            if first[i - 1] == second[j - 1]:
                table[i][j] = table[i - 1][j - 1] + 1
            else:
                table[i][j] = max(table[i - 1][j], table[i][j - 1])
    return table[rows][columns]


print(lcs_length("ABCBDAB", "BDCABA"))
print(lcs_length("kitten", "sitting"))
`,
    expectedOutput: "4\n4\n",
  },
  {
    id: 'dp-knapsack', section: 'Bigger Algorithms', group: 'Dynamic programming', title: 'Knapsack', tagline: 'Take it or leave it: the best value that fits the bag',
    visualizer: DpTableVisualizer, visualizerProps: { kind: 'knapsack' },
    code: `def knapsack(weights, values, capacity):
    best = [0] * (capacity + 1)
    for weight, value in zip(weights, values):
        for room in range(capacity, weight - 1, -1):
            best[room] = max(best[room], best[room - weight] + value)
    return best[capacity]


def knapsack_items(weights, values, capacity):
    count = len(weights)
    table = [[0] * (capacity + 1) for _ in range(count + 1)]
    for i in range(1, count + 1):
        for room in range(capacity + 1):
            table[i][room] = table[i - 1][room]
            if weights[i - 1] <= room:
                take = table[i - 1][room - weights[i - 1]] + values[i - 1]
                table[i][room] = max(table[i][room], take)
    chosen = []
    room = capacity
    for i in range(count, 0, -1):
        if table[i][room] != table[i - 1][room]:
            chosen.append(i - 1)
            room -= weights[i - 1]
    return sorted(chosen)


print(knapsack([1, 3, 4, 5], [1, 4, 5, 7], 7))
print(knapsack([2, 3], [3, 4], 1))
print(knapsack_items([1, 3, 4, 5], [1, 4, 5, 7], 7))
`,
    expectedOutput: "9\n0\n[1, 2]\n",
  },
  {
    id: 'dp-coins', section: 'Bigger Algorithms', group: 'Dynamic programming', title: 'Coin change', tagline: 'The fewest coins for every amount, built from smaller ones',
    visualizer: DpTableVisualizer, visualizerProps: { kind: 'coin' },
    code: `def min_coins(coins, amount):
    best = [0] + [amount + 1] * amount
    for total in range(1, amount + 1):
        for coin in coins:
            if coin <= total:
                best[total] = min(best[total], best[total - coin] + 1)
    return best[amount] if best[amount] <= amount else -1


print(min_coins([1, 5, 6, 9], 11))
print(min_coins([2], 3))
print(min_coins([1, 5, 10, 25], 63))
`,
    expectedOutput: "2\n-1\n6\n",
  },
  {
    id: 'backtrack-queens', section: 'Bigger Algorithms', group: 'Backtracking', title: 'N-Queens', tagline: 'Try, check, undo: backtracking on a chess board',
    visualizer: NQueensVisualizer,
    code: `def solve_queens(size):
    columns = []
    results = []

    def place(row):
        if row == size:
            results.append(list(columns))
            return
        for column in range(size):
            safe = True
            for earlier_row, earlier_column in enumerate(columns):
                same_column = earlier_column == column
                same_diagonal = abs(earlier_column - column) == row - earlier_row
                if same_column or same_diagonal:
                    safe = False
                    break
            if safe:
                columns.append(column)
                place(row + 1)
                columns.pop()

    place(0)
    return results


solutions = solve_queens(6)
print(len(solutions))
print(solutions[0])
`,
    expectedOutput: "4\n[1, 3, 5, 0, 2, 4]\n",
  },
]

export const findCourse = (courseId: string): LabCourse | undefined => LAB_COURSES.find((course) => course.id === courseId)
