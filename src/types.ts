import type { Editor } from 'obsidian'

export enum ListType {
    Alphabetical = 'alphabetical',
    Roman = 'roman',
    NestedAlphabetical = 'nestedAlphabetical',
    Numbered = 'numbered'
}

export enum ListSeparator {
    Dot = '.',
    Parenthesis = ')',
    Parentheses = '()'
}

export class ParsedListLine {
    constructor(
        public type: ListType,
        public indentation: string, // Before the marker
        public marker: string, // Without spacing and separator, e.g. "A", "i", "AA"
        public separator: ListSeparator,
        public content: string // Contains the leading space(s)
    ) {}

    getLineText(): string {
        if (this.separator === ListSeparator.Parentheses)
            return this.indentation + '(' + this.marker + ')' + this.content
        else
            return this.indentation + this.marker + this.separator + this.content
    }

    // MARK: Indentation

    getIndentationLevel(): number {
        return ParsedListLine.getIndentationLevel(this.indentation)
    }

    static getIndentationLevel(indentation: string) {
        let level = 0

        for (let i = 0; i < indentation.length; i++) {
            if (indentation[i] === '\t') {
                level += 1
            } else if (indentation[i] === ' ') {
                // Count groups of 4 spaces as 1 level
                let spaces = 0
                while (i < indentation.length && indentation[i] === ' ') {
                    spaces++
                    i++
                }
                i-- // Adjust for the loop increment
                level += Math.floor(spaces / 4)
            }
        }
        
        return level
    }

    increaseIndentationLevel() {
        this.indentation = '\t' + this.indentation
    }

    decreaseIndentationLevel() {
        if (!this.indentation)
            throw new Error('No indentation to decrease')

        let result = this.indentation

        // Remove trailing spaces that don't form a complete 4-space level (for now)
        let trailingSpaces = 0
        for (let i = result.length - 1; i >= 0 && result[i] === ' '; i--)
            trailingSpaces++

        const incompleteSpaces = trailingSpaces % 4
        if (incompleteSpaces !== 0)
            result = result.substring(0, result.length - incompleteSpaces)

        // Remove from the end: either 1 tab or 4 spaces
        if (result.endsWith('\t')) {
            result = result.substring(0, result.length - 1)
        } else if (trailingSpaces >= 4) {
            result = result.substring(0, result.length - 4)
        } else {
            return '' // Only the trailing spaces left, that don't form a complete level (<4)
        }

        // Add the trailing spaces back, after decreasing indentation
        if (incompleteSpaces !== 0)
            result += ' '.repeat(incompleteSpaces)

        this.indentation = result
    }

    // MARK: Case Style

    getCaseStyle(): 'upper' | 'lower' | null {
        // Check if the marker contains any alphabetical characters
        if (this.marker === this.marker.toUpperCase())
            return 'upper'
        if (this.marker === this.marker.toLowerCase())
            return 'lower'
        return null // A number
    }

    applyCaseStyle(marker: string): string {
        if (this.marker === this.marker.toUpperCase())
            return marker.toUpperCase()
        if (this.marker === this.marker.toLowerCase())
            return marker.toLowerCase()
        return marker // A number
    }

    // MARK: Value

    /**
     * Calculate the numerical value associated with the list item
     */
    getValue(useRepeatedLettersMode: boolean): number {
        switch (this.type) {
            case ListType.Alphabetical:
            case ListType.NestedAlphabetical:
                return this.calculateAlphabeticalValue(useRepeatedLettersMode)
            case ListType.Roman:
                return this.calculateRomanValue()
            case ListType.Numbered:
                return parseInt(this.marker)
            default:
                throw new Error(`The list type '${this.type}' is not known.`)
        }
    }

    /**
     * Calculate value for (nested) alphabetical lists
     * Supports two modes:
     * 1. Bijective base-26 (default): aa=27, ab=28, ac=29, ..., ba=53, bb=54
     * 2. Repeated letters mode: aa=27, bb=54, cc=81 (double letters represent multiples)
     */
    private calculateAlphabeticalValue(useRepeatedLettersMode: boolean): number {
        const lowerMarker = this.marker.toLowerCase()
        
        // Check if we should use repeated letters mode
        const useRepeatedMode = useRepeatedLettersMode
        && this.type === ListType.NestedAlphabetical
        && lowerMarker.length > 1
        
        if (useRepeatedMode)
            return this.calculateRepeatedLettersValue()
        
        // Default bijective base-26 calculation
        return this.calculateBijectiveBase26Value()
    }

    /**
     * Calculate value for repeated letters mode nested alphabetical lists
     * In this mode: aa = 27, bb = 28, cc = 29, ..., zz = 52
     * The sequence is: aa, bb, cc, dd, ..., zz, aaa, bbb, ccc, ...
     * Each position represents: (base_for_length) + (letter_position)
     */
    private calculateRepeatedLettersValue(): number {
        const lowerMarker = this.marker.toLowerCase()
        
        // Verify all letters are the same
        const firstChar = lowerMarker[0]
        for (let i = 1; i < lowerMarker.length; i++) {
            // If letters are not the same, throw ~~fall back to bijective base-26~~
            if (lowerMarker[i] !== firstChar)
                throw new Error(`Repeated letters mode requires all letters to be the same, but found '${this.marker}'`)
                //return this.calculateBijectiveBase26Value()
        }
        
        const charCode = firstChar.charCodeAt(0) - 96 // 'a' = 1, 'b' = 2, etc.
        if (charCode < 1 || charCode > 26)
            throw new Error(`Out of bounds value parsed from alphabetical marker '${this.marker}'`)
        
        // Calculate base value for this length (sum of all previous lengths)
        let baseValue = 0
        for (let len = 1; len < lowerMarker.length; len++) {
            if (len === 1) {
                baseValue += 26 // Single letters: a-z (1-26)
            } else {
                baseValue += 26 // Each multi-letter length contributes 26 values
            }
        }
        
        // For the current length, each letter represents one position
        // aa=27, bb=28, cc=29, ..., so the value is baseValue + letterPosition
        return baseValue + charCode
    }

    /**
     * Calculate bijective base-26 value (fallback method)
     */
    private calculateBijectiveBase26Value(): number {
        const lowerMarker = this.marker.toLowerCase()
        let value = 0
        
        for (let i = 0; i < lowerMarker.length; i++) {
            const charCode = lowerMarker.charCodeAt(i) - 96 // 'a' = 1, 'b' = 2, etc.
            if (charCode < 1 || charCode > 26)
                throw new Error(`Out of bounds value parsed from alphabetical marker '${this.marker}'`);
            
            // Calculate: letter_i * 26^(n-i)
            // For position i (0-based), the power is (length - 1 - i)
            const power = lowerMarker.length - 1 - i
            const contribution = charCode * Math.pow(26, power)
            value += contribution
        }

        if (value === 0)
            throw new Error(`Parsed alphabetical marker seems to be empty '${this.marker}'.`)

        return value
    }

    /**
     * Calculate value for roman numerals (e.g., "i"=1, "ii"=2, "iii"=3, "iv"=4, "v"=5)
     */
    private calculateRomanValue(): number {
        const romanMap: { [key: string]: number } = {
            'i': 1, 'v': 5, 'x': 10, 'l': 50, 'c': 100, 'd': 500, 'm': 1000
        }

        const roman = this.marker.toLowerCase()

        let value = 0
        let prevValue = 0
        
        for (let i = roman.length - 1; i >= 0; i--) {
            const currentValue = romanMap[roman[i]]
            if (!currentValue)
                throw new Error(`Invalid roman numeral found in marker '${this.marker}'`)
            
            if (currentValue < prevValue) {
                value -= currentValue
            } else {
                value += currentValue
            }

            prevValue = currentValue
        }

        if (value === 0)
            throw new Error(`Parsed roman marker seems to be empty '${this.marker}'.`)
        
        return value
    }

    // MARK: Formatting

    asFirstMarker(enableJuraOrdering: boolean) {
        if (enableJuraOrdering) {
            // A., I., 1., a), aa), (1), (a), (aa), (i)
            // All settings are enabled
            switch (this.type) {
                case ListType.Alphabetical:
                    if (this.getCaseStyle() === 'upper' && this.separator === ListSeparator.Dot) {
                        this.marker = 'I'
                        this.separator = ListSeparator.Dot
                        return
                    } else if (this.getCaseStyle() === 'lower' && this.separator === ListSeparator.Parenthesis) {
                        this.marker = 'aa'
                        this.separator = ListSeparator.Parenthesis
                        return
                    } else if (this.getCaseStyle() === 'lower' && this.separator === ListSeparator.Parentheses) {
                        this.marker = 'aa'
                        this.separator = ListSeparator.Parentheses
                        return
                    }
                    break
                case ListType.Roman:
                    if (this.getCaseStyle() === 'upper' && this.separator === ListSeparator.Dot) {
                        this.marker = '1'
                        this.separator = ListSeparator.Dot
                        return
                    }
                    break
                case ListType.Numbered:
                    if (this.separator === ListSeparator.Dot) {
                        this.marker = 'a'
                        this.separator = ListSeparator.Parenthesis
                        return
                    } else if (this.separator === ListSeparator.Parentheses) {
                        this.marker = 'a'
                        this.separator = ListSeparator.Parentheses
                    }
                    break;
                case ListType.NestedAlphabetical:
                    if (this.getCaseStyle() === 'lower' && this.separator === ListSeparator.Parenthesis) {
                        this.marker = '1'
                        this.separator = ListSeparator.Parentheses
                        return
                    } else if (this.getCaseStyle() === 'lower' && this.separator === ListSeparator.Parentheses) {
                        this.marker = 'i'
                        this.separator = ListSeparator.Parentheses
                        return
                    }
                    break
            }
            if (this.indentation === '') {
                this.marker = 'A'
                this.separator = ListSeparator.Dot
                return
            }
        }
        // As the current pattern was parsed, the type and case is in settings
        switch (this.type) {
            case ListType.Alphabetical:
                this.marker = this.applyCaseStyle('a')
                break
            case ListType.Roman:
                this.marker = this.applyCaseStyle('i')
                break
            case ListType.NestedAlphabetical:
                this.marker = this.applyCaseStyle('aa')
                break
            case ListType.Numbered:
                this.marker = '1'
                break
        }
    }
}

/**
 * Interface to safely access CodeMirror instance
 */
export interface ObsidianEditorWithCM extends Editor {
    cm: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dispatch: (spec: { effects: any[] }) => void;
    };
}