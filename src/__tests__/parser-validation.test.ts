import { Parser } from '../parser';
import { MoreOrderedListsSettings } from '../settings/types';
import { testValidTestCases, INVALID_PATTERNS } from './test-data';
import { ListType, ListSeparator } from '../types';

describe('Parser Validation Tests', () => {
    let parser: Parser;
    let settings: MoreOrderedListsSettings;

    beforeEach(() => {
        settings = new MoreOrderedListsSettings();
        parser = new Parser(settings);
    })

    describe('Valid Pattern Parsing', () => {
        describe('Alphabetical Lists (Lowercase, Dot)', () => {
            testValidTestCases(() => parser, ListType.Alphabetical, 'lower', ListSeparator.Dot)
        })

        describe('Alphabetical Lists (Lowercase, Parentheses)', () => {
            testValidTestCases(() => parser, ListType.Alphabetical, 'lower', ListSeparator.Parenthesis)
        })

        describe('Alphabetical Lists (Uppercase, Dot)', () => {
            testValidTestCases(() => parser, ListType.Alphabetical, 'upper', ListSeparator.Dot)
        })

        describe('Alphabetical Lists (Uppercase, Parentheses)', () => {
            testValidTestCases(() => parser, ListType.Alphabetical, 'upper', ListSeparator.Parenthesis)
        })

        describe('Roman Lists (Lowercase, Dot)', () => {
            testValidTestCases(() => parser, ListType.Roman, 'lower', ListSeparator.Dot)
        })

        describe('Roman Lists (Lowercase, Parentheses)', () => {
            testValidTestCases(() => parser, ListType.Roman, 'lower', ListSeparator.Parenthesis)
        })

        describe('Roman Lists (Uppercase, Dot)', () => {
            testValidTestCases(() => parser, ListType.Roman, 'upper', ListSeparator.Dot)
        })

        describe('Roman Lists (Uppercase, Parentheses)', () => {
            testValidTestCases(() => parser, ListType.Roman, 'upper', ListSeparator.Parenthesis)
        })

        describe('Nested Alphabetical Lists (Lowercase, Dot)', () => {
            testValidTestCases(() => parser, ListType.NestedAlphabetical, 'lower', ListSeparator.Dot)
        })

        describe('Nested Alphabetical Lists (Lowercase, Parentheses)', () => {
            testValidTestCases(() => parser, ListType.NestedAlphabetical, 'lower', ListSeparator.Parenthesis)
        })

        describe('Nested Alphabetical Lists (Uppercase, Dot)', () => {
            testValidTestCases(() => parser, ListType.NestedAlphabetical, 'upper', ListSeparator.Dot)
        })

        describe('Nested Alphabetical Lists (Uppercase, Parentheses)', () => {
            testValidTestCases(() => parser, ListType.NestedAlphabetical, 'upper', ListSeparator.Parenthesis)
        })
    })

    describe('Invalid Pattern Parsing', () => {
        INVALID_PATTERNS.forEach(line => {
            it(`should reject: "${line}"`, () => {
                const result = parser.parseLines([line])
                expect(result).toBeNull()
            })
        })
    })
})