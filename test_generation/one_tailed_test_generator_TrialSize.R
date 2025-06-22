library(TrialSize)

generate_test_case <- function(name, baseline, relative_effect_size, alpha, power) {
  p2 <- baseline  # control rate
  p1 <- baseline * (1 + relative_effect_size)  # variant rate (expected to be better)
  delta <- p1 - p2  # expected difference
  margin <- 0  # superiority margin (testing if p1 > p2)
  beta <- 1 - power

  result <- TwoSampleProportion.NIS(alpha, beta, p1, p2, k = 1, delta = delta, margin = margin)

  per_variant_n <- round(as.numeric(result[1]))

  js_object <- sprintf('  {
    name: "%s",
    baseline: %.3f,
    relativeEffectSize: %.3f,
    alpha: %.3f,
    power: %.2f,
    variantCount: 2,
    buffer: 0,
    testType: "superiority",
    correctionMethod: "none",
    expectedSampleSize: %d,
  },',
    name,
    baseline,
    relative_effect_size,
    alpha,
    power,
    per_variant_n
  )

  return(js_object)
}

test_cases <- list(
  list("Small superiority", 0.1, 0.02, 0.05, 0.8),           # 2% improvement
  list("Basic superiority", 0.1, 0.2, 0.05, 0.8),           # 20% improvement
  list("High power superiority", 0.05, 0.4, 0.05, 0.9),     # 40% improvement
  list("Small effect superiority", 0.2, 0.1, 0.05, 0.8),    # 10% improvement
  list("Large effect superiority", 0.15, 0.5, 0.05, 0.8),   # 50% improvement
  list("Strict alpha superiority", 0.1, 0.3, 0.01, 0.8),    # 30% improvement
  list("Conservative superiority", 0.08, 0.25, 0.025, 0.95), # 25% improvement
  list("E-commerce superiority", 0.03, 0.33, 0.05, 0.8),    # 33% improvement
  list("Email superiority", 0.25, 0.2, 0.05, 0.85),         # 20% improvement
  list("Sign-up superiority", 0.12, 0.15, 0.05, 0.9),       # 15% improvement
  list("Purchase superiority", 0.45, 0.1, 0.05, 0.8)        # 10% improvement
)

js_test_cases <- sapply(test_cases, function(params) {
  generate_test_case(params[[1]], params[[2]], params[[3]], params[[4]], params[[5]])
})

cat(" // Start of tests generated from TrialSize::TwoSampleProportion.NIS (margin=0) on", format(Sys.time(), "%Y-%m-%d"), "\n")
cat(paste(js_test_cases, collapse = "\n"))
cat("\n", "  // End of tests generated from TrialSize::TwoSampleProportion.NIS (margin=0) on", format(Sys.time(), "%Y-%m-%d"))
