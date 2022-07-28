const path = require("path");
const WebpackBar = require("webpackbar");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
  mode: "development",
  devtool: "source-map",
  entry: {
    main: "./src/main.ts",
  },
  devServer: {
    static: {
      directory: path.join(__dirname, "public")
    },
    port: 8081
  },
  output: {
    library: {
      type: "var",
      name: "Slavir"
    },
    clean: true,
    globalObject: "this",
    path: path.resolve(__dirname, "public"),
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: [/node_modules/],
        loader: "ts-loader",
        options: {
          configFile: path.resolve(__dirname, "tsconfig.json"),
        },
      },
      {
        test: [/\.vert$/, /\.frag$/],
        type: "asset/source",
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(png|jpe?g|gif|xml|svg)$/i,
        type: "asset/resource",
      },
      {
        test: /\.(mp3|wav|mpe?g|ogg)$/i,
        type: "asset/resource",
      }
    ],
  },
  optimization: {
    // minimize: true,
    // minimizer: [new TerserPlugin()],
    runtimeChunk: "single"
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  plugins: [
    new WebpackBar(),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "src", "index.html"),
    }),
    new webpack.DefinePlugin({
      CANVAS_RENDERER: JSON.stringify(true),
      WEBGL_RENDERER: JSON.stringify(true)
    }),
  ],
};
