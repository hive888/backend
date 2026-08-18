const db = require('../config/database');

function cleanHtml(html) {
  if (!html) return html;

  let cleaned = html.trim();

  // 1. Remove the outer prose div if present
  if (cleaned.startsWith('<div class="prose prose-lg max-w-none space-y-4">') && cleaned.endsWith('</div>')) {
    cleaned = cleaned.substring('<div class="prose prose-lg max-w-none space-y-4">'.length, cleaned.length - 6).trim();
  }

  // 2. Convert Google Docs spans with bold, italic, or underline styles into semantic HTML tags
  let previous;
  do {
    previous = cleaned;
    
    // Bold spans
    cleaned = cleaned.replace(/<span[^>]*style="[^"]*font-weight:\s*(?:700|bold)[^"]*"[^>]*>(.*?)<\/span>/gi, '<strong>$1</strong>');
    
    // Italic spans
    cleaned = cleaned.replace(/<span[^>]*style="[^"]*font-style:\s*italic[^"]*"[^>]*>(.*?)<\/span>/gi, '<em>$1</em>');
    
    // Underline spans
    cleaned = cleaned.replace(/<span[^>]*style="[^"]*text-decoration:\s*underline[^"]*"[^>]*>(.*?)<\/span>/gi, '<u>$1</u>');
  } while (cleaned !== previous);

  // 3. Remove all other span tags completely, leaving only their inner text
  cleaned = cleaned.replace(/<span[^>]*>/gi, '');
  cleaned = cleaned.replace(/<\/span>/gi, '');

  // 4. Remove Google Docs internal guid wrappers
  cleaned = cleaned.replace(/<span id="docs-internal-guid-[a-f0-9-]+">/gi, '');

  // 5. Clean up other tags style attributes (filter out fonts, sizes, colors, line-heights, background-colors)
  cleaned = cleaned.replace(/style="([^"]*)"/gi, (match, styleContent) => {
    const cleanStyles = styleContent.replace(/&quot;/g, '"');
    const decls = cleanStyles.split(';');
    const keptDecls = decls.filter(decl => {
      const d = decl.trim().toLowerCase();
      if (!d) return false;
      if (d.startsWith('color:') && (d.includes('rgb(0, 0, 0)') || d.includes('#000000') || d.includes('#000'))) return false;
      if (d.startsWith('background-color:') && (d.includes('rgb(255, 255, 255)') || d.includes('#ffffff') || d.includes('transparent'))) return false;
      if (d.startsWith('font-family:')) return false;
      if (d.startsWith('font-size:') && (d.includes('11pt') || d.includes('10pt') || d.includes('12pt'))) return false;
      if (d.startsWith('line-height:') && (d.includes('1.2') || d.includes('1.15') || d.includes('1.3'))) return false;
      if (d.startsWith('margin-top:') && d.includes('0pt')) return false;
      if (d.startsWith('margin-bottom:') && d.includes('0pt')) return false;
      return true;
    });
    if (keptDecls.length === 0) {
      return '';
    }
    return `style="${keptDecls.join('; ').trim()}"`;
  });

  // 6. Clean up empty paragraphs, nested double line breaks, and whitespace
  cleaned = cleaned.replace(/(?:<p[^>]*>\s*<br\s*\/?>\s*<\/p>)+/gi, '<br />');
  cleaned = cleaned.replace(/(?:<br\s*\/?>\s*)+/gi, '<br />');
  
  // Strip leading and trailing line breaks
  cleaned = cleaned.replace(/^\s*(?:<br\s*\/?>|\s)+/gi, '');
  cleaned = cleaned.replace(/(?:<br\s*\/?>|\s)+\s*$/gi, '');

  // 7. Clean up empty bold, italic, or paragraph tags
  cleaned = cleaned.replace(/<p[^>]*>\s*<\/p>/gi, '');
  cleaned = cleaned.replace(/<strong>\s*<\/strong>/gi, '');
  cleaned = cleaned.replace(/<em>\s*<\/em>/gi, '');
  cleaned = cleaned.replace(/<u>\s*<\/u>/gi, '');

  // 8. Normalize multiple newlines/carriage returns
  cleaned = cleaned.replace(/[\r\n]{3,}/g, '\n\n');

  return cleaned.trim();
}

async function migrate() {
  try {
    const [subsections] = await db.query('SELECT id, title, content_html FROM subsections');
    console.log(`Starting migration for ${subsections.length} subsections...`);

    let updatedCount = 0;
    for (const sub of subsections) {
      const original = sub.content_html;
      const cleaned = cleanHtml(original);
      
      if (original !== cleaned) {
        await db.query('UPDATE subsections SET content_html = ? WHERE id = ?', [cleaned, sub.id]);
        updatedCount++;
        console.log(`[UPDATED] ID: ${sub.id} - "${sub.title}"`);
      } else {
        console.log(`[NO CHANGE] ID: ${sub.id} - "${sub.title}"`);
      }
    }

    console.log(`Migration complete! Updated ${updatedCount} subsections.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
