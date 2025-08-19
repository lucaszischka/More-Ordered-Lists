import type { App, ToggleComponent, DropdownComponent } from 'obsidian'
import { Setting, PluginSettingTab } from 'obsidian'

import type MoreOrderedListsPlugin from '../../main'
import type { PluginWithExternalSettingsChange } from './types'


// TODO: This document is not following the code style of the rest of the plugin
export class MoreOrderedListsSettingTab extends PluginSettingTab {
    // Contains the currently enabled patterns
    // As they need to be replaced when settings change, they should be stored in a container
    private patternsContainer: HTMLElement | null = null;
    
    // Store references to settings for dynamic updates
    private alphabeticalToggle: ToggleComponent | null = null;
    private romanToggle: ToggleComponent | null = null;
    private nestedDropdown: DropdownComponent | null = null;
    private caseDropdown: DropdownComponent | null = null;
    private parenthesesToggle: ToggleComponent | null = null;

    constructor(
        app: App,
        private plugin: MoreOrderedListsPlugin
    ) {
        super(app, plugin);
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h1', { text: 'More Ordered Lists Settings' });
        containerEl.createEl('p', { text: 'Configure which list types and formats to recognize.' });

        // Main list types section
        containerEl.createEl('h3', { text: 'List Types' });

        const alphabeticalSetting = new Setting(containerEl)
            .setName('Alphabetical Lists')
            .addToggle(toggle => {
                this.alphabeticalToggle = toggle;
                return toggle
                    .setValue(this.plugin.settings.enableAlphabeticalLists)
                    .setDisabled(this.plugin.settings.enableJuraOrdering)
                    .onChange(async (value) => {
                        this.plugin.settings.enableAlphabeticalLists = value;
                        await this.handleSettingsChange();
                    });
            });
        
        // Custom description with HTML
        alphabeticalSetting.descEl.innerHTML = 'Enable patterns like <code><strong>A. item</strong></code>, <code><strong>B. item</strong></code> (uppercase) and <code><strong>a. item</strong></code>, <code><strong>b. item</strong></code> (lowercase)';

        const romanSetting = new Setting(containerEl)
            .setName('Roman Numeral Lists')
            .addToggle(toggle => {
                this.romanToggle = toggle;
                return toggle
                    .setValue(this.plugin.settings.enableRomanLists)
                    .setDisabled(this.plugin.settings.enableJuraOrdering)
                    .onChange(async (value) => {
                        this.plugin.settings.enableRomanLists = value;
                        await this.handleSettingsChange();
                    });
            });
        
        // Custom description with HTML
        romanSetting.descEl.innerHTML = 'Enable patterns like <code><strong>I. item</strong></code>, <code><strong>II. item</strong></code> (uppercase) and <code><strong>i. item</strong></code>, <code><strong>ii. item</strong></code> (lowercase)';

        const nestedSetting = new Setting(containerEl)
            .setName('Nested Alphabetical Lists')
            .addDropdown(dropdown => {
                this.nestedDropdown = dropdown;
                return dropdown
                    .addOption('disabled', 'Disabled')
                    .addOption('bijective', 'Sequential (aa, ab, ac, ...)')
                    .addOption('repeated', 'Repeated (aa, bb, cc, ...)')
                    .setValue(this.plugin.settings.nestedAlphabeticalMode)
                    .setDisabled(this.plugin.settings.enableJuraOrdering)
                    .onChange(async (value: 'disabled' | 'bijective' | 'repeated') => {
                        this.plugin.settings.nestedAlphabeticalMode = value;
                        await this.handleSettingsChange();
                    });
            });
        
        // Custom description with HTML
        nestedSetting.descEl.innerHTML = 'Configure nested alphabetical lists like <code><strong>AA. item</strong></code>, <code><strong>BB. item</strong></code>. Choose between disabled, sequential (aa, ab, ac), or repeated letters (aa, bb, cc).';

        // Format modifiers section
        containerEl.createEl('h3', { text: 'Format Options' });

        const caseStyleSetting = new Setting(containerEl)
            .setName('Case Style')
            .addDropdown(dropdown => {
                this.caseDropdown = dropdown;
                return dropdown
                    .addOption('both', 'Both cases (A, I, AA and a, i, aa)')
                    .addOption('upper', 'Uppercase only (A, I, AA)')
                    .addOption('lower', 'Lowercase only (a, i, aa)')
                    .addOption('none', 'Disable case formatting')
                    .setValue(this.plugin.settings.caseStyle)
                    .setDisabled(this.plugin.settings.enableJuraOrdering)
                    .onChange(async (value: 'upper' | 'lower' | 'both' | 'none') => {
                        this.plugin.settings.caseStyle = value;
                        await this.handleSettingsChange();
                    });
            });
        
        // Custom description with HTML
        caseStyleSetting.descEl.innerHTML = 'Control which case styles to recognize.';

        const parenthesesSetting = new Setting(containerEl)
            .setName('Enable Parentheses')
            .addToggle(toggle => {
                this.parenthesesToggle = toggle;
                return toggle
                    .setValue(this.plugin.settings.enableParentheses)
                    .setDisabled(this.plugin.settings.enableJuraOrdering)
                    .onChange(async (value) => {
                        this.plugin.settings.enableParentheses = value;
                        await this.handleSettingsChange();
                    });
            });
        
        // Custom description with HTML
        parenthesesSetting.descEl.innerHTML = 'Enable parentheses format like <code><strong>A) item</strong></code>, <code><strong>I) item</strong></code>, <code><strong>AA) item</strong></code>, <code><strong>(1) item</strong></code>, <code><strong>(A) item</strong></code>, <code><strong>(I) item</strong></code>, <code><strong>(AA) item</strong></code> in addition to periods.';

        const juraSetting = new Setting(containerEl)
            .setName('Jura Ordering')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableJuraOrdering)
                .onChange(async (value) => {
                    this.plugin.settings.enableJuraOrdering = value;

                    // When Jura ordering is enabled, enable all required settings
                    if (value) {
                        this.plugin.settings.enableAlphabeticalLists = true;
                        this.plugin.settings.enableRomanLists = true;
                        this.plugin.settings.nestedAlphabeticalMode = 'repeated';
                        this.plugin.settings.enableParentheses = true;
                        this.plugin.settings.caseStyle = 'both';
                    }
                    
                    await this.plugin.saveSettings();
                    this.updateAllSettings();
                    await this.handleSettingsChange();
                }));
        
        // Custom description with HTML
        juraSetting.descEl.innerHTML = 'Enable German Jura ordering for indent levels: <code>A.</code>, <code>I.</code>, <code>1.</code>, <code>a)</code>, <code>aa)</code>, <code>(1)</code>, <code>(a)</code>, <code>(aa)</code>, <code>(i)</code><br><em>When enabled, this will automatically enable and lock all required settings.</em>';

        // Examples section
        containerEl.createEl('h3', { text: 'Your Enabled Patterns' });
        
        this.patternsContainer = containerEl.createEl('div');
        this.updateSupportedPatterns();
    }

    private updateAllSettings(): void {
        const isJuraEnabled = this.plugin.settings.enableJuraOrdering;
        
        // Update toggle states and disabled status
        if (this.alphabeticalToggle) {
            this.alphabeticalToggle.setValue(this.plugin.settings.enableAlphabeticalLists);
            this.alphabeticalToggle.setDisabled(isJuraEnabled);
        }
        
        if (this.romanToggle) {
            this.romanToggle.setValue(this.plugin.settings.enableRomanLists);
            this.romanToggle.setDisabled(isJuraEnabled);
        }
        
        if (this.nestedDropdown) {
            this.nestedDropdown.setValue(this.plugin.settings.nestedAlphabeticalMode);
            this.nestedDropdown.setDisabled(isJuraEnabled);
        }
        
        if (this.caseDropdown) {
            this.caseDropdown.setValue(this.plugin.settings.caseStyle);
            this.caseDropdown.setDisabled(isJuraEnabled);
        }
        
        if (this.parenthesesToggle) {
            this.parenthesesToggle.setValue(this.plugin.settings.enableParentheses);
            this.parenthesesToggle.setDisabled(isJuraEnabled);
        }
    }

    private async handleSettingsChange(): Promise<void> {
        await this.plugin.saveSettings();
        // Trigger external settings change to update decorators
        if ('onExternalSettingsChange' in this.plugin) {
            await (this.plugin as PluginWithExternalSettingsChange).onExternalSettingsChange();
        }
        this.updateSupportedPatterns();
    }

    private updateSupportedPatterns(): void {
        if (!this.patternsContainer) return;

        let html = '';

        // Show message if no patterns are enabled
        if (!this.plugin.settings.enableAlphabeticalLists && !this.plugin.settings.enableRomanLists && this.plugin.settings.nestedAlphabeticalMode === 'disabled' && !this.plugin.settings.enableParentheses) {
            html = '<p><em>No custom list types are currently enabled.</em></p>';
        } else if (this.plugin.settings.caseStyle === 'none') {
            html += '<p><em>No case styles are enabled.</em></p>';
        }

        // Numbered Lists (always shown since Obsidian supports them by default)
        html += '<p><strong>Numbered Lists:</strong></p><ul>';
        html += '<li>Arabic numerals with periods (by Obsidian): <code>1.</code>, <code>2.</code>, <code>3.</code></li>';
        html += '<li>Arabic numerals with parentheses (by Obsidian): <code>1)</code>, <code>2)</code>, <code>3)</code></li>';
        
        if (this.plugin.settings.enableParentheses) {
            html += '<li>Arabic numerals in parentheses: <code>(1)</code>, <code>(2)</code>, <code>(3)</code></li>';
        }
        html += '</ul>';

        if (this.plugin.settings.caseStyle !== 'none') {
            // Alphabetical Lists
            if (this.plugin.settings.enableAlphabeticalLists) {
                html += '<p><strong>Alphabetical Lists:</strong></p><ul>';
                
                // Show patterns based on case style setting
                if (this.plugin.settings.hasUppercase()) {
                    html += '<li>Uppercase with periods: <code>A.</code>, <code>B.</code>, <code>C.</code></li>';
                }

                if (this.plugin.settings.hasLowercase()) {
                    html += '<li>Lowercase with periods: <code>a.</code>, <code>b.</code>, <code>c.</code></li>';
                }
                
                // Uppercase with parentheses (only if parentheses is enabled)
                if (this.plugin.settings.enableParentheses && this.plugin.settings.hasUppercase()) {
                    html += '<li>Uppercase with parentheses: <code>A)</code>, <code>B)</code>, <code>C)</code></li>';
                    html += '<li>Uppercase in parentheses: <code>(A)</code>, <code>(B)</code>, <code>(C)</code></li>';
                }
                
                // Lowercase with parentheses (only if both lowercase and parentheses are enabled)
                if (this.plugin.settings.enableParentheses && this.plugin.settings.hasLowercase()) {
                    html += '<li>Lowercase with parentheses: <code>a)</code>, <code>b)</code>, <code>c)</code></li>';
                    html += '<li>Lowercase in parentheses: <code>(a)</code>, <code>(b)</code>, <code>(c)</code></li>';
                }
                
                html += '</ul>';
            }

            // Roman Numeral Lists
            if (this.plugin.settings.enableRomanLists) {
                html += '<p><strong>Roman Numeral Lists:</strong></p><ul>';
                
                // Show patterns based on case style setting
                if (this.plugin.settings.hasUppercase()) {
                    html += '<li>Uppercase with periods: <code>I.</code>, <code>II.</code>, <code>III.</code></li>';
                }

                if (this.plugin.settings.hasLowercase()) {
                    html += '<li>Lowercase with periods: <code>i.</code>, <code>ii.</code>, <code>iii.</code></li>';
                }
                
                // Uppercase with parentheses (only if parentheses is enabled)
                if (this.plugin.settings.enableParentheses && this.plugin.settings.hasUppercase()) {
                    html += '<li>Uppercase with parentheses: <code>I)</code>, <code>II)</code>, <code>III)</code></li>';
                    html += '<li>Uppercase in parentheses: <code>(I)</code>, <code>(II)</code>, <code>(III)</code></li>';
                }
                
                // Lowercase with parentheses (only if both lowercase and parentheses are enabled)
                if (this.plugin.settings.enableParentheses && this.plugin.settings.hasLowercase()) {
                    html += '<li>Lowercase with parentheses: <code>i)</code>, <code>ii)</code>, <code>iii)</code></li>';
                    html += '<li>Lowercase in parentheses: <code>(i)</code>, <code>(ii)</code>, <code>(iii)</code></li>';
                }
                
                html += '</ul>';
            }

            // Nested Alphabetical Lists
            if (this.plugin.settings.nestedAlphabeticalMode !== 'disabled') {
                html += '<p><strong>Nested Alphabetical Lists:</strong></p><ul>'
                
                // Show different patterns based on the mode
                const isRepeatedMode = this.plugin.settings.nestedAlphabeticalMode === 'repeated'
                const patternSuffix = isRepeatedMode ? 'AA, BB, CC, ..., ZZ, AAA, ...' : 'AA, AB, AC, ..., AZ, BA, ...'
                const patternSuffixLower = isRepeatedMode ? 'aa, bb, cc, dd, ..., zz, aaa, ...' : 'aa, ab, ac, ..., az, ba, ...'

                // Show patterns based on case style setting
                if (this.plugin.settings.hasUppercase()) {
                    html += `<li>Uppercase with periods: <code>${patternSuffix}</code></li>`;
                }

                if (this.plugin.settings.hasLowercase()) {
                    html += `<li>Lowercase with periods: <code>${patternSuffixLower}</code></li>`;
                }
                
                // Uppercase with parentheses (only if parentheses is enabled)
                if (this.plugin.settings.enableParentheses && this.plugin.settings.hasUppercase()) {
                    const parenthesesPattern = isRepeatedMode ? 'AA), BB), CC), DD), ...' : 'AA), AB), AC), AD), ...'
                    const inParenthesesPattern = isRepeatedMode ? '(AA), (BB), (CC), (DD), ...' : '(AA), (AB), (AC), (AD), ...'
                    html += `<li>Uppercase with parentheses: <code>${parenthesesPattern}</code></li>`;
                    html += `<li>Uppercase in parentheses: <code>${inParenthesesPattern}</code></li>`;
                }
                
                // Lowercase with parentheses (only if both lowercase and parentheses are enabled)
                if (this.plugin.settings.enableParentheses && this.plugin.settings.hasLowercase()) {
                    const parenthesesPatternLower = isRepeatedMode ? 'aa), bb), cc), dd), ...' : 'aa), ab), ac), ad), ...'
                    const inParenthesesPatternLower = isRepeatedMode ? '(aa), (bb), (cc), (dd), ...' : '(aa), (ab), (ac), (ad), ...'
                    html += `<li>Lowercase with parentheses: <code>${parenthesesPatternLower}</code></li>`;
                    html += `<li>Lowercase in parentheses: <code>${inParenthesesPatternLower}</code></li>`;
                }
                
                html += '</ul>';
            }
        }

        // Jura Ordering
        if (this.plugin.settings.enableJuraOrdering) {
            html += '<p><strong>Jura-Gliederung:</strong></p>';

            html += '<ul>';
            html += '<li>A. Anspruch A gegen B auf Zahlung des Kaufpreises (§ 433 II BGB)</li>';
                html += '<ul>';
                html += '<li>I. Kaufvertrag</li>';
                    html += '<ul>';
                    html += '<li>1. Antrag</li>';
                        html += '<ul>';
                        html += '<li>a) Tatbestand einer Willenserklärung</li>';
                            html += '<ul>';
                            html += '<li>aa) Objektiver Erklärungstatbestand</li>';
                            html += '<li>bb) Subjektiver Erklärungstatbestand</li>';
                                html += '<ul>';
                                html += '<li>(1) Handlungswille</li>';
                                html += '<li>(2) Erklärungsbewusstsein</li>';
                                html += '<li>(3) Geschäftswille</li>';
                                html += '</ul>';
                            html += '<li>cc) Zwischenergebnis</li>';
                            html += '</ul>';
                        html += '<li>b) Wirksamwerden der Willenserklärung</li>';
                            html += '<ul>';
                            html += '<li>aa) Abgabe</li>';
                            html += '<li>bb) Zugang</li>';
                            html += '<li>cc) Zwischenergebnis</li>';
                            html += '</ul>';
                        html += '</ul>';
                    html += '<li>2. Annahme</li>';
                    html += '<li>3. Zwischenergebnis</li>';
                    html += '</ul>';
                html += '<li>II. Anfechtung</li>';
                    html += '<ul>';
                    html += '<li>1. Anfechtungsgrund</li>';
                    html += '<li>2. Anfechtungserklärung</li>';
                    html += '<li>3. Richtiger Anfechtungsgegner</li>';
                    html += '<li>4. Anfechtungsfrist</li>';
                    html += '<li>5. Zwischenergebnis</li>';
                    html += '</ul>';
                html += '</ul>';
            html += '<li>B. Endergebnis</li>';
            html += '</ul>';

            html += '<p><em>This structure follows the traditional German legal methodology for structuring legal arguments and case analyses.</em></p>';
            
        }

        this.patternsContainer.innerHTML = html;
    }
}
