const webpack = require('webpack');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
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
				use: [MiniCssExtractPlugin.loader, 'css-loader']
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
	optimization: {
		minimizer: [
			// `...` syntax to extend existing minimizers
			`...`,
			new CssMinimizerPlugin(),
		],
	},
	plugins: [
		new webpack.optimize.LimitChunkCountPlugin({
			maxChunks: 1,
		}),
		new MiniCssExtractPlugin({
			filename: "bundle.css"
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