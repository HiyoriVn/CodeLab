import { Directory, File } from '@bjorn3/browser_wasi_shim';

const split = (path) => path.split('/').filter((p) => p && p !== '.');

export class Vfs {
  constructor(files = new Map(), dirs = ['src', 'build', 'tmp']) {
    const tree = {};
    for (const d of dirs) tree[d] = {};
    for (const [path, data] of files) {
      const parts = split(path);
      let node = tree;
      for (const p of parts.slice(0, -1)) node = (node[p] ??= {});
      node[parts[parts.length - 1]] = data;
    }
    const toInodes = (node) =>
      new Map(
        Object.entries(node).map(([name, v]) => [
          name,
          v instanceof Uint8Array ? new File(v, { readonly: true }) : new Directory(toInodes(v)),
        ])
      );
    this.root = toInodes(tree);
  }

  dir(parts, create) {
    let contents = this.root;
    let dir;
    for (const p of parts) {
      let next = contents.get(p);
      if (!next && create) {
        next = new Directory(new Map());
        contents.set(p, next);
      }
      if (!(next instanceof Directory)) return undefined;
      dir = next;
      contents = next.contents;
    }
    return dir;
  }

  writeFile(path, data) {
    const parts = split(path);
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const parent = parts.length > 1 ? this.dir(parts.slice(0, -1), true).contents : this.root;
    parent.set(parts[parts.length - 1], new File(bytes));
  }

  readFile(path) {
    const parts = split(path);
    const parent = parts.length > 1 ? this.dir(parts.slice(0, -1), false)?.contents : this.root;
    const entry = parent?.get(parts[parts.length - 1]);
    return entry instanceof File ? entry.data : undefined;
  }

  readText(path) {
    const data = this.readFile(path);
    return data ? new TextDecoder().decode(data) : undefined;
  }

  resetDir(name) {
    this.root.set(name, new Directory(new Map()));
  }
}
