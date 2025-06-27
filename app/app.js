import {
  calculateExperimentSize,
  calculateMDE,
  calculateMDEFromSampleSize,
} from "./statistics.js";

const CSVPREFIX = "calculator.osc.garden";
const LOCAL_STORAGE_KEY = "calculator.osc.garden.settings";

// Singular defaults used when adding rows.
const DEFAULT_MDE = 10;
const DEFAULT_DAYS = 30;
const DEFAULT_MDES = [5, 10, 15, 20, 25];
const DEFAULT_TIMES = [7, 14, 30, 60, 90];
const ADVANCED_DEFAULTS = {
  alpha: 0.05,
  power: 0.8,
  testType: "superiority",
  correctionMethod: "none",
  trafficFlow: 100,
  buffer: 0,
};

const calculatorState = {
  /** Daily visitors to the page being tested. */
  visitors: 1000,
  /** Baseline conversion rate (as a percentage, e.g. 5 for 5%). */
  baseline: 5,
  /** Minimum Detectable Effect (or Improvement/Margin, etc.). */
  mde: DEFAULT_MDE,
  /** True if MDE is relative (%), false if absolute (points). */
  isRelativeMde: true,
  /** Total number of variants in the test, including control. */
  variants: 2,

  /** The statistical test type.
   * Values: 'superiority', 'two-tailed', 'non-inferiority', 'equivalence' */
  testType: ADVANCED_DEFAULTS.testType,
  /** Multiple comparison correction method.
   * Values: 'none', 'bonferroni', 'sidak' */
  correctionMethod: ADVANCED_DEFAULTS.correctionMethod,
  trafficDistribution: [50, 50],
  hasCustomTrafficDistribution: false,
  alpha: ADVANCED_DEFAULTS.alpha,
  /** Statistical power (1 - beta). */
  power: ADVANCED_DEFAULTS.power,
  /** Percentage of total traffic to be included in the experiment. */
  trafficFlow: ADVANCED_DEFAULTS.trafficFlow,
  /** A buffer (as a percentage) added to the final sample size. */
  buffer: ADVANCED_DEFAULTS.buffer,

  // For "Δ → Time" and "Time → Δ" tables.
  mdeTableRows: DEFAULT_MDES,
  timeTableRows: DEFAULT_TIMES,

  /** The ID of the currently active results tab.
   * Values: 'tab-single', 'tab-table', 'tab-time' */
  activeTab: "tab-single",

  /** The name of the experiment plan for sharing/exporting. */
  planName: "",
};

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
const resetDistributionBtn = document.getElementById("resetDistributionBtn");
const variantDistributionContainer = document.getElementById(
  "variantDistributionContainer"
);

// Errors.
const errorContainer = document.getElementById("errorContainer");
const errorList = document.getElementById("errorList");

// Results.
const explanationElem = document.getElementById("explanation");
const durationValueElem = document.getElementById("durationValue");
const sampleValueElem = document.getElementById("sampleValue");
const timeEstimateElem = document.getElementById("timeEstimate");
const sampleSubtitleElem = document.getElementById("sampleSubtitle");
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
const planNameInput = document.getElementById("planName");
const originalTitle = "A/B Test Sample Size & Duration Calculator";

initializeUI();

function initializeUI() {
  decodeStateFromURL();
  setupEventListeners();
  runUpdateCycle();
}

function decodeStateFromURL() {
  const settings = loadSettings();
  if (
    settings.lastTab &&
    ["tab-single", "tab-table", "tab-time"].includes(settings.lastTab)
  ) {
    calculatorState.activeTab = settings.lastTab;
  }
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("test")) {
    console.log("Loading test script…");
    const script = document.createElement("script");
    script.type = "module";
    script.src = "tests.js";
    document.head.appendChild(script);
  }
  if (urlParams.size === 0) return;
  // Handle plan name separately since it's a string.
  if (urlParams.has("name")) {
    calculatorState.planName = urlParams.get("name");
  }
  const updateState = (param, key, parser = parseFloat) => {
    if (urlParams.has(param)) {
      const value = parser(urlParams.get(param));
      if (typeof value === "number" && !isNaN(value)) {
        calculatorState[key] = value;
      }
    }
  };
  updateState("name", "planName", (val) => val); // String, no parsing
  updateState("vs", "visitors");
  updateState("bl", "baseline");
  updateState("mde", "mde");
  updateState("tf", "trafficFlow");
  updateState("bf", "buffer");
  updateState("al", "alpha");
  updateState("pw", "power");
  updateState("var", "variants", parseInt);
  // Booleans and special values.
  if (urlParams.has("rel")) {
    calculatorState.isRelativeMde = urlParams.get("rel") === "1";
  }
  if (urlParams.has("tt")) {
    calculatorState.testType = urlParams.get("tt");
  }
  if (urlParams.has("cr")) {
    calculatorState.correctionMethod = urlParams.get("cr");
  }
  if (urlParams.has("tab")) {
    const tabMap = {
      single: "tab-single",
      table: "tab-table",
      time: "tab-time",
    };
    calculatorState.activeTab = tabMap[urlParams.get("tab")] || "tab-single";
  }
  // Update traffic distribution (depends on variants)
  if (urlParams.has("dist")) {
    const distribution = urlParams.get("dist").split("_").map(parseFloat);
    if (distribution.length === calculatorState.variants) {
      calculatorState.trafficDistribution = distribution;
      calculatorState.hasCustomTrafficDistribution = true;
    }
  }
  if (urlParams.has("tblmde")) {
    const mdeValues = urlParams
      .get("tblmde")
      .split("_")
      .map(parseFloat)
      .filter((v) => !isNaN(v));
    if (mdeValues.length > 0) {
      calculatorState.mdeTableRows = mdeValues;
    }
  }
  if (urlParams.has("tbltime")) {
    const timeValues = urlParams
      .get("tbltime")
      .split("_")
      .map(parseFloat)
      .filter((v) => !isNaN(v));
    if (timeValues.length > 0) {
      calculatorState.timeTableRows = timeValues;
    }
  }
}

function loadSettings() {
  try {
    const savedSettings = localStorage.getItem(LOCAL_STORAGE_KEY);
    return savedSettings ? JSON.parse(savedSettings) : {};
  } catch (e) {
    console.error("Failed to parse settings from localStorage", e);
    return {};
  }
}

function setupEventListeners() {
  const debouncedUpdate = debounce(runUpdateCycle, 80);
  const addDebouncedListener = (element, stateKey, isNumeric = true) => {
    element.addEventListener("input", (e) => {
      calculatorState[stateKey] = isNumeric
        ? parseFloat(e.target.value) || 0
        : e.target.value;
      debouncedUpdate();
    });
  };

  const addSyncedListener = (textInput, rangeInput, stateKey) => {
    const listener = (e) => {
      calculatorState[stateKey] = parseFloat(e.target.value) || 0;
      runUpdateCycle();
    };
    textInput.addEventListener("input", listener);
    rangeInput.addEventListener("input", listener);
  };

  // Basic inputs.
  addDebouncedListener(visitorsInput, "visitors");
  addDebouncedListener(baselineInput, "baseline");
  addDebouncedListener(mdeInput, "mde");
  addDebouncedListener(planNameInput, "planName", false);

  // Mode and test configuration.
  relativeMode.addEventListener("change", () => {
    calculatorState.isRelativeMde = true;
    runUpdateCycle();
  });
  absoluteMode.addEventListener("change", () => {
    calculatorState.isRelativeMde = false;
    runUpdateCycle();
  });

  variantsSelect.addEventListener("change", (e) => {
    const newVariantCount = parseInt(e.target.value, 10);
    calculatorState.variants = newVariantCount;
    const equalShare = Math.floor(100 / newVariantCount);
    const newDistribution = Array(newVariantCount).fill(equalShare);
    const remainder = 100 - equalShare * newVariantCount;
    if (newDistribution.length > 0) newDistribution[0] += remainder;
    calculatorState.trafficDistribution = newDistribution;
    calculatorState.hasCustomTrafficDistribution = false;
    runUpdateCycle();
  });

  testTypeInputs.forEach((input) => {
    input.addEventListener("change", (e) => {
      calculatorState.testType = e.target.value;
      runUpdateCycle();
    });
  });

  correctionSelect.addEventListener("change", (e) => {
    calculatorState.correctionMethod = e.target.value;
    runUpdateCycle();
  });

  // Advanced inputs.
  addSyncedListener(alphaInput, alphaRangeInput, "alpha");
  addSyncedListener(powerInput, powerRangeInput, "power");
  addSyncedListener(trafficFlowInput, trafficFlowRangeInput, "trafficFlow");
  addSyncedListener(bufferInput, bufferRangeInput, "buffer");

  // Tabs.
  const updateAndSaveTab = (newTabId) => {
    calculatorState.activeTab = newTabId;
    const currentSettings = loadSettings();
    currentSettings.lastTab = newTabId;
    saveSettings(currentSettings);
    runUpdateCycle();
  };
  [tabSingle, tabTable, tabTime].forEach((tab) => {
    tab.addEventListener("change", (e) => {
      updateAndSaveTab(e.target.id);
    });
  });

  [tabSingleLabel, tabTableLabel, tabTimeLabel].forEach((label) => {
    label.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const tabId = label.getAttribute("for");
        updateAndSaveTab(tabId);
      }
    });
  });

  // Tables.
  addRowBtn.addEventListener("click", () => {
    calculatorState.mdeTableRows.push(DEFAULT_MDE);
    runUpdateCycle();
    const lastInput = mdeTableBody.querySelector("tr:last-child .mde-input");
    if (lastInput) {
      lastInput.focus();
      lastInput.select();
    }
  });
  addTimeRowBtn.addEventListener("click", () => {
    calculatorState.timeTableRows.push(DEFAULT_DAYS);
    runUpdateCycle();
    const lastInput = timeTableBody.querySelector("tr:last-child .time-input");
    if (lastInput) {
      lastInput.focus();
      lastInput.select();
    }
  });
  resetMDETableBtn.addEventListener("click", () => {
    calculatorState.mdeTableRows = [...DEFAULT_MDES];
    runUpdateCycle();
  });
  resetTimeTableBtn.addEventListener("click", () => {
    calculatorState.timeTableRows = [...DEFAULT_TIMES];
    runUpdateCycle();
  });

  function setupTableDelegation(tableElement, rowInputDataKey, inputClassName) {
    tableElement.addEventListener("click", (e) => {
      if (e.target.classList.contains("delete-row")) {
        const indexToDelete = parseInt(e.target.dataset.index, 10);
        if (
          !isNaN(indexToDelete) &&
          calculatorState[rowInputDataKey][indexToDelete] !== undefined
        ) {
          calculatorState[rowInputDataKey].splice(indexToDelete, 1);
        }
        runUpdateCycle();
      }
    });

    tableElement.addEventListener("input", (e) => {
      if (e.target.classList.contains(inputClassName)) {
        const indexToUpdate = parseInt(e.target.dataset.index, 10);
        if (
          !isNaN(indexToUpdate) &&
          calculatorState[rowInputDataKey][indexToUpdate] !== undefined
        ) {
          // Silently update the state array with the raw string.
          calculatorState[rowInputDataKey][indexToUpdate] = e.target.value;
        }
      }
    });

    const handleSortTrigger = (e) => {
      if (e.target.classList.contains(inputClassName)) {
        const currentValues = calculatorState[rowInputDataKey];
        const validValues = currentValues
          .map((val) => parseFloat(val))
          .filter((num) => {
            if (inputClassName === "time-input") {
              return !isNaN(num) && num > 0;
            }
            return !isNaN(num) && num !== 0;
          });
        calculatorState[rowInputDataKey] = validValues;
        sortStateTable(rowInputDataKey, e);
      }
    };
    tableElement.addEventListener("change", handleSortTrigger);
    tableElement.addEventListener("blur", handleSortTrigger, true);
  }

  function sortStateTable(stateArrayKey) {
    if (calculatorState[stateArrayKey]) {
      calculatorState[stateArrayKey].sort((a, b) => a - b);
    }
    runUpdateCycle();
  }

  setupTableDelegation(mdeTable, "mdeTableRows", "mde-input");
  setupTableDelegation(timeTable, "timeTableRows", "time-input");

  downloadCSVBtn.addEventListener("click", () =>
    downloadTableAsCSV("mdeTable")
  );
  downloadTimeCSVBtn.addEventListener("click", () =>
    downloadTableAsCSV("timeTable")
  );
  shareButton.addEventListener("click", handleShareButtonClick);

  variantDistributionContainer.addEventListener("input", (e) => {
    if (e.target.classList.contains("variant-range")) {
      const changedIndex = parseInt(e.target.dataset.index, 10);
      const newValue = parseInt(e.target.value, 10);
      const newDistribution = calculateNewDistribution(
        calculatorState.trafficDistribution,
        changedIndex,
        newValue
      );
      calculatorState.trafficDistribution = newDistribution;
      calculatorState.hasCustomTrafficDistribution = true;
      runUpdateCycle();
    }
  });

  resetDistributionBtn.addEventListener("click", () => {
    const newVariantCount = calculatorState.variants;
    const equalShare = Math.floor(100 / newVariantCount);
    const newDistribution = Array(newVariantCount).fill(equalShare);
    const remainder = 100 - equalShare * newVariantCount;
    if (newDistribution.length > 0) {
      newDistribution[0] += remainder;
    }
    calculatorState.trafficDistribution = newDistribution;
    calculatorState.hasCustomTrafficDistribution = false;
    runUpdateCycle();
  });

  planNameInput.addEventListener("input", function () {
    updateDocumentTitle();
  });
}

function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    const context = this;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(context, args);
    }, delay);
  };
}

function runUpdateCycle() {
  const errors = validateInputs(calculatorState);
  const results =
    !errors || errors.length === 0
      ? calculateResultsForActiveTab(calculatorState)
      : null;
  render(calculatorState, results, errors);
}

function validateInputs(state) {
  const basicErrors = getBasicInputErrors(state);
  const mdeErrors = getMdeErrors(state);
  return [...basicErrors, ...mdeErrors];
}

function getBasicInputErrors(state) {
  const validationConfig = [
    {
      key: "visitors",
      label: "Daily visitors",
      rules: { min: 0, max: Infinity, excludeMin: true },
    },
    {
      key: "baseline",
      label: "Baseline CR",
      rules: { min: 0, max: 100, excludeMin: true, excludeMax: true },
    },
    {
      key: "alpha",
      label: "Significance level",
      rules: { min: 0, max: 1, excludeMin: true, excludeMax: true },
    },
    {
      key: "power",
      label: "Statistical power",
      rules: { min: 0, max: 1, excludeMin: true, excludeMax: true },
    },
    {
      key: "trafficFlow",
      label: "Traffic flow",
      rules: { min: 0, max: 100, excludeMin: true },
    },
    { key: "buffer", label: "Buffer", rules: { min: 0, max: Infinity } },
  ];
  return validationConfig.reduce((errors, config) => {
    const value = state[config.key];
    if (isNaN(value) || value === null) {
      errors.push({
        key: config.key,
        message: `${config.label} must be a number.`,
      });
      return errors;
    }
    const { min, max, excludeMin = false, excludeMax = false } = config.rules;
    const isTooLow = excludeMin ? value <= min : value < min;
    const isTooHigh = excludeMax ? value >= max : value > max;
    if (isTooLow || isTooHigh) {
      const rangeMessage =
        min === 0 && max === Infinity
          ? `${config.label} must be a positive number greater than 0.`
          : `${config.label} must be between ${min} and ${max}.`;
      errors.push({ key: config.key, message: rangeMessage });
    }
    return errors;
  }, []);
}

function getMdeErrors(state) {
  if (state.activeTab !== "tab-single") {
    return [];
  }
  const { mde, testType } = state;
  const mdeLabel = getLabelsForTestType(testType).label;
  if (isNaN(mde) || mde === null) {
    return [{ key: "mde", message: `"${mdeLabel}" must be a number.` }];
  }
  if (mde === 0) {
    return [{ key: "mde", message: `"${mdeLabel}" cannot be zero.` }];
  }
  switch (testType) {
    case "superiority":
      return getSuperiorityMdeErrors(state, mdeLabel);
    case "two-tailed":
      return getTwoTailedMdeErrors(state, mdeLabel);
    case "non-inferiority":
      return getNonInferiorityMdeErrors(state, mdeLabel);
    default:
      return [];
  }
}

function getSuperiorityMdeErrors(state, mdeLabel) {
  const { mde, baseline, isRelativeMde } = state;
  const targetRate = calculateTargetRate(baseline, mde, isRelativeMde);
  if (mde > 0 && targetRate >= 100) {
    return [
      {
        key: "mde",
        message: `An improvement results in an invalid rate of ${targetRate.toFixed(
          2
        )}%.`,
      },
    ];
  }
  if (mde < 0 && targetRate <= 0) {
    return [
      {
        key: "mde",
        message: `A reduction results in an invalid rate of ${targetRate.toFixed(
          2
        )}%.`,
      },
    ];
  }
  return [];
}

function getTwoTailedMdeErrors(state, mdeLabel) {
  const { mde, baseline, isRelativeMde } = state;
  const errors = [];
  if (mde < 0) {
    return [
      { key: "mde", message: `"${mdeLabel}" must be a positive number.` },
    ];
  }
  const upperBound = calculateTargetRate(baseline, mde, isRelativeMde);
  if (upperBound >= 100) {
    errors.push({
      key: "mde",
      message: `This "${mdeLabel}" results in an invalid upper bound of ${upperBound.toFixed(
        2
      )}%`,
    });
  }
  const lowerBound = calculateTargetRate(baseline, -mde, isRelativeMde);
  if (lowerBound <= 0) {
    errors.push({
      key: "mde",
      message: `This "${mdeLabel}" results in an invalid lower bound of ${lowerBound.toFixed(
        2
      )}%`,
    });
  }
  return errors;
}

function getNonInferiorityMdeErrors(state, mdeLabel) {
  const { mde, baseline, isRelativeMde } = state;
  if (mde < 0) {
    return [
      { key: "mde", message: `"${mdeLabel}" must be a positive number.` },
    ];
  }
  const lowerBound = calculateTargetRate(baseline, -mde, isRelativeMde);
  if (lowerBound <= 0) {
    return [
      {
        key: "mde",
        message: `This "${mdeLabel}" results in an invalid lower bound of ${lowerBound.toFixed(
          2
        )}%`,
      },
    ];
  }
  return [];
}

function calculateTargetRate(baseline, mde, isRelativeMde) {
  return isRelativeMde ? baseline * (1 + mde / 100) : baseline + mde;
}

function calculateResultsForActiveTab(state) {
  try {
    switch (state.activeTab) {
      case "tab-single":
        const singleResult = getSampleSizeAndDurationForMde(state.mde, state);
        return {
          duration: singleResult.durationDays,
          sampleSizePerVariant: singleResult.sampleSizePerGroup,
          totalSampleSize: singleResult.totalSampleSize,
          targetRate: singleResult.targetRate,
        };

      case "tab-table":
        return {
          mdeTableData: state.mdeTableRows.map((mdeValue) =>
            getSampleSizeAndDurationForMde(mdeValue, state)
          ),
        };

      case "tab-time":
        return {
          timeTableData: state.timeTableRows.map((dayValue) =>
            calculateTimeRowResult(dayValue, state)
          ),
        };
    }
    return {};
  } catch (error) {
    console.error("Calculation error:", error);
    return null;
  }
}

function getSampleSizeAndDurationForMde(mdeValue, state) {
  const mdeInfo = calculateMDE(
    state.baseline,
    mdeValue,
    state.isRelativeMde,
    state.testType
  );
  const experimentSize = calculateExperimentSize({
    baseline: state.baseline / 100,
    mdeValue: mdeValue,
    isRelativeMde: state.isRelativeMde,
    alpha: state.alpha,
    power: state.power,
    variantCount: state.variants,
    buffer: state.buffer,
    testType: state.testType,
    correctionMethod: state.correctionMethod,
    trafficDistribution: getTrafficDistributionAsDecimals(calculatorState),
  });
  const effectiveVisitors = state.visitors * (state.trafficFlow / 100);
  const lowestPercentage = Math.min(...state.trafficDistribution) / 100;
  const lowestVariantDailyVisitors = effectiveVisitors * lowestPercentage;
  // The smallest variant's sample size determines duration.
  const smallestSampleSize = Math.min(...experimentSize.sampleSizePerGroup);
  const durationDays =
    lowestVariantDailyVisitors > 0
      ? Math.ceil(smallestSampleSize / lowestVariantDailyVisitors)
      : 0;
  return {
    baseline: state.baseline,
    targetRate: mdeInfo.targetRate * 100,
    sampleSizePerGroup: experimentSize.sampleSizePerGroup,
    totalSampleSize: experimentSize.totalSampleSize,
    durationDays,
  };
}

function getTrafficDistributionAsDecimals(state) {
  return state.trafficDistribution.map((p) => p / 100);
}

function calculateTimeRowResult(days, state) {
  const effectiveVisitors = state.visitors * (state.trafficFlow / 100);
  const totalSampleSize = Math.ceil(days * effectiveVisitors);
  const mde = calculateMDEFromSampleSize(totalSampleSize, {
    baseline: state.baseline,
    alpha: state.alpha,
    power: state.power,
    variantCount: state.variants,
    buffer: state.buffer,
    testType: state.testType,
    isRelativeMde: state.isRelativeMde,
    correctionMethod: state.correctionMethod,
    trafficDistribution: getTrafficDistributionAsDecimals(state),
  });
  const mdeInfo = calculateMDE(
    state.baseline,
    mde,
    state.isRelativeMde,
    state.testType
  );
  const targetRate = mdeInfo.targetRate * 100;
  return {
    baseline: state.baseline,
    targetRate,
    mde,
    isRelative: state.isRelativeMde,
    totalSampleSize,
  };
}

function render(state, results, errors) {
  renderFormInputs(state);
  renderDynamicText(state);
  renderAdvancedStatus(state);
  renderSingleEstimateResults(state, results, errors);
  renderUIState(state);
  renderVariantSliders(state);
  renderDataTables(state, results);
  renderValidationErrors(errors);
  updateDocumentTitle();
}

function renderFormInputs(state) {
  // Only update input if not focused (otherwise typing a decimal number would immediately remove the dot).
  const updateInputValue = (input, value) => {
    if (document.activeElement !== input) {
      input.value = value;
    }
  };

  // Basic inputs.
  updateInputValue(visitorsInput, state.visitors);
  updateInputValue(baselineInput, state.baseline);
  updateInputValue(mdeInput, state.mde);
  variantsSelect.value = state.variants;
  updateInputValue(planNameInput, state.planName);
  relativeMode.checked = state.isRelativeMde;
  absoluteMode.checked = !state.isRelativeMde;

  // Advanced settings.
  document.querySelector(
    `input[name="testType"][value="${state.testType}"]`
  ).checked = true;
  correctionSelect.value = state.correctionMethod;
  updateInputValue(alphaInput, state.alpha);
  updateInputValue(alphaRangeInput, state.alpha);
  updateInputValue(powerInput, state.power);
  updateInputValue(powerRangeInput, state.power);
  updateInputValue(trafficFlowInput, state.trafficFlow);
  updateInputValue(trafficFlowRangeInput, state.trafficFlow);
  updateInputValue(bufferInput, state.buffer);
  updateInputValue(bufferRangeInput, state.buffer);
}

function renderDynamicText(state) {
  // Update the main MDE label based on test type and mode.
  const mdeLabels = getLabelsForTestType(state.testType);
  const mdeModeUnit = state.isRelativeMde ? "(%)" : "(points)";
  document.querySelector(
    'label[for="mde"]'
  ).textContent = `${mdeLabels.label} ${mdeModeUnit}`;
  document.querySelector(
    'label[for="mde"] + .tooltip-trigger .tooltip'
  ).textContent = mdeLabels.tooltip;
  // Update the tooltips for the relative/absolute mode selectors.
  const relativeTooltipText = `'${state.mde}%' means going from ${
    state.baseline
  }% to ${(state.baseline * (1 + state.mde / 100)).toFixed(
    2
  )}% conversion rate`;
  const absoluteTooltipText = `'${state.mde} points' means going from ${
    state.baseline
  }% to ${(state.baseline + state.mde).toFixed(2)}% conversion rate`;
  document.querySelector(
    'label[for="relativeMode"] .tooltip, #relativeMode ~ .tooltip-trigger .tooltip'
  ).textContent = relativeTooltipText;
  document.querySelector(
    'label[for="absoluteMode"] .tooltip, #absoluteMode ~ .tooltip-trigger .tooltip'
  ).textContent = absoluteTooltipText;
  // Update the header of the MDE table.
  document.querySelector("#mdeTable th:first-child").innerHTML =
    state.isRelativeMde ? "Δ (%)" : "Δ (points)";
}

function renderAdvancedStatus(state) {
  const defaultModifications = Object.entries(ADVANCED_DEFAULTS)
    .filter(([key, defaultValue]) => state[key] !== defaultValue)
    .map(([key]) => getModificationDescription(key, state[key]));
  const trafficModification = !isEqualDistribution(
    state.trafficDistribution,
    state.variants
  )
    ? [`Traffic distribution: ${state.trafficDistribution.join("/")}`]
    : [];
  const modifications = [...defaultModifications, ...trafficModification];
  const hasModifications = modifications.length > 0;
  advancedStatusDot.classList.toggle("active", hasModifications);
  advancedHeader.classList.toggle("no-modifications", !hasModifications);
  tooltipModifications.innerHTML = hasModifications
    ? modifications.map((m) => `<li>${m}</li>`).join("")
    : "";
}

function isEqualDistribution(distribution, variantCount) {
  const equalShare = Math.floor(100 / variantCount);
  const expectedDistribution = Array(variantCount).fill(equalShare);
  const remainder = 100 - equalShare * variantCount;
  if (expectedDistribution.length > 0) expectedDistribution[0] += remainder;
  return (
    distribution.length === expectedDistribution.length &&
    distribution.every((val, i) => val === expectedDistribution[i])
  );
}

function renderSingleEstimateResults(state, results, errors) {
  const hasErrors = errors && errors.length > 0;
  if (results && !hasErrors && "duration" in results) {
    durationValueElem.textContent = results.duration.toLocaleString();
    const sampleSizes = results.sampleSizePerVariant;
    const allSame = sampleSizes.every((size) => size === sampleSizes[0]);
    if (allSame) {
      sampleValueElem.textContent = sampleSizes[0].toLocaleString();
      sampleSubtitleElem.classList.remove("hidden");
    } else {
      const variantLabels = Array.from({ length: state.variants }, (_, i) => {
        const letter = String.fromCharCode(65 + i);
        return i === 0 ? `${letter} (Control)` : letter;
      });
      const stackedRowsHTML = sampleSizes
        .map(
          (size, i) => `
          <div class="variant-row">
            <span class="variant-label">${variantLabels[i]}</span>
            <span class="variant-value">${size.toLocaleString()}</span>
          </div>
        `
        )
        .join("");
      sampleValueElem.innerHTML = `<div class="stacked-variants">${stackedRowsHTML}</div>`;
      sampleSubtitleElem.classList.add("hidden");
    }
    timeEstimateElem.textContent = formatTimeEstimate(results.duration);
    explanationElem.innerHTML = getTestTypeExplanation(state, results);
  } else {
    durationValueElem.textContent = "—";
    sampleValueElem.textContent = "—";
    sampleSubtitleElem.classList.remove("hidden");
    timeEstimateElem.textContent = "…";
    explanationElem.innerHTML = "Enter valid parameters to see the test plan.";
  }
}

function renderUIState(state) {
  const tabs = {
    "tab-single": {
      label: tabSingleLabel,
      content: document.getElementById("tab-single-content"),
    },
    "tab-table": {
      label: tabTableLabel,
      content: document.getElementById("tab-table-content"),
    },
    "tab-time": {
      label: tabTimeLabel,
      content: document.getElementById("tab-time-content"),
    },
  };
  for (const [tabId, tabElements] of Object.entries(tabs)) {
    const isActive = state.activeTab === tabId;
    tabElements.content.style.display = isActive ? "block" : "none";
    tabElements.label.setAttribute("aria-selected", isActive);
    const radioButton = document.getElementById(tabId);
    if (radioButton) {
      radioButton.checked = isActive;
    }
  }
  const isSingleTab = state.activeTab === "tab-single";
  mdeInput.classList.toggle("hidden", !isSingleTab);
  multipleMdesText.classList.toggle("hidden", isSingleTab);
}

function renderValidationErrors(errors) {
  const elementMap = {
    visitors: visitorsInput,
    baseline: baselineInput,
    mde: mdeInput,
    alpha: alphaInput,
    power: powerInput,
    trafficFlow: trafficFlowInput,
    buffer: bufferInput,
  };
  Object.values(elementMap).forEach(
    (el) => el && el.classList.remove("input-error")
  );
  errorList.innerHTML = "";
  const hasErrors = errors && errors.length > 0;
  errorContainer.classList.toggle("hidden", !hasErrors);
  if (hasErrors) {
    errors.forEach((error) => {
      const li = document.createElement("li");
      li.textContent = error.message;
      errorList.appendChild(li);
      if (elementMap[error.key]) {
        elementMap[error.key].classList.add("input-error");
      }
    });
  }
}

function getLabelsForTestType(testType) {
  const labels = {
    "two-tailed": {
      label: "Minimum detectable effect",
      tooltip: "The smallest change (up or down) you want to reliably detect",
    },
    superiority: {
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
  return labels[testType] || labels["two-tailed"];
}

function renderVariantSliders(state) {
  const currentSliderCount = variantDistributionContainer.children.length;
  // If the number of variants has changed, we must rebuild the sliders from scratch.
  if (currentSliderCount !== state.variants) {
    variantDistributionContainer.innerHTML = "";
    for (let i = 0; i < state.variants; i++) {
      const letter = String.fromCharCode(65 + i);
      const label =
        i === 0
          ? `${letter} <span class="control-label">(Control)</span>`
          : letter;
      const percentage = state.trafficDistribution[i];
      const variantItem = document.createElement("div");
      variantItem.className = "variant-slider-item";
      variantItem.innerHTML = `
        <div class="variant-slider-header">
          <div class="variant-letter-label">${label}</div>
          <div class="variant-percentage" id="percentage${letter}">${percentage}%</div>
        </div>
        <input
          type="range"
          id="slider${letter}"
          class="variant-range"
          min="1"
          max="99"
          value="${percentage}"
          data-index="${i}"
        >`;
      variantDistributionContainer.appendChild(variantItem);
    }
  } else {
    for (let i = 0; i < state.variants; i++) {
      const letter = String.fromCharCode(65 + i);
      const percentage = state.trafficDistribution[i];
      const slider = document.getElementById(`slider${letter}`);
      const percentageDisplay = document.getElementById(`percentage${letter}`);
      if (slider && slider.value != percentage) {
        slider.value = percentage;
      }
      if (percentageDisplay) {
        percentageDisplay.textContent = `${percentage}%`;
      }
    }
  }
}

function calculateNewDistribution(currentDistribution, changedIndex, newValue) {
  const numVariants = currentDistribution.length;
  const newDist = [...currentDistribution];
  // Set the value for the slider that was moved, clamping it to its valid range.
  const minRequiredForOthers = numVariants - 1;
  const maxAllowed = 100 - minRequiredForOthers;
  newDist[changedIndex] = Math.max(1, Math.min(newValue, maxAllowed));
  const otherIndices = Array.from({ length: numVariants }, (_, i) => i).filter(
    (i) => i !== changedIndex
  );
  if (otherIndices.length === 0) return newDist;
  // Calculate the total adjustment needed.
  const currentSum = newDist.reduce((a, b) => a + b, 0);
  let adjustmentToDistribute = currentSum - 100;
  // Iteratively apply the adjustment one point at a time.
  // This loop continues until the total is 100.
  // An emergency break prevents infinite loops in edge cases.
  let emergencyBreak = 0;
  while (adjustmentToDistribute !== 0 && emergencyBreak < 101) {
    let slidersToAdjust = otherIndices.map((index) => ({
      index: index,
      value: newDist[index],
    }));
    // If we need to subtract (sum > 100), we take from the largest sliders first.
    // If we need to add (sum < 100), we give to the smallest sliders first.
    if (adjustmentToDistribute > 0) {
      slidersToAdjust.sort((a, b) => b.value - a.value);
    } else {
      slidersToAdjust.sort((a, b) => a.value - b.value);
    }
    // Find the first slider in the sorted list that can be adjusted.
    let sliderToAdjust = slidersToAdjust.find((s) => {
      return adjustmentToDistribute > 0 ? s.value > 1 : s.value < 99;
    });
    // If no slider can be adjusted, stop.
    if (!sliderToAdjust) {
      break;
    }
    // Apply a single +1 or -1 adjustment.
    const adjustment = Math.sign(adjustmentToDistribute); // -1 or 1
    newDist[sliderToAdjust.index] -= adjustment;
    adjustmentToDistribute -= adjustment;
    emergencyBreak++;
  }
  return newDist;
}

function renderDataTables(state, results) {
  if (!results) {
    mdeTable.querySelector("tbody").innerHTML = "";
    timeTable.querySelector("tbody").innerHTML = "";
    return;
  }
  renderTableBody(
    mdeTable.querySelector("tbody"),
    state.mdeTableRows,
    results.mdeTableData,
    "mde-input"
  );
  renderTableBody(
    timeTable.querySelector("tbody"),
    state.timeTableRows,
    results.timeTableData,
    "time-input"
  );
}

function renderTableBody(tbodyEl, rowInputData, rowResultData, inputClass) {
  if (!rowResultData) {
    tbodyEl.innerHTML = "";
    return;
  }
  const { elementToPositionMap, valueToElementMap, existingRows } =
    cacheExistingRows(tbodyEl, inputClass);
  const finalElements = [];
  const renderedElements = new Set();
  rowInputData.forEach((inputValue, index) => {
    const result = rowResultData[index];
    const availableElements = valueToElementMap.get(String(inputValue));
    const rowToReuse =
      availableElements?.length > 0 ? availableElements.shift() : null;
    if (rowToReuse) {
      renderedElements.add(rowToReuse);
      updateRowContent(rowToReuse, result, inputClass);
      rowToReuse.querySelector(`.${inputClass}`).dataset.index = index;
      rowToReuse
        .querySelector(".delete-row")
        ?.setAttribute("data-index", index);
      finalElements.push(rowToReuse);
    } else {
      const newRow = document.createElement("tr");
      newRow.innerHTML = createRowHtml(inputValue, result, index, inputClass);
      const editableCell = newRow.querySelector(".editable");
      if (editableCell) addDeleteButton(editableCell, index);
      finalElements.push(newRow);
    }
  });
  existingRows.forEach((row) => {
    if (!renderedElements.has(row)) {
      row.remove();
    }
  });
  tbodyEl.innerHTML = "";
  finalElements.forEach((el) => tbodyEl.appendChild(el));
  const activeElement = document.activeElement;
  const isInputFocused = activeElement?.classList.contains(inputClass);
  const wasReorderOnly = existingRows.length === finalElements.length;
  if (!isInputFocused && wasReorderOnly) {
    animateReordering(finalElements, elementToPositionMap);
  }
}

function cacheExistingRows(tbodyEl, inputClass) {
  const elementToPositionMap = new Map();
  const valueToElementMap = new Map();
  const existingRows = Array.from(tbodyEl.children);
  existingRows.forEach((row) => {
    const input = row.querySelector(`.${inputClass}`);
    if (!input) return;
    elementToPositionMap.set(row, row.getBoundingClientRect());
    const value = input.value;
    if (!valueToElementMap.has(value)) {
      valueToElementMap.set(value, []);
    }
    valueToElementMap.get(value).push(row);
  });
  return { elementToPositionMap, valueToElementMap, existingRows };
}

function updateRowContent(row, result, inputClass) {
  const inputValue = row.querySelector(`.${inputClass}`).value;
  const tableType = inputClass === "mde-input" ? "mdeTable" : "timeTable";
  const data = generateDisplayRowData(tableType, inputValue, result);
  // Index 0 corresponds to the input field.
  if (data[1]) row.children[1].textContent = data[1];
  if (data[2]) row.children[2].textContent = data[2];
  if (data[3]) row.children[3].textContent = data[3];
}

function createRowHtml(inputValue, result, index, inputClass) {
  const tableType = inputClass === "mde-input" ? "mdeTable" : "timeTable";
  const data = generateDisplayRowData(tableType, inputValue, result);
  if (tableType === "mdeTable") {
    // Δ → Days table.
    return `
      <td class="editable"><div class="input-wrapper"><input type="number" class="mde-input" value="${data[0]}" step="0.1" data-index="${index}"></div></td>
      <td>${data[1]}</td>
      <td class="highlight">${data[2]}</td>
      <td>${data[3]}</td>
    `;
  } else {
    // Days → Δ table.
    return `
      <td class="editable"><div class="input-wrapper"><input type="number" class="time-input" value="${data[0]}" min="1" step="1" data-index="${index}"></div></td>
      <td>${data[1]}</td>
      <td class="highlight">${data[2]}</td>
      <td>${data[3]}</td>
    `;
  }
}

function generateDisplayRowData(tableType, inputValue, result) {
  const data = generateRowDataObject(tableType, inputValue, result);
  if (!data) return Array(4).fill("—");
  if (tableType === "mdeTable") {
    return [
      data.inputValue,
      data.crChange,
      `${data.durationDays.toLocaleString()} days`,
      data.totalSampleSize.toLocaleString(),
    ];
  } else {
    // timeTable
    return [
      data.inputValue,
      data.totalSampleSize.toLocaleString(),
      data.mde,
      data.crChange,
    ];
  }
}

function generateRowDataObject(tableType, inputValue, result) {
  if (!result) {
    return null;
  }
  const crChangeText = `${result.baseline.toFixed(
    2
  )}% → ${result.targetRate.toFixed(2)}%`;
  if (tableType === "mdeTable") {
    return {
      inputValue: inputValue,
      crChange: crChangeText,
      durationDays: result.durationDays,
      totalSampleSize: result.totalSampleSize,
    };
  }
  if (tableType === "timeTable") {
    const mdeText = `${result.mde.toFixed(2)}${
      result.isRelative ? "%" : " pp"
    }`;
    return {
      inputValue: inputValue,
      totalSampleSize: result.totalSampleSize,
      mde: mdeText,
      crChange: crChangeText,
    };
  }
  return null;
}

function animateReordering(elements, positionMap) {
  elements.forEach((row) => {
    const firstPosition = positionMap.get(row);
    if (!firstPosition) return;
    const lastPosition = row.getBoundingClientRect();
    const deltaX = firstPosition.left - lastPosition.left;
    const deltaY = firstPosition.top - lastPosition.top;
    if (Math.abs(deltaY) < 0.5 && Math.abs(deltaX) < 0.5) return;
    requestAnimationFrame(() => {
      row.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      row.style.transition = "transform 0s";
      requestAnimationFrame(() => {
        row.style.transform = "";
        row.style.transition = "";
      });
    });
  });
}

function addDeleteButton(cell, index) {
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-row";
  deleteBtn.textContent = "×";
  deleteBtn.setAttribute("aria-label", "Delete row");
  deleteBtn.setAttribute("tabindex", "-1");
  deleteBtn.dataset.index = index;
  cell.appendChild(deleteBtn);
}

function getTestTypeExplanation(state, results) {
  const { testType, isRelativeMde, mde, baseline } = state;
  const { duration, totalSampleSize } = results;
  const timeText = `<span class="highlight">${formatTimeEstimate(
    duration
  )}</span>`;
  const mdeText = `<span class="highlight">${
    isRelativeMde ? `${mde}%` : `${mde} percentage points`
  }</span>`;
  const totalSampleText = `<span class="highlight">${totalSampleSize.toLocaleString()} participants</span>`;
  const effectSizeInPoints = isRelativeMde ? baseline * (mde / 100) : mde;
  const marginInPoints = Math.abs(effectSizeInPoints);
  const bounds = {
    from: `<span class="highlight">${baseline.toFixed(2)}%</span>`,
    // 'to' reflects the actual directional change for superiority.
    to: `<span class="highlight">${(baseline + effectSizeInPoints).toFixed(
      2
    )}%</span>`,
    // 'upper' and 'lower' create a symmetrical range for other test types.
    upper: `<span class="highlight">${(baseline + marginInPoints).toFixed(
      2
    )}%</span>`,
    lower: `<span class="highlight">${(baseline - marginInPoints).toFixed(
      2
    )}%</span>`,
  };
  const introClause = `The experiment will need to collect data from ${totalSampleText} over ${timeText} to`;
  let goalAndDetails;
  switch (testType) {
    case "superiority":
      goalAndDetails = `detect a ${mdeText} improvement (from ${bounds.from} to ${bounds.to})`;
      break;
    case "non-inferiority":
      goalAndDetails = `prove the new rate is not worse than ${bounds.lower}`;
      break;
    case "two-tailed":
      goalAndDetails = `detect a ${mdeText} change in either direction (from ${bounds.from} to ${bounds.upper} or to ${bounds.lower})`;
      break;
    case "equivalence":
      goalAndDetails = `prove the variants perform equivalently, with the new rate falling within the range of ${bounds.lower} to ${bounds.upper}`;
      break;
    default:
      goalAndDetails = `detect a ${mdeText} improvement (from ${bounds.from} to ${bounds.to})`;
      break;
  }
  return `${introClause} ${goalAndDetails}.`;
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

function downloadTableAsCSV(tableId) {
  const stateKey = tableId === "mdeTable" ? "mdeTableRows" : "timeTableRows";
  const dataKey = tableId === "mdeTable" ? "mdeTableData" : "timeTableData";
  const results = calculateResultsForActiveTab(calculatorState);
  if (!results) {
    alert("Please fix the errors before downloading.");
    return;
  }
  const { content, filename } = createCSVContentFromData(
    tableId,
    calculatorState[stateKey],
    results[dataKey]
  );
  downloadCSV(content, filename);
}

function createCSVContentFromData(tableId, rowData, resultsData) {
  const table = document.getElementById(tableId);
  const headers = Array.from(table.querySelectorAll("thead th"))
    .map((th) => {
      // Use the data-attribute if it exists, otherwise use the normal text.
      const csvHeader = th.dataset.csvHeader || th.textContent;
      return csvHeader.trim();
    })
    .join(";");
  const rows = rowData
    .map((rowItem, index) => {
      const result = resultsData[index];
      const rowValues = generateExportRowData(tableId, rowItem, result);
      if (rowValues.length === 0) return "";
      return rowValues.join(";");
    })
    .join("\n");
  const csvContent = `${headers}\n${rows}`;
  const dateStr = new Date().toISOString().split("T")[0];
  const planName = calculatorState.planName.trim();
  const sanitizedName = planName
    ? planName.replace(/[^a-zA-Z0-9\-_]/g, "-").replace(/-+/g, "-")
    : "";
  const tableType =
    tableId === "mdeTable" ? "effect-to-days" : "days-to-effect";
  const filename = sanitizedName
    ? `${sanitizedName}-${tableType}-${dateStr}.csv`
    : `${CSVPREFIX}-${tableType}-${dateStr}.csv`;
  return { content: csvContent, filename };
}

function generateExportRowData(tableType, inputValue, result) {
  const data = generateRowDataObject(tableType, inputValue, result);
  if (!data) return [];
  if (tableType === "mdeTable") {
    return [
      data.inputValue,
      data.crChange,
      data.durationDays,
      data.totalSampleSize,
    ];
  } else {
    // timeTable
    return [data.inputValue, data.totalSampleSize, data.mde, data.crChange];
  }
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

function getModificationDescription(key, currentValue) {
  const descriptions = {
    alpha: `Significance level: ${currentValue}`,
    power: `Statistical power: ${currentValue}`,
    testType: `Test type: ${formatTestType(currentValue)}`,
    correctionMethod: `Multiple comparisons correction: ${formatCorrection(
      currentValue
    )}`,
    trafficFlow: `Traffic flow: ${currentValue}%`,
    buffer: `Buffer: ${currentValue}%`,
  };
  return descriptions[key] || `${key}: ${currentValue}`;
}

function formatTestType(value) {
  const types = {
    superiority: "Superiority",
    "two-tailed": "Two-tailed",
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

function encodeStateToURL(state) {
  const params = {
    bl: state.baseline,
    mde: state.mde,
    rel: state.isRelativeMde ? 1 : 0,
    var: state.variants,
    tf: state.trafficFlow,
    bf: state.buffer,
    al: state.alpha,
    pw: state.power,
    tt: state.testType,
    cr: state.correctionMethod,
    vs: state.visitors,
    name: state.planName,
    tab: state.activeTab.replace("tab-", ""),
  };
  if (
    (state.variants > 2 || state.hasCustomTrafficDistribution) &&
    state.trafficDistribution &&
    state.trafficDistribution.length > 0
  ) {
    params.dist = state.trafficDistribution.join("_");
  }
  if (
    state.activeTab === "tab-table" &&
    state.mdeTableRows &&
    state.mdeTableRows.length > 0
  ) {
    params.tblmde = state.mdeTableRows.join("_");
  } else if (
    state.activeTab === "tab-time" &&
    state.timeTableRows &&
    state.timeTableRows.length > 0
  ) {
    params.tbltime = state.timeTableRows.join("_");
  }
  const queryString = Object.entries(params)
    .filter(
      ([, value]) => value !== "" && value !== null && value !== undefined
    )
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .join("&");
  return `${window.location.origin}${window.location.pathname}?${queryString}`;
}

function updateDocumentTitle() {
  const planName = planNameInput.value.trim();
  if (planName) {
    document.title = `${planName} - ${originalTitle}`;
  } else {
    document.title = originalTitle;
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save settings to localStorage", e);
  }
}

function handleShareButtonClick() {
  const url = encodeStateToURL(calculatorState);
  // Update browser URL without reloading page.
  window.history.pushState({}, "", url);
  // Copy to clipboard.
  navigator.clipboard.writeText(url).then(() => {
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
