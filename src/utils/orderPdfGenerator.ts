import { CartItem } from '../types';

export interface GeneratePdfOptions {
  cart: { [itemId: string]: CartItem };
  tableNumber: string;
  orderNote?: string;
  totalItemsCount: number;
  totalPrice: number;
  hotelName?: string;
  phone?: string;
  address?: string;
}

/**
 * Helper to safely convert ASCII / Latin-1 string to Uint8Array
 */
function textToBytes(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}

/**
 * Attempts to load an image with timeout fallback
 */
function preloadImage(src: string, timeoutMs = 1200): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let isSettled = false;

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        resolve(null);
      }
    }, timeoutMs);

    img.onload = () => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        resolve(img);
      }
    };

    img.onerror = () => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        resolve(null);
      }
    };

    img.src = src;
  });
}

/**
 * Safely draws a rounded rectangle with fallback for older browsers
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  }
}

/**
 * Wraps a JPEG byte buffer into a standard, valid PDF 1.4 document
 */
function createPdfFromJpeg(
  pixelWidth: number,
  pixelHeight: number,
  jpegBytes: Uint8Array
): Blob {
  // Use standard 72 pt/inch. Standard A4 width is 595.28 pt.
  const widthPt = 595.28;
  const heightPt = (pixelHeight / pixelWidth) * widthPt;

  const header = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const headerBytes = textToBytes(header);

  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const obj1Bytes = textToBytes(obj1);

  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  const obj2Bytes = textToBytes(obj2);

  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt.toFixed(2)} ${heightPt.toFixed(2)}] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>\nendobj\n`;
  const obj3Bytes = textToBytes(obj3);

  const streamContent = `q\n${widthPt.toFixed(2)} 0 0 ${heightPt.toFixed(2)} 0 0 cm\n/Im1 Do\nQ\n`;
  const streamContentBytes = textToBytes(streamContent);

  const obj4 = `4 0 obj\n<< /Length ${streamContentBytes.length} >>\nstream\n${streamContent}endstream\nendobj\n`;
  const obj4Bytes = textToBytes(obj4);

  const obj5Header = `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`;
  const obj5HeaderBytes = textToBytes(obj5Header);

  const obj5Footer = '\nendstream\nendobj\n';
  const obj5FooterBytes = textToBytes(obj5Footer);

  // Calculate object byte offsets
  const offsets: number[] = [];
  let currentOffset = headerBytes.length;

  offsets.push(currentOffset); // obj 1
  currentOffset += obj1Bytes.length;

  offsets.push(currentOffset); // obj 2
  currentOffset += obj2Bytes.length;

  offsets.push(currentOffset); // obj 3
  currentOffset += obj3Bytes.length;

  offsets.push(currentOffset); // obj 4
  currentOffset += obj4Bytes.length;

  offsets.push(currentOffset); // obj 5
  currentOffset += obj5HeaderBytes.length + jpegBytes.length + obj5FooterBytes.length;

  // Build XREF table
  const startXref = currentOffset;
  let xref = `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    const pad = off.toString().padStart(10, '0');
    xref += `${pad} 00000 n \n`;
  }
  const xrefBytes = textToBytes(xref);

  const trailer = `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
  const trailerBytes = textToBytes(trailer);

  return new Blob(
    [
      headerBytes,
      obj1Bytes,
      obj2Bytes,
      obj3Bytes,
      obj4Bytes,
      obj5HeaderBytes,
      jpegBytes,
      obj5FooterBytes,
      xrefBytes,
      trailerBytes,
    ],
    { type: 'application/pdf' }
  );
}

/**
 * Generates an elegant, high-contrast Kitchen Order Ticket (KOT) PDF of food items
 */
export async function generateOrderPdf(options: GeneratePdfOptions): Promise<void> {
  const items = Object.values(options.cart);
  if (items.length === 0) return;

  // Try loading Hotel RJ logo emblem
  const emblemImg = await preloadImage('./icons/hotel-rj-emblem.png');

  // Base canvas layout measurements
  const baseWidth = 660;
  const paddingX = 36;
  const contentWidth = baseWidth - paddingX * 2;

  // Dynamic height calculation
  const headerHeight = emblemImg ? 180 : 155;
  const metaHeight = 65;
  const tableHeaderHeight = 36;
  const itemsHeight = items.length * 38;
  const noteHeight = options.orderNote?.trim() ? 72 : 0;
  const totalsHeight = 80;
  const footerHeight = 85;
  const extraPadding = 50;

  const baseHeight =
    headerHeight +
    metaHeight +
    tableHeaderHeight +
    itemsHeight +
    noteHeight +
    totalsHeight +
    footerHeight +
    extraPadding;

  // 2x Retina scale for ultra-crisp fonts and vector-like lines
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = baseWidth * scale;
  canvas.height = baseHeight * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  ctx.scale(scale, scale);

  // Background - Pure White
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, baseWidth, baseHeight);

  // Outer Luxury Border (Gold)
  ctx.strokeStyle = '#c58a38';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(12, 12, baseWidth - 24, baseHeight - 24);

  // Inner Subtle Inset Border
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.strokeRect(17, 17, baseWidth - 34, baseHeight - 34);

  let currentY = 32;

  // Top Emblem / Logo
  if (emblemImg) {
    const emblemSize = 48;
    ctx.drawImage(
      emblemImg,
      (baseWidth - emblemSize) / 2,
      currentY,
      emblemSize,
      emblemSize
    );
    currentY += emblemSize + 12;
  } else {
    // Stylized Monogram Medallion
    ctx.beginPath();
    ctx.arc(baseWidth / 2, currentY + 18, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#fef3c7';
    ctx.fill();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 16px "Playfair Display", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('RJ', baseWidth / 2, currentY + 24);
    currentY += 46;
  }

  // Restaurant Header
  ctx.textAlign = 'center';
  ctx.fillStyle = '#18181b';
  ctx.font = 'bold 22px "Playfair Display", Georgia, serif';
  ctx.fillText('HOTEL RJ RESTAURANT', baseWidth / 2, currentY);

  currentY += 18;
  ctx.fillStyle = '#b45309';
  ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('KITCHEN ORDER TICKET (KOT) • SHOW TO WAITER', baseWidth / 2, currentY);

  currentY += 16;
  ctx.fillStyle = '#52525b';
  ctx.font = '10.5px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Where Comfort Meets Great Taste • Suriya Road, Bagodar, Giridih', baseWidth / 2, currentY);

  currentY += 14;
  ctx.fillStyle = '#71717a';
  ctx.font = '10px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Call: +91 7004865824 / +91 7004153034 • hotelrj.info@gmail.com', baseWidth / 2, currentY);

  currentY += 18;

  // Dashed separator
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = '#a1a1aa';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(paddingX, currentY);
  ctx.lineTo(baseWidth - paddingX, currentY);
  ctx.stroke();
  ctx.setLineDash([]); // reset

  currentY += 20;

  // Table & Meta Details Row
  const kotRef = `RJ-KOT-${Math.floor(100000 + Math.random() * 900000)}`;
  const dateFormatted = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeFormatted = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Table Pill Badge
  const tableText = `TABLE: ${options.tableNumber ? options.tableNumber.toUpperCase() : 'WALK-IN GUEST'}`;
  ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
  const tableBadgeWidth = ctx.measureText(tableText).width + 20;

  ctx.fillStyle = '#18181b';
  drawRoundedRect(ctx, paddingX, currentY - 14, tableBadgeWidth, 24, 6);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(tableText, paddingX + 10, currentY + 3);

  // Time & KOT Ref (Right aligned)
  ctx.textAlign = 'right';
  ctx.fillStyle = '#27272a';
  ctx.font = 'bold 11px "Plus Jakarta Sans", monospace';
  ctx.fillText(`${dateFormatted}  ${timeFormatted}`, baseWidth - paddingX, currentY - 2);

  ctx.fillStyle = '#71717a';
  ctx.font = '10px "Plus Jakarta Sans", monospace';
  ctx.fillText(`SLIP REF: ${kotRef}`, baseWidth - paddingX, currentY + 12);

  currentY += 26;

  // Table Column Headers Banner
  ctx.fillStyle = '#f4f4f5';
  drawRoundedRect(ctx, paddingX, currentY, contentWidth, 26, 4);
  ctx.fill();
  ctx.strokeStyle = '#e4e4e7';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#3f3f46';
  ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';

  ctx.textAlign = 'left';
  ctx.fillText('ITEM NAME', paddingX + 12, currentY + 17);

  ctx.textAlign = 'center';
  ctx.fillText('DIET', paddingX + 350, currentY + 17);
  ctx.fillText('QTY', paddingX + 415, currentY + 17);

  ctx.textAlign = 'right';
  ctx.fillText('PRICE', paddingX + 490, currentY + 17);
  ctx.fillText('AMOUNT', baseWidth - paddingX - 12, currentY + 17);

  currentY += 34;

  // Food Items Listing
  items.forEach((ci) => {
    const rawPrice = ci.item.price;
    const itemPrice =
      typeof rawPrice === 'number'
        ? rawPrice
        : parseInt(String(rawPrice).replace(/\D/g, ''), 10) || 0;
    const itemTotal = itemPrice * ci.quantity;

    // Dish Name
    ctx.textAlign = 'left';
    ctx.fillStyle = '#09090b';
    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';

    let displayName = ci.item.name;
    if (displayName.length > 38) {
      displayName = displayName.substring(0, 36) + '...';
    }
    ctx.fillText(displayName, paddingX + 12, currentY + 6);

    // Dietary indicator
    const diet = ci.item.dietary;
    let dietText = '[VEG]';
    let dietColor = '#059669'; // Green
    if (diet === 'non-veg') {
      dietText = '[NON-VEG]';
      dietColor = '#dc2626'; // Red
    } else if (diet === 'egg') {
      dietText = '[EGG]';
      dietColor = '#d97706'; // Amber
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = dietColor;
    ctx.font = 'bold 9.5px "Plus Jakarta Sans", monospace';
    ctx.fillText(dietText, paddingX + 350, currentY + 6);

    // Quantity
    ctx.fillStyle = '#18181b';
    ctx.font = 'bold 12px "Plus Jakarta Sans", monospace';
    ctx.fillText(`${ci.quantity}`, paddingX + 415, currentY + 6);

    // Rate
    ctx.textAlign = 'right';
    ctx.fillStyle = '#52525b';
    ctx.font = '11.5px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`₹${itemPrice}`, paddingX + 490, currentY + 6);

    // Subtotal
    ctx.fillStyle = '#09090b';
    ctx.font = 'bold 12.5px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`₹${itemTotal}`, baseWidth - paddingX - 12, currentY + 6);

    currentY += 22;

    // Dotted separator between rows
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingX + 6, currentY);
    ctx.lineTo(baseWidth - paddingX - 6, currentY);
    ctx.stroke();
    ctx.setLineDash([]);

    currentY += 14;
  });

  currentY += 4;

  // Cooking Note / Special Instructions Box
  if (options.orderNote?.trim()) {
    ctx.fillStyle = '#fffbeb';
    ctx.strokeStyle = '#fcd34d';
    ctx.lineWidth = 1;

    drawRoundedRect(ctx, paddingX, currentY, contentWidth, 52, 6);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#92400e';
    ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('SPECIAL COOKING INSTRUCTIONS / NOTE:', paddingX + 12, currentY + 18);

    ctx.fillStyle = '#78350f';
    ctx.font = 'italic 11px "Plus Jakarta Sans", sans-serif';

    let safeNote = options.orderNote.trim();
    if (safeNote.length > 75) {
      safeNote = safeNote.substring(0, 72) + '...';
    }
    ctx.fillText(`"${safeNote}"`, paddingX + 12, currentY + 36);

    currentY += 66;
  }

  // Total Summary Card
  ctx.fillStyle = '#fafaf9';
  ctx.strokeStyle = '#c58a38';
  ctx.lineWidth = 1.5;

  drawRoundedRect(ctx, paddingX, currentY, contentWidth, 48, 6);
  ctx.fill();
  ctx.stroke();

  // Left side: Item count
  ctx.textAlign = 'left';
  ctx.fillStyle = '#3f3f46';
  ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `TOTAL ITEMS: ${options.totalItemsCount} ${options.totalItemsCount === 1 ? 'Dish' : 'Dishes'}`,
    paddingX + 16,
    currentY + 29
  );

  // Right side: Grand total
  ctx.textAlign = 'right';
  ctx.fillStyle = '#b45309';
  ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`ESTIMATED BILL: ₹${options.totalPrice}`, baseWidth - paddingX - 16, currentY + 29);

  currentY += 68;

  // Footer section
  ctx.textAlign = 'center';
  ctx.fillStyle = '#52525b';
  ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Prepared fresh to order • Please hand over or show to your server', baseWidth / 2, currentY);

  currentY += 16;
  ctx.fillStyle = '#b45309';
  ctx.font = 'italic 12px "Playfair Display", Georgia, serif';
  ctx.fillText('Thank you for dining with Hotel RJ! Visit Again.', baseWidth / 2, currentY);

  currentY += 14;
  ctx.fillStyle = '#a1a1aa';
  ctx.font = '9px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Luxury AC Rooms, 300+ Banquet Hall & 24/7 Power Backup in Bagodar', baseWidth / 2, currentY);

  // Convert rendered canvas to high-quality JPEG
  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  const base64Data = dataUrl.split(',')[1];
  const binaryString = atob(base64Data);
  const jpegBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    jpegBytes[i] = binaryString.charCodeAt(i);
  }

  // Wrap into PDF Blob
  const pdfBlob = createPdfFromJpeg(canvas.width, canvas.height, jpegBytes);

  // Trigger browser download
  const blobUrl = URL.createObjectURL(pdfBlob);
  const downloadLink = document.createElement('a');
  downloadLink.href = blobUrl;
  const safeTableSlug = options.tableNumber
    ? `Table-${options.tableNumber.trim().replace(/[^a-zA-Z0-9_-]/g, '-')}`
    : 'Order';
  downloadLink.download = `Hotel-RJ-Food-${safeTableSlug}-${Date.now().toString().slice(-4)}.pdf`;

  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 10000);
}
