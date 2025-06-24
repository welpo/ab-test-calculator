library(TrialSize)

generate_test_case <- function(name, baseline, relative_effect_size, alpha, power) {
  p2 <- baseline  # control/reference rate
  p1 <- baseline * (1 + relative_effect_size)  # test rate
  beta <- 1 - power

  result <- TwoSampleProportion.Equality(alpha, beta, p1, p2, k = 1)

  per_variant_n <- round(as.numeric(result[1]))

  js_object <- sprintf('  {
    name: "%s",
    baseline: %.3f,
    relativeEffectSize: %.3f,
    alpha: %.3f,
    power: %.2f,
    variantCount: 2,
    buffer: 0,
    testType: "two-tailed",
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
  list("Basic two-tailed", 0.1, 0.2, 0.05, 0.8),
  list("High power equality", 0.05, 0.4, 0.05, 0.9),
  list("Small effect", 0.2, 0.1, 0.05, 0.8),
  list("Large effect", 0.15, 0.5, 0.05, 0.8),
  list("Strict alpha", 0.1, 0.3, 0.01, 0.8),
  list("Conservative test", 0.08, 0.25, 0.025, 0.95),
  list("E-commerce conversion", 0.03, 0.33, 0.05, 0.8),
  list("Email click rate", 0.25, 0.2, 0.05, 0.85),
  list("Sign-up rate", 0.12, 0.15, 0.05, 0.9),
  list("Purchase completion", 0.45, 0.1, 0.05, 0.8),
  # Uneven allocation.
  list("2:1 allocation (test:control)", 0.1, 0.2, 0.05, 0.8, 2),
  list("3:1 allocation (test:control)", 0.05, 0.4, 0.05, 0.9, 3),
  list("1:2 allocation (test:control)", 0.2, 0.1, 0.05, 0.8, 0.5),
  list("1:3 allocation (test:control)", 0.15, 0.5, 0.05, 0.8, 0.33),
  list("4:1 allocation (test:control)", 0.12, 0.15, 0.05, 0.9, 4),
  list("1:4 allocation (test:control)", 0.08, 0.25, 0.025, 0.95, 0.25),
  list("5:1 allocation (test:control)", 0.03, 0.33, 0.05, 0.8, 5),
  list("1:5 allocation (test:control)", 0.25, 0.2, 0.05, 0.85, 0.2)
)

js_test_cases <- sapply(test_cases, function(params) {
  generate_test_case(params[[1]], params[[2]], params[[3]], params[[4]], params[[5]])
})

cat(paste(js_test_cases, collapse = "\n"))
