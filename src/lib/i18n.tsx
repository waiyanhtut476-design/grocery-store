import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'th' | 'en' | 'my';

interface Translations {
  [key: string]: {
    [lang in Language]: string;
  };
}

export const translations: Translations = {
  dashboard: { th: 'แดชบอร์ด', en: 'Dashboard', my: 'ဒိုင်ခွက်' },
  pos: { th: 'ขายหน้าร้าน', en: 'Point of Sale', my: 'အရောင်းဌာန' },
  inventory: { th: 'คลังสินค้า', en: 'Inventory', my: 'ကုန်ပစ္စည်းစာရင်း' },
  history: { th: 'ประวัติการขาย', en: 'Sales History', my: 'အရောင်းမှတ်တမ်း' },
  tasks: { th: 'งาน', en: 'Tasks', my: 'လုပ်ဆောင်ရန်များ' },
  today_sales: { th: 'ยอดขายวันนี้', en: "Today's Sales", my: 'ယနေ့အရောင်း' },
  items: { th: 'รายการ', en: 'Items', my: 'ခု' },
  low_stock: { th: 'สินค้าใกล้หมด', en: 'Low Stock', my: 'ကုန်ပစ္စည်းနည်းနေသည်' },
  transactions: { th: 'ธุรกรรม', en: 'Transactions', my: 'အရောင်းအဝယ်များ' },
  scan_barcode: { th: 'สแกนบาร์โค้ด', en: 'Scan Barcode', my: 'ဘားကုတ်စကင်န်ဖတ်ရန်' },
  add_product: { th: 'เพิ่มสินค้า', en: 'Add Product', my: 'ကုန်ပစ္စည်းထည့်ရန်' },
  search_placeholder: { th: 'ค้นหาชื่อหรือบาร์โค้ด...', en: 'Search name or barcode...', my: 'ရှာဖွေရန်...' },
  product_name: { th: 'ชื่อสินค้า', en: 'Product Name', my: 'ကုန်ပစ္စည်းအမည်' },
  price: { th: 'ราคา', en: 'Price', my: 'ဈေးနှုန်း' },
  cost_price: { th: 'ราคาทุน', en: 'Cost Price', my: 'ရင်းဈေး' },
  stock: { th: 'คงเหลือ', en: 'Stock', my: 'လက်ကျန်' },
  unit: { th: 'หน่วยนับ', en: 'Unit', my: 'ယူနစ်' },
  category: { th: 'หมวดหมู่', en: 'Category', my: 'အမျိုးအစား' },
  product_id: { th: 'รหัสสินค้า', en: 'Product ID', my: 'ကုန်ပစ္စည်းကုဒ်' },
  actions: { th: 'การจัดการ', en: 'Actions', my: 'လုပ်ဆောင်ချက်များ' },
  cart: { th: 'ตะกร้า', en: 'Cart', my: 'ဈေးဝယ်လှည်း' },
  checkout: { th: 'ชำระเงิน', en: 'Checkout', my: 'ငွေရှင်းရန်' },
  total: { th: 'ยอดรวม', en: 'Total', my: 'စုစုပေါင်း' },
  clear_all: { th: 'ล้างทั้งหมด', en: 'Clear All', my: 'အားလုံးဖျက်ရန်' },
  sign_out: { th: 'ออกจากระบบ', en: 'Sign Out', my: 'ထွက်ရန်' },
  profit: { th: 'กำไรวันนี้', en: "Today's Profit", my: 'ယနေ့အမြတ်' },
  cart_empty: { th: 'ไม่มีสินค้าในตะกร้า', en: 'Your cart is empty', my: 'ဈေးဝယ်လှည်းထဲတွင် ဘာမှမရှိပါ' },
  add_task_placeholder: { th: 'วันนี้ต้องทำอะไรบ้าง?', en: 'What needs to be done today?', my: 'ဒီနေ့ ဘာလုပ်စရာရှိလဲ?' },
  tasks_completed: { th: 'งานทั้งหมดเสร็จสิ้นแล้ว!', en: 'All tasks completed!', my: 'အလုပ်အားလုံး ပြီးစီးပါပြီ!' },
  manage_inventory: { th: 'จัดการสต็อกสินค้าและรายละเอียด', en: 'Manage your product stock and details.', my: 'ကုန်ပစ္စည်းစာရင်းနှင့် အသေးစိတ်ကို စီမံရန်' },
  manage_tasks: { th: 'ติดตามการดำเนินงานประจำวัน', en: 'Track daily store operations and duties.', my: 'နေ့စဉ်လုပ်ငန်းဆောင်တာများကို မှတ်တမ်းတင်ရန်' },
  view_history: { th: 'ดูและส่งออกประวัติการขาย', en: 'View and export past transactions.', my: 'အရောင်းမှတ်တမ်းများကို ကြည့်ရှုပြီး ထုတ်ယူရန်' },
  no_products_found: { th: 'ไม่พบสินค้าที่ค้นหา', en: 'No products found matching your search.', my: 'ရှာဖွေနေသော ကုန်ပစ္စည်း မတွေ့ပါ' },
  update: { th: 'อัปเดต', en: 'Update', my: 'ပြင်ဆင်ရန်' },
  add: { th: 'เพิ่ม', en: 'Add', my: 'ထည့်ရန်' },
  cancel: { th: 'ยกเลิก', en: 'Cancel', my: 'ပယ်ဖျက်ရန်' },
  edit_product: { th: 'แก้ไขสินค้า', en: 'Edit Product', my: 'ကုန်ပစ္စည်းပြင်ရန်' },
  transaction: { th: 'รายการขาย', en: 'Transaction', my: 'အရောင်းအဝယ်' },
  staff: { th: 'พนักงาน', en: 'Staff', my: 'ဝန်ထမ်း' },
  export_excel: { th: 'ส่งออก Excel', en: 'Export Excel', my: 'Excel ထုတ်ရန်' },
  time: { th: 'เวลา', en: 'Time', my: 'အချိန်' },
  quick_actions: { th: 'เมนูด่วน', en: 'Quick Actions', my: 'ဖြတ်လမ်းများ' },
  process_sale: { th: 'ดำเนินการขายสินค้า', en: 'Process a customer purchase', my: 'အရောင်းလုပ်ငန်းစဉ် လုပ်ဆောင်ရန်' },
  restock_item: { th: 'เติมสต็อกหรือเพิ่มสินค้าใหม่', en: 'Restock or add new item', my: 'ကုန်ပစ္စည်းအသစ်ထည့်ရန် သို့မဟုတ် အသစ်ဖြည့်ရန်' },
  download_excel: { th: 'ดาวน์โหลดสินค้าเป็นไฟล์ Excel', en: 'Download inventory as Excel', my: 'ကုန်ပစ္စည်းစာရင်းကို Excel ဖြင့် ဒေါင်းလုဒ်လုပ်ရန်' },
  welcome_back: { th: 'ยินดีต้อนรับกลับสู่ Grocery Flow', en: 'Welcome back to Grocery Flow.', my: 'Grocery Flow မှ ပြန်လည်ကြိုဆိုပါတယ်' },
  recent_transactions: { th: 'ธุรกรรมล่าสุด', en: 'Recent Transactions', my: 'လတ်တလော အရောင်းအဝယ်များ' },
  view_all: { th: 'ดูทั้งหมด', en: 'View All', my: 'အားလုံးကြည့်ရန်' },
  no_transactions_today: { th: 'วันนี้ยังไม่มีรายการขาย', en: 'No transactions today', my: 'ဒီနေ့အတွက် အရောင်းအဝယ်မရှိသေးပါ' },
  capture: { th: 'ถ่ายรูป', en: 'Capture', my: 'ဓာတ်ပုံရိုက်ရန်' },
  barcode: { th: 'บาร์โค้ด', en: 'Barcode', my: 'ဘားကုတ်' },
  image: { th: 'รูปภาพ', en: 'Image', my: 'ဓာတ်ပုံ' },
  photo: { th: 'Photo', en: 'Photo', my: 'ဓာတ်ပုံ' },
  item_name: { th: 'Item Name', en: 'Item Name', my: 'ကုန်ပစ္စည်းအမည်' },
  expiry_date: { th: 'วันหมดอายุ', en: 'Expiry Date', my: 'သက်တမ်းကုန်ဆုံးရက်' },
  purchase_price: { th: 'ราคาซื้อ', en: 'Purchase Price', my: 'ဝယ်ဈေး' },
  selling_price: { th: 'ราคาขาย', en: 'Selling Price', my: 'ရောင်းဈေး' },
  stock_remaining: { th: 'จำหน่วยสิ้นค้าคงเหลือ', en: 'Stock Remaining', my: 'လက်ကျန်အရေအတွက်' },
  min_stock: { th: 'จำหน่วยขั้นတ้ำ', en: 'Min Stock', my: 'အနည်းဆုံးသတ်မှတ်ချက်' },
  category_header: { th: 'Category', en: 'Category', my: 'အမျိုးအစား' },
  expired: { th: 'หมดอายุแล้ว', en: 'Expired', my: 'သက်တမ်းကုန်' },
  expiring_soon: { th: 'ใกล้หมดอายุ', en: 'Expiring Soon', my: 'သက်တမ်းကုန်လုနီးပါး' },
  low_stock_alert_title: { 
    th: 'แจ้งเตือนผู้จัดการ: มีสินค้าต่ำกว่าเกณฑ์ขั้นต่ำ', 
    en: 'Manager Alert: Items Below Minimum Stock Level', 
    my: 'မန်နေဂျာသတိပေးချက် - အနည်းဆုံးသတ်မှတ်ချက်အောက် ရောက်နေသော ပစ္စည်းများ' 
  },
  items_need_restock: { 
    th: 'รายการสินค้าที่ต้องเติมสต็อกด่วน', 
    en: 'Items requiring immediate restock', 
    my: 'ချက်ချင်းစတော့ဖြည့်တင်းရန် လိုအပ်သော ကုန်ပစ္စည်းများ' 
  },
  out_of_stock: { th: 'สินค้าหมด', en: 'Out of Stock', my: 'ပစ္စည်းကုန်နေပါသည်' },
  critical_stock: { th: 'วิกฤต', en: 'Critical Low', my: 'လွန်စွာနည်းပါး' },
  quick_restock: { th: 'เติมสต็อกด่วน', en: 'Quick Restock', my: 'အမြန်စတော့ဖြည့်ရန်' },
  restock_success: { th: 'เติมสต็อกสำเร็จ', en: 'Restocked successfully', my: 'စတော့ဖြည့်သွင်းပြီးပါပြီ' },
  all_stock_healthy: { th: 'สต็อกสินค้าทั้งหมดอยู่ในเกณฑ์ปกติ', en: 'All stock levels are healthy', my: 'ကုန်ပစ္စည်းအားလုံး စတော့လုံလောက်မှုရှိပါသည်' },
  reorder_needed: { th: 'ต้องเติมเพิ่ม', en: 'Need to add', my: 'ထပ်မံဖြည့်ရန်' },
  view_all_inventory: { th: 'ไปที่คลังสินค้า', en: 'Go to Inventory', my: 'ကုန်ပစ္စည်းစာရင်းသို့ သွားရန်' },
  description: { th: 'รายละเอียด', en: 'Description', my: 'အသေးစိတ်အချက်အလက်' },
  payment_method: { th: 'วิธีชำระเงิน', en: 'Payment Method', my: 'ငွေပေးချေမှုပုံစံ' },
  cash: { th: 'เงินสด', en: 'Cash', my: 'ငွေသား' },
  promptpay_qr: { th: 'พร้อมเพย์ / QR Code', en: 'PromptPay / QR', my: 'PromptPay / QR ကုဒ်' },
  card: { th: 'บัตรเดบิต/เครดิต', en: 'Card', my: 'ကတ်' },
  cash_received: { th: 'รับเงินมา', en: 'Cash Received', my: 'လက်ခံရရှိငွေ' },
  change_due: { th: 'เงินทอน', en: 'Change Due', my: 'အမ်းငွေ' },
  exact: { th: 'พอดี', en: 'Exact', my: 'တိကျသောပမာဏ' },
  discount: { th: 'ส่วนลด', en: 'Discount', my: 'လျှော့ဈေး' },
  discount_percent: { th: 'เปอร์เซ็นต์ (%)', en: 'Percent (%)', my: 'ရာခိုင်နှုန်း (%)' },
  discount_amount: { th: 'จำนวนเงิน (฿)', en: 'Amount (฿)', my: 'ပမာဏ (฿)' },
  no_discount: { th: 'ไม่มีส่วนลด', en: 'No Discount', my: 'လျှော့ဈေးမရှိ' },
  receipt: { th: 'ใบเสร็จรับเงิน', en: 'Receipt', my: 'ပြေစာ / ဘောက်ချာ' },
  print_receipt: { th: 'พิมพ์ใบเสร็จ (Print)', en: 'Print Receipt', my: 'ပြေစာ Print ထုတ်ရန်' },
  reprint: { th: 'ดู / พิมพ์ใบเสร็จ', en: 'View Receipt', my: 'ဘောက်ချာကြည့် / ထုတ်ရန်' },
  import_csv: { th: 'นำเข้า Excel/CSV', en: 'Import Excel/CSV', my: 'Excel/CSV စာရင်းသွင်းရန်' },
  export_csv: { th: 'ส่งออก CSV/Excel', en: 'Export CSV', my: 'CSV/Excel ထုတ်ရန်' },
  quick_restock_stock: { th: 'เติมสต็อกด่วน', en: 'Quick Restock', my: 'အမြန်စတော့ဖြည့်ရန်' },
  all_categories: { th: 'ทุกหมวดหมู่', en: 'All Categories', my: 'အမျိုးအစားအားလုံး' },
  today: { th: 'วันนี้', en: 'Today', my: 'ယနေ့' },
  yesterday: { th: 'เมื่อวาน', en: 'Yesterday', my: 'မနေ့က' },
  this_week: { th: 'สัปดาห์นี้', en: 'This Week', my: 'ယခုအပတ်' },
  this_month: { th: 'เดือนนี้', en: 'This Month', my: 'ယခုလ' },
  all_time: { th: 'ทั้งหมด', en: 'All Time', my: 'အားလုံး' },
  subtotal: { th: 'ยอดรวมย่อย', en: 'Subtotal', my: 'စုစုပေါင်း မူရင်းဈေး' },
  net_total: { th: 'ยอดสุทธิ', en: 'Net Total', my: 'စုစုပေါင်း အသားတင်' },
  thank_you_visit: { th: 'ขอบคุณที่ใช้บริการ!', en: 'Thank you for shopping with us!', my: 'ဝယ်ယူအားပေးမှုကို ကျေးဇူးအထူးတင်ရှိပါသည်!' },
  insufficient_cash: { th: 'ยอดเงินที่รับมาไม่พอ', en: 'Insufficient cash received', my: 'ပေးငွေသည် စုစုပေါင်းထက် နည်းနေပါသည်' },
  close: { th: 'ปิด', en: 'Close', my: 'ပိတ်ရန်' },
  voucher_no: { th: 'เลขที่ใบเสร็จ', en: 'Receipt #', my: 'ပြေစာအမှတ်' },
  date_time: { th: 'วันที่ / เวลา', en: 'Date / Time', my: 'ရက်စွဲ / အချိန်' },
  cashier: { th: 'พนักงานขาย', en: 'Cashier', my: 'ငွေကိုင်' },
  store_name: { th: 'Grocery Flow Mart', en: 'Grocery Flow Mart', my: 'Grocery Flow ကုန်စုံဆိုင်' },
  store_address: { th: 'ร้านสะดวกซื้อ สาขาหลัก', en: 'Main Branch Grocery Store', my: 'အဓိကစတိုးဆိုင်ခွဲ' },
  store_tel: { th: 'โทร: 02-123-4567', en: 'Tel: 02-123-4567', my: 'ဖုန်း: 02-123-4567' },
  confirm_payment: { th: 'ยืนยันการชำระเงิน', en: 'Confirm Payment', my: 'ငွေပေးချေမှုကို အတည်ပြုမည်' },
  scan_qr_prompt: { th: 'สแกน QR Code เพื่อชำระเงิน', en: 'Scan QR Code to pay', my: 'ငွေပေးချေရန် QR Code စကင်န်ဖတ်ပါ' },
  card_swipe_prompt: { th: 'เสียบหรือแตะบัตรเพื่อชำระ', en: 'Insert or tap card to pay', my: 'ကတ်ဖြင့် ငွေပေးချေပါ' },
  upload_file: { th: 'เลือกไฟล์ (.csv หรือ .xlsx)', en: 'Select file (.csv or .xlsx)', my: 'ဖိုင်ရွေးချယ်ပါ (.csv သို့မဟုတ် .xlsx)' },
  import_preview: { th: 'ตัวอย่างข้อมูลที่นำเข้า', en: 'Import Preview', my: 'သွင်းမည့် အချက်အလက်များ' },
  confirm_import: { th: 'ยืนยันการนำเข้า', en: 'Confirm Import', my: 'သွင်းယူမှုကို အတည်ပြုပါ' },
  importing: { th: 'กำลังนำเข้า...', en: 'Importing...', my: 'သွင်းယူနေပါသည်...' },
  sales_summary: { th: 'สรุปยอดขาย', en: 'Sales Summary', my: 'အရောင်းအချုပ်' },
  total_revenue: { th: 'รายได้รวม', en: 'Total Revenue', my: 'စုစုပေါင်း ဝင်ငွေ' },
  est_profit: { th: 'กำไรประมาณการ', en: 'Est. Profit', my: 'ခန့်မှန်း အမြတ်' },
  total_orders: { th: 'จำนวนออเดอร์', en: 'Total Orders', my: 'အရောင်းအဝယ် စုစုပေါင်း' },
  settings: { th: 'ตั้งค่าร้านค้า', en: 'Settings', my: 'ဆိုင်ဆက်တင်များ' },
  customers: { th: 'ลูกค้า & สมาชิก', en: 'Customers', my: 'ဖောက်သည်နှင့် အသင်းဝင်' },
  shifts: { th: 'กะและลิ้นชักเงิน', en: 'Shift & Cash Drawer', my: 'ငွေစာရင်းချုပ် / အဆိုင်း' },
  barcode_labels: { th: 'พิมพ์บาร์โค้ด', en: 'Barcode Labels', my: 'ဘားကုတ်စတစ်ကာ ထုတ်ရန်' },
  store_settings: { th: 'ข้อมูลร้านค้า & ใบเสร็จ', en: 'Store & Receipt Settings', my: 'ဆိုင်အချက်အလက်နှင့် ပြေစာပြင်ဆင်ခြင်း' },
  currency_symbol: { th: 'สัญลักษณ์สกุลเงิน', en: 'Currency Symbol', my: 'ငွေကြေးသင်္ကေတ' },
  tax_settings: { th: 'การตั้งค่าภาษี / VAT', en: 'Tax / VAT Settings', my: 'အခွန် / VAT သတ်မှတ်ချက်' },
  enable_tax: { th: 'คิดภาษีในใบเสร็จ (VAT)', en: 'Calculate VAT / Tax', my: 'အခွန် / VAT ထည့်တွက်မည်' },
  tax_rate: { th: 'อัตราภาษี (%)', en: 'Tax Rate (%)', my: 'အခွန်နှုန်း (%)' },
  receipt_footer: { th: 'ข้อความท้ายใบเสร็จ', en: 'Receipt Footer Message', my: 'ဘောက်ချာအောက်ခြေ စာသား' },
  save_settings: { th: 'บันทึกการตั้งค่า', en: 'Save Settings', my: 'ဆက်တင်များ သိမ်းဆည်းရန်' },
  add_customer: { th: 'เพิ่มลูกค้าใหม่', en: 'Add Customer', my: 'ဖောက်သည်အသစ်ထည့်ရန်' },
  edit_customer: { th: 'แก้ไขข้อมูลลูกค้า', en: 'Edit Customer', my: 'ဖောက်သည်အချက်အလက် ပြင်ရန်' },
  customer_name: { th: 'ชื่อลูกค้า', en: 'Customer Name', my: 'ဖောက်သည်အမည်' },
  phone_number: { th: 'เบอร์โทรศัพท์', en: 'Phone Number', my: 'ဖုန်းနံပါတ်' },
  points: { th: 'แต้มสะสม', en: 'Points', my: 'အမှတ်များ' },
  credit_debt: { th: 'ยอดค้างชำระ (หนี้)', en: 'Credit Debt', my: 'ပေးရန်ကျန် အကြွေး' },
  settle_debt: { th: 'ชำระหนี้ค้าง', en: 'Settle Debt', my: 'ကြွေးကျန်ဆပ်ရန်' },
  debt_settled_success: { th: 'บันทึกการชำระหนี้สำเร็จ', en: 'Debt settled successfully', my: 'ကြွေးကျန်ဆပ်ပြီးပါပြီ' },
  on_credit: { th: 'ติดค้างชำระ (เงินเชื่อ)', en: 'On Credit (Pay Later)', my: 'အကြွေးဝယ်ယူမှု' },
  select_customer: { th: 'สมาชิกลูกค้า (สะสมแต้ม/ลงบัญชี)', en: 'Customer (Points / Credit)', my: 'ဖောက်သည်အမည် (အမှတ်စု/အကြွေး)' },
  redeem_points: { th: 'ใช้แต้มแลกส่วนลด', en: 'Redeem Points', my: 'အမှတ်ဖြင့် လျှော့ဈေးယူမည်' },
  open_shift: { th: 'เปิดกะ (เริ่มต้นวัน)', en: 'Open Shift', my: 'အဆိုင်းဖွင့်ရန် (အဖွင့်ငွေ)' },
  close_shift: { th: 'ปิดกะ (สรุปยอดประจำวัน)', en: 'Close Shift (Z-Report)', my: 'အဆိုင်းပိတ်/စာရင်းချုပ် (Z-Report)' },
  active_shift: { th: 'กะที่กำลังเปิดอยู่', en: 'Active Shift', my: 'လက်ရှိ အဆိုင်း' },
  opening_cash: { th: 'เงินทอนเริ่มต้นในลิ้นชัก (฿)', en: 'Opening Cash Float (฿)', my: 'အံဆွဲထဲ စထည့်ငွေ (฿)' },
  expected_cash: { th: 'เงินสดที่ควรมีในลิ้นชัก (฿)', en: 'Expected Cash in Drawer (฿)', my: 'အံဆွဲထဲ ရှိသင့်သောငွေ (฿)' },
  actual_cash: { th: 'เงินสดที่นับได้จริง (฿)', en: 'Actual Cash Counted (฿)', my: 'လက်တွေ့ ရေတွက်ရရှိငွေ (฿)' },
  cash_diff: { th: 'ผลต่างเงินสด (เกิน/ขาด)', en: 'Cash Difference (Over/Short)', my: 'ကွာဟငွေ (ပို/လို)' },
  shift_summary: { th: 'ใบสรุปยอดปิดกะ (Z-Report)', en: 'Shift Closing Summary (Z-Report)', my: 'နေ့စဉ်ငွေစာရင်းချုပ် (Z-Report)' },
  print_z_report: { th: 'พิมพ์ Z-Report', en: 'Print Z-Report', my: 'Z-Report Print ထုတ်ရန်' },
  label_quantity: { th: 'จำนวนดวงต่อสินค้า', en: 'Quantity per item', my: 'ပစ္စည်းတစ်ခုစီအတွက် စတစ်ကာအရေအတွက်' },
  print_labels: { th: 'พิมพ์สติ๊กเกอร์บาร์โค้ด', en: 'Print Barcode Labels', my: 'ဘားကုတ်စတစ်ကာ Print ထုတ်ရန်' },
  select_products_for_labels: { th: 'เลือกสินค้าที่จะพิมพ์บาร์โค้ด', en: 'Select products to print barcodes', my: 'ဘားကုတ်ထုတ်မည့် ကုန်ပစ္စည်းများ ရွေးချယ်ပါ' },
  earned_points: { th: 'แต้มที่ได้รับ', en: 'Points Earned', my: 'ရရှိသော အမှတ်' },
  no_active_shift: { th: 'ยังไม่ได้เปิดกะขาย', en: 'No active shift open', my: 'အရောင်းအဆိုင်း မဖွင့်ရသေးပါ' },
  shift_opened_success: { th: 'เปิดกะเรียบร้อยแล้ว', en: 'Shift opened successfully', my: 'အရောင်းအဆိုင်း စတင်ဖွင့်လှစ်ပါပြီ' },
  shift_closed_success: { th: 'ปิดกะและบันทึกรายงานแล้ว', en: 'Shift closed successfully', my: 'အဆိုင်းပိတ်ပြီး စာရင်းချုပ်သိမ်းဆည်းပါပြီ' },
  void_refund: { th: 'คืนเงิน / ยกเลิกบิล', en: 'Refund / Void Sale', my: 'ငွေပြန်အမ်း / ဘောက်ချာဖျက်သိမ်းခြင်း' },
  void_sale_confirm: { th: 'คุณต้องการยกเลิกบิลนี้และคืนสต็อกใช่หรือไม่?', en: 'Are you sure you want to void this transaction and return stock?', my: 'ဤအရောင်းဘောက်ချာကို ပယ်ဖျက်ပြီး ပစ္စည်းစတော့ခ် ပြန်ဖြည့်လိုပါသလား?' },
  voided: { th: 'ยกเลิกแล้ว (คืนสินค้า)', en: 'Voided / Refunded', my: 'ပယ်ဖျက်ပြီး / ပြန်အပ်ပြီး' },
  void_reason: { th: 'เหตุผลการยกเลิก', en: 'Void / Refund Reason', my: 'ပယ်ဖျက်ရသည့် အကြောင်းပြချက်' },
  top_selling: { th: 'สินค้าขายดี 5 อันดับแรก', en: 'Top 5 Selling Items', my: 'အရောင်းရဆုံး ပစ္စည်း ထိပ်တန်း ၅ မျိုး' },
  top_profit: { th: 'สินค้าทำกำไรสูงสุด 5 อันดับ', en: 'Top 5 Most Profitable Items', my: 'အမြတ်အများဆုံး ပစ္စည်း ထိပ်တန်း ၅ မျိုး' },
  hardware_scanner_ready: { th: 'เครื่องยิงบาร์โค้ดพร้อมใช้งาน', en: 'Hardware Barcode Gun Ready', my: 'ဟာ့ဒ်ဝဲဘားကုတ်သေနတ် အဆင်သင့်ဖြစ်ပါပြီ' },
  suppliers: { th: 'ผู้ผลิต & ซัพพลายเออร์', en: 'Suppliers & Stock-In', my: 'ကုန်ပစ္စည်းပေးသွင်းသူများ & အဝယ်' },
  add_supplier: { th: 'เพิ่มซัพพลายเออร์', en: 'Add Supplier', my: 'ပေးသွင်းသူအသစ်ထည့်ရန်' },
  supplier_name: { th: 'ชื่อซัพพลายเออร์ / บริษัท', en: 'Supplier / Company Name', my: 'ကုမ္ပဏီ / ပေးသွင်းသူအမည်' },
  new_stock_in: { th: 'รับสินค้าเข้าสต็อก (PO)', en: 'New Stock-In / Purchase', my: 'ကုန်ပစ္စည်း အဝယ်သွင်းခြင်း' },
  invoice_number: { th: 'เลขที่ใบส่งของ / อินวอยซ์', en: 'Invoice / Delivery #', my: 'အဝယ်ဘောက်ချာနံပါတ်' },
  damage_writeoff: { th: 'บันทึกสินค้าชำรุด / เสียหาย / หมดอายุ', en: 'Damage & Expiry Waste Write-Off', my: 'ပျက်စီး / သက်တမ်းလွန် ပစ္စည်းစာရင်းမှ ပယ်ဖျက်ခြင်း' },
  record_damage: { th: 'ตัดสต็อกชำรุด / หมดอายุ', en: 'Record Waste / Damage', my: 'ဆုံးရှုံးမှု မှတ်တမ်းတင်ရန်' },
  damage_reason: { th: 'สาเหตุการตัดจำหน่าย', en: 'Loss Reason', my: 'စွန့်ပစ်ရသည့် အကြောင်းရင်း' },
  damaged: { th: 'ชำรุด / เสียหาย', en: 'Damaged / Broken', my: 'ကွဲအက် / ပျက်စီး' },
  loss_amount: { th: 'มูลค่าความเสียหาย', en: 'Total Loss Amount', my: 'စုစုပေါင်း ဆုံးရှုံးမှုတန်ဖိုး' },
  units_sold: { th: 'ชิ้นที่ขายได้', en: 'units sold', my: 'ခု ရောင်းရပြီး' },
  profit_earned: { th: 'กำไรที่ได้', en: 'profit', my: 'အမြတ်ငွေ' },
  supplier_list: { th: 'รายชื่อซัพพลายเออร์', en: 'Supplier Directory', my: 'ကုန်ပစ္စည်းပေးသွင်းသူများစာရင်း' },
  purchase_history: { th: 'ประวัติการรับสินค้า', en: 'Stock-In History', my: 'အဝယ်သွင်းထားသော မှတ်တမ်းများ' },
  waste_history: { th: 'ประวัติสินค้าตัดจำหน่าย', en: 'Waste & Loss Logs', my: 'ဆုံးရှုံးမှုမှတ်တမ်းဟောင်းများ' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('app_lang') as Language;
    return saved || 'en';
  });

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('app_lang', lang);
  };

  const t = (key: string) => {
    return translations[key]?.[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
