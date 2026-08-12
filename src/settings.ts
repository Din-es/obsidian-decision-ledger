import { App, PluginSettingTab, Setting } from "obsidian";
import type DecisionLedgerPlugin from "./main";

export interface LedgerSettings {
	/** Path to the compiled `ledger` binary. */
	binaryPath: string;
	/** Absolute path to the repo whose .ledger/ records we read. */
	repoPath: string;
	/** Re-resolve everything when the vault loads. */
	resolveOnLoad: boolean;
}

export const DEFAULT_SETTINGS: LedgerSettings = {
	binaryPath: "ledger",
	repoPath: "",
	resolveOnLoad: true,
};

const CLI_URL = "https://github.com/Din-es/Ledger_c";
const VSCODE_URL =
	"https://marketplace.visualstudio.com/items?itemName=Din-es.decision-anchors";
const GATE_URL = "https://github.com/Din-es/Ledger_c/blob/main/GETTING_STARTED.md";

export class LedgerSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: DecisionLedgerPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.renderOverview(containerEl);

		new Setting(containerEl).setName("Engine").setHeading();

		new Setting(containerEl)
			.setName("Ledger binary")
			.setDesc(
				"Path to the compiled ledger executable. This plugin does no git work itself — the engine does all of it.",
			)
			.addText((text) =>
				text
					.setPlaceholder("ledger")
					.setValue(this.plugin.settings.binaryPath)
					.onChange(async (value) => {
						this.plugin.settings.binaryPath = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Repository path")
			.setDesc(
				"Absolute path to the git repo holding .ledger/ records. This is the repo your decisions govern, which need not be this vault.",
			)
			.addText((text) =>
				text
					.setPlaceholder("C:\\path\\to\\repo")
					.setValue(this.plugin.settings.repoPath)
					.onChange(async (value) => {
						this.plugin.settings.repoPath = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		this.renderEngineCheck(containerEl);

		new Setting(containerEl).setName("Behaviour").setHeading();

		new Setting(containerEl)
			.setName("Resolve on load")
			.setDesc("Refresh decision statuses when the vault opens.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.resolveOnLoad).onChange(async (value) => {
					this.plugin.settings.resolveOnLoad = value;
					await this.plugin.saveSettings();
				}),
			);
	}

	/**
	 * Obsidian is only the authoring surface, and on its own it reports drift
	 * without ever preventing it. Someone who installs just this plugin has no
	 * way to discover the other two surfaces exist, so the settings tab is
	 * where that gets said.
	 */
	private renderOverview(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("How this fits together").setHeading();

		const intro = containerEl.createDiv({ cls: "ledger-intro" });
		intro.createEl("p", {
			text: "A decision is anchored to the exact code it governs. That anchor shows up in three places, and this plugin is one of them:",
		});

		const list = intro.createEl("ul");

		const here = list.createEl("li");
		here.createEl("strong", { text: "Obsidian — this plugin." });
		here.appendText(
			" Write down why, and render the live code a decision governs inside the note that explains it, so a stale note is obvious while you are reading it.",
		);

		const editor = list.createEl("li");
		editor.createEl("strong", { text: "VS Code — " });
		editor.createEl("a", { text: "Decision Anchors", href: VSCODE_URL });
		editor.appendText(
			". The opposite direction: you are reading unfamiliar code and want to know which decision governs the line under your cursor. This is where most people spend the day.",
		);

		const gate = list.createEl("li");
		gate.createEl("strong", { text: "git — " });
		gate.createEl("code", { text: "ledger verify" });
		gate.appendText(
			" in CI. The part that makes the other two stick: a pull request that changes governed code without revisiting its note fails the build.",
		);

		const closing = intro.createEl("p");
		closing.appendText(
			"Rendering drift is useful, but only the gate actually prevents it — without it, notes can still rot quietly, which is the problem this tool exists to solve. ",
		);
		closing.createEl("a", { text: "Setting up the gate", href: GATE_URL });
		closing.appendText(" takes one commit.");
	}

	/**
	 * The plugin and the engine ship from separate repositories on independent
	 * version numbers, so a working install of one proves nothing about the
	 * other. This runs the configured binary and says what answered.
	 */
	private renderEngineCheck(containerEl: HTMLElement): void {
		const status = createDiv({ cls: "ledger-engine-status" });

		new Setting(containerEl)
			.setName("Check the engine")
			.setDesc("Runs the configured binary and reports the version that answered.")
			.addButton((button) =>
				button.setButtonText("Check").onClick(() => {
					void this.runCheck(status);
				}),
			)
			.settingEl.appendChild(status);

		const hint = containerEl.createDiv({ cls: "ledger-intro" });
		const p = hint.createEl("p");
		p.appendText("No engine yet? Install it from ");
		p.createEl("a", { text: "the Ledger_c repository", href: CLI_URL });
		p.appendText(" — prebuilt binaries are on the releases page.");
	}

	private async runCheck(status: HTMLElement): Promise<void> {
		status.removeClass("ledger-engine-ok", "ledger-engine-bad");
		status.setText("Checking…");
		try {
			const version = await this.plugin.engine.version();
			status.addClass("ledger-engine-ok");
			status.setText(`Connected — ${version}`);
		} catch (err) {
			status.addClass("ledger-engine-bad");
			status.setText(err instanceof Error ? err.message : String(err));
		}
	}
}
