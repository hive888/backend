// services/saftOverlayService.js
const fs = require('fs/promises');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

exports.overlayFields = async ({
  investorName = '',
  nationality = '',
  dateOfBirth = '',
  placeOfBirth = '',
  investorAddress = '',
  investorEmail = '',
  quantity = '',
  unit_price = '',
  token_price = '',
}) => {
  const masterPath = path.join(process.cwd(), 'assets', 'SAFTagree3.pdf');
  const masterBytes = await fs.readFile(masterPath);
  const pdfDoc = await PDFDocument.load(masterBytes);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // ----- PAGE 1: Investor Information -----
  const page1 = pdfDoc.getPage(0);
  const { width: width1, height: height1 } = page1.getSize();

  // Layout config for page 1
  const startX1 = 35;
  const startY1 = height1 - 260;
  const maxWidth1 = width1 - (startX1 + 40);
  const size1 = 10.5;
  const color1 = rgb(0.10, 0.10, 0.10);
  const lineGap1 = 4;
  const lineHeight1 = size1 + lineGap1;
const tokenColor = rgb(21/255, 56/255, 96/255);
  // Word-wrapping/typesetting helper
  function drawRuns(page, runs, x, y, maxWidth, size, font, fontBold, color, lineHeight) {
    let cx = x;
    let cy = y;
    const spaceW = font.widthOfTextAtSize(' ', size);

    const widthOf = (txt, fnt) => fnt.widthOfTextAtSize(txt, size);

    const tokenize = (txt) => {
      return txt.split(/(\s+)/).filter(t => t.length > 0);
    };

    for (const run of runs) {
      const tokens = tokenize(run.text);
      for (const tk of tokens) {
        const isSpace = /^\s+$/.test(tk);
        const tkFont = run.bold ? fontBold : run.font || font;
        const tkWidth = isSpace ? spaceW : widthOf(tk, tkFont);

        if (!isSpace && cx + tkWidth > x + maxWidth) {
          cx = x;
          cy -= lineHeight;
        }

        if (isSpace) {
          if (cx !== x) cx += spaceW;
        } else {
          page.drawText(tk, { x: cx, y: cy, size, font: tkFont, color });
          cx += tkWidth;
        }
      }
    }
    return { x: cx, y: cy };
  }

  // Build the paragraph for page 1
  const runs1 = [];

  if (investorName) runs1.push({ text: investorName, bold: true ,color: tokenColor});
  if (nationality) {
    if (runs1.length) runs1.push({ text: ', ' });
    runs1.push({ text: nationality, bold: true });
  }

  if (dateOfBirth || placeOfBirth) {
    if (runs1.length) runs1.push({ text: ', ' });
    runs1.push({ text: 'born on ' });
    if (dateOfBirth) runs1.push({ text: dateOfBirth, bold: true,color: tokenColor });
    if (placeOfBirth) {
      runs1.push({ text: ' in ' });
      runs1.push({ text: placeOfBirth, bold: true });
    }
  }

  if (investorAddress) {
    runs1.push({ text: ', currently residing at ' });
    runs1.push({ text: investorAddress, bold: true,color: tokenColor });
  }

  runs1.push({ text: '. Email: ' });
  if (investorEmail) runs1.push({ text: investorEmail, bold: true,color: tokenColor });
  runs1.push({ text: ' (hereinafter referred to as the ' });
  runs1.push({ text: 'Investor', bold: true,color: tokenColor });
  runs1.push({ text: ')' });

  // Draw on page 1
  drawRuns(page1, runs1, startX1, startY1, maxWidth1, size1, font, fontBold, color1, lineHeight1,tokenColor);

  // ----- PAGE 2: Token Information -----
  if (pdfDoc.getPageCount() > 1) {
    const page2 = pdfDoc.getPage(1);
    const { width: width2, height: height2 } = page2.getSize();

    // Configuration for page 2 - adjust these coordinates based on your PDF layout
    const tokenInfoX = 100;
    const tokenInfoY = height2 - 400; // Adjust this based on where you want to place the token info
    const tokenSize = 11;
    const tokenColor = rgb(21/255, 56/255, 96/255);

    // Draw quantity
    if (quantity) {
      page2.drawText(`${quantity} `, {
        x: 232,
        y: height2 - 133.5,
        size: tokenSize,
        font: fontBold,
        color: tokenColor
      });
    }
    // Draw unit price
if (unit_price) {
  const adjustedUnitPrice = parseFloat(token_price) * 10;
  page2.drawText(`${adjustedUnitPrice.toFixed(2)}`, {
    x: 210,
    y: height2 - 103.5,
    size: tokenSize,
    font: fontBold,
    color: tokenColor
  });
}

    // Draw token price
    if (token_price) {
      page2.drawText(`${parseFloat(token_price).toFixed(3)} `, {
        x: 278,
        y: height2 - 103.5,
        size: tokenSize,
        font: fontBold,
        color: tokenColor
      });
    }
  }
if (pdfDoc.getPageCount() > 6) {
  const page7 = pdfDoc.getPage(6); // Page index starts at 0, so page 7 is index 6
  const { width: width7, height: height7 } = page7.getSize();
  
  // Configuration for page 7 - adjust these coordinates based on your PDF layout
  const signatureSize = 10;
  const signatureColor = rgb(21/255, 56/255, 96/255);
  
  // Draw investor name on signature line
  if (investorName) {
    page7.drawText(investorName, {
      x: 375, // Adjust this X coordinate based on your PDF
      y: height7 - 368, // Adjust this Y coordinate based on your PDF
      size: signatureSize,
      font: fontBold,
      color: signatureColor
    });
        page7.drawText("PTGR AG", {
      x: 125, // Adjust this X coordinate based on your PDF
      y: height7 - 368, // Adjust this Y coordinate based on your PDF
      size: signatureSize,
      font: fontBold,
      color: signatureColor
    });
  }
  
  // Draw investor email on signature line
  if (investorEmail) {
    page7.drawText(investorEmail, {
      x: 375, // Adjust this X coordinate based on your PDF
      y: height7 - 388, // Adjust this Y coordinate based on your PDF
      size: signatureSize,
      font: fontBold,
      color: signatureColor
    });
        page7.drawText("info@ptgr.ch", {
      x: 125, // Adjust this X coordinate based on your PDF
      y: height7 - 388, // Adjust this Y coordinate based on your PDF
      size: signatureSize,
      font: fontBold,
      color: signatureColor
    });
  }
  
  // Draw current date on signature line (using today's date if not provided)
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  page7.drawText(currentDate, {
    x: 375, // Adjust this X coordinate based on your PDF
    y: height7 - 415, // Adjust this Y coordinate based on your PDF
    size: signatureSize,
    font: fontBold,
    color: signatureColor
  });
    page7.drawText(currentDate, {
    x: 125, // Adjust this X coordinate based on your PDF
    y: height7 - 415, // Adjust this Y coordinate based on your PDF
    size: signatureSize,
    font: fontBold,
    color: signatureColor
  });
}
  const out = await pdfDoc.save();
  return Buffer.from(out);
};

exports.certificate = async (investorName = '') => {
  const masterPath = path.join(process.cwd(), 'assets', 'Completion.pdf');
  const masterBytes = await fs.readFile(masterPath);
  const pdfDoc = await PDFDocument.load(masterBytes);
  pdfDoc.registerFontkit(fontkit);

  const fontPath = path.join(process.cwd(), 'assets', 'font', 'Italianno-Regular.ttf');
  const scriptBytes = await fs.readFile(fontPath);
  const scriptFont = await pdfDoc.embedFont(scriptBytes); // embed full font

  const page = pdfDoc.getPage(0);
  const { width, height } = page.getSize();

  const nameY = height - 238;
  const maxNameWidth = 700;
  let size = 65;
  const color = rgb(0.15, 0.15, 0.15);

  if (investorName && investorName.trim()) {
    let w = scriptFont.widthOfTextAtSize(investorName, size);
    if (w > maxNameWidth) {
      size = Math.max(28, Math.floor((maxNameWidth / w) * size));
      w = scriptFont.widthOfTextAtSize(investorName, size);
    }
    const x = (width - w) / 2;
    page.drawText(investorName, { x, y: nameY, size, font: scriptFont, color });
  }

  const out = await pdfDoc.save();
  return Buffer.from(out);
};

