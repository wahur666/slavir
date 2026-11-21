import {defineConfig} from "vitest/config";

export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    name: "unit",
                    include: ["tests/unit/**/*.test.ts"],
                    environment: "node",
                },
            },
            {
                test: {
                    name: "e2e",
                    include: ["tests/e2e/**/*.test.ts"],
                    environment: "node",
                    // The gameplay checks share one browser session and must run in order.
                    sequence: {concurrent: false},
                    fileParallelism: false,
                    testTimeout: 30_000,
                    hookTimeout: 30_000,
                },
            },
        ],
    },
});
