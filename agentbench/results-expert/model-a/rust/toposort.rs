pub fn toposort(n: i64, edges: &[i64]) -> Vec<i64> {
    let n = n.max(0) as usize;
    let mut adj: Vec<Vec<usize>> = vec![Vec::new(); n];
    let mut indeg = vec![0usize; n];
    let mut i = 0;
    while i + 1 < edges.len() {
        let a = edges[i];
        let b = edges[i + 1];
        i += 2;
        if a < 0 || b < 0 || a as usize >= n || b as usize >= n {
            continue;
        }
        adj[a as usize].push(b as usize);
        indeg[b as usize] += 1;
    }
    let mut heap = std::collections::BinaryHeap::new();
    for v in 0..n {
        if indeg[v] == 0 {
            heap.push(std::cmp::Reverse(v));
        }
    }
    let mut out = Vec::with_capacity(n);
    while let Some(std::cmp::Reverse(v)) = heap.pop() {
        out.push(v as i64);
        for &w in &adj[v] {
            indeg[w] -= 1;
            if indeg[w] == 0 {
                heap.push(std::cmp::Reverse(w));
            }
        }
    }
    if out.len() < n {
        vec![-1]
    } else {
        out
    }
}
