def book_store(basket: list[int]) -> int:
    """
    Calculate the minimum total cost, in cents, for a basket of books.

    The basket contains integers 1 through 5, each representing a different
    book in the series.
    """
    counts = [0, 0, 0, 0, 0]
    for book in basket:
        if 1 <= book <= 5:
            counts[book - 1] += 1

    group_prices = (0, 800, 1520, 2160, 2560, 3000)

    def cost_for_balanced_counts(counts: tuple[int, int, int, int, int]) -> int:
        """
        Cost when no title has more than one extra copy compared with the
        next most common title. In this case the optimal grouping depends
        only on the total number of books and the number of distinct titles.
        """
        total = sum(counts)
        distinct = sum(1 for count in counts if count > 0)

        if distinct == 1:
            return total * 800

        if distinct == 2:
            return total * 760

        if distinct == 3:
            if total <= 3:
                return group_prices[total]
            if total <= 6:
                return 2 * group_prices[3]
            return (total - 6) * 720 + 2 * group_prices[3]

        if distinct == 4:
            if total <= 4:
                return group_prices[total]
            if total <= 8:
                return 2 * group_prices[4]
            return (total - 8) * 640 + 2 * group_prices[4]

        # distinct == 5
        if total <= 5:
            return group_prices[total]
        if total <= 10:
            return 2 * group_prices[5]
        return (total - 10) * 600 + 2 * group_prices[5]

    def solve(counts: tuple[int, int, int, int, int]) -> int:
        if all(count == 0 for count in counts):
            return 0

        ordered = tuple(sorted(counts, reverse=True))

        if ordered[0] <= ordered[1] + 1:
            return cost_for_balanced_counts(ordered)

        excess = ordered[0] - ordered[1]
        reduced = list(ordered)
        reduced[0] = ordered[1]
        return excess * 800 + solve(tuple(reduced))

    return solve(tuple(counts))
