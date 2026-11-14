pub fn life(cells: &[i64], w: i64, h: i64, steps: i64) -> Vec<i64> {
    let w = w as usize;
    let h = h as usize;
    let mut g: Vec<i64> = cells.iter().map(|&x| if x != 0 { 1 } else { 0 }).collect();
    for _ in 0..steps {
        let mut next = vec![0i64; w * h];
        for y in 0..h {
            for x in 0..w {
                let mut cnt = 0;
                for dy in -1i64..=1 {
                    for dx in -1i64..=1 {
                        if dx == 0 && dy == 0 {
                            continue;
                        }
                        let ny = y as i64 + dy;
                        let nx = x as i64 + dx;
                        if ny >= 0 && nx >= 0 && (ny as usize) < h && (nx as usize) < w {
                            cnt += g[ny as usize * w + nx as usize];
                        }
                    }
                }
                let alive = g[y * w + x] == 1;
                next[y * w + x] = if (alive && (cnt == 2 || cnt == 3)) || (!alive && cnt == 3) {
                    1
                } else {
                    0
                };
            }
        }
        g = next;
    }
    g
}
