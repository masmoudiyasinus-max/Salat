import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('.md') || specifier.includes('.md?raw') || specifier.includes('?raw')) {
    const parentURL = context.parentURL || 'file:///' + process.cwd().replace(/\\/g, '/') + '/';
    const resolvedUrl = new URL(specifier, parentURL).href;
    return {
      format: 'module',
      shortCircuit: true,
      url: resolvedUrl,
    };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.includes('?raw') || url.endsWith('.md') || url.includes('.md?raw')) {
    const cleanUrl = url.split('?')[0];
    const filePath = fileURLToPath(cleanUrl);
    const content = await readFile(filePath, 'utf8');
    return {
      format: 'module',
      shortCircuit: true,
      source: `export default ${JSON.stringify(content)};`,
    };
  }
  return nextLoad(url, context);
}
