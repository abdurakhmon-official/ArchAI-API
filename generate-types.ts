import * as inputSchemas from './inputs';
import * as modelSchemas from './generated/zod/modelSchema';
import * as outputSchemas from './outputs';
import { zodToTs, printNode, createTypeAlias } from 'zod-to-ts';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync, readdirSync, readFileSync, rmSync } from 'fs';
import { z } from 'zod';

const TREE_IMPORT = "import type { TreeNode } from '@/lib/geometry/types';";

const WARNING = '// WARNING: Do not change this file manually. Use yarn generate:types from the api project to update it';
const OUTPUT_DIR_UI = '../ui/types';

if (existsSync(`${OUTPUT_DIR_UI}/input`)) {
  rmSync(`${OUTPUT_DIR_UI}/input`, { recursive: true });
}
if (existsSync(`${OUTPUT_DIR_UI}/models`)) {
  rmSync(`${OUTPUT_DIR_UI}/models`, { recursive: true });
}
if (existsSync(`${OUTPUT_DIR_UI}/output`)) {
  rmSync(`${OUTPUT_DIR_UI}/output`, { recursive: true });
}

function isSchema(value: unknown): value is z.Schema {
  return value instanceof z.ZodType;
}

function assertSingleRecursiveSchema(): void {
  const files = [
    ...readdirSync('inputs').map((name) => `inputs/${name}`),
    ...readdirSync('outputs').map((name) => `outputs/${name}`),
  ].filter((path) => path.endsWith('.ts'));

  const found = files.filter((path) => readFileSync(path, 'utf8').includes('z.lazy('));

  if (found.length > 1) {
    throw new Error(
      `generate-types: ${found.length} ta rekursiv sxema topildi (${found.join(', ')}). ` +
        "`Identifier` o'rinbosarini `TreeNode` ga almashtirish endi noto'g'ri — " +
        'update resolveRecursive().',
    );
  }
}

function resolveRecursive(name: string, content: string): string {
  if (!content.includes('Identifier')) return content;

  const resolved = content.replace(/\bIdentifier\b/g, 'TreeNode');

  if (name === 'TreeNode') {
    return `${WARNING}\n\nexport type { TreeNode } from '@/lib/geometry/types';\n`;
  }

  return resolved.replace(WARNING, `${WARNING}\n\n${TREE_IMPORT}`);
}

async function generateInputTypes() {
  const types: any[] = [];
  for (let key of Object.keys(inputSchemas)) {
    const schema = (inputSchemas as any)[key];
    if (!isSchema(schema) || !key.endsWith('Schema')) continue;

    const name = key.replace('Schema', '');
    const tsType = zodToTs(schema);
    const typeAlias = createTypeAlias(tsType.node, name);

    types.push({
      name,
      content: resolveRecursive(name, `${WARNING}\n\n export ${printNode(typeAlias)}`),
    });
  }

  await mkdir(`${OUTPUT_DIR_UI}/input`, { recursive: true });

  for (let type of types) {
    console.log('Generated Input:', type.name);
    await writeFile(`${OUTPUT_DIR_UI}/input/${type.name}.ts`, type.content);
  }
}

async function generateModelsTypes() {
  const types: any[] = [];
  for (let key of Object.keys(modelSchemas)) {
    const schema = (modelSchemas as any)[key];
    if (!isSchema(schema) || !key.includes('WithRelations')) continue;
    const name = key.replace('Schema', '').replace('WithRelations', '');

    const tsType = zodToTs(schema, 'any');
    const typeAlias = createTypeAlias(tsType.node, name);

    types.push({
      name,
      content: resolveRecursive(name, `${WARNING}\n\n export ${printNode(typeAlias)}`),
    });
  }

  await mkdir(`${OUTPUT_DIR_UI}/models`, { recursive: true });

  for (let type of types) {
    console.log('Generated Model:', type.name);
    await writeFile(`${OUTPUT_DIR_UI}/models/${type.name}.ts`, type.content);
  }
}

async function generateOutputTypes() {
  const types: any[] = [];
  for (let key of Object.keys(outputSchemas)) {
    const schema = (outputSchemas as any)[key];
    if (!isSchema(schema) || !key.endsWith('Schema')) continue;

    const name = key.replace('Schema', '');
    const tsType = zodToTs(schema);
    const typeAlias = createTypeAlias(tsType.node, name);

    types.push({
      name,
      content: resolveRecursive(name, `${WARNING}\n\n export ${printNode(typeAlias)}`),
    });
  }

  await mkdir(`${OUTPUT_DIR_UI}/output`, { recursive: true });

  for (let type of types) {
    console.log('Generated Output:', type.name);
    await writeFile(`${OUTPUT_DIR_UI}/output/${type.name}.ts`, type.content);
  }
}

assertSingleRecursiveSchema();

generateInputTypes();
generateModelsTypes();
generateOutputTypes();

