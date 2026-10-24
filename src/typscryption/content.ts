import type { SkillLevel } from './levels'

/** Guess the next line: a block with one line hidden, the right line and three wrong ones. */
export interface GuessItem {
  id: string
  lines: string[]
  hiddenIndex: number
  distractors: [string, string, string]
}

/** Fix this block: one line is broken. `fixedLine` is what it should say (indentation included). */
export interface FixItem {
  id: string
  lines: string[]
  brokenIndex: number
  fixedLine: string
  hint: string
}

/** Speed coder: a whole block typed line by line. No blank lines, so every line is a typing target. */
export interface SpeedItem {
  id: string
  title: string
  lines: string[]
}

export interface LevelContent {
  guess: GuessItem[]
  fix: FixItem[]
  speed: SpeedItem[]
}

/** Splits a template into lines, dropping the newline right after the opening backtick and before the closing one. */
const L = (block: string): string[] => block.replace(/^\n/, '').replace(/\n$/, '').split('\n')

/**
 * The code is graded by level, not just by length: each level adds a new idea on top of the ones before it.
 * Every item is run in the tests: the right answer must work, and each wrong answer must behave differently.
 */
export const TYPSCRYPTION_CONTENT: Record<SkillLevel, LevelContent> = {
  // ---------------------------------------------------------------- 1 True Beginner: print and variables
  1: {
    guess: [
      { id: 'l1g1', lines: L(`
name = "Sam"
age = 12
print(name)
print(age)`), hiddenIndex: 3, distractors: ['print("age")', 'print age', 'Print(age)'] },
      { id: 'l1g2', lines: L(`
a = 4
b = 5
total = a + b
print(total)`), hiddenIndex: 2, distractors: ['total = a - b', 'total == a + b', 'a + b = total'] },
      { id: 'l1g3', lines: L(`
greeting = "Hello"
name = "Mia"
print(greeting + " " + name)`), hiddenIndex: 2, distractors: ['print(greeting - name)', 'print(greeting name)', 'print("greeting" + "name")'] },
    ],
    fix: [
      { id: 'l1f1', lines: L(`
name = "Ada"
print("Hello world)
print(name)`), brokenIndex: 1, fixedLine: 'print("Hello world")', hint: 'A piece of text needs a quote at both ends.' },
      { id: 'l1f2', lines: L(`
x = 5
y = 3
print(x + y`), brokenIndex: 2, fixedLine: 'print(x + y)', hint: 'Every opening bracket needs a closing one.' },
      { id: 'l1f3', lines: L(`
count = 3
Print(count)`), brokenIndex: 1, fixedLine: 'print(count)', hint: 'Python is picky about capital letters.' },
    ],
    speed: [
      { id: 'l1s1', title: 'Name and age', lines: L(`
name = "Sam"
age = 12
print(name)
print(age)`) },
      { id: 'l1s2', title: 'Fruit basket', lines: L(`
fruit = "apple"
count = 3
print(fruit)
print(count)
print(count + 2)`) },
    ],
  },

  // ---------------------------------------------------------------- 2 Fresh Starter: if / else and f-strings
  2: {
    guess: [
      { id: 'l2g1', lines: L(`
age = 15
if age >= 13:
    print("teen")
else:
    print("kid")`), hiddenIndex: 1, distractors: ['if age => 13:', 'if age = 13:', 'if (age >= 13)'] },
      { id: 'l2g2', lines: L(`
name = "Lee"
score = 90
print(f"{name} scored {score}")`), hiddenIndex: 2, distractors: ['print(f"name scored score")', 'print("{name} scored {score}")', 'print(f"{name} scored {score})'] },
      { id: 'l2g3', lines: L(`
temp = 30
if temp > 25:
    print("hot")
else:
    print("cool")`), hiddenIndex: 3, distractors: ['elif:', 'else temp:', 'otherwise:'] },
    ],
    fix: [
      { id: 'l2f1', lines: L(`
score = 70
if score > 50
    print("pass")`), brokenIndex: 1, fixedLine: 'if score > 50:', hint: 'An if line ends with a colon.' },
      { id: 'l2f2', lines: L(`
x = 5
if x = 5:
    print("five")`), brokenIndex: 1, fixedLine: 'if x == 5:', hint: 'One equals sign stores a value; two ask a question.' },
      { id: 'l2f3', lines: L(`
name = "Bo"
print("Hi {name}")`), brokenIndex: 1, fixedLine: 'print(f"Hi {name}")', hint: 'Text with {braces} to fill in needs an f in front.' },
    ],
    speed: [
      { id: 'l2s1', title: 'Grade check', lines: L(`
score = 72
if score >= 90:
    print("A")
elif score >= 70:
    print("B")
else:
    print("C")`) },
      { id: 'l2s2', title: 'Teen or kid', lines: L(`
name = "Kai"
age = 14
print(f"{name} is {age}")
if age >= 13:
    print("teen")`) },
    ],
  },

  // ---------------------------------------------------------------- 3 Early Beginner: lists and for loops
  3: {
    guess: [
      { id: 'l3g1', lines: L(`
nums = [1, 2, 3]
total = 0
for n in nums:
    total += n
print(total)`), hiddenIndex: 2, distractors: ['for n of nums:', 'for n in nums', 'foreach n in nums:'] },
      { id: 'l3g2', lines: L(`
fruits = ["apple", "pear"]
fruits.append("plum")
print(len(fruits))`), hiddenIndex: 1, distractors: ['fruits.add("plum")', 'fruits.push("plum")', 'fruits + "plum"'] },
      { id: 'l3g3', lines: L(`
total = 0
for i in range(1, 4):
    total += i
print(total)`), hiddenIndex: 1, distractors: ['for i in range(1, 3):', 'for i in range(4, 1):', 'for i in 1..4:'] },
    ],
    fix: [
      { id: 'l3f1', lines: L(`
numbers = [3, 1, 2]
for n in numbers
    print(n)`), brokenIndex: 1, fixedLine: 'for n in numbers:', hint: 'A for line ends with a colon.' },
      { id: 'l3f2', lines: L(`
items = ["a", "b", "c"]
print(items[3])`), brokenIndex: 1, fixedLine: 'print(items[2])', hint: 'Lists count from 0, so the last of three is 2.' },
      { id: 'l3f3', lines: L(`
for i in range(3):
print(i)`), brokenIndex: 1, fixedLine: '    print(i)', hint: 'The lines inside a loop are pushed in by four spaces.' },
    ],
    speed: [
      { id: 'l3s1', title: 'Average score', lines: L(`
scores = [70, 85, 90]
total = 0
for s in scores:
    total += s
average = total / len(scores)
print(average)`) },
      { id: 'l3s2', title: 'Greeting list', lines: L(`
names = ["Ann", "Bo", "Cy"]
for name in names:
    print("Hi " + name)
names.append("Di")
print(len(names))`) },
    ],
  },

  // ---------------------------------------------------------------- 4 Beginner: functions that return
  4: {
    guess: [
      { id: 'l4g1', lines: L(`
def add(a, b):
    return a + b
print(add(2, 3))`), hiddenIndex: 1, distractors: ['    print(a + b)', '    return a, b', '    returns a + b'] },
      { id: 'l4g2', lines: L(`
def square(n):
    return n * n
result = square(4)
print(result)`), hiddenIndex: 2, distractors: ['result = square[4]', 'result = square 4', 'result = square(4'] },
      { id: 'l4g3', lines: L(`
def is_even(n):
    return n % 2 == 0
print(is_even(10))`), hiddenIndex: 1, distractors: ['    return n / 2 == 0', '    return n % 2 = 0', '    return n % 2 === 0'] },
    ],
    fix: [
      { id: 'l4f1', lines: L(`
def double(n):
    n * 2
print(double(4))`), brokenIndex: 1, fixedLine: '    return n * 2', hint: 'A function only hands a value back if you return it.' },
      { id: 'l4f2', lines: L(`
def hello():
    print("hi")
hello`), brokenIndex: 2, fixedLine: 'hello()', hint: 'Calling a function needs brackets after its name.' },
      { id: 'l4f3', lines: L(`
def greet(name):
    return "Hi " + nam
print(greet("Ann"))`), brokenIndex: 1, fixedLine: '    return "Hi " + name', hint: 'Check the spelling of the parameter.' },
    ],
    speed: [
      { id: 'l4s1', title: 'Area maker', lines: L(`
def area(width, height):
    return width * height
print(area(3, 4))
print(area(5, 6))`) },
      { id: 'l4s2', title: 'Adult label', lines: L(`
def is_adult(age):
    return age >= 18
def label(age):
    if is_adult(age):
        return "adult"
    return "minor"
print(label(20))
print(label(12))`) },
    ],
  },

  // ---------------------------------------------------------------- 5 Developing Coder: dicts, string methods, comprehensions
  5: {
    guess: [
      { id: 'l5g1', lines: L(`
ages = {"Ann": 30, "Bo": 25}
ages["Cy"] = 41
print(len(ages))`), hiddenIndex: 1, distractors: ['ages.append("Cy", 41)', 'ages["Cy"] == 41', 'ages.add("Cy": 41)'] },
      { id: 'l5g2', lines: L(`
words = ["a", "bb", "ccc"]
lengths = [len(w) for w in words]
print(lengths)`), hiddenIndex: 1, distractors: ['lengths = [len for w in words]', 'lengths = [len(w) in words]', 'lengths = [len(w) w in words]'] },
      { id: 'l5g3', lines: L(`
text = "hello world"
shout = text.upper()
print(shout)`), hiddenIndex: 1, distractors: ['shout = text.uppercase()', 'shout = text.upper', 'shout = upper(text)'] },
    ],
    fix: [
      { id: 'l5f1', lines: L(`
scores = {"a": 1}
print(scores["b"])`), brokenIndex: 1, fixedLine: 'print(scores.get("b", 0))', hint: 'A missing key crashes with square brackets; .get() gives a fallback.' },
      { id: 'l5f2', lines: L(`
names = ["x", "y"]
for n in names:
    print(n.Upper())`), brokenIndex: 2, fixedLine: '    print(n.upper())', hint: 'Method names are all lower case.' },
      { id: 'l5f3', lines: L(`
squares = [n * n for n in range(4)
print(squares)`), brokenIndex: 0, fixedLine: 'squares = [n * n for n in range(4)]', hint: 'A list comprehension closes with a square bracket.' },
    ],
    speed: [
      { id: 'l5s1', title: 'Inventory total', lines: L(`
inventory = {"apples": 3, "pears": 5}
inventory["plums"] = 7
total = 0
for item, count in inventory.items():
    total += count
print(total)`) },
      { id: 'l5s2', title: 'Word lengths', lines: L(`
words = ["red", "green", "blue"]
lengths = [len(w) for w in words]
print(lengths)
longest = max(words, key=len)
print(longest.upper())`) },
    ],
  },

  // ---------------------------------------------------------------- 6 Improving Coder: while, nested loops, defaults, slices
  6: {
    guess: [
      { id: 'l6g1', lines: L(`
count = 3
while count > 0:
    print(count)
    count -= 1`), hiddenIndex: 3, distractors: ['    count -= 2', '    count =- 1', '    count--'] },
      { id: 'l6g2', lines: L(`
def power(base, exp=2):
    return base ** exp
print(power(3))`), hiddenIndex: 0, distractors: ['def power(base, exp = 2)', 'def power(base=2, exp):', 'def power(base, exp:2):'] },
      { id: 'l6g3', lines: L(`
word = "python"
first = word[:3]
last = word[-3:]
print(first + last)`), hiddenIndex: 2, distractors: ['last = word[3:-]', 'last = word[-3]', 'last = word(-3:)'] },
    ],
    fix: [
      { id: 'l6f1', lines: L(`
for i in range(2):
    for j in range(2):
    print(i, j)`), brokenIndex: 2, fixedLine: '        print(i, j)', hint: 'The inner loop body is pushed in one more level.' },
      { id: 'l6f2', lines: L(`
def greet(name="friend"):
    return "Hi " + name
print(greet)`), brokenIndex: 2, fixedLine: 'print(greet())', hint: 'Naming a function does not run it.' },
      { id: 'l6f3', lines: L(`
# print the first 3 letters
word = "python"
print(word[3])`), brokenIndex: 2, fixedLine: 'print(word[:3])', hint: 'A single index gives one letter; a slice gives a stretch.' },
    ],
    speed: [
      { id: 'l6s1', title: 'Countdown', lines: L(`
def countdown(start):
    while start > 0:
        print(start)
        start -= 1
    print("liftoff")
countdown(3)`) },
      { id: 'l6s2', title: 'Repeat and slice', lines: L(`
def repeat(word, times=2):
    return word * times
print(repeat("ha"))
print(repeat("ho", 3))
text = "adventure"
print(text[:3] + text[-3:])`) },
    ],
  },

  // ---------------------------------------------------------------- 7 Solid Learner: classes, exceptions, sorting keys
  7: {
    guess: [
      { id: 'l7g1', lines: L(`
class Dog:
    def __init__(self, name):
        self.name = name
rex = Dog("Rex")
print(rex.name)`), hiddenIndex: 2, distractors: ['        name = name', '        self.name == name', '        this.name = name'] },
      { id: 'l7g2', lines: L(`
try:
    value = int("abc")
except ValueError:
    value = 0
print(value)`), hiddenIndex: 2, distractors: ['except ValueError', 'catch ValueError:', 'except Value:'] },
      { id: 'l7g3', lines: L(`
people = [("Ann", 30), ("Bo", 25)]
people.sort(key=lambda p: p[1])
print(people[0][0])`), hiddenIndex: 1, distractors: ['people.sort(lambda p: p[1])', 'people.sort(key=p[1])', 'people.sorted(key=lambda p: p[1])'] },
    ],
    fix: [
      { id: 'l7f1', lines: L(`
class Cat:
    def speak():
        return "meow"
print(Cat().speak())`), brokenIndex: 1, fixedLine: '    def speak(self):', hint: 'Methods receive the object as their first parameter.' },
      { id: 'l7f2', lines: L(`
try:
    print(10 / 0)
except ValueError:
    print("bad")`), brokenIndex: 2, fixedLine: 'except ZeroDivisionError:', hint: 'Catch the exception that is actually raised.' },
      { id: 'l7f3', lines: L(`
class P:
    def _init_(self, x):
        self.x = x
print(P(3).x)`), brokenIndex: 1, fixedLine: '    def __init__(self, x):', hint: 'The constructor has two underscores on each side.' },
    ],
    speed: [
      { id: 'l7s1', title: 'Counter class', lines: L(`
class Counter:
    def __init__(self):
        self.value = 0
    def add(self, amount):
        self.value += amount
        return self.value
c = Counter()
c.add(2)
print(c.add(3))`) },
      { id: 'l7s2', title: 'Safe parsing', lines: L(`
def safe_int(text):
    try:
        return int(text)
    except ValueError:
        return 0
print(safe_int("42"))
print(safe_int("nope"))
data = sorted(["pear", "fig", "apple"], key=len)
print(data)`) },
    ],
  },

  // ---------------------------------------------------------------- 8 Strong Learner: enumerate, comprehensions with conditions, recursion
  8: {
    guess: [
      { id: 'l8g1', lines: L(`
names = ["a", "b"]
for i, n in enumerate(names):
    print(i, n)`), hiddenIndex: 1, distractors: ['for i, n in names.enumerate():', 'for i, n in enumerate(names)', 'for i in enumerate names:'] },
      { id: 'l8g2', lines: L(`
nums = range(10)
evens = [n for n in nums if n % 2 == 0]
print(evens)`), hiddenIndex: 1, distractors: ['evens = [n for n in nums if n % 2]', 'evens = [n if n % 2 == 0 for n in nums]', 'evens = [n for n in nums where n % 2 == 0]'] },
      { id: 'l8g3', lines: L(`
def fact(n):
    if n <= 1:
        return 1
    return n * fact(n - 1)
print(fact(5))`), hiddenIndex: 3, distractors: ['    return n * fact(n)', '    return fact(n - 1)', '    return n + fact(n - 1)'] },
    ],
    fix: [
      { id: 'l8f1', lines: L(`
a = [1, 2]
b = [3, 4]
for x, y in zip(a):
    print(x + y)`), brokenIndex: 2, fixedLine: 'for x, y in zip(a, b):', hint: 'zip pairs up two lists, so it needs both.' },
      { id: 'l8f2', lines: L(`
squares = (n * n for n in range(4))
print(squares[1])`), brokenIndex: 0, fixedLine: 'squares = [n * n for n in range(4)]', hint: 'A generator cannot be indexed; a list can.' },
      { id: 'l8f3', lines: L(`
def total(n):
    if n == 0:
        return 1
    return n + total(n - 1)
print(total(3))`), brokenIndex: 2, fixedLine: '        return 0', hint: 'The base case of a sum should add nothing.' },
    ],
    speed: [
      { id: 'l8s1', title: 'Evens and enumerate', lines: L(`
def evens(limit):
    return [n for n in range(limit) if n % 2 == 0]
names = ["ann", "bo"]
for i, name in enumerate(names):
    print(i, name.title())
print(evens(7))`) },
      { id: 'l8s2', title: 'Factorial and zip', lines: L(`
def fact(n):
    if n <= 1:
        return 1
    return n * fact(n - 1)
keys = ["a", "b", "c"]
values = [1, 2, 3]
pairs = dict(zip(keys, values))
print(pairs)
print(fact(4))`) },
    ],
  },

  // ---------------------------------------------------------------- 9 Advancing Learner: closures, dunder methods, decorators
  9: {
    guess: [
      { id: 'l9g1', lines: L(`
def make_adder(n):
    def add(x):
        return x + n
    return add
print(make_adder(3)(4))`), hiddenIndex: 3, distractors: ['    return add()', '    return add(n)', '    return n'] },
      { id: 'l9g2', lines: L(`
class Money:
    def __init__(self, cents):
        self.cents = cents
    def __add__(self, other):
        return Money(self.cents + other.cents)
print((Money(5) + Money(7)).cents)`), hiddenIndex: 4, distractors: ['        return self.cents + other.cents', '        return Money(self.cents) + other.cents', '        return Money(cents + other.cents)'] },
      { id: 'l9g3', lines: L(`
def shout(fn):
    def wrapper():
        return fn().upper()
    return wrapper
@shout
def hi():
    return "hi"
print(hi())`), hiddenIndex: 2, distractors: ['        return fn.upper()', '        return fn().upper', '        return upper(fn())'] },
    ],
    fix: [
      { id: 'l9f1', lines: L(`
class Box:
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False
with Box as b:
    print("inside")`), brokenIndex: 5, fixedLine: 'with Box() as b:', hint: 'A with block needs an object, not the class itself.' },
      { id: 'l9f2', lines: L(`
def twice(fn):
    def wrapper(x):
        return fn(fn(x))
    return wrapper()
@twice
def inc(x):
    return x + 1
print(inc(1))`), brokenIndex: 3, fixedLine: '    return wrapper', hint: 'A decorator hands back the function itself, not its result.' },
      { id: 'l9f3', lines: L(`
class Pt:
    def __init__(self, x):
        self.x = x
    def __str__(self):
        return self.x
print(Pt(3))`), brokenIndex: 4, fixedLine: '        return str(self.x)', hint: '__str__ has to give back text.' },
    ],
    speed: [
      { id: 'l9s1', title: 'Closure counter', lines: L(`
def make_counter():
    count = 0
    def step():
        nonlocal count
        count += 1
        return count
    return step
counter = make_counter()
counter()
print(counter())`) },
      { id: 'l9s2', title: 'Vector maths', lines: L(`
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y
    def __add__(self, other):
        return Vector(self.x + other.x, self.y + other.y)
    def __repr__(self):
        return f"Vector({self.x}, {self.y})"
print(Vector(1, 2) + Vector(3, 4))`) },
    ],
  },
}

export function contentForLevel(level: number): LevelContent {
  return TYPSCRYPTION_CONTENT[Math.min(9, Math.max(1, Math.round(level))) as SkillLevel]
}

/** The leading spaces of a line. */
export const indentOf = (line: string): number => line.length - line.trimStart().length
