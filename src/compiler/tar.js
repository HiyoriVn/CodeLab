export function untar(data) {
  const files = new Map();
  const dec = new TextDecoder();
  const str = (o, n) => {
    const s = data.subarray(o, o + n);
    const end = s.indexOf(0);
    return dec.decode(end < 0 ? s : s.subarray(0, end));
  };
  const oct = (o, n) => parseInt(str(o, n).trim() || '0', 8);

  let offset = 0;
  let longName;
  while (offset + 512 <= data.length) {
    if (data[offset] === 0) break; // end of archive
    const size = oct(offset + 124, 12);
    const type = String.fromCharCode(data[offset + 156] || 0x30);
    const body = data.subarray(offset + 512, offset + 512 + size);
    let name = str(offset, 100);
    if (str(offset + 257, 6).startsWith('ustar')) {
      const prefix = str(offset + 345, 155);
      if (prefix) name = `${prefix}/${name}`;
    }
    if (longName) {
      name = longName;
      longName = undefined;
    }

    if (type === 'L') {
      longName = dec.decode(body).replace(/\0+$/, '');
    } else if (type === 'x') {
      const m = /\d+ path=([^\n]*)\n/.exec(dec.decode(body));
      if (m) longName = m[1];
    } else if (type === '0' || type === '\0' || type === '7') {
      files.set(name.replace(/^\.\//, ''), body.slice());
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

export async function gunzip(data) {
  if (data[0] !== 0x1f || data[1] !== 0x8b) return data;
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
