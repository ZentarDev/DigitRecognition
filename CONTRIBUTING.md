# Contributing

Gracias por contribuir a `DigitRecognition`.

Este proyecto es una aplicación web estática que carga un modelo de TensorFlow.js para reconocer dígitos dibujados a mano. La prioridad es mantener la web simple, ligera y compatible con escritorio, móvil y GitHub Pages.

## Objetivos del proyecto

- Mantener una experiencia clara y rápida.
- No introducir dependencias innecesarias.
- Preservar la compatibilidad con despliegue estático.
- Mantener la carga del modelo y los assets funcionando con rutas relativas.

## Antes de contribuir

Antes de empezar:

1. Revisa si el cambio ya está cubierto por un issue o una pull request.
2. Mantén los cambios enfocados en un solo objetivo.
3. Evita mezclar refactors grandes con cambios funcionales pequeños.

## Requisitos locales

Este proyecto no necesita proceso de build.

Para ejecutarlo en local, usa un servidor HTTP:

```bash
python3 -m http.server 8000
```

Luego abre:

```text
http://localhost:8000
```

No uses `file://`, porque el navegador bloqueará la carga del modelo y otros assets.

## Estructura del proyecto

- `index.html`: estructura de la interfaz
- `styles.css`: estilos y responsive
- `script.js`: lógica de UI, modos, carga del modelo y predicción
- `model/`: artefactos del modelo TensorFlow.js
- `assets/audios/`: audios del modo entrenamiento
- `.github/workflows/`: despliegue automático a GitHub Pages

## Flujo recomendado

1. Haz un fork del repositorio.
2. Crea una rama nueva para tu cambio.
3. Implementa el cambio.
4. Prueba la web en local.
5. Abre una pull request con una descripción clara.

Ejemplo:

```bash
git checkout -b feature/mejora-entrenamiento
```

## Estándares de código

### HTML

- Usa HTML semántico cuando tenga sentido.
- Mantén la estructura simple.
- Evita añadir wrappers innecesarios.

### CSS

- Reutiliza clases existentes antes de crear nuevas.
- Mantén el estilo visual actual.
- Asegura que cualquier cambio siga funcionando en móvil.
- Si añades reglas de visibilidad, ten cuidado con elementos que usen el atributo `hidden`.

### JavaScript

- Mantén la lógica simple y legible.
- Prefiere funciones pequeñas y específicas.
- Evita dependencias externas nuevas salvo necesidad real.
- No rompas la carga del modelo en GitHub Pages.
- Si tocas el flujo de entrenamiento, prueba ambos modos: `Prueba` y `Entrena`.

## Compatibilidad

Cualquier contribución debe respetar:

- ejecución en navegador moderno
- uso en escritorio y móvil
- despliegue estático en GitHub Pages
- carga correcta de:
  - `model/model.json`
  - `model/group1-shard1of1.bin`
  - `assets/audios/*.mp3`

## Pruebas mínimas

Antes de abrir una pull request, comprueba como mínimo:

1. Que la página carga correctamente.
2. Que el modelo pasa a estado `Modelo listo`.
3. Que `Predecir` funciona en modo `Prueba`.
4. Que `Entrena` genera números y no repite el anterior.
5. Que el tick/X y el botón `Listo` funcionan correctamente.
6. Que los audios de acierto y error se reproducen en `Entrena`.
7. Que el layout sigue siendo usable en móvil.

Si modificas `script.js`, valida también la sintaxis:

```bash
node --check script.js
```

## Pull requests

Al abrir una PR, incluye:

- qué cambia
- por qué cambia
- cómo lo has probado
- capturas si el cambio afecta a la interfaz

Un formato útil:

```text
Resumen:
- ...

Motivo:
- ...

Pruebas:
- ...
```

## Qué evitar

Evita enviar PRs que:

- mezclen varios cambios no relacionados
- rompan el despliegue estático
- cambien nombres o rutas de archivos del modelo sin justificarlo
- introduzcan un framework o build tool sin necesidad
- modifiquen el comportamiento del modelo sin explicar el impacto

## Issues

Si quieres reportar un problema, intenta incluir:

- navegador y versión
- sistema operativo
- pasos para reproducirlo
- resultado esperado
- resultado real
- capturas o errores de consola si aplica

## Licencia

Al contribuir a este proyecto, aceptas que tu contribución se publique bajo la licencia del repositorio.
