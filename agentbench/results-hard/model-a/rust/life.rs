use std::collections::HashMap;
pub fn life(cells: &[i64], w: i64, h: i64, steps: i64) -> Vec<i64> {
    let (w, h) = (w as usize, h as usize);
    let mut cur: Vec<i64> = cells.iter().map(|&c| if c != 0 { 1 } else { 0 }).collect();
    let mut seen: HashMap<Vec<i64>, i64> = HashMap::new();
    let mut s = 0i64;
    let mut total = steps;
    let mut cycled = false;
    while s < total {
        if !cycled {
            if let Some(&p) = seen.get(&cur) {
                let period = s - p;
                total = s + (total - s) % period;
                cycled = true;
                if s >= total { break; }
            } else { seen.insert(cur.clone(), s); }
        }
        let mut nx = vec![0i64; w * h];
        for y in 0..h { for x in 0..w {
            let mut c = 0;
            for dy in -1i64..=1 { for dx in -1i64..=1 {
                if dx == 0 && dy == 0 { continue; }
                let (ny, nxx) = (y as i64 + dy, x as i64 + dx);
                if ny >= 0 && ny < h as i64 && nxx >= 0 && nxx < w as i64 { c += cur[ny as usize * w + nxx as usize]; }
            } }
            let alive = cur[y * w + x] == 1;
            nx[y * w + x] = if (alive && (c == 2 || c == 3)) || (!alive && c == 3) { 1 } else { 0 };
        } }
        cur = nx;
        s += 1;
    }
    cur
}
