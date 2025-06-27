export function calculateMDE(baseline, mdeValue, isRelativeMde, testType) {
  const baselineRate = baseline / 100;
  const mdeDecimal = mdeValue / 100;
  // For non-inferiority, the direction is negative (a decrease), but entered as a positive number.
  const direction = testType === "non-inferiority" ? -1 : 1;
  const absoluteEffectSize = isRelativeMde
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
    baselineRate, // baseline as decimal
    targetRate, // target as decimal
    relMDE, // relative effect (negative for non-inferiority)
  };
}

export function calculateExperimentSize(config) {
  const { buffer = 0 } = config;
  const params = getStatisticalParams(config);
  const unbufferedResults = shouldUseEvenSplitLogic(config)
    ? calculateEvenSplitSampleSize(params, config)
    : calculateUnevenSplitSampleSize(params, config);
  return applyBufferToResults(unbufferedResults, buffer);
}

function shouldUseEvenSplitLogic(config) {
  return !config.trafficDistribution || isEvenSplit(config.trafficDistribution);
}

function calculateEvenSplitSampleSize(params, config) {
  const variantCount = getVariantCount(config);
  const sampleSizePerGroup = calculateBaseSampleSize(params);
  const totalSampleSize = sampleSizePerGroup * variantCount;
  return {
    sampleSizePerGroup: Array(variantCount).fill(Math.ceil(sampleSizePerGroup)),
    totalSampleSize: Math.ceil(totalSampleSize),
  };
}

function calculateUnevenSplitSampleSize(params, config) {
  // Uneven split. We calculate the necessary sample size for multiple comparisons vs control (variant A).
  // n = (σ₁²/κ + σ₂²)(z_{α/2} + z_β)² / δ²
  // Taken from page 32 in the book "Sample Size Calculations in Clinical Research, Third Edition" by Shein-Chung Chow, Jun Shao, Hansheng Wang, Yuliya Lokhnygina.
  const { trafficDistribution } = config;
  const f_control = trafficDistribution[0];
  const maxN = findMaxRequiredSampleSize(
    params,
    trafficDistribution,
    f_control
  );
  const sampleSizePerGroup = trafficDistribution.map((f) =>
    Math.ceil(maxN * f)
  );
  const totalSampleSize = sampleSizePerGroup.reduce(
    (sum, size) => sum + size,
    0
  );
  return {
    sampleSizePerGroup,
    totalSampleSize,
  };
}

function getVariantCount(config) {
  return (
    config.variantCount ||
    (config.trafficDistribution ? config.trafficDistribution.length : 2)
  );
}

function calculateBaseSampleSize(params) {
  const numerator =
    Math.pow(params.zAlpha + params.zBeta, 2) *
    (params.varControl + params.varTreatment);
  const denominator = Math.pow(Math.abs(params.absoluteEffectSize), 2);
  return numerator / denominator;
}

function findMaxRequiredSampleSize(params, trafficDistribution, f_control) {
  const f_min = Math.min(...trafficDistribution.slice(1)); // Smallest non-control variant.
  const varianceTerm =
    params.varControl / f_control + params.varTreatment / f_min;
  const numerator = Math.pow(params.zAlpha + params.zBeta, 2) * varianceTerm;
  const denominator = Math.pow(Math.abs(params.absoluteEffectSize), 2);
  return numerator / denominator;
}

function applyBufferToResults(unbufferedResults, buffer) {
  const bufferMultiplier = 1 + buffer / 100;
  return {
    totalSampleSize: Math.ceil(
      unbufferedResults.totalSampleSize * bufferMultiplier
    ),
    sampleSizePerGroup: unbufferedResults.sampleSizePerGroup.map((size) =>
      Math.ceil(size * bufferMultiplier)
    ),
  };
}

function getStatisticalParams(config) {
  const {
    baseline,
    mdeValue,
    isRelativeMde,
    alpha,
    power,
    variantCount,
    testType,
    correctionMethod,
  } = config;
  const mdeDecimal = mdeValue / 100;
  // For non-inferiority, the margin is a negative change, but the user enters a positive number.
  const direction = testType === "non-inferiority" ? -1 : Math.sign(mdeValue);
  const absoluteEffectSize = isRelativeMde
    ? baseline * mdeDecimal
    : direction * mdeDecimal;
  const treatmentCR = baseline + absoluteEffectSize;
  const adjustedAlpha = adjustAlphaForMultipleComparisons(
    alpha,
    variantCount,
    correctionMethod
  );
  const { zAlpha, zBeta } = calculateZScores(testType, adjustedAlpha, power);
  const epsilon = 1e-12; // To avoid division by zero or log(0).
  const clippedBaseline = Math.max(
    epsilon,
    Math.min(1 - epsilon, baseline)
  );
  let varControl, varTreatment;
  if (testType === "non-inferiority" || testType === "equivalence") {
    varControl = clippedBaseline * (1.0 - clippedBaseline);
    varTreatment = clippedBaseline * (1.0 - clippedBaseline);
  } else {
    const clippedTreatmentCR = Math.max(
      epsilon,
      Math.min(1 - epsilon, treatmentCR)
    );
    varControl = clippedBaseline * (1.0 - clippedBaseline);
    varTreatment = clippedTreatmentCR * (1.0 - clippedTreatmentCR);
  }
  return {
    zAlpha,
    zBeta,
    varControl,
    varTreatment,
    absoluteEffectSize,
  };
}

function isEvenSplit(distribution) {
  if (!distribution || distribution.length === 0) return true;
  const first = distribution[0];
  return distribution.every((value) => Math.abs(value - first) < 1e-9);
}

function adjustAlphaForMultipleComparisons(
  alpha,
  variantCount,
  correctionMethod
) {
  if (variantCount <= 2) {
    return alpha;
  }
  const m = variantCount - 1; // Number of comparisons against control.
  switch (correctionMethod) {
    case "bonferroni":
      return alpha / m;
    case "sidak":
      return 1.0 - Math.pow(1.0 - alpha, 1.0 / m);
    case "none":
    default:
      return alpha;
  }
}

function calculateZScores(testType, adjustedAlpha, power) {
  let zAlpha, zBeta;
  switch (testType) {
    case "equivalence":
      zAlpha = normSInv(1.0 - adjustedAlpha);
      zBeta = normSInv((1.0 + power) / 2.0);
      break;
    case "non-inferiority":
    case "superiority":
      zAlpha = normSInv(1.0 - adjustedAlpha);
      zBeta = normSInv(power);
      break;
    case "two-tailed":
    default:
      zAlpha = normSInv(1.0 - adjustedAlpha / 2.0);
      zBeta = normSInv(power);
      break;
  }
  return { zAlpha, zBeta };
}

/**
 * Calculates the inverse standard normal cumulative distribution function (quantile function).
 * Approximates the Z-score for a given probability p.
 */
function normSInv(p) {
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

export function calculateMDEFromSampleSize(
  totalSampleSize,
  config
) {
  const {
    baseline,
    alpha = 0.05,
    power = 0.8,
    buffer = 0,
    testType = "superiority",
    isRelativeMde = true,
    correctionMethod = "none",
    trafficDistribution,
  } = config;
  const variantCount = trafficDistribution.length;
  const unbufferedTotalSampleSize = totalSampleSize / (1 + buffer / 100);
  const baselineRate = baseline / 100;
  const adjustedAlpha = adjustAlphaForMultipleComparisons(
    alpha,
    variantCount,
    correctionMethod
  );
  const controlFraction = trafficDistribution[0];
  const minVariantFraction = Math.min(...trafficDistribution.slice(1));
  const n_c = unbufferedTotalSampleSize * controlFraction;
  const n_v = unbufferedTotalSampleSize * minVariantFraction;
  let mde_proportion;
  if (testType === "superiority" || testType === "two-tailed") {
    const { zAlpha, zBeta } = calculateZScores(testType, adjustedAlpha, power);
    const Z2 = Math.pow(zAlpha + zBeta, 2);
    const p = baselineRate;
    // a*x^2 + b*x + c = 0, where x is the absolute MDE.
    const a = n_v + Z2;
    const b = Z2 * (2 * p - 1);
    const c = -Z2 * p * (1 - p) * (1 + n_v / n_c);
    mde_proportion = solveQuadratic(a, b, c);
  } else {
    // Non-inferiority & equivalence logic.
    const { zAlpha, zBeta } = calculateZScores(testType, adjustedAlpha, power);
    const control_std = Math.sqrt(baselineRate * (1 - baselineRate));
    const z_value = zAlpha + zBeta;
    mde_proportion =
      z_value * control_std * Math.sqrt(1 / n_c + 1 / n_v);
  }
  if (mde_proportion === null || isNaN(mde_proportion)) {
    return NaN;
  }
  if (isRelativeMde) {
    return baselineRate > 0 ? (mde_proportion / baselineRate) * 100 : Infinity;
  } else {
    return mde_proportion * 100;
  }
}

function solveQuadratic(a, b, c) {
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
