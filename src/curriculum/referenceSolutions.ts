/**
 * Reference answers. Two jobs: the curriculum tests use them to prove each project is solvable, and the
 * Solution window shows them after three failed checks. They are written to teach, so every function,
 * variable and block says WHAT it does, WHY it is written that way, and HOW it works.
 */
export const REFERENCE_SOLUTIONS: Record<string, string> = {
  'hello-realm': `
def greet(name):
    # WHAT: build the greeting text and hand it back to whoever called us.
    # WHY return and not print: the tests (and any other code) need the text as a value;
    #      print() only shows it on screen and gives back None.
    # HOW: an f-string (the f before the quote) drops the value of name into the {braces}.
    return f"Hello, {name}!"


def realm_banner(level):
    # WHAT: make a banner like "== LEVEL 3 ==" for a number.
    # WHY an f-string: level is a number, and joining a number to text with + would raise a TypeError;
    #      an f-string converts it to text for us.
    # HOW: the literal characters stay as written, {level} is replaced by the value.
    return f"== LEVEL {level} =="


def is_adult(age):
    # WHAT: answer True when age is 18 or more, otherwise False.
    # WHY no if/else: a comparison such as age >= 18 already evaluates to True or False,
    #      so returning it directly is the shortest correct answer.
    # HOW: >= means "greater than or equal", so exactly 18 counts as an adult (the edge case the tests check).
    return age >= 18
`,
  'number-forge': `
def average(numbers):
    # WHAT: the mean of a list, or 0 when the list is empty.
    # WHY the "if numbers" guard: dividing by len([]) which is 0 would crash with ZeroDivisionError.
    #      An empty list is falsy in Python, so "if numbers" is True only when there is something in it.
    # HOW: sum() adds every item, len() counts them, and / divides (always giving a float result).
    return sum(numbers) / len(numbers) if numbers else 0


def clamp(value, low, high):
    # WHAT: force value into the range low..high.
    # WHY min then max: min(value, high) stops it going above high,
    #      then max(low, ...) stops it going below low. Together they pin it inside the range.
    # HOW: an in-range value passes through both untouched.
    return max(low, min(value, high))


def celsius_to_fahrenheit(celsius):
    # WHAT: convert a temperature from Celsius to Fahrenheit.
    # WHY this formula: Fahrenheit degrees are smaller (9/5 as many) and the scale starts 32 higher.
    # HOW: multiply first, then divide by 5, then add 32. Check it: -40 gives -40 in both scales.
    return celsius * 9 / 5 + 32
`,
  'loop-lab': `
def count_evens(numbers):
    # WHAT: how many numbers in the list are even.
    # WHY value % 2 == 0: % is the remainder after division, and an even number leaves remainder 0.
    # HOW: the generator "1 for ... if ..." produces a 1 for every even value and skips the others;
    #      sum() adds those 1s up, which is the same as counting them. An empty list gives 0.
    return sum(1 for value in numbers if value % 2 == 0)


def fizzbuzz(n):
    # WHAT: a list for 1..n with "Fizz" (multiples of 3), "Buzz" (multiples of 5),
    #       "FizzBuzz" (both) and the plain number otherwise.
    result = []  # collects the answers one by one, starting empty so fizzbuzz(0) returns []
    for value in range(1, n + 1):  # range stops BEFORE its end, so n + 1 is needed to include n
        if value % 15 == 0:
            # WHY this check is first: a multiple of 15 is a multiple of 3 AND 5.
            #      If we tested 3 first, 15 would wrongly become just "Fizz".
            result.append("FizzBuzz")
        elif value % 3 == 0:
            result.append("Fizz")
        elif value % 5 == 0:
            result.append("Buzz")
        else:
            result.append(value)  # not a multiple of either: keep the number itself
    return result


def sum_of_squares(n):
    # WHAT: 1*1 + 2*2 + ... + n*n.
    # WHY range(1, n + 1): we want to include n, and range excludes its end value.
    # HOW: the generator squares each value and sum() adds the squares; n = 0 gives an empty range, so 0.
    return sum(value * value for value in range(1, n + 1))
`,
  'data-vault': `
def word_count(text):
    # WHAT: a dictionary of how many times each word appears, ignoring upper/lower case.
    counts = {}  # word -> number of times seen so far
    # WHY lower() first: "Go" and "go" should be the same word.
    # HOW split() with no argument cuts on any run of spaces/newlines and drops empty pieces,
    #     so "" gives [] and the loop never runs, which returns {} as required.
    for word in text.lower().split():
        # counts.get(word, 0) is "the current count, or 0 if we have not seen it yet",
        # which avoids a KeyError the first time a word shows up.
        counts[word] = counts.get(word, 0) + 1
    return counts


def most_common_word(text):
    # WHAT: the word that appears most often.
    # WHY reuse word_count: the counting is already solved there, so we do not repeat it.
    counts = word_count(text)
    # HOW: max() over a dict looks at its keys (the words); key=counts.get tells max to compare
    #      them by their counts instead of alphabetically, so the most frequent word wins.
    return max(counts, key=counts.get)


def invert_dict(mapping):
    # WHAT: swap keys and values: {"a": 1} becomes {1: "a"}.
    # HOW: a dict comprehension walks every (key, value) pair from .items()
    #      and builds a new dict with each pair flipped.
    # NOTE: if two keys shared a value, the later one would overwrite the earlier one;
    #       the tests only use unique values.
    return {value: key for key, value in mapping.items()}
`,
  'string-alchemy': `
def is_palindrome(text):
    # WHAT: True when the text reads the same forwards and backwards.
    # WHY clean first: the tests expect "A man, a plan, a canal: Panama" to count,
    #      so only letters and digits matter, and case does not.
    # HOW: keep each character only if isalnum() (letter or digit), and lowercase it.
    cleaned = [character.lower() for character in text if character.isalnum()]
    # cleaned[::-1] is the same list reversed (a slice that steps backwards).
    # Comparing the list with its reverse is the whole palindrome test; an empty list equals its reverse.
    return cleaned == cleaned[::-1]


def reverse_words(sentence):
    # WHAT: "one two three" becomes "three two one".
    # HOW: split() makes a list of words, reversed() walks it backwards,
    #      and " ".join() glues the words back together with single spaces.
    return " ".join(reversed(sentence.split()))


def caesar_shift(text, shift):
    # WHAT: move every letter 'shift' places along the alphabet, wrapping from z back to a.
    shifted = []  # the new characters, built one at a time
    for character in text:
        # WHY isalpha() and isascii(): only the plain letters a-z / A-Z are shifted;
        #     spaces, digits and punctuation must pass through unchanged.
        if character.isalpha() and character.isascii():
            # base is where this letter's alphabet starts: "A" (65) for capitals, "a" (97) for lower case.
            # WHY: it keeps upper case upper and lower case lower.
            base = ord("A") if character.isupper() else ord("a")
            # HOW: ord() turns the letter into a number. Subtracting base makes a=0 ... z=25.
            #      Adding the shift moves it. % 26 wraps it around (and also handles negative shifts,
            #      because Python's % always gives a result from 0 to 25). Adding base turns the
            #      position back into a character code, and chr() makes it a letter again.
            shifted.append(chr((ord(character) - base + shift) % 26 + base))
        else:
            shifted.append(character)  # not a letter: keep it exactly as it was
    return "".join(shifted)  # turn the list of characters back into one string
`,
}

/** Sample calls shown beside the solution so the expected results are visible, one list per project. */
export const SOLUTION_EXAMPLES: Record<string, string[]> = {
  'hello-realm': ['greet("Ada")  ->  "Hello, Ada!"', 'realm_banner(3)  ->  "== LEVEL 3 =="', 'is_adult(18)  ->  True', 'is_adult(17)  ->  False'],
  'number-forge': ['average([2, 4, 6])  ->  4.0', 'average([])  ->  0', 'clamp(99, 0, 10)  ->  10', 'celsius_to_fahrenheit(-40)  ->  -40.0'],
  'loop-lab': ['count_evens([1, 2, 3, 4, 6])  ->  3', 'fizzbuzz(5)  ->  [1, 2, "Fizz", 4, "Buzz"]', 'sum_of_squares(3)  ->  14'],
  'data-vault': ['word_count("Go go GO")  ->  {"go": 3}', 'most_common_word("a b b c c c")  ->  "c"', 'invert_dict({"a": 1, "b": 2})  ->  {1: "a", 2: "b"}'],
  'string-alchemy': ['is_palindrome("A man, a plan, a canal: Panama")  ->  True', 'reverse_words("one two three")  ->  "three two one"', 'caesar_shift("Hello, World!", 5)  ->  "Mjqqt, Btwqi!"'],
}
