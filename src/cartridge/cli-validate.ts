/**
 * CLI Cartridge Validator — validates a cartridge JSON file from the command line.
 * Usage: npx tsx src/cartridge/cli-validate.ts path/to/cartridge.json
 */

import { readFileSync } from 'fs';
import { loadCartridge } from './loader.js';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: npx tsx src/cartridge/cli-validate.ts <cartridge.json>');
  process.exit(1);
}

try {
  const json = readFileSync(filePath, 'utf-8');
  const result = loadCartridge(json);

  if (result.success) {
    const c = result.cartridge!;
    console.log(`✓ Valid cartridge: "${c.meta.title}"`);
    console.log(`  Components: ${Object.keys(c.components).length}`);
    console.log(`  Blueprints: ${Object.keys(c.blueprints).length}`);
    console.log(`  Systems:    ${Object.keys(c.systems).length}`);
    console.log(`  Map:        ${c.world_gen.width}x${c.world_gen.height} (${c.world_gen.algorithm})`);
  } else {
    console.error(`✗ Validation failed (${result.errors!.length} errors):`);
    for (const err of result.errors!) {
      console.error(`  • ${err}`);
    }
    process.exit(1);
  }
} catch (err) {
  console.error(`Failed to read file: ${(err as Error).message}`);
  process.exit(1);
}
