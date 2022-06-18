const path = require('path');

module.exports = {
    mode: 'development',
    entry: './main.ts',
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: [ '.ts', '.js' ],
    },
    output: {
        filename: 'example-bundle.js',
        path: path.resolve(__dirname, 'www', 'build'),
    },
    watch: true,
    devtool: "source-map",
    mode: 'development'
}