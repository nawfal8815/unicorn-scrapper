const {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  BorderStyle, ExternalHyperlink, UnderlineType,
  Table, TableRow, TableCell, WidthType, ShadingType
} = require('docx');

const BLUE = '1F4E96';
const DARK = '1A1A1A';
const GREY = '444444';
const FONT = 'Calibri';

const NO_BORDERS = {
  top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
  insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }
};

function run(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: opts.size || 19, color: opts.color || DARK, bold: !!opts.bold, italics: !!opts.italics });
}

function link(text, url) {
  return new ExternalHyperlink({
    link: url,
    children: [new TextRun({ text, font: FONT, size: 18, color: '1155CC', underline: { type: UnderlineType.SINGLE } })]
  });
}

function sectionHeading(text) {
  return new Paragraph({
    spacing: { before: 260, after: 90 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE, space: 2 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, font: FONT, size: 21, color: BLUE, characterSpacing: 10 })]
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 40 },
    children: [run(text)]
  });
}

function plain(text, opts = {}) {
  return new Paragraph({ spacing: { after: opts.after ?? 60 }, children: [run(text, opts)] });
}

function twoColRow(leftChildren, rightText) {
  return new Table({
    width: { size: 10940, type: WidthType.DXA },
    columnWidths: [7100, 3840],
    borders: NO_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 7100, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' },
            children: [new Paragraph({ spacing: { after: 0 }, children: leftChildren })]
          }),
          new TableCell({
            width: { size: 3840, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' },
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { after: 0 },
              children: [new TextRun({ text: rightText, font: FONT, size: 18, color: GREY })]
            })]
          })
        ]
      })
    ]
  });
}

function renderEntry(entry) {
  const out = [];
  const titleRuns = [run(entry.title, { bold: true })];

  if (entry.dateRange) {
    const meta = [entry.dateRange, entry.location].filter(Boolean).join(' | ');
    out.push(twoColRow(titleRuns, meta));
  } else {
    out.push(new Paragraph({ spacing: { after: entry.metaLine ? 20 : 60 }, children: titleRuns }));
  }

  if (entry.metaLine) {
    out.push(new Paragraph({ spacing: { after: 80 }, children: [run(entry.metaLine, { italics: true, color: GREY, size: 18 })] }));
  }

  if (entry.description) {
    out.push(plain(entry.description));
  }

  for (const b of entry.bullets || []) {
    out.push(bullet(b));
  }

  const footers = Array.isArray(entry.footer) ? entry.footer : (entry.footer ? [entry.footer] : []);
  footers.forEach((f, i) => {
    out.push(new Paragraph({ spacing: { after: i === footers.length - 1 ? 140 : 40 }, children: [run(f, { size: 18, color: GREY })] }));
  });

  if (!entry.dateRange && !entry.metaLine && footers.length === 0) {
    out.push(new Paragraph({ spacing: { after: 140 }, children: [] }));
  }

  return out;
}

function renderSection(section) {
  const out = [sectionHeading(section.heading)];

  switch (section.type) {
    case 'paragraph':
      out.push(plain(section.text));
      break;

    case 'notice': {
      out.push(new Table({
        width: { size: 10940, type: WidthType.DXA },
        columnWidths: [10940],
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
          insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }
        },
        rows: [new TableRow({
          children: [new TableCell({
            width: { size: 10940, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: 'F5F5F5' },
            children: [new Paragraph({ spacing: { before: 60, after: 60 }, children: [run(section.text, { italics: true, size: 18 })] })]
          })]
        })]
      }));
      out.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
      break;
    }

    case 'entryList':
      section.entries.forEach(entry => out.push(...renderEntry(entry)));
      break;

    case 'twoColumnBulletList': {
      const [colA, colB] = section.columns;
      out.push(new Table({
        width: { size: 10940, type: WidthType.DXA },
        columnWidths: [5470, 5470],
        borders: NO_BORDERS,
        rows: [new TableRow({
          children: [colA, colB].map(col => new TableCell({
            width: { size: 5470, type: WidthType.DXA },
            children: [
              new Paragraph({ spacing: { after: 60 }, children: [run(col.title, { bold: true, size: 18, color: BLUE })] }),
              ...col.items.map(item => bullet(item))
            ]
          }))
        })]
      }));
      break;
    }

    case 'skillsGrid': {
      const groups = section.groups;
      for (let i = 0; i < groups.length; i += 2) {
        const left = groups[i];
        const rightVal = groups[i + 1];
        if (rightVal) {
          out.push(new Table({
            width: { size: 10940, type: WidthType.DXA },
            columnWidths: [5470, 5470],
            borders: NO_BORDERS,
            rows: [new TableRow({
              children: [left, rightVal].map(g => new TableCell({
                width: { size: 5470, type: WidthType.DXA },
                children: [new Paragraph({
                  spacing: { after: 120 },
                  children: [run(`${g.label}: `, { bold: true }), run(g.items.join(', '))]
                })]
              }))
            })]
          }));
        } else {
          out.push(new Paragraph({
            spacing: { after: 120 },
            children: [run(`${left.label}: `, { bold: true }), run(left.items.join(', '))]
          }));
        }
      }
      break;
    }

    case 'simpleList':
      if (section.inline) {
        out.push(plain(section.items.join(', ')));
      } else {
        section.items.forEach(item => out.push(bullet(item)));
      }
      break;

    case 'languageList':
      out.push(new Paragraph({
        spacing: { after: 40 },
        children: section.items.flatMap((l, i) => [
          run(`${l.language}: `, { bold: true }),
          run(l.level + (i < section.items.length - 1 ? '    ' : ''))
        ])
      }));
      break;

    default:
      throw new Error(`Unknown section type: ${section.type}`);
  }

  return out;
}

function buildDocument(cv) {
  const header = [
    new Paragraph({
      spacing: { after: 40 },
      children: [
        run(cv.name + '  ', { bold: true, size: 40 }),
        run(cv.titleLine, { color: GREY, italics: true, size: 24 })
      ]
    }),
    new Paragraph({
      spacing: { after: 160 },
      children: [
        run(cv.contact.email, { size: 18, color: GREY }),
        run('  ·  ', { size: 18, color: GREY }),
        run(cv.contact.phone, { size: 18, color: GREY }),
        run('  ·  ', { size: 18, color: GREY }),
        run(cv.contact.location, { size: 18, color: GREY }),
        ...cv.contact.links.flatMap(l => [run('  ·  ', { size: 18, color: GREY }), link(l.label, l.url)])
      ]
    })
  ];

  const body = cv.sections.flatMap(renderSection);

  return new Document({
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{
          level: 0, format: 'bullet', text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 260, hanging: 200 } } }
        }]
      }]
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 620, bottom: 620, left: 650, right: 650 }
        }
      },
      children: [...header, ...body]
    }]
  });
}

async function renderCvToDocxBuffer(cv) {
  return Packer.toBuffer(buildDocument(cv));
}

module.exports = { renderCvToDocxBuffer };
