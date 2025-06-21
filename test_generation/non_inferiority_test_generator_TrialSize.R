library(TrialSize)

generate_test_case <- function(name, baseline, relative_effect_size, alpha, power) {
  absolute_margin <- baseline * relative_effect_size

  p2 <- baseline  # control rate
  p1 <- baseline  # assume equal performance for non-inferiority
  delta <- p1 - p2  # expected difference (usually 0)
  margin <- absolute_margin  # the margin (negative)
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
    testType: "non-inferiority",
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
  list("Basic non-inferiority", 0.1, 0.1, 0.05, 0.8),         # 10% margin
  list("Conservative non-inferiority", 0.05, 0.05, 0.025, 0.9), # 5% margin
  list("Tight margin non-inf", 0.2, 0.02, 0.05, 0.8),        # 2% margin
  list("Loose margin non-inf", 0.15, 0.15, 0.05, 0.85),      # 15% margin
  list("High power non-inf", 0.3, 0.05, 0.05, 0.95),         # 5% margin
  list("Strict alpha non-inf", 0.12, 0.08, 0.01, 0.8),       # 8% margin
  list("E-commerce non-inf", 0.03, 0.2, 0.05, 0.8),          # 20% margin
  list("Email non-inf", 0.25, 0.04, 0.05, 0.9),              # 4% margin
  list("Click rate non-inf", 0.08, 0.1, 0.025, 0.85),        # 10% margin
  list("Purchase non-inf", 0.45, 0.03, 0.05, 0.8)            # 3% margin
)

js_test_cases <- sapply(test_cases, function(params) {
  generate_test_case(params[[1]], params[[2]], params[[3]], params[[4]], params[[5]])
})

cat(" // Start of tests generated from TrialSize::TwoSampleProportion.NIS on", format(Sys.time(), "%Y-%m-%d"), "\n")
cat(paste(js_test_cases, collapse = "\n"))
cat("\n", "  // End of tests generated from TrialSize::TwoSampleProportion.NIS on", format(Sys.time(), "%Y-%m-%d"))
