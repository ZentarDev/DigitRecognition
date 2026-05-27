const MODEL_URL = new URL("./model/model.json", window.location.href).href;
const CANVAS_SIZE = 280;
const MODEL_IMAGE_SIZE = 28;
const CLASS_COUNT = 10;
const CORRECT_AUDIO_URL = new URL("./assets/audios/correct.mp3", window.location.href).href;
const INCORRECT_AUDIO_URL = new URL("./assets/audios/incorrect.mp3", window.location.href).href;

const drawCanvas = document.getElementById("draw-canvas");
const drawContext = drawCanvas.getContext("2d");
const previewCanvas = document.getElementById("preview-canvas");
const previewContext = previewCanvas.getContext("2d");
const predictButton = document.getElementById("predict-btn");
const clearButton = document.getElementById("clear-btn");
const imageInput = document.getElementById("image-input");
const testButton = document.getElementById("test-btn");
const trainButton = document.getElementById("train-btn");
const readyButton = document.getElementById("ready-btn");
const predictionElement = document.getElementById("prediction");
const confidenceElement = document.getElementById("confidence");
const errorMessageElement = document.getElementById("error-message");
const modelStatusElement = document.getElementById("model-status");
const modeMessageElement = document.getElementById("mode-message");
const barsContainer = document.getElementById("bars");
const trainFeedbackElement = document.getElementById("train-feedback");
const trainIconElement = document.getElementById("train-icon");

let model = null;
let isDrawing = false;
let lastPoint = null;
let currentMode = "test";
let targetDigit = null;
const correctAudio = new Audio(CORRECT_AUDIO_URL);
const incorrectAudio = new Audio(INCORRECT_AUDIO_URL);

setupCanvas();
buildProbabilityBars();
loadModel();

predictButton.addEventListener("click", predictDigit);
clearButton.addEventListener("click", clearCanvas);
imageInput.addEventListener("change", handleImageUpload);
testButton.addEventListener("click", () => setMode("test"));
trainButton.addEventListener("click", () => setMode("train"));
readyButton.addEventListener("click", advanceTrainingRound);

drawCanvas.addEventListener("pointerdown", startDrawing);
drawCanvas.addEventListener("pointermove", drawStroke);
drawCanvas.addEventListener("pointerup", stopDrawing);
drawCanvas.addEventListener("pointerleave", stopDrawing);
drawCanvas.addEventListener("pointercancel", stopDrawing);

function setupCanvas() {
  predictButton.disabled = true;
  drawContext.fillStyle = "#000000";
  drawContext.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  drawContext.lineCap = "round";
  drawContext.lineJoin = "round";
  drawContext.lineWidth = 20;
  drawContext.strokeStyle = "#ffffff";

  previewContext.fillStyle = "#000000";
  previewContext.fillRect(0, 0, MODEL_IMAGE_SIZE, MODEL_IMAGE_SIZE);
  previewContext.imageSmoothingEnabled = true;

  updateModeUI();
}

async function loadModel() {
  try {
    clearError();

    if (typeof tf === "undefined") {
      throw new Error("TensorFlow.js no se ha cargado. Revisa tu conexion o la CDN.");
    }

    if (window.location.protocol === "file:") {
      throw new Error("Estas abriendo la web con file://. Usa un servidor local.");
    }

    modelStatusElement.textContent = "Cargando modelo...";
    const response = await fetch(MODEL_URL);
    if (!response.ok) {
      throw new Error(`No se pudo descargar model.json (${response.status})`);
    }

    const modelJson = await response.json();
    const normalizedModelJson = normalizeModelJson(modelJson);
    const modelArtifacts = await buildModelArtifacts(normalizedModelJson);

    model = await tf.loadLayersModel({
      load: async () => modelArtifacts,
    });
    modelStatusElement.textContent = "Modelo listo";
    modelStatusElement.classList.remove("error");
    modelStatusElement.classList.add("ok");
    predictButton.disabled = false;
  } catch (error) {
    console.error(error);
    modelStatusElement.textContent = "No se pudo cargar el modelo";
    modelStatusElement.classList.remove("ok");
    modelStatusElement.classList.add("error");
    confidenceElement.textContent = "Corrige la carga del modelo para poder predecir";
    showError(`${error.message} Ruta usada: ${MODEL_URL}`);
  }
}

function buildProbabilityBars() {
  barsContainer.innerHTML = "";

  for (let digit = 0; digit < CLASS_COUNT; digit += 1) {
    const row = document.createElement("div");
    row.className = "bar";
    row.innerHTML = `
      <span class="bar-label">${digit}</span>
      <div class="bar-track"><div class="bar-fill" data-digit="${digit}"></div></div>
      <span class="bar-value" data-value="${digit}">0.0%</span>
    `;
    barsContainer.appendChild(row);
  }
}

function startDrawing(event) {
  isDrawing = true;
  lastPoint = getCanvasPoint(event);
  drawDot(lastPoint);
}

function drawStroke(event) {
  if (!isDrawing) {
    return;
  }

  const point = getCanvasPoint(event);
  drawContext.beginPath();
  drawContext.moveTo(lastPoint.x, lastPoint.y);
  drawContext.lineTo(point.x, point.y);
  drawContext.stroke();
  lastPoint = point;
}

function stopDrawing() {
  isDrawing = false;
  lastPoint = null;
}

function drawDot(point) {
  drawContext.beginPath();
  drawContext.arc(point.x, point.y, drawContext.lineWidth / 2, 0, Math.PI * 2);
  drawContext.fillStyle = "#ffffff";
  drawContext.fill();
}

function getCanvasPoint(event) {
  const rect = drawCanvas.getBoundingClientRect();
  const scaleX = drawCanvas.width / rect.width;
  const scaleY = drawCanvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function clearCanvas() {
  clearError();
  drawContext.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  drawContext.fillStyle = "#000000";
  drawContext.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  previewContext.clearRect(0, 0, MODEL_IMAGE_SIZE, MODEL_IMAGE_SIZE);
  previewContext.fillStyle = "#000000";
  previewContext.fillRect(0, 0, MODEL_IMAGE_SIZE, MODEL_IMAGE_SIZE);
  predictionElement.textContent = "-";
  confidenceElement.textContent = currentMode === "train"
    ? ""
    : "";
  if (currentMode !== "train") {
    hideTrainingFeedback();
  }
  updateBars(new Array(CLASS_COUNT).fill(0));
}

async function handleImageUpload(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  image.onload = () => {
    drawContext.fillStyle = "#000000";
    drawContext.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    drawImageContained(image);
    URL.revokeObjectURL(objectUrl);
    imageInput.value = "";
  };
  image.src = objectUrl;
}

function drawImageContained(image) {
  const scale = Math.min(CANVAS_SIZE / image.width, CANVAS_SIZE / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = (CANVAS_SIZE - width) / 2;
  const y = (CANVAS_SIZE - height) / 2;
  drawContext.drawImage(image, x, y, width, height);
}

async function predictDigit() {
  if (!model) {
    confidenceElement.textContent = "El modelo aun no esta listo";
    showError("El modelo no se ha cargado. Revisa el mensaje superior.");
    return;
  }

  let inputTensor;

  try {
    clearError();
    inputTensor = tf.tidy(() => {
      previewContext.clearRect(0, 0, MODEL_IMAGE_SIZE, MODEL_IMAGE_SIZE);
      previewContext.drawImage(drawCanvas, 0, 0, MODEL_IMAGE_SIZE, MODEL_IMAGE_SIZE);

      const imageData = previewContext.getImageData(0, 0, MODEL_IMAGE_SIZE, MODEL_IMAGE_SIZE);
      const pixels = imageData.data;
      let total = 0;

      for (let index = 0; index < pixels.length; index += 4) {
        total += pixels[index];
      }

      const mean = total / (MODEL_IMAGE_SIZE * MODEL_IMAGE_SIZE * 255);
      if (mean > 0.5) {
        for (let index = 0; index < pixels.length; index += 4) {
          const inverted = 255 - pixels[index];
          pixels[index] = inverted;
          pixels[index + 1] = inverted;
          pixels[index + 2] = inverted;
        }
        previewContext.putImageData(imageData, 0, 0);
      }

      return tf.browser.fromPixels(previewCanvas, 1).toFloat().div(255).expandDims(0);
    });

    const output = model.predict(inputTensor);
    const probabilities = Array.from(await output.data());
    const bestDigit = argMax(probabilities);
    const confidence = probabilities[bestDigit] * 100;

    predictionElement.textContent = String(bestDigit);
    if (currentMode === "train") {
      const guessedCorrectly = bestDigit === targetDigit;
      confidenceElement.textContent = guessedCorrectly
        ? `El modelo ha acertado con un ${confidence.toFixed(1)}% de confianza`
        : `El modelo ha dicho ${bestDigit}, pero habia que dibujar un ${targetDigit}. Confianza: ${confidence.toFixed(1)}%`;
      playTrainingSound(guessedCorrectly);
      showTrainingFeedback(guessedCorrectly);
      modeMessageElement.textContent = "Pulsa Listo para continuar.";
    } else {
      confidenceElement.textContent = `Confianza: ${confidence.toFixed(1)}%`;
    }
    updateBars(probabilities);

    output.dispose();
  } catch (error) {
    console.error(error);
    confidenceElement.textContent = "Error al ejecutar la predicción";
    showError(error.message);
  } finally {
    if (inputTensor) {
      inputTensor.dispose();
    }
  }
}

function updateBars(probabilities) {
  probabilities.forEach((probability, digit) => {
    const fill = document.querySelector(`[data-digit="${digit}"]`);
    const value = document.querySelector(`[data-value="${digit}"]`);
    fill.style.width = `${probability * 100}%`;
    value.textContent = `${(probability * 100).toFixed(1)}%`;
  });
}

function argMax(values) {
  return values.reduce((bestIndex, currentValue, currentIndex, array) => (
    currentValue > array[bestIndex] ? currentIndex : bestIndex
  ), 0);
}

function normalizeModelJson(modelJson) {
  const normalized = structuredClone(modelJson);

  visitObject(normalized, (object) => {
    if (object.class_name === "InputLayer" && object.config?.batch_shape && !object.config.batch_input_shape) {
      object.config.batch_input_shape = object.config.batch_shape;
      delete object.config.batch_shape;
    }

    if (object.config?.dtype && typeof object.config.dtype === "object") {
      const dtypeName = object.config.dtype.config?.name;
      object.config.dtype = typeof dtypeName === "string" ? dtypeName : "float32";
    }

    if (object.dtype && typeof object.dtype === "object") {
      const dtypeName = object.dtype.config?.name;
      object.dtype = typeof dtypeName === "string" ? dtypeName : "float32";
    }
  });

  return normalized;
}

async function buildModelArtifacts(modelJson) {
  const manifestEntries = modelJson.weightsManifest || [];
  const weightSpecs = manifestEntries
    .flatMap((entry) => entry.weights)
    .map((spec) => ({
      ...spec,
      name: normalizeWeightName(spec.name),
    }));
  const weightBuffers = [];

  for (const entry of manifestEntries) {
    for (const relativePath of entry.paths) {
      const weightUrl = new URL(relativePath, MODEL_URL).href;
      const response = await fetch(weightUrl);

      if (!response.ok) {
        throw new Error(`No se pudo descargar ${relativePath} (${response.status})`);
      }

      weightBuffers.push(await response.arrayBuffer());
    }
  }

  const weightData = concatArrayBuffers(weightBuffers);

  return {
    modelTopology: modelJson.modelTopology,
    format: modelJson.format,
    generatedBy: modelJson.generatedBy,
    convertedBy: modelJson.convertedBy,
    weightSpecs,
    weightData,
  };
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
  return name.replace(/^sequential_1\//, "");
}

function visitObject(value, visitor) {
  if (!value || typeof value !== "object") {
    return;
  }

  visitor(value);

  if (Array.isArray(value)) {
    value.forEach((item) => visitObject(item, visitor));
    return;
  }

  Object.values(value).forEach((item) => visitObject(item, visitor));
}

function showError(message) {
  errorMessageElement.hidden = false;
  errorMessageElement.textContent = message;
}

function clearError() {
  errorMessageElement.hidden = true;
  errorMessageElement.textContent = "";
}

function setMode(mode) {
  currentMode = mode;

  if (mode === "train") {
    targetDigit = nextTrainingDigit(targetDigit);
  } else {
    targetDigit = null;
  }

  updateModeUI();
  clearCanvas();
}

function updateModeUI() {
  testButton.classList.toggle("active", currentMode === "test");
  trainButton.classList.toggle("active", currentMode === "train");
  trainFeedbackElement.hidden = currentMode !== "train";

  if (currentMode === "train") {
    hideTrainingFeedback();
    modeMessageElement.textContent = targetDigit === null
      ? "Prepara el siguiente número."
      : `Dibuja el número ${targetDigit}.`;
  } else {
    hideTrainingFeedback();
    modeMessageElement.textContent = "Dibuja un número y pulsa predecir.";
  }
}

function randomDigit() {
  return Math.floor(Math.random() * CLASS_COUNT);
}

function nextTrainingDigit(previousDigit) {
  if (previousDigit === null || previousDigit === undefined) {
    return randomDigit();
  }

  let nextDigit = randomDigit();

  while (nextDigit === previousDigit) {
    nextDigit = randomDigit();
  }

  return nextDigit;
}

function showTrainingFeedback(isSuccess) {
  if (currentMode !== "train") {
    hideTrainingFeedback();
    return;
  }

  trainFeedbackElement.hidden = false;
  trainIconElement.textContent = isSuccess ? "✓" : "✕";
  trainIconElement.classList.toggle("success", isSuccess);
  trainIconElement.classList.toggle("fail", !isSuccess);
}

function playTrainingSound(isSuccess) {
  const audio = isSuccess ? correctAudio : incorrectAudio;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function hideTrainingFeedback() {
  trainFeedbackElement.hidden = true;
  trainIconElement.textContent = "";
  trainIconElement.classList.remove("success", "fail");
}

function advanceTrainingRound() {
  if (currentMode !== "train") {
    return;
  }

  targetDigit = nextTrainingDigit(targetDigit);
  hideTrainingFeedback();
  modeMessageElement.textContent = `Dibuja el número ${targetDigit}.`;
  clearCanvas();
}
