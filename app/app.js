import {
  getOptimalSplit,
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
const LEGEND_LABELS = {
  superiority: {
    undetectable: "Inconclusive",
    baseline: "Baseline",
    detectable: "Detectable",
  },
  "two-tailed": {
    undetectable: "Inconclusive",
    baseline: "Baseline",
    detectable: "Detectable",
  },
  "non-inferiority": {
    undetectable: "Inferior",
    baseline: "Baseline",
    detectable: "Non-inferior",
  },
  equivalence: {
    undetectable: "Different",
    baseline: "Baseline",
    detectable: "Equivalent",
  },
};
const CHART_CONSTANTS = {
  WIDTH: 500, // Must match index.html
  HEIGHT: 250, // Must match index.html
  HOVER_RADIUS: 12,
  POINT_RADIUS: 4,
  DEFAULT_MARGIN: { top: 40, right: 60, bottom: 60, left: 80 },
};
const mdeTableColumnConfig = [
  // Configuration for the "Δ → Days" table.
  { key: "inputValue", header: "Δ", isEditable: true, step: 0.1 },
  { key: "durationDays", header: "Days", isHighlight: true },
  { key: "crChange", header: "From → To" },
  { key: "totalSampleSize", header: "Total Visitors" },
];
const timeTableColumnConfig = [
  // Configuration for the "Days → Δ" table.
  { key: "inputValue", header: "Days", isEditable: true, step: 1, min: 1 },
  { key: "mde", header: "Δ", isHighlight: true },
  { key: "crChange", header: "From → To" },
  { key: "totalSampleSize", header: "Total visitors" },
];

const calculatorState = {
  /** Daily visitors to the page being tested. */
  visitors: 1000,
  /** Baseline conversion rate (as a percentage, e.g. 5 for 5%). */
  baseline: 5,
  /** Minimum Detectable Effect (or Improvement/Margin, etc.). */
  mde: DEFAULT_MDE,
  /** True if MDE is relative (%), false if absolute (points). */
  isRelativeMde: true,
  /** Computed absolute MDE value in points. */
  absoluteMde: 0,
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
  mdeTableRows: [...DEFAULT_MDES],
  timeTableRows: [...DEFAULT_TIMES],

  /** The ID of the currently active results tab.
   * Values: 'tab-single', 'tab-table', 'tab-time' */
  activeTab: "tab-single",

  /** Chart visibility state */
  mdeChartVisible: false,
  timeChartVisible: false,

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

// Legend elements.
const legendUndetectable = document.getElementById("legendUndetectable");
const legendBaseline = document.getElementById("legendBaseline");
const legendDetectable = document.getElementById("legendDetectable");

// Advanced settings.
const settingsCheckbox = document.getElementById("settings-checkbox");
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
const singleTabChartSection = document.getElementById("singleTabChartSection");
const singleTabChartBar = document.getElementById("singleTabChartBar");
const singleTabChartLabels = document.getElementById("singleTabChartLabels");
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
const toggleMDEChartBtn = document.getElementById("toggleMDEChartBtn");
const toggleTimeChartBtn = document.getElementById("toggleTimeChartBtn");
const mdeChartContainer = document.getElementById("mdeChartContainer");
const timeChartContainer = document.getElementById("timeChartContainer");
const optimalDistributionBtn = document.getElementById(
  "optimalDistributionBtn"
);
const shareButton = document.getElementById("sharePlan");
const downloadCSVBtn = document.getElementById("downloadCSVBtn");
const downloadTimeCSVBtn = document.getElementById("downloadTimeCSVBtn");
const planNameInput = document.getElementById("planName");
const originalTitle = "A/B Test Sample Size & Duration Calculator";

initializeUI();

function initializeUI() {
  loadPersistentSettings();
  decodeStateFromURL();
  syncChartVisibilityUI();
  setupEventListeners();
  runUpdateCycle();
}

function syncChartVisibilityUI() {
  if (calculatorState.mdeChartVisible) {
    mdeChartContainer.classList.remove("hidden");
    toggleMDEChartBtn.textContent = "Hide chart";
  } else {
    mdeChartContainer.classList.add("hidden");
    toggleMDEChartBtn.textContent = "Show chart";
  }
  if (calculatorState.timeChartVisible) {
    timeChartContainer.classList.remove("hidden");
    toggleTimeChartBtn.textContent = "Hide chart";
  } else {
    timeChartContainer.classList.add("hidden");
    toggleTimeChartBtn.textContent = "Show chart";
  }
}

function loadPersistentSettings() {
  const savedSettings = loadSettings();
  if (typeof savedSettings.isAdvancedOpen === "boolean") {
    calculatorState.isAdvancedOpen = savedSettings.isAdvancedOpen;
  }
  if (
    savedSettings.lastTab &&
    ["tab-single", "tab-table", "tab-time"].includes(savedSettings.lastTab)
  ) {
    calculatorState.activeTab = savedSettings.lastTab;
  }
  if (typeof savedSettings.mdeChartVisible === "boolean") {
    calculatorState.mdeChartVisible = savedSettings.mdeChartVisible;
  }
  if (typeof savedSettings.timeChartVisible === "boolean") {
    calculatorState.timeChartVisible = savedSettings.timeChartVisible;
  }
  if (settingsCheckbox) {
    settingsCheckbox.checked = calculatorState.isAdvancedOpen;
  }
}

function decodeStateFromURL() {
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
  if (urlParams.has("mdechart")) {
    calculatorState.mdeChartVisible = urlParams.get("mdechart") === "1";
  }
  if (urlParams.has("timechart")) {
    calculatorState.timeChartVisible = urlParams.get("timechart") === "1";
  }
}

function savePersistentSettings() {
  const settingsToSave = {
    lastTab: calculatorState.activeTab,
    isAdvancedOpen: calculatorState.isAdvancedOpen,
    mdeChartVisible: calculatorState.mdeChartVisible,
    timeChartVisible: calculatorState.timeChartVisible,
  };
  saveSettings(settingsToSave);
}

function saveSettings(settings) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save settings to localStorage", e);
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
    calculatorState.variants = parseInt(e.target.value, 10);
    applyEqualDistribution();
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
  settingsCheckbox.addEventListener("change", (e) => {
    calculatorState.isAdvancedOpen = e.target.checked;
    savePersistentSettings();
  });
  addSyncedListener(alphaInput, alphaRangeInput, "alpha");
  addSyncedListener(powerInput, powerRangeInput, "power");
  addSyncedListener(trafficFlowInput, trafficFlowRangeInput, "trafficFlow");
  addSyncedListener(bufferInput, bufferRangeInput, "buffer");

  // Tabs.
  const updateAndSaveTab = (newTabId) => {
    calculatorState.activeTab = newTabId;
    savePersistentSettings();
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

  toggleMDEChartBtn.addEventListener("click", () => {
    calculatorState.mdeChartVisible = !calculatorState.mdeChartVisible;
    if (calculatorState.mdeChartVisible) {
      mdeChartContainer.classList.remove("hidden");
      toggleMDEChartBtn.textContent = "Hide chart";
    } else {
      mdeChartContainer.classList.add("hidden");
      toggleMDEChartBtn.textContent = "Show chart";
    }
    savePersistentSettings();
    runUpdateCycle();
  });

  toggleTimeChartBtn.addEventListener("click", () => {
    calculatorState.timeChartVisible = !calculatorState.timeChartVisible;
    if (calculatorState.timeChartVisible) {
      timeChartContainer.classList.remove("hidden");
      toggleTimeChartBtn.textContent = "Hide chart";
    } else {
      timeChartContainer.classList.add("hidden");
      toggleTimeChartBtn.textContent = "Show chart";
    }
    savePersistentSettings();
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

  optimalDistributionBtn.addEventListener("click", () => {
    applyOptimalDistribution();
  });

  planNameInput.addEventListener("input", function () {
    updateDocumentTitle();
  });
  planNameInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      shareButton.click();
    }
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
  calculatorState.absoluteMde = computeAbsoluteMde(calculatorState);
  const errors = validateInputs(calculatorState);
  const results =
    !errors || errors.length === 0
      ? calculateResultsForActiveTab(calculatorState)
      : null;
  render(calculatorState, results, errors);
}

function computeAbsoluteMde(state) {
  return state.isRelativeMde ? state.baseline * (state.mde / 100) : state.mde;
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
    case "equivalence":
      return getEquivalenceMdeErrors(state, mdeLabel);
    default:
      return [];
  }
}

function getSuperiorityMdeErrors(state) {
  const { mde, baseline, absoluteMde } = state;
  const targetRate = calculateTargetRate(baseline, absoluteMde);
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
  const { mde, baseline, absoluteMde } = state;
  const errors = [];
  if (mde < 0) {
    return [
      { key: "mde", message: `"${mdeLabel}" must be a positive number.` },
    ];
  }
  const upperBound = calculateTargetRate(baseline, absoluteMde);
  if (upperBound >= 100) {
    errors.push({
      key: "mde",
      message: `This "${mdeLabel}" results in an invalid upper bound of ${upperBound.toFixed(
        2
      )}%`,
    });
  }
  const lowerBound = calculateTargetRate(baseline, -absoluteMde);
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
  const { mde, baseline, absoluteMde } = state;
  if (mde < 0) {
    return [
      { key: "mde", message: `"${mdeLabel}" must be a positive number.` },
    ];
  }
  const lowerBound = calculateTargetRate(baseline, -absoluteMde);
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

function getEquivalenceMdeErrors(state, mdeLabel) {
  const { mde, baseline, absoluteMde } = state;
  const errors = [];
  if (mde < 0) {
    return [
      { key: "mde", message: `"${mdeLabel}" must be a positive number.` },
    ];
  }
  const upperBound = calculateTargetRate(baseline, absoluteMde);
  if (upperBound >= 100) {
    errors.push({
      key: "mde",
      message: `This "${mdeLabel}" results in an invalid upper bound of ${upperBound.toFixed(
        2
      )}%`,
    });
  }
  const lowerBound = calculateTargetRate(baseline, -absoluteMde);
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

function calculateTargetRate(baseline, effectValue) {
  return baseline + effectValue;
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
  const absoluteMde = state.isRelativeMde
    ? state.baseline * (mdeValue / 100)
    : mdeValue;
  const mdeInfo = calculateMDE(state.baseline, absoluteMde, state.testType);
  const experimentSize = calculateExperimentSize({
    baseline: state.baseline / 100,
    absoluteMde: absoluteMde,
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
    correctionMethod: state.correctionMethod,
    trafficDistribution: getTrafficDistributionAsDecimals(state),
  });
  const absoluteMde = mde;
  const displayMde = state.isRelativeMde ? (mde / state.baseline) * 100 : mde;
  const mdeInfo = calculateMDE(state.baseline, absoluteMde, state.testType);
  const targetRate = mdeInfo.targetRate * 100;
  return {
    baseline: state.baseline,
    targetRate,
    mde: displayMde,
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
  }% to ${(state.baseline + state.absoluteMde).toFixed(2)}% conversion rate`;
  const absoluteTooltipText = `'${state.mde} points' means going from ${
    state.baseline
  }% to ${(state.baseline + state.absoluteMde).toFixed(2)}% conversion rate`;
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
      singleTabChartSection.classList.remove("hidden");
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
    explanationElem.innerHTML = getTestTypeExplanation(
      state,
      results,
      state.absoluteMde
    );
    updateChartVisualization(state);
  } else {
    durationValueElem.textContent = "—";
    sampleValueElem.textContent = "—";
    sampleSubtitleElem.classList.remove("hidden");
    timeEstimateElem.textContent = "…";
    explanationElem.innerHTML = "Enter valid parameters to see the test plan.";
    singleTabChartSection.classList.add("hidden");
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
    "mde-input",
    mdeTableColumnConfig
  );
  renderTableBody(
    timeTable.querySelector("tbody"),
    state.timeTableRows,
    results.timeTableData,
    "time-input",
    timeTableColumnConfig
  );
  if (
    state.activeTab === "tab-table" &&
    results.mdeTableData &&
    state.mdeChartVisible
  ) {
    renderMDEChart(state, results.mdeTableData);
  }
  if (
    state.activeTab === "tab-time" &&
    results.timeTableData &&
    state.timeChartVisible
  ) {
    renderTimeChart(state, results.timeTableData);
  }
}

function renderTableBody(
  tbodyEl,
  rowInputData,
  rowResultData,
  inputClass,
  config
) {
  if (!rowResultData) {
    tbodyEl.innerHTML = "";
    return;
  }
  const { elementToPositionMap, valueToElementMap, existingRows } =
    cacheExistingRows(tbodyEl, inputClass);
  const finalElements = [];
  const renderedElements = new Set();
  const tableType = inputClass === "mde-input" ? "mdeTable" : "timeTable";
  rowInputData.forEach((inputValue, index) => {
    const result = rowResultData[index];
    const availableElements = valueToElementMap.get(String(inputValue));
    const rowToReuse =
      availableElements?.length > 0 ? availableElements.shift() : null;
    const dataObject = result
      ? generateRowDataObject(tableType, inputValue, result)
      : null;
    if (rowToReuse) {
      renderedElements.add(rowToReuse);
      if (dataObject) {
        updateRowContent(rowToReuse, dataObject);
      }
      rowToReuse.querySelector(`.${inputClass}`).dataset.index = index;
      rowToReuse
        .querySelector(".delete-row")
        ?.setAttribute("data-index", index);
      finalElements.push(rowToReuse);
    } else {
      const newRow = document.createElement("tr");
      if (dataObject) {
        newRow.innerHTML = createRowHtml(dataObject, config, index, inputClass);
      }
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

function updateRowContent(row, dataObject) {
  for (const [key, value] of Object.entries(dataObject)) {
    const cell = row.querySelector(`td[data-col="${key}"]`);
    if (cell && !cell.classList.contains("editable")) {
      cell.textContent = value || "—";
    }
  }
}

function createRowHtml(dataObject, config, index, inputClass) {
  const cells = config
    .map((col) => {
      const content = dataObject[col.key] || "—";
      const classes = [];
      if (col.isHighlight) classes.push("highlight");
      if (col.isEditable) classes.push("editable");
      const classAttr =
        classes.length > 0 ? ` class="${classes.join(" ")}"` : "";
      const dataAttr = `data-col="${col.key}"`;
      if (col.isEditable) {
        const stepAttr = col.step ? `step="${col.step}"` : "";
        const minAttr = col.min ? `min="${col.min}"` : "";
        return `<td${classAttr} ${dataAttr}><div class="input-wrapper"><input type="number" class="${inputClass}" value="${content}" ${stepAttr} ${minAttr} data-index="${index}"></div></td>`;
      }
      return `<td${classAttr} ${dataAttr}>${content}</td>`;
    })
    .join("");
  return `<tr>${cells}</tr>`;
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
      durationDays: `${result.durationDays.toLocaleString()} days`,
      totalSampleSize: result.totalSampleSize.toLocaleString(),
    };
  }
  if (tableType === "timeTable") {
    const mdeText = `${result.mde.toFixed(2)}${
      result.isRelative ? "%" : " pp"
    }`;
    return {
      inputValue: inputValue,
      totalSampleSize: result.totalSampleSize.toLocaleString(),
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

function getTestTypeExplanation(state, results, effectValue) {
  const { testType, baseline, variants = 2 } = state;
  const { duration, totalSampleSize } = results;
  const timeText = `<span class="highlight">${formatTimeEstimate(
    duration
  )}</span>`;
  const totalSampleText = `<span class="highlight">${totalSampleSize.toLocaleString()} participants</span>`;
  const marginInPoints = Math.abs(effectValue);
  const bounds = {
    from: `<span class="highlight">${baseline.toFixed(2)}%</span>`,
    to: `<span class="highlight">${(baseline + effectValue).toFixed(
      2
    )}%</span>`,
    upper: `<span class="highlight">${(baseline + marginInPoints).toFixed(
      2
    )}%</span>`,
    lower: `<span class="highlight">${(baseline - marginInPoints).toFixed(
      2
    )}%</span>`,
  };
  const nonInferioritySubject =
    variants > 2 ? "the new versions" : "the new version";
  const equivalenceSubject = variants > 2 ? "the variants" : "both versions";
  let outcome;
  switch (testType) {
    case "superiority":
      outcome = `reliably detect an <span class="text-green">improvement from ${bounds.from} to ${bounds.to}</span>`;
      break;
    case "non-inferiority":
      outcome = `prove ${nonInferioritySubject} ${
        variants > 2 ? "are" : "is"
      } <span class="text-green">not meaningfully worse (by staying above ${
        bounds.lower
      })</span>`;
      break;
    case "two-tailed":
      outcome = `reliably detect a <span class="text-green">change from ${bounds.from} to ${bounds.upper} or ${bounds.lower}</span>`;
      break;
    case "equivalence":
      outcome = `prove ${equivalenceSubject} <span class="text-green">perform similarly (within ${bounds.lower} to ${bounds.upper})</span>`;
      break;
    default:
      outcome = `reliably detect an <span class="text-green">improvement from ${bounds.from} to ${bounds.to}</span>`;
      break;
  }
  return `Will ${outcome} with ${totalSampleText} over ${timeText}.`;
}

function calculateBoundaries(baseline, effectValue, testType) {
  switch (testType) {
    case "superiority":
      return { lower: null, upper: baseline + effectValue };
    case "two-tailed":
      return { lower: baseline - effectValue, upper: baseline + effectValue };
    case "non-inferiority":
      return { lower: baseline - effectValue, upper: null };
    case "equivalence":
      return { lower: baseline - effectValue, upper: baseline + effectValue };
    default:
      return { lower: null, upper: baseline + effectValue };
  }
}

function roundToNice(value) {
  if (value <= 0) return 0;
  if (value <= 1) return Math.ceil(value * 20) / 20;
  if (value <= 5) return Math.ceil(value * 10) / 10;
  if (value <= 20) return Math.ceil(value * 2) / 2;
  if (value <= 100) return Math.ceil(value);
  return Math.ceil(value / 10) * 10;
}

function calculateOptimalScale(baseline, effectValue) {
  const criticalPoints = [baseline - effectValue, baseline + effectValue];
  const minCritical = Math.min(...criticalPoints);
  const maxCritical = Math.max(...criticalPoints);
  const minRange = Math.max(baseline * 0.5, 1);
  const range = Math.max(maxCritical - minCritical, minRange);
  const padding = range * 0.3;
  let minBound = Math.max(0, minCritical - padding);
  let maxBound = maxCritical + padding;
  if (maxBound - minBound < baseline * 0.8) {
    const center = (minBound + maxBound) / 2;
    const halfRange = baseline * 0.4;
    minBound = Math.max(0, center - halfRange);
    maxBound = center + halfRange;
  }
  return {
    min: roundToNice(minBound),
    max: Math.min(100, roundToNice(maxBound)),
  };
}

function formatBoundaryValue(value) {
  if (value < 1) return value.toFixed(2) + "%";
  if (value < 10) return value.toFixed(1) + "%";
  return Math.round(value) + "%";
}

function generateLabels(min, max, boundaries, testType, count = 6) {
  const shouldShowLeftExtension =
    (testType === "two-tailed" || testType === "superiority-negative") &&
    boundaries.lower !== null &&
    min > 0.01;
  const shouldShowRightExtension =
    ((testType === "superiority" || testType === "two-tailed") &&
      boundaries.upper !== null &&
      max < 99.99) ||
    (testType === "non-inferiority" &&
      boundaries.lower !== null &&
      max < 99.99);
  const labels = [];
  for (let i = 0; i < count; i++) {
    const value = min + (max - min) * (i / (count - 1));
    labels.push(formatBoundaryValue(value));
  }
  if (shouldShowRightExtension) {
    const lastLabelValue = labels[count - 1];
    if (count >= 2 && labels[count - 2] === lastLabelValue) {
      labels[count - 2] = "";
    }
    labels[count - 1] = "≥" + lastLabelValue;
  }
  if (shouldShowLeftExtension) {
    const firstLabelValue = labels[0];
    if (count >= 2 && labels[1] === firstLabelValue) {
      labels[1] = "";
    }
    labels[0] = "≤" + firstLabelValue;
  }
  return labels;
}

function updateChart(baseline, boundaries, scale, testType) {
  if (!singleTabChartBar || !singleTabChartLabels) return;
  singleTabChartBar.innerHTML = "";
  singleTabChartLabels.innerHTML = "";
  const baselinePos = ((baseline - scale.min) / (scale.max - scale.min)) * 100;
  const lowerPos =
    boundaries.lower !== null
      ? ((boundaries.lower - scale.min) / (scale.max - scale.min)) * 100
      : null;
  const upperPos =
    boundaries.upper !== null
      ? ((boundaries.upper - scale.min) / (scale.max - scale.min)) * 100
      : null;
  if (testType === "superiority") {
    const undetectable = document.createElement("div");
    undetectable.className = "zone zone-undetectable zone-left";
    undetectable.style.left = "0%";
    undetectable.style.width = upperPos + "%";
    singleTabChartBar.appendChild(undetectable);
    const detectable = document.createElement("div");
    detectable.className = "zone zone-detectable zone-right";
    detectable.style.left = upperPos + "%";
    detectable.style.width = 100 - upperPos + "%";
    singleTabChartBar.appendChild(detectable);
  } else if (testType === "two-tailed") {
    const detectableLeft = document.createElement("div");
    detectableLeft.className = "zone zone-detectable zone-left";
    detectableLeft.style.left = "0%";
    detectableLeft.style.width = lowerPos + "%";
    singleTabChartBar.appendChild(detectableLeft);
    const undetectable = document.createElement("div");
    undetectable.className = "zone zone-undetectable zone-middle";
    undetectable.style.left = lowerPos + "%";
    undetectable.style.width = upperPos - lowerPos + "%";
    singleTabChartBar.appendChild(undetectable);
    const detectableRight = document.createElement("div");
    detectableRight.className = "zone zone-detectable zone-right";
    detectableRight.style.left = upperPos + "%";
    detectableRight.style.width = 100 - upperPos + "%";
    singleTabChartBar.appendChild(detectableRight);
  } else if (testType === "non-inferiority") {
    const undetectable = document.createElement("div");
    undetectable.className = "zone zone-undetectable zone-left";
    undetectable.style.left = "0%";
    undetectable.style.width = lowerPos + "%";
    singleTabChartBar.appendChild(undetectable);
    const detectable = document.createElement("div");
    detectable.className = "zone zone-detectable zone-right";
    detectable.style.left = lowerPos + "%";
    detectable.style.width = 100 - lowerPos + "%";
    singleTabChartBar.appendChild(detectable);
  } else if (testType === "equivalence") {
    const undetectableLeft = document.createElement("div");
    undetectableLeft.className = "zone zone-undetectable zone-left";
    undetectableLeft.style.left = "0%";
    undetectableLeft.style.width = lowerPos + "%";
    singleTabChartBar.appendChild(undetectableLeft);
    const detectable = document.createElement("div");
    detectable.className = "zone zone-detectable zone-middle";
    detectable.style.left = lowerPos + "%";
    detectable.style.width = upperPos - lowerPos + "%";
    singleTabChartBar.appendChild(detectable);
    const undetectableRight = document.createElement("div");
    undetectableRight.className = "zone zone-undetectable zone-right";
    undetectableRight.style.left = upperPos + "%";
    undetectableRight.style.width = 100 - upperPos + "%";
    singleTabChartBar.appendChild(undetectableRight);
  }
  const baselineMarker = document.createElement("div");
  baselineMarker.className = "baseline-marker";
  baselineMarker.style.left = baselinePos + "%";
  singleTabChartBar.appendChild(baselineMarker);
  const labels = generateLabels(scale.min, scale.max, boundaries, testType);
  labels.forEach((label, index) => {
    const labelElement = document.createElement("span");
    labelElement.textContent = label;
    if (
      (index === 0 && label.includes("≤")) ||
      (index === labels.length - 1 && label.includes("≥"))
    ) {
      labelElement.setAttribute("data-boundary", "true");
    }
    singleTabChartLabels.appendChild(labelElement);
  });
}

function updateLegendLabels(testType) {
  const labels = LEGEND_LABELS[testType];
  if (legendUndetectable && legendBaseline && legendDetectable) {
    legendUndetectable.textContent = labels.undetectable;
    legendBaseline.textContent = labels.baseline;
    legendDetectable.textContent = labels.detectable;
  } else {
  }
}

function updateChartVisualization(state) {
  const { testType, baseline, absoluteMde } = state;
  const boundaries = calculateBoundaries(baseline, absoluteMde, testType);
  const scale = calculateOptimalScale(baseline, absoluteMde);
  updateChart(baseline, boundaries, scale, testType);
  updateLegendLabels(testType);
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
  } else if (days < 365) {
    const months = Math.floor(days / 30);
    const remainingDaysAfterMonths = days % 30;
    let timeEstimateText = `${months} month${months !== 1 ? "s" : ""}`;
    if (remainingDaysAfterMonths > 0) {
      const weeks = Math.floor(remainingDaysAfterMonths / 7);
      const remainingDays = remainingDaysAfterMonths % 7;
      if (weeks > 0) {
        timeEstimateText += ` and ${weeks} week${weeks !== 1 ? "s" : ""}`;
      }
      if (remainingDays > 0) {
        timeEstimateText += ` and ${remainingDays} day${
          remainingDays !== 1 ? "s" : ""
        }`;
      }
    }
    return timeEstimateText;
  } else {
    const years = Math.floor(days / 365);
    const remainingDaysAfterYears = days % 365;
    let timeEstimateText = `${years} year${years !== 1 ? "s" : ""}`;
    if (remainingDaysAfterYears > 0) {
      const months = Math.floor(remainingDaysAfterYears / 30);
      if (months > 0) {
        timeEstimateText += ` and ${months} month${months !== 1 ? "s" : ""}`;
      }
    }
    return timeEstimateText;
  }
}

function applyEqualDistribution() {
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
}

function applyOptimalDistribution() {
  const totalVariants = calculatorState.variants;
  if (totalVariants <= 2) {
    applyEqualDistribution();
    return;
  }
  const numberOfTreatments = totalVariants - 1;
  const newDistribution = getOptimalSplit(numberOfTreatments);
  calculatorState.trafficDistribution = newDistribution;
  calculatorState.hasCustomTrafficDistribution = true;
  runUpdateCycle();
}

function downloadTableAsCSV(tableId) {
  const stateKey = tableId === "mdeTable" ? "mdeTableRows" : "timeTableRows";
  const dataKey = tableId === "mdeTable" ? "mdeTableData" : "timeTableData";
  const results = calculateResultsForActiveTab(calculatorState);
  const config =
    tableId === "mdeTable" ? mdeTableColumnConfig : timeTableColumnConfig;
  const { content, filename } = createCSVContentFromData(
    tableId,
    calculatorState[stateKey],
    results[dataKey],
    config
  );
  downloadCSV(content, filename);
}

function createCSVContentFromData(tableId, rowData, resultsData) {
  const table = document.getElementById(tableId);
  const headers = Array.from(table.querySelectorAll("thead th"))
    .map((th) => {
      const csvHeader = th.dataset.csvHeader || th.textContent;
      return csvHeader.trim();
    })
    .join(";");
  const config =
    tableId === "mdeTable" ? mdeTableColumnConfig : timeTableColumnConfig;
  const rows = rowData
    .map((rowItem, index) => {
      const result = resultsData[index];
      const rowValues = generateExportRowData(result, config, rowItem);
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

function generateExportRowData(result, config, inputValue) {
  if (!result) return [];
  const dataForExport = {
    inputValue: inputValue,
    durationDays: result.durationDays,
    crChange: `${result.baseline.toFixed(2)}% → ${result.targetRate.toFixed(
      2
    )}%`,
    totalSampleSize: result.totalSampleSize,
    mde:
      result.mde !== undefined
        ? `${result.mde.toFixed(2)}${result.isRelative ? "%" : " pp"}`
        : null, // No MDE in time table.
  };
  return config.map((col) => dataForExport[col.key] || "");
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
  const tabSpecificParamConfig = {
    "tab-single": {
      mde: state.mde,
    },
    "tab-table": {
      tblmde:
        state.mdeTableRows && state.mdeTableRows.length > 0
          ? state.mdeTableRows.join("_")
          : null,
      mdechart: state.mdeChartVisible ? 1 : null,
    },
    "tab-time": {
      tbltime:
        state.timeTableRows && state.timeTableRows.length > 0
          ? state.timeTableRows.join("_")
          : null,
      timechart: state.timeChartVisible ? 1 : null,
    },
  };
  const params = {
    // Parameters that apply to all tabs.
    bl: state.baseline,
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
    ...(tabSpecificParamConfig[state.activeTab] || {}),
  };
  if (
    (state.variants > 2 || state.hasCustomTrafficDistribution) &&
    state.trafficDistribution &&
    state.trafficDistribution.length > 0
  ) {
    params.dist = state.trafficDistribution.join("_");
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

function renderMDEChart(state, mdeTableData) {
  const userXValues = state.mdeTableRows;
  const userYValues = mdeTableData.map((d) => d.durationDays);
  if (!userXValues || !userYValues || userXValues.length === 0) {
    return;
  }
  const minX = Math.min(...userXValues);
  const maxX = Math.max(...userXValues);
  const curveXValues = [];
  const curveYValues = [];
  // Generate points every 0.5% for a smooth curve.
  for (let x = minX; x <= maxX; x += 0.5) {
    const tempMdeTableRows = [x];
    const tempResults = calculateResultsForActiveTab({
      ...state,
      mdeTableRows: tempMdeTableRows,
      activeTab: "tab-table",
    });
    if (
      tempResults &&
      tempResults.mdeTableData &&
      tempResults.mdeTableData[0]
    ) {
      const result = tempResults.mdeTableData[0];
      if (
        result.durationDays &&
        result.durationDays > 0 &&
        !isNaN(result.durationDays)
      ) {
        curveXValues.push(x);
        curveYValues.push(result.durationDays);
      }
    }
  }
  if (curveXValues.length === 0) {
    return;
  }
  const config = {
    ...getChartConfig(),
    data: mdeTableData,
    xValues: curveXValues,
    yValues: curveYValues,
    userSelectedX: userXValues,
    userSelectedY: userYValues,
    formatX: (value) => {
      const unit = state.isRelativeMde ? "%" : "pp";
      return value.toFixed(2) + unit;
    },
    formatY: (value) => Math.round(value).toLocaleString(),
    xLabel: "Δ",
    yLabel: "Days",
  };
  renderChart("mdeChart", config);
}

function renderTimeChart(state, timeTableData) {
  const userXValues = state.timeTableRows;
  const userYValues = timeTableData.map((d) => d.mde);
  if (!userXValues || !userYValues || userXValues.length === 0) {
    return;
  }
  const minX = Math.min(...userXValues);
  const maxX = Math.max(...userXValues);
  const curveXValues = [];
  const curveYValues = [];
  // Generate points every day for a smooth curve.
  for (let x = minX; x <= maxX; x += 1) {
    const tempTimeTableRows = [x];
    const tempResults = calculateResultsForActiveTab({
      ...state,
      timeTableRows: tempTimeTableRows,
      activeTab: "tab-time",
    });
    if (
      tempResults &&
      tempResults.timeTableData &&
      tempResults.timeTableData[0]
    ) {
      const result = tempResults.timeTableData[0];
      if (result.mde && result.mde > 0 && !isNaN(result.mde)) {
        curveXValues.push(x);
        curveYValues.push(result.mde);
      }
    }
  }
  if (curveXValues.length === 0) {
    return;
  }
  const config = {
    ...getChartConfig(),
    data: timeTableData,
    xValues: curveXValues,
    yValues: curveYValues,
    userSelectedX: userXValues,
    userSelectedY: userYValues,
    formatX: (value) => Math.round(value).toString(),
    formatY: (value) => {
      const unit = state.isRelativeMde ? "%" : "pp";
      return value.toFixed(2) + unit;
    },
    xLabel: "Days",
    yLabel: "Δ",
  };
  renderChart("timeChart", config);
}

function renderChart(svgId, config) {
  const svg = document.getElementById(svgId);
  if (!svg || !config.data || config.data.length === 0) return;
  svg.innerHTML = "";
  const chartDimensions = {
    width: CHART_CONSTANTS.WIDTH,
    height: CHART_CONSTANTS.HEIGHT,
    margin: config.margin || CHART_CONSTANTS.DEFAULT_MARGIN,
  };
  const bounds = calculateChartBounds(config);
  const transformer = createCoordinateTransformer(bounds, chartDimensions);
  renderGrid(svg, config, transformer, chartDimensions);
  renderAxes(svg, chartDimensions);
  renderDataLine(svg, config, transformer);
  renderDataPoints(svg, config, transformer);
  renderAxisTicks(svg, config, bounds, transformer, chartDimensions);
  renderAxisLabels(svg, config, chartDimensions);
  setupChartTooltips(svg);
}

function renderGrid(svg, config, transformer, chartDimensions) {
  if (!config.showGrid) return;
  const { margin } = chartDimensions;
  const { chartWidth, chartHeight } = transformer;
  const gridLines = config.gridLines || 5;
  for (let i = 1; i < gridLines; i++) {
    const x = margin.left + (chartWidth * i) / gridLines;
    const gridLineX = createSVGElement("line", {
      x1: x,
      y1: margin.top,
      x2: x,
      y2: margin.top + chartHeight,
      stroke: "var(--color-border)",
      "stroke-width": "1",
    });
    svg.appendChild(gridLineX);
    const y = margin.top + (chartHeight * i) / gridLines;
    const gridLineY = createSVGElement("line", {
      x1: margin.left,
      y1: y,
      x2: margin.left + chartWidth,
      y2: y,
      stroke: "var(--color-border)",
      "stroke-width": "1",
    });
    svg.appendChild(gridLineY);
  }
}

function renderAxes(svg, chartDimensions) {
  const { width, height, margin } = chartDimensions;
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const xAxis = createSVGElement("line", {
    x1: margin.left,
    y1: margin.top + chartHeight,
    x2: margin.left + chartWidth,
    y2: margin.top + chartHeight,
    stroke: "var(--color-border)",
    "stroke-width": "2",
  });
  svg.appendChild(xAxis);
  const yAxis = createSVGElement("line", {
    x1: margin.left,
    y1: margin.top,
    x2: margin.left,
    y2: margin.top + chartHeight,
    stroke: "var(--color-border)",
    "stroke-width": "2",
  });
  svg.appendChild(yAxis);
}

function renderDataLine(svg, config, transformer) {
  if (!config.showLine) return;
  let pathData = "";
  for (let i = 0; i < config.xValues.length; i++) {
    const x = transformer.toScreenX(config.xValues[i]);
    const y = transformer.toScreenY(config.yValues[i]);
    pathData += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  const path = createSVGElement("path", {
    d: pathData,
    stroke: "var(--accent)",
    "stroke-width": config.lineWidth || 3,
    fill: "none",
  });
  svg.appendChild(path);
}

function renderDataPoints(svg, config, transformer) {
  if (!config.showPoints || !config.userSelectedX || !config.userSelectedY)
    return;
  for (let i = 0; i < config.userSelectedX.length; i++) {
    const x = transformer.toScreenX(config.userSelectedX[i]);
    const y = transformer.toScreenY(config.userSelectedY[i]);
    const xValue = config.formatX
      ? config.formatX(config.userSelectedX[i])
      : config.userSelectedX[i].toFixed(1);
    const yValue = config.formatY
      ? config.formatY(config.userSelectedY[i])
      : config.userSelectedY[i].toFixed(1);
    const result = config.data[i];
    const crChangeText = result
      ? `${result.baseline.toFixed(2)}% → ${result.targetRate.toFixed(2)}%`
      : "";
    const tooltipText = `${config.xLabel || "X"}: ${xValue} • ${
      config.yLabel || "Y"
    }: ${yValue} • ${crChangeText}`;
    const hoverArea = createSVGElement("circle", {
      cx: x,
      cy: y,
      r: CHART_CONSTANTS.HOVER_RADIUS,
      fill: "transparent",
      class: "chart-point",
    });
    hoverArea.dataset.tooltip = tooltipText;
    svg.appendChild(hoverArea);
    const circle = createSVGElement("circle", {
      cx: x,
      cy: y,
      r: (config.pointRadius || CHART_CONSTANTS.POINT_RADIUS) + 1,
      fill: "var(--accent)",
      stroke: "var(--color-bg)",
      "stroke-width": "2",
    });
    circle.style.pointerEvents = "none";
    svg.appendChild(circle);
  }
}

function renderAxisTicks(svg, config, bounds, transformer, chartDimensions) {
  const { width, height, margin } = chartDimensions;
  const { adjustedMinY, adjustedMaxY, minX, maxX } = bounds;
  const xTicks = config.xTicks || 5;
  for (let i = 0; i <= xTicks; i++) {
    const value = minX + ((maxX - minX) * i) / xTicks;
    const x = margin.left + (transformer.chartWidth * i) / xTicks;
    const label = config.formatX ? config.formatX(value) : value.toFixed(1);
    const text = createSVGElement("text", {
      x: x,
      y: height - margin.bottom + 20,
      "text-anchor": "middle",
      fill: "var(--color-text)",
      "font-family": "var(--font-family)",
      "font-size": "var(--font-size-sm)",
    });
    text.textContent = label;
    svg.appendChild(text);
  }
  const yTicks = config.yTicks || 5;
  for (let i = 0; i <= yTicks; i++) {
    const value = adjustedMinY + ((adjustedMaxY - adjustedMinY) * i) / yTicks;
    const y =
      margin.top +
      transformer.chartHeight -
      (transformer.chartHeight * i) / yTicks;
    const label = config.formatY ? config.formatY(value) : value.toFixed(1);
    const text = createSVGElement("text", {
      x: margin.left - 10,
      y: y + 3,
      "text-anchor": "end",
      fill: "var(--color-text)",
      "font-family": "var(--font-family)",
      "font-size": "var(--font-size-sm)",
    });
    text.textContent = label;
    svg.appendChild(text);
  }
}

function renderAxisLabels(svg, config, chartDimensions) {
  const { width, height } = chartDimensions;
  if (config.xLabel) {
    const xLabelText = createSVGElement("text", {
      x: width / 2,
      y: height - 15,
      "text-anchor": "middle",
      fill: "var(--color-text)",
      "font-family": "var(--font-family)",
      "font-size": "var(--font-size-base)",
      "font-weight": "500",
    });
    xLabelText.textContent = config.xLabel;
    svg.appendChild(xLabelText);
  }

  if (config.yLabel) {
    const isDaysChart = config.yLabel === "Days";
    const xPos = isDaysChart ? 35 : 18;
    const yLabelText = createSVGElement("text", {
      x: xPos,
      y: height / 2,
      "text-anchor": "middle",
      fill: "var(--color-text)",
      "font-family": "var(--font-family)",
      "font-size": "var(--font-size-base)",
      "font-weight": "500",
      transform: `rotate(-90, ${xPos}, ${height / 2})`,
    });
    yLabelText.textContent = config.yLabel;
    svg.appendChild(yLabelText);
  }
}

function setupChartTooltips(svg) {
  if (!svg) return;
  let tooltip = null;
  const chartPoints = svg.querySelectorAll(".chart-point");
  chartPoints.forEach((point) => {
    point.addEventListener("mouseenter", (e) => {
      showChartTooltip(e, point.dataset.tooltip);
    });
    point.addEventListener("mouseleave", () => {
      hideChartTooltip();
    });
    point.addEventListener("mousemove", (e) => {
      if (tooltip) {
        positionTooltip(e, tooltip);
      }
    });
  });
  function showChartTooltip(event, text) {
    hideChartTooltip();
    tooltip = document.createElement("div");
    tooltip.className = "chart-tooltip visible";
    tooltip.textContent = text;
    document.body.appendChild(tooltip);
    positionTooltip(event, tooltip);
  }
  function hideChartTooltip() {
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
  }
  function positionTooltip(event, tooltip) {
    const rect = tooltip.getBoundingClientRect();
    const x = event.clientX - rect.width / 2;
    const y = event.clientY + window.scrollY - rect.height - 12;
    tooltip.style.left =
      Math.max(10, Math.min(x, window.innerWidth - rect.width - 10)) + "px";
    tooltip.style.top = Math.max(10, y) + "px";
  }
}

function calculateChartBounds(config) {
  const { xValues, yValues } = config;
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  return {
    minX,
    maxX,
    adjustedMinY: minY === maxY ? Math.max(0, minY - 1) : minY,
    adjustedMaxY: minY === maxY ? maxY + 1 : maxY,
  };
}

function createCoordinateTransformer(bounds, chartDimensions) {
  const { minX, maxX, adjustedMinY, adjustedMaxY } = bounds;
  const { width, height, margin } = chartDimensions;
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  return {
    toScreenX: (x) => margin.left + ((x - minX) / (maxX - minX)) * chartWidth,
    toScreenY: (y) =>
      margin.top +
      chartHeight -
      ((y - adjustedMinY) / (adjustedMaxY - adjustedMinY)) * chartHeight,
    chartWidth,
    chartHeight,
  };
}

function createSVGElement(tag, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
}

function getChartConfig() {
  return {
    showGrid: true,
    gridLines: 4,
    showLine: true,
    showPoints: true,
    lineWidth: 2.5,
    pointRadius: 3,
    xTicks: 4,
    yTicks: 4,
    margin: { top: 40, right: 50, bottom: 60, left: 80 },
  };
}
