import type { EditorView } from '@codemirror/view'
import type { ChangeSpec } from '@codemirror/state'
import { Line } from '@codemirror/state';

import type { MoreOrderedListsSettings } from 'src/settings/types'
import type { Parser } from '../parser'
import { ListType, ParsedListLine } from '../types'

export class KeyHandler {
    constructor(
        private settings: MoreOrderedListsSettings,
        private parser: Parser
    ) {}

    // MARK: Tab (+ Shift)

    tabKey(
        view: EditorView,
        shift: boolean
    ): boolean {
        const selection = view.state.selection
        const doc = view.state.doc
        
        // Only handle single cursor and no selection
        if (!selection.main.empty || selection.ranges.length > 1)
            return false

        // Get the parsed current line
        const cursor = selection.main.head
        const currentLine = doc.lineAt(cursor)
        const parsedList = this.parser.findListForLine(doc, currentLine.number)
        const current = parsedList.find(([lineNumber]) => lineNumber === currentLine.number)?.[1]
        if (!current)
            return false

        try {
            // Calculate new indentation
            if (shift) {
                // Decrease by one level
                current.decreaseIndentationLevel()
                this.updateMarkerFromContext(parsedList, currentLine.number, current)
                
                // Fix following line if needed (after current is updated)
                this.fixFollowingLineAfterIndentDecrease(parsedList, currentLine.number, current)
            } else {
                // Increase by one level
                current.increaseIndentationLevel() // Doesn't throw
                this.updateMarkerFromContext(parsedList, currentLine.number, current)
            }
        } catch {
            return false
        }

        // Update the current line and reorder subsequent lines
        this.updateLineAndReorder(view, currentLine, current, parsedList)
        
        return true
    }

    // MARK: Enter

    enterKey(view: EditorView): boolean {
        const selection = view.state.selection
        const doc = view.state.doc
        
        // Only handle single cursor and no selection
        if (!selection.main.empty || selection.ranges.length > 1)
            return false

        // Get the parsed current line
        const cursor = selection.main.head
        const currentLine = doc.lineAt(cursor)
        const parsedList = this.parser.findListForLine(doc, currentLine.number)
        const current = parsedList.find(([lineNumber]) => lineNumber === currentLine.number)?.[1]
        if (!current)
            return false

        // SPECIAL CASE: Only continue list after z if nested is enabled
        if (current.type === ListType.Alphabetical
            && current.getValue(this.settings.nestedAlphabeticalMode === 'repeated') === 26
            && this.settings.nestedAlphabeticalMode === 'disabled')
            return false

        // SPECIAL CASE: Only continue list when enter would not break the list
        const prefixLength = current.getLineText().length - current.content.length
        if (cursor < currentLine.from + prefixLength)
            return false

        if (current.content.trim().length > 0) {
            // Create next line with corrected marker
            try {
                const newLine = current.clone()
                newLine.correctNextMarker(current, this.settings)
                newLine.content = '' // Clear content for current line
            
                // Insert new line and reorder subsequent lines
                this.insertLineAndReorder(view, currentLine, newLine, parsedList)
            } catch (error) {
                // Can't continue sequence (e.g., after 'z' with nested disabled)
                return false
            }
        } else {
            // Handle empty line case (decrease indentation or break list)
            // Decrease indentation level and update line
            try {
                current.decreaseIndentationLevel()
                this.updateMarkerFromContext(parsedList, currentLine.number, current)
                
                // Fix following line if needed (after current is updated)
                this.fixFollowingLineAfterIndentDecrease(parsedList, currentLine.number, current)
                
                current.content = '' // Remove the content
            } catch {
                // Can't decrease further, break list by clearing the line (content already cleared above)
                const changes: ChangeSpec[] = [{
                    from: currentLine.from,
                    to: currentLine.to,
                    insert: ''
                }]
                this.applyChanges(view, changes, currentLine)
                return true
            }

            // Update the current line and reorder subsequent lines
            this.updateLineAndReorder(view, currentLine, current, parsedList)
        }

        return true
    }

    // MARK: Context and Parent Extraction

    /**
     * Finds the context (previous item at same indentation level) for a line in a parsed list.
     * Used to determine the next marker in a sequence (e.g., if previous was 'b', next should be 'c').
     */
    private findContextInList(
        parsedList: [number, ParsedListLine][],
        targetLineNumber: number,
        targetIndentationLevel: number
    ): ParsedListLine | null {
        // Look backwards through the list for the most recent item at the same indentation level
        for (let i = parsedList.length - 1; i >= 0; i--) {
            const [lineNumber, parsedLine] = parsedList[i]
            
            // Skip the target line itself and any lines after it
            if (lineNumber >= targetLineNumber)
                continue

            const currentIndentationLevel = parsedLine.getIndentationLevel()

            // Check if this line is at the same indentation level
            if (currentIndentationLevel === targetIndentationLevel)
                return parsedLine
            // A line with lower indentation breaks context
            if (currentIndentationLevel < targetIndentationLevel)
                return null
        }
        
        return null // No context found at this level
    }

    /**
     * Finds the parent (item at one level less indentation) for a line in a parsed list.
     * Used to determine the list type and separator when starting a new nested level.
     */
    private findParentInList(
        parsedList: [number, ParsedListLine][],
        targetLineNumber: number,
        targetIndentationLevel: number
    ): ParsedListLine | null {
        const parentIndentationLevel = targetIndentationLevel - 1
        
        // Can't have a parent if we're already at the top level
        if (parentIndentationLevel < 0)
            return null
        
        // Look backwards through the list for the most recent item at the parent level
        for (let i = parsedList.length - 1; i >= 0; i--) {
            const [lineNumber, parsedLine] = parsedList[i]
            
            // Skip the target line itself and any lines after it
            if (lineNumber >= targetLineNumber)
                continue
            
            // Check if this line is at the parent indentation level
            if (parsedLine.getIndentationLevel() === parentIndentationLevel)
                return parsedLine
        }
        
        return null // No parent found
    }

    /**
     * Fixes the following line after we decrease indentation.
     * If the next line has the same indentation as our original level, it should become a first marker.
     */
    private fixFollowingLineAfterIndentDecrease(
        parsedList: [number, ParsedListLine][],
        modifiedLineNumber: number,
        parentLine: ParsedListLine
    ): void {
        // Find the next line in the parsed list
        const nextLineEntry = parsedList.find(([lineNumber]) => lineNumber === modifiedLineNumber + 1)
        if (!nextLineEntry) return
        
        const [, nextLine] = nextLineEntry
        const nextLineLevel = nextLine.getIndentationLevel()
        
        // If the next line has the same indentation as our original level had,
        // it should become a first marker since we broke the context
        if (nextLineLevel === parentLine.getIndentationLevel() + 1) {
            // Inherit separator from the parent (our modified line)
            nextLine.separator = parentLine.separator
            nextLine.asFirstMarker(this.settings.enableJuraOrdering)
        }
    }

    private updateMarkerFromContext(
        parsedList: [number, ParsedListLine][],
        lineNumber: number,
        current: ParsedListLine
    ) {
        // Find context and parent for the current indentation level
        const targetIndentationLevel = current.getIndentationLevel()
        const context = this.findContextInList(parsedList, lineNumber, targetIndentationLevel)
        const parent = this.findParentInList(parsedList, lineNumber, targetIndentationLevel)

        // Update the marker based on context or parent
        if (context) {
            // Continue existing sequence at this level
            current.correctNextMarker(context, this.settings)
        } else if (parent) {
            // Start new nested level - use first marker
            current.separator = parent.separator // Inherit separator from parent
            current.asFirstMarker(this.settings.enableJuraOrdering) // Overwrites separator if needed
        } else {
            // No context or parent found
            throw new Error('No context or parent found to determine marker')
        }
    }

    // MARK: Update and Reordering

    // TODO: LATER PERFORMANCE We can optimize this
    // TAB: Only update items at the new and previous indentation levels (respecting context breaks)
    // ENTER: Only update items at the current indentation level (respecting context breaks)
    
    /**
     * Updates the current line and reorders subsequent lines.
     * Used for Tab key operations where we modify an existing line.
     */
    private updateLineAndReorder(
        view: EditorView,
        currentLine: Line,
        updatedCurrentLine: ParsedListLine,
        parsedList: [number, ParsedListLine][]
    ): void {
        const changes: ChangeSpec[] = []
        
        // Add the current line update
        changes.push({
            from: currentLine.from,
            to: currentLine.to,
            insert: updatedCurrentLine.getLineText()
        })

        // Reorder subsequent lines
        this.collectReorderChanges(
            view,
            changes,
            parsedList,
            currentLine.number,
            updatedCurrentLine
        )

        // Apply all changes and preserve cursor
        this.applyChanges(view, changes, currentLine)
    }

    /**
     * Inserts a new line after the current line and reorders subsequent lines.
     * Used for Enter key operations where we create a new line.
     */
    private insertLineAndReorder(
        view: EditorView,
        currentLine: Line,
        newLine: ParsedListLine,
        parsedList: [number, ParsedListLine][]
    ): void {
        const changes: ChangeSpec[] = []
        
        // Split at cursor position and insert new line with next marker
        const cursor = view.state.selection.main.head
        changes.push({
            from: cursor,
            to: cursor,
            insert: '\n' + newLine.getLineText()
        })

        // Reorder subsequent lines (they will be shifted by +1 due to insertion)
        this.collectReorderChanges(
            view,
            changes,
            parsedList,
            currentLine.number,
            newLine
        )

        // Apply all changes and position cursor after the marker on new line
        this.applyChanges(view, changes, currentLine)
    }

    /**
     * Collects reordering changes for lines after a modification point.
     */
    private collectReorderChanges(
        view: EditorView,
        changes: ChangeSpec[],
        parsedList: [number, ParsedListLine][],
        modifiedLineNumber: number,
        modifiedLine: ParsedListLine
    ): void {
        const contextStack: ParsedListLine[] = []

        // Process all lines in the parsed list
        for (const [originalLineNumber, parsedLine] of parsedList) {
            let lineToProcess = parsedLine
            
            // SPECIAL CASE: if this is the modified line, use updated data
            if (originalLineNumber === modifiedLineNumber)
                lineToProcess = modifiedLine
            
            const indentationLevel = lineToProcess.getIndentationLevel()
            
            // Pop contexts until we're at (or below) target level
            while (contextStack.length - 1 > indentationLevel) {
                contextStack.pop()
            }
            
            // For lines after the modified line, correct the marker if needed
            if (originalLineNumber > modifiedLineNumber) {
                const context = contextStack[indentationLevel]
                
                if (context) {
                    // Continue sequence from context
                    try {
                        lineToProcess.correctNextMarker(context, this.settings)
                    } catch {
                        // Ignore?
                    }
                }

                // Check if this line needs updating
                if (originalLineNumber <= view.state.doc.lines) {
                    // For insertions, we should check what's currently at the ORIGINAL position
                    // because that's what will be moved to the new position
                    const currentLine = view.state.doc.line(originalLineNumber)
                    const correctedText = lineToProcess.getLineText()

                    // We should update if the corrected text differs from what's currently at the original position
                    if (currentLine.text !== correctedText) {
                        changes.push({
                            from: currentLine.from,
                            to: currentLine.to,
                            insert: correctedText
                        })
                    }
                }
            }
            
            // Update context stack with current line
            if (contextStack.length === indentationLevel) {
                contextStack.push(lineToProcess)
            } else {
                contextStack[indentationLevel] = lineToProcess
            }
        }
    }

    /**
     * Applies changes and preserves cursor position for line updates.
     */
    private applyChanges(
        view: EditorView,
        changes: ChangeSpec[],
        currentLine: Line
    ): void {
        if (changes.length === 0) return

        // Preserve the cursor position after the transaction by maintaining
        // its relative distance from the end of the current line
        const cursor = view.state.selection.main.head
        const distanceToEnd = currentLine.to - cursor
        
        // Map the original line end position to its new location after changes
        // The '1' parameter means "prefer the position after insertions" aka end of the line
        const transaction = view.state.update({ changes })
        const mappedLineTo = transaction.changes.mapPos(currentLine.to, 1)
        
        // Restore cursor to the same relative position from the (new) line end
        const anchor = mappedLineTo - distanceToEnd

        view.dispatch(view.state.update({ changes, selection: { anchor } }))
    }
}
