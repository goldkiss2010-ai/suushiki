// Serialize the structured source, never the drawing's placeholder or SVG labels.
export function paragraphSource(source) {
  return source.map(item => item.type === 'text' ? item.text : `\\(${item.tex ?? ''}\\)`).join('');
}
