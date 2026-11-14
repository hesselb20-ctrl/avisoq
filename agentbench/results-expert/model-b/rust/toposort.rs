use std::cmp::Reverse;
use std::collections::BinaryHeap;

pub fn toposort(n: i64, edges: &[i64]) -> Vec<i64> {
    let n = if n < 0 { 0 } else { n as usize };
    let mut adj: Vec<Vec<usize>> = vec![Vec::new(); n];
    let mut indeg = vec![0usize; n];
    let mut i = 0;
    while i + 1 < edges.len() {
        let a = edges[i] as usize;
        let b = edges[i + 1] as usize;
        adj[a].push(b);
        indeg[b] += 1;
        i += 2;
    }
    let mut heap = BinaryHeap::new();
    for v in 0..n {
        if indeg[v] == 0 {
            heap.push(Reverse(v));
        }
    }
    let mut order: Vec<i64> = Vec::with_capacity(n);
    while let Some(Reverse(v)) = heap.pop() {
        order.push(v as i64);
        for &w in adj[v].iter() {
            indeg[w] -= 1;
            if indeg[w] == 0 {
                heap.push(Reverse(w));
            }
        }
    }
    if order.len() < n {
        vec![-1]
    } else {
        order
    }
}
