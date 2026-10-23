/** Reference answers. Used only by the curriculum tests to prove each project is solvable. */
export const REFERENCE_SOLUTIONS: Record<string, string> = {
  'hello-realm': `
def greet(name):
    return f"Hello, {name}!"


def realm_banner(level):
    return f"== LEVEL {level} =="


def is_adult(age):
    return age >= 18
`,
  'number-forge': `
def average(numbers):
    return sum(numbers) / len(numbers) if numbers else 0


def clamp(value, low, high):
    return max(low, min(value, high))


def celsius_to_fahrenheit(celsius):
    return celsius * 9 / 5 + 32
`,
  'loop-lab': `
def count_evens(numbers):
    return sum(1 for value in numbers if value % 2 == 0)


def fizzbuzz(n):
    result = []
    for value in range(1, n + 1):
        if value % 15 == 0:
            result.append("FizzBuzz")
        elif value % 3 == 0:
            result.append("Fizz")
        elif value % 5 == 0:
            result.append("Buzz")
        else:
            result.append(value)
    return result


def sum_of_squares(n):
    return sum(value * value for value in range(1, n + 1))
`,
  'data-vault': `
def word_count(text):
    counts = {}
    for word in text.lower().split():
        counts[word] = counts.get(word, 0) + 1
    return counts


def most_common_word(text):
    counts = word_count(text)
    return max(counts, key=counts.get)


def invert_dict(mapping):
    return {value: key for key, value in mapping.items()}
`,
  'string-alchemy': `
def is_palindrome(text):
    cleaned = [character.lower() for character in text if character.isalnum()]
    return cleaned == cleaned[::-1]


def reverse_words(sentence):
    return " ".join(reversed(sentence.split()))


def caesar_shift(text, shift):
    shifted = []
    for character in text:
        if character.isalpha() and character.isascii():
            base = ord("A") if character.isupper() else ord("a")
            shifted.append(chr((ord(character) - base + shift) % 26 + base))
        else:
            shifted.append(character)
    return "".join(shifted)
`,
}
