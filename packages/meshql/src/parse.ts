import {Config} from "./configTypes";
import parser from "@pushcorn/hocon-parser"

// Load and process HOCON file
function parse(filePath: string): Config {
    return parser.parse(filePath);
}

