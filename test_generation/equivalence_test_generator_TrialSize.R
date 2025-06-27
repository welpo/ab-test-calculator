# https://rdrr.io/cran/TrialSize/
library(TrialSize)

generate_test_case <- function(name, baseline, equivalence_margin, alpha, power, trafficDistribution, testType = "equivalence") {
  # The control group is always the first element.
  # The TrialSize 'k' parameter is n1 / n2 (treatment / control).
  k <- trafficDistribution[2] / trafficDistribution[1]

  p2 <- baseline  # control/reference rate
  p1 <- baseline  # test rate (assume equivalent for equivalence testing)
  delta <- p1 - p2  # expected difference (typically 0 for equivalence)
  margin <- baseline * equivalence_margin  # absolute equivalence margin
  beta <- 1 - power

  result <- TwoSampleProportion.Equivalence(alpha, beta, p1, p2, k = k, delta = delta, margin = margin)

  n_treat <- ceiling(abs(result))
  n_control <- ceiling(abs(n_treat / k))

  js_object <- sprintf('  {
    name: "%s",
    baseline: %.3f,
    mde: %.3f,
    isRelativeMde: true,
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
    equivalence_margin * 100,
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
  list("EQ | 50/50 | Basic", 0.1, 0.05, 0.05, 0.8, c(0.5, 0.5)),
  list("EQ | 50/50 | Tight margin", 0.15, 0.03, 0.05, 0.9, c(0.5, 0.5)),
  list("EQ | 50/50 | Wide margin", 0.2, 0.1, 0.05, 0.8, c(0.5, 0.5)),
  list("EQ | 50/50 | E-commerce conversion", 0.03, 0.02, 0.05, 0.8, c(0.5, 0.5)),

  # --- 70/30 split ---
  list("EQ | 70/30 | Basic", 0.1, 0.05, 0.05, 0.8, c(0.7, 0.3)),
  list("EQ | 70/30 | High power", 0.25, 0.04, 0.025, 0.95, c(0.7, 0.3)),
  list("EQ | 70/30 | Email open rate", 0.25, 0.02, 0.05, 0.85, c(0.7, 0.3)),

  # --- 30/70 split ---
  list("EQ | 30/70 | Wide margin", 0.2, 0.1, 0.05, 0.8, c(0.3, 0.7)),
  list("EQ | 30/70 | Click-through rate", 0.08, 0.04, 0.05, 0.9, c(0.3, 0.7)),
  list("EQ | 30/70 | Sign-up conversion", 0.18, 0.03, 0.05, 0.8, c(0.3, 0.7)),

  # --- 80/20 split ---
  list("EQ | 80/20 | Basic", 0.1, 0.05, 0.05, 0.8, c(0.8, 0.2)),
  list("EQ | 80/20 | Strict alpha", 0.12, 0.06, 0.01, 0.8, c(0.8, 0.2)),
  list("EQ | 80/20 | Purchase completion", 0.45, 0.05, 0.05, 0.85, c(0.8, 0.2)),

  # --- 20/80 split ---
  list("EQ | 20/80 | Tight margin", 0.15, 0.03, 0.05, 0.9, c(0.2, 0.8)),
  list("EQ | 20/80 | Email open rate", 0.25, 0.02, 0.05, 0.85, c(0.2, 0.8)),
  list("EQ | 20/80 | E-commerce conversion", 0.03, 0.02, 0.05, 0.8, c(0.2, 0.8)),

  # --- 90/10 split ---
  list("EQ | 90/10 | Basic", 0.1, 0.05, 0.05, 0.8, c(0.9, 0.1)),
  list("EQ | 90/10 | Wide margin", 0.2, 0.1, 0.05, 0.8, c(0.9, 0.1)),
  list("EQ | 90/10 | High power", 0.25, 0.04, 0.025, 0.95, c(0.9, 0.1)),

  # --- 10/90 split ---
  list("EQ | 10/90 | Click-through rate", 0.08, 0.04, 0.05, 0.9, c(0.1, 0.9)),
  list("EQ | 10/90 | Sign-up conversion", 0.18, 0.03, 0.05, 0.8, c(0.1, 0.9)),
  list("EQ | 10/90 | Purchase completion", 0.45, 0.05, 0.05, 0.85, c(0.1, 0.9)),

  # --- 99/1 split ---
  list("EQ | 99/1 | Basic", 0.1, 0.05, 0.05, 0.8, c(0.99, 0.01)),
  list("EQ | 99/1 | Strict alpha", 0.12, 0.06, 0.01, 0.8, c(0.99, 0.01)),
  list("EQ | 99/1 | Tight margin", 0.15, 0.03, 0.05, 0.9, c(0.99, 0.01)),

  # --- 1/99 split ---
  list("EQ | 1/99 | Wide margin", 0.2, 0.1, 0.05, 0.8, c(0.01, 0.99)),
  list("EQ | 1/99 | E-commerce conversion", 0.03, 0.02, 0.05, 0.8, c(0.01, 0.99)),
  list("EQ | 1/99 | Email open rate", 0.25, 0.02, 0.05, 0.85, c(0.01, 0.99))
)

js_test_cases <- sapply(test_cases, function(params) {
  generate_test_case(params[[1]], params[[2]], params[[3]], params[[4]], params[[5]], params[[6]])
})

cat(" // Start of tests generated from TrialSize::TwoSampleProportion.Equivalence on", format(Sys.time(), "%Y-%m-%d"), "\n")
cat(paste(js_test_cases, collapse = ",\n"))
cat(",\n", "  // End of tests generated from TrialSize::TwoSampleProportion.Equivalence on", format(Sys.time(), "%Y-%m-%d"))
