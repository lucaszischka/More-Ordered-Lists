import type { MarkdownPostProcessorContext, App } from 'obsidian'

import type { MoreOrderedListsSettings } from '../settings/types'
import { Parser } from '../parser'
import type { ParsedListLine } from 'src/types'
import { ListType, ListSeparator } from 'src/types'

export class ReadingModePostProcessor {
    private parser: Parser

    constructor(private settings: MoreOrderedListsSettings, private app: App) {
        this.parser = new Parser(settings)
    }

    /**
     * Processes paragraphs in reading mode to convert custom list formats 
     * (alphabetical, Roman, nested) into proper HTML ordered lists
     */
    processLists = async (
        element: HTMLElement,
        context: MarkdownPostProcessorContext
    ): Promise<void> => {
        // Find all paragraphs that might contain custom lists
        const paragraphs = element.querySelectorAll('p')
        
        for (const paragraph of Array.from(paragraphs)) {
            // 1. Extract markdown content for this section
            const sectionInfo = context.getSectionInfo(paragraph)
            
            // 2. Extract only the lines that belong to this specific section
            let sectionLines: string[] = []
            let hasSectionInfo = false
            if (sectionInfo) {
                const allLines = sectionInfo.text.split('\n')
                sectionLines = allLines.slice(sectionInfo.lineStart, sectionInfo.lineEnd + 1)
                hasSectionInfo = true
            } else {
                // Fallback: reconstruct indentation from file content
                sectionLines = await this.reconstructIndentationFromFile(paragraph, context)
                hasSectionInfo = false
            }
            
            // 3. Parse only these section lines
            const parsedLines = this.parser.parseLines(sectionLines)
            if (!parsedLines || parsedLines.length === 0)
                continue
                        
            // 4. Generate HTML and replace paragraph
            const listHTML = this.generateNestedHtml(parsedLines, hasSectionInfo)
            const parentContainer = paragraph.parentNode
            if (parentContainer && parentContainer instanceof Element && parentContainer.classList.contains('el-p')) {
                parentContainer.className = 'el-ol'
                parentContainer.innerHTML = listHTML
            } else {
                // Fallback: just replace paragraph content
                paragraph.innerHTML = listHTML
            }
        }
    }

    private generateNestedHtml(listLines: ParsedListLine[], hasSectionInfo: boolean): string {
        let html = this.createListTag(listLines[0])
        let currentIndentLevel = 0
        
        listLines.forEach((parsed, index) => {
            const indentLevel = parsed.getIndentationLevel()
            const nextItem = listLines[index + 1]
            
            // Handle indentation changes
            html += this.handleIndentationChange(currentIndentLevel, indentLevel, parsed)
            
            // Add the list item
            html += this.createListItem(parsed, index, nextItem, hasSectionInfo)
            
            currentIndentLevel = indentLevel
        })
        
        // Close remaining nested lists and the final list item and root list
        html += this.closeRemainingLists(currentIndentLevel)
        
        return html
    }

    private createListTag(parsed: ParsedListLine): string {
        const styleType = this.getListStyleType(parsed)
        const cssClass = this.isCustomSeparator(parsed) ? ' class="custom-separator"' : ''
        return `<ol style="list-style-type: ${styleType}"${cssClass}>`
    }

    private handleIndentationChange(
        currentLevel: number,
        newLevel: number,
        parsed: ParsedListLine
    ): string {
        if (newLevel > currentLevel) {
            // Opening new nested level - don't close the current <li> yet
            return this.createListTag(parsed)
        } else if (newLevel < currentLevel) {
            // Closing nested levels - need to close </li></ol> pairs
            const levelsToClose = currentLevel - newLevel
            return '</li>' + '</ol></li>'.repeat(levelsToClose)
        }
        return ''
    }

    private createListItem(
        parsed: ParsedListLine,
        index: number,
        nextItem?: ParsedListLine,
        hasSectionInfo = true
    ): string {
        const hasChildren = nextItem && nextItem.indentation.length > parsed.indentation.length
        const dataAttributes = this.createDataAttributes(parsed)
        const content = parsed.content.trim()
        
        if (hasChildren) {
            // Only add collapse icon when we have section info
            const collapseIcon = hasSectionInfo ? this.createCollapseIcon() : ''
            return `<li data-line="${index}" dir="auto" class=""${dataAttributes}>${collapseIcon}${content}`
        } else {
            return `<li data-line="${index}" dir="auto"${dataAttributes}>${content}</li>`
        }
    }

    private createDataAttributes(parsed: ParsedListLine): string {
        return this.isCustomSeparator(parsed) 
            ? ` data-marker="${parsed.marker}" data-separator="${parsed.separator}"` 
            : ''
    }

    private createCollapseIcon(): string {
        const iconAttrs = 'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
        return `<span class="list-collapse-indicator collapse-indicator collapse-icon"><svg ${iconAttrs} class="svg-icon right-triangle"><path d="M3 8L12 17L21 8"></path></svg></span>`
    }

    private closeRemainingLists(currentIndentLevel: number): string {
        // Close the final list item and then all remaining nested levels plus the root list
        return '</li>' + '</ol></li>'.repeat(currentIndentLevel) + '</ol>'
    }

    private isCustomSeparator(parsed: ParsedListLine): boolean {
        return parsed.separator !== ListSeparator.Dot
    }

    private getListStyleType(parsed: ParsedListLine): string {
        // For non-dot separators, we need custom styling
        if (this.isCustomSeparator(parsed))
            return 'none'
        
        switch (parsed.type) {
            case ListType.Alphabetical:
            case ListType.NestedAlphabetical:
                return parsed.getCaseStyle() === 'upper' ? 'upper-alpha' : 'lower-alpha'
            case ListType.Roman:
                return parsed.getCaseStyle() === 'upper' ? 'upper-roman' : 'lower-roman'
            case ListType.Numbered:
                return 'decimal'
        }
    }

    /**
     * Reconstructs indentation by reading the actual file content when getSectionInfo fails.
     * This is the straightforward solution using Obsidian's proper API.
     */
    private async reconstructIndentationFromFile(
        paragraph: HTMLElement,
        context: MarkdownPostProcessorContext
    ): Promise<string[]> {
        try {
            // Get the source path from context
            const sourcePath = context.sourcePath
            if (!sourcePath) {
                console.debug('More Ordered Lists: No source path available')
                return this.fallbackToBasicParsing(paragraph)
            }

            // Get the file from the vault using the proper API
            const file = this.app.vault.getFileByPath(sourcePath)
            if (!file) {
                console.debug('More Ordered Lists: Could not find file:', sourcePath)
                return this.fallbackToBasicParsing(paragraph)
            }

            // Read the file content using the proper async API
            const fileContent = await this.app.vault.cachedRead(file)
            
            // Match paragraph content to file content to find the original lines with indentation
            return this.matchParagraphToFileContent(paragraph, fileContent)

        } catch (error) {
            console.warn('More Ordered Lists: Error reading file for indentation reconstruction:', error)
            return this.fallbackToBasicParsing(paragraph)
        }
    }

    /**
     * Matches paragraph content to file content to preserve original indentation
     */
    private matchParagraphToFileContent(paragraph: HTMLElement, fileContent: string): string[] {
        const paragraphText = paragraph.innerText.trim()
        const paragraphLines = paragraphText.split('\n').map(line => line.trim())
        const fileLines = fileContent.split('\n')

        // Find the first line of the paragraph in the file
        const firstParagraphLine = paragraphLines[0]
        if (!firstParagraphLine) {
            return this.fallbackToBasicParsing(paragraph)
        }

        // Search for the matching content in the file
        for (let i = 0; i < fileLines.length; i++) {
            const fileLine = fileLines[i]
            const trimmedFileLine = fileLine.trim()

            // Check if this line matches our first paragraph line
            if (trimmedFileLine === firstParagraphLine) {
                // Found potential match, collect the consecutive matching lines
                const matchedLines: string[] = []
                
                for (let j = 0; j < paragraphLines.length && (i + j) < fileLines.length; j++) {
                    const paraLine = paragraphLines[j]
                    const fileLineAtIndex = fileLines[i + j]
                    
                    if (fileLineAtIndex.trim() === paraLine) {
                        // This line matches - use the original with indentation preserved
                        matchedLines.push(fileLineAtIndex)
                    } else {
                        // Lines don't match, this might not be the right section
                        break
                    }
                }

                // If we matched all paragraph lines, we found the right section
                if (matchedLines.length === paragraphLines.length) {
                    console.debug('More Ordered Lists: Successfully reconstructed indentation for', 
                                 matchedLines.length, 'lines')
                    return matchedLines
                }
            }
        }

        // If we couldn't find a match, fallback
        console.debug('More Ordered Lists: Could not match paragraph content to file, using fallback')
        return this.fallbackToBasicParsing(paragraph)
    }

    /**
     * Final fallback - parse paragraph content without indentation but still try to make lists work
     */
    private fallbackToBasicParsing(paragraph: HTMLElement): string[] {
        const lines = paragraph.innerText.split('\n')
        console.debug('More Ordered Lists: Using basic parsing fallback for', lines.length, 'lines')
        return lines
    }
}
