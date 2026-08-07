import { execFile } from "child_process";

/**
 * The shape of `execFile` we actually use.
 *
 * Node's own typings are not reliably resolvable in every linting environment,
 * and when they are not, `execFile` degrades to `any` and every call through it
 * is reported unsafe. Declaring the narrow signature we depend on keeps this
 * file fully typed regardless, and documents exactly what is being called.
 */
type ExecFile = (
	file: string,
	args: readonly string[],
	options: { cwd: string; windowsHide: boolean; maxBuffer: number },
	callback: (error: Error | null, stdout: string, stderr: string) => void,
) => void;

const runProcess = execFile as unknown as ExecFile;

export type Status = "fresh" | "drifted" | "broken";

/** One resolved decision, mirroring ledger.Report from the Go engine. */
export interface Report {
	id: string;
	title?: string;
	note?: string;
	file: string;
	range: [number, number];
	status: Status;
	confidence: number;
	renamed?: boolean;
	boundAt: string;
	code?: string[];
}

export class EngineError extends Error {}

/**
 * Thin client over the `ledger` CLI. All git work happens in the Go engine so
 * the plugin stays responsive; we only spawn, parse, and cache.
 */
export class Engine {
	constructor(private binary: string, private repoPath: string) {}

	configure(binary: string, repoPath: string) {
		this.binary = binary;
		this.repoPath = repoPath;
	}

	/** Resolve every decision in the repo against the working tree. */
	list(): Promise<Report[]> {
		return this.run(["list", "--json"]);
	}

	/** Resolve a single decision by id. */
	async resolve(id: string): Promise<Report | null> {
		const reports = await this.run(["resolve", id, "--json"]);
		return reports.length > 0 ? reports[0] : null;
	}

	/** Narrows an unknown parsed value to a Report without trusting the CLI. */
	private static toReport(value: unknown): Report | null {
		if (typeof value !== "object" || value === null) return null;
		const v = value as Record<string, unknown>;
		if (typeof v.id !== "string" || typeof v.file !== "string") return null;
		const range = Array.isArray(v.range) ? v.range : [];
		return {
			id: v.id,
			title: typeof v.title === "string" ? v.title : undefined,
			note: typeof v.note === "string" ? v.note : undefined,
			file: v.file,
			range: [Number(range[0]) || 0, Number(range[1]) || 0],
			status: v.status === "fresh" || v.status === "drifted" ? v.status : "broken",
			confidence: typeof v.confidence === "number" ? v.confidence : 0,
			renamed: v.renamed === true,
			boundAt: typeof v.boundAt === "string" ? v.boundAt : "",
			code: Array.isArray(v.code) ? v.code.map((line) => String(line)) : undefined,
		};
	}

	private run(args: string[]): Promise<Report[]> {
		return new Promise<Report[]>((resolve, reject) => {
			if (!this.binary) {
				reject(new EngineError("No ledger binary configured — set it in plugin settings."));
				return;
			}
			runProcess(
				this.binary,
				args,
				{ cwd: this.repoPath, windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
				(err: Error | null, stdout: string, stderr: string) => {
					// `verify` exits non-zero by design; list/resolve only do so on
					// real failure, so surface stderr rather than the exit code.
					if (err && !stdout.trim()) {
						reject(new EngineError(stderr.trim() || err.message));
						return;
					}
					let parsed: unknown;
					try {
						parsed = JSON.parse(stdout || "[]");
					} catch {
						reject(new EngineError(`Could not parse engine output: ${stdout.slice(0, 200)}`));
						return;
					}
					const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
					const reports: Report[] = [];
					for (const item of items) {
						const r = Engine.toReport(item);
						if (r) reports.push(r);
					}
					resolve(reports);
				},
			);
		});
	}
}
