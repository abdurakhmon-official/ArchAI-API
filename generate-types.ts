import * as inputSchemas from './inputs';
import * as modelSchemas from './generated/zod/modelSchema';
import * as outputSchemas from './outputs';
import { zodToTs, printNode, createTypeAlias } from 'zod-to-ts';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync, rmSync } from 'fs';
import { z } from 'zod';

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

async function generateInputTypes() {
  const types: any[] = [];
  for (let key of Object.keys(inputSchemas)) {
    const schema = (inputSchemas as any)[key];

    const name = key.replace('Schema', '');
    const tsType = zodToTs(schema as z.Schema);
    const typeAlias = createTypeAlias(tsType.node, name);
    console.log({ name, tsType, typeAlias });
    console.log('printNode(typeAlias)', printNode(typeAlias));

    types.push({ name, content: `${WARNING}\n\n export ${printNode(typeAlias)}` });
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

    if (!key.includes('WithRelations')) {
      console.log('key: ', key);
      continue;
    }
    const name = key.replace('Schema', '').replace('WithRelations', '');

    console.log('schema', schema);
    const tsType = zodToTs(schema as z.Schema, 'any');
    const typeAlias = createTypeAlias(tsType.node, name);

    types.push({ name, content: `${WARNING}\n\n export ${printNode(typeAlias)}` });
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

    const name = key.replace('Schema', '');
    const tsType = zodToTs(schema as z.Schema);
    const typeAlias = createTypeAlias(tsType.node, name);

    types.push({ name, content: `${WARNING}\n\n export ${printNode(typeAlias)}` });
  }

  await mkdir(`${OUTPUT_DIR_UI}/output`, { recursive: true });

  for (let type of types) {
    console.log('Generated Output:', type.name);
    await writeFile(`${OUTPUT_DIR_UI}/output/${type.name}.ts`, type.content);
  }
}

generateInputTypes();
generateModelsTypes();
generateOutputTypes();

