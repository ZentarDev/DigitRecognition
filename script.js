const $ = (id) => document.getElementById(id);
const url = (path) => new URL(path, window.location.href).href;

const MODEL_URL = url("./models/model_v2/model.json");
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
};

let probabilityBars = [];

init();

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
  elements.testButton.addEventListener("click", () => setMode("test"));
  elements.trainButton.addEventListener("click", () => setMode("train"));
  elements.readyButton.addEventListener("click", handleReadyButtonClick);
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
    if (typeof tf === "undefined") throw new Error("TensorFlow.js no se ha cargado.");
    if (window.location.protocol === "file:") throw new Error("Usa un servidor local, no file://.");

    elements.modelStatus.textContent = "Cargando modelo v2...";
    const response = await fetch(MODEL_URL);
    if (!response.ok) throw new Error("No se pudo descargar model.json (" + response.status + ")");

    const modelJson = normalizeModelJson(await response.json());
    state.model = await tf.loadLayersModel({ load: () => buildModelArtifacts(modelJson) });
    elements.modelStatus.textContent = "Modelo v2 listo";
    elements.modelStatus.classList.remove("error");
    elements.modelStatus.classList.add("ok");
    elements.predictButton.disabled = false;
  } catch (error) {
    console.error(error);
    elements.modelStatus.textContent = "No se pudo cargar el modelo v2";
    elements.modelStatus.classList.remove("ok");
    elements.modelStatus.classList.add("error");
    elements.confidence.textContent = "Corrige la carga del modelo v2 para poder predecir";
    showError(error.message);
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

function clearCanvas() {
  clearError();
  if (isCompactViewport() && state.compactPredictionVisible) showCanvasView();

  fillCanvas(drawContext, CANVAS_SIZE, CANVAS_SIZE);
  fillCanvas(previewContext, MODEL_IMAGE_SIZE, MODEL_IMAGE_SIZE);
  elements.prediction.textContent = "-";
  elements.confidence.textContent = "";
  setModeMessage();
  if (state.mode !== "train") hideTrainingFeedback();
  updateBars(new Array(CLASS_COUNT).fill(0));
}

async function predictDigit() {
  if (isCompactViewport()) showPredictionView();
  if (!state.model) {
    elements.confidence.textContent = "El modelo v2 aun no esta listo";
    showError("El modelo v2 no se ha cargado. Revisa el mensaje superior.");
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
  } catch (error) {
    console.error(error);
    elements.confidence.textContent = "Error al ejecutar la predicción";
    showError(error.message);
  } finally {
    inputTensor?.dispose();
    outputTensor?.dispose();
  }
}

function createInputTensor() {
  return tf.tidy(() => {
    previewContext.clearRect(0, 0, MODEL_IMAGE_SIZE, MODEL_IMAGE_SIZE);
    previewContext.drawImage(elements.drawCanvas, 0, 0, MODEL_IMAGE_SIZE, MODEL_IMAGE_SIZE);

    const imageData = previewContext.getImageData(0, 0, MODEL_IMAGE_SIZE, MODEL_IMAGE_SIZE);
    const pixels = imageData.data;
    let total = 0;

    for (let index = 0; index < pixels.length; index += 4) total += pixels[index];

    if (total / (MODEL_IMAGE_SIZE * MODEL_IMAGE_SIZE * 255) > 0.5) {
      for (let index = 0; index < pixels.length; index += 4) {
        const inverted = 255 - pixels[index];
        pixels[index] = inverted;
        pixels[index + 1] = inverted;
        pixels[index + 2] = inverted;
      }
      previewContext.putImageData(imageData, 0, 0);
    }

    return tf.browser.fromPixels(elements.previewCanvas, 1).toFloat().div(255).expandDims(0);
  });
}

function updatePredictionText(bestDigit, confidence) {
  if (state.mode !== "train") {
    elements.confidence.textContent = "Confianza: " + confidence.toFixed(1) + "%";
    return;
  }

  const guessedCorrectly = bestDigit === state.targetDigit;
  elements.confidence.textContent = guessedCorrectly
    ? "El modelo v2 ha acertado con un " + confidence.toFixed(1) + "% de confianza"
    : "El modelo v2 ha dicho " + bestDigit + ", pero habia que dibujar un " + state.targetDigit + ". Confianza: " + confidence.toFixed(1) + "%";
  playTrainingSound(guessedCorrectly);
  showTrainingFeedback(guessedCorrectly);
  elements.modeMessage.textContent = "Pulsa Listo para continuar.";
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
      throw new Error("Peso no encontrado en el manifest original: " + spec.name);
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
  if (!response.ok) throw new Error("No se pudo descargar " + path + " (" + response.status + ")");
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

  elements.readyButton.textContent = "Listo";
  elements.trainFeedback.hidden = !showPrediction;
  elements.drawCard.classList.toggle("is-prediction-view", showPrediction);
}

function setMode(mode) {
  state.mode = mode;
  state.targetDigit = mode === "train" ? nextTrainingDigit(state.targetDigit) : null;
  updateModeUI();
  clearCanvas();
}

function updateModeUI() {
  elements.testButton.classList.toggle("active", state.mode === "test");
  elements.trainButton.classList.toggle("active", state.mode === "train");
  elements.trainFeedback.hidden = state.mode !== "train";
  hideTrainingFeedback();
  setModeMessage();
}

function setModeMessage() {
  elements.modeMessage.textContent = state.mode === "train"
    ? state.targetDigit === null ? "Prepara el siguiente número." : "Dibuja el número " + state.targetDigit + "."
    : "Dibuja un número y pulsa predecir.";
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
  if (state.mode !== "train") {
    hideTrainingFeedback();
    return;
  }

  elements.trainFeedback.hidden = false;
  elements.trainIcon.textContent = isSuccess ? "✓" : "✕";
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

function handleReadyButtonClick() {
  if (state.mode === "train") {
    advanceTrainingRound();
    return;
  }
  if (isCompactViewport()) {
    showCanvasView();
    clearCanvas();
  }
}

function advanceTrainingRound() {
  if (state.mode !== "train") return;
  showCanvasView();
  state.targetDigit = nextTrainingDigit(state.targetDigit);
  hideTrainingFeedback();
  setModeMessage();
  clearCanvas();
}
