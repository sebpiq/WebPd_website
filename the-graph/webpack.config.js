const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    'index': './src/index.ts',
  },
  output: {
    path: path.resolve(__dirname, './www/'),
    filename: '[name].js',
    sourceMapFilename: '[name].js.map',
  },
  mode: 'production',
  devtool: 'source-map',
  module: {
    rules: [
      // {
      //   test: /\.ts$/,
      //   use: 'ts-loader',
      //   exclude: /node_modules/,
      // },
      {
        test: /\.(js|jsx|ts|tsx)$/,               // USE THE babel-loader FOR THESE FILE EXTENSIONS
        include: path.resolve(__dirname, "src"),
        use: ['babel-loader']
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.styl$/,
        use: ['style-loader', 'css-loader', 'stylus-loader'],
      },
      {
        test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
              outputPath: 'fonts/',
            },
          },
        ],
      },
      {
        test: /\.pd$/,
        type: 'asset/source'
      }
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: 'src/index.html',
      chunks: ['index'],
    }),
  ],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json'],
    fallback: {
      events: require.resolve('events/'),
      fs: false,
    },
  },
};
