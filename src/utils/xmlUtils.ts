/**
 * Robust XML-like tag extraction without using Regular Expressions.
 */
export function extractTag(source: string, tagName: string): string | null {
    const startTag = `<${tagName}>`;
    const startIdx = source.toLowerCase().indexOf(startTag.toLowerCase());
    if (startIdx === -1) return null;

    const contentStartIdx = startIdx + startTag.length;
    const endTag = `</${tagName}>`;
    const endIdx = source.toLowerCase().indexOf(endTag.toLowerCase(), contentStartIdx);

    if (endIdx === -1) {
        // No closing tag found? Take everything until the end of the source.
        // This handles LLM "lazy closing" behavior at the end of a block.
        return source.substring(contentStartIdx).trim();
    }

    return source.substring(contentStartIdx, endIdx).trim();
}

/**
 * Finds all occurrences of text between startTag and endTag without regex.
 */
export function findAllBetween(text: string, startTag: string, endTag: string): string[] {
    const results: string[] = [];
    let pos = 0;
    while (true) {
        const startIdx = text.indexOf(startTag, pos);
        if (startIdx === -1) break;
        const endIdx = text.indexOf(endTag, startIdx + startTag.length);
        if (endIdx === -1) break;
        results.push(text.substring(startIdx + startTag.length, endIdx));
        pos = endIdx + endTag.length;
    }
    return results;
}

/**
 * Unescapes common XML entities (&lt;, &gt;, &amp;, &quot;, &apos;).
 */
export function unescapeXml(text: string): string {
    if (!text) return text;
    const entities: Record<string, string> = {
        '&lt;': '<',
        '&gt;': '>',
        '&amp;': '&',
        '&quot;': '"',
        '&apos;': "'"
    };
    return text.replace(/&(lt|gt|amp|quot|apos);/g, (match) => entities[match]);
}
