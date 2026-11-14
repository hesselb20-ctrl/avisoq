pub fn to_roman(n: i64) -> String {
    const TABLE: [(i64, &str); 13] = [
        (1000, "M"),
        (900, "CM"),
        (500, "D"),
        (400, "CD"),
        (100, "C"),
        (90, "XC"),
        (50, "L"),
        (40, "XL"),
        (10, "X"),
        (9, "IX"),
        (5, "V"),
        (4, "IV"),
        (1, "I"),
    ];
    let mut remaining = n;
    let mut out = String::new();
    for &(value, symbol) in TABLE.iter() {
        while remaining >= value {
            out.push_str(symbol);
            remaining -= value;
        }
    }
    out
}
