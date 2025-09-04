# Changelog

All notable changes to the More Ordered Lists plugin will be documented in this file.

## [0.1.0] - 2025-09-04

### Added
- **Unordered List Support**: Added support for parsing and handling unordered lists (*, -, +) when nested under ordered lists
- **Unordered List Tests**: Added test cases for unordered lists

### Changed
- **Parser Architecture Redesign**: Major rewrite of the parser to handle multiple lists per document section and improve robustness
  - Parser now only parses and validates, no longer modifies markers during parsing
  - Improved context tracking with stack-based approach for better nested list handling
  - Enhanced validation prevents invalid indentation jumps and circular dependencies
  - Better separation of concerns between parsing and marker correction
- **Key Handler Improvements**: Completele rewrite of key handlers to work with the new parser
  - Tab and Enter key handlers now manage marker correction and reordering themselfs
- **Security Improvements**: Replaced unsafe `innerHTML` usage with proper DOM element creation
  - SettingsTab now uses safe DOM manipulation methods
  - PostProcessor creates DOM elements programmatically instead of using innerHTML

### Fixed
- **License Correction**: Fixed incorrect license description in package.json (changed from MIT to GPL-3.0)
- **Parser Robustness**: Fixed various edge cases in list parsing and marker validation
- **Context Resolution**: Improved context finding algorithm to prevent circular dependencies
- **Indentation Handling**: Better validation and management of indentation level changes

### Technical
- Enhanced type safety with improved TypeScript interfaces
- Better error handling and validation throughout the codebase
- Improved code documentation and inline comments
- Added mobile compatibility notes for Tab key limitations

## [0.0.1] - 2025-08-19

**Initial release** of the More Ordered Lists plugin