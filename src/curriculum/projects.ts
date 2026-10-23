import type { Project } from './types'

export const MAIN_FILE_NAME = 'main.py'

export const PROJECTS: Project[] = [
  {
    id: 'hello-realm',
    title: 'Hello, Realm',
    tagline: 'Your first three functions',
    difficulty: 1,
    summary: 'Functions, return values, f-strings and comparisons. Every line is yours: no autocomplete.',
    objectives: [
      { id: 'greet', title: 'greet(name) returns a greeting', hint: 'greet("Ada") must return exactly "Hello, Ada!". Return it, do not print it.' },
      { id: 'banner', title: 'realm_banner(level) builds a banner', hint: 'realm_banner(3) returns "== LEVEL 3 ==". An f-string makes this one line.' },
      { id: 'adult', title: 'is_adult(age) answers True or False', hint: 'A comparison already evaluates to True or False. 18 counts as an adult.' },
    ],
    starterCode: `# HELLO, REALM
# Write each function so its objective turns green when you press CHECK MY WORK.
#
# 1. greet(name)        -> "Hello, <name>!"
# 2. realm_banner(level) -> "== LEVEL <level> =="
# 3. is_adult(age)      -> True when age is 18 or more, otherwise False


def greet(name):
    pass


def realm_banner(level):
    pass


def is_adult(age):
    pass
`,
    testSource: `
class Tests(StudentTestCase):
    def test_greet(self):
        self.assertEqual(student.greet("Ada"), "Hello, Ada!")
        self.assertEqual(student.greet("Linus"), "Hello, Linus!")

    def test_banner(self):
        self.assertEqual(student.realm_banner(3), "== LEVEL 3 ==")
        self.assertEqual(student.realm_banner(10), "== LEVEL 10 ==")

    def test_adult(self):
        self.assertIs(student.is_adult(18), True)
        self.assertIs(student.is_adult(17), False)
        self.assertIs(student.is_adult(40), True)
`,
  },
  {
    id: 'number-forge',
    title: 'Number Forge',
    tagline: 'Arithmetic that bites back',
    difficulty: 1,
    summary: 'Averages, clamping and unit conversion: arithmetic, edge cases and empty input.',
    objectives: [
      { id: 'average', title: 'average(numbers) of a list', hint: 'sum(...) / len(...). An empty list must return 0, not crash.' },
      { id: 'clamp', title: 'clamp(value, low, high) pins a number', hint: 'Below low gives low, above high gives high, otherwise the value itself.' },
      { id: 'fahrenheit', title: 'celsius_to_fahrenheit(c)', hint: 'F = C * 9 / 5 + 32. -40 is the same in both scales.' },
    ],
    starterCode: `# NUMBER FORGE
#
# 1. average(numbers)            -> the mean; 0 for an empty list
# 2. clamp(value, low, high)     -> value limited to the range low..high
# 3. celsius_to_fahrenheit(c)    -> temperature conversion


def average(numbers):
    pass


def clamp(value, low, high):
    pass


def celsius_to_fahrenheit(celsius):
    pass
`,
    testSource: `
class Tests(StudentTestCase):
    def test_average(self):
        self.assertEqual(student.average([2, 4, 6]), 4)
        self.assertEqual(student.average([1, 2]), 1.5)
        self.assertEqual(student.average([]), 0)

    def test_clamp(self):
        self.assertEqual(student.clamp(5, 0, 10), 5)
        self.assertEqual(student.clamp(-3, 0, 10), 0)
        self.assertEqual(student.clamp(99, 0, 10), 10)

    def test_fahrenheit(self):
        self.assertEqual(student.celsius_to_fahrenheit(0), 32)
        self.assertEqual(student.celsius_to_fahrenheit(100), 212)
        self.assertEqual(student.celsius_to_fahrenheit(-40), -40)
`,
  },
  {
    id: 'loop-lab',
    title: 'Loop Lab',
    tagline: 'Make the machine repeat itself',
    difficulty: 2,
    summary: 'for loops, ranges, conditions and building lists. The classic FizzBuzz gauntlet.',
    objectives: [
      { id: 'count_evens', title: 'count_evens(numbers)', hint: 'Loop through the list and count values where value % 2 == 0.' },
      { id: 'fizzbuzz', title: 'fizzbuzz(n) builds the list 1..n', hint: 'Multiples of 3 become "Fizz", of 5 "Buzz", of both "FizzBuzz". Test the both-case first.' },
      { id: 'squares', title: 'sum_of_squares(n)', hint: '1*1 + 2*2 + ... + n*n. sum_of_squares(3) is 14.' },
    ],
    starterCode: `# LOOP LAB
#
# 1. count_evens(numbers)  -> how many even numbers are in the list
# 2. fizzbuzz(n)           -> list for 1..n: "Fizz" for multiples of 3, "Buzz" for 5,
#                             "FizzBuzz" for both, otherwise the number itself
# 3. sum_of_squares(n)     -> 1*1 + 2*2 + ... + n*n


def count_evens(numbers):
    pass


def fizzbuzz(n):
    pass


def sum_of_squares(n):
    pass
`,
    testSource: `
class Tests(StudentTestCase):
    def test_count_evens(self):
        self.assertEqual(student.count_evens([1, 2, 3, 4, 6]), 3)
        self.assertEqual(student.count_evens([]), 0)
        self.assertEqual(student.count_evens([1, 3]), 0)

    def test_fizzbuzz(self):
        self.assertEqual(student.fizzbuzz(5), [1, 2, "Fizz", 4, "Buzz"])
        self.assertEqual(student.fizzbuzz(15)[-1], "FizzBuzz")
        self.assertEqual(student.fizzbuzz(0), [])

    def test_squares(self):
        self.assertEqual(student.sum_of_squares(3), 14)
        self.assertEqual(student.sum_of_squares(0), 0)
        self.assertEqual(student.sum_of_squares(10), 385)
`,
  },
  {
    id: 'data-vault',
    title: 'Data Vault',
    tagline: 'Dictionaries are power',
    difficulty: 3,
    summary: 'Count, rank and invert data with dictionaries. Case-insensitive words and empty inputs included.',
    objectives: [
      { id: 'word_count', title: 'word_count(text) -> dict', hint: 'Lowercase the text, split() it, and tally each word in a dict. "" gives {}.' },
      { id: 'most_common', title: 'most_common_word(text)', hint: 'Reuse word_count, then pick the key with the largest value (max with key=...).' },
      { id: 'invert', title: 'invert_dict(d) swaps keys and values', hint: 'Build a new dict where each old value becomes a key.' },
    ],
    starterCode: `# DATA VAULT
#
# 1. word_count(text)        -> {"word": times}, lowercase, split on whitespace
# 2. most_common_word(text)  -> the word that appears most often
# 3. invert_dict(d)          -> {value: key} for every pair in d


def word_count(text):
    pass


def most_common_word(text):
    pass


def invert_dict(mapping):
    pass
`,
    testSource: `
class Tests(StudentTestCase):
    def test_word_count(self):
        self.assertEqual(student.word_count("the cat and the hat"), {"the": 2, "cat": 1, "and": 1, "hat": 1})
        self.assertEqual(student.word_count("Go go GO"), {"go": 3})
        self.assertEqual(student.word_count(""), {})

    def test_most_common(self):
        self.assertEqual(student.most_common_word("a b b c c c"), "c")
        self.assertEqual(student.most_common_word("x"), "x")

    def test_invert(self):
        self.assertEqual(student.invert_dict({"a": 1, "b": 2}), {1: "a", 2: "b"})
        self.assertEqual(student.invert_dict({}), {})
`,
  },
  {
    id: 'string-alchemy',
    title: 'String Alchemy',
    tagline: 'Transmute text into anything',
    difficulty: 4,
    summary: 'Palindromes, word reversal and a Caesar cipher: slicing, str methods and character math.',
    objectives: [
      { id: 'palindrome', title: 'is_palindrome(text)', hint: 'Keep only letters and digits (str.isalnum), lowercase them, compare with the reverse.' },
      { id: 'reverse_words', title: 'reverse_words(sentence)', hint: 'split() into words, reverse the list, " ".join() it back.' },
      { id: 'caesar', title: 'caesar_shift(text, shift)', hint: 'Shift letters only, wrap around the alphabet (use %), keep case and leave other characters alone.' },
    ],
    starterCode: `# STRING ALCHEMY
#
# 1. is_palindrome(text)       -> True if text reads the same backwards,
#                                 ignoring case, spaces and punctuation
# 2. reverse_words(sentence)   -> "one two three" becomes "three two one"
# 3. caesar_shift(text, shift) -> shift each letter by 'shift' places, wrapping
#                                 around the alphabet; keep case, ignore non-letters


def is_palindrome(text):
    pass


def reverse_words(sentence):
    pass


def caesar_shift(text, shift):
    pass
`,
    testSource: `
class Tests(StudentTestCase):
    def test_palindrome(self):
        self.assertIs(student.is_palindrome("Racecar"), True)
        self.assertIs(student.is_palindrome("A man, a plan, a canal: Panama"), True)
        self.assertIs(student.is_palindrome("hello"), False)
        self.assertIs(student.is_palindrome(""), True)

    def test_reverse_words(self):
        self.assertEqual(student.reverse_words("one two three"), "three two one")
        self.assertEqual(student.reverse_words("solo"), "solo")

    def test_caesar(self):
        self.assertEqual(student.caesar_shift("abc", 1), "bcd")
        self.assertEqual(student.caesar_shift("xyz", 3), "abc")
        self.assertEqual(student.caesar_shift("Hello, World!", 5), "Mjqqt, Btwqi!")
        self.assertEqual(student.caesar_shift("abc", -1), "zab")
`,
  },
]

export function findProject(projectId: string): Project | undefined {
  return PROJECTS.find((project) => project.id === projectId)
}
