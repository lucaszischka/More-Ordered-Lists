import { Plugin } from 'obsidian'
import { StateEffect } from '@codemirror/state'


export class MoreOrderedListsSettings {
    // List types
    enableAlphabeticalLists = true // A) or a)
    enableRomanLists = true // I) or i)
    nestedAlphabeticalMode: 'disabled' | 'bijective' | 'repeated' = 'bijective' // Controls nested alphabetical lists: disabled, bijective (aa, ab, ac), or repeated letters (aa, bb, cc)
    // Format options
    caseStyle: 'upper' | 'lower' | 'both' | 'none' = 'both' // Controls cases styles to recognize
    enableParentheses = true // 1); A) or a); I) or i); AA) or aa); can also habe one at the start
    enableJuraOrdering = false // Whether to use Jura ordering for indentation levels: A., I., 1., a), aa), (1), (a), (aa), (i)

    constructor() {}

    hasLowercase(): boolean {
        return this.caseStyle === 'lower' || this.caseStyle === 'both'
    }

    hasUppercase(): boolean {
        return this.caseStyle === 'upper' || this.caseStyle === 'both'
    }
}

export const DEFAULT_SETTINGS = new MoreOrderedListsSettings()

/**
 * StateEffect to signal that plugin settings have changed.
 * This allows the EditorDecorator to respond to settings changes
 * without needing complex compartment reconfiguration.
 */
export const settingsUpdateEffect = StateEffect.define<MoreOrderedListsSettings>()

export interface PluginWithExternalSettingsChange extends Plugin {
    onExternalSettingsChange(): Promise<void>;
}