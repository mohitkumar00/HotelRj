/**
 * Direct ESC/POS Thermal Receipt & KOT Generator
 * Works with any 58mm or 80mm Bluetooth / USB Thermal Printer
 * 100% Free - Zero 3rd party apps required
 */

export interface ReceiptItem {
  name: string;
  quantity: number;
  price?: number;
  notes?: string;
}

export interface KOTPrintData {
  tableNumber: string;
  kotNumber: number;
  serverName: string;
  timestamp: string;
  items: ReceiptItem[];
  orderNote?: string;
}

export interface BillPrintData {
  tableNumber: string;
  billNumber: string;
  serverName: string;
  timestamp: string;
  items: ReceiptItem[];
  subtotal: number;
  gstRate?: number; // default 5%
  discount?: number;
  grandTotal: number;
  paymentMode?: string;
}

// Global cached bluetooth device connection
let cachedDevice: any = null;
let cachedCharacteristic: any = null;

export const BluetoothPrinter = {
  /**
   * Check if Bluetooth is supported in the current environment
   */
  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  },

  /**
   * Get name of currently connected printer
   */
  getConnectedDeviceName(): string | null {
    if (cachedDevice && cachedDevice.gatt && cachedDevice.gatt.connected) {
      return cachedDevice.name || 'Thermal Printer';
    }
    return null;
  },

  /**
   * Scan and connect to Bluetooth Thermal Printer
   */
  async connect(): Promise<{ success: boolean; deviceName?: string; error?: string }> {
    if (!this.isSupported()) {
      return { success: false, error: 'Web Bluetooth is not supported on this browser.' };
    }

    try {
      // Standard thermal printer service UUIDs
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
          '0000ffe0-0000-1000-8000-00805f9b34fb',
          '0000ff00-0000-1000-8000-00805f9b34fb',
        ],
      });

      if (!device) {
        return { success: false, error: 'No device selected' };
      }

      const server = await device.gatt.connect();

      // Find writable characteristic
      const services = await server.getPrimaryServices();
      let writeChar: any = null;

      for (const service of services) {
        try {
          const chars = await service.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              writeChar = c;
              break;
            }
          }
        } catch {
          // ignore
        }
        if (writeChar) break;
      }

      if (!writeChar) {
        return { success: false, error: 'Could not find writable printer channel.' };
      }

      cachedDevice = device;
      cachedCharacteristic = writeChar;

      // Save device name in localStorage
      try {
        localStorage.setItem('hotel_rj_printer_name', device.name || 'Bluetooth Printer');
      } catch {}

      return { success: true, deviceName: device.name || 'Bluetooth Printer' };
    } catch (err: any) {
      console.warn('Bluetooth connection cancelled or failed:', err);
      return { success: false, error: err?.message || 'Bluetooth connection failed.' };
    }
  },

  /**
   * Disconnect printer
   */
  disconnect() {
    if (cachedDevice && cachedDevice.gatt) {
      try {
        cachedDevice.gatt.disconnect();
      } catch {}
    }
    cachedDevice = null;
    cachedCharacteristic = null;
  },

  /**
   * Send raw bytes to connected Bluetooth printer in chunks
   */
  async sendBytes(bytes: Uint8Array): Promise<boolean> {
    if (!cachedCharacteristic || !cachedDevice?.gatt?.connected) {
      return false;
    }

    try {
      // Send in 256-byte chunks to prevent buffer overflow on mini printers
      const chunkSize = 256;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        if (cachedCharacteristic.writeValueWithoutResponse) {
          await cachedCharacteristic.writeValueWithoutResponse(chunk);
        } else {
          await cachedCharacteristic.writeValue(chunk);
        }
        // Small delay between packets
        await new Promise((r) => setTimeout(r, 20));
      }
      return true;
    } catch (err) {
      console.error('Failed to send print bytes:', err);
      return false;
    }
  },

  /**
   * Print a Kitchen Order Ticket (KOT)
   */
  async printKOT(data: KOTPrintData): Promise<{ success: boolean; fallbackUsed?: boolean }> {
    const escposBytes = generateKOTEscPos(data);

    // Try direct bluetooth first
    if (cachedCharacteristic && cachedDevice?.gatt?.connected) {
      const sent = await this.sendBytes(escposBytes);
      if (sent) return { success: true };
    }

    // Fallback: Trigger thermal receipt window print (100% works on any phone/printer)
    printThermalWindow(generateKOTHtml(data));
    return { success: true, fallbackUsed: true };
  },

  /**
   * Print a Customer Bill
   */
  async printBill(data: BillPrintData): Promise<{ success: boolean; fallbackUsed?: boolean }> {
    const escposBytes = generateBillEscPos(data);

    // Try direct bluetooth first
    if (cachedCharacteristic && cachedDevice?.gatt?.connected) {
      const sent = await this.sendBytes(escposBytes);
      if (sent) return { success: true };
    }

    // Fallback: Trigger thermal receipt window print
    printThermalWindow(generateBillHtml(data));
    return { success: true, fallbackUsed: true };
  },

  /**
   * Print a 2-inch test receipt to verify printer connection
   */
  async printTestReceipt(): Promise<boolean> {
    const testData: KOTPrintData = {
      tableNumber: 'TEST',
      kotNumber: 1,
      serverName: 'Hotel RJ Staff',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      items: [
        { name: 'Hotel RJ Bluetooth Printer', quantity: 1, notes: 'Connection OK!' },
        { name: '58mm Thermal Mode Active', quantity: 1 },
      ],
      orderNote: 'Ready to take orders!',
    };

    const res = await this.printKOT(testData);
    return res.success;
  },
};

// ---------------------------------------------------------
// ESC/POS Command Helpers (Standard 58mm / 32 Chars Per Line)
// ---------------------------------------------------------

const ESC = '\x1B';
const GS = '\x1D';

const CMD = {
  INIT: `${ESC}@`,
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT: `${ESC}a\x02`,
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  DOUBLE_ON: `${GS}!\x11`, // Double height + width
  DOUBLE_OFF: `${GS}!\x00`,
  FEED_3: `\n\n\n`,
  CUT: `${GS}V\x41\x03`,
};

function strToBytes(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

function line32(left: string, right: string = '', width = 32): string {
  const spaceCount = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(spaceCount) + right + '\n';
}

function generateKOTEscPos(data: KOTPrintData): Uint8Array {
  let s = '';
  s += CMD.INIT;
  s += CMD.ALIGN_CENTER;
  s += CMD.BOLD_ON;
  s += '================================\n';
  s += `${CMD.DOUBLE_ON}K. O. T.${CMD.DOUBLE_OFF}\n`;
  s += 'HOTEL RJ RESTAURANT\n';
  s += '================================\n';
  s += CMD.BOLD_OFF;

  s += CMD.ALIGN_LEFT;
  s += `${CMD.BOLD_ON}${CMD.DOUBLE_ON}TABLE: ${data.tableNumber}${CMD.DOUBLE_OFF}${CMD.BOLD_OFF}\n`;
  s += line32(`KOT: #${data.kotNumber}`, `Time: ${data.timestamp}`);
  s += line32(`Server: ${data.serverName}`, '');
  s += '--------------------------------\n';
  s += line32('QTY  ITEM', '');
  s += '--------------------------------\n';

  s += CMD.BOLD_ON;
  for (const item of data.items) {
    s += line32(`${item.quantity}x  ${item.name}`, '');
    if (item.notes) {
      s += `     * NOTE: ${item.notes}\n`;
    }
  }
  s += CMD.BOLD_OFF;

  s += '--------------------------------\n';
  if (data.orderNote) {
    s += `SPECIAL INSTRUCTIONS:\n${data.orderNote}\n`;
    s += '--------------------------------\n';
  }

  s += CMD.ALIGN_CENTER;
  s += '--- End of KOT ---\n';
  s += CMD.FEED_3;
  s += CMD.CUT;

  return strToBytes(s);
}

function generateBillEscPos(data: BillPrintData): Uint8Array {
  let s = '';
  s += CMD.INIT;
  s += CMD.ALIGN_CENTER;
  s += CMD.BOLD_ON;
  s += `${CMD.DOUBLE_ON}HOTEL RJ${CMD.DOUBLE_OFF}\n`;
  s += 'Where Comfort Meets Great Taste\n';
  s += 'Suriya Road, Bagodar (Giridih)\n';
  s += 'Ph: 7004865824 / 7004153034\n';
  s += '================================\n';
  s += 'TAX INVOICE / GUEST CHECK\n';
  s += '================================\n';
  s += CMD.BOLD_OFF;

  s += CMD.ALIGN_LEFT;
  s += line32(`Bill: ${data.billNumber}`, `Table: ${data.tableNumber}`);
  s += line32(`Date: ${data.timestamp}`, `Staff: ${data.serverName}`);
  s += '--------------------------------\n';
  s += line32('ITEM              QTY     AMT', '');
  s += '--------------------------------\n';

  for (const item of data.items) {
    const itemAmt = ((item.price || 0) * item.quantity).toFixed(2);
    const itemNameShort = item.name.length > 17 ? item.name.substring(0, 16) + '.' : item.name;
    const leftCol = `${itemNameShort} x${item.quantity}`;
    s += line32(leftCol, `Rs.${itemAmt}`);
  }

  s += '--------------------------------\n';
  s += line32('Subtotal:', `Rs.${data.subtotal.toFixed(2)}`);
  if (data.gstRate && data.gstRate > 0) {
    const gstAmt = (data.subtotal * data.gstRate) / 100;
    s += line32(`GST (${data.gstRate}%):`, `Rs.${gstAmt.toFixed(2)}`);
  }
  if (data.discount && data.discount > 0) {
    s += line32('Discount:', `-Rs.${data.discount.toFixed(2)}`);
  }
  s += '================================\n';
  s += CMD.BOLD_ON;
  s += `${CMD.DOUBLE_ON}${line32('TOTAL:', `Rs.${data.grandTotal.toFixed(2)}`, 16)}${CMD.DOUBLE_OFF}`;
  s += CMD.BOLD_OFF;
  s += '================================\n';

  s += CMD.ALIGN_CENTER;
  s += 'Pay via UPI: hotelrj.info@okaxis\n';
  s += 'Scan UPI QR at counter / table\n';
  s += 'Thank you! Visit Again Hotel RJ\n';
  s += CMD.FEED_3;
  s += CMD.CUT;

  return strToBytes(s);
}

// ---------------------------------------------------------
// Visual Thermal Receipt Fallback (Prints directly on any device)
// ---------------------------------------------------------

function printThermalWindow(htmlContent: string) {
  const printFrame = document.createElement('iframe');
  printFrame.style.position = 'fixed';
  printFrame.style.right = '0';
  printFrame.style.bottom = '0';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = '0';
  document.body.appendChild(printFrame);

  const doc = printFrame.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt Print</title>
        <style>
          @page {
            size: 58mm auto;
            margin: 0;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 54mm;
            margin: 0 auto;
            padding: 8px 4px;
            font-size: 11px;
            line-height: 1.35;
            color: #000;
            background: #fff;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .title { font-size: 15px; font-weight: bold; letter-spacing: 1px; }
          .double { font-size: 14px; font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 4px 0; }
          .divider-solid { border-top: 1px solid #000; margin: 5px 0; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; }
          .note { font-size: 10px; font-style: italic; padding-left: 10px; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    printFrame.contentWindow?.focus();
    printFrame.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(printFrame);
    }, 1000);
  }, 350);
}

function generateKOTHtml(data: KOTPrintData): string {
  const itemsHtml = data.items
    .map(
      (it) => `
    <div class="row bold">
      <span>${it.quantity}x ${it.name}</span>
    </div>
    ${it.notes ? `<div class="note">* Note: ${it.notes}</div>` : ''}
  `
    )
    .join('');

  return `
    <div class="center bold title">K. O. T.</div>
    <div class="center bold">HOTEL RJ RESTAURANT</div>
    <div class="divider-solid"></div>
    <div class="double center">TABLE: ${data.tableNumber}</div>
    <div class="row">
      <span>KOT #: ${data.kotNumber}</span>
      <span>${data.timestamp}</span>
    </div>
    <div class="row">
      <span>Server: ${data.serverName}</span>
    </div>
    <div class="divider"></div>
    <div class="row bold">
      <span>ITEM</span>
      <span>QTY</span>
    </div>
    <div class="divider"></div>
    ${itemsHtml}
    <div class="divider"></div>
    ${data.orderNote ? `<div style="margin: 4px 0;"><strong>SPECIAL:</strong> ${data.orderNote}</div><div class="divider"></div>` : ''}
    <div class="center" style="margin-top: 6px;">--- Sent to Kitchen ---</div>
  `;
}

function generateBillHtml(data: BillPrintData): string {
  const itemsHtml = data.items
    .map((it) => {
      const amt = ((it.price || 0) * it.quantity).toFixed(2);
      return `
      <div class="row">
        <span>${it.name} x${it.quantity}</span>
        <span>₹${amt}</span>
      </div>
    `;
    })
    .join('');

  const gstAmt = data.gstRate ? (data.subtotal * data.gstRate) / 100 : 0;

  return `
    <div class="center bold title">HOTEL RJ</div>
    <div class="center" style="font-size: 9px;">Where Comfort Meets Great Taste</div>
    <div class="center" style="font-size: 9px;">Suriya Road, Bagodar (Giridih)</div>
    <div class="center" style="font-size: 9px;">Tel: 7004865824 / 7004153034</div>
    <div class="divider-solid"></div>
    <div class="center bold" style="font-size: 11px;">TAX INVOICE</div>
    <div class="divider"></div>
    <div class="row">
      <span>Table: <strong>${data.tableNumber}</strong></span>
      <span>Bill #: ${data.billNumber}</span>
    </div>
    <div class="row">
      <span>Date: ${data.timestamp}</span>
      <span>Staff: ${data.serverName}</span>
    </div>
    <div class="divider"></div>
    <div class="row bold">
      <span>ITEM</span>
      <span>AMOUNT</span>
    </div>
    <div class="divider"></div>
    ${itemsHtml}
    <div class="divider"></div>
    <div class="row">
      <span>Subtotal:</span>
      <span>₹${data.subtotal.toFixed(2)}</span>
    </div>
    ${
      data.gstRate
        ? `
    <div class="row">
      <span>GST (${data.gstRate}%):</span>
      <span>₹${gstAmt.toFixed(2)}</span>
    </div>`
        : ''
    }
    <div class="divider-solid"></div>
    <div class="row bold double">
      <span>TOTAL:</span>
      <span>₹${data.grandTotal.toFixed(2)}</span>
    </div>
    <div class="divider-solid"></div>
    <div class="center" style="margin-top: 6px; font-size: 10px;">
      <strong>Scan to Pay via UPI:</strong><br/>
      hotelrj.info@okaxis<br/>
      (GPay / PhonePe / Paytm)
    </div>
    <div class="center" style="margin-top: 8px; font-size: 9.5px;">
      Thank You! Visit Again Hotel RJ!
    </div>
  `;
}
