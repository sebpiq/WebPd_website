const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack')

module.exports = {
  externals: {
    'assemblyscript/asc': 'asc',
    // './src/test-helpers-node-implementations.js': ''
  },
  entry: {
    'index': './src/index.ts',
  },
  output: {
    path: path.resolve(__dirname, './www/'),
    filename: '[name].js',
    sourceMapFilename: '[name].js.map',
  },
  mode: 'development',
  // TODO : tree-shaking, not working
  optimization: {
    usedExports: true,
  },
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
      },
      {
        test: /\.mp3$/,
        type: 'asset/resource'
      }
    ],
  },
  plugins: [
    // new webpack.IgnorePlugin({ 
    //   // resourceRegExp, contextRegExp 
    //   checkResource(resource) {
    //     if (resource.includes('test')) {
    //       return true
    //     }
    //     return false
    //   },
    // }),
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
