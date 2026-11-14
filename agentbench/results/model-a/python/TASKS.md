# Tasks: Python

Write one file per task in `agentbench/work/python/solutions/`, named `<task id>.py`.
Each file must define the function with exactly the signature shown. It may define helper functions and import from the standard library. It must not print anything or run code at import time. The function is tested against hidden inputs, including edge cases, so follow the statement exactly.

## sum_digits

Return the sum of the decimal digits of n. The sign is ignored, so -908 gives 17.

```
def sum_digits(n: int) -> int:
```

## is_palindrome

Return true if s reads the same forwards and backwards. The comparison is exact (case-sensitive, spaces count). The empty string is a palindrome.

```
def is_palindrome(s: str) -> bool:
```

## count_vowels

Return how many characters of s are vowels: a, e, i, o, u in upper or lower case.

```
def count_vowels(s: str) -> int:
```

## gcd

Return the greatest common divisor of a and b. Signs are ignored, so the result is never negative. gcd(0, 0) is 0 and gcd(0, n) is the absolute value of n.

```
def gcd(a: int, b: int) -> int:
```

## nth_prime

Return the k-th prime number, counting from 1: nth_prime(1) is 2, nth_prime(2) is 3. k is at least 1 and at most 2000.

```
def nth_prime(k: int) -> int:
```

## reverse_words

The words of s are separated by single spaces, with no leading or trailing space. Return the words in reverse order, separated by single spaces. The empty string gives the empty string.

```
def reverse_words(s: str) -> str:
```

## max_subarray

Return the largest sum of a non-empty run of consecutive elements of xs. If xs is empty return 0.

```
def max_subarray(xs: list[int]) -> int:
```

## binary_search

xs is sorted in increasing order with no duplicates. Return the index of target in xs, or -1 if it is not there.

```
def binary_search(xs: list[int], target: int) -> int:
```

## run_length

Run-length encode s: each run of the same character becomes that character followed by the length of the run. "aaabcc" gives "a3b1c2". The empty string gives the empty string.

```
def run_length(s: str) -> str:
```

## balanced

Return true if the brackets in s are balanced. The brackets are ( ) [ ] { }. Every other character is ignored. Brackets must close in the right order with the right kind.

```
def balanced(s: str) -> bool:
```

## merge_sorted

a and b are each sorted in non-decreasing order. Return one array with all elements of both, sorted in non-decreasing order. Duplicates are kept.

```
def merge_sorted(a: list[int], b: list[int]) -> list[int]:
```

## two_sum

Find two different positions i < j with xs[i] + xs[j] == target. Return [i, j] for the pair with the smallest i, and among those the smallest j. If there is no such pair return an empty array.

```
def two_sum(xs: list[int], target: int) -> list[int]:
```

## collatz_steps

n is at least 1. Count the steps to reach 1 when an even number is halved and an odd number n becomes 3n + 1. collatz_steps(1) is 0.

```
def collatz_steps(n: int) -> int:
```

## midpoint

Return the integer halfway between a and b, rounded down (toward negative infinity) when the exact midpoint is not a whole number. a and b can be any 64-bit signed integers, including very large ones.

```
def midpoint(a: int, b: int) -> int:
```

## caesar

Shift every letter of s forward by k places in the alphabet, wrapping around from z to a. k can be any integer, including negative values and values larger than 26. Upper case stays upper case, lower case stays lower case, and every other character is unchanged.

```
def caesar(s: str, k: int) -> str:
```

## most_frequent

xs is not empty. Return the value that occurs most often. If several values tie, return the smallest of them.

```
def most_frequent(xs: list[int]) -> int:
```

## dedupe

Return xs with duplicates removed, keeping the first occurrence of each value and the original order.

```
def dedupe(xs: list[int]) -> list[int]:
```

## to_roman

n is between 1 and 3999. Return n as a Roman numeral in standard form (for example 4 is IV, 9 is IX, 40 is XL, 1994 is MCMXCIV).

```
def to_roman(n: int) -> str:
```

## csv_sum

s holds integers separated by commas. Each integer may have spaces around it and may start with a minus sign. Fields that are empty or contain only spaces count as 0. Return the sum. The empty string gives 0.

```
def csv_sum(s: str) -> int:
```

## common_prefix

Return the longest string that both a and b start with. It may be empty.

```
def common_prefix(a: str, b: str) -> str:
```

## pow_mod

Return base raised to the power exp, modulo m. base is at least 0, exp is at least 0, and m is between 1 and 2000000000. exp can be as large as 1000000000000, so the power itself is far too large to compute directly.

```
def pow_mod(base: int, exp: int, m: int) -> int:
```

## rotate_left

Return xs rotated left by k positions: the first k elements move to the end. k is at least 0 and may be larger than the length of xs. An empty array stays empty.

```
def rotate_left(xs: list[int], k: int) -> list[int]:
```

## fib_mod

Return the n-th Fibonacci number modulo 1000000007, where fib(0) is 0 and fib(1) is 1. n is between 0 and 1000000.

```
def fib_mod(n: int) -> int:
```

## count_primes_below

Return how many prime numbers are strictly less than n. n is between 0 and 200000.

```
def count_primes_below(n: int) -> int:
```

