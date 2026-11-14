use std::collections::BinaryHeap;
use std::cmp::Reverse;
pub fn shortest_path(n: i64, edges: &[i64]) -> i64 {
    let n = n as usize;
    let mut adj: Vec<Vec<(usize, i64)>> = vec![vec![]; n];
    for e in edges.chunks(3) {
        if e.len() < 3 { break; }
        let (a, b, l) = (e[0] as usize, e[1] as usize, e[2]);
        adj[a].push((b, l)); adj[b].push((a, l));
    }
    let mut dist = vec![i64::MAX; n];
    dist[0] = 0;
    let mut hp = BinaryHeap::new();
    hp.push(Reverse((0i64, 0usize)));
    while let Some(Reverse((d, u))) = hp.pop() {
        if d > dist[u] { continue; }
        for &(v, l) in &adj[u] {
            let nd = d + l;
            if nd < dist[v] { dist[v] = nd; hp.push(Reverse((nd, v))); }
        }
    }
    if dist[n - 1] == i64::MAX { -1 } else { dist[n - 1] }
}
