import { EditorView } from '@codemirror/view'
import { Text } from '@codemirror/state'

import { MoreOrderedListsSettings } from './settings/types'
import { ParsedListLine, ListType, ListSeparator } from './types'

export class Parser {

    constructor(private settings: MoreOrderedListsSettings) { }

    // MARK: API

    // Reading mode post processor
    parseLines(lines: string[]): [number, ParsedListLine][][] {
        // Create a mock document with the lines
        const mockDoc = {
            line: (lineNum: number) => ({
                text: lines[lineNum - 1] || '',
                from: 0,
                to: (lines[lineNum - 1] || '').length
            }),
            length: lines.length
        } as Text

        // Use the common parseLists method
        return this.parseLists(mockDoc, 1, lines.length)
    }

    // Edit mode decorator
    parseViewport(
        view: EditorView
    ): [number, ParsedListLine][][] {
        const doc = view.state.doc
        const viewport = view.viewport

        const start = doc.lineAt(viewport.from).number
        const end = doc.lineAt(viewport.to).number

        // Find potential list start to handle cases where viewport starts mid-list
        const potentialStart = this.findPotentialListStart(doc, start)

        // Parse all lists from potential start to end
        const allLists = this.parseLists(doc, potentialStart, end)

        // Filter out lists that end before our actual viewport start
        return allLists.filter(list => {
            const lastLineNumber = Math.max(...list.map(([lineNumber]) => lineNumber))
            return lastLineNumber >= start
        })
    }

    // Key Handlers
    findListForLine(doc: Text, targetLine: number): [number, ParsedListLine][] {
        const potentialStart = this.findPotentialListStart(doc, targetLine)
        const allLists = this.parseLists(doc, potentialStart, doc.lines)
        
        // Find the list that contains our target line
        for (const list of allLists) {
            const found = list.find(([lineNumber]) => lineNumber === targetLine)
            if (found)
                return list // Return the ParsedListLine
        }
        
        return [] // Target line is not part of any valid list
    }

    // MARK: Parsing

    // Common method for finding multiple lists in a range
    private parseLists(
        doc: Text,
        start: number,
        end: number
    ): [number, ParsedListLine][][] {
        const parsedLists: [number, ParsedListLine][][] = []
        let currentLine = start

        while (currentLine <= end) {
            const parsedList = this.parseList(doc, currentLine, end)
            
            if (parsedList.length > 0) {
                parsedLists.push(parsedList)
                // Move to the line after the last parsed line
                currentLine = Math.max(...parsedList.map(([lineNumber]) => lineNumber)) + 1
            } else {
                // No list found at current line, move to next
                currentLine++
            }
        }

        return parsedLists
    }

    /**
     * Parses a single list starting from the given line and moving forward.
     * Uses incremental validation with context tracking to ensure proper nesting.
     * 
     * Note: This method does not perform backward scanning to find the list start.
     * The caller is responsible for providing the correct starting line.
     * Use `findPotentialListStart` if you need to find the start of a list.
     */
    private parseList(
        doc: Text,
        start: number,
        end: number
    ): [number, ParsedListLine][] {
        
        const contextStack: ParsedListLine[] = []
        const parsedLines: [number, ParsedListLine][] = []
        
        for (let lineNumber = start; lineNumber <= end; lineNumber++) {
            const lineText = doc.line(lineNumber).text
            const indentationLevel = this.getIndentationLevel(lineText)
            
            // Validate that the indentation increase is valid (only one level at a time)
            if (contextStack.length < indentationLevel)
                // Invalid indentation jump - break parsing
                break
            
            // Pop contexts until we're at (or below) target level
            while (contextStack.length - 1 > indentationLevel) {
                contextStack.pop()
            }
            
            // Get context from stack (previous line at same level)
            const context = contextStack.length > indentationLevel 
                ? contextStack[indentationLevel] 
                : null
            
            const current = this.parseLine(lineText, context)
            if (!current)
                break

            // Get the parent from the stack (one level up)
            const parent = indentationLevel > 0 && contextStack.length >= indentationLevel
                ? contextStack[indentationLevel - 1]
                : null

            // Only parse if we are in a list or at the top level
            if (!context && !parent && indentationLevel > 0)
                break

            // SPECIAL CASE: We only want to parse numbered and unordered lists
            // if they are not handled by Obsidian
            // This is the case, if they are at the top level (no parent)
            if ((current.type === ListType.Unordered
                || (current.type === ListType.Numbered && current.separator !== ListSeparator.Parentheses))
                && (!parent || indentationLevel === 0)
            )
                break

            if (contextStack.length === indentationLevel) {
                // Add the new indentation level
                contextStack.push(current)
            } else {
                // Update the context at this level
                contextStack[indentationLevel] = current
            }

            parsedLines.push([lineNumber, current])
        }

        return parsedLines
    }

    private parseLine(
        lineText: string,
        context: ParsedListLine | null
    ): ParsedListLine | null {
        // Create regex patterns based on settings
        const markerPattern = this.buildMarkerPattern()
        const separatorPattern = this.buildSeparatorPattern()

        // Unordered list regex match: INDENTATION + UNORDERED_MARKER + SPACE + CONTENT
        const unorderedPattern = new RegExp(`^(\\s*)([*\\-+]) (.*)$`)
        const unorderedMatch = unorderedPattern.exec(lineText)
        if (unorderedMatch) {
            const [, indentation, marker, content] = unorderedMatch
            return this.createResult(indentation, marker, ListSeparator.Dot, content, context)
        }

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

        return new ParsedListLine(
            listType,
            indentation,
            marker,
            separator,
            content
        )
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

    // MARK: List Type

    private determineListType(marker: string, context: ParsedListLine | null): ListType | null {
        const intrinsicType = this.determineIntrinsicListType(marker)

        // If we have no context, we use the intrinsic type
        if (!context)
            return intrinsicType

        // If they are the same type, it's a valid continuation
        if (intrinsicType === context.type)
            return intrinsicType

        // If the intrinsic type is roman, we need context to determine the actual type
        // This is because roman numerals are the default for ambiguous cases
        if (intrinsicType === ListType.Roman) {
            // They need to be the same length, otherwise it can not be reclassified
            if (marker.length === context.marker.length) {
                switch (context.type) {
                    case ListType.Alphabetical:
                    case ListType.NestedAlphabetical:
                        return context.type
                }
            }
        }

        // Transitions from alphabetical to nested alphabetical are allowed
        if (context.type === ListType.Alphabetical && intrinsicType === ListType.NestedAlphabetical)
            return ListType.NestedAlphabetical

        return null
    }

    private determineIntrinsicListType(marker: string): ListType | null {
        if (marker === '*' || marker === '-' || marker === '+')
            return ListType.Unordered
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

    // MARK: List Start Detection

    /**
     * Finds the potential start of a list that could contain the target line.
     * 
     * This method scans backward from the target line to find where a list
     * could potentially begin. It only checks for syntactic patterns (whether
     * lines look like list items), not semantic validity (whether they form
     * a coherent list structure).
     * 
     * Used by key handlers and viewport parsing when starting mid-list.
     */
    private findPotentialListStart(doc: Text, targetLine: number): number {
        // Start from the target line and scan backward
        let currentLine = targetLine
        
        // Keep scanning backward while we find lines that look like list items
        while (currentLine >= 1) {
            const lineText = doc.line(currentLine).text
            const parsedLine = this.parseLine(lineText, null)
            
            if (parsedLine === null) {
                // Found a non-list line
                if (currentLine === targetLine)
                    // The target line itself is not a list line
                    return targetLine
                
                // The list starts after this non-list line
                return currentLine + 1
            }
            
            // This line looks like a list item, continue scanning backward
            currentLine--
        }
        
        // Reached the beginning of the document, so start from line 1
        return 1
    }

    // MARK: Indentation

    private getIndentationLevel(lineText: string): number {
        const match = /^(\s*)/.exec(lineText)
        const indentation = match ? match[0] : ''
        return ParsedListLine.getIndentationLevel(indentation)
    }
}