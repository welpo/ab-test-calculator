# https://rdrr.io/cran/TrialSize/
library(TrialSize)

generate_test_case <- function(name, baseline, relative_effect_size, alpha, power, trafficDistribution, testType = "non-inferiority") {
  # The control group is always the first element.
  # The TrialSize 'k' parameter is n1 / n2 (treatment / control).
  k <- trafficDistribution[2] / trafficDistribution[1]
  absolute_margin <- baseline * relative_effect_size

  p2 <- baseline  # control rate
  p1 <- baseline  # assume equal performance for non-inferiority
  delta <- p1 - p2  # expected difference (usually 0)
  margin <- absolute_margin
  beta <- 1 - power

  result <- TwoSampleProportion.NIS(alpha, beta, p1, p2, k = k, delta = delta, margin = margin)

  n_treat <- ceiling(abs(result))
  n_control <- ceiling(abs(n_treat / k))

  js_object <- sprintf('  {
    name: "%s",
    baseline: %.3f,
    absoluteMde: %.3f,
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
    baseline * 100,
    baseline * relative_effect_size * 100,
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

test_cases <- list(
  # --- 50/50 split ---
  list("NI | 50/50 | Basic", 0.1, 0.1, 0.05, 0.8, c(0.5, 0.5)),
  list("NI | 50/50 | Conservative", 0.05, 0.05, 0.025, 0.9, c(0.5, 0.5)),
  list("NI | 50/50 | E-commerce", 0.03, 0.2, 0.05, 0.8, c(0.5, 0.5)),
  list("NI | 50/50 | Email open rate", 0.25, 0.04, 0.05, 0.9, c(0.5, 0.5)),

  # --- 70/30 split ---
  list("NI | 70/30 | Basic", 0.1, 0.1, 0.05, 0.8, c(0.7, 0.3)),
  list("NI | 70/30 | Tight margin", 0.2, 0.02, 0.05, 0.8, c(0.7, 0.3)),
  list("NI | 70/30 | Click rate", 0.08, 0.1, 0.025, 0.85, c(0.7, 0.3)),

  # --- 30/70 split ---
  list("NI | 30/70 | Loose margin", 0.15, 0.15, 0.05, 0.85, c(0.3, 0.7)),
  list("NI | 30/70 | Purchase rate", 0.45, 0.03, 0.05, 0.8, c(0.3, 0.7)),
  list("NI | 30/70 | High power", 0.3, 0.05, 0.05, 0.95, c(0.3, 0.7)),

  # --- 80/20 split ---
  list("NI | 80/20 | Basic", 0.1, 0.1, 0.05, 0.8, c(0.8, 0.2)),
  list("NI | 80/20 | Strict alpha", 0.12, 0.08, 0.01, 0.8, c(0.8, 0.2)),
  list("NI | 80/20 | E-commerce", 0.03, 0.2, 0.05, 0.8, c(0.8, 0.2)),

  # --- 20/80 split ---
  list("NI | 20/80 | Conservative", 0.05, 0.05, 0.025, 0.9, c(0.2, 0.8)),
  list("NI | 20/80 | Email open rate", 0.25, 0.04, 0.05, 0.9, c(0.2, 0.8)),
  list("NI | 20/80 | Loose margin", 0.15, 0.15, 0.05, 0.85, c(0.2, 0.8)),

  # --- 90/10 split ---
  list("NI | 90/10 | Basic", 0.1, 0.1, 0.05, 0.8, c(0.9, 0.1)),
  list("NI | 90/10 | Tight margin", 0.2, 0.02, 0.05, 0.8, c(0.9, 0.1)),
  list("NI | 90/10 | Click rate", 0.08, 0.1, 0.025, 0.85, c(0.9, 0.1)),

  # --- 10/90 split ---
  list("NI | 10/90 | Purchase rate", 0.45, 0.03, 0.05, 0.8, c(0.1, 0.9)),
  list("NI | 10/90 | E-commerce", 0.03, 0.2, 0.05, 0.8, c(0.1, 0.9)),
  list("NI | 10/90 | High power", 0.3, 0.05, 0.05, 0.95, c(0.1, 0.9)),

  # --- 99/1 split ---
  list("NI | 99/1 | Basic", 0.1, 0.1, 0.05, 0.8, c(0.99, 0.01)),
  list("NI | 99/1 | Strict alpha", 0.12, 0.08, 0.01, 0.8, c(0.99, 0.01)),
  list("NI | 99/1 | Email open rate", 0.25, 0.04, 0.05, 0.9, c(0.99, 0.01)),

  # --- 1/99 split ---
  list("NI | 1/99 | Conservative", 0.05, 0.05, 0.025, 0.9, c(0.01, 0.99)),
  list("NI | 1/99 | E-commerce", 0.03, 0.2, 0.05, 0.8, c(0.01, 0.99)),
  list("NI | 1/99 | Tight margin", 0.2, 0.02, 0.05, 0.8, c(0.01, 0.99))
)

js_test_cases <- sapply(test_cases, function(params) {
  generate_test_case(params[[1]], params[[2]], params[[3]], params[[4]], params[[5]], params[[6]])
})

cat(" // Start of tests generated from TrialSize::TwoSampleProportion.NIS on", format(Sys.time(), "%Y-%m-%d"), "\n")
cat(paste(js_test_cases, collapse = ",\n"))
cat(",\n", "  // End of tests generated from TrialSize::TwoSampleProportion.NIS on", format(Sys.time(), "%Y-%m-%d"))
