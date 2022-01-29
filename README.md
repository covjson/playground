# CoverageJSON Playground

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
