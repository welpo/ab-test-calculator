# https://rdrr.io/cran/epiR/
library(epiR)

generate_test_case <- function(name, baseline, relative_effect_size, alpha, power, trafficDistribution, testType = "non-inferiority") {
  # The control group is always the first element.
  # The epiR 'r' parameter is n.treat / n.control.
  ratio <- trafficDistribution[2] / trafficDistribution[1]

  # For non-inferiority, delta is the margin we want to rule out.
  # It's a negative effect, so delta should be negative.
  delta <- -1 * baseline * relative_effect_size

  # Use the epi.ssninfb function, designed for non-inferiority tests.
  # It returns the sample size per group.
  result <- epi.ssninfb(
    treat = baseline,
    control = baseline,
    delta = delta,
    n = NA,
    power = power,
    r = ratio,
    alpha = alpha
  )

  # The output n.treat and n.control are the sizes for the *treatment* and *control* groups.
  n_control <- ceiling(abs(result$n.control))
  n_treat <- ceiling(abs(result$n.treat))

  # Format as JavaScript object.
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
    relative_effect_size * 100,
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
  list("NI | 50/50 | E-commerce conversion", 0.03, 0.1, 0.05, 0.8, c(0.5, 0.5)),
  list("NI | 50/50 | Email open rate", 0.25, 0.04, 0.05, 0.9, c(0.5, 0.5)),

  # --- 70/30 split ---
  list("NI | 70/30 | Basic", 0.1, 0.1, 0.05, 0.8, c(0.7, 0.3)),
  list("NI | 70/30 | High baseline, tight margin", 0.3, 0.05, 0.05, 0.8, c(0.7, 0.3)),
  list("NI | 70/30 | Click-through rate", 0.08, 0.125, 0.025, 0.85, c(0.7, 0.3)),

  # --- 30/70 split ---
  list("NI | 30/70 | Medium baseline, medium margin", 0.15, 0.1, 0.05, 0.85, c(0.3, 0.7)),
  list("NI | 30/70 | Sign-up conversion", 0.18, 0.06, 0.05, 0.8, c(0.3, 0.7)),
  list("NI | 30/70 | Low baseline, loose margin", 0.02, 0.2, 0.05, 0.8, c(0.3, 0.7)),

  # --- 80/20 split ---
  list("NI | 80/20 | Basic", 0.1, 0.1, 0.05, 0.8, c(0.8, 0.2)),
  list("NI | 80/20 | High power, tight margin", 0.2, 0.05, 0.025, 0.95, c(0.8, 0.2)),
  list("NI | 80/20 | E-commerce conversion", 0.03, 0.1, 0.05, 0.8, c(0.8, 0.2)),

  # --- 20/80 split ---
  list("NI | 20/80 | Conservative", 0.05, 0.05, 0.025, 0.9, c(0.2, 0.8)),
  list("NI | 20/80 | Email open rate", 0.25, 0.04, 0.05, 0.9, c(0.2, 0.8)),
  list("NI | 20/80 | Medium baseline, medium margin", 0.15, 0.1, 0.05, 0.85, c(0.2, 0.8)),

  # --- 90/10 split ---
  list("NI | 90/10 | Basic", 0.1, 0.1, 0.05, 0.8, c(0.9, 0.1)),
  list("NI | 90/10 | High baseline, tight margin", 0.3, 0.05, 0.05, 0.8, c(0.9, 0.1)),
  list("NI | 90/10 | Click-through rate", 0.08, 0.125, 0.025, 0.85, c(0.9, 0.1)),

  # --- 10/90 split ---
  list("NI | 10/90 | Sign-up conversion", 0.18, 0.06, 0.05, 0.8, c(0.1, 0.9)),
  list("NI | 10/90 | E-commerce conversion", 0.03, 0.1, 0.05, 0.8, c(0.1, 0.9)),
  list("NI | 10/90 | Low baseline, loose margin", 0.02, 0.2, 0.05, 0.8, c(0.1, 0.9)),

  # --- 99/1 split ---
  list("NI | 99/1 | Basic", 0.1, 0.1, 0.05, 0.8, c(0.99, 0.01)),
  list("NI | 99/1 | High power, tight margin", 0.2, 0.05, 0.025, 0.95, c(0.99, 0.01)),
  list("NI | 99/1 | Email open rate", 0.25, 0.04, 0.05, 0.9, c(0.99, 0.01)),

  # --- 1/99 split ---
  list("NI | 1/99 | Conservative", 0.05, 0.05, 0.025, 0.9, c(0.01, 0.99)),
  list("NI | 1/99 | E-commerce conversion", 0.03, 0.1, 0.05, 0.8, c(0.01, 0.99)),
  list("NI | 1/99 | High baseline, tight margin", 0.3, 0.05, 0.05, 0.8, c(0.01, 0.99))
)

js_test_cases <- sapply(test_cases, function(params) {
  generate_test_case(params[[1]], params[[2]], params[[3]], params[[4]], params[[5]], params[[6]])
})

cat(" // Start of tests generated from epiR::epi.ssninfb on", format(Sys.time(), "%Y-%m-%d"), "\n")
cat(paste(js_test_cases, collapse = ",\n"))
cat(",\n")
cat("\n", "  // End of tests generated from epiR::epi.ssninfb on", format(Sys.time(), "%Y-%m-%d"))
