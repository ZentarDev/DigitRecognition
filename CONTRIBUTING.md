# Contributing

Thank you for contributing to `DigitRecognition`.

This project is a static web app that loads a TensorFlow.js model to recognize handwritten digits. The priority is to keep the site simple, lightweight, and compatible with desktop, mobile, and GitHub Pages.

## Project objectives

- Keep the experience clear and fast.
- Do not introduce unnecessary dependencies.
- Preserve compatibility with static deployment.
- Keep model loading and assets working with relative paths.

## Before contributing

Before begin:

1. Check whether the change is already covered by an issue or pull request.
2. Keep the changes focused on a single goal.
3. Avoid mixing large refactors with small functional changes.

## Local requirements

This project does not need a build process.

To run it locally, use an HTTP server:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Do not use `file://`, because the browser will block the model and other asset loads.

## Project structure

- `index.html`: interface structure
- `styles.css`: styles and responsive rules
- `script.js`: UI, modes, model loading, and prediction logic
- `model/`: TensorFlow.js model artifacts
- `assets/audios/`: training mode audio
- `.github/workflows/`: automated deployment to GitHub Pages

## Recommended flow

1. Fork the repository.
2. Create a new branch for your change.
3. Implementa el cambio.
4. Test the site locally.
5. Open a pull request with a clear description.

Example:

```bash
git checkout -b feature/improve-training
```

## Code standards

### HTML

- Use semantic HTML when it makes sense.
- Keep the structure simple.
- Avoid adding unnecessary wrappers.

### CSS

- Reuse existing classes before creating new ones.
- Keep the current visual style.
- Make sure any change still works on mobile.
- If you add visibility rules, be careful with elements that use the `hidden` attribute.

### JavaScript

- Keep the logic simple and readable.
- Prefer small, focused functions.
- Avoid new external dependencies unless they are truly needed.
- Do not break model loading on GitHub Pages.
- If you touch the training flow, test both modes: `Test` and `Train`.

## Compatibilidad

Any contribution must respect:

- execution in a modern browser
- desktop and mobile use
- static deployment on GitHub Pages
- carga correcta de:
  - `model/model.json`
  - `model/group1-shard1of1.bin`
  - `assets/audios/*.mp3`

## Minimum tests

Before opening a pull request, check at least:

1. The page loads correctly.
2. The model reaches the `Model ready` state.
3. `Predict` works in `Test` mode.
4. `Train` generates digits and does not repeat the previous one.
5. The tick/X and the `Ready` button work correctly.
6. The success and error sounds play in `Train`.
7. The layout is still usable on mobile.

If you modify `script.js`, also validate the syntax:

```bash
node --check script.js
```

## Pull requests

When opening a PR, include:

- what changed
- why it changed
- how you tested it
- capturas si el cambio afecta a la interfaz

A useful format:

```text
Summary:
- ...

Reason:
- ...

Tests:
- ...
```

## What to avoid

Avoid sending PRs that:

- mix several unrelated changes
- break static deployment
- change model file names or paths without justification
- introduce a framework or build tool without need
- modify model behavior without explaining the impact

## Issues

If you want to report a problem, try to include:

- browser and version
- operative sistem
- steps to reproduce it
- expected result
- actual result
- Console screenshots or errors, if applicable

## Licensee

By contributing to this project, you agree that your contribution will be published under the repository license.
