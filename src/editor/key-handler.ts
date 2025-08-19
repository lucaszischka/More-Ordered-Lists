import type { EditorView } from '@codemirror/view'
import type { ChangeSpec } from '@codemirror/state'
import { Line } from '@codemirror/state';

import type { MoreOrderedListsSettings } from 'src/settings/types'
import type { Parser } from '../parser'
import { ListType } from '../types'
import type { ParsedListLine } from '../types'

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
        const parsed = this.getCurrentParsedLine(view)
        if (!parsed)
            return false

        const { currentLine, current } = parsed

        // Calculate new indentation
        if (shift) {
            // Decrease by one level
            try {
                current.decreaseIndentationLevel()
            } catch {
                return false
            }
        } else {
            // Increase by one level
            current.increaseIndentationLevel() 
        }
        
        // Update marker - this might be wrong but reorderer will fix it
        // If we don't, we would have ListType inference issues
        current.asFirstMarker(this.settings.enableJuraOrdering)

        this.updateLineAndReorder(view, currentLine, current.getLineText())

        return true
    }

    // MARK: Enter

    enterKey(view: EditorView): boolean {
        const parsed = this.getCurrentParsedLine(view)
        if (!parsed)
            return false

        const { currentLine, current } = parsed
        const cursor = view.state.selection.main.head

        // SPECIAL CASE: Only continue list after z if nested is enabled
        if (current.type === ListType.Alphabetical
            && current.getValue(this.settings.nestedAlphabeticalMode === 'repeated') === 26
            && this.settings.nestedAlphabeticalMode === 'disabled')
            return false


        const hasContent = current.content.trim().length > 0
        current.content = ' ' // Remove the content
        
        // SPECIAL CASE: Only continue list when enter would not break the list
        if (cursor < currentLine.from + current.getLineText().length)
            return false

        if (hasContent) {
            // Create the next line
            const nextLineText = '\n' + current.getLineText()

            // Update line and reorder:
            // 1. Insert the new line (Update)
            const transaction = view.state.update({
                changes: {
                    from: cursor,
                    insert: nextLineText
                },
                selection: {
                    anchor: cursor + nextLineText.length
                }
            })
            view.dispatch(transaction)
            // The document reference (doc) is outdated after the transaction, use view
            
            // 2. Reorder
            const nextLine = view.state.doc.lineAt(cursor + nextLineText.length)
            this.reorder(view, nextLine.number)
        } else {
            // When no content decrease indentation or break the list
            let updatedLineText: string
            try {
                // Keep the line with indentation reduced by one level
                current.decreaseIndentationLevel()
                // Update marker - this might be wrong but reorderer will fix it
                // If we don't, we would have ListType inference issues
                current.asFirstMarker(this.settings.enableJuraOrdering)
                updatedLineText = current.getLineText()
            } catch {
                // If no indentation is left, break the list by removing the marker
                updatedLineText = ''
            }

            this.updateLineAndReorder(view, currentLine, updatedLineText)
        }

        return true
    }

    // MARK: Helpers

    private getCurrentParsedLine(
        view: EditorView
    ): { currentLine: Line, current: ParsedListLine } | null {
        const selection = view.state.selection
        const doc = view.state.doc
        
        // Only handle single cursor and no selection
        if (!selection.main.empty || selection.ranges.length > 1)
            return null

        // Get the parsed current line
        const cursor = selection.main.head
        const currentLine = doc.lineAt(cursor)
        const parsedList = this.parser.parseList(doc, currentLine.number, doc.lines)
        const current = parsedList.find(([lineNumber]) => lineNumber === currentLine.number)
        if (!current)
            return null

        return { currentLine, current: current[1] }
    }

    private updateLineAndReorder(
        view: EditorView,
        line: Line,
        text: string
    ): void {
        const cursor = view.state.selection.main.head
        const transaction = view.state.update({
            changes: {
                from: line.from,
                to: line.to,
                insert: text
            },
            selection: {
                anchor: cursor + text.length - (line.to - line.from)
            }
        })
        view.dispatch(transaction)
        this.reorder(view, line.number)
    }

    // TODO: LATER PERFORMANCE: Reuse the parsedList until currentLineNumber-1
    private reorder(
        view: EditorView,
        fromLineNumber: number
    ) {
        const doc = view.state.doc
        const parsedList = this.parser.parseList(doc, fromLineNumber, doc.lines)
        const changes: ChangeSpec[] = []
        for (const [key, result] of parsedList) {
            // Only update lines starting at fromLineNumber
            if (key < fromLineNumber)
                continue

            const currentLine = doc.line(key)
            const newText = result.getLineText()

            // Don't update if unchanged
            if (currentLine.text === newText)
                continue

            changes.push({
                from: currentLine.from,
                to: currentLine.to,
                insert: newText
            })
        }
        if (changes.length > 0) {
            // Preserve the cursor position after the transaction
            const fromLine = view.state.doc.line(fromLineNumber)
            const cursor = view.state.selection.main.head
            const distanceToEnd = fromLine.to - cursor
            const transaction = view.state.update({ changes })
            const mappedLineTo = transaction.changes.mapPos(fromLine.to, 1)

            const anchor = mappedLineTo - distanceToEnd

            view.dispatch(view.state.update({ changes, selection: { anchor } }))
        }
    }
}
