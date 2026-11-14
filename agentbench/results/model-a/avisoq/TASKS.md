# Tasks: Avisoq

Write one file per task in `agentbench/work/avisoq/solutions/`, named `<task id>.avq`.
Each file must define the function with exactly the signature shown. It may define helper functions and import from the standard library. It must not define `main`. The function is tested against hidden inputs, including edge cases, so follow the statement exactly.

## sum_digits

Return the sum of the decimal digits of n. The sign is ignored, so -908 gives 17.

```
fn sum_digits(n: Int) -> Int
```

## is_palindrome

Return true if s reads the same forwards and backwards. The comparison is exact (case-sensitive, spaces count). The empty string is a palindrome.

```
fn is_palindrome(s: Str) -> Bool
```

## count_vowels

Return how many characters of s are vowels: a, e, i, o, u in upper or lower case.

```
fn count_vowels(s: Str) -> Int
```

## gcd

Return the greatest common divisor of a and b. Signs are ignored, so the result is never negative. gcd(0, 0) is 0 and gcd(0, n) is the absolute value of n.

```
fn gcd(a: Int, b: Int) -> Int
```

## nth_prime

Return the k-th prime number, counting from 1: nth_prime(1) is 2, nth_prime(2) is 3. k is at least 1 and at most 2000.

```
fn nth_prime(k: Int) -> Int
```

## reverse_words

The words of s are separated by single spaces, with no leading or trailing space. Return the words in reverse order, separated by single spaces. The empty string gives the empty string.

```
fn reverse_words(s: Str) -> Str
```

## max_subarray

Return the largest sum of a non-empty run of consecutive elements of xs. If xs is empty return 0.

```
fn max_subarray(xs: [Int]) -> Int
```

## binary_search

xs is sorted in increasing order with no duplicates. Return the index of target in xs, or -1 if it is not there.

```
fn binary_search(xs: [Int], target: Int) -> Int
```

## run_length

Run-length encode s: each run of the same character becomes that character followed by the length of the run. "aaabcc" gives "a3b1c2". The empty string gives the empty string.

```
fn run_length(s: Str) -> Str
```

## balanced

Return true if the brackets in s are balanced. The brackets are ( ) [ ] { }. Every other character is ignored. Brackets must close in the right order with the right kind.

```
fn balanced(s: Str) -> Bool
```

## merge_sorted

a and b are each sorted in non-decreasing order. Return one array with all elements of both, sorted in non-decreasing order. Duplicates are kept.

```
fn merge_sorted(a: [Int], b: [Int]) -> [Int]
```

## two_sum

Find two different positions i < j with xs[i] + xs[j] == target. Return [i, j] for the pair with the smallest i, and among those the smallest j. If there is no such pair return an empty array.

```
fn two_sum(xs: [Int], target: Int) -> [Int]
```

## collatz_steps

n is at least 1. Count the steps to reach 1 when an even number is halved and an odd number n becomes 3n + 1. collatz_steps(1) is 0.

```
fn collatz_steps(n: Int) -> Int
```

## midpoint

Return the integer halfway between a and b, rounded down (toward negative infinity) when the exact midpoint is not a whole number. a and b can be any 64-bit signed integers, including very large ones.

```
fn midpoint(a: Int, b: Int) -> Int
```

## caesar

Shift every letter of s forward by k places in the alphabet, wrapping around from z to a. k can be any integer, including negative values and values larger than 26. Upper case stays upper case, lower case stays lower case, and every other character is unchanged.

```
fn caesar(s: Str, k: Int) -> Str
```

## most_frequent

xs is not empty. Return the value that occurs most often. If several values tie, return the smallest of them.

```
fn most_frequent(xs: [Int]) -> Int
```

## dedupe

Return xs with duplicates removed, keeping the first occurrence of each value and the original order.

```
fn dedupe(xs: [Int]) -> [Int]
```

## to_roman

n is between 1 and 3999. Return n as a Roman numeral in standard form (for example 4 is IV, 9 is IX, 40 is XL, 1994 is MCMXCIV).

```
fn to_roman(n: Int) -> Str
```

## csv_sum

s holds integers separated by commas. Each integer may have spaces around it and may start with a minus sign. Fields that are empty or contain only spaces count as 0. Return the sum. The empty string gives 0.

```
fn csv_sum(s: Str) -> Int
```

## common_prefix

Return the longest string that both a and b start with. It may be empty.

```
fn common_prefix(a: Str, b: Str) -> Str
```

## pow_mod

Return base raised to the power exp, modulo m. base is at least 0, exp is at least 0, and m is between 1 and 2000000000. exp can be as large as 1000000000000, so the power itself is far too large to compute directly.

```
fn pow_mod(base: Int, exp: Int, m: Int) -> Int
```

## rotate_left

Return xs rotated left by k positions: the first k elements move to the end. k is at least 0 and may be larger than the length of xs. An empty array stays empty.

```
fn rotate_left(xs: [Int], k: Int) -> [Int]
```

## fib_mod

Return the n-th Fibonacci number modulo 1000000007, where fib(0) is 0 and fib(1) is 1. n is between 0 and 1000000.

```
fn fib_mod(n: Int) -> Int
```

## count_primes_below

Return how many prime numbers are strictly less than n. n is between 0 and 200000.

```
fn count_primes_below(n: Int) -> Int
```

