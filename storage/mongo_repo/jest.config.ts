module.exports = {
    preset: "ts-jest", // Use ts-jest for transforming TypeScript
    testEnvironment: "node", // Use the Node.js environment
    transform: {
        "^.+\\.tsx?$": "ts-jest", // Transform .ts and .tsx files with ts-jest
    },
    moduleFileExtensions: ["ts", "tsx", "js", "json", "node"],
};