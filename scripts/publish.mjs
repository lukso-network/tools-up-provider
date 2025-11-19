#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { $ } from "zx";

const outputs = JSON.parse(await readFile(process.argv[2], "utf-8"));

// Parse command line arguments for --tag
const tagIndex = process.argv.indexOf("--tag");
const tag = tagIndex !== -1 ? process.argv[tagIndex + 1] : undefined;

for (const key in outputs) {
	const value = outputs[key];
	const match = key.match(/^(.*\/.*)--release_created$/);
	if (!match || !value) continue;
	const workspace = match[1];

	// Verify this is a @lukso/* package before publishing
	const pkgPath = `${workspace}/package.json`;
	try {
		const pkgContent = await readFile(pkgPath, "utf-8");
		const pkg = JSON.parse(pkgContent);

		if (!pkg.name || !pkg.name.startsWith("@lukso/")) {
			console.log(`⏭️  Skipping non-@lukso package: ${pkg.name || workspace}`);
			continue;
		}

		console.log(`📦 Publishing ${pkg.name} from ${workspace}`);
	} catch (err) {
		console.error(`❌ Failed to read ${pkgPath}:`, err.message);
		continue;
	}

	// Build publish command with optional tag
	const publishArgs = ["publish", "--filter", `./${workspace}`, "--no-git-checks", "--access", "public"];
	if (tag) {
		publishArgs.push("--tag", tag);
	}

	await $`pnpm ${publishArgs}`;
}
