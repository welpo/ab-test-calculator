import json

import numpy as np
from scipy import stats


def calculate_sample_size(
    baseline,
    mde,
    alpha=0.05,
    power=0.8,
    variant_count=2,
    buffer=0,
    test_type="two-sided",
    correction_method="none",
):
    baseline_rate = baseline if baseline <= 1 else baseline / 100
    treatment_rate = baseline_rate * (1 + mde)

    # Adjust alpha for multiple comparisons.
    adjusted_alpha = alpha
    if variant_count > 2 and correction_method != "none":
        m = variant_count - 1
        if correction_method == "bonferroni":
            adjusted_alpha = alpha / m
        elif correction_method == "sidak":
            adjusted_alpha = 1.0 - (1.0 - alpha) ** (1.0 / m)

    # Z-scores and variance calculation.
    z_alpha = stats.norm.ppf(
        1.0 - (adjusted_alpha / 2.0 if test_type == "two-sided" else adjusted_alpha)
    )
    z_beta = stats.norm.ppf(power)

    # Clip values and calculate variances.
    epsilon = 1e-12
    baseline_rate = max(epsilon, min(1 - epsilon, baseline_rate))
    treatment_rate = max(epsilon, min(1 - epsilon, treatment_rate))
    var_control = baseline_rate * (1.0 - baseline_rate)
    var_treatment = treatment_rate * (1.0 - treatment_rate)

    sample_size = ((z_alpha + z_beta) ** 2 * (var_control + var_treatment)) / (
        treatment_rate - baseline_rate
    ) ** 2
    sample_size *= 1 + buffer / 100
    return int(np.ceil(sample_size))


test_cases = [
    {
        "name": "Variant count = 2 (bonferroni)",
        "baseline": 0.05,
        "mde": 0.1,
        "alpha": 0.05,
        "power": 0.8,
        "variants": 2,
        "buffer": 0,
        "testType": "two-sided",
        "correctionMethod": "bonferroni",
    },
    {
        "name": "Premium upsell",
        "baseline": 0.002,
        "mde": 0.25,
        "alpha": 0.1,
        "power": 0.8,
        "variants": 2,
        "buffer": 0,
        "testType": "two-sided",
        "correctionMethod": "bonferroni",
    },
]

for case in test_cases:
    case["expectedSampleSize"] = calculate_sample_size(
        case["baseline"],
        case["mde"],
        case["alpha"],
        case["power"],
        case["variants"],
        case.get("buffer", 0),
        case["testType"],
        case["correctionMethod"],
    )

print(json.dumps(test_cases, indent=2))
