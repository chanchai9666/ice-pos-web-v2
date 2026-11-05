# Initial Zoom Out Review Report (Stage 5)

- **Target File:** `design_draft.md` (Lines 1 to 70)
- **Reviewer:** egm-zoom-out (Skeptical Architect)
- **Date:** 2026-11-04

---

## Executive Summary

เอกสารระบุปัญหาของร้านค้าปลีก (สินค้าไม่มีบาร์โค้ด บาร์โค้ดชำรุด สินค้าแบ่งขาย) ได้ตรงจุด และเลือกแนวทาง **Semi-Automatic UX (แคชเชียร์ยืนยันก่อนหยิบลงตะกร้า)** ได้เหมาะสมกับบริบท เพื่อป้องกันการคิดเงินผิดพลาด อย่างไรก็ตาม มีจุดเสี่ยงเชิงสถาปัตยกรรม (Architectural Bloat & YAGNI) และโอกาสในการนำคอมโพเนนต์เดิมที่มีอยู่ในโปรเจกต์กลับมาใช้ซ้ำที่ต้องปรับปรุง

---

## Findings

### 1. 🔴 Blocker: ความเสี่ยงเรื่อง Incompatible Vector Space จากแนวคิด Dynamic Model Fallback

- **Affected Scope:** `## Open Questions` (บรรทัดที่ 38)
- **Simplicity Rationale:**
  คำถามเปิดข้อที่ 1 เสนอแนวคิดการสลับโมเดลอัตโนมัติ (เช่น สลับระหว่าง ONNX INT8 กับ MobileNet หรือโมเดลอื่นตามขนาดแรมของอุปกรณ์)
  ในทางเทคนิค เวกเตอร์ที่สกัดจากคนละโมเดลหรือคนละสถาปัตยกรรม **ไม่สามารถนำมาคำนวณ Cosine Similarity ข้ามกันได้** (Incompatible Vector Space) หากหน้า Admin ใช้โมเดลหนึ่งสกัดเวกเตอร์เก็บลงฐานข้อมูล แต่เครื่องแคชเชียร์สเปกต่ำ fallback ไปใช้อีกโมเดลหนึ่ง การค้นหาจะผิดเพี้ยนทั้งหมด
- **คำแนะนำ:** ตัดความซับซ้อนเรื่อง Dynamic Model Switching ออกตามหลัก YAGNI และกำหนดให้ใช้ **Canonical Lightweight Quantized Model เพียงตัวเดียว** ที่ผ่านการทดสอบแล้วว่ารันบนแท็บเล็ตหน้าร้านได้โดยไม่แครช (เช่น Quantized MobileNet หรือ CLIP INT8 ตัวเล็ก) ทั้งฝั่ง Admin และ Cashier

---

### 2. 🟡 Major: ละเลยการ Reuse โค้ดกล้องและระบบเสียงที่มีอยู่แล้วใน Codebase

- **Affected Scope:** `## Goals` (บรรทัดที่ 26), `## Critical User Journeys (CUJs)` (บรรทัดที่ 46-51)
- **Simplicity Rationale:**
  เอกสารระบุขั้นตอนการเปิดกล้อง สลับกล้อง เล็งภาพ และส่งเสียง Audio Beep เสมือนเป็นการสร้างระบบขึ้นมาใหม่ทั้งหมด ทั้งที่ใน codebase ปัจจุบันมี:
  1. `BarcodeScannerModal.tsx` ซึ่งมีโค้ดจัดการ MediaStream (`getUserMedia`), การสลับกล้องหน้า/หลัง/Webcam, การเปิด/ปิดไฟฉาย (Torch), การจัดการ permission และ error handling ไว้อย่างสมบูรณ์แล้ว
  2. `audio.ts` มีฟังก์ชัน `playBeepSound()` และ `triggerHapticFeedback()` พร้อมใช้งานอยู่แล้ว
- **คำแนะนำ:** ในส่วนสถาปัตยกรรม ต้องระบุให้ดึงหรือ refactor core logic การควบคุมกล้องและวิดีโอสตรีมจาก `BarcodeScannerModal` มาเป็น hook/utility กลาง (เช่น `useCameraStream`) เพื่อไม่ให้เกิดโค้ดซ้ำซ้อนกว่า 700 บรรทัด

---

### 3. 🟡 Major: YAGNI Scope Creep – ระบบ Telemetry & Accuracy Logs Sync

- **Affected Scope:** `## Open Questions` (บรรทัดที่ 39)
- **Simplicity Rationale:**
  คำถามเปิดข้อที่ 2 เสนอให้จัดเก็บสถิติความแม่นยำและการสแกนสำเร็จ/ล้มเหลวลง IndexedDB เพื่อซิงค์กลับเซิร์ฟเวอร์
  นี่คือตัวอย่างคลาสสิกของ Over-engineering และ YAGNI สำหรับระบบ POS ขนาดเล็ก การสร้าง queue จัดเก็บ telemetry ใน IndexedDB พร้อม retry/sync logic ข้ามเครือข่าย จะเพิ่มจุดเปราะบางและความซับซ้อนให้กับ offline-first storage โดยไม่จำเป็นในระยะแรก
- **คำแนะนำ:** ย้ายเรื่อง Telemetry ไปไว้ใน `## Non-Goals` อย่างชัดเจนใน Phase 1 โดยมุ่งเน้นเฉพาะ Core Feature การสแกนให้ทำงานได้เสถียรและเบาที่สุดก่อน

---

### 4. 🟢 Nit: การจัดการ IndexedDB และ Memory Vector Search

- **Affected Scope:** `## Goals` (บรรทัดที่ 24), `## Critical User Journeys (CUJs)` (บรรทัดที่ 45, 68-70)
- **Simplicity Rationale:**
  ในเอกสารอ้างอิงภายนอกของ Backend มีการแนะนำให้ลงไลบรารี `dexie` เพิ่มเติม แต่ในโปรเจกต์นี้มี `offlineStorage.ts` ที่จัดการ Native IndexedDB และ In-memory cache ไว้อยู่แล้ว
  เนื่องจาก Scope สินค้ามีไม่เกิน 1,000 รายการ (เวกเตอร์ประมาณ 2,000 - 4,000 ชุด):
  - ไม่จำเป็นต้องติดตั้งไลบรารี IndexedDB ตัวใหม่
  - การค้นหาแบบ Cosine Similarity ไม่จำเป็นต้อง query ทีละ record จาก IndexedDB ขณะสแกน แต่ควรโหลดเวกเตอร์ทั้งหมดขึ้นมาพักไว้เป็น `Float32Array` ก้อนเดียวในหน่วยความจำของ Web Worker เมื่อเริ่มต้นการทำงาน เพื่อความเร็วสูงสุดและโค้ดที่เรียบง่าย
- **คำแนะนำ:** บันทึกโครงสร้างการเก็บเวกเตอร์ให้สอดคล้องกับ `offlineStorage.ts` เดิม และระบุการโหลดเวกเตอร์ขึ้น Web Worker memory ให้ชัดเจนในส่วนสถาปัตยกรรมถัดไป
