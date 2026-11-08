# Đối chiếu ca kiểm thử với hồ sơ gốc

Đường dẫn bộ quality tính từ `code/booking_classroom/quality-tests/`. Các tệp nguồn kiểm thử đi kèm JSON kết quả trong `kiem_thu/`; đây là chỉ mục của kết quả đã có, không phải lần chạy mới.

| Mã ca | Tệp kiểm thử / hồ sơ |
| --- | --- |
| TC01 | `component/authScreens.quality.tsx` |
| TC02 | `unit/bookingRules.quality.ts` |
| TC03 | `unit/accessControl.quality.ts` |
| TC04 | `unit/apiClient.quality.ts` |
| TC05 | `unit/apiClient.quality.ts` |
| TC06 | `unit/notifications.quality.ts` |
| TC07 | App: `src/modules/auto_approval/__tests__/autoApproval.test.ts`; `kiem_thu/app-results.json`. |
| TC08 | `kiem_thu/notification-permission.test.js`, `permission-results.json`; Android D05. |
| TC09 | Android D06: `kiem_thu/persistence-result.json`, ảnh/XML trước và sau force-stop. |
| TC10 | `kiem_thu/nghiem_thu_he_thong.md`: kết quả vận hành app–SmartLock do nhóm xác nhận. |
| TC11 | `unit/bookingRules.quality.ts` |
| TC12 | `unit/bookingRules.quality.ts` |
| TC13 | `unit/accessControl.quality.ts` |
| TC14 | `unit/accessControl.quality.ts`; `integration/endToEndWorkflows.quality.ts` |
| TC15 | `unit/bookingLifecycle.quality.ts`; `integration/endToEndWorkflows.quality.ts` |
| TC16 | `unit/roomRepository.quality.ts`; `unit/accountRepository.quality.ts`; `unit/configurationAndProfile.quality.ts` |
| TC17 | `unit/accountRepository.quality.ts`; `component/authScreens.quality.tsx` |
| TC18 | `unit/roomRepository.quality.ts` |
| TC19 | `unit/bookingLifecycle.quality.ts`; `integration/endToEndWorkflows.quality.ts` |
| TC20 | `unit/bookingLifecycle.quality.ts`; `unit/bookingRules.quality.ts` |
| TC21 | `unit/bookingRules.quality.ts`; `unit/bookingLifecycle.quality.ts` |
| TC22 | `unit/bookingLifecycle.quality.ts`; `integration/endToEndWorkflows.quality.ts` |
| TC23 | `unit/bookingLifecycle.quality.ts`; `component/bookingComponents.quality.tsx`; `integration/endToEndWorkflows.quality.ts` |
| TC24 | Backend: `src/test/java/com/bookingclassroom/server/RemoteSyncIntegrationTest.java`; báo cáo kiểm thử H2. |
