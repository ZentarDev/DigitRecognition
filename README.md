# Digit Recognition
<img src="./assets/images/favicon.png" alt="Icon" width="100">

Web app for recognizing handwritten digits with a model exported from TensorFlow.js.

## Model performance (v3)

<p align="center">
    <img src="./assets/images/loss_accuracy_figure.png" alt="Loss and Accuracy figure" width="1000">
    <img src="./assets/images/confusion_matrix.png" alt="Confusion Matrix" width="500">
</p>

## Dataset used

The [MNIST](https://en.wikipedia.org/wiki/MNIST_database) dataset was used to train this model.

## Project structure

- `index.html`: interfaz principal
- `styles.css`: estilos
- `script.js`: drawing, model loading, and prediction logic
- `model/`: TensorFlow.js model and the .ipynb notebook used during training
- `assets/audios/`: success and error sounds

## Game modes

- `Test`: draw any digit and see whether it is recognized.
- `Train`: draw the digit that is shown.
- `Think`: draw the result of the indicated operation.

## Run locally

You cannot open `index.html` with `file://`. Use a local server:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Try it on the web

To try it without installing anything, visit this [link](https://zentardev.github.io/DigitRecognition).

## GitHub Pages

The project includes a workflow in `.github/workflows/deploy-pages.yml` to deploy automatically with GitHub Actions.
