/**
 * Bulletproof Thermal Receipt & KOT Engine
 * Supports 58mm / 80mm Bluetooth Printers & Android Print Spooler
 * 100% Free - Zero extra apps required
 */

import { Logger } from './logger';

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
  isTakeaway?: boolean;
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
  isTakeaway?: boolean;
}

// Global cached bluetooth device connection (if Web Bluetooth is available)
let cachedDevice: any = null;
let cachedCharacteristic: any = null;

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const BluetoothPrinter = {
  /**
   * Check if Native Android Bridge is available
   */
  isNativeAndroidAvailable(): boolean {
    return typeof window !== 'undefined' && Boolean((window as any).AndroidPrinter);
  },

  /**
   * Check if Web Bluetooth is supported in browser
   */
  isWebBluetoothSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  },

  /**
   * Get list of paired Bluetooth devices via native Android bridge
   */
  getPairedDevices(): Array<{ name: string; address: string }> {
    const androidPrinter = (window as any).AndroidPrinter;
    if (androidPrinter && typeof androidPrinter.getPairedBluetoothPrinters === 'function') {
      try {
        const json = androidPrinter.getPairedBluetoothPrinters();
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
          return parsed.filter((d) => d.address);
        }
      } catch (e: any) {
        Logger.error('Printer', 'Failed to parse paired printers', e);
      }
    }
    return [];
  },

  /**
   * Get name of currently selected/connected printer
   */
  getConnectedDeviceName(): string | null {
    if (cachedDevice && cachedDevice.gatt && cachedDevice.gatt.connected) {
      return cachedDevice.name || 'Thermal Printer';
    }
    const saved = localStorage.getItem('hotel_rj_printer_name');
    return saved || null;
  },

  /**
   * Print Kitchen Order Ticket (KOT)
   * Tries direct Bluetooth SPP first, then Android System PrintManager spooler, then Web print
   */
  async printKOT(data: KOTPrintData): Promise<{ success: boolean; method: string; error?: string }> {
    Logger.info('Printer', `Initiating KOT #${data.kotNumber} for table ${data.tableNumber}`);

    const androidPrinter = (window as any).AndroidPrinter;
    if (androidPrinter) {
      Logger.info('Printer', 'Android native printer interface found');
      const escpos = generateKOTEscPos(data);
      const base64 = uint8ArrayToBase64(escpos);
      const savedAddress = localStorage.getItem('hotel_rj_printer_address') || '';

      // 1. Attempt Direct Bluetooth SPP
      try {
        Logger.info('Printer', `Attempting Bluetooth direct print (address: "${savedAddress || 'auto'}")`);
        const resJson = androidPrinter.printBluetooth(savedAddress, base64);
        const res = JSON.parse(resJson);
        if (res.success) {
          const device = res.deviceName || 'Bluetooth Printer';
          Logger.success('Printer', `KOT #${data.kotNumber} printed to ${device}`);
          return { success: true, method: `Bluetooth (${device})` };
        } else {
          Logger.warn('Printer', `Bluetooth returned: ${res.error || 'unspecified'}. Trying System Spooler...`);
        }
      } catch (err: any) {
        Logger.warn('Printer', `Bluetooth direct call error: ${err?.message}`);
      }

      // 2. Fallback to Android Native System Print Spooler (PrintManager)
      try {
        Logger.info('Printer', 'Opening Android System Print dialog');
        androidPrinter.printHtml(generateKOTHtml(data), `KOT_${data.tableNumber}_#${data.kotNumber}`);
        return { success: true, method: 'Android System Print Spooler' };
      } catch (err: any) {
        Logger.error('Printer', `Android PrintManager failed: ${err?.message}`);
      }
    }

    // 3. Web Bluetooth (if paired in supported browser)
    if (cachedCharacteristic && cachedDevice?.gatt?.connected) {
      try {
        const escpos = generateKOTEscPos(data);
        await this.sendBytes(escpos);
        Logger.success('Printer', 'KOT printed via Web Bluetooth');
        return { success: true, method: 'Web Bluetooth' };
      } catch (err: any) {
        Logger.warn('Printer', `Web Bluetooth write failed: ${err?.message}`);
      }
    }

    // 4. Browser Print Fallback
    Logger.info('Printer', 'Executing browser print spooler');
    printViaAndroidSpooler(generateKOTHtml(data));
    return { success: true, method: 'Browser Print' };
  },

  /**
   * Print Final Customer Bill (Tax Invoice)
   */
  async printBill(data: BillPrintData): Promise<{ success: boolean; method: string; error?: string }> {
    Logger.info('Printer', `Initiating Bill #${data.billNumber} for table ${data.tableNumber}`);

    const androidPrinter = (window as any).AndroidPrinter;
    if (androidPrinter) {
      const escpos = generateBillEscPos(data);
      const base64 = uint8ArrayToBase64(escpos);
      const savedAddress = localStorage.getItem('hotel_rj_printer_address') || '';

      // 1. Direct Bluetooth SPP
      try {
        const resJson = androidPrinter.printBluetooth(savedAddress, base64);
        const res = JSON.parse(resJson);
        if (res.success) {
          const device = res.deviceName || 'Bluetooth Printer';
          Logger.success('Printer', `Bill #${data.billNumber} printed to ${device}`);
          return { success: true, method: `Bluetooth (${device})` };
        } else {
          Logger.warn('Printer', `Bluetooth returned: ${res.error}. Falling back to System Spooler...`);
        }
      } catch (err: any) {
        Logger.warn('Printer', `Bluetooth call error: ${err?.message}`);
      }

      // 2. Android Native PrintManager
      try {
        Logger.info('Printer', 'Opening Android System Print dialog for Bill');
        androidPrinter.printHtml(generateBillHtml(data), `Bill_${data.billNumber}`);
        return { success: true, method: 'Android System Print Spooler' };
      } catch (err: any) {
        Logger.error('Printer', `Android PrintManager failed: ${err?.message}`);
      }
    }

    if (cachedCharacteristic && cachedDevice?.gatt?.connected) {
      try {
        const escpos = generateBillEscPos(data);
        await this.sendBytes(escpos);
        Logger.success('Printer', 'Bill printed via Web Bluetooth');
        return { success: true, method: 'Web Bluetooth' };
      } catch (err: any) {
        Logger.warn('Printer', `Web Bluetooth write failed: ${err?.message}`);
      }
    }

    printViaAndroidSpooler(generateBillHtml(data));
    return { success: true, method: 'Browser Print' };
  },

  /**
   * Print 58mm test receipt
   */
  async printTestReceipt(): Promise<{ success: boolean; method: string }> {
    Logger.info('Printer', 'Initiating Test Print Slip');
    const testData: KOTPrintData = {
      tableNumber: 'TEST',
      kotNumber: 1,
      serverName: 'Hotel RJ POS',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      items: [
        { name: 'Hotel RJ Thermal Printer', quantity: 1, notes: 'Self-Test OK!' },
        { name: '58mm Paper Roll Configured', quantity: 1 },
      ],
      orderNote: 'Thermal printing is working properly!',
    };

    return await this.printKOT(testData);
  },

  /**
   * Helper to send raw ESC/POS bytes over Bluetooth characteristic in chunks
   */
  async sendBytes(bytes: Uint8Array): Promise<boolean> {
    if (!cachedCharacteristic) return false;
    const chunkSize = 256;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      if (cachedCharacteristic.writeValueWithoutResponse) {
        await cachedCharacteristic.writeValueWithoutResponse(chunk);
      } else {
        await cachedCharacteristic.writeValue(chunk);
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    return true;
  },
};

// ---------------------------------------------------------
// Universal Android Spooler Print Engine (Rock Solid)
// ---------------------------------------------------------

function printViaAndroidSpooler(htmlContent: string) {
  // Ensure print area exists
  let printArea = document.getElementById('thermal-print-area');
  if (!printArea) {
    printArea = document.createElement('div');
    printArea.id = 'thermal-print-area';
    document.body.appendChild(printArea);
  }

  // Ensure thermal print stylesheet exists
  if (!document.getElementById('thermal-print-stylesheet')) {
    const style = document.createElement('style');
    style.id = 'thermal-print-stylesheet';
    style.innerHTML = `
      #thermal-print-area {
        display: none;
      }
      @media print {
        body > *:not(#thermal-print-area) {
          display: none !important;
        }
        #thermal-print-area {
          display: block !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 58mm !important;
          margin: 0 !important;
          padding: 4px !important;
          font-family: 'Courier New', Courier, monospace !important;
          font-size: 11px !important;
          line-height: 1.35 !important;
          color: #000 !important;
          background: #fff !important;
        }
        @page {
          size: 58mm auto;
          margin: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  printArea.innerHTML = htmlContent;

  // Small delay to ensure DOM is ready, then trigger print
  setTimeout(() => {
    window.print();
  }, 100);
}

// ---------------------------------------------------------
// HTML Receipts (Formatted for 58mm / 80mm paper)
// ---------------------------------------------------------

export function generateKOTHtml(data: KOTPrintData): string {
  const isTakeaway = data.isTakeaway || data.tableNumber.toLowerCase().includes('takeaway') || data.tableNumber.toLowerCase().includes('parcel');

  const itemsHtml = data.items
    .map(
      (it) => `
    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; margin: 3px 0;">
      <span>${it.quantity}x ${it.name}</span>
    </div>
    ${it.notes ? `<div style="font-size: 11px; font-style: italic; color: #333; padding-left: 8px;">👉 Note: <strong>${it.notes}</strong></div>` : ''}
  `
    )
    .join('');

  return `
    <div style="text-align: center; font-weight: bold; font-size: 16px; letter-spacing: 1px;">K. O. T.</div>
    <div style="text-align: center; font-weight: bold; font-size: 12px;">HOTEL RJ RESTAURANT</div>
    ${isTakeaway ? `<div style="text-align: center; background: #000; color: #fff; font-weight: bold; padding: 2px; font-size: 12px; margin: 4px 0;">*** TAKEAWAY / PARCEL ***</div>` : ''}
    <div style="border-top: 1px solid #000; margin: 4px 0;"></div>
    <div style="font-size: 16px; font-weight: bold; text-align: center; margin: 2px 0;">TABLE: ${data.tableNumber}</div>
    <div style="display: flex; justify-content: space-between; font-size: 11px;">
      <span>KOT #: ${data.kotNumber}</span>
      <span>${data.timestamp}</span>
    </div>
    <div style="font-size: 11px;">Server: <strong>${data.serverName}</strong></div>
    <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>
    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 11px;">
      <span>ITEMS TO COOK</span>
      <span>QTY</span>
    </div>
    <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>
    ${itemsHtml}
    <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
    ${data.orderNote ? `<div style="margin: 4px 0; font-size: 11px;"><strong>SPECIAL NOTE:</strong> ${data.orderNote}</div><div style="border-top: 1px dashed #000; margin: 4px 0;"></div>` : ''}
    <div style="text-align: center; font-size: 10px; margin-top: 6px;">--- Sent to Kitchen ---</div>
  `;
}

export function generateBillHtml(data: BillPrintData): string {
  const isTakeaway = data.isTakeaway || data.tableNumber.toLowerCase().includes('takeaway') || data.tableNumber.toLowerCase().includes('parcel');

  const itemsHtml = data.items
    .map((it) => {
      const amt = ((it.price || 0) * it.quantity).toFixed(2);
      return `
      <div style="display: flex; justify-content: space-between; margin: 2px 0; font-size: 11px;">
        <span>${it.name} x${it.quantity}</span>
        <span>₹${amt}</span>
      </div>
      ${it.notes ? `<div style="font-size: 9.5px; font-style: italic; color: #555; padding-left: 8px;">(${it.notes})</div>` : ''}
    `;
    })
    .join('');

  const gstAmt = data.gstRate ? (data.subtotal * data.gstRate) / 100 : 0;

  return `
    <div style="text-align: center; font-weight: bold; font-size: 16px;">HOTEL RJ</div>
    <div style="text-align: center; font-size: 9px;">Where Comfort Meets Great Taste</div>
    <div style="text-align: center; font-size: 9px;">Suriya Road, Bagodar, Giridih (Jharkhand)</div>
    <div style="text-align: center; font-size: 9px;">Tel: 7004865824 / 7004153034</div>
    <div style="border-top: 1px solid #000; margin: 4px 0;"></div>
    <div style="text-align: center; font-weight: bold; font-size: 12px;">TAX INVOICE / GUEST CHECK</div>
    ${isTakeaway ? `<div style="text-align: center; font-weight: bold; font-size: 11px; margin: 2px 0;">[ TAKEAWAY PACKING ]</div>` : ''}
    <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>
    <div style="display: flex; justify-content: space-between; font-size: 11px;">
      <span>Table: <strong>${data.tableNumber}</strong></span>
      <span>Bill #: ${data.billNumber}</span>
    </div>
    <div style="display: flex; justify-content: space-between; font-size: 11px;">
      <span>Date: ${data.timestamp}</span>
      <span>Staff: ${data.serverName}</span>
    </div>
    <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>
    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 11px;">
      <span>ITEM</span>
      <span>AMOUNT</span>
    </div>
    <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>
    ${itemsHtml}
    <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>
    <div style="display: flex; justify-content: space-between; font-size: 11px;">
      <span>Subtotal:</span>
      <span>₹${data.subtotal.toFixed(2)}</span>
    </div>
    ${
      data.gstRate
        ? `
    <div style="display: flex; justify-content: space-between; font-size: 11px;">
      <span>GST (${data.gstRate}%):</span>
      <span>₹${gstAmt.toFixed(2)}</span>
    </div>`
        : ''
    }
    <div style="border-top: 1px solid #000; margin: 4px 0;"></div>
    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;">
      <span>TOTAL:</span>
      <span>₹${data.grandTotal.toFixed(2)}</span>
    </div>
    <div style="border-top: 1px solid #000; margin: 4px 0;"></div>
    <div style="text-align: center; margin-top: 6px; font-size: 10px;">
      <strong>Scan & Pay via UPI:</strong><br/>
      hotelrj.info@okaxis<br/>
      (PhonePe / Google Pay / Paytm)
    </div>
    <div style="text-align: center; margin-top: 8px; font-size: 10px; font-weight: bold;">
      Thank You! Visit Again Hotel RJ!
    </div>
  `;
}

// ---------------------------------------------------------
// ESC/POS Command Byte Generator
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
  DOUBLE_ON: `${GS}!\x11`,
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
  if (data.isTakeaway || data.tableNumber.toLowerCase().includes('parcel') || data.tableNumber.toLowerCase().includes('takeaway')) {
    s += '*** TAKEAWAY / PARCEL ***\n';
  }
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
  s += '--- Sent to Kitchen ---\n';
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
  if (data.isTakeaway || data.tableNumber.toLowerCase().includes('parcel') || data.tableNumber.toLowerCase().includes('takeaway')) {
    s += '[ TAKEAWAY PARCEL ]\n';
  }
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
