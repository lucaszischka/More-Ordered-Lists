import { Plugin } from 'obsidian'
import type { MarkdownView } from 'obsidian'

import { ViewPlugin, keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import type { Extension } from '@codemirror/state'

import { DEFAULT_SETTINGS, settingsUpdateEffect } from 'src/settings/types'
import type { MoreOrderedListsSettings } from 'src/settings/types';
import { Parser } from 'src/parser'
import { KeyHandler } from 'src/editor/key-handler'
import { MoreOrderedListsSettingTab } from 'src/settings/settings-tab';
import { EditorDecorator } from 'src/editor/editor-decorator'
import { ReadingModePostProcessor } from 'src/reading/post-processor'
import type { ObsidianEditorWithCM } from 'src/types'

export default class MoreOrderedListsPlugin extends Plugin {
	settings: MoreOrderedListsSettings
	private parser: Parser
	private keyHandler: KeyHandler
	private readingModeProcessor: ReadingModePostProcessor

	async onload(): Promise<void> {
		await this.loadSettings()

		this.addSettingTab(new MoreOrderedListsSettingTab(this.app, this))

		this.parser = new Parser(this.settings)
		this.keyHandler = new KeyHandler(this.settings, this.parser)
		this.readingModeProcessor = new ReadingModePostProcessor(this.settings, this.app)

		// Register editor extension for live editing
		this.registerEditorExtension(this.create())

		// Register markdown post processor for reading mode
		this.registerMarkdownPostProcessor(this.readingModeProcessor.processLists)
	}

	async loadSettings(): Promise<void> {
		const loadedData = await this.loadData()
		this.settings = DEFAULT_SETTINGS
		if (loadedData)
			Object.assign(this.settings, loadedData)
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings)
	}

	private create(): Extension {
        return [
            Prec.high(
                keymap.of([
                {
                    key: "Enter",
                    run: (view) => this.keyHandler.enterKey(view)
                },
                {
                    key: "Tab",
                    run: (view) => this.keyHandler.tabKey(view, false)
                },
                {
                    key: "Shift-Tab",
                    run: (view) => this.keyHandler.tabKey(view, true)
                }
            ])
            ),
            ViewPlugin.define(view => new EditorDecorator(view, this.parser), {
                decorations: v => v.decorations
            }),
        ]
    }

	/**
	 *  This method can also be called manually to trigger settings updates
	 */
	async onExternalSettingsChange(): Promise<void> {
		// Since parser reads from settings object by reference, no need to recreate anything
		
		// Dispatch settings update effect to all active markdown editors
		this.app.workspace.iterateAllLeaves((leaf) => {
			// Check if this leaf/tab is a MarkdownView (versus canvas, PDF, settings)
			if (leaf.view.getViewType() === 'markdown') {
				const markdownView = leaf.view as MarkdownView
				
				// Get Obsidian's Editor with aunderlying CodeMirror 6 instance
				// This is where our ViewPlugin and decorations actually live
				const editor = markdownView.editor as ObsidianEditorWithCM
				if (editor && editor.cm) {
					// Send our custom StateEffect to this CodeMirror instance
					// This will trigger the EditorDecorator.update() method
					editor.cm.dispatch({
						effects: [settingsUpdateEffect.of(this.settings)]
					})
				}
			}
		});
	}
}