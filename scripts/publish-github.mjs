#!/usr/bin/env node
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "zx";

// Parse command line arguments
const args = process.argv.slice(2);
const versionArg = args.find(arg => arg.startsWith("--version="))?.split("=")[1];
const tagArg = args.find(arg => arg.startsWith("--tag="))?.split("=")[1];

if (!versionArg || !tagArg) {
	console.error("Usage: publish-github.mjs --version=<version> --tag=<tag>");
	process.exit(1);
}

// Find all package.json files in packages/*
const packagesDir = "packages";
const packageDirs = await readdir(packagesDir, { withFileTypes: true });
const packagePaths = packageDirs
	.filter(dirent => dirent.isDirectory())
	.map(dirent => join(packagesDir, dirent.name, "package.json"));

console.log(`📦 Found ${packagePaths.length} packages to publish`);

// Store original package.json contents for restoration
const originalContents = new Map();

try {
	for (const packagePath of packagePaths) {
		let pkgContent;
		try {
			pkgContent = await readFile(packagePath, "utf-8");
		} catch (err) {
			console.log(`⏭️  Skipping ${packagePath}: no package.json found`);
			continue;
		}

		const pkg = JSON.parse(pkgContent);

		// Only process @lukso/* packages
		if (!pkg.name || !pkg.name.startsWith("@lukso/")) {
			console.log(`⏭️  Skipping non-@lukso package: ${pkg.name || packagePath}`);
			continue;
		}

		// Store original content for restoration
		originalContents.set(packagePath, pkgContent);

		// Update version and name for GitHub Packages
		const originalName = pkg.name;
		pkg.version = versionArg;
		// Convert @lukso/* to @lukso-network/* for GitHub Packages
		pkg.name = originalName.replace("@lukso/", "@lukso-network/");

		console.log(`📝 Publishing ${pkg.name}@${pkg.version} with tag ${tagArg}`);

		// Write updated package.json
		await writeFile(packagePath, JSON.stringify(pkg, null, 2) + "\n");

		// Extract package directory from path
		const packageDir = packagePath.replace("/package.json", "");

		// Publish to GitHub Packages
		await $`pnpm --filter ./${packageDir} publish --tag ${tagArg} --registry https://npm.pkg.github.com --no-git-checks`;

		console.log(`✅ Published ${pkg.name}@${pkg.version}`);
	}
} finally {
	// Restore all original package.json files
	console.log("\n🔄 Restoring original package.json files...");
	for (const [packagePath, originalContent] of originalContents.entries()) {
		await writeFile(packagePath, originalContent);
	}
	console.log("✅ All package.json files restored");
}
