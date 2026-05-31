"""Pickup-requirement predicate — a port of meetsPickupRequirement
(src/playSettings.js)."""


def meets_pickup_requirement(score, total, required="all"):
    if required == "all":
        return score >= total
    # Non-numeric (or non-finite) required -> fall back to "all".
    if isinstance(required, bool) or not isinstance(required, (int, float)):
        return score >= total
    if required != required:  # NaN
        return score >= total
    if required <= 0:
        return True  # 0 (or negative — defensive) = no minimum
    effective = min(required, total)
    return score >= effective
