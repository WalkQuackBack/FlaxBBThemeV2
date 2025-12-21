# Flax Blockbench Theme V2

A Blockbench theme based on [Fluent 2](https://fluent2.microsoft.design/).

## Theme variants

- Colours into folders (themes/\<color>/variant)
  - lime
    - All variants available
  - purple
    - All variants available
  - red
    - All variants available
  - bb-blue
    - All variants available
- Variants:
  - dark
  - dark-mc
  - dark-hc
  - light
  - light-mc
  - light-hc
- Extras
  - High Contrast `theme/core/highContrast`
  - Roboto Font `theme/core/robotoTypescale`
  - Assistant Font `theme/core/assistantTypescale`

## Development

### Preresquites

- [Node.js](https://nodejs.org/)
- [Sass](https://sass-lang.com/install/)
- [Live Dev Reloader](ADDLINK) Blockbench Plugin
  - Only necessary if wants hot reload

Pull the necessary local development modules

```bash
npm install -g sass
npm install
```

### Hot reload dev

Run this to start the Sass build watching

```bash
sass --watch ./sass/base/main.scss main.css --style=compressed --no-source-map
```

Then, watch `main.css` file with Hot Dev Reloader plugin, using action
`Watch plugin or CSS file`

### Building

Run the compiler script. Theme files will be in `dist` directory

```bash
npm run build
```
