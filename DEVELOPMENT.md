# Development Guide

## Quick Start

### Prerequisites
- Node.js v16+ (`node --version`)
- npm or yarn package manager
- Optional: ESLint (`npm install -g eslint`)

### Setup
```bash
npm install         # Install dependencies
npm run dev         # Start development with watch mode, or
npm run build       # Build for production
```

### Development Commands
- `npm run dev` - Development with watch mode compilation
- `npm run build` - Production build
- `npm run test` - Run all tests
- `npm run test:watch` - Continuous testing during development
- `npm run test:coverage` - Generate test coverage report
- `npm run lint` - Code quality checks with ESLint
- `npm run lint:fix` - Auto-fix linting issues
- `npm run type-check` - TypeScript type checking

## API References

- [CodeMirror 6 Documentation](https://codemirror.net/docs/)
- [Obsidian API](https://github.com/obsidianmd/obsidian-api)  
- [Obsidian CSS Variables](https://docs.obsidian.md/Reference/CSS+variables/Editor/List)

### Code Standards
- TypeScript strict mode enabled
- ESLint configuration enforced
- Jest tests for new parsing logic
- Documentation updates for user-facing changes

## Architecture Overview

The plugin extends Obsidian's list functionality using CodeMirror 6 extensions:

### Core Components

#### 1. Parser (`src/parser.ts`)
- **List Detection**: Identifies and validates list markers (A., I., AA., *, -, +, etc.)
- **Context Analysis**: Maintains list context across indentation levels with stack-based tracking
- **Roman Validation**: Proper Roman numeral validation (I-MMMCMXCIX)
- **Value Calculation**: Converts markers to numerical values for sequencing
- **Multi-list Support**: Handles multiple separate lists within a single document section
- **Robust Validation**: Prevents invalid indentation jumps and circular dependencies

#### 2. KeyHandler (`src/editor/key-handler.ts`)  
- **Enter Key**: Auto-continues lists with next sequential marker
- **Tab/Shift+Tab**: Manages indentation and marker updates
- **List Termination**: Handles empty list items and list breaking
- **Reordering Logic**: Efficiently updates subsequent list items after changes

#### 3. EditorDecorator (`src/editor/editor-decorator.ts`)
- **Visual Rendering**: Applies CodeMirror decorations for list styling
- **Real-time Updates**: Responds to document changes and settings updates
- **Viewport Management**: Efficiently processes only visible content

#### 4. Settings Management (`src/settings/`)
- **Configuration**: Manages enabled list types and formatting options
- **Persistence**: Handles settings storage and retrieval
- **Live Updates**: Propagates settings changes to active editors

#### 5. Reading Mode Post-Processor (`src/reading/post-processor.ts`)
- **HTML Generation**: Converts custom list formats to proper HTML `<ol>` and `<ul>` elements in reading mode
- **Section-based Processing**: Processes only the lines belonging to each specific section to avoid duplication
- **Nested List Support**: Handles complex nested structures with proper indentation
- **Custom Separator Handling**: Manages non-dot separators (parentheses, etc.) with custom styling
- **Collapse Indicators**: Adds collapsible UI elements for nested lists
- **Mixed Content**: Handles documents with both list and non-list content seamlessly

#### 6. Styling (`styles.css`)
- **Custom Separator Styling**: Provides CSS for lists with non-dot separators
- **Data Attribute Selectors**: Uses `data-marker` and `data-separator` attributes for precise styling
- **Collapse Indicator Styling**: Styles for expandable/collapsible nested list items
- **Integration**: Works with Obsidian's existing list styling while extending functionality

### List Types Implementation

#### Alphabetical Lists (A., B., C.)
- Single letters A-Z (values 1-26)
- Case-sensitive (A. vs a.)
- Automatic progression through alphabet

#### Roman Numerals (I., II., III.)
- Validates proper Roman numeral formation
- Supports 1-3999 (I-MMMCMXCIX)
- Handles both uppercase and lowercase

#### Nested Alphabetical (AA., BB., CC. or AA., AB., AC.)
- Two modes: Bijective (base-26) and Repeated (letter repetition)
- Bijective: Mathematical progression: AA=27, AB=28, AC=29, etc.
- Repeated: Letter repetition: AA=27, BB=28, CC=29, etc.
- Supports unlimited nesting depth

#### Number Lists (1., 2., 3.)
- Only processed when not handled natively by Obsidian
- Process when in parentheses format (1)
- Process when part of mixed list context

#### Unordered Lists (*, -, +)
- Only processed when nested under ordered lists
- Top-level unordered lists are handled by Obsidian natively
- Supports all three standard bullet markers (*, -, +)
- Maintains marker consistency within the same level

### Ambiguity Resolution

There are many ambiguous markers (`i.` `ii.`, `c.`) that could be interpreted as either alphabetical or Roman numerals.
The parser uses context-based resolution:
- If we have context (marker with the same indentation level above), it should be used as the primary type hint
- Without context, the parser prefers valid Roman markers over alphabetical ones

### Event Flow

#### Editor Mode
1. **User Input** → KeyHandler processes Enter/Tab
2. **Document Change** → Parser analyzes affected lines  
3. **List Detection** → Validates markers and calculates values
4. **Context Building** → Establishes list hierarchy and relationships
5. **Marker Update** → Generates correct sequential markers
6. **Decoration** → EditorDecorator applies visual styling
7. **Document Update** → Changes committed to CodeMirror state

#### Reading Mode
1. **Document Render** → Obsidian post-processor system activates
2. **Section Extraction** → Post-processor receives specific line ranges for each paragraph
3. **Line Parsing** → Parser validates and structures the section's list content
4. **HTML Generation** → Converts parsed list structure to nested `<ol>` elements
5. **DOM Replacement** → Replaces paragraph content with generated list HTML
6. **CSS Styling** → Custom styles applied based on separator types and nesting

## Project Goals

Obsidian styles and autocompletes numbered lists. This plugins should implement this behaviour for alpherbetical, nested alphabetical and roman lists.
It will need a CodeMirror Extension for reacting to events and handeling changes in Editor Mode. For the Reading Mode styling an Obsidian MarkdownPostProcessor should be used.

### Frontent

This is the Frontent of Obsidian that we are trying to replicate:

#### Editor Mode

From 0 to 2 indentaions:
```html
<div class="HyperMD-list-line HyperMD-list-line-1 cm-line" dir="ltr" style="text-indent: -30px; padding-inline-start: 30px;">
    <span class="cm-formatting cm-formatting-list cm-formatting-list-ol cm-list-1">
        <span class="list-number">1. </span>
    </span>
    <span class="cm-list-1">test</span>
</div>

<div class="HyperMD-list-line HyperMD-list-line-2 cm-line" dir="ltr" style="text-indent: -66px; padding-inline-start: 66px;">
    <span class="cm-hmd-list-indent cm-hmd-list-indent-1">
    <span class="cm-indent">	</span>
    </span>
    <div class="cm-fold-indicator" contenteditable="false">
        ​<div class="collapse-indicator collapse-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon right-triangle"><path d="M3 8L12 17L21 8"></path></svg>
        </div>
    </div>
    <img class="cm-widgetBuffer" aria-hidden="true">
    <span class="cm-formatting cm-formatting-list cm-formatting-list-ol cm-list-2">
        <span class="list-number">1. </span>
    </span>
    <span class="cm-list-2">test</span>
</div>

<div class="HyperMD-list-line HyperMD-list-line-3 cm-line" dir="ltr" style="text-indent: -102px; padding-inline-start: 102px;">
    <span class="cm-hmd-list-indent cm-hmd-list-indent-2">
        <span class="cm-indent">	</span>
        <span class="cm-indent">	</span>
    </span>
    <span class="cm-formatting cm-formatting-list cm-formatting-list-ol cm-list-3">
        <span class="list-number">1. </span>
    </span>
    <span class="cm-list-3">test</span>
</div>
```

#### Reading Mode

```html
<div class="el-ol"><ol>
    <li data-line="0" dir="auto">test</li> // Displays 1. test
    <li data-line="1" dir="auto">test</li> // Displays 2. test
</ol></div>
```

### Backend

Automatically continue lists when pressing Enter. If the list content is empty remove indentation or if not indented clear the whole line. Reorder the lines below.

Automatically updates marker when pressing Tab (+ Shift). Reorder the lines below.

Examples:
```
a. test
b. test // ENTER
c. // added

a. test
    a. test // ENTER
    b. // added
b. test

a. test
b. test // TAB, becomes a
c. test // becomes b

a. test
    a. test // SHIFT-TAB, becomes b
    b. test // becomes a
b. test // becomes c

a. test
    a. test // TAB
    b. test // becomes a
b. test

a. test
        a. test // SHIFT-TAB
    a. test // becomes b
b. test

a. test
b. test // TAB, becomes a
    a. test // becomes b
c. test // becomes b

```

## Release Process

### Version Management
1. Update `manifest.json` with new version (e.g., `1.0.1`)
2. Set minimum Obsidian version in `minAppVersion` 
3. Update `versions.json` with version compatibility mapping
4. Run `npm version [patch|minor|major]` to sync all version files

### GitHub Release
1. Create release with version number as tag (no `v` prefix)
2. Upload build artifacts: `manifest.json`, `main.js`, `styles.css`
3. Include release notes with feature changes and fixes
4. Publish to make available in Obsidian Community Plugins