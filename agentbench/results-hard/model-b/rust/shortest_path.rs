use std::cmp::Reverse;
use std::collections::BinaryHeap;

pub fn shortest_path(n: i64, edges: &[i64]) -> i64 {
    if n <= 0 {
        return -1;
    }
    let n = n as usize;
    let mut adj: Vec<Vec<(usize, i64)>> = vec![Vec::new(); n];
    for e in edges.chunks_exact(3) {
        let (a, b, l) = (e[0], e[1], e[2]);
        if a < 0 || b < 0 || a as usize >= n || b as usize >= n {
            continue;
        }
        adj[a as usize].push((b as usize, l));
        adj[b as usize].push((a as usize, l));
    }
    let mut dist = vec![i64::MAX; n];
    dist[0] = 0;
    let mut heap = BinaryHeap::new();
    heap.push(Reverse((0i64, 0usize)));
    while let Some(Reverse((d, u))) = heap.pop() {
        if d > dist[u] {
            continue;
        }
        for &(v, l) in &adj[u] {
            let nd = d + l;
            if nd < dist[v] {
                dist[v] = nd;
                heap.push(Reverse((nd, v)));
            }
        }
    }
    if dist[n - 1] == i64::MAX {
        -1
    } else {
        dist[n - 1]
    }
}
