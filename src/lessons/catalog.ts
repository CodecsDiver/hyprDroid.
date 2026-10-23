import type { Component } from 'vue'
import BigOVisualizer from './visualizers/BigOVisualizer.vue'
import BinarySearchVisualizer from './visualizers/BinarySearchVisualizer.vue'
import GridSearchVisualizer from './visualizers/GridSearchVisualizer.vue'
import LinkedListVisualizer from './visualizers/LinkedListVisualizer.vue'
import RecursionVisualizer from './visualizers/RecursionVisualizer.vue'
import SortingVisualizer from './visualizers/SortingVisualizer.vue'
import StackQueueVisualizer from './visualizers/StackQueueVisualizer.vue'

export interface Lesson {
  id: string
  title: string
  tagline: string
  /** What the student must do in the visualizer to earn the "studied" XP. */
  studyGoal: string
  paragraphs: string[]
  pythonSnippet: string
  visualizer: Component
}

export const LESSONS: Lesson[] = [
  {
    id: 'sorting',
    title: 'Sorting Algorithms',
    tagline: 'Watch five ways to put things in order',
    studyGoal: 'Play any sort through to the end.',
    paragraphs: [
      'Sorting is the classic place to feel what "efficiency" means. Bubble, insertion and selection sort do roughly n x n work. Quick sort and merge sort split the problem and do about n x log n.',
      'Switch algorithms on the same data and watch how differently they move. Amber bars are being compared or written; green bars are already in their final position.',
    ],
    pythonSnippet: `def insertion_sort(values):
    for current in range(1, len(values)):
        item = values[current]
        index = current
        while index > 0 and values[index - 1] > item:
            values[index] = values[index - 1]
            index -= 1
        values[index] = item
    return values`,
    visualizer: SortingVisualizer,
  },
  {
    id: 'binary-search',
    title: 'Binary Search',
    tagline: 'Halve the problem on every step',
    studyGoal: 'Run a search until it finds or rules out the target.',
    paragraphs: [
      'If a list is sorted, you never need to look at every item. Check the middle, throw away the half that cannot contain the target, and repeat.',
      'Thirty-one items need at most five comparisons. A million items need twenty. Compare that with a linear scan.',
    ],
    pythonSnippet: `def binary_search(sorted_values, target):
    low, high = 0, len(sorted_values) - 1
    while low <= high:
        middle = (low + high) // 2
        if sorted_values[middle] == target:
            return middle
        if sorted_values[middle] < target:
            low = middle + 1
        else:
            high = middle - 1
    return -1`,
    visualizer: BinarySearchVisualizer,
  },
  {
    id: 'graph-search',
    title: 'Pathfinding: BFS vs DFS',
    tagline: 'Queue or stack: one word changes everything',
    studyGoal: 'Play a search until it reaches the goal (or proves there is no path).',
    paragraphs: [
      'Breadth-first search keeps a queue and explores in rings, so the first path it finds is the shortest. Depth-first search keeps a stack and dives as deep as it can before backing up.',
      'Draw walls, then run both. DFS finds a path quickly, but not necessarily a short one.',
    ],
    pythonSnippet: `from collections import deque

def bfs(grid, start, goal):
    queue = deque([start])
    came_from = {start: None}
    while queue:
        current = queue.popleft()      # DFS would use queue.pop()
        if current == goal:
            break
        for neighbour in grid.neighbours(current):
            if neighbour not in came_from:
                came_from[neighbour] = current
                queue.append(neighbour)
    return came_from`,
    visualizer: GridSearchVisualizer,
  },
  {
    id: 'recursion',
    title: 'Recursion Tree',
    tagline: 'See every call a function makes',
    studyGoal: 'Play a recursion tree through to the final result.',
    paragraphs: [
      'A recursive function solves a problem by calling itself on smaller versions. Every call waits for its children, then combines their answers.',
      'The tree for fib(5) has 15 calls and fib(7) has 41. Many of them compute the same value again. Seeing that waste is the motivation for caching.',
    ],
    pythonSnippet: `def fib(n):
    if n < 2:          # base case: stop recursing
        return n
    return fib(n - 1) + fib(n - 2)

# With memoization the repeated calls disappear:
from functools import lru_cache

@lru_cache(maxsize=None)
def fast_fib(n):
    return n if n < 2 else fast_fib(n - 1) + fast_fib(n - 2)`,
    visualizer: RecursionVisualizer,
  },
  {
    id: 'stack-queue',
    title: 'Stacks and Queues',
    tagline: 'Last in first out, or first in first out',
    studyGoal: 'Perform 8 operations on the stack and queue.',
    paragraphs: [
      'A stack gives back the newest item first, like a pile of plates. A queue gives back the oldest first, like a line at a shop.',
      'Python lists work as stacks (append and pop). For queues use collections.deque, because removing from the front of a list is slow.',
    ],
    pythonSnippet: `stack = []
stack.append(1)
stack.append(2)
stack.pop()        # 2: last in, first out

from collections import deque
queue = deque()
queue.append(1)
queue.append(2)
queue.popleft()    # 1: first in, first out`,
    visualizer: StackQueueVisualizer,
  },
  {
    id: 'linked-list',
    title: 'Linked Lists',
    tagline: 'Nodes that point at the next node',
    studyGoal: 'Perform 7 operations on the list.',
    paragraphs: [
      'Instead of one block of memory, a linked list is a chain: each node stores a value and a reference to the next node. Inserting at the front is instant; finding something means walking the chain.',
      'Python\'s built-in list is an array, not a linked list. Writing your own teaches how references work.',
    ],
    pythonSnippet: `class Node:
    def __init__(self, value, next_node=None):
        self.value = value
        self.next = next_node

def prepend(head, value):
    return Node(value, head)

def find(head, value):
    node = head
    while node is not None:
        if node.value == value:
            return node
        node = node.next
    return None`,
    visualizer: LinkedListVisualizer,
  },
  {
    id: 'big-o',
    title: 'Big-O Growth',
    tagline: 'How fast does the work explode?',
    studyGoal: 'Drag the input size slider several times.',
    paragraphs: [
      'Big-O describes how the amount of work grows as the input grows, ignoring constant factors. It is how you compare algorithms before running them.',
      'Slide the input size and watch the curves separate. Logarithmic and linear stay calm; quadratic and exponential run away.',
    ],
    pythonSnippet: `def contains_duplicate_slow(values):    # O(n^2): compares every pair
    for i in range(len(values)):
        for j in range(i + 1, len(values)):
            if values[i] == values[j]:
                return True
    return False

def contains_duplicate_fast(values):    # O(n): a set remembers what it saw
    seen = set()
    for value in values:
        if value in seen:
            return True
        seen.add(value)
    return False`,
    visualizer: BigOVisualizer,
  },
]
