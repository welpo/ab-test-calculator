import {
  calculateSampleSize,
  calculateMDE,
  calculateMDEFromSampleSize,
} from "./statistics.js";

let passedTests = 0;
let failedTests = 0;
let failedTestNames = [];

function areClose(a, b, tolerance = 0.01) {
  if (a === 0 && b === 0) return true;
  const relError = Math.abs((a - b) / Math.max(Math.abs(a), Math.abs(b)));
  return relError <= tolerance;
}

function createDebugPanel() {
  const debugPanel = document.createElement("div");
  debugPanel.id = "debug-panel";
  debugPanel.style.cssText =
    "position: fixed; bottom: 10px; right: 10px; background: rgba(30,30,30,0.9); color: white; padding: 10px; max-width: min(500px, calc(100vw - 20px)); width: 100%; max-height: 500px; overflow-y: auto; font-family: monospace; font-size: 12px; z-index: 9999; border-radius: 6px; box-shadow: 0 4px 8px rgba(0,0,0,0.3); transition: all 0.3s ease;";
  const header = document.createElement("div");
  header.style.cssText =
    "display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.2);";

  const title = document.createElement("h3");
  title.textContent = "🧪 Test results";
  title.style.cssText = "margin: 0; font-size: 14px; color: #fff;";

  const closeButton = document.createElement("button");
  closeButton.textContent = "×";
  closeButton.style.cssText =
    "background: none; border: none; color: #ccc; font-size: 18px; cursor: pointer; padding: 0 5px;";
  closeButton.onclick = function () {
    debugPanel.style.opacity = "0";
    setTimeout(() => {
      debugPanel.style.display = "none";
    }, 300);
  };

  header.appendChild(title);
  header.appendChild(closeButton);
  debugPanel.appendChild(header);

  const content = document.createElement("div");
  content.id = "debug-content";
  content.style.cssText = "overflow-y: auto; max-height: 320px;";
  debugPanel.appendChild(content);

  const controls = document.createElement("div");
  controls.style.cssText =
    "display: flex; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);";

  const clearButton = document.createElement("button");
  clearButton.textContent = "Clear";
  clearButton.style.cssText =
    "background: #555; border: none; color: white; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px;";
  clearButton.onclick = function () {
    document.getElementById("debug-content").innerHTML = "";
    passedTests = 0;
    failedTests = 0;
  };

  const runTestsButton = document.createElement("button");
  runTestsButton.textContent = "Run Tests Again";
  runTestsButton.style.cssText =
    "background: #4a90e2; border: none; color: white; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px;";
  runTestsButton.onclick = function () {
    document.getElementById("debug-content").innerHTML = "";
    passedTests = 0;
    failedTests = 0;
    runAllTests();
  };

  controls.appendChild(clearButton);
  controls.appendChild(runTestsButton);
  debugPanel.appendChild(controls);

  return debugPanel;
}

function debugLog(message, type = "info") {
  const content = document.getElementById("debug-content");
  if (!content) return;

  const p = document.createElement("div");
  p.style.cssText =
    "margin: 4px 0; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.1);";

  switch (type) {
    case "pass":
      p.style.color = "#4caf50";
      message = `✅ ${message}`;
      break;
    case "fail":
      p.style.color = "#f44336";
      message = `❌ ${message}`;
      break;
    case "header":
      p.style.fontWeight = "bold";
      p.style.color = "#ffeb3b";
      p.style.paddingTop = "6px";
      break;
    case "summary":
      p.style.fontWeight = "bold";
      p.style.marginTop = "8px";
      break;
    default:
      p.style.color = "#ffffff";
  }

  p.textContent = message;
  content.appendChild(p);
  console.log(message);

  requestAnimationFrame(() => {
    content.scrollTop = content.scrollHeight;
  });
}

const regressionTestCases = [
  // Start of tests generated from TrialSize::TwoSampleProportion.NIS (margin=0) on 2025-06-21
  {
    name: "Small superiority",
    baseline: 0.1,
    relativeEffectSize: 0.02,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "superiority",
    correctionMethod: "none",
    expectedSampleSize: 280682,
  },
  {
    name: "Basic superiority",
    baseline: 0.1,
    relativeEffectSize: 0.2,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "superiority",
    correctionMethod: "none",
    expectedSampleSize: 3023,
  },
  {
    name: "High power superiority",
    baseline: 0.05,
    relativeEffectSize: 0.4,
    alpha: 0.05,
    power: 0.9,
    variantCount: 2,
    buffer: 0,
    testType: "superiority",
    correctionMethod: "none",
    expectedSampleSize: 2411,
  },
  {
    name: "Small effect superiority",
    baseline: 0.2,
    relativeEffectSize: 0.1,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "superiority",
    correctionMethod: "none",
    expectedSampleSize: 5125,
  },
  {
    name: "Large effect superiority",
    baseline: 0.15,
    relativeEffectSize: 0.5,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "superiority",
    correctionMethod: "none",
    expectedSampleSize: 332,
  },
  {
    name: "Strict alpha superiority",
    baseline: 0.1,
    relativeEffectSize: 0.3,
    alpha: 0.01,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "superiority",
    correctionMethod: "none",
    expectedSampleSize: 2265,
  },
  {
    name: "Conservative superiority",
    baseline: 0.08,
    relativeEffectSize: 0.25,
    alpha: 0.025,
    power: 0.95,
    variantCount: 2,
    buffer: 0,
    testType: "superiority",
    correctionMethod: "none",
    expectedSampleSize: 5315,
  },
  {
    name: "E-commerce superiority",
    baseline: 0.03,
    relativeEffectSize: 0.33,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "superiority",
    correctionMethod: "none",
    expectedSampleSize: 4252,
  },
  {
    name: "Email superiority",
    baseline: 0.25,
    relativeEffectSize: 0.2,
    alpha: 0.05,
    power: 0.85,
    variantCount: 2,
    buffer: 0,
    testType: "superiority",
    correctionMethod: "none",
    expectedSampleSize: 1143,
  },
  {
    name: "Sign-up superiority",
    baseline: 0.12,
    relativeEffectSize: 0.15,
    alpha: 0.05,
    power: 0.9,
    variantCount: 2,
    buffer: 0,
    testType: "superiority",
    correctionMethod: "none",
    expectedSampleSize: 5935,
  },
  {
    name: "Purchase superiority",
    baseline: 0.45,
    relativeEffectSize: 0.1,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "superiority",
    correctionMethod: "none",
    expectedSampleSize: 1519,
  },
  // End of tests generated from TrialSize::TwoSampleProportion.NIS (margin=0) on 2025-06-21

  // Tests generated by TrialSize::TwoSampleProportion.Equality.
  {
    name: "Basic two-tailed",
    baseline: 0.1,
    relativeEffectSize: 0.2,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "two-tailed",
    correctionMethod: "none",
    expectedSampleSize: 3838,
  },
  {
    name: "High power equality",
    baseline: 0.05,
    relativeEffectSize: 0.4,
    alpha: 0.05,
    power: 0.9,
    variantCount: 2,
    buffer: 0,
    testType: "two-tailed",
    correctionMethod: "none",
    expectedSampleSize: 2958,
  },
  {
    name: "Small effect",
    baseline: 0.2,
    relativeEffectSize: 0.1,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "two-tailed",
    correctionMethod: "none",
    expectedSampleSize: 6507,
  },
  {
    name: "Large effect",
    baseline: 0.15,
    relativeEffectSize: 0.5,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "two-tailed",
    correctionMethod: "none",
    expectedSampleSize: 421,
  },
  {
    name: "Strict alpha",
    baseline: 0.1,
    relativeEffectSize: 0.3,
    alpha: 0.01,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "two-tailed",
    correctionMethod: "none",
    expectedSampleSize: 2636,
  },
  {
    name: "Conservative test",
    baseline: 0.08,
    relativeEffectSize: 0.25,
    alpha: 0.025,
    power: 0.95,
    variantCount: 2,
    buffer: 0,
    testType: "two-tailed",
    correctionMethod: "none",
    expectedSampleSize: 6177,
  },
  {
    name: "E-commerce conversion",
    baseline: 0.03,
    relativeEffectSize: 0.33,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "two-tailed",
    correctionMethod: "none",
    expectedSampleSize: 5398,
  },
  {
    name: "Email click rate",
    baseline: 0.25,
    relativeEffectSize: 0.2,
    alpha: 0.05,
    power: 0.85,
    variantCount: 2,
    buffer: 0,
    testType: "two-tailed",
    correctionMethod: "none",
    expectedSampleSize: 1428,
  },
  {
    name: "Sign-up rate",
    baseline: 0.12,
    relativeEffectSize: 0.15,
    alpha: 0.05,
    power: 0.9,
    variantCount: 2,
    buffer: 0,
    testType: "two-tailed",
    correctionMethod: "none",
    expectedSampleSize: 7282,
  },
  {
    name: "Purchase completion",
    baseline: 0.45,
    relativeEffectSize: 0.1,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "two-tailed",
    correctionMethod: "none",
    expectedSampleSize: 1928,
  },
  // End of tests generated by TrialSize::TwoSampleProportion.Equality.

  // Start of tests generated from epiR::epi.ssninfb.
  {
    name: "Basic non-inferiority",
    baseline: 0.1,
    relativeEffectSize: 0.1,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "non-inferiority",
    correctionMethod: "none",
    expectedSampleSize: 11129,
  },
  {
    name: "Conservative non-inferiority",
    baseline: 0.05,
    relativeEffectSize: 0.05,
    alpha: 0.025,
    power: 0.9,
    variantCount: 2,
    buffer: 0,
    testType: "non-inferiority",
    correctionMethod: "none",
    expectedSampleSize: 159713,
  },
  {
    name: "High baseline, tight margin",
    baseline: 0.3,
    relativeEffectSize: 0.05,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "non-inferiority",
    correctionMethod: "none",
    expectedSampleSize: 11541,
  },
  {
    name: "Low baseline, loose margin",
    baseline: 0.02,
    relativeEffectSize: 0.2,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "non-inferiority",
    correctionMethod: "none",
    expectedSampleSize: 15148,
  },
  {
    name: "Medium baseline, medium margin",
    baseline: 0.15,
    relativeEffectSize: 0.1,
    alpha: 0.05,
    power: 0.85,
    variantCount: 2,
    buffer: 0,
    testType: "non-inferiority",
    correctionMethod: "none",
    expectedSampleSize: 8148,
  },
  {
    name: "High power, tight margin",
    baseline: 0.2,
    relativeEffectSize: 0.05,
    alpha: 0.025,
    power: 0.95,
    variantCount: 2,
    buffer: 0,
    testType: "non-inferiority",
    correctionMethod: "none",
    expectedSampleSize: 41584,
  },
  {
    name: "E-commerce conversion",
    baseline: 0.03,
    relativeEffectSize: 0.1,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "non-inferiority",
    correctionMethod: "none",
    expectedSampleSize: 39981,
  },
  {
    name: "Email open rate",
    baseline: 0.25,
    relativeEffectSize: 0.04,
    alpha: 0.05,
    power: 0.9,
    variantCount: 2,
    buffer: 0,
    testType: "non-inferiority",
    correctionMethod: "none",
    expectedSampleSize: 32115,
  },
  {
    name: "Click-through rate",
    baseline: 0.08,
    relativeEffectSize: 0.125,
    alpha: 0.025,
    power: 0.85,
    variantCount: 2,
    buffer: 0,
    testType: "non-inferiority",
    correctionMethod: "none",
    expectedSampleSize: 13217,
  },
  {
    name: "Sign-up conversion",
    baseline: 0.18,
    relativeEffectSize: 0.06,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "non-inferiority",
    correctionMethod: "none",
    expectedSampleSize: 15648,
  },
  // End of tests generated from epiR::epi.ssninfb.

  // Start of tests generated from TrialSize::TwoSampleProportion.NIS on 2025-06-21
  {
    name: "Basic non-inferiority",
    baseline: 0.1,
    relativeEffectSize: 0.1,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "non-inferiority",
    correctionMethod: "none",
    expectedSampleSize: 11129,
  },
  {
    name: "Conservative non-inferiority",
    baseline: 0.05,
    relativeEffectSize: 0.05,
    alpha: 0.025,
    power: 0.9,
    variantCount: 2,
    buffer: 0,
    testType: "non-inferiority",
    correctionMethod: "none",
    expectedSampleSize: 159713,
  },
  {
    name: "Tight margin non-inf",
    baseline: 0.2,
    relativeEffectSize: 0.02,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "non-inferiority",
    correctionMethod: "none",
    expectedSampleSize: 123651,
  },
  {
    name: "Loose margin non-inf",
    baseline: 0.15,
    relativeEffectSize: 0.15,
    alpha: 0.05,
    power: 0.85,
    variantCount: 2,
    buffer: 0,
    testType: "non-inferiority",
    correctionMethod: "none",
    expectedSampleSize: 3621,
  },
  {
    name: "High power non-inf",
    baseline: 0.3,
    relativeEffectSize: 0.05,
    alpha: 0.05,
    power: 0.95,
    variantCount: 2,
    buffer: 0,
    testType: "non-inferiority",
    correctionMethod: "none",
    expectedSampleSize: 20201,
  },
  {
    name: "Strict alpha non-inf",
    baseline: 0.12,
    relativeEffectSize: 0.08,
    alpha: 0.01,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "non-inferiority",
    correctionMethod: "none",
    expectedSampleSize: 22999,
  },
  {
    name: "E-commerce non-inf",
    baseline: 0.03,
    relativeEffectSize: 0.2,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "non-inferiority",
    correctionMethod: "none",
    expectedSampleSize: 9995,
  },
  {
    name: "Email non-inf",
    baseline: 0.25,
    relativeEffectSize: 0.04,
    alpha: 0.05,
    power: 0.9,
    variantCount: 2,
    buffer: 0,
    testType: "non-inferiority",
    correctionMethod: "none",
    expectedSampleSize: 32114,
  },
  {
    name: "Click rate non-inf",
    baseline: 0.08,
    relativeEffectSize: 0.1,
    alpha: 0.025,
    power: 0.85,
    variantCount: 2,
    buffer: 0,
    testType: "non-inferiority",
    correctionMethod: "none",
    expectedSampleSize: 20650,
  },
  {
    name: "Purchase non-inf",
    baseline: 0.45,
    relativeEffectSize: 0.03,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "non-inferiority",
    correctionMethod: "none",
    expectedSampleSize: 16792,
  },
  // End of tests generated from TrialSize::TwoSampleProportion.NIS on 2025-06-21

  // Start of tests generated from TrialSize::TwoSampleProportion.Equivalence on 2025-06-21
  {
    name: "Basic equivalence",
    baseline: 0.1,
    relativeEffectSize: 0.1,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "equivalence",
    correctionMethod: "none",
    expectedSampleSize: 15415,
  },
  {
    name: "Tight equivalence",
    baseline: 0.2,
    relativeEffectSize: 0.05,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "equivalence",
    correctionMethod: "none",
    expectedSampleSize: 27404,
  },
  {
    name: "Loose equivalence",
    baseline: 0.15,
    relativeEffectSize: 0.15,
    alpha: 0.05,
    power: 0.85,
    variantCount: 2,
    buffer: 0,
    testType: "equivalence",
    correctionMethod: "none",
    expectedSampleSize: 4792,
  },
  {
    name: "High power equivalence",
    baseline: 0.3,
    relativeEffectSize: 0.08,
    alpha: 0.05,
    power: 0.95,
    variantCount: 2,
    buffer: 0,
    testType: "equivalence",
    correctionMethod: "none",
    expectedSampleSize: 9475,
  },
  {
    name: "Conservative equivalence",
    baseline: 0.05,
    relativeEffectSize: 0.06,
    alpha: 0.025,
    power: 0.9,
    variantCount: 2,
    buffer: 0,
    testType: "equivalence",
    correctionMethod: "none",
    expectedSampleSize: 137166,
  },
  {
    name: "Strict alpha equivalence",
    baseline: 0.12,
    relativeEffectSize: 0.1,
    alpha: 0.01,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "equivalence",
    correctionMethod: "none",
    expectedSampleSize: 19092,
  },
  {
    name: "E-commerce equivalence",
    baseline: 0.03,
    relativeEffectSize: 0.2,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "equivalence",
    correctionMethod: "none",
    expectedSampleSize: 13845,
  },
  {
    name: "Email equivalence",
    baseline: 0.25,
    relativeEffectSize: 0.08,
    alpha: 0.05,
    power: 0.9,
    variantCount: 2,
    buffer: 0,
    testType: "equivalence",
    correctionMethod: "none",
    expectedSampleSize: 10146,
  },
  {
    name: "Click rate equivalence",
    baseline: 0.08,
    relativeEffectSize: 0.12,
    alpha: 0.025,
    power: 0.85,
    variantCount: 2,
    buffer: 0,
    testType: "equivalence",
    correctionMethod: "none",
    expectedSampleSize: 18458,
  },
  {
    name: "Purchase equivalence",
    baseline: 0.45,
    relativeEffectSize: 0.04,
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
    buffer: 0,
    testType: "equivalence",
    correctionMethod: "none",
    expectedSampleSize: 13084,
  },
  // End of tests generated from TrialSize::TwoSampleProportion.Equivalence on 2025-06-21
];

// Test that MDE -> SampleSize -> MDE returns the original MDE.
const symmetryTestCases = [
  {
    name: "Symmetry: Standard Two-Tailed",
    baseline: 5.0,
    mde: 10.0,
    isRelative: true,
    testType: "two-tailed",
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
  },
  {
    name: "Symmetry: Absolute MDE",
    baseline: 2.5,
    mde: 0.5,
    isRelative: false,
    testType: "two-tailed",
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
  },
  {
    name: "Symmetry: High Power One-Tailed",
    baseline: 20.0,
    mde: 5.0,
    isRelative: true,
    testType: "superiority",
    alpha: 0.05,
    power: 0.95,
    variantCount: 2,
  },
  {
    name: "Symmetry: Equivalence, Bonferroni",
    baseline: 10.0,
    mde: 1.5,
    isRelative: false,
    testType: "equivalence",
    alpha: 0.05,
    power: 0.8,
    variantCount: 4,
    correction: "bonferroni",
  },
  {
    name: "Symmetry: Non-Inferiority, Sidak",
    baseline: 15.0,
    mde: 4.0,
    isRelative: true,
    testType: "non-inferiority",
    alpha: 0.05,
    power: 0.8,
    variantCount: 3,
    correction: "sidak",
  },
  {
    name: "Symmetry: One-Tailed, Absolute MDE",
    baseline: 8.0,
    mde: 0.75,
    isRelative: false,
    testType: "superiority",
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
  },
  {
    name: "Symmetry: Equivalence, Relative MDE (2 Variants)",
    baseline: 40.0,
    mde: 2.0,
    isRelative: true,
    testType: "equivalence",
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
  },
  {
    name: "Symmetry: Non-Inferiority, Absolute Margin",
    baseline: 50.0,
    mde: 0.5,
    isRelative: false,
    testType: "non-inferiority",
    alpha: 0.05,
    power: 0.8,
    variantCount: 3,
    correction: "bonferroni",
  },
  {
    name: "Symmetry: Multi-Variant, No Correction",
    baseline: 12.0,
    mde: 8.0,
    isRelative: true,
    testType: "two-tailed",
    alpha: 0.05,
    power: 0.8,
    variantCount: 5,
    correction: "none",
  },
  {
    name: "Symmetry: Edge Case - Very Low Baseline",
    baseline: 0.2,
    mde: 50.0,
    isRelative: true,
    testType: "two-tailed",
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
  },
  {
    name: "Symmetry: Edge Case - Very High Baseline",
    baseline: 95.0,
    mde: 1.0,
    isRelative: true,
    testType: "superiority",
    alpha: 0.05,
    power: 0.8,
    variantCount: 2,
  },
];

async function runDirectTest(testCase) {
  debugLog(`Running test: ${testCase.name}`, "header");

  try {
    const calculatedSampleSize = calculateSampleSize(
      testCase.baseline,
      testCase.relativeEffectSize,
      testCase.alpha,
      testCase.power,
      testCase.variantCount,
      testCase.buffer || 0,
      testCase.testType || "two-tailed",
      testCase.correctionMethod || "none"
    );

    debugLog(`  Calculated sample size: ${calculatedSampleSize}`);

    const difference = calculatedSampleSize - testCase.expectedSampleSize;
    const percentDiff = (
      (difference / testCase.expectedSampleSize) *
      100
    ).toFixed(3);

    debugLog(`  Difference: ${difference} (${percentDiff}%)`);

    if (calculatedSampleSize === testCase.expectedSampleSize) {
      debugLog(`Test passed`, "pass");
      passedTests++;
      return true;
    } else if (areClose(calculatedSampleSize, testCase.expectedSampleSize)) {
      debugLog(`Test passed: Results are within tolerance`, "pass");
      passedTests++;
      return true;
    } else {
      debugLog(`Test failed: Results exceed tolerance`, "fail");
      failedTests++;
      failedTestNames.push(testCase.name);
      return false;
    }
  } catch (error) {
    debugLog(`Test error: ${error.message}`, "fail");
    failedTests++;
    failedTestNames.push(`${testCase.name} (Error: ${error.message})`);
    return false;
  }
}

async function runSymmetryTest(testCase) {
  debugLog(`Test: ${testCase.name}`, "subheader");
  const originalGetParams = window.getCalculationParameters;
  window.getCalculationParameters = () => ({
    baseline: testCase.baseline,
    mde: testCase.mde,
    variantCount: testCase.variantCount,
    alpha: testCase.alpha,
    power: testCase.power,
    testType: testCase.testType,
    buffer: 0,
    isRelativeMode: testCase.isRelative,
    correctionMethod: testCase.correction || "none",
  });
  try {
    const mdeInfo = calculateMDE(
      testCase.baseline,
      testCase.mde,
      testCase.isRelative,
      testCase.testType
    );
    const preciseSampleSize = calculateSampleSize(
      mdeInfo.baselineRate,
      mdeInfo.relMDE,
      testCase.alpha,
      testCase.power,
      testCase.variantCount,
      0,
      testCase.testType,
      testCase.correction || "none"
    );
    const recoveredMde = calculateMDEFromSampleSize(
      preciseSampleSize,
      window.getCalculationParameters()
    );
    if (areClose(testCase.mde, recoveredMde)) {
      debugLog(
        `Test passed - Original MDE: ${testCase.mde.toFixed(
          2
        )}, Recovered: ${recoveredMde.toFixed(2)}`,
        "pass"
      );
      passedTests++;
    } else {
      debugLog(
        `Test failed - Original MDE: ${testCase.mde.toFixed(
          2
        )}, Recovered: ${recoveredMde.toFixed(2)}`,
        "fail"
      );
      failedTests++;
      failedTestNames.push(`${testCase.name}`);
    }
  } catch (error) {
    debugLog(`Test error: ${error.message}`, "fail");
    failedTests++;
    failedTestNames.push(`${testCase.name} (Error)`);
  } finally {
    window.getCalculationParameters = originalGetParams;
  }
}

async function runAllTests() {
  debugLog("Running tests…", "header");
  passedTests = 0;
  failedTests = 0;
  failedTestNames = [];
  for (const testCase of regressionTestCases) {
    await runDirectTest(testCase);
  }
  debugLog("Running symmetry (bi-directionality) tests...", "header");
  for (const testCase of symmetryTestCases) {
    await runSymmetryTest(testCase);
  }
  const totalTests = regressionTestCases.length + symmetryTestCases.length;
  debugLog(
    `${passedTests}/${totalTests} tests passed (${Math.round(
      (passedTests / totalTests) * 100
    )}%)`,
    "summary"
  );
  if (failedTests === 0) {
    debugLog("All tests passed! 🎉", "pass");
  } else {
    debugLog(`${failedTests} tests failed. Failed tests:`, "fail");
    failedTestNames.forEach((testName, index) => {
      debugLog(` ${index + 1}. ${testName}`, "fail");
    });
  }
}

function initTests() {
  if (window.location.search.includes("?test")) {
    if (!document.getElementById("debug-panel")) {
      document.body.appendChild(createDebugPanel());
    }
    runAllTests();
  }
}

initTests();
