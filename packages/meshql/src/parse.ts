import {Config} from "./configTypes";
const parser = require("@pushcorn/hocon-parser");

// Load and process HOCON file
function parse(filePath: string): Config {
    return parser.parse(filePath);
}

