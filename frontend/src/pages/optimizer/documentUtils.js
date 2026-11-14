/** Small helpers for the structured resume document ({ sections: [{ id, key, title, items: [{ id, text, bullet }] }] }). */

export const itemsById = (doc) => {
  const map = {};
  (doc?.sections || []).forEach((section) => section.items.forEach((item) => { map[item.id] = item; }));
  return map;
};

/** Returns a copy of the document with one line's text replaced. The input is never mutated. */
export const withItemText = (doc, itemId, text) => ({
  ...doc,
  sections: doc.sections.map((section) => ({
    ...section,
    items: section.items.map((item) => (item.id === itemId ? { ...item, text } : item)),
  })),
});

export const sameDocument = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export const sectionHeading = (section) => section.title || (section.key === 'header' ? 'Contact details' : section.key);
