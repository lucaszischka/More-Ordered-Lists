import { ListType, ListSeparator } from '../types'
import { Parser } from '../parser'

// MARK: Invalid

export const INVALID_PATTERNS = [
    'a invalid',
    'a.',
    'a . space before sep',
    '\ta. tab without parent',
    '. no marker',
    ') no marker',
    // Mixed formats
    'a1. mixed format',
    '1i. mixed format',
    // Invalid characters
    'α. greek letter',
    '中. chinese char',
    '$. symbol',
    '@. at symbol',
    '#. hash symbol',
]

// MARK: Valid (generator)

interface TestCase {
    line: string
    expectedLevel: number
    expectedCase: 'upper' | 'lower'
    expectedMarker: string
    expectedSeparator: ListSeparator
    expectedContent: string
}

/**
 * The core test function
 */ 
export function testValidTestCases(
    getParser: () => Parser,
    type: ListType,
    caseStyle: 'upper' | 'lower',
    separator: ListSeparator
) {
    const testCases = generateValidTestCases(type, caseStyle, separator)

    testCases.forEach((testCase, index) => {
        it(`should parse ${type} pattern ${index + 1}: "${testCase.line}"`, () => {
            const parser = getParser()
            const results = parser.parseLines([testCase.line])
            
            expect(results).not.toBeNull()
            if (!results) return
            
            expect(results).toHaveLength(1)
            const result = results[0]

            expect(result.type).toBe(type)
            expect(result.marker).toBe(testCase.expectedMarker)
            expect(result.separator).toBe(separator)
            expect(result.content).toBe(testCase.expectedContent)
        })
    })
}

function generateValidTestCases(
    type: ListType,
    caseStyle: 'upper' | 'lower',
    separator: ListSeparator
): TestCase[] {
    switch (type) {
        case ListType.Alphabetical:
            return generateAlphabeticalCases(caseStyle, separator)
        case ListType.Roman:
            return generateRomanCases(caseStyle, separator)
        case ListType.NestedAlphabetical:
            return generateNestedAlphabeticalCases(caseStyle, separator)
        case ListType.Numbered: {
            // Simple numbered cases if needed
            const sepChar = separator === ListSeparator.Dot ? '.' : ')'
            return Array.from({length: 10}, (_, i) => ({
                line: `${i + 1}${sepChar} Numbered item`,
                expectedLevel: 0,
                expectedCase: caseStyle,
                expectedMarker: `${i + 1}`,
                expectedSeparator: separator,
                expectedContent: ' Numbered item'  // Parser includes the space
            }))
        }
        default:
            return []
    }
}

// Simple generators for each list type

function generateAlphabeticalCases(caseStyle: 'upper' | 'lower', separator: ListSeparator): TestCase[] {
    const letters = caseStyle === 'upper' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : 'abcdefghijklmnopqrstuvwxyz'
    const sepChar = separator === ListSeparator.Dot ? '.' : ')'
    
    // Roman numeral letters that will be parsed as Roman instead of alphabetical
    const romanLetters = new Set(caseStyle === 'upper' ? ['C', 'D', 'I', 'L', 'M', 'V', 'X'] : ['c', 'd', 'i', 'l', 'm', 'v', 'x'])
    
    return letters.split('').filter(letter => !romanLetters.has(letter)).map((letter, index) => ({
        line: `${letter}${sepChar} Item content`,
        expectedLevel: 0,
        expectedCase: caseStyle,
        expectedMarker: letter,
        expectedSeparator: separator,
        expectedContent: ' Item content'  // Parser includes the space
    }))
}

function generateRomanCases(caseStyle: 'upper' | 'lower', separator: ListSeparator): TestCase[] {
    const romans = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x']
    const sepChar = separator === ListSeparator.Dot ? '.' : ')'
    
    return romans.map((roman, index) => {
        const marker = caseStyle === 'upper' ? roman.toUpperCase() : roman
        return {
            line: `${marker}${sepChar} Roman item`,
            expectedLevel: 0,
            expectedCase: caseStyle,
            expectedMarker: marker,
            expectedSeparator: separator,
            expectedContent: ' Roman item'  // Parser includes the space
        }
    })
}

function generateNestedAlphabeticalCases(caseStyle: 'upper' | 'lower', separator: ListSeparator): TestCase[] {
    const sepChar = separator === ListSeparator.Dot ? '.' : ')'
    const cases: TestCase[] = []
    
    // aa, bb, dd, ee, ff (skip cc because it's Roman numeral 200)
    const letters = ['a', 'b', 'd', 'e', 'f']
    for (let i = 0; i < letters.length; i++) {
        const char = caseStyle === 'upper' ? letters[i].toUpperCase() : letters[i]
        const marker = char + char
        cases.push({
            line: `${marker}${sepChar} Nested item`,
            expectedLevel: 0,
            expectedCase: caseStyle,
            expectedMarker: marker,
            expectedSeparator: separator,
            expectedContent: ' Nested item'  // Parser includes the space
        })
    }
    
    return cases
}
