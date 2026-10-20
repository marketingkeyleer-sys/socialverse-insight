import ts from 'typescript';
import { readFile } from 'node:fs/promises';

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('npm:@supabase/supabase-js')) {
    return { url: 'data:text/javascript,export const createClient = (...args) => globalThis.testCreateClient(...args)', shortCircuit: true };
  }
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (url.endsWith('.ts')) {
    const source = await readFile(new URL(url), 'utf8');
    return { format: 'module', source: ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
    }).outputText, shortCircuit: true };
  }
  return next(url, context);
}
