use std::cmp::Reverse;
use std::collections::BinaryHeap;

pub fn toposort(n: i64, edges: &[i64]) -> Vec<i64> {
    let n = if n < 0 { 0 } else { n as usize };
    let mut adj: Vec<Vec<usize>> = Vec::new();
    for _ in 0..n {
        adj.push(Vec::new());
    }
    let mut indeg = vec![0usize; n];
    let mut i = 0usize;
    while i + 1 < edges.len() {
        let a = edges[i] as usize;
        let b = edges[i + 1] as usize;
        adj[a].push(b);
        indeg[b] += 1;
        i += 2;
    }
    let mut heap: BinaryHeap<Reverse<usize>> = BinaryHeap::new();
    for v in 0..n {
        if indeg[v] == 0 {
            heap.push(Reverse(v));
        }
    }
    let mut order: Vec<i64> = Vec::new();
    while let Some(Reverse(u)) = heap.pop() {
        order.push(u as i64);
        for k in 0..adj[u].len() {
            let w = adj[u][k];
            indeg[w] -= 1;
            if indeg[w] == 0 {
                heap.push(Reverse(w));
            }
        }
    }
    if order.len() < n {
        return vec![-1];
    }
    order
}
