# ICE POS v2 - Cashier Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างระบบหน้าบ้านขายหน้าร้าน (Cashier POS) สำหรับ ICE POS v2 โดยเชื่อมต่อกับ API Swagger `http://127.0.0.1:8080/swagger/index.html` ออกแบบเน้นผู้สูงอายุใช้งานง่าย ปุ่มสัมผัสใหญ่ คอนทราสต์สูง มี Dark/Light mode และรองรับการทำงานออฟไลน์

**Architecture:** สถาปัตยกรรม Next.js 16 App Router บน React 19 Client/Server Components จัดการสถานะการขายหน้าร้านด้วย React Context / Custom Hooks มี Storage Service แคชข้อมูลแคตตาล็อกและคิวบิลออฟไลน์ลง IndexedDB/LocalStorage และแปลงหน่วยเงิน สตางค์ (Satang) ใน API สลับกับ บาท (Baht) ใน UI อย่างแม่นยำ

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind CSS v4, DaisyUI v5, Lucide React (`lucide-react`)

**Spec:** `docs/superpowers/specs/2026-11-02-ice-pos-cashier-spec.md`

## Global Constraints

- ทุกจำนวนเงินใน API เป็นหน่วย **สตางค์ (Satang - Integer)**; UI แสดงผลเป็น **บาท (Baht - ทศนิยม 2 ตำแหน่ง หรือจำนวนเต็ม)** เสมอ
- การชำระเงินรองรับเฉพาะ `"CASH"` และ `"CREDIT"` ตามสัญญา API ไม่มี QR Code หรือบัตรเครดิต
- ผู้ใช้งานหลักคือผู้สูงอายุ: ขนาดปุ่มกดขั้นต่ำ 48–64px, ตัวอักษร 18–36px, คอนทราสต์สีผ่านมาตรฐาน WCAG 4.5:1
- โหมดออฟไลน์: เมื่อไม่มีสัญญาณอินเทอร์เน็ต สามารถบันทึกการขายได้ทั้ง CASH และ CREDIT โดยสร้าง Local UUID แล้วซิงค์ผ่าน `POST /sync/batch` เมื่อกลับมาออนไลน์
- พนักงานแคชเชียร์สามารถกดยกเลิกบิล (`POST /sales/{id}/void`) และระบุเหตุผลได้ทันที

## Review Focus

1. **Satang / Baht Conversion Rounding Error:** การแปลงค่าเงินระหว่างกรอกจำนวนเงินทศนิยมต้องไม่สูญเสียเศษสตางค์ (เช่น 0.01 บาท ต้องเป็น 1 สตางค์, 50.50 บาท ต้องเป็น 5050 สตางค์)
2. **Offline Credit Customer Lookup:** เมื่อออฟไลน์ รายชื่อลูกค้าในแคชต้องสามารถค้นหาและเลือกผูกกับบิลได้โดยไม่เกิดแครช
3. **Double Click / Rapid Tap on Checkout:** ป้องกันการกดปุ่มชำระเงินซ้ำซ้อนขณะกำลังส่ง API หรือบันทึกลง IndexedDB
4. **Keyboard Wedge Barcode Interception:** เครื่องยิงบาร์โค้ดส่งค่าเร็วพร้อมปุ่ม Enter ต้องไม่ทำให้ฟอร์มรีเฟรช และต้องค้นพบสินค้าลงบิลได้ทันที
5. **Print Media Styling Breakdown:** หน้าพิมพ์ใบเสร็จ 80mm ต้องซ่อนส่วน UI ที่ไม่เกี่ยวข้อง (Header, Cart, Buttons) ทั้งหมดเมื่อสั่ง `window.print()`

---

### Task 1: ติดตั้ง DaisyUI, Lucide Icons และตั้งค่า Theme System (Dark/Light Mode)

**Files:**

- Modify: `package.json`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Create: `src/components/theme/ThemeToggle.tsx`

**Interfaces:**

- Produces: `ThemeToggle: React.FC` (ปุ่มสลับธีมขนาดใหญ่ แสดงไอคอนดวงอาทิตย์/ดวงจันทร์ และข้อความภาษาไทยชัดเจน)
- Produces: CSS Theme variables สำหรับ `light` และ `dark` โทนสีคอนทราสต์สูงสำหรับผู้สูงอายุ

- [ ] **Step 1: เพิ่ม dependency `daisyui@latest` และ `lucide-react` ใน package.json**
- [ ] **Step 2: อัปเดต `src/app/globals.css` เพื่อนำเข้า DaisyUI v5 และกำหนด theme tokens**
  - นำเข้า `@plugin "daisyui"` หรือ `@import "daisyui"` ตามมาตรฐาน Tailwind v4
  - กำหนด custom colors: Primary Blue `#0369A1`, Accent Green `#16A34A`, Destructive `#DC2626`
- [ ] **Step 3: สร้าง `src/components/theme/ThemeToggle.tsx` พร้อมปุ่มสลับธีมขนาด 52px ตัวหนังสือ 18px**
- [ ] **Step 4: ทดสอบรัน `npm run build` เพื่อตรวจว่า CSS และ Tailwind Turbopack คอมไพล์ผ่าน**
- [ ] **Step 5: Commit:** `git commit -m "feat: setup daisyui and high-contrast theme system"`

---

### Task 2: Data Models, TypeScript Interfaces & Currency Utility

**Files:**

- Create: `src/types/api.ts`
- Create: `src/utils/currency.ts`
- Create: `src/utils/currency.test.ts` (หรือสคริปต์ตรวจความถูกต้อง)

**Interfaces:**

- Produces: `satangToBaht(satang: number): number`
- Produces: `bahtToSatang(baht: number): number`
- Produces: `formatBaht(satang: number): string` (เช่น `formatBaht(5000)` -> `"50.00 ฿"`)
- Produces Interfaces: `Product`, `Category`, `Customer`, `Sale`, `SaleItem`, `CheckoutRequest`, `CheckoutResponse`, `Receipt`

- [ ] **Step 1: เขียน Unit Test สำหรับฟังก์ชันแปลงค่าเงิน Satang <-> Baht ใน `src/utils/currency.test.ts`**
  - ตรวจสอบ `satangToBaht(5000) === 50`
  - ตรวจสอบ `bahtToSatang(50.50) === 5050`
  - ตรวจสอบการปัดเศษกรณีทศนิยมลอย `bahtToSatang(19.99) === 1999`
- [ ] **Step 2: สร้าง `src/utils/currency.ts`**
- [ ] **Step 3: สร้าง `src/types/api.ts` นิยาม Types ทั้งหมดตาม Swagger `/swagger/doc.json`**
- [ ] **Step 4: รัน `npm run typecheck` เพื่อยืนยันว่า Type ถูกต้องไม่มีข้อผิดพลาด**
- [ ] **Step 5: Commit:** `git commit -m "feat: define api types and satang currency conversion utilities"`

---

### Task 3: API Client & Offline Storage Service (IndexedDB/LocalStorage)

**Files:**

- Create: `src/services/apiClient.ts`
- Create: `src/services/offlineStorage.ts`
- Create: `src/services/syncService.ts`

**Interfaces:**

- Produces: `apiClient.get/post<T>(path: string, body?: any, token?: string): Promise<T>`
- Produces: `offlineStorage.saveCatalog(products, categories): Promise<void>`
- Produces: `offlineStorage.queueOfflineSale(sale: Sale): Promise<void>`
- Produces: `offlineStorage.getOfflineSales(): Promise<Sale[]>`
- Produces: `syncService.syncOfflineSales(): Promise<{ synced: number, failed: number }>`

- [ ] **Step 1: สร้าง `src/services/apiClient.ts` กำหนด Base URL `http://127.0.0.1:8080/api/v1` จัดการ Bearer Token และดักจับ Network Error**
- [ ] **Step 2: สร้าง `src/services/offlineStorage.ts` จัดการแคช Products, Categories, Customers และเก็บคิวบิล `offline_sales`**
- [ ] **Step 3: สร้าง `src/services/syncService.ts` ส่งข้อมูลบิลออฟไลน์ผ่าน `POST /sync/batch` เมื่อเน็ตกลับมา**
- [ ] **Step 4: ตรวจสอบ Typecheck และทดสอบจำลองเชื่อมต่อ `GET /health`**
- [ ] **Step 5: Commit:** `git commit -m "feat: create api client and offline storage sync service"`

---

### Task 4: ระบบเข้าสู่ระบบด่วนด้วย PIN (Quick PIN Login)

**Files:**

- Create: `src/context/AuthContext.tsx`
- Create: `src/components/auth/PinPad.tsx`
- Create: `src/app/login/page.tsx`
- Modify: `src/app/layout.tsx` (หุ้มด้วย AuthProvider)

**Interfaces:**

- Consumes: `apiClient.post('/auth/pin-login', { pin })`
- Produces: `useAuth(): { user, token, isOffline, loginWithPin, logout }`

- [ ] **Step 1: สร้าง `src/context/AuthContext.tsx` จัดการเซสชันแคชเชียร์ เก็บ Token ในคุกกี้/Storage**
- [ ] **Step 2: สร้าง `src/components/auth/PinPad.tsx` แป้นตัวเลขขนาดใหญ่ (ปุ่มละ 72x72px, ฟอนต์ 28px) พร้อมปุ่มล้าง (Clear) และปุ่มตกลง**
- [ ] **Step 3: สร้าง `src/app/login/page.tsx` แสดงหน้าต่างเข้าสู่ระบบด้วย PIN พร้อมลิงก์สลับไปยัง Username/Password**
- [ ] **Step 4: ตรวจสอบการเข้าสู่ระบบผ่าน API `POST /auth/pin-login` และ redirect ไปหน้าขาย**
- [ ] **Step 5: Commit:** `git commit -m "feat: implement cashier quick pin login"`

---

### Task 5: หน้าจอขายหลัก - แคตตาล็อกสินค้าและค้นหาด่วน (Catalog & Barcode Scanner)

**Files:**

- Create: `src/components/pos/CategoryTabs.tsx`
- Create: `src/components/pos/ProductCard.tsx`
- Create: `src/components/pos/ProductGrid.tsx`
- Create: `src/components/pos/BarcodeScannerInput.tsx`

**Interfaces:**

- Produces: `CategoryTabs: ({ categories, activeCategory, onSelectCategory }) => JSX`
- Produces: `ProductCard: ({ product, onAddToCart }) => JSX` (ขนาดความสูง $\ge 90\text{px}$, ตัวอักษรชื่อ 18–20px, ราคาสีน้ำเงิน/เขียว 24px)
- Produces: `BarcodeScannerInput: ({ onScanBarcode, onSearch }) => JSX` (ดักจับ Keydown Enter จากเครื่องสแกน USB)

- [ ] **Step 1: สร้าง `CategoryTabs.tsx` แสดงหมวดหมู่สินค้าเป็นปุ่มขนาดใหญ่ แตะสลับหมวดหมู่ง่าย**
- [ ] **Step 2: สร้าง `ProductCard.tsx` สำหรับผู้สูงอายุ ขอบหนาชัดเจน คอนทราสต์สูง แสดงชื่อและราคาเป็นบาท**
- [ ] **Step 3: สร้าง `BarcodeScannerInput.tsx` พร้อม Auto-focus และฟังก์ชันค้นหาด่วน**
- [ ] **Step 4: สร้าง `ProductGrid.tsx` รวมหมวดหมู่ ค้นหา และตารางสินค้าแบบ Responsive Grid**
- [ ] **Step 5: Commit:** `git commit -m "feat: implement elder-friendly product catalog and barcode scanner"`

---

### Task 6: ตะกร้าสินค้าและการคำนวณยอดรวม (Cart & Grand Total)

**Files:**

- Create: `src/context/CartContext.tsx`
- Create: `src/components/pos/CartItemRow.tsx`
- Create: `src/components/pos/CartSidebar.tsx`

**Interfaces:**

- Produces: `useCart(): { items, addItem, removeItem, updateQty, clearCart, subtotalSatang, grandTotalSatang }`
- Produces: `CartSidebar: ({ onOpenCheckout }) => JSX`

- [ ] **Step 1: สร้าง `src/context/CartContext.tsx` คำนวณยอดเงินรวมในหน่วยสตางค์อย่างแม่นยำ ไม่ตัดสต็อก**
- [ ] **Step 2: สร้าง `CartItemRow.tsx` แถวรายการสินค้าในบิล พร้อมปุ่มลด `–` และเพิ่ม `+` ขนาด 48x48px**
- [ ] **Step 3: สร้าง `CartSidebar.tsx` แสดงสรุปยอดเงินรวมขนาดใหญ่พิเศษ 36px สีเขียวสดใส พร้อมปุ่ม "💵 ชำระเงิน" ขนาดเต็มจอ**
- [ ] **Step 4: ทดสอบเพิ่ม/ลดสินค้า คำนวณยอดรวม และปุ่มล้างบิล**
- [ ] **Step 5: Commit:** `git commit -m "feat: implement shopping cart context and elder-friendly cart sidebar"`

---

### Task 7: โมดอลคำนวณเงินสดและเงินเชื่อ (Cash & Credit Checkout Modal)

**Files:**

- Create: `src/components/pos/BanknoteButtons.tsx`
- Create: `src/components/pos/Numpad.tsx`
- Create: `src/components/pos/CustomerSelectModal.tsx`
- Create: `src/components/pos/CheckoutModal.tsx`

**Interfaces:**

- Produces: `BanknoteButtons: ({ totalBaht, onSelectAmount }) => JSX` (ปุ่มด่วน: พอดีเงิน, 100 ฿, 500 ฿, 1,000 ฿)
- Produces: `Numpad: ({ value, onChange, onEnter }) => JSX` (ปุ่มตัวเลขขนาด 64x64px)
- Produces: `CheckoutModal: ({ isOpen, onClose, onSuccess }) => JSX`

- [ ] **Step 1: สร้าง `BanknoteButtons.tsx` คำนวณธนบัตรแนะนำจากยอดรวมบิลอัตโนมัติ**
- [ ] **Step 2: สร้าง `Numpad.tsx` แป้นตัวเลขสัมผัสขนาดใหญ่ พร้อมปุ่มล้าง (C) และจุดทศนิยม**
- [ ] **Step 3: สร้าง `CustomerSelectModal.tsx` สำหรับค้นหาและเลือกลูกค้าเงินเชื่อ (`CREDIT`) รองรับทั้งออนไลน์และออฟไลน์**
- [ ] **Step 4: สร้าง `CheckoutModal.tsx` รวมการเลือก CASH/CREDIT, คำนวณเงินทอนตัวเลข 36px สีเขียว และปุ่ม "ยืนยันและพิมพ์ใบเสร็จ" เรียก `POST /sales` หรือบันทึกลง IndexedDB**
- [ ] **Step 5: Commit:** `git commit -m "feat: implement cash banknote numpad and credit checkout modal"`

---

### Task 8: หน้าต่างพิมพ์ใบเสร็จความร้อน 80 มม. (Thermal Receipt Modal & Print View)

**Files:**

- Create: `src/components/pos/ReceiptModal.tsx`
- Create: `src/components/pos/ReceiptPrintView.tsx`
- Modify: `src/app/globals.css` (เพิ่ม CSS `@media print` สำหรับกระดาษ 80mm)

**Interfaces:**

- Produces: `ReceiptModal: ({ isOpen, receiptData, onClose, onPrint }) => JSX`
- Produces: CSS Rule `@media print { .no-print { display: none !important; } .receipt-area { width: 80mm; } }`

- [ ] **Step 1: เพิ่ม CSS Print Styles ใน `globals.css` รองรับกระดาษม้วน 80mm กึ่งกลางหน้ากระดาษ ซ่อน UI อื่น**
- [ ] **Step 2: สร้าง `ReceiptPrintView.tsx` ฟอร์แมตใบเสร็จ: ชื่อร้าน ICE POS, เลขที่บิล, ชื่อแคชเชียร์, วันที่เวลา, รายการสินค้า, ยอดรวม, เงินที่รับ, เงินทอน**
- [ ] **Step 3: สร้าง `ReceiptModal.tsx` แสดงตัวอย่างใบเสร็จบนหน้าจอ พร้อมปุ่ม "🖨️ พิมพ์ใบเสร็จ" (`window.print()`) และปุ่ม "เริ่มบิลใหม่"**
- [ ] **Step 4: ทดสอบสั่งพิมพ์และตรวจสอบการจัดหน้ากระดาษ**
- [ ] **Step 5: Commit:** `git commit -m "feat: implement 80mm thermal receipt modal and print styling"`

---

### Task 9: หน้าประวัติการขายและการยกเลิกบิล (Sales History & Void Dialog)

**Files:**

- Create: `src/components/pos/VoidSaleDialog.tsx`
- Create: `src/components/pos/SalesHistoryModal.tsx`

**Interfaces:**

- Consumes: `GET /sales` (ค้นหาบิลตามช่วงวันที่)
- Consumes: `POST /sales/{id}/void` (ส่งเหตุผลการยกเลิกบิล)
- Produces: `SalesHistoryModal: ({ isOpen, onClose }) => JSX`

- [ ] **Step 1: สร้าง `VoidSaleDialog.tsx` กล่องข้อความยืนยันยกเลิกบิล พร้อมปุ่มตัวเลือกเหตุผลด่วน (ลูกค้าเปลี่ยนใจ, คีย์ผิด) และช่องพิมพ์เหตุผล**
- [ ] **Step 2: สร้าง `SalesHistoryModal.tsx` ตารางประวัติบิลตัวหนังสือใหญ่ แสดงสถานะ ปกติ / ยกเลิกแล้ว (Voided) พร้อมปุ่มพิมพ์ซ้ำและปุ่มยกเลิกบิล**
- [ ] **Step 3: เชื่อมต่อ API `POST /sales/{id}/void` ให้แคชเชียร์กดยกเลิกได้เองทันทีตามสเปก**
- [ ] **Step 4: ทดสอบยกเลิกบิลและตรวจสอบการอัปเดตสถานะในตาราง**
- [ ] **Step 5: Commit:** `git commit -m "feat: implement sales history and direct void sale dialog"`

---

### Task 10: สรุปยอดขายประจำกะ/ประจำวัน (Daily Summary Drawer)

**Files:**

- Create: `src/components/pos/DailySummaryDrawer.tsx`
- Modify: `src/components/pos/HeaderBar.tsx` (เพิ่มปุ่มเปิดสรุปยอด และปุ่มประวัติบิล)

**Interfaces:**

- Consumes: `GET /reports/sales-summary`
- Consumes: `GET /reports/best-sellers`
- Produces: `DailySummaryDrawer: ({ isOpen, onClose }) => JSX`

- [ ] **Step 1: สร้าง `HeaderBar.tsx` แสดงชื่อร้าน, ชื่อแคชเชียร์, สถานะเน็ต 🟢/🟡, ปุ่มสลับ Dark/Light, ปุ่ม "📋 ประวัติบิล", ปุ่ม "📊 สรุปยอดขาย" และปุ่มออกจากระบบ**
- [ ] **Step 2: สร้าง `DailySummaryDrawer.tsx` แสดงสรุปยอดขายรวม, จำนวนบิล, ยอดเงินสด, ยอดเงินเชื่อ และสินค้าขายดี 5 อันดับแรก ตัวเลขขนาดใหญ่ 28–36px**
- [ ] **Step 3: ประกอบ HeaderBar, ProductGrid, CartSidebar เข้ากับ `src/app/page.tsx`**
- [ ] **Step 4: ตรวจสอบการดึงข้อมูลจาก Report API และการแสดงผล**
- [ ] **Step 5: Commit:** `git commit -m "feat: implement daily summary drawer and header bar"`

---

### Task 11: ตรวจทานความสมบูรณ์ ทดสอบระบบ และตรวจสอบการเข้าถึง (Verification & Audit)

**Files:**

- Test/Audit: ทุกหน้าจอและคอมโพเนนต์

- [ ] **Step 1: รัน `npm run typecheck` และ `npm run lint` เพื่อยืนยันว่าไม่มี Error หรือ Warning หลงเหลือ**
- [ ] **Step 2: ทดสอบโฟลว์การขายเต็มรูปแบบ (Full Sales Flow):**
  - ล็อกอินด้วย PIN -> เลือกสินค้าลงตะกร้า -> คำนวณเงินสดพร้อมเงินทอน -> ออกใบเสร็จ -> ดูประวัติบิล -> ยกเลิกบิล
- [ ] **Step 3: ทดสอบการขายออฟไลน์ (Offline Test):**
  - จำลองปิดการเชื่อมต่อเครือข่าย -> ขายสินค้าแบบเงินสดและเงินเชื่อ -> ยืนยันว่าบันทึกลงคิว IndexedDB สำเร็จ -> เปิดเครือข่าย -> ยืนยันการซิงค์ขึ้นเซิร์ฟเวอร์
- [ ] **Step 4: ตรวจสอบ Accessibility & Dark/Light Mode ตามเกณฑ์ `ui-ux-pro-max`:**
  - คอนทราสต์ตัวอักษร $\ge 4.5:1$
  - ขนาด Touch Targets $\ge 48\text{px}$
  - สลับระหว่าง Light/Dark Mode ได้ราบรื่น
- [ ] **Step 5: Commit:** `git commit -m "chore: complete cashier pos system verification and ui audit"`
