module.exports = {
    "env": {
        "es6": true,
        "node": true
    },
    "extends": [
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
    ],
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "project": "tsconfig.json",
        "sourceType": "module",
        "createDefaultProgram": true,
    },
    settings: {
    },
    "plugins": [
        "@typescript-eslint",
    ],
    "rules": {
        "@typescript-eslint/adjacent-overload-signatures": "warn",
        "@typescript-eslint/array-type": "warn",
        "@typescript-eslint/ban-types": "warn",
        "@typescript-eslint/consistent-type-assertions": "warn",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/no-empty-function": "warn",
        "@typescript-eslint/no-empty-interface": "warn",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-misused-new": "warn",
        "@typescript-eslint/no-namespace": "warn",
        "@typescript-eslint/no-parameter-properties": "off",
        "@typescript-eslint/no-use-before-define": "off",
        "@typescript-eslint/no-unsafe-argument": "off",
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/no-this-alias": "off",
        "@typescript-eslint/prefer-for-of": "warn",
        "@typescript-eslint/prefer-function-type": "warn",
        "@typescript-eslint/prefer-namespace-keyword": "warn",
        "@typescript-eslint/unified-signatures": "warn",
        "@typescript-eslint/ban-ts-ignore": "off",
        "@typescript-eslint/triple-slash-reference": "off",
        "@typescript-eslint/unbound-method": "off",
        "@typescript-eslint/interface-name-prefix": "off",
        "@typescript-eslint/quotes": ["warn", "double", {"allowTemplateLiterals": true}],
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-floating-promises": "off",
        "@typescript-eslint/no-unsafe-return": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/restrict-plus-operands": "off",
        "@typescript-eslint/restrict-template-expressions": "off",
        "camelcase": "warn",
        "complexity": "off",
        "constructor-super": "warn",
        "dot-notation": "off",
        "eqeqeq": [
            "warn",
            "smart"
        ],
        "semi": "warn",
        "guard-for-in": "warn",
        "id-blacklist": [
            "warn",
            "any",
            "Number",
            "number",
            "String",
            "string",
            "Boolean",
            "boolean",
            "Undefined",
            "undefined"
        ],
        "id-match": "warn",
        "import/order": "off",
        "max-classes-per-file": [
            "warn",
            2
        ],
        "max-len": [
            "warn",
            {
                "code": 150
            }
        ],
        "sort-imports": "off",
        "new-parens": "warn",
        "no-bitwise": "off",
        "no-caller": "warn",
        "no-cond-assign": "warn",
        "no-console": "off",
        "no-debugger": "warn",
        "no-empty": "warn",
        "no-eval": "warn",
        "no-fallthrough": "off",
        "no-invalid-this": "off",
        "no-new-wrappers": "warn",
        "no-shadow": [
            "warn",
            {
                "hoist": "all"
            }
        ],
        "no-throw-literal": "warn",
        "no-trailing-spaces": "off",
        "no-undef-init": "warn",
        "no-underscore-dangle": "warn",
        "no-unsafe-finally": "warn",
        "no-unused-expressions": "warn",
        "no-unused-labels": "warn",
        "no-var": "warn",
        "object-shorthand": "off",
        "one-var": [
            "warn",
            "never"
        ],
        "prefer-arrow/prefer-arrow-functions": "off",
        "prefer-const": "warn",
        "radix": "warn",
        "spaced-comment": "off",
        "use-isnan": "warn",
        "valid-typeof": "off"
    },
    overrides: [
        {
            files: ["src/"],
            excludedFiles: []
        }
    ]
};
