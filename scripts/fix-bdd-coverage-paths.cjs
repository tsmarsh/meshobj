#!/usr/bin/env node
/**
 * Fixes paths in BDD coverage files to match the monorepo structure
 * so they can be merged with vitest coverage files.
 *
 * Transforms:
 *   SF:src/file.ts -> SF:repos/sqlite_repo/src/file.ts
 *   SF:cucumber.js -> SF:repos/sqlite_repo/cucumber.js
 */

const fs = require('fs');
const path = require('path');

// Find all BDD coverage files
const reposDir = path.join(__dirname, '..', 'repos');
const repoDirs = fs.readdirSync(reposDir).filter(name => {
  return fs.statSync(path.join(reposDir, name)).isDirectory();
});

const coverageFiles = repoDirs
  .map(repo => path.join('repos', repo, 'coverage', 'lcov.info'))
  .filter(filePath => fs.existsSync(filePath));

coverageFiles.forEach(filePath => {
  // Extract repo name from path: repos/sqlite_repo/coverage/lcov.info -> sqlite_repo
  const match = filePath.match(/repos\/([^\/]+)\//);
  if (!match) {
    console.warn(`⚠ Could not extract repo name from ${filePath}`);
    return;
  }

  const repoName = match[1];
  const repoPrefix = `repos/${repoName}/`;

  // Read the lcov file
  let content = fs.readFileSync(filePath, 'utf8');

  // Count how many lines we'll transform
  const srcMatches = content.match(/^SF:src\//gm);
  const cucumberMatches = content.match(/^SF:cucumber\.js$/gm);
  const totalMatches = (srcMatches?.length || 0) + (cucumberMatches?.length || 0);

  if (totalMatches === 0) {
    console.log(`✓ ${filePath} - no paths to fix`);
    return;
  }

  // Transform the paths
  content = content.replace(/^SF:src\//gm, `SF:${repoPrefix}src/`);
  content = content.replace(/^SF:cucumber\.js$/gm, `SF:${repoPrefix}cucumber.js`);

  // Write back
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✓ ${filePath} - fixed ${totalMatches} path(s)`);
});

if (coverageFiles.length === 0) {
  console.log('⚠ No BDD coverage files found');
} else {
  console.log(`\n✓ Processed ${coverageFiles.length} BDD coverage file(s)`);
}
