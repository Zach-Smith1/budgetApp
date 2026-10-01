const path = require('path');

module.exports = (env, argv) => ({
  entry: './src/index.js',
  devtool: argv.mode === 'production' ? false : 'eval-cheap-source-map',
  resolve: {
    fallback: {
      fs: false,
      tls: false,
      net: false,
      path: false,
      zlib: false,
      http: false,
      https: false,
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer/'),
      crypto: false,
      url: false,
      util: require.resolve('util/'),
      querystring: require.resolve('querystring-es3'),
      assert: false,
    },
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    // the Excel reader is only downloaded when someone drops an .xlsx file
    chunkFilename: '[name].bundle.js',
    publicPath: 'auto',
  },
  performance: { hints: false },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        use: 'babel-loader',
        exclude: /node_modules/,
      },
    ],
  },
});
