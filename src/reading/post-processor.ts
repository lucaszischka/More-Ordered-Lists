import type { MarkdownPostProcessorContext, App } from 'obsidian'

import type { MoreOrderedListsSettings } from '../settings/types'
import { Parser } from '../parser'
import type { ParsedListLine } from '../types'
import { ListType, ListSeparator } from '../types'

interface ListContext {
    element: HTMLOListElement
    lastItem: HTMLLIElement
}

interface UnorderedListContext {
    element: HTMLUListElement
    lastItem: HTMLLIElement
}

export class ReadingModePostProcessor {
    private parser: Parser

    constructor(settings: MoreOrderedListsSettings, private app: App) {
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
            
            // 3. Parse section lines to get multiple lists with line numbers
            const parsedLines = this.parser.parseLines(sectionLines)
            if (!parsedLines || parsedLines.length === 0)
                continue
                        
            // 4. Generate DOM elements with mixed content and replace paragraph
            const mixedContent = this.createMixedContentStructure(parsedLines, sectionLines, hasSectionInfo)
            if (!mixedContent) continue
            
            const parentContainer = paragraph.parentNode
            if (parentContainer && parentContainer instanceof Element && parentContainer.classList.contains('el-p')) {
                // Replace the parent container with our mixed content
                this.replaceElementWithMixedContent(parentContainer, mixedContent)
            } else {
                // Fallback: just replace paragraph content
                this.replaceElementWithMixedContent(paragraph, mixedContent)
            }
        }
    }

    private createMixedContentStructure(
        parsedLines: [number, ParsedListLine][][], 
        sectionLines: string[], 
        hasSectionInfo: boolean
    ): HTMLElement[] | null {
        const result: HTMLElement[] = []
        let currentLineIndex = 0

        for (const listLine of parsedLines) {
            if (listLine.length === 0) continue

            // Get the start and end line numbers for this list (1-based from parser)
            const listStartIndex = listLine[0][0] - 1
            const listEndIndex = listLine[listLine.length - 1][0] - 1

            // Add any non-list content before this list
            if (listStartIndex > currentLineIndex) {
                const nonListLines = sectionLines.slice(currentLineIndex, listStartIndex)
                const paragraphElement = this.createParagraphElement(nonListLines)
                result.push(paragraphElement)
            }

            // Extract just the ParsedListLine objects for creating the list
            const listLines = listLine.map(([, parsed]) => parsed)
            
            // Add the list
            const listElement = this.createNestedListStructure(listLines, hasSectionInfo)
            if (listElement) {
                const listContainer = this.createListContainer(listElement)
                result.push(listContainer)
            }

            // Update current line index to after this list
            currentLineIndex = listEndIndex + 1
        }

        // Add any remaining non-list content after the last list
        if (currentLineIndex < sectionLines.length) {
            const remainingLines = sectionLines.slice(currentLineIndex)
            const paragraphElement = this.createParagraphElement(remainingLines)
            result.push(paragraphElement)
        }

        return result.length > 0 ? result : null
    }

    private createParagraphElement(lines: string[]): HTMLElement {
        const container = document.createElement('div')
        container.className = 'el-p'
        
        const paragraph = document.createElement('p')
        paragraph.setAttribute('dir', 'auto')
        
        // Join lines with <br> elements
        lines.forEach((line, index) => {
            paragraph.appendChild(document.createTextNode(line))
            if (index < lines.length - 1)
                paragraph.appendChild(document.createElement('br'))
        })
        
        container.appendChild(paragraph)
        return container
    }

    private createListContainer(listElement: HTMLOListElement | HTMLUListElement): HTMLElement {
        const container = document.createElement('div')
        container.className = listElement instanceof HTMLUListElement ? 'el-ul' : 'el-ol'
        container.appendChild(listElement)
        return container
    }

    private replaceElementWithMixedContent(element: Element, mixedContent: HTMLElement[]): void {
        // Clear existing content
        while (element.firstChild)
            element.removeChild(element.firstChild)
        
        // Create fragment for batched DOM operations
        const fragment = document.createDocumentFragment()
        for (const contentElement of mixedContent)
            fragment.appendChild(contentElement)
        
        // Add all content in one operation for better performance
        element.appendChild(fragment)
    }

    private createNestedListStructure(listLines: ParsedListLine[], hasSectionInfo: boolean): HTMLOListElement | HTMLUListElement | null {
        // Each ListContext represents one level of list nesting
        // The index is therefore equal to the indentation level
        // The lastItem is needed for appending new nested lists
        const contextStack: (ListContext | UnorderedListContext)[] = []
        
        listLines.forEach((parsed, index) => {
            const targetLevel = parsed.getIndentationLevel()
            // Validate that the indentation increase is valid (only one level at a time)
            if (contextStack.length < targetLevel)
                throw new Error(`More Ordered Lists: Invalid indentation jump - trying to access level ${targetLevel} but only ${contextStack.length} levels exist. Parser should only increment by one level at a time.`)

            // 1. Pop contexts until we're at (or below) target level
            while (contextStack.length - 1 > targetLevel) {
                contextStack.pop()
            }
            
            // 2. Create new list if we need to increase indentation
            if (contextStack.length === targetLevel) {
                // Need to create a new list at this level
                const newList = this.createListElement(parsed)

                // Attach to parent's last item if we're nested
                const parentContext = contextStack.last()
                if (parentContext)
                    parentContext.lastItem.appendChild(newList)
                
                // Create and add the actual list item
                const nextItem = listLines[index + 1]
                const listItem = this.createListItemElement(parsed, index, nextItem, hasSectionInfo)
                newList.appendChild(listItem)
                
                if (parsed.type === ListType.Unordered) {
                    contextStack.push({ element: newList as HTMLUListElement, lastItem: listItem })
                } else {
                    contextStack.push({ element: newList as HTMLOListElement, lastItem: listItem })
                }
            } else {
                // Use existing list at this level - just add a new item
                const targetContext = contextStack[targetLevel]
                // This should never happen
                if (!targetContext)
                    throw new Error(`More Ordered Lists: Invalid state - no context found for indentation level ${targetLevel}. This suggests a parser error or unexpected indentation pattern.`)
                
                const nextItem = listLines[index + 1]
                const listItem = this.createListItemElement(parsed, index, nextItem, hasSectionInfo)
                targetContext.element.appendChild(listItem)
                // Update the lastItem reference for this level
                contextStack[targetLevel].lastItem = listItem
            }
        })
        
        // Return the root list element directly
        const rootList = contextStack.first()
        return rootList ? rootList.element : null
    }

    private createListElement(parsed: ParsedListLine): HTMLOListElement | HTMLUListElement {
        if (parsed.type === ListType.Unordered) {
            const ul = document.createElement('ul')
            ul.classList.add('has-list-bullet')
            return ul
        } else {
            const ol = document.createElement('ol')
            
            // Apply list-style-type
            const styleType = this.getListStyleType(parsed)
            ol.style.listStyleType = styleType
            
            // Apply custom separator class
            if (this.isCustomSeparator(parsed))
                ol.classList.add('custom-separator')
            
            return ol
        }
    }

    private createListItemElement(
        parsed: ParsedListLine, 
        index: number, 
        nextItem?: ParsedListLine, 
        hasSectionInfo = true
    ): HTMLLIElement {
        const li = document.createElement('li')
        
        // Set core attributes
        li.setAttribute('data-line', index.toString())
        li.setAttribute('dir', 'auto')
        
        // Add custom separator data attributes
        if (this.isCustomSeparator(parsed)) {
            li.setAttribute('data-marker', parsed.marker)
            li.setAttribute('data-separator', parsed.separator)
        }
        
        // Handle collapse icon for parent items
        const hasChildren = nextItem && nextItem.indentation.length > parsed.indentation.length
        if (hasChildren && hasSectionInfo) {
            const collapseIcon = this.createCollapseIconElement()
            li.appendChild(collapseIcon)
        }
        
        // Handle unordered list bullet
        if (parsed.type === ListType.Unordered) {
            const bulletSpan = document.createElement('span')
            bulletSpan.className = 'list-bullet'
            bulletSpan.textContent = parsed.marker
            li.appendChild(bulletSpan)
        }
        
        // Add content (as text node)
        li.appendChild(document.createTextNode(parsed.content))
        
        return li
    }

    private createCollapseIconElement(): HTMLElement {
        const span = document.createElement('span')
        span.className = 'list-collapse-indicator collapse-indicator collapse-icon'
        
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
        svg.setAttribute('width', '24')
        svg.setAttribute('height', '24')
        svg.setAttribute('viewBox', '0 0 24 24')
        svg.setAttribute('fill', 'none')
        svg.setAttribute('stroke', 'currentColor')
        svg.setAttribute('stroke-width', '2')
        svg.setAttribute('stroke-linecap', 'round')
        svg.setAttribute('stroke-linejoin', 'round')
        svg.classList.add('svg-icon', 'right-triangle')
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.setAttribute('d', 'M3 8L12 17L21 8')
        svg.appendChild(path)
        
        span.appendChild(svg)
        return span
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
            case ListType.Unordered:
                return 'none' // We use custom bullet styling
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
        if (!firstParagraphLine)
            return this.fallbackToBasicParsing(paragraph)

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
