const $ = (id) => document.getElementById(id);
const url = (path) => new URL(path, window.location.href).href;

const MODEL_URL = url("./models/model_v3/model.json");
const AUDIO_URLS = {
  correct: url("./assets/audios/correct.mp3"),
  incorrect: url("./assets/audios/incorrect.mp3"),
};
const CANVAS_SIZE = 280;
const MODEL_IMAGE_SIZE = 28;
const CLASS_COUNT = 10;
const COMPACT_QUERY = window.matchMedia("(max-width: 760px)");

const elements = {
  layout: $("layout"),
  drawCard: $("draw-card"),
  drawContent: $("draw-content"),
  resultsCard: $("results-card"),
  drawCanvas: $("draw-canvas"),
  previewCanvas: $("preview-canvas"),
  predictButton: $("predict-btn"),
  clearButton: $("clear-btn"),
  testButton: $("test-btn"),
  trainButton: $("train-btn"),
  readyButton: $("ready-btn"),
  thinkButton: $("think-btn"),
  predIcon: $("pred-mode-indicator"),
  canvIcon: $("canv-mode-indicator"),
  prediction: $("prediction"),
  confidence: $("confidence"),
  errorMessage: $("error-message"),
  modelStatus: $("model-status"),
  modeMessage: $("mode-message"),
  bars: $("bars"),
  trainFeedback: $("train-feedback"),
  trainIcon: $("train-icon"),
};

const drawContext = elements.drawCanvas.getContext("2d");
const previewContext = elements.previewCanvas.getContext("2d");
const audio = {
  correct: new Audio(AUDIO_URLS.correct),
  incorrect: new Audio(AUDIO_URLS.incorrect),
};

const state = {
  model: null,
  drawing: false,
  lastPoint: null,
  mode: "test",
  targetDigit: null,
  compactPredictionVisible: false,
  readyVisible: false,
  thinkProblem: null,
  lastThinkProblemKey: null,
};

let probabilityBars = [];

const modal = document.getElementById("modal");
const openPopupButton = document.getElementById("open-popup");
const closePopupButton = document.getElementById("close-popup");

const loading_popup = document.getElementById("load-popup")

init();

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function init() {
  setupCanvases();
  buildProbabilityBars();
  bindEvents();
  syncResponsivePanels();
  updateModeUI();
  loadModel();
}

function bindEvents() {
  elements.predictButton.addEventListener("click", predictDigit);
  elements.clearButton.addEventListener("click", clearCanvas);
  elements.testButton.addEventListener("click", async () => {
    await sleep(100);
    setMode("test");
    openPopupButton.innerHTML = 'Test - Change mode <i class="fa-solid fa-sliders"></i>'
    hidePopup();
  });
  elements.trainButton.addEventListener("click", async () => {
    await sleep(100);
    setMode("train");
    openPopupButton.innerHTML = 'Train - Change mode <i class="fa-solid fa-sliders"></i>'
    hidePopup();
  });
  elements.thinkButton.addEventListener("click", async () => {
    await sleep(100);
    setMode("think");
    openPopupButton.innerHTML = 'Think - Change mode <i class="fa-solid fa-sliders"></i>'
    hidePopup();
  });
  elements.readyButton.addEventListener("click", handleReadyButtonClick);
  openPopupButton.addEventListener("click", showPopup);
  closePopupButton.addEventListener("click", hidePopup);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) hidePopup();
  });
  elements.drawCanvas.addEventListener("pointerdown", startDrawing);
  elements.drawCanvas.addEventListener("pointermove", drawStroke);

  ["pointerup", "pointerleave", "pointercancel"].forEach((eventName) => {
    elements.drawCanvas.addEventListener(eventName, stopDrawing);
  });

  if (typeof COMPACT_QUERY.addEventListener === "function") {
    COMPACT_QUERY.addEventListener("change", syncResponsivePanels);
  } else {
    COMPACT_QUERY.addListener(syncResponsivePanels);
  }
}

function showPopup() {
  modal.hidden = false;
}

function hidePopup() {
  modal.hidden = true;
}

function setupCanvases() {
  elements.predictButton.disabled = true;
  fillCanvas(drawContext, CANVAS_SIZE, CANVAS_SIZE);
  fillCanvas(previewContext, MODEL_IMAGE_SIZE, MODEL_IMAGE_SIZE);
  Object.assign(drawContext, {
    lineCap: "round",
    lineJoin: "round",
    lineWidth: 20,
    strokeStyle: "#ffffff",
  });
  previewContext.imageSmoothingEnabled = true;
}

function fillCanvas(context, width, height) {
  context.fillStyle = "#000000";
  context.fillRect(0, 0, width, height);
}

async function loadModel() {
  try {
    clearError();
    if (typeof tf === "undefined") throw new Error("TensorFlow.js has not been loaded.");
    if (window.location.protocol === "file:") throw new Error("Use a local server, not file://.");
    
    loading_popup.hidden = false;
    const response = await fetch(MODEL_URL);
    if (!response.ok) throw new Error("Could not download model.json (" + response.status + ")");
    await sleep(500);

    const modelJson = normalizeModelJson(await response.json());
    state.model = await tf.loadLayersModel({ load: () => buildModelArtifacts(modelJson) });

    loading_popup.hidden = true;
    elements.modelStatus.classList.remove("error");
    elements.modelStatus.classList.add("ok");
    elements.predictButton.disabled = false;
  } catch (error) {
    console.error("Failed to load model:", error);
    elements.modelStatus.style.display = "inline"
    elements.modelStatus.textContent = "Could not load model";
    elements.modelStatus.classList.remove("ok");
    elements.modelStatus.classList.add("error");
  }
}

function buildProbabilityBars() {
  elements.bars.innerHTML = "";
  probabilityBars = Array.from({ length: CLASS_COUNT }, (_, digit) => {
    const row = document.createElement("div");
    row.className = "bar";
    row.innerHTML = "<span class=\"bar-label\">" + digit + "</span>" +
      "<div class=\"bar-track\"><div class=\"bar-fill\"></div></div>" +
      "<span class=\"bar-value\">0.0%</span>";
    elements.bars.appendChild(row);
    return {
      fill: row.querySelector(".bar-fill"),
      value: row.querySelector(".bar-value"),
    };
  });
}

function startDrawing(event) {
  state.drawing = true;
  state.lastPoint = getCanvasPoint(event);
  drawDot(state.lastPoint);
}

function drawStroke(event) {
  if (!state.drawing) return;

  const point = getCanvasPoint(event);
  drawContext.beginPath();
  drawContext.moveTo(state.lastPoint.x, state.lastPoint.y);
  drawContext.lineTo(point.x, point.y);
  drawContext.stroke();
  state.lastPoint = point;
}

function stopDrawing() {
  state.drawing = false;
  state.lastPoint = null;
}

function drawDot(point) {
  drawContext.beginPath();
  drawContext.arc(point.x, point.y, drawContext.lineWidth / 2, 0, Math.PI * 2);
  drawContext.fillStyle = "#ffffff";
  drawContext.fill();
}

function getCanvasPoint(event) {
  const rect = elements.drawCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (elements.drawCanvas.width / rect.width),
    y: (event.clientY - rect.top) * (elements.drawCanvas.height / rect.height),
  };
}

function clearCanvas(reset=false) {
  clearError();
  if (isCompactViewport() && state.compactPredictionVisible) showCanvasView();

  fillCanvas(drawContext, CANVAS_SIZE, CANVAS_SIZE);
  fillCanvas(previewContext, MODEL_IMAGE_SIZE, MODEL_IMAGE_SIZE);

  if (reset === true) {
    elements.prediction.textContent = "-";
    elements.confidence.textContent = "";
    hideTrainingFeedback();
    state.readyVisible = false;
    updateBars(new Array(CLASS_COUNT).fill(0));
    setModeMessage();
  }

  syncResponsivePanels();
}


async function predictDigit() {
  await sleep(100);
  if (isCompactViewport()) showPredictionView();
  if (!state.model) {
    elements.confidence.textContent = "Model is not ready yet";
    showError("Model has not been loaded. Check the status message above.");
    return;
  }

  let inputTensor;
  let outputTensor;

  try {
    clearError();
    inputTensor = createInputTensor();
    outputTensor = state.model.predict(inputTensor);

    const probabilities = Array.from(await outputTensor.data());
    const bestDigit = argMax(probabilities);
    const confidence = probabilities[bestDigit] * 100;

    elements.prediction.textContent = String(bestDigit);
    updatePredictionText(bestDigit, confidence);
    updateBars(probabilities);
    state.readyVisible = true;
    syncResponsivePanels();
  } catch (error) {
    console.error(error);
    elements.confidence.textContent = "Error while running the prediction";
    showError(error.message);
  } finally {
    inputTensor?.dispose();
    outputTensor?.dispose();
  }
}

function createInputTensor() {
  return tf.tidy(() => {
    const bigImgData = drawContext.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const pixels = bigImgData.data;

    let minX = CANVAS_SIZE, maxX = 0;
    let minY = CANVAS_SIZE, maxY = 0;
    let hasDrawing = false;

    for (let y = 0; y < CANVAS_SIZE; y++) {
      for (let x = 0; x < CANVAS_SIZE; x++) {
        const index = (y * CANVAS_SIZE + x) * 4;
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];

        if (r > 30 || g > 30 || b > 30) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          hasDrawing = true;
        }
      }
    }

    previewContext.clearRect(0, 0, MODEL_IMAGE_SIZE, MODEL_IMAGE_SIZE);
    fillCanvas(previewContext, MODEL_IMAGE_SIZE, MODEL_IMAGE_SIZE);

    if (hasDrawing) {
      const cropWidth = (maxX - minX) + 1;
      const cropHeight = (maxY - minY) + 1;

      const maxTargetSize = 20;
      let scale = maxTargetSize / Math.max(cropWidth, cropHeight);
      
      const scaledWidth = cropWidth * scale;
      const scaledHeight = cropHeight * scale;

      const targetX = (MODEL_IMAGE_SIZE - scaledWidth) / 2;
      const targetY = (MODEL_IMAGE_SIZE - scaledHeight) / 2;

      previewContext.drawImage(
        elements.drawCanvas,
        minX, minY, cropWidth, cropHeight,
        targetX, targetY, scaledWidth, scaledHeight
      );
    } else {
      previewContext.drawImage(elements.drawCanvas, 0, 0, MODEL_IMAGE_SIZE, MODEL_IMAGE_SIZE);
    }

    const imageData = previewContext.getImageData(0, 0, MODEL_IMAGE_SIZE, MODEL_IMAGE_SIZE);
    const previewPixels = imageData.data;
    let total = 0;

    for (let index = 0; index < previewPixels.length; index += 4) {
      total += previewPixels[index];
    }

    if (total / (MODEL_IMAGE_SIZE * MODEL_IMAGE_SIZE * 255) > 0.5) {
      for (let index = 0; index < previewPixels.length; index += 4) {
        const inverted = 255 - previewPixels[index];
        previewPixels[index] = inverted;
        previewPixels[index + 1] = inverted;
        previewPixels[index + 2] = inverted;
      }
      previewContext.putImageData(imageData, 0, 0);
    }

    return tf.browser.fromPixels(elements.previewCanvas, 1)
      .toFloat()
      .div(tf.scalar(255.0))
      .expandDims(0);
  });
}

function updatePredictionText(bestDigit, confidence) {
  if (state.mode === "think") {
    const correctAnswer = state.thinkProblem?.answer;
    const guessedCorrectly = bestDigit === correctAnswer;
    elements.confidence.textContent = guessedCorrectly
      ? "The model guessed correctly with a " + confidence.toFixed(1) + "% confidence"
      : "The correct answer was " + correctAnswer + ", but the model said it was a " + bestDigit + ". Confidence: " + confidence.toFixed(1) + "%";
    playTrainingSound(guessedCorrectly);
    showTrainingFeedback(guessedCorrectly);
    elements.modeMessage.textContent = "Press Ready to continue.";
    return;
  }

  if (state.mode !== "train" && state.mode !== "think") {
    elements.confidence.textContent = "Confidence: " + confidence.toFixed(1) + "%";
    return;
  }

  const guessedCorrectly = bestDigit === state.targetDigit;
  elements.confidence.textContent = guessedCorrectly
    ? "The model guessed correctly with a " + confidence.toFixed(1) + "% confidence"
    :  "The target was " + state.targetDigit + ", but the model said it was a " + bestDigit + ". Confidence: " + confidence.toFixed(1) + "%";
  playTrainingSound(guessedCorrectly);
  showTrainingFeedback(guessedCorrectly);
  elements.modeMessage.textContent = "Press Ready to continue.";
}

function updateBars(probabilities) {
  probabilities.forEach((probability, digit) => {
    const percentage = probability * 100;
    probabilityBars[digit].fill.style.width = percentage + "%";
    probabilityBars[digit].value.textContent = percentage.toFixed(1) + "%";
  });
}

function argMax(values) {
  return values.reduce((bestIndex, value, index, array) => (value > array[bestIndex] ? index : bestIndex), 0);
}

function normalizeModelJson(modelJson) {
  const normalized = structuredClone(modelJson);
  visitObject(normalized, (object) => {
    const config = object.config;
    if (object.class_name === "InputLayer" && config?.batch_shape && !config.batch_input_shape) {
      config.batch_input_shape = config.batch_shape;
      delete config.batch_shape;
    }
    normalizeDType(config);
    normalizeDType(object);
  });
  return normalized;
}

function normalizeDType(object) {
  if (object?.dtype && typeof object.dtype === "object") {
    object.dtype = object.dtype.config?.name || "float32";
  }
}

async function buildModelArtifacts(modelJson) {
  const manifest = modelJson.weightsManifest || [];
  const allWeights = manifest.flatMap((entry) => entry.weights);
  const filteredWeights = allWeights.filter((spec) => !spec.name.startsWith("optimizer/"));

  function getKerasLayers(topology) {
    if (!topology) return [];
    if (Array.isArray(topology.layers)) return topology.layers;
    if (topology.model_config?.config?.layers) return topology.model_config.config.layers;
    if (topology.config?.layers) return topology.config.layers;
    if (topology.model_config?.layers) return topology.model_config.layers;
    return [];
  }

  const layers = getKerasLayers(modelJson.modelTopology);
  const layerMap = new Map();
  layers.forEach((layer) => {
    const name = layer.config?.name || layer.name || (layer.config && layer.config.name);
    const className = layer.class_name || layer.className || layer['class_name'] || "";
    if (name) layerMap.set(name, { className, config: layer.config || {} });
  });

  function remapWeightName(origName) {
    let name = origName.replace(/:0$/, "").replace(/^sequential_1\//, "").replace(/^sequential\//, "").replace(/^models\//, "");
    const m = name.match(/^layers\/([^/]+)\/vars\/(\d+)$/);
    if (!m) return name;
    const layerName = m[1];
    const idx = Number(m[2]);
    const layerInfo = layerMap.get(layerName);
    if (!layerInfo) return `${layerName}/vars/${idx}`;
    const className = layerInfo.className;
    const cfg = layerInfo.config || {};
    let param;
    if (className === "BatchNormalization") {
      const scale = cfg.scale !== undefined ? cfg.scale : true;
      const center = cfg.center !== undefined ? cfg.center : true;
      const names = [];
      if (scale) names.push("gamma");
      if (center) names.push("beta");
      names.push("moving_mean", "moving_variance");
      param = names[idx] || `vars/${idx}`;
    } else if (className === "Conv2D" || className === "Conv1D" || className === "Conv3D") {
      const useBias = cfg.use_bias !== undefined ? cfg.use_bias : (cfg.useBias !== undefined ? cfg.useBias : true);
      const names = useBias ? ["kernel", "bias"] : ["kernel"];
      param = names[idx] || `vars/${idx}`;
    } else if (className === "DepthwiseConv2D") {
      const useBias = cfg.use_bias !== undefined ? cfg.use_bias : true;
      const names = useBias ? ["depthwise_kernel", "bias"] : ["depthwise_kernel"];
      param = names[idx] || `vars/${idx}`;
    } else if (className === "SeparableConv2D") {
      const useBias = cfg.use_bias !== undefined ? cfg.use_bias : true;
      const names = useBias ? ["depthwise_kernel", "pointwise_kernel", "bias"] : ["depthwise_kernel", "pointwise_kernel"];
      param = names[idx] || `vars/${idx}`;
    } else if (className === "Dense") {
      const useBias = cfg.use_bias !== undefined ? cfg.use_bias : (cfg.useBias !== undefined ? cfg.useBias : true);
      const names = useBias ? ["kernel", "bias"] : ["kernel"];
      param = names[idx] || `vars/${idx}`;
    } else {
      const fallback = ["kernel", "bias", "gamma", "beta", "moving_mean", "moving_variance"];
      param = fallback[idx] || `vars/${idx}`;
    }
    return `${layerName}/${param}`;
  }

  const weightSpecs = filteredWeights.map((spec) => ({ ...spec, name: remapWeightName(spec.name) }));

  const allBuffers = await Promise.all(
    manifest.flatMap((entry) => entry.paths.map((path) => fetchWeight(path)))
  );

  const weightData = extractModelWeights(allBuffers, allWeights, filteredWeights);

  return {
    modelTopology: modelJson.modelTopology,
    format: modelJson.format,
    generatedBy: modelJson.generatedBy,
    convertedBy: modelJson.convertedBy,
    weightSpecs,
    weightData,
  };
}

function extractModelWeights(buffers, allWeights, filteredWeights) {
  const combined = new Uint8Array(concatArrayBuffers(buffers));
  const nameToIndex = new Map(allWeights.map((s, i) => [s.name, i]));

  function bytesPerElement(dtype) {
    if (!dtype) return 4;
    const map = { float32: 4, int32: 4, bool: 1, float16: 2, uint8: 1, int16: 2, int8: 1, uint16: 2, complex64: 8 };
    return map[dtype] || 4;
  }

  let offset = 0;
  const offsets = allWeights.map((spec) => {
    const start = offset;
    const elemCount = Array.isArray(spec.shape) ? spec.shape.reduce((a, b) => a * b, 1) : 0;
    const byteSize = spec.quantization?.original_size || (elemCount * bytesPerElement(spec.dtype));
    offset += byteSize;
    return start;
  });

  const chunks = filteredWeights.map((spec) => {
    const originalIndex = nameToIndex.get(spec.name);
    if (originalIndex === undefined) {
      throw new Error("Weight not found in the original manifest: " + spec.name);
    }
    const start = offsets[originalIndex];
    const elemCount = Array.isArray(spec.shape) ? spec.shape.reduce((a, b) => a * b, 1) : 0;
    const size = spec.quantization?.original_size || (elemCount * bytesPerElement(spec.dtype));
    return combined.slice(start, start + size);
  });

  return concatArrayBuffers(chunks.map(c => c.buffer));
}

async function fetchWeight(path) {
  const response = await fetch(new URL(path, MODEL_URL).href);
  if (!response.ok) throw new Error("Could not download " + path + " (" + response.status + ")");
  return response.arrayBuffer();
}

function concatArrayBuffers(buffers) {
  const totalBytes = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
  const combined = new Uint8Array(totalBytes);
  let offset = 0;

  buffers.forEach((buffer) => {
    combined.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  });
  return combined.buffer;
}

function normalizeWeightName(name) {
  return name
    .replace(/^sequential_1\//, "")
    .replace(/^model\//, "")
    .replace(/^sequential\//, "")
    .replace(/:0$/, "");
}

function visitObject(value, visitor) {
  if (!value || typeof value !== "object") return;
  visitor(value);
  Object.values(value).forEach((item) => visitObject(item, visitor));
}

function showError(message) {
  elements.errorMessage.hidden = false;
  elements.errorMessage.textContent = message;
}

function clearError() {
  elements.errorMessage.hidden = true;
  elements.errorMessage.textContent = "";
}

function isCompactViewport() {
  return COMPACT_QUERY.matches;
}

function showPredictionView() {
  if (!isCompactViewport()) return;
  state.compactPredictionVisible = true;
  syncResponsivePanels();
}

function showCanvasView() {
  if (!isCompactViewport()) return;
  state.compactPredictionVisible = false;
  syncResponsivePanels();
}

function syncResponsivePanels() {
  const compactMode = isCompactViewport();
  const showPrediction = compactMode && state.compactPredictionVisible;

  elements.drawContent.hidden = showPrediction;
  if (showPrediction) {
    if (elements.resultsCard.parentElement !== elements.drawCard) elements.drawCard.appendChild(elements.resultsCard);
    elements.resultsCard.hidden = false;
  } else {
    if (elements.resultsCard.parentElement !== elements.layout) {
      elements.layout.insertBefore(elements.resultsCard, elements.drawCard.nextElementSibling);
    }
    elements.resultsCard.hidden = compactMode;
  }

  elements.trainFeedback.hidden = !state.readyVisible;
  elements.drawCard.classList.toggle("is-prediction-view", showPrediction);
}

function setMode(mode) {
  state.mode = mode;
  state.compactPredictionVisible = false;
  state.readyVisible = false;
  state.targetDigit = mode === "train" ? nextTrainingDigit(state.targetDigit) : null;
  state.thinkProblem = null;
  updateModeUI();

  if (mode === "think") {
    startThinkRound();
    elements.predIcon.className = "hint fa-solid fa-brain";
    elements.canvIcon.className = "hint fa-solid fa-brain";
  } else if (mode === "train") {
    elements.predIcon.className = "hint fa-solid fa-dumbbell";
    elements.canvIcon.className = "hint fa-solid fa-dumbbell";
    clearCanvas(true);
  } else {
    elements.predIcon.className = "hint fa-solid fa-pencil";
    elements.canvIcon.className = "hint fa-solid fa-pencil";
    clearCanvas(true);
  }
}

function updateModeUI() {
  elements.testButton.classList.toggle("active", state.mode === "test");
  elements.trainButton.classList.toggle("active", state.mode === "train");
  elements.thinkButton.classList.toggle("active", state.mode === "think");
  hideTrainingFeedback();
  setModeMessage();
  syncResponsivePanels();
}

function setModeMessage() {
  if (state.mode === "train") {
    elements.modeMessage.textContent = state.targetDigit === null
      ? "Prepare the next digit."
      : "Draw the digit " + state.targetDigit + ".";
    return;
  }

  if (state.mode === "think") {
    if (!state.thinkProblem) {
      elements.modeMessage.textContent = "Draw the result of a simple operation.";
      return;
    }

    elements.modeMessage.textContent = "Draw the result of " + state.thinkProblem.left + " " + state.thinkProblem.operator + " " + state.thinkProblem.right + ".";
    return;
  }

  elements.modeMessage.textContent = "Draw a digit and press predict.";
}

function startThinkRound() {
  state.thinkProblem = createThinkProblem();
  clearCanvas(true);
  setModeMessage();
}

function createThinkProblem() {
  const operators = ["+", "-", "x"];
  let problem;
  let attempts = 0;

  do {
    const operator = operators[Math.floor(Math.random() * operators.length)];

    if (operator === "+") {
      let left = randomDigit();
      let right = randomDigit();
      while (left + right > 9 || left === 0 || right === 0) {
        left = randomDigit();
        right = randomDigit();
      }
      problem = { left, right, operator, answer: left + right };
    } else if (operator === "-") {
      let left = randomDigit();
      let right = randomDigit();
      while (left < right || left === 0 || right === 0) {
        left = randomDigit();
        right = randomDigit();
      }
      problem = { left, right, operator, answer: left - right };
    } else {
      let left = randomDigit();
      let right = randomDigit();
      while (left * right > 9 || left === 0 || right === 0) {
        left = randomDigit();
        right = randomDigit();
      }
      problem = { left, right, operator, answer: left * right };
    }

    attempts += 1;
  } while (problemKey(problem) === state.lastThinkProblemKey && attempts < 20);

  state.lastThinkProblemKey = problemKey(problem);
  return problem;
}

function problemKey(problem) {
  return problem.left + "|" + problem.operator + "|" + problem.right;
}

function nextTrainingDigit(previousDigit) {
  if (previousDigit === null || previousDigit === undefined) return randomDigit();
  let nextDigit = randomDigit();
  while (nextDigit === previousDigit) nextDigit = randomDigit();
  return nextDigit;
}

function randomDigit() {
  return Math.floor(Math.random() * CLASS_COUNT);
}

function showTrainingFeedback(isSuccess) {
  if (state.mode !== "train" && state.mode !== "think") {
    return;
  }

  elements.trainFeedback.hidden = false;
  elements.trainIcon.innerHTML = isSuccess ? "<i class='fa-solid fa-check'></i>" : "<i class='fa-solid fa-xmark'></i>";
  elements.trainIcon.classList.toggle("success", isSuccess);
  elements.trainIcon.classList.toggle("fail", !isSuccess);
}

function hideTrainingFeedback() {
  elements.trainFeedback.hidden = true;
  elements.trainIcon.textContent = "";
  elements.trainIcon.classList.remove("success", "fail");
}

function playTrainingSound(isSuccess) {
  const sound = isSuccess ? audio.correct : audio.incorrect;
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

async function handleReadyButtonClick() {
  await sleep(100);
  if (state.mode === "train") {
    advanceTrainingRound();
    return;
  }

  if (state.mode === "think") {
    startThinkRound();
    return;
  }

  if (state.mode === "test") {
    clearCanvas(true);
  }
}

function advanceTrainingRound() {
  if (state.mode !== "train") return;
  showCanvasView();
  state.targetDigit = nextTrainingDigit(state.targetDigit);
  hideTrainingFeedback();
  setModeMessage();
  clearCanvas(true);
}
