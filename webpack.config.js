const webpack = require('webpack');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");
const path = require('path');

module.exports = env => ({
	entry: './src/main.js',
	output: {
		clean: true,
		path: path.resolve(__dirname, 'dist'),
		filename: 'bundle.js'
	},
	module: {
		rules: [
			{
				test: /\.css$/,
				use: ['style-loader', 'css-loader']
			},
			{
				test: /\.ttf$/,
				type: 'asset/resource'
			},
			{
				test: /\.json$/,
				type: 'asset/source'
			}
		]
	},
	plugins: [
		new webpack.optimize.LimitChunkCountPlugin({
			maxChunks: 1,
		}),
		new MonacoWebpackPlugin({
			languages: ['json']
		}),
		new CopyPlugin({
			patterns: [
				{ from: "public" }
			].concat((env.type === 'standalone' ? [
				{ from: "public-standalone" }
			] : [])),
		}),
	]
});