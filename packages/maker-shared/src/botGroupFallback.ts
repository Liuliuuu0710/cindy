/** Escape a collapsed plain-text summary for a Markdown card fallback.
 * Decimal entities survive the shared math preprocessing without becoming delimiters.
 * Callers keep their structural prefix outside this function. Truncate encoded tokens
 * atomically so the card's serialized budget cannot expose a partial entity/surrogate.
 */
export function botGroupFallbackText(text: string, maxLength: number): string {
  const tokens = Array.from(text.replace(/\s+/g, ' ').trim(), character =>
    /[\\`*_{}[\]<>!|~&$]/.test(character) ? `&#${character.codePointAt(0)};` : character);
  if (tokens.reduce((length, token) => length + token.length, 0) <= maxLength) return tokens.join('');
  let result = '';
  for (const token of tokens) {
    if (result.length + token.length > maxLength - 1) break;
    result += token;
  }
  return result + '…';
}
