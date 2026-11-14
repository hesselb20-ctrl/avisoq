use std::time::Instant;

fn fib(n: i64) -> i64 {
    if n < 2 { return n; }
    fib(n - 1) + fib(n - 2)
}

fn count_primes(n: usize) -> i64 {
    let mut composite = vec![false; n + 1];
    let mut count = 0i64;
    for i in 2..=n {
        if !composite[i] {
            count += 1;
            let mut j = i * i;
            while j <= n {
                composite[j] = true;
                j += i;
            }
        }
    }
    count
}

fn mandel(size: i64, max_iter: i64) -> i64 {
    let mut total = 0i64;
    for py in 0..size {
        for px in 0..size {
            let cx = px as f64 / size as f64 * 3.0 - 2.0;
            let cy = py as f64 / size as f64 * 2.0 - 1.0;
            let (mut x, mut y, mut i) = (0.0f64, 0.0f64, 0i64);
            while i < max_iter && x * x + y * y <= 4.0 {
                let t = x * x - y * y + cx;
                y = 2.0 * x * y + cy;
                x = t;
                i += 1;
            }
            total += i;
        }
    }
    total
}

fn collatz(limit: i64) -> i64 {
    let mut total = 0i64;
    for n in 1..limit {
        let mut x = n;
        while x != 1 {
            if x % 2 == 0 { x /= 2; } else { x = 3 * x + 1; }
            total += 1;
        }
    }
    total
}

fn main() {
    let name = std::env::args().nth(1).expect("benchmark name");
    // black_box keeps the optimiser from folding the constant inputs away.
    let bb = std::hint::black_box::<i64>;
    let t0 = Instant::now();
    let r = match name.as_str() {
        "fib" => fib(bb(38)),
        "sieve" => count_primes(bb(20000000) as usize),
        "mandel" => mandel(bb(800), bb(300)),
        "collatz" => collatz(bb(1000000)),
        _ => panic!("unknown benchmark"),
    };
    println!("{} {} {}", name, r, t0.elapsed().as_secs_f64() * 1000.0);
}
