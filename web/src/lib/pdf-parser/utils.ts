/** matchAll polyfill compatible with TS target ES2015+ without downlevelIteration */
export function matchAll(text: string, re: RegExp): RegExpExecArray[] {
  const results: RegExpExecArray[] = [];
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
  const pattern = new RegExp(re.source, flags);
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    results.push(m);
  }
  return results;
}
