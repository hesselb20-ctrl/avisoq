function fib(n) { return n < 2 ? n : fib(n - 1) + fib(n - 2); }

function countPrimes(n) {
  const composite = new Uint8Array(n + 1);
  let count = 0;
  for (let i = 2; i <= n; i++) {
    if (!composite[i]) {
      count++;
      for (let j = i * i; j <= n; j += i) composite[j] = 1;
    }
  }
  return count;
}

function mandel(size, maxIter) {
  let total = 0;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const cx = px / size * 3.0 - 2.0;
      const cy = py / size * 2.0 - 1.0;
      let x = 0.0, y = 0.0, i = 0;
      while (i < maxIter && x * x + y * y <= 4.0) {
        const t = x * x - y * y + cx;
        y = 2.0 * x * y + cy;
        x = t;
        i++;
      }
      total += i;
    }
  }
  return total;
}

// Plain JS numbers are doubles: exact here because values stay below 2^53.
function collatz(limit) {
  let total = 0;
  for (let n = 1; n < limit; n++) {
    let x = n;
    while (x !== 1) {
      if (x % 2 === 0) x = x / 2; else x = 3 * x + 1;
      total++;
    }
  }
  return total;
}

const BENCH = { fib: () => fib(38), sieve: () => countPrimes(20000000), mandel: () => mandel(800, 300), collatz: () => collatz(1000000) };
const name = process.argv[2];
const t0 = performance.now();
const r = BENCH[name]();
console.log(name, r, performance.now() - t0);
