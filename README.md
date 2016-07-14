# CoverageJSON Playground

https://covjson.org/playground/

## Development setup

```bash
$ npm install -g jspm-cli // only once on your system
$ npm install
Configuration file config.js doesn't exist, create it? [yes]: yes
$ npm start
Starting up http-server, serving ./ on: http://0.0.0.0:8086
```

Now go to <http://localhost:8081>.

## Bundle creation for production use

A final minified bundle including all JavaScript and CSS code can be created with `npm run build`.
See the [covjson/covjson.github.io](https://github.com/covjson/covjson.github.io) reposiroty on how to include the bundle into a page.