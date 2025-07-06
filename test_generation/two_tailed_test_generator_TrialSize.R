# https://rdrr.io/cran/TrialSize/
library(TrialSize)

generate_test_case <- function(name, baseline, relative_effect_size, alpha, power, trafficDistribution, testType = "two-tailed") {
  # The control group is always the first element.
  # The TrialSize 'k' parameter is n1 / n2 (treatment / control).
  k <- trafficDistribution[2] / trafficDistribution[1]

  p2 <- baseline  # control/reference rate
  p1 <- baseline * (1 + relative_effect_size)  # test rate
  beta <- 1 - power

  result <- TwoSampleProportion.Equality(alpha, beta, p1, p2, k = k)

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
  list("TT | 50/50 | Basic", 0.1, 0.2, 0.05, 0.8, c(0.5, 0.5)),
  list("TT | 50/50 | High power", 0.05, 0.4, 0.05, 0.9, c(0.5, 0.5)),
  list("TT | 50/50 | Small effect", 0.2, 0.1, 0.05, 0.8, c(0.5, 0.5)),
  list("TT | 50/50 | E-commerce conversion", 0.03, 0.33, 0.05, 0.8, c(0.5, 0.5)),

  # --- 70/30 split ---
  list("TT | 70/30 | Basic", 0.1, 0.2, 0.05, 0.8, c(0.7, 0.3)),
  list("TT | 70/30 | Large effect", 0.15, 0.5, 0.05, 0.8, c(0.7, 0.3)),
  list("TT | 70/30 | Email click rate", 0.25, 0.2, 0.05, 0.85, c(0.7, 0.3)),

  # --- 30/70 split ---
  list("TT | 30/70 | Strict alpha", 0.1, 0.3, 0.01, 0.8, c(0.3, 0.7)),
  list("TT | 30/70 | Sign-up rate", 0.12, 0.15, 0.05, 0.9, c(0.3, 0.7)),
  list("TT | 30/70 | Purchase completion", 0.45, 0.1, 0.05, 0.8, c(0.3, 0.7)),

  # --- 80/20 split ---
  list("TT | 80/20 | Basic", 0.1, 0.2, 0.05, 0.8, c(0.8, 0.2)),
  list("TT | 80/20 | Conservative test", 0.08, 0.25, 0.025, 0.95, c(0.8, 0.2)),
  list("TT | 80/20 | E-commerce conversion", 0.03, 0.33, 0.05, 0.8, c(0.8, 0.2)),

  # --- 20/80 split ---
  list("TT | 20/80 | High power", 0.05, 0.4, 0.05, 0.9, c(0.2, 0.8)),
  list("TT | 20/80 | Email click rate", 0.25, 0.2, 0.05, 0.85, c(0.2, 0.8)),
  list("TT | 20/80 | Small effect", 0.2, 0.1, 0.05, 0.8, c(0.2, 0.8)),

  # --- 90/10 split ---
  list("TT | 90/10 | Basic", 0.1, 0.2, 0.05, 0.8, c(0.9, 0.1)),
  list("TT | 90/10 | Large effect", 0.15, 0.5, 0.05, 0.8, c(0.9, 0.1)),
  list("TT | 90/10 | Sign-up rate", 0.12, 0.15, 0.05, 0.9, c(0.9, 0.1)),

  # --- 10/90 split ---
  list("TT | 10/90 | Purchase completion", 0.45, 0.1, 0.05, 0.8, c(0.1, 0.9)),
  list("TT | 10/90 | Strict alpha", 0.1, 0.3, 0.01, 0.8, c(0.1, 0.9)),
  list("TT | 10/90 | Conservative test", 0.08, 0.25, 0.025, 0.95, c(0.1, 0.9)),

  # --- 99/1 split ---
  list("TT | 99/1 | Basic", 0.1, 0.2, 0.05, 0.8, c(0.99, 0.01)),
  list("TT | 99/1 | High power", 0.05, 0.4, 0.05, 0.9, c(0.99, 0.01)),
  list("TT | 99/1 | Email click rate", 0.25, 0.2, 0.05, 0.85, c(0.99, 0.01)),

  # --- 1/99 split ---
  list("TT | 1/99 | Large effect", 0.15, 0.5, 0.05, 0.8, c(0.01, 0.99)),
  list("TT | 1/99 | E-commerce conversion", 0.03, 0.33, 0.05, 0.8, c(0.01, 0.99)),
  list("TT | 1/99 | Small effect", 0.2, 0.1, 0.05, 0.8, c(0.01, 0.99))
)

js_test_cases <- sapply(test_cases, function(params) {
  generate_test_case(params[[1]], params[[2]], params[[3]], params[[4]], params[[5]], params[[6]])
})

cat(" // Start of tests generated from TrialSize::TwoSampleProportion.Equality on", format(Sys.time(), "%Y-%m-%d"), "\n")
cat(paste(js_test_cases, collapse = ",\n"))
cat(",\n", "  // End of tests generated from TrialSize::TwoSampleProportion.Equality on", format(Sys.time(), "%Y-%m-%d"))
