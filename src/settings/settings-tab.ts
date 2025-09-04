import type { App, ToggleComponent, DropdownComponent } from 'obsidian'
import { Setting, PluginSettingTab } from 'obsidian'

import type MoreOrderedListsPlugin from '../../main'
import type { PluginWithExternalSettingsChange } from './types'

export class MoreOrderedListsSettingTab extends PluginSettingTab {
    // Contains the currently enabled patterns
    // As they need to be replaced when settings change, they should be stored in a container
    private patternsContainer: HTMLElement | null = null
    
    // Store references to settings for dynamic updates
    private alphabeticalToggle: ToggleComponent | null = null
    private romanToggle: ToggleComponent | null = null
    private nestedDropdown: DropdownComponent | null = null
    private caseDropdown: DropdownComponent | null = null
    private parenthesesToggle: ToggleComponent | null = null

    constructor(
        app: App,
        private plugin: MoreOrderedListsPlugin
    ) {
        super(app, plugin)
    }

    display(): void {
        const { containerEl } = this

        containerEl.empty()

        containerEl.createEl('h1', { text: 'More Ordered Lists Settings' })
        containerEl.createEl('p', { text: 'Configure which list types and formats to recognize.' })

        // Main list types section
        containerEl.createEl('h3', { text: 'List Types' })

        const alphabeticalSetting = new Setting(containerEl)
            .setName('Alphabetical Lists')
            .addToggle(toggle => {
                this.alphabeticalToggle = toggle
                return toggle
                    .setValue(this.plugin.settings.enableAlphabeticalLists)
                    .setDisabled(this.plugin.settings.enableJuraOrdering)
                    .onChange(async (value) => {
                        this.plugin.settings.enableAlphabeticalLists = value
                        await this.handleSettingsChange()
                    })
            })
        
        // Custom description with formatted text
        this.createFormattedDescription(alphabeticalSetting.descEl, [
            { text: 'Enable patterns like ', type: 'text' },
            { text: '**A. item**', type: 'code' },
            { text: ', ', type: 'text' },
            { text: '**B. item**', type: 'code' },
            { text: ' (uppercase) and ', type: 'text' },
            { text: '**a. item**', type: 'code' },
            { text: ', ', type: 'text' },
            { text: '**b. item**', type: 'code' },
            { text: ' (lowercase)', type: 'text' }
        ])

        const romanSetting = new Setting(containerEl)
            .setName('Roman Numeral Lists')
            .addToggle(toggle => {
                this.romanToggle = toggle
                return toggle
                    .setValue(this.plugin.settings.enableRomanLists)
                    .setDisabled(this.plugin.settings.enableJuraOrdering)
                    .onChange(async (value) => {
                        this.plugin.settings.enableRomanLists = value
                        await this.handleSettingsChange()
                    })
            })
        
        // Custom description with formatted text
        this.createFormattedDescription(romanSetting.descEl, [
            { text: 'Enable patterns like ', type: 'text' },
            { text: '**I. item**', type: 'code' },
            { text: ', ', type: 'text' },
            { text: '**II. item**', type: 'code' },
            { text: ' (uppercase) and ', type: 'text' },
            { text: '**i. item**', type: 'code' },
            { text: ', ', type: 'text' },
            { text: '**ii. item**', type: 'code' },
            { text: ' (lowercase)', type: 'text' }
        ])

        const nestedSetting = new Setting(containerEl)
            .setName('Nested Alphabetical Lists')
            .addDropdown(dropdown => {
                this.nestedDropdown = dropdown
                return dropdown
                    .addOption('disabled', 'Disabled')
                    .addOption('bijective', 'Sequential (aa, ab, ac, ...)')
                    .addOption('repeated', 'Repeated (aa, bb, cc, ...)')
                    .setValue(this.plugin.settings.nestedAlphabeticalMode)
                    .setDisabled(this.plugin.settings.enableJuraOrdering)
                    .onChange(async (value: 'disabled' | 'bijective' | 'repeated') => {
                        this.plugin.settings.nestedAlphabeticalMode = value
                        await this.handleSettingsChange()
                    })
            })
        
        // Custom description with formatted text
        this.createFormattedDescription(nestedSetting.descEl, [
            { text: 'Configure nested alphabetical lists like ', type: 'text' },
            { text: '**AA. item**', type: 'code' },
            { text: ', ', type: 'text' },
            { text: '**BB. item**', type: 'code' },
            { text: '. Choose between disabled, sequential (aa, ab, ac), or repeated letters (aa, bb, cc).', type: 'text' }
        ])

        // Format modifiers section
        containerEl.createEl('h3', { text: 'Format Options' })

        const caseStyleSetting = new Setting(containerEl)
            .setName('Case Style')
            .addDropdown(dropdown => {
                this.caseDropdown = dropdown
                return dropdown
                    .addOption('both', 'Both cases (A, I, AA and a, i, aa)')
                    .addOption('upper', 'Uppercase only (A, I, AA)')
                    .addOption('lower', 'Lowercase only (a, i, aa)')
                    .addOption('none', 'Disable case formatting')
                    .setValue(this.plugin.settings.caseStyle)
                    .setDisabled(this.plugin.settings.enableJuraOrdering)
                    .onChange(async (value: 'upper' | 'lower' | 'both' | 'none') => {
                        this.plugin.settings.caseStyle = value
                        await this.handleSettingsChange()
                    })
            })
        
        // Custom description with formatted text
        this.createFormattedDescription(caseStyleSetting.descEl, [
            { text: 'Control which case styles to recognize.', type: 'text' }
        ])

        const parenthesesSetting = new Setting(containerEl)
            .setName('Enable Parentheses')
            .addToggle(toggle => {
                this.parenthesesToggle = toggle
                return toggle
                    .setValue(this.plugin.settings.enableParentheses)
                    .setDisabled(this.plugin.settings.enableJuraOrdering)
                    .onChange(async (value) => {
                        this.plugin.settings.enableParentheses = value
                        await this.handleSettingsChange()
                    })
            })
        
        // Custom description with formatted text
        this.createFormattedDescription(parenthesesSetting.descEl, [
            { text: 'Enable parentheses format like ', type: 'text' },
            { text: '**A) item**', type: 'code' },
            { text: ', ', type: 'text' },
            { text: '**I) item**', type: 'code' },
            { text: ', ', type: 'text' },
            { text: '**AA) item**', type: 'code' },
            { text: ', ', type: 'text' },
            { text: '**(1) item**', type: 'code' },
            { text: ', ', type: 'text' },
            { text: '**(A) item**', type: 'code' },
            { text: ', ', type: 'text' },
            { text: '**(I) item**', type: 'code' },
            { text: ', ', type: 'text' },
            { text: '**(AA) item**', type: 'code' },
            { text: ' in addition to periods.', type: 'text' }
        ])

        const juraSetting = new Setting(containerEl)
            .setName('Jura Ordering')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableJuraOrdering)
                .onChange(async (value) => {
                    this.plugin.settings.enableJuraOrdering = value

                    // When Jura ordering is enabled, enable all required settings
                    if (value) {
                        this.plugin.settings.enableAlphabeticalLists = true
                        this.plugin.settings.enableRomanLists = true
                        this.plugin.settings.nestedAlphabeticalMode = 'repeated'
                        this.plugin.settings.enableParentheses = true
                        this.plugin.settings.caseStyle = 'both'
                    }
                    
                    await this.plugin.saveSettings()
                    this.updateAllSettings()
                    await this.handleSettingsChange()
                }))
        
        // Custom description with formatted text
        this.createFormattedDescription(juraSetting.descEl, [
            { text: 'Enable German Jura ordering for indent levels: ', type: 'text' },
            { text: 'A.', type: 'code' },
            { text: ', ', type: 'text' },
            { text: 'I.', type: 'code' },
            { text: ', ', type: 'text' },
            { text: '1.', type: 'code' },
            { text: ', ', type: 'text' },
            { text: 'a)', type: 'code' },
            { text: ', ', type: 'text' },
            { text: 'aa)', type: 'code' },
            { text: ', ', type: 'text' },
            { text: '(1)', type: 'code' },
            { text: ', ', type: 'text' },
            { text: '(a)', type: 'code' },
            { text: ', ', type: 'text' },
            { text: '(aa)', type: 'code' },
            { text: ', ', type: 'text' },
            { text: '(i)', type: 'code' },
            { text: '', type: 'br' },
            { text: 'When enabled, this will automatically enable and lock all required settings.', type: 'em' }
        ])

        // Examples section
        containerEl.createEl('h3', { text: 'Your Enabled Patterns' })
        
        this.patternsContainer = containerEl.createEl('div')
        this.updateSupportedPatterns()
    }

    private updateAllSettings(): void {
        const isJuraEnabled = this.plugin.settings.enableJuraOrdering
        
        // Update toggle states and disabled status
        if (this.alphabeticalToggle) {
            this.alphabeticalToggle.setValue(this.plugin.settings.enableAlphabeticalLists)
            this.alphabeticalToggle.setDisabled(isJuraEnabled)
        }
        
        if (this.romanToggle) {
            this.romanToggle.setValue(this.plugin.settings.enableRomanLists)
            this.romanToggle.setDisabled(isJuraEnabled)
        }
        
        if (this.nestedDropdown) {
            this.nestedDropdown.setValue(this.plugin.settings.nestedAlphabeticalMode)
            this.nestedDropdown.setDisabled(isJuraEnabled)
        }
        
        if (this.caseDropdown) {
            this.caseDropdown.setValue(this.plugin.settings.caseStyle)
            this.caseDropdown.setDisabled(isJuraEnabled)
        }
        
        if (this.parenthesesToggle) {
            this.parenthesesToggle.setValue(this.plugin.settings.enableParentheses)
            this.parenthesesToggle.setDisabled(isJuraEnabled)
        }
    }

    private async handleSettingsChange(): Promise<void> {
        await this.plugin.saveSettings()
        // Trigger external settings change to update decorators
        if ('onExternalSettingsChange' in this.plugin) {
            await (this.plugin as PluginWithExternalSettingsChange).onExternalSettingsChange()
        }
        this.updateSupportedPatterns()
    }

    private updateSupportedPatterns(): void {
        if (!this.patternsContainer) return

        this.patternsContainer.empty()

        // Show message if no patterns are enabled
        if (!this.plugin.settings.enableAlphabeticalLists && !this.plugin.settings.enableRomanLists && this.plugin.settings.nestedAlphabeticalMode === 'disabled' && !this.plugin.settings.enableParentheses) {
            const noPatterns = this.patternsContainer.createEl('p')
            noPatterns.createEl('em', { text: 'No custom list types are currently enabled.' })
            return
        } else if (this.plugin.settings.caseStyle === 'none') {
            const noCaseStyles = this.patternsContainer.createEl('p')
            noCaseStyles.createEl('em', { text: 'No case styles are enabled.' })
        }

        // Numbered Lists (always shown since Obsidian supports them by default)
        this.patternsContainer.createEl('p').createEl('strong', { text: 'Numbered Lists:' })
        const numberedList = this.patternsContainer.createEl('ul')
        
        const arabicPeriods = numberedList.createEl('li')
        arabicPeriods.appendText('Arabic numerals with periods (by Obsidian): ')
        arabicPeriods.createEl('code', { text: '1.' })
        arabicPeriods.appendText(', ')
        arabicPeriods.createEl('code', { text: '2.' })
        arabicPeriods.appendText(', ')
        arabicPeriods.createEl('code', { text: '3.' })
        
        const arabicParens = numberedList.createEl('li')
        arabicParens.appendText('Arabic numerals with parentheses (by Obsidian): ')
        arabicParens.createEl('code', { text: '1)' })
        arabicParens.appendText(', ')
        arabicParens.createEl('code', { text: '2)' })
        arabicParens.appendText(', ')
        arabicParens.createEl('code', { text: '3)' })
        
        if (this.plugin.settings.enableParentheses) {
            const arabicInParens = numberedList.createEl('li')
            arabicInParens.appendText('Arabic numerals in parentheses: ')
            arabicInParens.createEl('code', { text: '(1)' })
            arabicInParens.appendText(', ')
            arabicInParens.createEl('code', { text: '(2)' })
            arabicInParens.appendText(', ')
            arabicInParens.createEl('code', { text: '(3)' })
        }

        if (this.plugin.settings.caseStyle !== 'none') {
            // Alphabetical Lists
            if (this.plugin.settings.enableAlphabeticalLists) {
                this.patternsContainer.createEl('p').createEl('strong', { text: 'Alphabetical Lists:' })
                const alphaList = this.patternsContainer.createEl('ul')
                
                // Show patterns based on case style setting
                if (this.plugin.settings.hasUppercase()) {
                    const upperPeriods = alphaList.createEl('li')
                    upperPeriods.appendText('Uppercase with periods: ')
                    upperPeriods.createEl('code', { text: 'A.' })
                    upperPeriods.appendText(', ')
                    upperPeriods.createEl('code', { text: 'B.' })
                    upperPeriods.appendText(', ')
                    upperPeriods.createEl('code', { text: 'C.' })
                }

                if (this.plugin.settings.hasLowercase()) {
                    const lowerPeriods = alphaList.createEl('li')
                    lowerPeriods.appendText('Lowercase with periods: ')
                    lowerPeriods.createEl('code', { text: 'a.' })
                    lowerPeriods.appendText(', ')
                    lowerPeriods.createEl('code', { text: 'b.' })
                    lowerPeriods.appendText(', ')
                    lowerPeriods.createEl('code', { text: 'c.' })
                }
                
                // Uppercase with parentheses (only if parentheses is enabled)
                if (this.plugin.settings.enableParentheses && this.plugin.settings.hasUppercase()) {
                    const upperParens = alphaList.createEl('li')
                    upperParens.appendText('Uppercase with parentheses: ')
                    upperParens.createEl('code', { text: 'A)' })
                    upperParens.appendText(', ')
                    upperParens.createEl('code', { text: 'B)' })
                    upperParens.appendText(', ')
                    upperParens.createEl('code', { text: 'C)' })
                    
                    const upperInParens = alphaList.createEl('li')
                    upperInParens.appendText('Uppercase in parentheses: ')
                    upperInParens.createEl('code', { text: '(A)' })
                    upperInParens.appendText(', ')
                    upperInParens.createEl('code', { text: '(B)' })
                    upperInParens.appendText(', ')
                    upperInParens.createEl('code', { text: '(C)' })
                }
                
                // Lowercase with parentheses (only if both lowercase and parentheses are enabled)
                if (this.plugin.settings.enableParentheses && this.plugin.settings.hasLowercase()) {
                    const lowerParens = alphaList.createEl('li')
                    lowerParens.appendText('Lowercase with parentheses: ')
                    lowerParens.createEl('code', { text: 'a)' })
                    lowerParens.appendText(', ')
                    lowerParens.createEl('code', { text: 'b)' })
                    lowerParens.appendText(', ')
                    lowerParens.createEl('code', { text: 'c)' })
                    
                    const lowerInParens = alphaList.createEl('li')
                    lowerInParens.appendText('Lowercase in parentheses: ')
                    lowerInParens.createEl('code', { text: '(a)' })
                    lowerInParens.appendText(', ')
                    lowerInParens.createEl('code', { text: '(b)' })
                    lowerInParens.appendText(', ')
                    lowerInParens.createEl('code', { text: '(c)' })
                }
            }

            // Roman Numeral Lists
            if (this.plugin.settings.enableRomanLists) {
                this.patternsContainer.createEl('p').createEl('strong', { text: 'Roman Numeral Lists:' })
                const romanList = this.patternsContainer.createEl('ul')
                
                // Show patterns based on case style setting
                if (this.plugin.settings.hasUppercase()) {
                    const upperRomanPeriods = romanList.createEl('li')
                    upperRomanPeriods.appendText('Uppercase with periods: ')
                    upperRomanPeriods.createEl('code', { text: 'I.' })
                    upperRomanPeriods.appendText(', ')
                    upperRomanPeriods.createEl('code', { text: 'II.' })
                    upperRomanPeriods.appendText(', ')
                    upperRomanPeriods.createEl('code', { text: 'III.' })
                }

                if (this.plugin.settings.hasLowercase()) {
                    const lowerRomanPeriods = romanList.createEl('li')
                    lowerRomanPeriods.appendText('Lowercase with periods: ')
                    lowerRomanPeriods.createEl('code', { text: 'i.' })
                    lowerRomanPeriods.appendText(', ')
                    lowerRomanPeriods.createEl('code', { text: 'ii.' })
                    lowerRomanPeriods.appendText(', ')
                    lowerRomanPeriods.createEl('code', { text: 'iii.' })
                }
                
                // Uppercase with parentheses (only if parentheses is enabled)
                if (this.plugin.settings.enableParentheses && this.plugin.settings.hasUppercase()) {
                    const upperRomanParens = romanList.createEl('li')
                    upperRomanParens.appendText('Uppercase with parentheses: ')
                    upperRomanParens.createEl('code', { text: 'I)' })
                    upperRomanParens.appendText(', ')
                    upperRomanParens.createEl('code', { text: 'II)' })
                    upperRomanParens.appendText(', ')
                    upperRomanParens.createEl('code', { text: 'III)' })
                    
                    const upperRomanInParens = romanList.createEl('li')
                    upperRomanInParens.appendText('Uppercase in parentheses: ')
                    upperRomanInParens.createEl('code', { text: '(I)' })
                    upperRomanInParens.appendText(', ')
                    upperRomanInParens.createEl('code', { text: '(II)' })
                    upperRomanInParens.appendText(', ')
                    upperRomanInParens.createEl('code', { text: '(III)' })
                }
                
                // Lowercase with parentheses (only if both lowercase and parentheses are enabled)
                if (this.plugin.settings.enableParentheses && this.plugin.settings.hasLowercase()) {
                    const lowerRomanParens = romanList.createEl('li')
                    lowerRomanParens.appendText('Lowercase with parentheses: ')
                    lowerRomanParens.createEl('code', { text: 'i)' })
                    lowerRomanParens.appendText(', ')
                    lowerRomanParens.createEl('code', { text: 'ii)' })
                    lowerRomanParens.appendText(', ')
                    lowerRomanParens.createEl('code', { text: 'iii)' })
                    
                    const lowerRomanInParens = romanList.createEl('li')
                    lowerRomanInParens.appendText('Lowercase in parentheses: ')
                    lowerRomanInParens.createEl('code', { text: '(i)' })
                    lowerRomanInParens.appendText(', ')
                    lowerRomanInParens.createEl('code', { text: '(ii)' })
                    lowerRomanInParens.appendText(', ')
                    lowerRomanInParens.createEl('code', { text: '(iii)' })
                }
            }

            // Nested Alphabetical Lists
            if (this.plugin.settings.nestedAlphabeticalMode !== 'disabled') {
                this.patternsContainer.createEl('p').createEl('strong', { text: 'Nested Alphabetical Lists:' })
                const nestedList = this.patternsContainer.createEl('ul')
                
                // Show different patterns based on the mode
                const isRepeatedMode = this.plugin.settings.nestedAlphabeticalMode === 'repeated'
                const patternSuffix = isRepeatedMode ? 'AA, BB, CC, ..., ZZ, AAA, ...' : 'AA, AB, AC, ..., AZ, BA, ...'
                const patternSuffixLower = isRepeatedMode ? 'aa, bb, cc, dd, ..., zz, aaa, ...' : 'aa, ab, ac, ..., az, ba, ...'

                // Show patterns based on case style setting
                if (this.plugin.settings.hasUppercase()) {
                    const upperNestedPeriods = nestedList.createEl('li')
                    upperNestedPeriods.appendText('Uppercase with periods: ')
                    upperNestedPeriods.createEl('code', { text: patternSuffix })
                }

                if (this.plugin.settings.hasLowercase()) {
                    const lowerNestedPeriods = nestedList.createEl('li')
                    lowerNestedPeriods.appendText('Lowercase with periods: ')
                    lowerNestedPeriods.createEl('code', { text: patternSuffixLower })
                }
                
                // Uppercase with parentheses (only if parentheses is enabled)
                if (this.plugin.settings.enableParentheses && this.plugin.settings.hasUppercase()) {
                    const parenthesesPattern = isRepeatedMode ? 'AA), BB), CC), DD), ...' : 'AA), AB), AC), AD), ...'
                    const inParenthesesPattern = isRepeatedMode ? '(AA), (BB), (CC), (DD), ...' : '(AA), (AB), (AC), (AD), ...'
                    
                    const upperNestedParens = nestedList.createEl('li')
                    upperNestedParens.appendText('Uppercase with parentheses: ')
                    upperNestedParens.createEl('code', { text: parenthesesPattern })
                    
                    const upperNestedInParens = nestedList.createEl('li')
                    upperNestedInParens.appendText('Uppercase in parentheses: ')
                    upperNestedInParens.createEl('code', { text: inParenthesesPattern })
                }
                
                // Lowercase with parentheses (only if both lowercase and parentheses are enabled)
                if (this.plugin.settings.enableParentheses && this.plugin.settings.hasLowercase()) {
                    const parenthesesPatternLower = isRepeatedMode ? 'aa), bb), cc), dd), ...' : 'aa), ab), ac), ad), ...'
                    const inParenthesesPatternLower = isRepeatedMode ? '(aa), (bb), (cc), (dd), ...' : '(aa), (ab), (ac), (ad), ...'
                    
                    const lowerNestedParens = nestedList.createEl('li')
                    lowerNestedParens.appendText('Lowercase with parentheses: ')
                    lowerNestedParens.createEl('code', { text: parenthesesPatternLower })
                    
                    const lowerNestedInParens = nestedList.createEl('li')
                    lowerNestedInParens.appendText('Lowercase in parentheses: ')
                    lowerNestedInParens.createEl('code', { text: inParenthesesPatternLower })
                }
            }
        }

        // Jura Ordering
        if (this.plugin.settings.enableJuraOrdering) {
            this.patternsContainer.createEl('p').createEl('strong', { text: 'Jura-Gliederung:' })

            this.createJuraExample()
            
            const note = this.patternsContainer.createEl('p')
            note.createEl('em', { text: 'This structure follows the traditional German legal methodology for structuring legal arguments and case analyses.' })
        }
    }

    private createJuraExample(): void {
        if (!this.patternsContainer) return
        
        const mainList = this.patternsContainer.createEl('ul')
        
        // A. Anspruch A gegen B auf Zahlung des Kaufpreises (§ 433 II BGB)
        const aItem = mainList.createEl('li')
        aItem.appendText('A. Anspruch A gegen B auf Zahlung des Kaufpreises (§ 433 II BGB)')
        
        const level1List = aItem.createEl('ul')
        
        // I. Kaufvertrag
        const iItem = level1List.createEl('li')
        iItem.appendText('I. Kaufvertrag')
        
        const level2List = iItem.createEl('ul')
        
        // 1. Antrag
        const oneItem = level2List.createEl('li')
        oneItem.appendText('1. Antrag')
        
        const level3List = oneItem.createEl('ul')
        
        // a) Tatbestand einer Willenserklärung
        const aParenItem = level3List.createEl('li')
        aParenItem.appendText('a) Tatbestand einer Willenserklärung')
        
        const level4List = aParenItem.createEl('ul')
        
        // aa) Objektiver Erklärungstatbestand
        const aaItem = level4List.createEl('li')
        aaItem.appendText('aa) Objektiver Erklärungstatbestand')
        
        // bb) Subjektiver Erklärungstatbestand
        const bbItem = level4List.createEl('li')
        bbItem.appendText('bb) Subjektiver Erklärungstatbestand')
        
        const level5List = bbItem.createEl('ul')
        
        // (1) Handlungswille
        const one1Item = level5List.createEl('li')
        one1Item.appendText('(1) Handlungswille')
        
        // (2) Erklärungsbewusstsein
        const two2Item = level5List.createEl('li')
        two2Item.appendText('(2) Erklärungsbewusstsein')
        
        // (3) Geschäftswille
        const three3Item = level5List.createEl('li')
        three3Item.appendText('(3) Geschäftswille')
        
        // cc) Zwischenergebnis
        const ccItem = level4List.createEl('li')
        ccItem.appendText('cc) Zwischenergebnis')
        
        // b) Wirksamwerden der Willenserklärung
        const bParenItem = level3List.createEl('li')
        bParenItem.appendText('b) Wirksamwerden der Willenserklärung')
        
        const level4List2 = bParenItem.createEl('ul')
        
        // aa) Abgabe
        const aa2Item = level4List2.createEl('li')
        aa2Item.appendText('aa) Abgabe')
        
        // bb) Zugang
        const bb2Item = level4List2.createEl('li')
        bb2Item.appendText('bb) Zugang')
        
        // cc) Zwischenergebnis
        const cc2Item = level4List2.createEl('li')
        cc2Item.appendText('cc) Zwischenergebnis')
        
        // 2. Annahme
        const twoItem = level2List.createEl('li')
        twoItem.appendText('2. Annahme')
        
        // 3. Zwischenergebnis
        const threeItem = level2List.createEl('li')
        threeItem.appendText('3. Zwischenergebnis')
        
        // II. Anfechtung
        const iiItem = level1List.createEl('li')
        iiItem.appendText('II. Anfechtung')
        
        const level2List2 = iiItem.createEl('ul')
        
        // 1. Anfechtungsgrund
        const oneAnfItem = level2List2.createEl('li')
        oneAnfItem.appendText('1. Anfechtungsgrund')
        
        // 2. Anfechtungserklärung
        const twoAnfItem = level2List2.createEl('li')
        twoAnfItem.appendText('2. Anfechtungserklärung')
        
        // 3. Richtiger Anfechtungsgegner
        const threeAnfItem = level2List2.createEl('li')
        threeAnfItem.appendText('3. Richtiger Anfechtungsgegner')
        
        // 4. Anfechtungsfrist
        const fourAnfItem = level2List2.createEl('li')
        fourAnfItem.appendText('4. Anfechtungsfrist')
        
        // 5. Zwischenergebnis
        const fiveAnfItem = level2List2.createEl('li')
        fiveAnfItem.appendText('5. Zwischenergebnis')
        
        // B. Endergebnis
        const bItem = mainList.createEl('li')
        bItem.appendText('B. Endergebnis')
    }

    // Helper method to create formatted description text with code elements
    private createFormattedDescription(container: HTMLElement, parts: Array<{text: string, type: 'text' | 'code' | 'em' | 'br'}>): void {
        container.empty()
        
        for (const part of parts) {
            switch (part.type) {
                case 'text': {
                    container.appendText(part.text)
                    break
                }
                case 'code': {
                    const code = container.createEl('code')
                    if (part.text.includes('**')) {
                        // Handle bold text within code
                        const boldParts = part.text.split('**')
                        for (let i = 0; i < boldParts.length; i++) {
                            if (i % 2 === 1) {
                                code.createEl('strong', { text: boldParts[i] })
                            } else if (boldParts[i]) {
                                code.appendText(boldParts[i])
                            }
                        }
                    } else {
                        code.setText(part.text)
                    }
                    break
                }
                case 'em': {
                    container.createEl('em', { text: part.text })
                    break
                }
                case 'br': {
                    container.createEl('br')
                    break
                }
            }
        }
    }
}
