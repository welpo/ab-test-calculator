library(epiR)

generate_test_case <- function(name, baseline, relative_effect_size, alpha, power) {
  delta <- baseline * relative_effect_size

  result <- epi.ssninfb(
    treat = baseline,
    control = baseline,
    delta = delta,
    n = NA,
    power = power,
    r = 1,
    alpha = alpha
  )

  # Format as JavaScript object.
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
  }',
    name,
    baseline,
    relative_effect_size,
    alpha,
    power,
    result$n.treat
  )

  return(js_object)
}

test_cases <- list(
  list("Basic non-inferiority", 0.1, 0.1, 0.05, 0.8),
  list("Conservative non-inferiority", 0.05, 0.05, 0.025, 0.9),
  list("High baseline, tight margin", 0.3, 0.05, 0.05, 0.8),
  list("Low baseline, loose margin", 0.02, 0.2, 0.05, 0.8),
  list("Medium baseline, medium margin", 0.15, 0.1, 0.05, 0.85),
  list("High power, tight margin", 0.2, 0.05, 0.025, 0.95),
  list("E-commerce conversion", 0.03, 0.1, 0.05, 0.8),
  list("Email open rate", 0.25, 0.04, 0.05, 0.9),
  list("Click-through rate", 0.08, 0.125, 0.025, 0.85),
  list("Sign-up conversion", 0.18, 0.06, 0.05, 0.8)
)

js_test_cases <- sapply(test_cases, function(params) {
  generate_test_case(params[[1]], params[[2]], params[[3]], params[[4]], params[[5]])
})

cat(paste(js_test_cases, collapse = ",\n"))
cat(",\n")
cat("  // Generated from epiR::epi.ssninfb on", format(Sys.time(), "%Y-%m-%d"))
