// @ts-check

"use strict";

let path = require("path");

/** @type {import('webpack').Configuration} */
module.exports = {
    mode: "production",
    target: "node",
    entry: "./out/src/extension.js",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "extension.js",
        libraryTarget: "commonjs2",
        devtoolModuleFilenameTemplate: "../[resource-path]"
    },
    devtool: "source-map",
    externals: {
        vscode: "commonjs vscode"
    },
    resolve: {
        mainFields: ["browser", "module", "main"],
        extensions: [".ts", ".js"]
    }
};
