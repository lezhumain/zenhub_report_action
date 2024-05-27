// eslint-disable-next-line @typescript-eslint/no-require-imports,import/no-commonjs,@typescript-eslint/no-var-requires
const path = require('path')
// eslint-disable-next-line @typescript-eslint/no-require-imports,import/no-commonjs,@typescript-eslint/no-var-requires
const webpack = require('webpack')

// eslint-disable-next-line import/no-commonjs
module.exports = {
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  plugins: [
    new webpack.NormalModuleReplacementPlugin(/node:/, resource => {
      resource.request = resource.request.replace(/^node:/, '')
    })
  ],
  target: 'node'
}
