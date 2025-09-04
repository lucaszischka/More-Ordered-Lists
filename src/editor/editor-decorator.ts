import type { DecorationSet, EditorView, ViewUpdate } from '@codemirror/view'
import { Decoration } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

import type { Parser } from "../parser"
import { settingsUpdateEffect } from '../settings/types'
import type { ParsedListLine } from "../types"
import { ListType } from "../types"

export class EditorDecorator {
    decorations: DecorationSet = Decoration.none
    
    constructor(
        private view: EditorView,
        private parser: Parser
    ) {
        this.buildDecorations()
    }
    
    update(update: ViewUpdate): void {
        // Check if settings update effect was dispatched
        const hasSettingsUpdate = update.transactions.some(tr => 
            tr.effects.some(effect => effect.is(settingsUpdateEffect))
        )
        
        if (update.docChanged || update.viewportChanged || hasSettingsUpdate)
            this.buildDecorations()
    }
    
    buildDecorations(): void {
        const builder = new RangeSetBuilder<Decoration>()

        // TODO: LATER PERFORMANCE Cache the parsedLists
        const parsedLists = this.parser.parseViewport(this.view);
        for (const parsedList of parsedLists) {
            for (const [key, result] of parsedList) {
                const lineFrom = this.view.state.doc.line(key).from
                this.applyListDecorations(builder, lineFrom, result)
            }
        }
        this.decorations = builder.finish()
    }

    private applyListDecorations(
        builder: RangeSetBuilder<Decoration>,
        lineFrom: number,
        result: ParsedListLine
    ): void { 
        // Positions
        const markerStart = lineFrom + result.indentation.length
        const separatorLength = result.type === ListType.Unordered ? 0 : result.separator.length
        const contentStart = markerStart + result.marker.length + separatorLength + 1 // space after marker/separator
        const contentEnd = lineFrom + result.getLineText().length
        // Indentation
        const indentLevel = result.getIndentationLevel()
        const cssLevel = indentLevel + 1 // CSS classes are 1-based
        const baseIndent = 30
        const indentStep = 36 // Obsidian uses 36px per indent level
        const totalIndent = baseIndent + (indentLevel * indentStep)

        
        // IMPORTANT: Apply decorations in order from outermost to innermost
        // 1. Add line-level decoration for HyperMD-list-line classes and styling
        builder.add(
            lineFrom,
            lineFrom,
            Decoration.line({
                class: `HyperMD-list-line HyperMD-list-line-${cssLevel}`,
                attributes: {
                    style: `text-indent: -${totalIndent}px; padding-inline-start: ${totalIndent}px;`
                }
            })
        )

        // TODO: LATER 2. Handle indentation for nested lists
        // Currently missing, as I'm having issues with implementing it and I don't see a need to do for now (no missing features found).
        // Widgets are not working as they would break at least the obsidian indentation level highlighter.
        // For a successful implementation I would need to:
        // Wrap all exiting `cm-indent` span's (one per level) by a single `cm-hmd-list-indent cm-hmd-list-indent-${indentLevel}` span.
        // The `cm-indent` with conditionally `cm-active-indent` span's are already created and managed by cm/obsidian.
        // KEEP THIS COMMENT
        /*if (indentLevel > 0) {
            builder.add(
                lineFrom,
                markerStart,
                Decoration.mark({
                    class: `cm-hmd-list-indent cm-hmd-list-indent-${indentLevel}`,
                    inclusive: true
                })
            )
        }*/

        // 3. Apply outer formatting mark to exact marker range
        const isUnordered = result.type === ListType.Unordered
        const listFormattingClass = isUnordered ? 'cm-formatting-list-ul' : 'cm-formatting-list-ol'
        builder.add(
            markerStart,
            contentStart,
            Decoration.mark({
                class: `cm-formatting cm-formatting-list ${listFormattingClass} cm-list-${cssLevel}`,
                inclusive: true
            })
        )

        // 4. Apply inner list marker to exact marker range
        const markerClass = isUnordered ? 'list-bullet' : 'list-number'
        builder.add(
            markerStart,
            contentStart,
            Decoration.mark({
                class: markerClass,
                inclusive: false
            })
        )
        
        // 5. Apply content mark to the text content
        if (contentStart < contentEnd)
            builder.add(
                contentStart,
                contentEnd,
                Decoration.mark({
                    class: `cm-list-${cssLevel}`
                })
            )
    }
}