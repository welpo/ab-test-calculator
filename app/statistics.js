export const STATISTICAL_CONSTANTS = {
  DEFAULT_MDE: 30,
  DEFAULT_DAYS: 30,
  DEFAULT_MDES: [5, 10, 15, 20, 25],
  DEFAULT_TIMES: [7, 14, 30, 60, 90],
  ADVANCED_DEFAULTS: {
    alpha: 0.05,
    power: 0.8,
    testType: "one-sided",
    correction: "none",
    trafficFlow: 100,
    buffer: 0,
  },
};

/**
 * Calculates the inverse standard normal cumulative distribution function (quantile function).
 * Approximates the Z-score for a given probability p.
 */
export function normSInv(p) {
  // Coefficients for approximation.
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const p_low = 0.02425;
  const p_high = 1 - p_low;
  if (typeof p !== "number" || p <= 0 || p >= 1) {
    throw new Error(
      "normSInv: Argument p must be a probability between 0 and 1 (exclusive)."
    );
  }
  let q, r, retVal;
  if (p < p_low) {
    // Rational approximation for lower region.
    q = Math.sqrt(-2 * Math.log(p));
    retVal =
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= p_high) {
    // Central region.
    q = p - 0.5;
    r = q * q;
    retVal =
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    // Upper region.
    q = Math.sqrt(-2 * Math.log(1 - p));
    retVal =
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  return retVal;
}

export function calculateSampleSize(
  baselineCR,
  relativeEffectSize,
  alpha = 0.05,
  power = 0.8,
  variantCount = 2,
  buffer = 0,
  testType = "one-sided",
  correctionMethod = "none"
) {
  const absoluteEffectSize = baselineCR * relativeEffectSize;
  const treatmentCR = baselineCR + absoluteEffectSize;
  let adjustedAlpha = alpha;
  if (variantCount > 2) {
    // Correction: multiple comparisons to control (not between non-control variants).
    const m = variantCount - 1;
    switch (correctionMethod) {
      case "bonferroni":
        adjustedAlpha = alpha / m;
        break;
      case "sidak":
        adjustedAlpha = 1.0 - Math.pow(1.0 - alpha, 1.0 / m);
        break;
      case "none":
      default:
        adjustedAlpha = alpha;
    }
  }
  // Z-scores.
  let zAlpha, zBeta;
  if (testType === "equivalence") {
    zAlpha = normSInv(1.0 - adjustedAlpha);
    zBeta = normSInv((1 + power) / 2);
  } else if (testType === "non-inferiority" || testType === "one-sided") {
    zAlpha = normSInv(1.0 - adjustedAlpha);
    zBeta = normSInv(power);
  } else {
    // two-sided.
    zAlpha = normSInv(1.0 - adjustedAlpha / 2.0);
    zBeta = normSInv(power);
  }
  // Variance.
  const epsilon = 1e-12;
  const clippedBaselineCR = Math.max(
    epsilon,
    Math.min(1 - epsilon, baselineCR)
  );
  let varControl, varTreatment;
  if (testType === "non-inferiority" || testType === "equivalence") {
    // Both groups use baseline rate for variance.
    varControl = clippedBaselineCR * (1.0 - clippedBaselineCR);
    varTreatment = clippedBaselineCR * (1.0 - clippedBaselineCR);
  } else {
    // Superiority tests.
    const clippedTreatmentCR = Math.max(
      epsilon,
      Math.min(1 - epsilon, treatmentCR)
    );
    varControl = clippedBaselineCR * (1.0 - clippedBaselineCR);
    varTreatment = clippedTreatmentCR * (1.0 - clippedTreatmentCR);
  }
  // Sample size calculation.
  const numerator = Math.pow(zAlpha + zBeta, 2) * (varControl + varTreatment);
  const denominator = Math.pow(Math.abs(absoluteEffectSize), 2);
  const sampleSizePerVariant = numerator / denominator;
  const bufferedSamplePerVariant = sampleSizePerVariant * (1 + buffer / 100);
  return Math.ceil(bufferedSamplePerVariant);
}

export function calculateMDE(baseline, mdeValue, isRelativeMode, testType) {
  const baselineRate = baseline / 100;
  const mdeDecimal = mdeValue / 100;
  // For non-inferiority, the direction is negative (a decrease), but entered as a positive number.
  const direction = testType === "non-inferiority" ? -1 : 1;
  const absoluteEffectSize = isRelativeMode
    ? baselineRate * mdeDecimal
    : mdeDecimal;
  const targetRate = baselineRate + direction * absoluteEffectSize;
  let relMDE;
  if (baselineRate > 0) {
    relMDE = (targetRate - baselineRate) / baselineRate;
  } else {
    relMDE = targetRate > 0 ? Infinity : 0;
  }
  return {
    baselineRate, // The baseline as a decimal
    targetRate, // The target as a decimal
    relMDE, // The relative effect, (negative for non-inferiority)
  };
}

export function calculateMDEFromSampleSize(sampleSizePerVariant, params) {
  const unbufferedSampleSize = sampleSizePerVariant / (1 + params.buffer / 100);
  const baselineRate = params.baseline / 100;
  let adjustedAlpha = params.alpha;
  if (params.variantCount > 2) {
    const m = params.variantCount - 1;
    switch (params.correctionMethod) {
      case "bonferroni":
        adjustedAlpha = params.alpha / m;
        break;
      case "sidak":
        adjustedAlpha = 1.0 - Math.pow(1.0 - params.alpha, 1.0 / m);
        break;
      default:
        adjustedAlpha = params.alpha;
    }
  }
  let mde_proportion;
  if (params.testType === "one-sided" || params.testType === "two-sided") {
    let zAlpha, zBeta;
    if (params.testType === "one-sided") {
      zAlpha = normSInv(1.0 - adjustedAlpha);
      zBeta = normSInv(params.power);
    } else {
      // two-sided.
      zAlpha = normSInv(1.0 - adjustedAlpha / 2.0);
      zBeta = normSInv(params.power);
    }
    const Z2 = Math.pow(zAlpha + zBeta, 2);
    const n = unbufferedSampleSize;
    const p = baselineRate;
    const a = n + Z2;
    const b = Z2 * (2 * p - 1);
    const c = -Z2 * 2 * p * (1 - p);
    mde_proportion = solveQuadratic(a, b, c);
  } else {
    // non-inferiority or equivalence.
    let zAlpha, zBeta;
    if (params.testType === "equivalence") {
      zAlpha = normSInv(1.0 - adjustedAlpha);
      zBeta = normSInv((1.0 + params.power) / 2.0);
    } else {
      // non-inferiority.
      zAlpha = normSInv(1.0 - adjustedAlpha);
      zBeta = normSInv(params.power);
    }
    const control_std = Math.sqrt(baselineRate * (1 - baselineRate));
    const z_value = zAlpha + zBeta;
    mde_proportion =
      z_value * control_std * Math.sqrt(2 / unbufferedSampleSize);
  }
  if (mde_proportion === null) {
    return NaN;
  }
  if (params.isRelativeMode) {
    return (mde_proportion / baselineRate) * 100;
  } else {
    return mde_proportion * 100;
  }
}

export function solveQuadratic(a, b, c) {
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return null;
  }
  const root1 = (-b + Math.sqrt(discriminant)) / (2 * a);
  const root2 = (-b - Math.sqrt(discriminant)) / (2 * a);
  if (root1 > 0) return root1;
  if (root2 > 0) return root2;
  return null;
}
