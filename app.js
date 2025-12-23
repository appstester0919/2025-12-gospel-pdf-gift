/**
 * PDF 名字疊加工具 - 核心邏輯
 * 使用 pdf-lib 和 fontkit 處理 PDF 與自訂字體
 */

// DOM Elements
const form = document.getElementById('pdfForm');
const nameInput = document.getElementById('nameInput');
const charCount = document.getElementById('charCount');
const generateBtn = document.getElementById('generateBtn');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');

// Configuration
const CONFIG = {
  fontPath: 'ChenYuluoyan-Thin-Monospaced.ttf',
  fontSize: 120,
  textColor: { r: 1, g: 0.98, b: 0.94 }, // Off-white/cream color
  lineHeight: 1.4,
  // Text position (top-left area, matching sample)
  textX: 50,
  textY: null, // Will be calculated based on page height
  topMargin: 180,
};

// Text template
const TEXT_TEMPLATE = {
  line1Suffix: '，你知道',
  line2: '神眼中你',
  line3: '很特別嗎？',
};

// Cache for font data
let cachedFontBytes = null;

/**
 * Break text into lines based on actual rendered width
 * @param {string} text - The full text to break
 * @param {object} font - The PDF font object
 * @param {number} fontSize - Font size in points
 * @param {number} maxWidth - Maximum width per line in PDF units
 * @returns {string[]} Array of text lines
 */
function breakTextIntoLines(text, font, fontSize, maxWidth) {
  const lines = [];
  let currentLine = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const testLine = currentLine + char;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth > maxWidth && currentLine.length > 0) {
      // Current line is full, push it and start new line
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }

  // Don't forget the last line
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  console.log('[Line Breaking] Input:', text);
  console.log('[Line Breaking] Max width:', maxWidth);
  console.log('[Line Breaking] Output lines:', lines);

  return lines;
}

/**
 * Initialize the application
 */
function init() {
  // Character count update
  nameInput.addEventListener('input', () => {
    charCount.textContent = nameInput.value.length;
  });

  // Form submission
  form.addEventListener('submit', handleSubmit);
}

/**
 * Handle form submission
 */
async function handleSubmit(e) {
  e.preventDefault();

  const name = nameInput.value.trim();

  // Validation
  if (!name) {
    showError('請輸入名字');
    return;
  }

  // Generate PDF
  try {
    showLoading(true);
    hideError();
    generateBtn.disabled = true;

    await generatePDF(name);

  } catch (error) {
    console.error('PDF generation failed:', error);
    showError('產生 PDF 時發生錯誤：' + error.message);
  } finally {
    showLoading(false);
    generateBtn.disabled = false;
  }
}

/**
 * Generate personalized PDF
 */
async function generatePDF(name) {
  const { PDFDocument, rgb } = PDFLib;

  // 1. Load the PDF template
  const pdfPath = 'Cat.pdf';
  const pdfResponse = await fetch(pdfPath);
  if (!pdfResponse.ok) {
    throw new Error(`無法載入 PDF 模板: ${pdfPath}`);
  }
  const pdfBytes = await pdfResponse.arrayBuffer();

  // 2. Load custom font (with caching)
  if (!cachedFontBytes) {
    const fontResponse = await fetch(CONFIG.fontPath);
    if (!fontResponse.ok) {
      throw new Error(`無法載入字體檔案: ${CONFIG.fontPath}`);
    }
    cachedFontBytes = await fontResponse.arrayBuffer();
  }

  // 3. Load PDF document
  const pdfDoc = await PDFDocument.load(pdfBytes);

  // 4. Register fontkit for custom font support
  pdfDoc.registerFontkit(fontkit);

  // 5. Embed the custom font
  const customFont = await pdfDoc.embedFont(cachedFontBytes);

  // 6. Get the first page
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { width, height } = firstPage.getSize();

  // 7. Prepare text - only the name
  const fontSize = CONFIG.fontSize;
  // Calculate max width: use 90% of page width for more space
  const marginX = 30; // Small margin on each side
  const maxLineWidth = width - (marginX * 2);
  const lines = breakTextIntoLines(name, customFont, fontSize, maxLineWidth);

  // 8. Calculate positions with multi-line centering
  const lineHeight = fontSize * CONFIG.lineHeight;
  // Target center Y position (fixed point for single line)
  const targetCenterY = height - CONFIG.topMargin - fontSize / 2;
  // Total height of all lines
  const totalTextHeight = (lines.length - 1) * lineHeight + fontSize;
  // Calculate start Y so that the center of all lines matches targetCenterY
  const startY = targetCenterY + (totalTextHeight / 2) - fontSize;

  // 9. Draw each line (center-aligned)
  const textColor = rgb(CONFIG.textColor.r, CONFIG.textColor.g, CONFIG.textColor.b);

  lines.forEach((line, index) => {
    const y = startY - (index * lineHeight);

    // Calculate line width for center alignment
    const lineWidth = customFont.widthOfTextAtSize(line, fontSize);
    const x = (width - lineWidth) / 2; // Center horizontally

    firstPage.drawText(line, {
      x: x,
      y: y,
      size: fontSize,
      font: customFont,
      color: textColor,
    });
  });

  // 10. Save and download
  const modifiedPdfBytes = await pdfDoc.save();
  downloadPDF(modifiedPdfBytes, `給${name}的禮物.pdf`);
}

/**
 * Trigger PDF download
 */
function downloadPDF(pdfBytes, filename) {
  console.log('[PDF Download] Starting download, bytes:', pdfBytes.byteLength);

  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  console.log('[PDF Download] Blob URL created:', url);
  console.log('[PDF Download] Filename:', filename);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);

  // Use a more reliable click method
  link.click();

  console.log('[PDF Download] Download triggered');

  // Delay removal to ensure download starts
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log('[PDF Download] Cleanup complete');
  }, 3000);

  // Show success message
  showSuccess(`PDF 已產生！檔案名稱：${filename}`);
}

/**
 * Show/hide loading state
 */
function showLoading(show) {
  loadingEl.classList.toggle('hidden', !show);
  form.classList.toggle('hidden', show);
  // Hide success message when loading starts
  if (show) {
    hideSuccess();
  }
}

/**
 * Show error message
 */
function showError(message) {
  errorEl.querySelector('.error-text').textContent = message;
  errorEl.classList.remove('hidden');
}

/**
 * Hide error message
 */
function hideError() {
  errorEl.classList.add('hidden');
}

/**
 * Show success message
 */
function showSuccess(message) {
  const successEl = document.getElementById('success');
  successEl.querySelector('.success-text').textContent = message;
  successEl.classList.remove('hidden');
}

/**
 * Hide success message
 */
function hideSuccess() {
  const successEl = document.getElementById('success');
  successEl.classList.add('hidden');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

