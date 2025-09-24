#!/bin/bash

# Initial GitHub Packages publish script for @lukso/up-provider
# This script creates the first dev version and publishes it to establish the package in GitHub Packages

set -e  # Exit on any error

echo "🚀 Initial GitHub Packages Publish for @lukso/up-provider"
echo "========================================================"

# Ensure we're in the right directory
if [ ! -f "packages/up-provider/package.json" ]; then
  echo "❌ Error: Must be run from the root of tools-up-provider repository"
  exit 1
fi

# Ensure GitHub CLI is installed and authenticated
if ! command -v gh &> /dev/null; then
  echo "❌ Error: GitHub CLI (gh) is required but not installed"
  echo "Install it from: https://cli.github.com/"
  exit 1
fi

# Check if authenticated and has the right scopes
if ! gh auth status &> /dev/null; then
  echo "❌ Error: Please authenticate with GitHub CLI first:"
  echo "Run: gh auth login --scopes 'write:packages,read:packages'"
  exit 1
fi

# Refresh token with correct scopes
echo "🔐 Refreshing GitHub token with package scopes..."
gh auth refresh --scopes 'write:packages,read:packages'

echo "✅ GitHub CLI authenticated"

# Get current version and create dev version
CURRENT_VERSION=$(node -p "require('./packages/up-provider/package.json').version")
# Remove any existing -test* suffix and create clean dev version  
BASE_VERSION=$(echo "$CURRENT_VERSION" | sed 's/-test[0-9]*$//')
DEV_VERSION="${BASE_VERSION}-dev.$(git rev-parse --short HEAD)"

echo "📦 Current version: $CURRENT_VERSION"
echo "🔧 Base version: $BASE_VERSION"  
echo "🔨 Creating dev version: $DEV_VERSION"

# Update version and swap name for GitHub Packages
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('./packages/up-provider/package.json', 'utf8'));
  pkg.version = '$DEV_VERSION';
  pkg.name = '@lukso-network/up-provider';
  fs.writeFileSync('./packages/up-provider/package.json', JSON.stringify(pkg, null, 2) + '\n');
"

echo "✅ Updated package.json version to $DEV_VERSION and name to @lukso-network/up-provider"

# Setup .npmrc for GitHub Packages
echo "🔐 Configuring npm registry for GitHub Packages"
echo "@lukso-network:registry=https://npm.pkg.github.com" >> .npmrc
echo "//npm.pkg.github.com/:_authToken=$(gh auth token)" >> .npmrc

echo "✅ Registry configuration added to .npmrc"

# Build the package
echo "🛠️  Building package..."
pnpm run build

echo "✅ Package built successfully"

# Publish to GitHub Packages
echo "📤 Publishing to GitHub Packages..."
pnpm --filter @lukso-network/up-provider publish --tag dev --registry https://npm.pkg.github.com --no-git-checks

echo "🎉 Successfully published $DEV_VERSION to GitHub Packages!"
echo ""
echo "Next steps:"
echo "- The @lukso-network/up-provider package is now available in GitHub Packages"
echo "- Future CI runs should work automatically"  
echo "- You can install with: npm install @lukso/up-provider@npm:@lukso-network/up-provider@dev"
echo ""
echo "🧹 Cleaning up..."

# Restore original version and name in package.json
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('./packages/up-provider/package.json', 'utf8'));
  pkg.version = '$CURRENT_VERSION';
  pkg.name = '@lukso/up-provider';
  fs.writeFileSync('./packages/up-provider/package.json', JSON.stringify(pkg, null, 2) + '\n');
"

echo "✅ Restored package.json to original version: $CURRENT_VERSION and name: @lukso/up-provider"
echo "✅ Initial publish complete!"