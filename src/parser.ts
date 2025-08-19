import { EditorView } from '@codemirror/view'
import { Text } from '@codemirror/state'

import { MoreOrderedListsSettings } from './settings/types'
import { ParsedListLine, ListType, ListSeparator } from './types'

export class Parser {

    constructor(private settings: MoreOrderedListsSettings) { }

    // MARK: Parse

    parseLines(lines: string[]): ParsedListLine[] | null {
        // Create a mock document with the lines
        const mockDoc = {
            line: (lineNum: number) => ({
                text: lines[lineNum - 1] || '',
                from: 0,
                to: (lines[lineNum - 1] || '').length
            }),
            length: lines.length
        } as Text

        // Use the existing parseList method
        const parsedList = this.parseList(mockDoc, 1, lines.length)
        
        if (!parsedList || parsedList.length === 0)
            return null

        // Extract just the ParsedListLine objects
        return parsedList.map(([, parsed]) => parsed)
    }

    // Decorator
    parseViewport(
        view: EditorView
    ): [number, ParsedListLine][][] {
        const doc = view.state.doc
        const viewport = view.viewport

        let start = doc.lineAt(viewport.from).number // may not be a list
        const end = doc.lineAt(viewport.to).number

        // Get the first visible list
        let parsedList: [number, ParsedListLine][] = []
        for (; !parsedList.length && start <= end; start++) {
            parsedList = this.parseList(doc, start, end)
        }

        // If we found a list, get the next ones
        if (parsedList.length) {
            const parsedLists: [number, ParsedListLine][][] = [parsedList]
            // Get the next visible lists
            let lastLineNumber = Math.max(...parsedList.map(([lineNumber]) => lineNumber)) + 1
            for (; lastLineNumber <= end; lastLineNumber++) {
                const nextParsedLines = this.parseList(doc, lastLineNumber, end)
                if (nextParsedLines.length) {
                    parsedLists.push(nextParsedLines)
                    lastLineNumber = Math.max(...nextParsedLines.map(([lineNumber]) => lineNumber)) + 1
                }
            }

            return parsedLists
        }

        return []
    }

    // KeyHandler, Decorator
    parseList(
        doc: Text,
        start: number,
        end: number
    ): [number, ParsedListLine][] {
        // Find the first valid line of the current list
        let listStart = start;
        for (; listStart >= 1; listStart--) {
            const lineText = doc.line(listStart).text
            if (!this.parseLine(lineText, null)) {
                // The start itself is not a valid list
                if (listStart === start)
                    return []
                break
            }
        }
        // The last line was valid, so it is our start
        if (listStart !== start)
            listStart++

        // Go through the lines of this list and parse them
        const parsedLines: [number, ParsedListLine][] = []
        for (let lineNumber = listStart; lineNumber <= end; lineNumber++) {
            const lineText = doc.line(lineNumber).text
            const indentationLevel = this.getIndentationLevel(lineText)
            // Get the context
            const context = this.findContext(
                indentationLevel,
                parsedLines
            )
            const current = this.parseLine(
                lineText,
                context
            )
            if (!current)
                break

            // Get the parent
            const parent = this.findParent(
                indentationLevel,
                parsedLines
            )

            // Only parse if we are in a list or at the top level
            if (!context
                && !parent
                && current.getIndentationLevel() > 0)
                break

            // SPECIAL CASE: We only want to parser numbers under certain conditions
            // If the seperator is parentheses, we always parse it, e.g. (1)
            // If not, it must be part of our custom lists
            // This is not the case, if the indentation level is zero
            // This is not the case, if it has no context or parent
            if (current.type === ListType.Numbered
                && current.separator !== ListSeparator.Parentheses
                && current.getIndentationLevel() === 0
                && !context
                && !parent)
                break

            parsedLines.push([lineNumber, current])
        }

        // SPECIAL CASE: The start line is not included in the parsed lines
        if (parsedLines.length > 0 && parsedLines[parsedLines.length - 1][0] < start)
            return []

        //console.log(parsedLines)

        return parsedLines
    }

    private parseLine(
        lineText: string,
        context: ParsedListLine | null
    ): ParsedListLine | null {
        // Create regex patterns based on settings
        const markerPattern = this.buildMarkerPattern()
        const separatorPattern = this.buildSeparatorPattern()

        // Standard regex match: INDENTATION + MARKER + SEPARATOR + SPACE + CONTENT
        const standardRegex = new RegExp(`^(\\s*)(${markerPattern})([${separatorPattern}]) (.*)$`)
        const standardMatch = standardRegex.exec(lineText)
        if (standardMatch) {
            const [, indentation, marker, separator, content] = standardMatch
            return this.createResult(indentation, marker, separator as ListSeparator, content, context)
        }
        
        // Double parentheses regex match: INDENTATION + ( + MARKER + ) + SPACE + CONTENT
        if (this.settings.enableParentheses) {
            const parenthesesPattern = new RegExp(`^(\\s*)\\((${markerPattern})\\) (.*)$`)
            const parenthesesMatch = parenthesesPattern.exec(lineText)
            if (parenthesesMatch) {
                const [, indentation, marker, content] = parenthesesMatch
                return this.createResult(indentation, marker, ListSeparator.Parentheses, content, context)
            }
        }
        
        return null
    }

    // MARK: Regex Patterns

    private buildMarkerPattern(): string {
        const patterns: string[] = []

        // Build character class for letters based on allowed cases
        let alphabetChars = ''
        if (this.settings.hasUppercase()) alphabetChars += 'A-Z'
        if (this.settings.hasLowercase()) alphabetChars += 'a-z'

        // We purposefully allow multi-letter sequences whenever either nested alphabetical
        // OR roman numerals are enabled. This does not incorrectly enable nested alphabetical
        // parsing because determineListType will reject non-roman multi-letter markers when
        // nestedAlphabeticalMode is disabled.
        if (alphabetChars) {
            const needMulti = this.settings.nestedAlphabeticalMode !== 'disabled' || this.settings.enableRomanLists
            const needSingle = this.settings.enableAlphabeticalLists || this.settings.enableRomanLists

            if (needMulti)
                patterns.push(`[${alphabetChars}]{2,}`) // Try longer match first
            if (needSingle)
                patterns.push(`[${alphabetChars}]`)
        }

        // Numbers always allowed at regex level; semantic filtering later
        patterns.push('[0-9]+')

        return patterns.join('|')
    }

    private buildSeparatorPattern(): string {
        const separators: string[] = []
        // Always allow dot separator for standard lists
        separators.push('\\.')
        // Allow parenthesis separator based on settings
        if (this.settings.enableParentheses)
            separators.push('\\)')
        return separators.join('')
    }

    // MARK: Create ParsedListLine

    private createResult(
        indentation: string,
        marker: string,
        separator: ListSeparator,
        content: string,
        context: ParsedListLine | null
    ): ParsedListLine | null {
        const listType = this.determineListType(marker, context)
        if (!listType)
            return null

        if (context) {
            // Use context to correct marker
            marker = this.correctMarker(listType, context)
            // Also inherit separator from context
            separator = context.separator
        }

        return new ParsedListLine(
            listType,
            indentation,
            marker,
            separator,
            ' ' + content // Add space back
        );
    }

    // MARK: List Type

    private determineListType(
        marker: string,
        context: ParsedListLine | null = null
    ): ListType | null {
        // Use context type as the primary hint when available
        if (context) {
            switch (context.type) {
                case ListType.Alphabetical:
                    // SPECIAL CASE: Transition to nested
                    if (marker.length > 1 || context.getValue(this.settings.nestedAlphabeticalMode === 'repeated') === 26) {
                        if (this.settings.nestedAlphabeticalMode !== 'disabled')
                            return ListType.NestedAlphabetical
                        return null
                    }
                    return ListType.Alphabetical
                default:
                    return context.type
            }
        }
        // Otherwise determine based on marker and settings
        if (!isNaN(parseInt(marker)))
            return ListType.Numbered
        if (this.isValidRomanNumeral(marker)
            && this.settings.enableRomanLists)
            return ListType.Roman
        if (marker.length === 1
            && this.settings.enableAlphabeticalLists)
            return ListType.Alphabetical
        if (marker.length > 1
            && this.settings.nestedAlphabeticalMode !== 'disabled')
            return ListType.NestedAlphabetical
        return null
    }

    /**
     * Validates if a marker is a properly formatted Roman numeral.
     * Supports standard Roman numerals from 1 to 3999 (i to mmmcmxcix).
     * 
     * Rules:
     * - Only valid subtractions: IV, IX, XL, XC, CD, CM
     * - No more than 3 consecutive identical symbols
     * - Proper ordering from largest to smallest value
     */
    private isValidRomanNumeral(marker: string): boolean {
        const roman = marker.toLowerCase()
        
        // Empty string is not a valid Roman numeral
        if (!roman)
            return false
        
        // Check if the string contains only valid Roman numeral characters
        if (!/^[ivxlcdm]+$/.test(roman))
            return false
        
        // Use a single comprehensive regex that matches valid Roman numerals
        // This regex ensures proper structure and valid subtractions
        const validRomanPattern = /^m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/
        
        return validRomanPattern.test(roman)
    }

    // MARK: Marker sequence
    
    private correctMarker(
        type: ListType,
        context: ParsedListLine
    ): string {
        const expectedValue = context.getValue(this.settings.nestedAlphabeticalMode === 'repeated') + 1

        switch (type) {
            case ListType.Roman: {
                return context.applyCaseStyle(
                    this.generateRomanMarker(expectedValue)
                )
            }
            case ListType.Alphabetical:
            case ListType.NestedAlphabetical: {
                return context.applyCaseStyle(
                    this.generateAlphabeticalMarker(expectedValue)
                )
            }
            case ListType.Numbered: {
                return expectedValue.toString()
            }
        }
    }

    private generateAlphabeticalMarker(value: number): string {
        if (value < 1)
            throw new Error(`Alphabetical value out of range: ${value}`)
        
        // Setting determines generation mode for all nested alphabetical lists
        if (this.settings.nestedAlphabeticalMode === 'repeated')
            return this.generateRepeatedLettersMarker(value)
        
        // Default to bijective base-26
        return this.generateStandardAlphabeticalMarker(value)
    }
    
    private generateStandardAlphabeticalMarker(value: number): string {
        if (value < 1)
            throw new Error(`Alphabetical value out of range: ${value}`)
        
        let result = ''
        let remaining = value

        // Convert to bijective base-26 system where a=1, b=2, ..., z=26
        while (remaining > 0) {
            remaining-- // Adjust for 1-based indexing (bijective)
            const charCode = (remaining % 26) + 1 // 1-26
            const char = String.fromCharCode(96 + charCode)
            result = char + result
            remaining = Math.floor(remaining / 26)
        }
        
        return result // Lowercase
    }

    // Generates markers for both single and nested alphabetical lists based on repeated letters setting
    private generateRepeatedLettersMarker(value: number): string {
        if (value < 1)
            throw new Error(`Alphabetical value out of range: ${value}`)
        
        // Calculate which length group this value belongs to
        let baseValue = 0
        let length = 1
        
        // Find the appropriate length
        for (let maxLength = 10; length <= maxLength; length++) {
            const groupSize = 26 // Each length has 26 possibilities (a-z)
            
            if (value <= baseValue + groupSize)
                break
            
            baseValue += groupSize
            
            if (length === maxLength)
                throw new Error(`Value ${value} too large for repeated letters mode`)
        }
        
        // Calculate which letter in this length group
        const letterIndex = value - baseValue // 1-26
        const char = String.fromCharCode(96 + letterIndex) // Convert to 'a'-'z'
        
        return char.repeat(length)
    }

    private generateRomanMarker(value: number): string {
        if (value < 1)
            throw new Error(`Roman value out of range: ${value}`)
        
        // Roman numeral mapping in descending order of value
        // Includes subtractive notation (e.g., cm = 900, cd = 400)
        const romanNumeralMap = new Map([
            [1000, 'm'],
            [900,  'cm'],
            [500,  'd'],
            [400,  'cd'],
            [100,  'c'],
            [90,   'xc'],
            [50,   'l'],
            [40,   'xl'],
            [10,   'x'],
            [9,    'ix'],
            [5,    'v'],
            [4,    'iv'],
            [1,    'i']
        ])
        
        let romanNumeral = ''
        let remainingValue = value
        
        // Convert to Roman numerals by repeatedly subtracting the largest possible value
        for (const [value, numeral] of romanNumeralMap) {
            while (remainingValue >= value) {
                romanNumeral += numeral
                remainingValue -= value
            }
        }
        
        return romanNumeral // Lowercase
    }

    // MARK: Context and Parent

    private getIndentationLevel(lineText: string): number {
        const match = /^(\s*)/.exec(lineText)
        const indentation = match ? match[0] : ''
        return ParsedListLine.getIndentationLevel(indentation)
    }

    private findContext(
        level: number,
        parsedLines: [number, ParsedListLine][]
    ): ParsedListLine | null {
        // Scan backwards for context
        for (let i = parsedLines.length - 1; i >= 0; i--) {
            const [, lineData] = parsedLines[i]
            if (lineData.getIndentationLevel() === level)
                return lineData
            if (lineData.getIndentationLevel() < level)
                return null
        }
        return null
    }

    private findParent(
        level: number,
        parsedLines: [number, ParsedListLine][]
    ): ParsedListLine | null {
        // Scan backwards for parent
        for (let i = parsedLines.length - 1; i >= 0; i--) {
            const [, lineData] = parsedLines[i]
            if (lineData.getIndentationLevel() + 1 === level)
                return lineData
            if (lineData.getIndentationLevel() < level - 1)
                return null
        }
        return null
    }
}