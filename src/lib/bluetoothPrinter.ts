// Web Bluetooth ESC/POS Direct Thermal Printer Integration
// Compatible with standard 58mm and 80mm Bluetooth ESC/POS Thermal Receipt Printers

let bluetoothDevice: any = null;
let bluetoothCharacteristic: any = null;

// Common Bluetooth Printer Service UUIDs
const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '0000ff00-0000-1000-8000-00805f9b34fb'
];

export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

export function getConnectedPrinterName(): string | null {
  if (bluetoothDevice && bluetoothDevice.gatt?.connected) {
    return bluetoothDevice.name || 'Connected Printer';
  }
  return null;
}

export async function connectBluetoothPrinter(): Promise<string> {
  if (!isBluetoothSupported()) {
    throw new Error('Web Bluetooth is not supported on this browser/device. Please use Chrome on Android, Mac, or Windows.');
  }

  try {
    const nav = navigator as any;
    const device = await nav.bluetooth.requestDevice({
      filters: [
        { namePrefix: 'Printer' },
        { namePrefix: 'PRINTER' },
        { namePrefix: 'RP' },
        { namePrefix: 'POS' },
        { namePrefix: 'MPT' },
        { namePrefix: 'BlueTooth' },
        { namePrefix: 'MTP' },
        { services: ['000018f0-0000-1000-8000-00805f9b34fb'] }
      ],
      optionalServices: PRINTER_SERVICES
    });

    bluetoothDevice = device;
    const server = await device.gatt.connect();

    // Find printable characteristic
    let charFound: any = null;
    for (const serviceUuid of PRINTER_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const chars = await service.getCharacteristics();
        for (const c of chars) {
          if (c.properties.write || c.properties.writeWithoutResponse) {
            charFound = c;
            break;
          }
        }
        if (charFound) break;
      } catch {
        // service not found, try next
      }
    }

    if (!charFound) {
      // Fallback: search all primary services
      try {
        const services = await server.getPrimaryServices();
        for (const service of services) {
          const chars = await service.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              charFound = c;
              break;
            }
          }
          if (charFound) break;
        }
      } catch (e) {
        console.warn('Fallback primary services search error:', e);
      }
    }

    if (!charFound) {
      throw new Error('Could not find writable printing channel on this Bluetooth device.');
    }

    bluetoothCharacteristic = charFound;
    return device.name || 'Bluetooth Thermal Printer';
  } catch (error: any) {
    console.error('Bluetooth connection failed:', error);
    if (error.name === 'SecurityError' || error.message?.includes('permissions policy') || error.message?.includes('disallowed')) {
      throw new Error('Bluetooth access is restricted inside preview iframes. Please click "Open in New Tab" at the top right or open the app in a standalone browser window to use Bluetooth printers.');
    }
    throw error;
  }
}

export async function disconnectBluetoothPrinter(): Promise<void> {
  if (bluetoothDevice && bluetoothDevice.gatt?.connected) {
    bluetoothDevice.gatt.disconnect();
  }
  bluetoothDevice = null;
  bluetoothCharacteristic = null;
}

// ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;

class EscPosBuilder {
  private buffer: number[] = [];

  init() {
    this.buffer.push(ESC, 0x40); // Initialize printer
    return this;
  }

  alignCenter() {
    this.buffer.push(ESC, 0x61, 0x01);
    return this;
  }

  alignLeft() {
    this.buffer.push(ESC, 0x61, 0x00);
    return this;
  }

  alignRight() {
    this.buffer.push(ESC, 0x61, 0x02);
    return this;
  }

  bold(enable = true) {
    this.buffer.push(ESC, 0x45, enable ? 0x01 : 0x00);
    return this;
  }

  doubleSize(enable = true) {
    this.buffer.push(GS, 0x21, enable ? 0x11 : 0x00);
    return this;
  }

  lineFeed(lines = 1) {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(0x0A);
    }
    return this;
  }

  text(str: string) {
    // Basic text encoding (ASCII / clean latin transliteration for pure ESC/POS 58mm thermal printers)
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code < 128) {
        this.buffer.push(code);
      } else {
        // Fallback or skip control / complex unicode for standard thermal receipt
        this.buffer.push(0x20); // space
      }
    }
    return this;
  }

  line(str: string) {
    this.text(str);
    this.lineFeed();
    return this;
  }

  divider(char = '-', length = 32) {
    this.text(char.repeat(length));
    this.lineFeed();
    return this;
  }

  twoColumn(left: string, right: string, totalWidth = 32) {
    const leftTrim = left.slice(0, totalWidth - right.length - 1);
    const spaces = Math.max(1, totalWidth - leftTrim.length - right.length);
    this.text(leftTrim + ' '.repeat(spaces) + right);
    this.lineFeed();
    return this;
  }

  cut() {
    this.lineFeed(3);
    this.buffer.push(GS, 0x56, 0x41, 0x10); // Partial cut
    return this;
  }

  getBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

async function sendBytesInChunks(bytes: Uint8Array, chunkSize = 80) {
  if (!bluetoothCharacteristic) {
    throw new Error('No Bluetooth printer connected.');
  }

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    if (bluetoothCharacteristic.writeValueWithoutResponse) {
      await bluetoothCharacteristic.writeValueWithoutResponse(chunk);
    } else {
      await bluetoothCharacteristic.writeValue(chunk);
    }
    // Small delay between BLE packets to prevent printer buffer overrun
    await new Promise(r => setTimeout(r, 25));
  }
}

export async function printTestReceipt(): Promise<boolean> {
  if (!bluetoothCharacteristic) {
    await connectBluetoothPrinter();
  }

  const b = new EscPosBuilder();
  b.init()
    .alignCenter()
    .bold(true)
    .doubleSize(true)
    .line('TEST PRINT OK')
    .doubleSize(false)
    .bold(false)
    .divider()
    .line('Grocery Flow Thermal')
    .line(new Date().toLocaleString())
    .divider()
    .alignLeft()
    .twoColumn('Test Item 1', '฿25.00')
    .twoColumn('Test Item 2', '฿50.00')
    .divider()
    .bold(true)
    .twoColumn('TOTAL', '฿75.00')
    .bold(false)
    .lineFeed(1)
    .alignCenter()
    .line('Thank you for shopping!')
    .cut();

  await sendBytesInChunks(b.getBytes());
  return true;
}

export async function printReceiptViaBluetooth(sale: any, settings: any): Promise<boolean> {
  if (!bluetoothCharacteristic) {
    await connectBluetoothPrinter();
  }

  const currency = settings.currencySymbol || '฿';
  const rate = settings.exchangeRateMMK || 125;
  const dualCurrency = settings.dualCurrencyEnabled;
  const secondarySymbol = settings.secondaryCurrencySymbol || 'Ks';

  const b = new EscPosBuilder();
  b.init()
    .alignCenter()
    .bold(true)
    .doubleSize(true)
    .line(settings.storeName || 'GROCERY FLOW MART')
    .doubleSize(false)
    .bold(false);

  if (settings.address) {
    b.line(settings.address);
  }
  if (settings.phone) {
    b.line('Tel: ' + settings.phone);
  }

  b.divider('=')
    .alignLeft()
    .twoColumn('Receipt #:', (sale.id || 'N/A').slice(0, 8).toUpperCase())
    .twoColumn('Date:', new Date(sale.createdAt?.toDate ? sale.createdAt.toDate() : (sale.createdAt || Date.now())).toLocaleDateString())
    .twoColumn('Time:', new Date(sale.createdAt?.toDate ? sale.createdAt.toDate() : (sale.createdAt || Date.now())).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    .twoColumn('Staff:', sale.staffName || 'Cashier');

  if (sale.customerName) {
    b.twoColumn('Customer:', sale.customerName);
  }

  b.divider('-')
    .bold(true)
    .twoColumn('ITEM', 'QTY  PRICE')
    .bold(false)
    .divider('-');

  // Items
  if (Array.isArray(sale.items)) {
    for (const item of sale.items) {
      const itemTotal = (item.price * item.quantity).toFixed(0);
      b.twoColumn(item.name || 'Product', `${item.quantity}x ${currency}${itemTotal}`);
    }
  }

  b.divider('-')
    .alignRight();

  if (sale.subtotal && sale.discountAmount) {
    b.twoColumn('Subtotal:', `${currency}${(sale.subtotal || 0).toLocaleString()}`);
    b.twoColumn('Discount:', `-${currency}${(sale.discountAmount || 0).toLocaleString()}`);
  }

  if (sale.pointsRedeemed) {
    b.twoColumn('Points Disc:', `-${sale.pointsRedeemed / 10}฿`);
  }

  b.bold(true)
    .doubleSize(true)
    .twoColumn('TOTAL:', `${currency}${(sale.total || 0).toLocaleString()}`)
    .doubleSize(false);

  // Dual Currency equivalent in MMK
  if (dualCurrency) {
    const totalMMK = Math.round((sale.total || 0) * rate);
    b.twoColumn('Equivalent:', `${totalMMK.toLocaleString()} ${secondarySymbol}`);
  }

  b.bold(false)
    .divider('-');

  // Payment Details
  const method = sale.paymentMethod ? sale.paymentMethod.toUpperCase() : 'CASH';
  b.twoColumn('Payment:', method);

  if (sale.paymentMethod === 'cash') {
    b.twoColumn('Received:', `${currency}${(sale.cashReceived || sale.total || 0).toLocaleString()}`);
    b.twoColumn('Change Due:', `${currency}${(sale.changeDue || 0).toLocaleString()}`);
  }

  if (sale.pointsEarned) {
    b.twoColumn('Points Earned:', `+${sale.pointsEarned} pts`);
  }

  b.divider('=')
    .alignCenter()
    .line(settings.receiptFooter || 'Thank you for shopping with us!')
    .line('Powered by Grocery Flow')
    .cut();

  await sendBytesInChunks(b.getBytes());
  return true;
}
