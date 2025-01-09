import { Validator } from "@meshql/common";
import Ajv from "ajv";
import addFormats from "ajv-formats";

export function JSONSchemaValidator(schema: Record<string, any> ):Validator {
    const ajv = new Ajv();
    addFormats(ajv);
    let validate = ajv.compile(schema);

    return async (data) =>
        validate(data);
}