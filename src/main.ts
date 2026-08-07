import { Notice, Plugin, TFile, WorkspaceLeaf, parseYaml } from "obsidian";
import { Engine, type Report } from "./engine";
import { renderError, renderReport } from "./render";
import { DEFAULT_SETTINGS, LedgerSettingTab, type LedgerSettings } from "./settings";
import { LEDGER_VIEW_TYPE, LedgerView } from "./view";

export default class DecisionLedgerPlugin extends Plugin {
	settings: LedgerSettings = DEFAULT_SETTINGS;
	engine!: Engine;

	async onload() {
		await this.loadSettings();
		this.engine = new Engine(this.settings.binaryPath, this.settings.repoPath);

		this.registerView(LEDGER_VIEW_TYPE, (leaf: WorkspaceLeaf) => new LedgerView(leaf, this));
		this.addSettingTab(new LedgerSettingTab(this.app, this));

		// The hero feature: a ```ledger block renders the live code a decision
		// governs, resolved through the engine at read time.
		this.registerMarkdownCodeBlockProcessor("ledger", async (source, el, ctx) => {
			const id = this.parseBlockId(source) ?? this.idFromFrontmatter(ctx.sourcePath);
			if (!id) {
				renderError(el, "No decision id. Add `id: your-decision` to this block.");
				return;
			}
			el.createDiv({ cls: "ledger-loading", text: "Resolving…" });
			try {
				const report = await this.engine.resolve(id);
				el.empty();
				if (!report) {
					renderError(el, `No decision named "${id}" in .ledger/.`);
					return;
				}
				renderReport(el, report, (r) => void this.openSource(r));
			} catch (err) {
				el.empty();
				renderError(el, err instanceof Error ? err.message : String(err));
			}
		});

		this.addCommand({
			id: "open-ledger-view",
			name: "Open sidebar",
			callback: () => void this.activateView(),
		});

		this.addCommand({
			id: "resolve-all-decisions",
			name: "Resolve all decisions",
			callback: async () => {
				const view = this.getView();
				if (view) {
					await view.refresh();
					new Notice("Decisions resolved.");
				} else {
					await this.activateView();
				}
			},
		});

		this.addCommand({
			id: "show-stale-decisions",
			name: "Show stale decisions",
			callback: async () => {
				try {
					const reports = await this.engine.list();
					const stale = reports.filter((r) => r.status !== "fresh");
					new Notice(
						stale.length === 0
							? "All decisions track their code."
							: `${stale.length} decision(s) need attention: ${stale.map((r) => r.id).join(", ")}`,
					);
					await this.activateView();
				} catch (err) {
					new Notice(err instanceof Error ? err.message : String(err));
				}
			},
		});
	}

	onunload() {
		// Obsidian detaches views registered via registerView automatically.
	}

	/** Reads `id: foo` out of a ```ledger block body. */
	private parseBlockId(source: string): string | null {
		try {
			const parsed: unknown = parseYaml(source);
			if (typeof parsed === "object" && parsed !== null) {
				const id = (parsed as Record<string, unknown>).id;
				if (typeof id === "string") return id.trim();
			}
		} catch {
			// Fall through to the bare-string form below.
		}
		const bare = source.trim();
		return bare && !bare.includes("\n") && !bare.includes(":") ? bare : null;
	}

	/** Falls back to `ledger-id:` in the note's frontmatter. */
	private idFromFrontmatter(sourcePath: string): string | null {
		const file = this.app.vault.getAbstractFileByPath(sourcePath);
		if (!(file instanceof TFile)) return null;
		const frontmatter: unknown = this.app.metadataCache.getFileCache(file)?.frontmatter;
		if (typeof frontmatter !== "object" || frontmatter === null) return null;
		const id = (frontmatter as Record<string, unknown>)["ledger-id"];
		return typeof id === "string" ? id : null;
	}

	/**
	 * Reveals the governed code. When the repository is inside the vault the
	 * file opens as a normal note; otherwise we show its path.
	 *
	 * This deliberately does not shell out to a file manager. The plugin already
	 * runs one external process — the `ledger` binary — and a second one just to
	 * open a file is avoidable surface area for no real gain.
	 */
	private async openSource(report: Report) {
		const inVault = this.app.vault.getAbstractFileByPath(report.file);
		if (inVault instanceof TFile) {
			await this.app.workspace.getLeaf(false).openFile(inVault);
			return;
		}
		new Notice(`Governed code: ${report.file}:${report.range[0]}-${report.range[1]}`);
	}

	/** Opens the decision's note in the vault, if it maps to a vault file. */
	async openNote(report: Report) {
		if (!report.note) return;
		const file = this.app.vault.getAbstractFileByPath(report.note);
		if (file instanceof TFile) {
			await this.app.workspace.getLeaf(false).openFile(file);
		} else {
			new Notice(`Note not in this vault: ${report.note}`);
		}
	}

	private getView(): LedgerView | null {
		const leaf = this.app.workspace.getLeavesOfType(LEDGER_VIEW_TYPE)[0];
		return leaf?.view instanceof LedgerView ? leaf.view : null;
	}

	async activateView() {
		const existing = this.app.workspace.getLeavesOfType(LEDGER_VIEW_TYPE);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: LEDGER_VIEW_TYPE, active: true });
		this.app.workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		const stored: unknown = await this.loadData();
		const partial = typeof stored === "object" && stored !== null ? stored : {};
		this.settings = Object.assign({}, DEFAULT_SETTINGS, partial) as LedgerSettings;
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.engine.configure(this.settings.binaryPath, this.settings.repoPath);
	}
}
