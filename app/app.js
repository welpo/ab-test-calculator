import {
  calculateSampleSize,
  calculateMDE,
  calculateMDEFromSampleSize,
} from "./statistics.js";

// Singular defaults used when adding rows.
const DEFAULT_MDE = 30;
const DEFAULT_DAYS = 30;
const DEFAULT_MDES = [5, 10, 15, 20, 25];
const DEFAULT_TIMES = [7, 14, 30, 60, 90];
const ADVANCED_DEFAULTS = {
  alpha: 0.05,
  power: 0.8,
  testType: "one-sided",
  correction: "none",
  trafficFlow: 100,
  buffer: 0,
};

const CALCULATION_DELAY = 80;
const sortDelay = 300;
let sortDebounceTimer = null;
let calculationDebounceTimer = null;
let hasCustomTrafficDistribution = false;

// Basic inputs.
const visitorsInput = document.getElementById("visitors");
const baselineInput = document.getElementById("baseline");
const mdeInput = document.getElementById("mde");
const variantsSelect = document.getElementById("variants");
const relativeMode = document.getElementById("relativeMode");
const absoluteMode = document.getElementById("absoluteMode");
const multipleMdesText = document.getElementById("multipleMdes");
const tabSingle = document.getElementById("tab-single");
const tabTable = document.getElementById("tab-table");
const tabSingleLabel = document.querySelector('label[for="tab-single"]');
const tabTableLabel = document.querySelector('label[for="tab-table"]');

// Advanced settings.
const advancedStatusDot = document.getElementById("advancedStatusDot");
const tooltipModifications = document.getElementById("tooltipModifications");
const advancedHeader = document.querySelector(".advanced-header");
const alphaInput = document.getElementById("alpha");
const alphaRangeInput = document.getElementById("alphaRange");
const powerInput = document.getElementById("power");
const powerRangeInput = document.getElementById("powerRange");
const testTypeInputs = document.querySelectorAll('input[name="testType"]');
const correctionSelect = document.getElementById("correction");
const trafficFlowInput = document.getElementById("trafficFlow");
const trafficFlowRangeInput = document.getElementById("trafficFlowRange");
const bufferInput = document.getElementById("buffer");
const bufferRangeInput = document.getElementById("bufferRange");

// Errors.
const errorContainer = document.getElementById("errorContainer");
const errorList = document.getElementById("errorList");
const allInputs = [
  visitorsInput,
  baselineInput,
  mdeInput,
  alphaInput,
  powerInput,
  trafficFlowInput,
  bufferInput,
];

// Results.
const durationValueElem = document.getElementById("durationValue");
const sampleValueElem = document.getElementById("sampleValue");
const timeEstimateElem = document.getElementById("timeEstimate");
const relativeChangeElem = document.getElementById("relativeChange");
const fromValueElem = document.getElementById("fromValue");
const toValueElem = document.getElementById("toValue");
const variantDistributionContainer = document.getElementById(
  "variantDistributionContainer"
);
const mdeTable = document.getElementById("mdeTable");
const mdeTableBody = mdeTable.querySelector("tbody");
const addRowBtn = document.getElementById("addRowBtn");
const resetMDETableBtn = document.getElementById("resetMDETableBtn");
const tabTime = document.getElementById("tab-time");
const tabTimeLabel = document.querySelector('label[for="tab-time"]');
const timeTable = document.getElementById("timeTable");
const timeTableBody = timeTable.querySelector("tbody");
const addTimeRowBtn = document.getElementById("addTimeRowBtn");
const resetTimeTableBtn = document.getElementById("resetTimeTableBtn");
const shareButton = document.getElementById("sharePlan");
const downloadCSVBtn = document.getElementById("downloadCSVBtn");
const downloadTimeCSVBtn = document.getElementById("downloadTimeCSVBtn");
const experimentNameInput = document.getElementById("experimentName");
const originalTitle = "A/B Test Sample Size & Duration Calculator";

initializeUI();

// ===== Event Listeners =====
// Basic inputs
visitorsInput.addEventListener("input", function () {
  debouncedCalculation();
});
baselineInput.addEventListener("input", function () {
  debouncedCalculation();
  updateMDETooltips();
});

mdeInput.addEventListener("input", function () {
  debouncedCalculation();
  updateMDETooltips();
});
mdeInput.addEventListener("input", updateMDETooltips);
variantsSelect.addEventListener("change", handleVariantsChange);
relativeMode.addEventListener("change", updateMDEMode);
absoluteMode.addEventListener("change", updateMDEMode);
tabSingle.addEventListener("change", handleTabChange);
tabTable.addEventListener("change", handleTabChange);
tabTime.addEventListener("change", handleTabChange);
tabTimeLabel.addEventListener("keydown", handleTabKeyPress);
addTimeRowBtn.addEventListener("click", addTimeRow);
resetTimeTableBtn.addEventListener("click", initializeTimeToMDETable);

// Advanced inputs.
alphaInput.addEventListener(
  "input",
  syncRangeWithInput.bind(null, alphaInput, alphaRangeInput)
);
alphaRangeInput.addEventListener(
  "input",
  syncInputWithRange.bind(null, alphaRangeInput, alphaInput)
);
powerInput.addEventListener(
  "input",
  syncRangeWithInput.bind(null, powerInput, powerRangeInput)
);
powerRangeInput.addEventListener(
  "input",
  syncInputWithRange.bind(null, powerRangeInput, powerInput)
);
testTypeInputs.forEach((input) => {
  input.addEventListener("change", function () {
    updateCalculation();
    updateMDEMode();
  });
});
correctionSelect.addEventListener("change", updateCalculation);
trafficFlowInput.addEventListener(
  "input",
  syncRangeWithInput.bind(null, trafficFlowInput, trafficFlowRangeInput)
);
trafficFlowRangeInput.addEventListener(
  "input",
  syncInputWithRange.bind(null, trafficFlowRangeInput, trafficFlowInput)
);
bufferInput.addEventListener(
  "input",
  syncRangeWithInput.bind(null, bufferInput, bufferRangeInput)
);
bufferRangeInput.addEventListener(
  "input",
  syncInputWithRange.bind(null, bufferRangeInput, bufferInput)
);

addRowBtn.addEventListener("click", addMDERow);
resetMDETableBtn.addEventListener("click", initializeMDEToTimeTable);
downloadCSVBtn.addEventListener("click", function () {
  downloadTableAsCSV("mdeTable");
});
downloadTimeCSVBtn.addEventListener("click", function () {
  downloadTableAsCSV("timeTable");
});

function initializeUI() {
  initializeTabs();
  updateVariantUI();
  const urlParams = new URLSearchParams(window.location.search);
  updateCalculation();
  updateMDETooltips();
  if (urlParams.size === 0 || !urlParams.has("tblmde")) {
    initializeMDEToTimeTable();
  }
  if (urlParams.size === 0 || !urlParams.has("tbltime")) {
    initializeTimeToMDETable();
  }
}

function initializeTabs() {
  const selectedTabId = tabSingle.checked
    ? "tab-single"
    : tabTable.checked
    ? "tab-table"
    : "tab-time";
  updateTabUI(selectedTabId);
}

function updateTabUI(selectedTabId) {
  tabSingleLabel.setAttribute("aria-selected", selectedTabId === "tab-single");
  tabTableLabel.setAttribute("aria-selected", selectedTabId === "tab-table");
  tabTimeLabel.setAttribute("aria-selected", selectedTabId === "tab-time");
  if (selectedTabId === "tab-single") {
    mdeInput.classList.remove("hidden");
    multipleMdesText.classList.add("hidden");
  } else {
    mdeInput.classList.add("hidden");
    multipleMdesText.classList.remove("hidden");
  }
  const tabContents = document.querySelectorAll(".tab-content");
  tabContents.forEach((content) => {
    content.style.display = "none";
  });
  const selectedContent = document.getElementById(`${selectedTabId}-content`);
  if (selectedContent) {
    selectedContent.style.display = "block";
  }
}

function handleTabChange(e) {
  updateTabUI(e.target.id);
}

tabSingleLabel.addEventListener("keydown", handleTabKeyPress);
tabTableLabel.addEventListener("keydown", handleTabKeyPress);

function debouncedCalculation() {
  clearTimeout(calculationDebounceTimer);
  calculationDebounceTimer = setTimeout(() => {
    updateCalculation();
  }, CALCULATION_DELAY);
}

function handleTabKeyPress(e) {
  // Enter or Space activates the tab.
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    const tabInput = document.getElementById(this.getAttribute("for"));
    tabInput.checked = true;
    updateTabUI(tabInput.id);
  }
}

function updateMDEMode() {
  const isRelativeMode = document.getElementById("relativeMode").checked;
  const testType =
    document.querySelector('input[name="testType"]:checked')?.value ||
    "two-sided";
  const unit = isRelativeMode ? "(%)" : "(points)";
  const labelData = getLabelsForTestType(testType);
  const mdeLabel = document.querySelector('label[for="mde"]');
  if (mdeLabel) {
    mdeLabel.textContent = `${labelData.label} ${unit}`;
  }
  const mainTooltip = document.querySelector(
    'label[for="mde"] + .tooltip-trigger .tooltip'
  );
  if (mainTooltip) {
    mainTooltip.textContent = labelData.tooltip;
  }
  const tableMDEHeader = document.querySelector("#mdeTable th:first-child");
  if (tableMDEHeader) {
    tableMDEHeader.innerHTML = isRelativeMode ? "Δ (%)" : "Δ (points)";
  }
  updateCalculation();
  updateMDETooltips();
}

function getLabelsForTestType(testType) {
  const labels = {
    "two-sided": {
      label: "Minimum detectable effect",
      tooltip: "The smallest change (up or down) you want to reliably detect",
    },
    "one-sided": {
      label: "Minimum detectable improvement",
      tooltip: "The smallest improvement you want to reliably detect",
    },
    "non-inferiority": {
      label: "Maximum acceptable decrease",
      tooltip: "How much worse the new version can be before you reject it",
    },
    equivalence: {
      label: "Acceptable difference range",
      tooltip: "How close performance needs to be to call variants equivalent",
    },
  };
  return labels[testType] || labels["two-sided"];
}

function updateMDETooltips() {
  const baseline = parseFloat(baselineInput.value) || 5;
  const mde = parseFloat(mdeInput.value) || 20;
  const relativeIncrease = (baseline * (1 + mde / 100)).toFixed(2);
  const absoluteIncrease = (baseline + mde).toFixed(2);
  const relativeTooltip = document.querySelector(
    'label[for="relativeMode"] .tooltip, #relativeMode ~ .tooltip-trigger .tooltip'
  );
  const absoluteTooltip = document.querySelector(
    'label[for="absoluteMode"] .tooltip, #absoluteMode ~ .tooltip-trigger .tooltip'
  );
  if (relativeTooltip) {
    relativeTooltip.textContent = `'${mde}%' means going from ${baseline}% to ${relativeIncrease}% conversion rate`;
  }
  if (absoluteTooltip) {
    absoluteTooltip.textContent = `'${mde} points' means going from ${baseline}% to ${absoluteIncrease}% conversion rate`;
  }
}

function handleVariantsChange() {
  updateVariantUI();
  updateCalculation();
}

function updateVariantUI() {
  const variantCount = parseInt(variantsSelect.value);
  updateVariantDistributionUI(variantCount);
}

function updateVariantDistributionUI(variantCount) {
  hasCustomTrafficDistribution = false;
  variantDistributionContainer.innerHTML = "";
  const equalPercentage = Math.floor(100 / variantCount);
  const remainderPercentage = 100 - equalPercentage * variantCount;
  for (let i = 0; i < variantCount; i++) {
    const letter = String.fromCharCode(65 + i); // A, B, C, D, E…
    const percentage =
      i === 0 ? equalPercentage + remainderPercentage : equalPercentage;
    const variantItem = document.createElement("div");
    variantItem.className = "variant-slider-item";
    variantItem.innerHTML = `
          <div class="variant-slider-header">
              <div class="variant-letter-label">
                  ${letter}
              </div>
              <div class="variant-percentage" id="percentage${letter}">${percentage}%</div>
          </div>
          <input type="range"
                  id="slider${letter}"
                  class="variant-range"
                  min="1"
                  max="99"
                  value="${percentage}"
                  data-variant="${letter}">
      `;
    variantDistributionContainer.appendChild(variantItem);
  }
  document.querySelectorAll(".variant-range").forEach((slider) => {
    slider.addEventListener("input", handleSliderChange);
  });
  const resetDistributionBtn = document.getElementById("resetDistributionBtn");
  if (resetDistributionBtn) {
    resetDistributionBtn.addEventListener("click", function () {
      resetToEqualDistribution();
    });
  }
}

function handleSliderChange(e) {
  hasCustomTrafficDistribution = true;
  const changedSlider = e.target;
  const changedVariant = changedSlider.dataset.variant;
  const newValue = parseInt(changedSlider.value);
  const allSliders = document.querySelectorAll(".variant-range");
  const otherSliders = Array.from(allSliders).filter(
    (slider) => slider.dataset.variant !== changedVariant
  );
  const minRequiredForOthers = otherSliders.length;
  const maxAllowedForThis = 100 - minRequiredForOthers;
  if (newValue > maxAllowedForThis) {
    changedSlider.value = maxAllowedForThis;
    const percentageElement = document.getElementById(
      `percentage${changedVariant}`
    );
    if (percentageElement) {
      percentageElement.textContent = `${maxAllowedForThis}%`;
    }
    resetToEqualDistribution();
    return;
  }
  const percentageElement = document.getElementById(
    `percentage${changedVariant}`
  );
  if (percentageElement) {
    percentageElement.textContent = `${newValue}%`;
  }
  let totalPercentage = newValue;
  otherSliders.forEach((slider) => {
    totalPercentage += parseInt(slider.value);
  });
  const adjustmentNeeded = totalPercentage - 100;
  if (adjustmentNeeded !== 0) {
    distributeAdjustment(otherSliders, adjustmentNeeded);
  }
  updateCalculation();
}

function distributeAdjustment(sliders, adjustmentAmount) {
  if (sliders.length === 0) return;
  const currentValues = sliders.map((slider) => parseInt(slider.value));
  const totalOtherValue = currentValues.reduce((sum, val) => sum + val, 0);
  let adjustmentsLeft = adjustmentAmount;
  let adjustedValues = [];
  // First pass: calculate adjustments proportionally.
  for (let i = 0; i < sliders.length; i++) {
    const currentValue = currentValues[i];
    // Calculate proportional adjustment (negative if we need to reduce).
    const weight =
      totalOtherValue > 0 ? currentValue / totalOtherValue : 1 / sliders.length;
    let adjustment = Math.round(adjustmentAmount * weight);
    // Calculate new value with range constraints.
    let newValue = Math.max(1, Math.min(99, currentValue - adjustment));
    // Keep track of the actual adjustment made.
    adjustment = currentValue - newValue;
    adjustmentsLeft -= adjustment;
    adjustedValues.push(newValue);
  }
  // Second pass: distribute any remaining adjustment.
  if (adjustmentsLeft !== 0) {
    // Sort sliders by value to prioritize which ones to adjust.
    const sliderIndices = [...Array(sliders.length).keys()];
    if (adjustmentsLeft > 0) {
      // Need to reduce more, start with larger values.
      sliderIndices.sort((a, b) => adjustedValues[b] - adjustedValues[a]);
    } else {
      // Need to increase more, start with smaller values.
      sliderIndices.sort((a, b) => adjustedValues[a] - adjustedValues[b]);
    }
    // Distribute one point at a time to appropriate sliders.
    // Add a maximum iteration count to prevent infinite loops.
    let maxIterations = 100; // Prevent infinite loops.
    let iterationCount = 0;
    for (
      let i = 0;
      Math.abs(adjustmentsLeft) > 0 &&
      i < sliderIndices.length &&
      iterationCount < maxIterations;
      i++
    ) {
      const idx = sliderIndices[i];
      const adjustment = adjustmentsLeft > 0 ? 1 : -1;
      const newValue = adjustedValues[idx] - adjustment;
      if (newValue >= 1 && newValue <= 99) {
        adjustedValues[idx] = newValue;
        adjustmentsLeft -= adjustment;
      }
      // Circle back if we need more adjustments.
      if (i === sliderIndices.length - 1 && Math.abs(adjustmentsLeft) > 0) {
        i = -1; // Will be incremented to 0 in the next loop iteration.
        iterationCount++;
      }
    }
    // If we still have adjustments left after maxIterations…
    if (Math.abs(adjustmentsLeft) > 0) {
      console.warn(
        `Could not distribute all adjustments (${adjustmentsLeft} remaining). Some constraints couldn't be satisfied.`
      );
      if (adjustmentsLeft > 0) {
        // We need to reduce values but can't - force minimum values.
        for (let i = 0; i < adjustedValues.length; i++) {
          adjustedValues[i] = 1;
        }
        // Distribute remaining among first sliders to reach 100%.
        let remaining = 100 - 1 * adjustedValues.length;
        for (let i = 0; i < adjustedValues.length && remaining > 0; i++) {
          const additionalValue = Math.min(98, remaining);
          adjustedValues[i] += additionalValue;
          remaining -= additionalValue;
        }
      }
    }
  }
  for (let i = 0; i < sliders.length; i++) {
    const slider = sliders[i];
    const newValue = adjustedValues[i];
    slider.value = newValue;
    const percentageElement = document.getElementById(
      `percentage${slider.dataset.variant}`
    );
    if (percentageElement) {
      percentageElement.textContent = `${newValue}%`;
    }
  }
}

function resetToEqualDistribution() {
  hasCustomTrafficDistribution = false;
  let totalToDistribute = 100;
  let slidersToUpdate = [];
  const allSliders = document.querySelectorAll(".variant-range");
  slidersToUpdate = Array.from(allSliders);
  const equalPercentage = Math.floor(
    totalToDistribute / slidersToUpdate.length
  );
  const remainderPercentage =
    totalToDistribute - equalPercentage * slidersToUpdate.length;
  slidersToUpdate.forEach((slider, index) => {
    const percentage =
      index === 0 ? equalPercentage + remainderPercentage : equalPercentage;
    slider.value = percentage;
    const variantLetter = slider.dataset.variant;
    const percentageElement = document.getElementById(
      `percentage${variantLetter}`
    );
    if (percentageElement) {
      percentageElement.textContent = `${percentage}%`;
    }
  });
  updateCalculation();
}

function updateCalculation() {
  const errors = validateInputs();
  const isValid = handleValidationErrors(errors);
  if (!isValid) {
    return;
  }
  const params = getCalculationParameters();
  const mdeResults = calculateMDE(
    params.baseline,
    params.mde,
    params.isRelativeMode,
    params.testType
  );
  const sampleSizePerVariant = calculateSampleSize(
    mdeResults.baselineRate,
    mdeResults.relMDE,
    params.alpha,
    params.power,
    params.variantCount,
    params.buffer,
    params.testType,
    params.correctionMethod
  );
  const distributionInfo = getVariantDistributions(params.variantCount);
  const effectiveVisitors = params.visitors * (params.trafficFlow / 100);
  const durationDays = calculateTestDuration(
    sampleSizePerVariant,
    effectiveVisitors,
    params.variantCount,
    distributionInfo
  );
  updateResultsDisplay({
    duration: durationDays,
    baselineRate: params.baseline,
    targetRate: mdeResults.targetRate * 100,
    samplePerVariant: sampleSizePerVariant,
    variantCount: params.variantCount,
    isRelativeMode: params.isRelativeMode,
    mdePct: params.mde,
  });
  updateMDEToTimeTable();
  updateTimeToMDETable();
  checkAdvancedDefaults();
}

function validateInputs() {
  const errors = [];
  const checkNumberRange = (
    input,
    name,
    {
      min = -Infinity,
      max = Infinity,
      minInclusive = false,
      maxInclusive = false,
    }
  ) => {
    const value = parseFloat(input.value);
    if (isNaN(value)) {
      errors.push({ input, message: `${name} must be a number.` });
      return NaN;
    }
    const minCondition = minInclusive ? value < min : value <= min;
    const maxCondition = maxInclusive ? value > max : value >= max;
    if (minCondition || maxCondition) {
      errors.push({
        input,
        message: `${name} must be between ${min} and ${max}.`,
      });
    }
    return value;
  };
  const visitorsNum = parseFloat(visitorsInput.value);
  if (isNaN(visitorsNum) || visitorsNum <= 0) {
    errors.push({
      input: visitorsInput,
      message: "Daily visitors must be a positive number greater than 0.",
    });
  }
  const baselineNum = checkNumberRange(baselineInput, "Baseline CR", {
    min: 0,
    max: 100,
  });
  checkNumberRange(alphaInput, "Significance level (alpha)", {
    min: 0,
    max: 1,
  });
  checkNumberRange(powerInput, "Statistical power", { min: 0, max: 1 });
  checkNumberRange(trafficFlowInput, "Traffic flow", {
    min: 0,
    max: 100,
    maxInclusive: true,
  });

  const bufferNum = parseFloat(bufferInput.value);
  if (isNaN(bufferNum)) {
    errors.push({ input: bufferInput, message: "Buffer must be a number." });
  } else if (bufferNum < 0) {
    errors.push({ input: bufferInput, message: "Buffer cannot be negative." });
  }

  const mdeNum = parseFloat(mdeInput.value);
  const testType = document.querySelector(
    'input[name="testType"]:checked'
  ).value;
  const isRelativeMode = relativeMode.checked;
  const mdeLabel = getLabelsForTestType(testType).label;
  if (isNaN(mdeNum)) {
    errors.push({ input: mdeInput, message: `"${mdeLabel}" must be a number.` });
    return errors;
  }
  if (mdeNum === 0) {
    errors.push({ input: mdeInput, message: `"${mdeLabel}" cannot be zero.` });
    return errors;
  }
  switch (testType) {
    case "one-sided":
      const targetRate = isRelativeMode
        ? baselineNum * (1 + mdeNum / 100)
        : baselineNum + mdeNum;
      if (mdeNum > 0 && targetRate >= 100) {
        errors.push({
          input: mdeInput,
          message: `An improvement results in an invalid rate of ${targetRate.toFixed(
            2
          )}%.`,
        });
      } else if (mdeNum < 0 && targetRate <= 0) {
        errors.push({
          input: mdeInput,
          message: `A reduction results in an invalid rate of ${targetRate.toFixed(
            2
          )}%.`,
        });
      }
      break;
    default:
      if (mdeNum < 0) {
        errors.push({
          input: mdeInput,
          message: `"${mdeLabel}" must be a positive number.`,
        });
        break;
      }
      if (testType !== "non-inferiority") {
        const upperBound = isRelativeMode
          ? baselineNum * (1 + mdeNum / 100)
          : baselineNum + mdeNum;
        if (upperBound >= 100) {
          errors.push({
            input: mdeInput,
            message: `This "${mdeLabel}" results in an invalid upper bound of ${upperBound.toFixed(
              2
            )}%.`,
          });
        }
      }
      if (testType !== "two-sided") {
        const lowerBound = isRelativeMode
          ? baselineNum * (1 - mdeNum / 100)
          : baselineNum - mdeNum;
        if (lowerBound <= 0) {
          errors.push({
            input: mdeInput,
            message: `This "${mdeLabel}" results in an invalid lower bound of ${lowerBound.toFixed(
              2
            )}%.`,
          });
        }
      }
      break;
  }
  return errors;
}

function handleValidationErrors(errors) {
  errorList.innerHTML = "";
  allInputs.forEach((input) => input.classList.remove("input-error"));
  if (errors.length === 0) {
    errorContainer.classList.add("hidden");
    return true;
  } else {
    errors.forEach((error) => {
      const li = document.createElement("li");
      li.textContent = error.message;
      errorList.appendChild(li);
      error.input.classList.add("input-error");
    });
    errorContainer.classList.remove("hidden");
    return false;
  }
}

function getVariantDistributions(variantCount) {
  const variantDistributions = [];
  let isDistributionUnequal = false;
  let lowestPercentage = 1.0;
  for (let i = 0; i < variantCount; i++) {
    const letter = String.fromCharCode(65 + i);
    const slider = document.getElementById(`slider${letter}`);
    if (slider) {
      const percentage = parseInt(slider.value) / 100;
      variantDistributions.push(percentage);
      if (i > 0 && percentage !== variantDistributions[0]) {
        isDistributionUnequal = true;
      }
      if (percentage < lowestPercentage) {
        lowestPercentage = percentage;
      }
    }
  }
  return {
    distributions:
      variantDistributions.length === variantCount ? variantDistributions : [],
    isUnequal: isDistributionUnequal,
    lowestPercentage: lowestPercentage,
  };
}

function calculateTestDuration(
  sampleSizePerVariant,
  effectiveVisitors,
  variantCount,
  distributionInfo
) {
  let durationDays = 0;
  if (effectiveVisitors > 0) {
    const { distributions, isUnequal, lowestPercentage } = distributionInfo;
    if (isUnequal && distributions.length === variantCount) {
      // For unequal distribution, the variant with lowest percentage determines duration.
      const lowestVariantDailyVisitors = effectiveVisitors * lowestPercentage;
      durationDays = Math.ceil(
        sampleSizePerVariant / lowestVariantDailyVisitors
      );
    } else {
      const variantDailyVisitors = effectiveVisitors / variantCount;
      durationDays = Math.ceil(sampleSizePerVariant / variantDailyVisitors);
    }
  }
  return durationDays;
}

function updateResultsDisplay(results) {
  durationValueElem.textContent = Math.round(results.duration).toLocaleString();
  sampleValueElem.textContent = Math.round(
    results.samplePerVariant
  ).toLocaleString();
  const sampleSubtitle = document.querySelector(
    ".result-card:nth-child(2) .result-subtitle"
  );
  if (sampleSubtitle) {
    sampleSubtitle.textContent = "per variant";
  }
  for (let i = 0; i < results.variantCount; i++) {
    const letter = String.fromCharCode(65 + i);
    const variantValueElem = document.getElementById(`variantValue${letter}`);
    if (variantValueElem) {
      variantValueElem.textContent = Math.round(
        results.samplePerVariant
      ).toLocaleString();
    }
  }
  timeEstimateElem.textContent = formatTimeEstimate(results.duration);
  if (results.isRelativeMode) {
    relativeChangeElem.textContent = `${results.mdePct}%`;
  } else {
    relativeChangeElem.textContent = `${results.mdePct} percentage points`;
  }
  fromValueElem.textContent = results.baselineRate.toFixed(2);
  toValueElem.textContent = results.targetRate.toFixed(2);
  const testType = document.querySelector(
    'input[name="testType"]:checked'
  ).value;
  const explanationElem = document.getElementById("explanation");
  if (explanationElem) {
    explanationElem.innerHTML = getTestTypeExplanation(
      testType,
      results.duration,
      results.isRelativeMode
        ? `${results.mdePct}%`
        : `${results.mdePct} percentage points`,
      results.baselineRate.toFixed(2),
      results.targetRate.toFixed(2)
    );
  }
}

function getTestTypeExplanation(
  testType,
  duration,
  relativeChange,
  fromValue,
  toValue
) {
  const timeText = formatTimeEstimate(duration);
  if (testType === "non-inferiority") {
    const params = getCalculationParameters();
    const baseline = parseFloat(fromValue);
    let worstAcceptable;
    if (params.isRelativeMode) {
      const mdeDecimal = params.mde / 100;
      worstAcceptable = baseline * (1 - mdeDecimal);
    } else {
      worstAcceptable = baseline - params.mde;
    }
    return `The experiment will need to run for <span class="highlight">${timeText}</span> to prove the new rate is not worse than <span class="highlight">${worstAcceptable.toFixed(
      2
    )}%</span>.`;
  }
  switch (testType) {
    case "two-sided":
      const lowerValue = (
        parseFloat(fromValue) -
        Math.abs(parseFloat(toValue) - parseFloat(fromValue))
      ).toFixed(2);
      return `The experiment will need to run for <span class="highlight">${timeText}</span> to detect a <span class="highlight">${relativeChange}</span> change in either direction (from <span id="fromValue">${fromValue}</span>% to <span id="toValue">${toValue}</span>% or to <span>${lowerValue}</span>%).`;
    case "one-sided":
      return `The experiment will need to run for <span class="highlight">${timeText}</span> to detect a <span class="highlight">${relativeChange}</span> improvement (from <span id="fromValue">${fromValue}</span>% to <span id="toValue">${toValue}</span>%).`;
    case "equivalence":
      const baseline = parseFloat(fromValue);
      const upperBound = parseFloat(toValue);
      const margin = upperBound - baseline;
      const lowerBound = (baseline - margin).toFixed(2);
      return `The experiment will need to run for <span class="highlight">${timeText}</span> to prove both variants perform equivalently, with the new rate falling within the range of <span class="highlight">${lowerBound}%</span> to <span class="highlight">${toValue}%</span>.`;
          default:
      return `The experiment will need to run for <span class="highlight">${timeText}</span> to detect a <span class="highlight">${relativeChange}</span> improvement (from <span id="fromValue">${fromValue}</span>% to <span id="toValue">${toValue}</span>%).`;
  }
}

function formatTimeEstimate(days) {
  if (days === 0) {
    return "0 days";
  } else if (days < 7) {
    return `${days} day${days !== 1 ? "s" : ""}`;
  } else if (days < 30) {
    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    let timeEstimateText = `${weeks} week${weeks !== 1 ? "s" : ""}`;
    if (remainingDays > 0) {
      timeEstimateText += ` and ${remainingDays} day${
        remainingDays !== 1 ? "s" : ""
      }`;
    }
    return timeEstimateText;
  } else {
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    let timeEstimateText = `${months} month${months !== 1 ? "s" : ""}`;
    if (remainingDays > 0) {
      const weeks = Math.floor(remainingDays / 7);
      const days = remainingDays % 7;
      if (weeks > 0) {
        timeEstimateText += ` and ${weeks} week${weeks !== 1 ? "s" : ""}`;
      } else if (days > 0) {
        timeEstimateText += ` and ${days} day${days !== 1 ? "s" : ""}`;
      }
    }
    return timeEstimateText;
  }
}

function syncRangeWithInput(input, rangeInput) {
  rangeInput.value = input.value;
  updateCalculation();
}

function syncInputWithRange(rangeInput, input) {
  input.value = rangeInput.value;
  updateCalculation();
}

function initializeMDEToTimeTable() {
  initializeTable(
    mdeTableBody,
    DEFAULT_MDES,
    addMDERow,
    createDeleteButtons,
    setupInputListeners
  );
}

function initializeTimeToMDETable() {
  initializeTable(
    timeTableBody,
    DEFAULT_TIMES,
    addTimeRow,
    createDeleteButtons,
    setupInputListeners
  );
}

function initializeTable(
  tableBody,
  defaultValues,
  addRowFunction,
  deleteButtonFunction,
  inputListenerFunction
) {
  tableBody.innerHTML = "";
  defaultValues.forEach((value) => {
    addRowFunction(null, value);
  });
  deleteButtonFunction(tableBody);
  inputListenerFunction(tableBody);
}

function addMDERow(clickEvent, defaultMDE = DEFAULT_MDE) {
  addTableRow(
    mdeTableBody,
    "mde-input",
    defaultMDE,
    calculateMdeResults,
    clickEvent
  );
  setupInputListeners(mdeTableBody);
}

function addTimeRow(clickEvent, defaultDays = DEFAULT_DAYS) {
  addTableRow(
    timeTableBody,
    "time-input",
    defaultDays,
    calculateTimeResults,
    clickEvent
  );
  setupInputListeners(timeTableBody);
}

function addTableRow(
  tableBody,
  inputClass,
  defaultValue,
  calculateFunction,
  triggeringEvent
) {
  const results = calculateFunction(defaultValue);
  const newRow = document.createElement("tr");
  if (inputClass === "mde-input") {
    newRow.innerHTML = `
          <td class="editable">
              <input type="number" class="${inputClass}" value="${defaultValue}" step="0.1" aria-label="Δ value">
          </td>
          <td>${results.baseline.toFixed(1)}% → ${results.targetRate.toFixed(
      2
    )}%</td>
          <td class="highlight">${results.durationDays} days</td>
          <td>${results.sampleSize.toLocaleString()}</td>
      `;
  } else {
    newRow.innerHTML = `
          <td class="editable">
              <input type="number" class="${inputClass}" value="${defaultValue}" min="1" step="1" aria-label="Duration in days">
          </td>
          <td>${results.visitorsPerVariant.toLocaleString()}</td>
          <td class="highlight">${results.mde.toFixed(2)}${
      results.isRelative ? "%" : " pp"
    }</td>
          <td>${results.baseline.toFixed(1)}% → ${results.targetRate.toFixed(
      2
    )}%</td>
      `;
  }
  tableBody.appendChild(newRow);
  const cell = newRow.querySelector(".editable");
  addDeleteButton(cell, newRow, tableBody);
  if (triggeringEvent) {
    const newInput = newRow.querySelector(`.${inputClass}`);
    if (newInput) {
      newInput.focus();
      newInput.select();
    }
  }
  return newRow;
}

function addDeleteButton(cell, row, tableBody) {
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-row";
  deleteBtn.textContent = "×";
  deleteBtn.setAttribute("aria-label", "Delete row");
  deleteBtn.setAttribute("tabindex", "-1");
  deleteBtn.onclick = function () {
    row.remove();
  };
  cell.appendChild(deleteBtn);
}

function setupRowListeners(row, inputClass, updateFunction) {
  const input = row.querySelector(`.${inputClass}`);
  const tableBody = row.closest("tbody");
  input.addEventListener("blur", function () {
    debouncedSort(tableBody, inputClass);
  });
  input.addEventListener("change", function () {
    updateFunction(row);
    debouncedSort(tableBody, inputClass);
  });
  input.addEventListener("input", function () {
    clearTimeout(sortDebounceTimer);
    clearRowHighlights();
  });
}

function downloadTableAsCSV(tableId) {
  const { content, filename } = createCSVContentFromTable(
    document.getElementById(tableId)
  );
  downloadCSV(content, filename);
}

function createCSVContentFromTable(table) {
  const headers = Array.from(table.querySelectorAll("thead th"))
    .map((th) => th.textContent.trim())
    .join(";");

  const tableBody = table.querySelector("tbody");
  const inputClass = table.id === "mdeTable" ? "mde-input" : "time-input";

  const rows = Array.from(tableBody.querySelectorAll("tr"))
    .map((row) => {
      const input = row.querySelector(`.${inputClass}`);
      const inputValue = input ? input.value : "";
      const restOfCells = Array.from(
        row.querySelectorAll("td:not(:first-child)")
      ).map((td) => {
        return td.textContent.trim().replace(/(\d),(\d)/g, "$1$2");
      });
      return [inputValue, ...restOfCells].join(";");
    })
    .join("\n");
  const csvContent = `${headers}\n${rows}`;
  const tableType = table.id === "mdeTable" ? "mde" : "time";
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");
  const filename = `ab-test-plan-${tableType}-${dateStr}-${timeStr}.csv`;
  return { content: csvContent, filename: filename };
}

function downloadCSV(content, filename) {
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  // Create blob with BOM for UTF-8.
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" });
  if (isIOS) {
    const reader = new FileReader();
    reader.onload = function (e) {
      let dataUrl = e.target.result;
      // Set MIME type to help Safari understand this is a file.
      dataUrl = dataUrl.replace(/^data:[^;]*;/, "data:attachment/file;");
      // Create a temporary link to open it.
      const link = document.createElement("a");
      link.href = dataUrl;
      link.target = "_blank";
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      // Cleanup.
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);
    };
    reader.readAsDataURL(blob);
  } else {
    // For all other browsers, standard Blob approach.
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    // Cleanup.
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  }
}

function calculateMdeResults(mdeValue) {
  const params = getCalculationParameters();
  const mdeResults = calculateMDE(
    params.baseline,
    mdeValue,
    params.isRelativeMode,
    params.testType
  );
  const sampleSize = calculateSampleSize(
    mdeResults.baselineRate,
    mdeResults.relMDE,
    params.alpha,
    params.power,
    params.variantCount,
    params.buffer,
    params.testType,
    params.correctionMethod
  );
  const distributionInfo = getVariantDistributions(params.variantCount);
  const effectiveVisitors = params.visitors * (params.trafficFlow / 100);
  const durationDays = calculateTestDuration(
    sampleSize,
    effectiveVisitors,
    params.variantCount,
    distributionInfo
  );
  return {
    baseline: params.baseline,
    targetRate: mdeResults.targetRate * 100,
    sampleSize: sampleSize,
    durationDays: durationDays,
  };
}

function getCalculationParameters() {
  return {
    visitors: parseFloat(visitorsInput.value) || 0,
    baseline: parseFloat(baselineInput.value) || 0,
    mde: parseFloat(mdeInput.value) || 0,
    variantCount: parseInt(variantsSelect.value),
    alpha: parseFloat(alphaInput.value) || 0.05,
    power: parseFloat(powerInput.value) || 0.8,
    testType: document.querySelector('input[name="testType"]:checked').value,
    trafficFlow: parseFloat(trafficFlowInput.value) || 100,
    buffer: parseFloat(bufferInput.value) || 0,
    isRelativeMode: relativeMode.checked,
    correctionMethod: correctionSelect.value,
  };
}

function calculateMDEFromDuration(days) {
  const params = getCalculationParameters();
  const effectiveVisitors = params.visitors * (params.trafficFlow / 100);
  const distributionInfo = getVariantDistributions(params.variantCount);
  let sampleSizePerVariant;
  if (
    distributionInfo.isUnequal &&
    distributionInfo.distributions.length === params.variantCount
  ) {
    const lowestVariantDailyVisitors =
      effectiveVisitors * distributionInfo.lowestPercentage;
    sampleSizePerVariant = days * lowestVariantDailyVisitors;
  } else {
    const variantDailyVisitors = effectiveVisitors / params.variantCount;
    sampleSizePerVariant = days * variantDailyVisitors;
  }
  return calculateMDEFromSampleSize(sampleSizePerVariant, params);
}

function updateMDEToTimeTable() {
  const rows = mdeTableBody.querySelectorAll("tr");
  rows.forEach((row) => updateRowCalculations(row));
}

function updateTimeToMDETable() {
  const rows = timeTableBody.querySelectorAll("tr");
  rows.forEach((row) => {
    if (row.querySelector("input.time-input")) {
      updateTimeRowCalculations(row);
    }
  });
}

function updateRowCalculations(row) {
  const mdeInput = row.querySelector(".mde-input");
  const mdeValue = parseFloat(mdeInput.value) || 10;
  const results = calculateMdeResults(mdeValue);
  const cells = row.querySelectorAll("td");
  cells[1].textContent = `${results.baseline.toFixed(
    1
  )}% → ${results.targetRate.toFixed(2)}%`;
  cells[2].textContent = `${results.durationDays.toLocaleString()} days`;
  cells[3].textContent = results.sampleSize.toLocaleString();
}

function createDeleteButtons(tableBody) {
  const rows = tableBody.querySelectorAll("tr");
  rows.forEach((row) => {
    const cell = row.querySelector(".editable");
    const existingBtn = cell.querySelector(".delete-row");
    if (existingBtn) {
      existingBtn.remove();
    }
    addDeleteButton(cell, row, tableBody);
  });
}

function checkAdvancedDefaults() {
  const currentValues = {
    alpha: parseFloat(alphaInput.value),
    power: parseFloat(powerInput.value),
    testType: document.querySelector('input[name="testType"]:checked').value,
    correction: correctionSelect.value,
    trafficFlow: parseFloat(trafficFlowInput.value),
    buffer: parseFloat(bufferInput.value),
  };
  const modifications = [];
  Object.entries(ADVANCED_DEFAULTS).forEach(([key, defaultValue]) => {
    if (currentValues[key] !== defaultValue) {
      modifications.push(
        getModificationDescription(key, currentValues[key], defaultValue)
      );
    }
  });
  if (hasCustomTrafficDistribution) {
    modifications.push("Traffic distribution: Custom");
  }
  const hasModifications = modifications.length > 0;
  if (hasModifications) {
    advancedStatusDot.classList.add("active");
    advancedHeader.classList.remove("no-modifications");
    tooltipModifications.innerHTML = modifications.join("<br>");
  } else {
    advancedStatusDot.classList.remove("active");
    advancedHeader.classList.add("no-modifications");
    tooltipModifications.innerHTML = "";
  }
}

function getModificationDescription(key, currentValue) {
  const descriptions = {
    alpha: `Significance level: ${currentValue}`,
    power: `Statistical power: ${currentValue}`,
    testType: `Test type: ${formatTestType(currentValue)}`,
    correction: `Multiple comparisons correction: ${formatCorrection(
      currentValue
    )}`,
    trafficFlow: `Traffic flow: ${currentValue}%`,
    buffer: `Buffer: ${currentValue}%`,
  };
  return descriptions[key] || `${key}: ${currentValue}`;
}

function formatTestType(value) {
  const types = {
    "one-sided": "One-sided",
    "two-sided": "Two-sided",
    "non-inferiority": "Non-inferiority",
    equivalence: "Equivalence",
  };
  return types[value] || value;
}

function formatCorrection(value) {
  const corrections = {
    none: "None",
    bonferroni: "Bonferroni",
    sidak: "Šidák",
  };
  return corrections[value] || value;
}

function setupInputListeners(tableBody) {
  const firstInput = tableBody.querySelector("input");
  if (!firstInput) return;
  const inputClass = firstInput.className;
  tableBody.querySelectorAll(`.${inputClass}`).forEach((input) => {
    input.addEventListener("blur", function () {
      const currentInput = this;
      const tableBodyElement = currentInput.closest("tbody");
      const row = currentInput.closest("tr");
      if (currentInput.value.trim() === "") {
        row.remove();
      }
      debouncedSort(tableBodyElement, inputClass);
    });
    input.addEventListener("change", function () {
      const row = this.closest("tr");
      const tableBodyElement = this.closest("tbody");
      const updateFunction =
        inputClass === "mde-input"
          ? updateMDERowCalculations
          : updateTimeRowCalculations;
      updateFunction(row);
      debouncedSort(tableBodyElement, inputClass);
    });
    input.addEventListener("input", function () {
      clearTimeout(sortDebounceTimer);
      clearRowHighlights();
    });
  });
}

function updateMDERowCalculations(row) {
  const mdeInput = row.querySelector(".mde-input");
  const mdeValue = parseFloat(mdeInput.value) || 10;
  const results = calculateMdeResults(mdeValue);
  const cells = row.querySelectorAll("td");
  cells[1].textContent = `${results.baseline.toFixed(
    1
  )}% → ${results.targetRate.toFixed(2)}%`;
  cells[2].textContent = `${results.durationDays.toLocaleString()} days`;
  cells[3].textContent = results.sampleSize.toLocaleString();
}

function updateTimeRowCalculations(row) {
  const timeInput = row.querySelector(".time-input");
  const timeValue = parseFloat(timeInput.value) || 30;
  const results = calculateTimeResults(timeValue);
  const cells = row.querySelectorAll("td");
  cells[1].textContent = Math.round(
    results.visitorsPerVariant
  ).toLocaleString();
  cells[2].textContent = `${results.mde.toFixed(2)}${
    results.isRelative ? "%" : " pp"
  }`;
  cells[3].textContent = `${results.baseline.toFixed(
    1
  )}% → ${results.targetRate.toFixed(2)}%`;
}

function calculateTimeResults(days) {
  const params = getCalculationParameters();
  const mde = calculateMDEFromDuration(days);
  const effectiveVisitors = params.visitors * (params.trafficFlow / 100);
  const distributionInfo = getVariantDistributions(params.variantCount);
  let visitorsPerVariant;
  if (
    distributionInfo.isUnequal &&
    distributionInfo.distributions.length === params.variantCount
  ) {
    const lowestVariantDailyVisitors =
      effectiveVisitors * distributionInfo.lowestPercentage;
    visitorsPerVariant = days * lowestVariantDailyVisitors;
  } else {
    const variantDailyVisitors = effectiveVisitors / params.variantCount;
    visitorsPerVariant = days * variantDailyVisitors;
  }
  const mdeInfo = calculateMDE(
    params.baseline,
    mde,
    params.isRelativeMode,
    params.testType
  );
  const targetRate = mdeInfo.targetRate * 100;
  return {
    baseline: params.baseline,
    targetRate: targetRate,
    mde: mde,
    isRelative: params.isRelativeMode,
    visitorsPerVariant: visitorsPerVariant,
  };
}

function clearRowHighlights() {
  if (mdeTableBody) {
    mdeTableBody
      .querySelectorAll("tr.row-moving")
      .forEach((row) => row.classList.remove("row-moving"));
  }
  if (timeTableBody) {
    timeTableBody
      .querySelectorAll("tr.row-moving")
      .forEach((row) => row.classList.remove("row-moving"));
  }
}

async function sortTable(tableBody, inputClass) {
  if (
    document.activeElement &&
    document.activeElement.classList.contains(inputClass)
  ) {
    return;
  }
  const rows = Array.from(tableBody.querySelectorAll("tr"));
  const sortedRows = [...rows].sort((a, b) => {
    const valueA = parseFloat(a.querySelector(`.${inputClass}`).value || 0);
    const valueB = parseFloat(b.querySelector(`.${inputClass}`).value || 0);
    return valueA - valueB;
  });
  rows.forEach((row) => row.classList.remove("row-moving"));
  rows.forEach((row, currentIndex) => {
    const newIndex = sortedRows.indexOf(row);
    if (currentIndex !== newIndex) {
      row.classList.add("row-moving");
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  rows.sort((a, b) => {
    const valueA = parseFloat(a.querySelector(`.${inputClass}`).value || 0);
    const valueB = parseFloat(b.querySelector(`.${inputClass}`).value || 0);
    return valueA - valueB;
  });
  rows.forEach((row) => tableBody.appendChild(row));
  setTimeout(() => {
    tableBody
      .querySelectorAll("tr.row-moving")
      .forEach((row) => row.classList.remove("row-moving"));
  }, 600);
}

function debouncedSort(tableBody, inputClass) {
  clearTimeout(sortDebounceTimer);
  sortDebounceTimer = setTimeout(() => {
    sortTable(tableBody, inputClass);
  }, sortDelay);
}

function encodeParametersToURL() {
  const params = {
    bl: baselineInput.value,
    mde: mdeInput.value,
    rel: relativeMode.checked ? 1 : 0,
    var: variantsSelect.value,
    tf: trafficFlowInput.value,
    bf: bufferInput.value,
    al: alphaInput.value,
    pw: powerInput.value,
    tt: document.querySelector('input[name="testType"]:checked').value,
    cr: correctionSelect.value,
    vs: visitorsInput.value,
  };
  const experimentName = document.getElementById("experimentName").value.trim();
  if (experimentName) {
    params.name = experimentName;
  }
  if (tabSingle.checked) {
    params.tab = "single";
  } else if (tabTable.checked) {
    params.tab = "table";
  } else if (tabTime.checked) {
    params.tab = "time";
  }
  const distribution = [];
  let isUneven = false;
  for (let i = 0; i < parseInt(variantsSelect.value); i++) {
    const letter = String.fromCharCode(65 + i);
    const slider = document.getElementById(`slider${letter}`);
    if (slider) {
      distribution.push(slider.value);
      if (i > 0 && slider.value !== document.getElementById("sliderA").value) {
        isUneven = true;
      }
    }
  }
  if (isUneven) {
    params.dist = distribution.join("_");
  }
  if (tabTable.checked) {
    const mdeInputs = mdeTableBody.querySelectorAll(".mde-input");
    if (mdeInputs.length > 0) {
      const mdeValues = Array.from(mdeInputs).map((input) => input.value);
      params.tblmde = mdeValues.join("_");
    }
  }
  if (tabTime.checked) {
    const timeInputs = timeTableBody.querySelectorAll(".time-input");
    if (timeInputs.length > 0) {
      const timeValues = Array.from(timeInputs).map((input) => input.value);
      params.tbltime = timeValues.join("_");
    }
  }
  const queryString = Object.keys(params)
    .map(
      (key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
    )
    .join("&");
  return `${window.location.origin}${window.location.pathname}?${queryString}`;
}

experimentNameInput.addEventListener("input", function () {
  updateDocumentTitle();
});
function updateDocumentTitle() {
  const experimentName = experimentNameInput.value.trim();
  if (experimentName) {
    document.title = `${experimentName} - ${originalTitle}`;
  } else {
    document.title = originalTitle;
  }
}

function getExperimentName() {
  return experimentNameInput.value.trim();
}

function setExperimentName(name) {
  experimentNameInput.value = name || "";
  updateDocumentTitle();
}

shareButton.addEventListener("click", handleShareButtonClick);
function handleShareButtonClick() {
  const url = encodeParametersToURL();
  // Update browser URL without reloading page.
  window.history.pushState({}, "", url);
  // Copy to clipboard.
  navigator.clipboard.writeText(url).then(() => {
    const shareButton = document.getElementById("sharePlan");
    const originalHTML = shareButton.innerHTML;
    shareButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Link copied!
    `;
    setTimeout(() => {
      shareButton.innerHTML = originalHTML;
    }, 2000);
  });
}

function decodeParametersFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.size === 0) return false;
  if (urlParams.has("name")) {
    setExperimentName(urlParams.get("name"));
  }
  if (urlParams.has("bl")) baselineInput.value = urlParams.get("bl");
  if (urlParams.has("mde")) mdeInput.value = urlParams.get("mde");
  if (urlParams.has("rel")) {
    const isRelative = urlParams.get("rel") === "1";
    relativeMode.checked = isRelative;
    absoluteMode.checked = !isRelative;
  }
  if (urlParams.has("var")) {
    variantsSelect.value = urlParams.get("var");
  }
  if (urlParams.has("tf")) {
    trafficFlowInput.value = urlParams.get("tf");
    if (trafficFlowRangeInput)
      trafficFlowRangeInput.value = urlParams.get("tf");
  }
  if (urlParams.has("bf")) {
    bufferInput.value = urlParams.get("bf");
    if (bufferRangeInput) bufferRangeInput.value = urlParams.get("bf");
  }
  if (urlParams.has("al")) {
    alphaInput.value = urlParams.get("al");
    if (alphaRangeInput) alphaRangeInput.value = urlParams.get("al");
  }
  if (urlParams.has("pw")) {
    powerInput.value = urlParams.get("pw");
    if (powerRangeInput) powerRangeInput.value = urlParams.get("pw");
  }
  if (urlParams.has("tt")) {
    const testTypeValue = urlParams.get("tt");
    const testTypeRadio = document.querySelector(
      `input[name="testType"][value="${testTypeValue}"]`
    );
    if (testTypeRadio) testTypeRadio.checked = true;
  }
  if (urlParams.has("cr")) correctionSelect.value = urlParams.get("cr");
  if (urlParams.has("vs")) visitorsInput.value = urlParams.get("vs");
  if (urlParams.has("var") || variantsSelect.value) {
    updateVariantUI();
  }
  if (urlParams.has("dist") && urlParams.has("var")) {
    const distribution = urlParams.get("dist").split("_");
    const variantCount = parseInt(urlParams.get("var"));
    if (!variantDistributionContainer.hasChildNodes() && variantCount > 0) {
      updateVariantUI();
    }
    for (let i = 0; i < Math.min(distribution.length, variantCount); i++) {
      const letter = String.fromCharCode(65 + i);
      const slider = document.getElementById(`slider${letter}`);
      if (slider) {
        slider.value = distribution[i];
        const percentageDisplay = document.getElementById(
          `percentage${letter}`
        );
        if (percentageDisplay) {
          percentageDisplay.textContent = `${distribution[i]}%`;
        }
      }
    }
  }
  updateMDEMode();
  if (urlParams.has("tab")) {
    const tabValue = urlParams.get("tab");
    if (tabValue === "table") {
      tabTable.checked = true;
    } else if (tabValue === "time") {
      tabTime.checked = true;
    } else {
      tabSingle.checked = true;
    }
    updateTabUI(document.querySelector('input[name="tabs"]:checked').id);
  } else {
    updateTabUI(document.querySelector('input[name="tabs"]:checked').id);
  }
  if (urlParams.has("tblmde")) {
    const mdeValues = urlParams
      .get("tblmde")
      .split("_")
      .map((val) => {
        const floatVal = parseFloat(val);
        return isNaN(floatVal) ? DEFAULT_MDE : floatVal;
      });
    mdeTableBody.innerHTML = "";
    mdeValues.forEach((mdeValue) => {
      addMDERow(null, mdeValue);
    });
    createDeleteButtons(mdeTableBody);
    setupInputListeners(mdeTableBody);
  } else if (!tabTable.checked) {
    initializeMDEToTimeTable();
  }
  if (urlParams.has("tbltime")) {
    const timeValues = urlParams
      .get("tbltime")
      .split("_")
      .map((val) => {
        const intVal = parseInt(val);
        return isNaN(intVal) ? DEFAULT_DAYS : intVal;
      });
    timeTableBody.innerHTML = "";
    timeValues.forEach((timeValue) => {
      addTimeRow(null, timeValue);
    });
    createDeleteButtons(timeTableBody);
    setupInputListeners(timeTableBody);
  } else if (!tabTime.checked) {
    initializeTimeToMDETable();
  }
  updateCalculation();
}

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.size > 0) {
  try {
    decodeParametersFromURL();
  } catch (error) {
    console.error("Error decoding URL parameters:", error);
  }
}
if (urlParams.get("test") !== null) {
  console.log("Loading test script…");
  const script = document.createElement("script");
  script.type = "module";
  script.src = "tests.js";
  document.head.appendChild(script);
}
