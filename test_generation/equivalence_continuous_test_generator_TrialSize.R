# https://rdrr.io/cran/TrialSize/src/R/TwoSampleMean.Equivalence.R
# For equivalence testing with continuous outcomes.
# Tests whether the difference between means falls within [-margin, +margin].
library(TrialSize)

generate_test_case <- function(name, baselineMean, sigma, eqMargin, alpha, power, trafficDistribution, testType = "equivalence") {
  # The control group is always the first element.
  # The TrialSize 'k' parameter is n1 / n2 (treatment / control).
  k <- trafficDistribution[2] / trafficDistribution[1]
  beta <- 1 - power

  # For equivalence: delta = 0 (we expect true equivalence), margin = equivalence boundary.
  result <- TwoSampleMean.Equivalence(alpha, beta, sigma, k, delta = 0, margin = eqMargin)

  n_treat <- ceiling(abs(result))
  n_control <- ceiling(abs(n_treat / k))

  js_object <- sprintf('  {
    name: "%s",
    metricType: "continuous",
    baselineMean: %.2f,
    standardDeviation: %.2f,
    meanDifference: %.2f,
    alpha: %.3f,
    power: %.2f,
    variantCount: 2,
    buffer: 0,
    testType: "%s",
    correctionMethod: "none",
    trafficDistribution: [%.2f, %.2f],
    expected: { total: %d, perGroup: [%d, %d] }
  }',
    name,
    baselineMean,
    sigma,
    eqMargin,
    alpha,
    power,
    testType,
    trafficDistribution[1],
    trafficDistribution[2],
    n_control + n_treat,
    n_control,
    n_treat
  )

  return(js_object)
}

# Test cases with realistic scenarios for continuous metrics.
# eqMargin is the equivalence margin (max acceptable difference in either direction).
# Parameters: name, baselineMean, sigma (SD), eqMargin, alpha, power, trafficDistribution
test_cases <- list(
  # --- 50/50 split ---
  # Revenue: mean=$50, SD=$30, prove equivalent within $5.
  list("EQ-C | 50/50 | Revenue per user", 50, 30, 5, 0.05, 0.8, c(0.5, 0.5)),
  list("EQ-C | 50/50 | Time on page", 120, 60, 15, 0.05, 0.8, c(0.5, 0.5)),
  list("EQ-C | 50/50 | Session duration high power", 300, 150, 30, 0.05, 0.9, c(0.5, 0.5)),
  list("EQ-C | 50/50 | Cart value", 75, 40, 10, 0.05, 0.8, c(0.5, 0.5)),

  # --- 70/30 split ---
  list("EQ-C | 70/30 | Revenue per user", 50, 30, 5, 0.05, 0.8, c(0.7, 0.3)),
  list("EQ-C | 70/30 | Time on page", 120, 60, 15, 0.05, 0.85, c(0.7, 0.3)),
  list("EQ-C | 70/30 | Pages per session", 4.5, 2.5, 0.5, 0.05, 0.8, c(0.7, 0.3)),

  # --- 30/70 split ---
  list("EQ-C | 30/70 | Cart value", 75, 40, 10, 0.05, 0.8, c(0.3, 0.7)),
  list("EQ-C | 30/70 | Session duration", 300, 150, 30, 0.05, 0.9, c(0.3, 0.7)),
  list("EQ-C | 30/70 | Strict alpha", 50, 30, 5, 0.01, 0.8, c(0.3, 0.7)),

  # --- 80/20 split ---
  list("EQ-C | 80/20 | Revenue per user", 50, 30, 5, 0.05, 0.8, c(0.8, 0.2)),
  list("EQ-C | 80/20 | Time on page", 120, 60, 15, 0.05, 0.8, c(0.8, 0.2)),
  list("EQ-C | 80/20 | NPS score", 45, 25, 5, 0.05, 0.9, c(0.8, 0.2)),

  # --- 20/80 split ---
  list("EQ-C | 20/80 | Cart value", 75, 40, 10, 0.05, 0.8, c(0.2, 0.8)),
  list("EQ-C | 20/80 | Pages per session", 4.5, 2.5, 0.5, 0.05, 0.85, c(0.2, 0.8)),
  list("EQ-C | 20/80 | Session duration", 300, 150, 30, 0.05, 0.8, c(0.2, 0.8)),

  # --- 90/10 split ---
  list("EQ-C | 90/10 | Revenue per user", 50, 30, 5, 0.05, 0.8, c(0.9, 0.1)),
  list("EQ-C | 90/10 | Time on page", 120, 60, 15, 0.05, 0.8, c(0.9, 0.1)),
  list("EQ-C | 90/10 | High power", 75, 40, 10, 0.05, 0.95, c(0.9, 0.1)),

  # --- 10/90 split ---
  list("EQ-C | 10/90 | Cart value", 75, 40, 10, 0.05, 0.8, c(0.1, 0.9)),
  list("EQ-C | 10/90 | NPS score", 45, 25, 5, 0.05, 0.8, c(0.1, 0.9)),
  list("EQ-C | 10/90 | Strict alpha", 50, 30, 5, 0.01, 0.8, c(0.1, 0.9))
)

js_test_cases <- sapply(test_cases, function(params) {
  generate_test_case(params[[1]], params[[2]], params[[3]], params[[4]], params[[5]], params[[6]], params[[7]])
})

cat(" // Start of tests generated from TrialSize::TwoSampleMean.Equivalence on", format(Sys.time(), "%Y-%m-%d"), "\n")
cat(paste(js_test_cases, collapse = ",\n"))
cat(",\n", "  // End of tests generated from TrialSize::TwoSampleMean.Equivalence on", format(Sys.time(), "%Y-%m-%d"))
