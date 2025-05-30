const path = require('path');
const HtmlWebPackPlugin = require("html-webpack-plugin");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.exports = {
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.(css)$/,
        type: "asset/source"
      }
    ],
  },
  stats: {
    warningsFilter: [
      'Critical dependency: the request of a dependency is an expression'
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      "crypto": false,
      "http": require.resolve("stream-http"),
      "stream": require.resolve("stream-browserify"),
      "https": require.resolve("https-browserify"),
      "os": require.resolve("os-browserify/browser")
    }
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
      new HtmlWebPackPlugin({
          hash: true,
          template: './src/index.html',
          filename: 'index.html'
      }),
      new HtmlWebPackPlugin({
        hash: true,
        template: './src/perf.html',
        filename: 'perf.html'
      }),
      new NodePolyfillPlugin()
  ],
  experiments: {
    syncWebAssembly: true
  }
};