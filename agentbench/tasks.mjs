// Tasks for the agent benchmark. Each has a plain-language statement, a signature, a reference
// implementation (the source of truth for expected results) and hidden test inputs.
// Types: Int, Bool, Str, [Int]. Strings in tests are plain ASCII.

const big = BigInt;
const isPrime = (n) => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };

export const TASKS = [
  {
    id: 'sum_digits', params: [['n', 'Int']], ret: 'Int',
    desc: 'Return the sum of the decimal digits of n. The sign is ignored, so -908 gives 17.',
    ref: (n) => String(n < 0 ? -n : n).split('').reduce((a, d) => a + Number(d), 0),
    tests: [[0], [7], [12345], [-908], [999999999999], [1000000]],
  },
  {
    id: 'is_palindrome', params: [['s', 'Str']], ret: 'Bool',
    desc: 'Return true if s reads the same forwards and backwards. The comparison is exact (case-sensitive, spaces count). The empty string is a palindrome.',
    ref: (s) => s === s.split('').reverse().join(''),
    tests: [[''], ['a'], ['abba'], ['abcba'], ['abca'], ['Aba'], ['ab ba'], ['ab']],
  },
  {
    id: 'count_vowels', params: [['s', 'Str']], ret: 'Int',
    desc: 'Return how many characters of s are vowels: a, e, i, o, u in upper or lower case.',
    ref: (s) => (s.match(/[aeiou]/gi) ?? []).length,
    tests: [[''], ['xyz'], ['hello world'], ['AEIOU'], ['Programming Language'], ['rhythm']],
  },
  {
    id: 'gcd', params: [['a', 'Int'], ['b', 'Int']], ret: 'Int',
    desc: 'Return the greatest common divisor of a and b. Signs are ignored, so the result is never negative. gcd(0, 0) is 0 and gcd(0, n) is the absolute value of n.',
    ref: (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; },
    tests: [[84, 36], [17, 5], [0, 0], [0, 9], [-12, 18], [100, -75], [1000000007, 998244353], [270, 192]],
  },
  {
    id: 'nth_prime', params: [['k', 'Int']], ret: 'Int',
    desc: 'Return the k-th prime number, counting from 1: nth_prime(1) is 2, nth_prime(2) is 3. k is at least 1 and at most 2000.',
    ref: (k) => { let n = 1; while (k > 0) { n++; if (isPrime(n)) k--; } return n; },
    tests: [[1], [2], [6], [10], [100], [1000], [2000]],
  },
  {
    id: 'reverse_words', params: [['s', 'Str']], ret: 'Str',
    desc: 'The words of s are separated by single spaces, with no leading or trailing space. Return the words in reverse order, separated by single spaces. The empty string gives the empty string.',
    ref: (s) => (s === '' ? '' : s.split(' ').reverse().join(' ')),
    tests: [[''], ['one'], ['hello world'], ['a b c d'], ['the quick brown fox']],
  },
  {
    id: 'max_subarray', params: [['xs', '[Int]']], ret: 'Int',
    desc: 'Return the largest sum of a non-empty run of consecutive elements of xs. If xs is empty return 0.',
    ref: (xs) => { if (!xs.length) return 0; let best = xs[0], cur = xs[0]; for (let i = 1; i < xs.length; i++) { cur = Math.max(xs[i], cur + xs[i]); best = Math.max(best, cur); } return best; },
    tests: [[[]], [[5]], [[-3]], [[-2, -5, -1, -9]], [[1, 2, 3]], [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], [[3, -10, 4, 4]], [[0, 0, -1, 0]]],
  },
  {
    id: 'binary_search', params: [['xs', '[Int]'], ['target', 'Int']], ret: 'Int',
    desc: 'xs is sorted in increasing order with no duplicates. Return the index of target in xs, or -1 if it is not there.',
    ref: (xs, t) => xs.indexOf(t),
    tests: [[[], 3], [[3], 3], [[3], 4], [[1, 3, 5, 7, 9], 1], [[1, 3, 5, 7, 9], 9], [[1, 3, 5, 7, 9], 5], [[1, 3, 5, 7, 9], 4], [[-10, -3, 0, 8], -3], [[2, 4], 5], [[2, 4], 1]],
  },
  {
    id: 'run_length', params: [['s', 'Str']], ret: 'Str',
    desc: 'Run-length encode s: each run of the same character becomes that character followed by the length of the run. "aaabcc" gives "a3b1c2". The empty string gives the empty string.',
    ref: (s) => s.replace(/(.)\1*/g, (m, c) => c + m.length),
    tests: [[''], ['a'], ['aaabcc'], ['abc'], ['zzzzzzzzzzzz'], ['aabbaa']],
  },
  {
    id: 'balanced', params: [['s', 'Str']], ret: 'Bool',
    desc: 'Return true if the brackets in s are balanced. The brackets are ( ) [ ] { }. Every other character is ignored. Brackets must close in the right order with the right kind.',
    ref: (s) => { const st = [], pair = { ')': '(', ']': '[', '}': '{' }; for (const c of s) { if ('([{'.includes(c)) st.push(c); else if (c in pair) { if (st.pop() !== pair[c]) return false; } } return st.length === 0; },
    tests: [[''], ['()'], ['([]{})'], ['(]'], ['(()'], ['())'], ['a(b[c]d)e'], ['{[}]'], ['no brackets'], [']']],
  },
  {
    id: 'merge_sorted', params: [['a', '[Int]'], ['b', '[Int]']], ret: '[Int]',
    desc: 'a and b are each sorted in non-decreasing order. Return one array with all elements of both, sorted in non-decreasing order. Duplicates are kept.',
    ref: (a, b) => [...a, ...b].sort((x, y) => x - y),
    tests: [[[], []], [[1], []], [[], [2]], [[1, 3, 5], [2, 4, 6]], [[1, 1], [1]], [[-5, 0], [-7, 10, 11]], [[1, 2, 3], [4, 5]]],
  },
  {
    id: 'two_sum', params: [['xs', '[Int]'], ['target', 'Int']], ret: '[Int]',
    desc: 'Find two different positions i < j with xs[i] + xs[j] == target. Return [i, j] for the pair with the smallest i, and among those the smallest j. If there is no such pair return an empty array.',
    ref: (xs, t) => { for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) if (xs[i] + xs[j] === t) return [i, j]; return []; },
    tests: [[[], 5], [[5], 5], [[2, 7, 11, 15], 9], [[3, 3], 6], [[1, 2, 3, 4], 8], [[1, 4, 2, 3, 4], 5], [[-1, 0, 1], 0], [[0, 0, 0], 0]],
  },
  {
    id: 'collatz_steps', params: [['n', 'Int']], ret: 'Int',
    desc: 'n is at least 1. Count the steps to reach 1 when an even number is halved and an odd number n becomes 3n + 1. collatz_steps(1) is 0.',
    ref: (n) => { let c = 0; while (n !== 1) { n = n % 2 === 0 ? n / 2 : 3 * n + 1; c++; } return c; },
    tests: [[1], [2], [6], [27], [97], [871], [6171]],
  },
  {
    id: 'midpoint', params: [['a', 'Int'], ['b', 'Int']], ret: 'Int',
    desc: 'Return the integer halfway between a and b, rounded down (toward negative infinity) when the exact midpoint is not a whole number. a and b can be any 64-bit signed integers, including very large ones.',
    ref: (a, b) => { const s = big(a) + big(b); return (s >= 0n ? s / 2n : -((-s + 1n) / 2n)); },
    tests: [[0, 0], [2, 4], [1, 2], [-3, 0], [-1, -2], [7, -7], [9000000000000000000n, 9000000000000000000n], [9223372036854775807n, 9223372036854775805n], [-9000000000000000000n, -9000000000000000001n], [-9223372036854775808n, 9223372036854775807n]],
  },
  {
    id: 'caesar', params: [['s', 'Str'], ['k', 'Int']], ret: 'Str',
    desc: 'Shift every letter of s forward by k places in the alphabet, wrapping around from z to a. k can be any integer, including negative values and values larger than 26. Upper case stays upper case, lower case stays lower case, and every other character is unchanged.',
    ref: (s, k) => s.replace(/[a-z]/gi, (c) => { const base = c <= 'Z' ? 65 : 97; return String.fromCharCode(((c.charCodeAt(0) - base + (k % 26) + 26) % 26) + base); }),
    tests: [['', 3], ['abc', 1], ['xyz', 3], ['Hello, World!', 13], ['abc', -1], ['Zebra', 27], ['mixed Case 123', 52], ['a', -53], ['Az', 25]],
  },
  {
    id: 'most_frequent', params: [['xs', '[Int]']], ret: 'Int',
    desc: 'xs is not empty. Return the value that occurs most often. If several values tie, return the smallest of them.',
    ref: (xs) => { const m = new Map(); for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1); let best = null; for (const [v, c] of m) if (best === null || c > best[1] || (c === best[1] && v < best[0])) best = [v, c]; return best[0]; },
    tests: [[[4]], [[1, 2, 2, 3]], [[3, 1, 3, 1]], [[5, 5, 4, 4, 4]], [[-2, -2, 7, 7]], [[9, 8, 7]], [[0, 0, 1, 1, 0, 1, 2]]],
  },
  {
    id: 'dedupe', params: [['xs', '[Int]']], ret: '[Int]',
    desc: 'Return xs with duplicates removed, keeping the first occurrence of each value and the original order.',
    ref: (xs) => [...new Set(xs)],
    tests: [[[]], [[1]], [[1, 1, 1]], [[3, 1, 3, 2, 1]], [[5, 4, 3]], [[0, -1, 0, -1, 2]]],
  },
  {
    id: 'to_roman', params: [['n', 'Int']], ret: 'Str',
    desc: 'n is between 1 and 3999. Return n as a Roman numeral in standard form (for example 4 is IV, 9 is IX, 40 is XL, 1994 is MCMXCIV).',
    ref: (n) => { const t = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, r] of t) while (n >= v) { s += r; n -= v; } return s; },
    tests: [[1], [4], [9], [14], [40], [90], [400], [1994], [3999], [2024]],
  },
  {
    id: 'csv_sum', params: [['s', 'Str']], ret: 'Int',
    desc: 's holds integers separated by commas. Each integer may have spaces around it and may start with a minus sign. Fields that are empty or contain only spaces count as 0. Return the sum. The empty string gives 0.',
    ref: (s) => s.split(',').reduce((a, f) => a + (f.trim() === '' ? 0 : Number(f.trim())), 0),
    tests: [[''], ['5'], ['1,2,3'], [' 4 , 5 ,6'], ['-3,10'], ['7,,8'], [' , '], ['100, -250, 150'], ['0']],
  },
  {
    id: 'common_prefix', params: [['a', 'Str'], ['b', 'Str']], ret: 'Str',
    desc: 'Return the longest string that both a and b start with. It may be empty.',
    ref: (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return a.slice(0, i); },
    tests: [['', ''], ['abc', ''], ['abc', 'abd'], ['same', 'same'], ['prefix', 'pre'], ['x', 'y'], ['interstellar', 'internet']],
  },
  {
    id: 'pow_mod', params: [['base', 'Int'], ['exp', 'Int'], ['m', 'Int']], ret: 'Int',
    desc: 'Return base raised to the power exp, modulo m. base is at least 0, exp is at least 0, and m is between 1 and 2000000000. exp can be as large as 1000000000000, so the power itself is far too large to compute directly.',
    ref: (b, e, m) => { let r = 1n % big(m), x = big(b) % big(m), k = big(e); while (k > 0n) { if (k & 1n) r = (r * x) % big(m); x = (x * x) % big(m); k >>= 1n; } return r; },
    tests: [[2, 10, 1000], [3, 0, 7], [0, 5, 13], [5, 3, 1], [3, 200, 1000000007], [10, 18, 7], [123456789, 1000000, 998244353], [2, 1000000000000n, 1999999973], [1999999999, 1999999999, 2000000000]],
  },
  {
    id: 'rotate_left', params: [['xs', '[Int]'], ['k', 'Int']], ret: '[Int]',
    desc: 'Return xs rotated left by k positions: the first k elements move to the end. k is at least 0 and may be larger than the length of xs. An empty array stays empty.',
    ref: (xs, k) => { if (!xs.length) return []; const r = k % xs.length; return [...xs.slice(r), ...xs.slice(0, r)]; },
    tests: [[[], 3], [[1], 5], [[1, 2, 3, 4], 0], [[1, 2, 3, 4], 1], [[1, 2, 3, 4], 4], [[1, 2, 3, 4], 6], [[9, 8, 7], 100]],
  },
  {
    id: 'fib_mod', params: [['n', 'Int']], ret: 'Int',
    desc: 'Return the n-th Fibonacci number modulo 1000000007, where fib(0) is 0 and fib(1) is 1. n is between 0 and 1000000.',
    ref: (n) => { let a = 0n, b = 1n; for (let i = 0; i < n; i++) [a, b] = [b, (a + b) % 1000000007n]; return a; },
    tests: [[0], [1], [2], [10], [90], [93], [1000], [1000000]],
  },
  {
    id: 'count_primes_below', params: [['n', 'Int']], ret: 'Int',
    desc: 'Return how many prime numbers are strictly less than n. n is between 0 and 200000.',
    ref: (n) => { let c = 0; for (let i = 2; i < n; i++) if (isPrime(i)) c++; return c; },
    tests: [[0], [1], [2], [3], [10], [100], [7920], [200000]],
  },
];
