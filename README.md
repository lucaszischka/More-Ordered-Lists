# More Ordered Lists

An Obsidian plugin that extends ordered list support beyond standard numbers (1., 2., 3.) to include alphabetical, Roman, and nested alphabetical lists with intelligent auto-continuation and formatting.

## Features

### Supported List Types
- **Alphabetical**: A., B., C. ... Z. (uppercase) and a., b., c. ... z. (lowercase)
- **Roman Numerals**: I., II., III., IV., V. (uppercase) and i., ii., iii., iv., v. (lowercase)
- **Nested Alphabetical**: Two modes available:
  - **Bijective (AA, AB, AC)**: Mathematical base-26 progression - AA., AB., AC. ... AZ., BA., BB. ... ZZ., AAA.
  - **Repeated (AA, BB, CC)**: Letter repetition - AA., BB., CC. ... ZZ., AAA., BBB.
- **Parentheses Format**: All list types support parentheses: 1), A), a), I), i), AA), aa)
- **Double Parentheses**: (1), (A), (a), (I), (i), (AA), (aa)

### Smart Behavior
- **Auto-continuation**: Press Enter to automatically continue lists with the next marker
- **Tab Indentation**: Use Tab/Shift+Tab to increase/decrease list indentation levels
- **Intelligent Parsing**: Validates proper Roman numerals and handles case consistency
- **Context Awareness**: Maintains list formatting and numbering within nested structures

## Settings

Configure the plugin in Settings → Community plugins → More Ordered Lists:

- **Alphabetical Lists**: Enable/disable A., B., C. style lists
- **Roman Numerals**: Enable/disable I., II., III. style lists  
- **Nested Alphabetical Mode**: Choose from three options:
  - **Disabled**: No nested alphabetical lists
  - **Bijective (AA, AB, AC)**: Mathematical base-26 progression after Z
  - **Repeated (AA, BB, CC)**: Letter repetition after Z
- **Case Style**: Choose between uppercase, lowercase, both, or disabled
- **Parentheses**: Enable/disable parentheses format (A) vs A.)
- **Jura Ordering**: Enable specialized german legal document ordering

## Examples

```
A. First alphabetical item
  I) First Roman numeral item
  II) Second Roman numeral item
  III) Third Roman numeral item
    (1) Double parentheses format
B. Second alphabetical item
C. Third alphabetical item
```

## Technical Implementation

The plugin uses CodeMirror 6 extensions to:
- Parse and validate list markers in real-time
- Provide visual decorations for proper list formatting
- Handle keyboard shortcuts (Enter, Tab, Shift+Tab) for list continuation
- Maintain consistent numbering and formatting across list levels

All list types support proper mathematical progression:
- Alphabetical: A-Z (26 values), then continues with nested alphabetical
- Roman: Supports I-MMMCMXCIX (1-3999) with proper validation
- Nested Alphabetical: Two modes available:
  - Bijective: AA, AB, AC... (base-26 continuation)
  - Repeated: AA, BB, CC... (letter repetition)

See [DEVELOPMENT.md](DEVELOPMENT.md) for development setup and implementation details.

## License

GNU GPLv3 License - see [LICENSE](LICENSE) file for details.