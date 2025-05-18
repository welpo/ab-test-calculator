import json

import numpy as np
from scipy import stats


def calculate_sample_size(
    baseline,
    relativeEffectSize,
    alpha=0.05,
    power=0.8,
    variant_count=2,
    buffer=0,
    test_type="two-sided",  # "two-sided", "one-sided", "non-inferiority", "equivalence"
    correction_method="none",
):
    baseline_rate = baseline if baseline <= 1 else baseline / 100
    absolute_mde = baseline_rate * relativeEffectSize
    treatment_rate = baseline_rate + absolute_mde
    adjusted_alpha = alpha
    if variant_count > 2 and correction_method != "none":
        m = variant_count - 1
        if correction_method == "bonferroni":
            adjusted_alpha = alpha / m
        elif correction_method == "sidak":
            adjusted_alpha = 1.0 - (1.0 - alpha) ** (1.0 / m)

    # Z-scores and variance calculation.
    if test_type == "equivalence":
        # For equivalence (TOST): each test uses full alpha, full power.
        z_alpha = stats.norm.ppf(1.0 - adjusted_alpha)
        z_beta = stats.norm.ppf((1 + power) / 2)
    elif test_type in ["non-inferiority", "one-sided"]:
        z_alpha = stats.norm.ppf(1.0 - adjusted_alpha)
        z_beta = stats.norm.ppf(power)
    else:  # two-sided
        z_alpha = stats.norm.ppf(1.0 - adjusted_alpha / 2.0)
        z_beta = stats.norm.ppf(power)

    # Clip values and calculate variances.
    epsilon = 1e-12
    baseline_rate = max(epsilon, min(1 - epsilon, baseline_rate))
    if test_type in ["non-inferiority", "equivalence"]:
        # Both groups use baseline rate for variance.
        var_control = baseline_rate * (1.0 - baseline_rate)
        var_treatment = baseline_rate * (1.0 - baseline_rate)
    else:
        # Superiority tests use different rates.
        treatment_rate = max(epsilon, min(1 - epsilon, treatment_rate))
        var_control = baseline_rate * (1.0 - baseline_rate)
        var_treatment = treatment_rate * (1.0 - treatment_rate)

    numerator = (z_alpha + z_beta) ** 2 * (var_control + var_treatment)
    denominator = abs(absolute_mde) ** 2
    sample_size = numerator / denominator
    sample_size *= 1 + buffer / 100
    return int(np.ceil(sample_size))


test_cases = [
    {
        "name": "Basic non-inferiority",
        "baseline": 0.10,
        "relativeEffectSize": -0.1,
        "alpha": 0.05,
        "power": 0.8,
        "variantCount": 2,
        "buffer": 0,
        "testType": "non-inferiority",
        "correctionMethod": "none",
    },
    {
        "name": "High alpha equivalence",
        "baseline": 0.10,
        "relativeEffectSize": 0.1,
        "alpha": 0.1,
        "power": 0.8,
        "variantCount": 2,
        "buffer": 0,
        "testType": "equivalence",
        "correctionMethod": "none",
    },
]

for case in test_cases:
    case["expectedSampleSize"] = calculate_sample_size(
        case["baseline"],
        case["relativeEffectSize"],
        case["alpha"],
        case["power"],
        case["variantCount"],
        case.get("buffer", 0),
        case["testType"],
        case["correctionMethod"],
    )

print(json.dumps(test_cases, indent=2))
