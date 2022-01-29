# CoverageJSON Playground

**EXPERIMENTAL:** This is an experiment where the editor is replaced with monaco (VS Code's editor component). This branch has been abondoned for now due to a few issues that would compromise the experience too much:

- No line-level error markers on the side (like CodeMirror) that can be hovered to see error details. This is important for custom errors that would be anchored to the first line and in monaco would only cause `{` to be underlined, which is not very visible.
- Completion list rendering partly broken https://github.com/microsoft/monaco-editor/issues/2870
- Hover is shown outside of visible area below editor https://github.com/microsoft/monaco-editor/issues/2819

The main reason for trying out monaco was its built-in JSON Schema validation support. Additional freebies that monaco provides are auto-completion and description hovers. However, those are not strictly necessary for the playground.



https://covjson.org/playground/

## Development setup

```sh
npm install
npm run dev
```

Now go to the web address shown in the terminal.

## Production build

An optimized build can be created with `npm run build-standalone` or `npm run build-embeddable`. The standalone variant includes extra files (see `public-standalone/`) to publish the playground as a minimal website. The embeddable variant assumes that the playground is embedded in an existing website and omits those files.

See the [covjson/covjson.github.io](https://github.com/covjson/covjson.github.io) repository on how to embed the playground in an existing website.
