/**
 * @fileoverview Disallows or enforces spaces inside of parentheses.
 * @author Jonathan Rajavuori
 */
"use strict";

let astUtils = require("../ast-utils");

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

module.exports = {
    meta: {
        docs: {
            description: "enforce consistent spacing inside parentheses",
            category: "Stylistic Issues",
            recommended: false
        },

        fixable: "whitespace",

        schema: [
            {
                enum: ["always", "never"]
            },
            {
                type: "object",
                properties: {
                    exceptions: {
                        type: "array",
                        items: {
                            enum: ["{}", "[]", "()", "empty"]
                        },
                        uniqueItems: true
                    }
                },
                additionalProperties: false
            }
        ]
    },

    create: function(context) {

        let MISSING_SPACE_MESSAGE = "There must be a space inside this paren.",
            REJECTED_SPACE_MESSAGE = "There should be no spaces inside this paren.",
            ALWAYS = context.options[0] === "always",

            exceptionsArrayOptions = (context.options.length === 2) ? context.options[1].exceptions : [],
            options = {},
            exceptions;

        if (exceptionsArrayOptions.length) {
            options.braceException = exceptionsArrayOptions.indexOf("{}") !== -1;
            options.bracketException = exceptionsArrayOptions.indexOf("[]") !== -1;
            options.parenException = exceptionsArrayOptions.indexOf("()") !== -1;
            options.empty = exceptionsArrayOptions.indexOf("empty") !== -1;
        }

        /**
         * Produces an object with the opener and closer exception values
         * @param {Object} opts The exception options
         * @returns {Object} `openers` and `closers` exception values
         * @private
         */
        function getExceptions() {
            let openers = [],
                closers = [];

            if (options.braceException) {
                openers.push("{");
                closers.push("}");
            }

            if (options.bracketException) {
                openers.push("[");
                closers.push("]");
            }

            if (options.parenException) {
                openers.push("(");
                closers.push(")");
            }

            if (options.empty) {
                openers.push(")");
                closers.push("(");
            }

            return {
                openers: openers,
                closers: closers
            };
        }

        //--------------------------------------------------------------------------
        // Helpers
        //--------------------------------------------------------------------------
        let sourceCode = context.getSourceCode();

        /**
         * Determines if a token is one of the exceptions for the opener paren
         * @param {Object} token The token to check
         * @returns {boolean} True if the token is one of the exceptions for the opener paren
         */
        function isOpenerException(token) {
            return token.type === "Punctuator" && exceptions.openers.indexOf(token.value) >= 0;
        }

        /**
         * Determines if a token is one of the exceptions for the closer paren
         * @param {Object} token The token to check
         * @returns {boolean} True if the token is one of the exceptions for the closer paren
         */
        function isCloserException(token) {
            return token.type === "Punctuator" && exceptions.closers.indexOf(token.value) >= 0;
        }

        /**
         * Determines if an opener paren should have a missing space after it
         * @param {Object} left The paren token
         * @param {Object} right The token after it
         * @returns {boolean} True if the paren should have a space
         */
        function shouldOpenerHaveSpace(left, right) {
            if (sourceCode.isSpaceBetweenTokens(left, right)) {
                return false;
            }

            if (ALWAYS) {
                if (right.type === "Punctuator" && right.value === ")") {
                    return false;
                }
                return !isOpenerException(right);
            } else {
                return isOpenerException(right);
            }
        }

        /**
         * Determines if an closer paren should have a missing space after it
         * @param {Object} left The token before the paren
         * @param {Object} right The paren token
         * @returns {boolean} True if the paren should have a space
         */
        function shouldCloserHaveSpace(left, right) {
            if (left.type === "Punctuator" && left.value === "(") {
                return false;
            }

            if (sourceCode.isSpaceBetweenTokens(left, right)) {
                return false;
            }

            if (ALWAYS) {
                return !isCloserException(left);
            } else {
                return isCloserException(left);
            }
        }

        /**
         * Determines if an opener paren should not have an existing space after it
         * @param {Object} left The paren token
         * @param {Object} right The token after it
         * @returns {boolean} True if the paren should reject the space
         */
        function shouldOpenerRejectSpace(left, right) {
            if (right.type === "Line") {
                return false;
            }

            if (!astUtils.isTokenOnSameLine(left, right)) {
                return false;
            }

            if (!sourceCode.isSpaceBetweenTokens(left, right)) {
                return false;
            }

            if (ALWAYS) {
                return isOpenerException(right);
            } else {
                return !isOpenerException(right);
            }
        }

        /**
         * Determines if an closer paren should not have an existing space after it
         * @param {Object} left The token before the paren
         * @param {Object} right The paren token
         * @returns {boolean} True if the paren should reject the space
         */
        function shouldCloserRejectSpace(left, right) {
            if (left.type === "Punctuator" && left.value === "(") {
                return false;
            }

            if (!astUtils.isTokenOnSameLine(left, right)) {
                return false;
            }

            if (!sourceCode.isSpaceBetweenTokens(left, right)) {
                return false;
            }

            if (ALWAYS) {
                return isCloserException(left);
            } else {
                return !isCloserException(left);
            }
        }

        //--------------------------------------------------------------------------
        // Public
        //--------------------------------------------------------------------------

        return {
            Program: function checkParenSpaces(node) {
                let tokens, prevToken, nextToken;

                exceptions = getExceptions();
                tokens = sourceCode.tokensAndComments;

                tokens.forEach(function(token, i) {
                    prevToken = tokens[i - 1];
                    nextToken = tokens[i + 1];

                    if (token.type !== "Punctuator") {
                        return;
                    }

                    if (token.value !== "(" && token.value !== ")") {
                        return;
                    }

                    if (token.value === "(" && shouldOpenerHaveSpace(token, nextToken)) {
                        context.report({
                            node: node,
                            loc: token.loc.start,
                            message: MISSING_SPACE_MESSAGE,
                            fix: function(fixer) {
                                return fixer.insertTextAfter(token, " ");
                            }
                        });
                    } else if (token.value === "(" && shouldOpenerRejectSpace(token, nextToken)) {
                        context.report({
                            node: node,
                            loc: token.loc.start,
                            message: REJECTED_SPACE_MESSAGE,
                            fix: function(fixer) {
                                return fixer.removeRange([token.range[1], nextToken.range[0]]);
                            }
                        });
                    } else if (token.value === ")" && shouldCloserHaveSpace(prevToken, token)) {

                        // context.report(node, token.loc.start, MISSING_SPACE_MESSAGE);
                        context.report({
                            node: node,
                            loc: token.loc.start,
                            message: MISSING_SPACE_MESSAGE,
                            fix: function(fixer) {
                                return fixer.insertTextBefore(token, " ");
                            }
                        });
                    } else if (token.value === ")" && shouldCloserRejectSpace(prevToken, token)) {
                        context.report({
                            node: node,
                            loc: token.loc.start,
                            message: REJECTED_SPACE_MESSAGE,
                            fix: function(fixer) {
                                return fixer.removeRange([prevToken.range[1], token.range[0]]);
                            }
                        });
                    }
                });
            }
        };

    }
};
