# GitHub Packages + Dev Publishing Setup

This guide shows how to add GitHub Packages registry and dev version publishing to an existing release-please workflow.

## 🎯 Goal
- **Dev versions**: Publish `0.1.0-dev.abc123` on every commit to main with `@dev` tag
- **Stable releases**: Publish semantic versions with `@latest` tag when release-please creates releases
- **Dual registry**: Publish to both GitHub Packages (for org use) and npm (for public)

## 📦 Step 1: Update package.json

Add GitHub Packages configuration to each package's `package.json`:

```json
{
  "name": "@your-org/package-name",
  "publishConfig": {
    "@your-org:registry": "https://npm.pkg.github.com"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/your-org/repo-name.git"
  }
}
```

## 🔧 Step 2: Enhance Existing CI Workflow

Add this job to your existing CI workflow (after build/test jobs):

```yaml
  publish-dev-packages:
    needs: [build] # Replace with your actual job names
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        # List all packages in your monorepo
        package: [package-1, package-2, etc]
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Need full history for git rev-parse

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9 # Use your pnpm version

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20 # Use your node version
          cache: pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Build packages
        run: pnpm build # Use your build command

      - name: Create dev version
        working-directory: packages/${{ matrix.package }}
        run: |
          # Get current version and create dev version
          CURRENT_VERSION=$(node -p "require('./package.json').version")
          DEV_VERSION="${CURRENT_VERSION}-dev.$(git rev-parse --short HEAD)"
          npm version $DEV_VERSION --no-git-tag-version

      - name: Publish dev version to GitHub Packages
        working-directory: packages/${{ matrix.package }}
        run: |
          echo "@your-org:registry=https://npm.pkg.github.com" >> .npmrc
          echo "//npm.pkg.github.com/:_authToken=${{ secrets.GITHUB_TOKEN }}" >> .npmrc
          npm publish --tag dev --registry https://npm.pkg.github.com
```

## 🚀 Step 3: Enhance Existing Release Workflow

Add GitHub Packages publishing to your release-please workflow:

```yaml
  publish-packages:
    needs: release-please
    if: ${{ needs.release-please.outputs.releases_created }}
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: [package-1, package-2, etc]
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Build package
        run: pnpm --filter=${{ matrix.package }} build

      # Publish to GitHub Packages
      - name: Publish to GitHub Packages
        working-directory: packages/${{ matrix.package }}
        run: |
          echo "@your-org:registry=https://npm.pkg.github.com" >> .npmrc
          echo "//npm.pkg.github.com/:_authToken=${{ secrets.GITHUB_TOKEN }}" >> .npmrc
          npm publish --registry https://npm.pkg.github.com

      # Optionally also publish to npm
      - name: Publish to npm
        working-directory: packages/${{ matrix.package }}
        run: npm publish --registry https://registry.npmjs.org
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## 📋 Step 4: Consumer Project Setup

Projects consuming these packages need `.npmrc`:

```bash
@your-org:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

And in `package.json`:

```json
{
  "dependencies": {
    "@your-org/package-name": "0.1.0-dev",  // Latest development
    "@your-org/package-name": "^0.1.0"      // Latest stable release
  }
}
```

## 🔑 Key Points

1. **No conflicts**: GitHub Packages and npm are separate registries
2. **Private by default**: Private repos = private packages automatically
3. **Org access**: All repos in org can access private packages
4. **Dev workflow**: `@dev` tag for latest development versions
5. **Release workflow**: `@latest` tag for stable semantic versions
6. **GITHUB_TOKEN**: Automatically available in Actions, no setup needed

## 🎯 What You Get

- Every main branch commit → `0.1.0-dev.abc123@dev`
- Every release-please release → `0.1.0@latest`
- Both published to GitHub Packages (+ optionally npm)
- Perfect for cross-repo development in orgs!