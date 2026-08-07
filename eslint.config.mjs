import tseslint from "typescript-eslint";

// Mirrors the type-checked rules the Obsidian community review runs, so the
// same problems surface here rather than after a release.
export default tseslint.config(
	{ ignores: ["main.js", "node_modules/**"] },
	...tseslint.configs.recommendedTypeChecked,
	{
		languageOptions: {
			parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
		},
	},
);
