/**
 * CLI Forge Tool — merges partial cartridge JSON fragments into a single file.
 * Usage: npx tsx src/cartridge/cli-forge.ts -o output.json part1.json part2.json ...
 */

import { readFileSync, writeFileSync } from 'fs';
import { loadCartridge } from './loader.js';

function deepMerge(target: any, source: any) {
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Object && key in target) {
      if (Array.isArray(source[key])) {
        target[key] = [...target[key], ...source[key]];
      } else {
        Object.assign(source[key], deepMerge(target[key], source[key]));
      }
    }
  }
  Object.assign(target, source);
  return target;
}

const args = process.argv.slice(2);
let output = 'forged_cartridge.json';
const files: string[] = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-o' && args[i + 1]) {
    output = args[i + 1];
    i++;
  } else {
    files.push(args[i]);
  }
}

if (files.length === 0) {
  console.error('Usage: npx tsx src/cartridge/cli-forge.ts [-o output.json] fragment1.json fragment2.json ...');
  process.exit(1);
}

try {
  let merged: any = {};

  for (const file of files) {
    const json = JSON.parse(readFileSync(file, 'utf-8'));
    merged = deepMerge(merged, json);
  }

  // Final validation before writing
  const validation = loadCartridge(JSON.stringify(merged));
  if (!validation.success) {
    console.warn('⚠ Merged cartridge failed initial validation:');
    for (const err of validation.errors || []) {
      console.warn(`  • ${err}`);
    }
  }

  writeFileSync(output, JSON.stringify(merged, null, 2));
  console.log(`✓ Forged cartridge saved to: ${output}`);
} catch (err) {
  console.error(`Forge failed: ${(err as Error).message}`);
  process.exit(1);
}
