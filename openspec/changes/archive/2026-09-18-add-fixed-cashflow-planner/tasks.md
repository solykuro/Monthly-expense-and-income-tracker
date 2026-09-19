## 1. 專案建置

- [x] 1.1 以 Vite 建立 React + TypeScript 專案，設定 `tsconfig` 為 strict，建立 `src/domain/`、`src/db/`、`src/features/` 目錄
- [x] 1.2 安裝並設定 Vitest、@testing-library/react、jsdom、fake-indexeddb，確認 `npm test` 可執行空測試
- [x] 1.3 安裝 Dexie、chart.js、react-chartjs-2、vite-plugin-pwa
- [x] 1.4 建立全域樣式：色彩變數（含紅色負數）、行動版基本版面、最小點擊區域 44px

## 2. 資料層（src/domain、src/db）

- [x] 2.1 在 `src/domain/types.ts` 定義 `Month`、`BudgetItem`、`AmountChange`、`Settings`、`Category`、`Frequency`，以及分類常數與週期月數對照
- [x] 2.2 [P] 在 `src/domain/month.ts` 實作月份工具：`toIndex`、`fromIndex`、`addMonths`、`compare`、`currentMonth(date)`、`displayDate(month, day)`（超出天數取月底）
- [x] 2.3 [P] 在 `src/domain/validation.ts` 實作項目、異動紀錄、設定的驗證函式，回傳欄位與錯誤訊息（訊息文字依 spec）
- [x] 2.4 在 `src/domain/occurrence.ts` 實作 `occursIn(item, month)`、`amountAt(item, month)`、`nextOccurrence(item, fromMonth)`、`previousOccurrence(item, beforeMonth)`
- [x] 2.5 在 `src/db/db.ts` 建立 Dexie 資料庫（`items`、`settings`），並在 `src/db/repository.ts` 提供項目 CRUD、讀寫設定（預設 `initialReserve: 0`、`horizonYears: 5`）、`replaceAll(settings, items)`（單一交易）

## 3. 推演邏輯（src/domain/projection.ts）

- [x] 3.1 實作初始預留金分配：依下一次發生月份與 `createdAt` 排序分配，回傳各項目起始餘額與未分配預留金
- [x] 3.2 實作單一非每月支出項目的逐月預留計算（design 第 6 點演算法），輸出每月 `contribution`、`payment`、月底 `balance` 與是否追趕
- [x] 3.3 實作 `project(items, settings, startMonth)`：產生每月 `income`、`monthlyExpense`、`reserve`、`paidFromReserve`、`investable`、`reserveBalance`、當月明細（發生項目與各項目應預留）
- [x] 3.4 實作 `aggregateByYear(monthlyRows)`：依日曆年加總並標記部分年度
- [x] 3.5 實作 `deficitWarnings(rows)` 與 `catchUpNotices(rows)`：輸出入不敷出月份，以及各項目追趕的月份範圍、最高／最低應預留、平時應預留金額

## 4. 介面

- [x] 4.1 建立 App 外殼與底部分頁（總覽／項目／設定），預設顯示總覽；首次啟動呼叫 `navigator.storage.persist()`（不支援時略過）
- [x] 4.2 建立資料 hook（例如 `useItems`、`useSettings`，以 Dexie `liveQuery` 取得即時資料）與 `useProjection`（以目前月份計算推演）
- [x] 4.3 [P] 在 `src/features/items/` 建立項目清單（收入／支出分組、依名稱排序、空狀態）
- [x] 4.4 [P] 在 `src/features/items/` 建立新增／編輯表單：週期為每月時隱藏發生月份、欄位錯誤訊息、刪除確認對話框
- [x] 4.5 在項目表單中加入金額異動紀錄編輯（新增、編輯、刪除，依生效月份排序，重複與範圍驗證）
- [x] 4.6 [P] 在 `src/features/settings/` 建立設定頁：初始預留金、推演年數、兩則提醒文字，以及匯出／匯入按鈕的位置
- [x] 4.7 [P] 在 `src/features/dashboard/` 建立摘要卡片（千分位、負數紅色、未分配預留金條件顯示）
- [x] 4.8 在總覽建立推演表格：逐月／逐年切換、負數列紅色、部分年度標示、表格區域內水平捲動；逐年列點選時切回逐月並捲動到該年
- [x] 4.9 建立月份明細（底部抽屜或對話框）：當月收支、「由預留金支付」與「追趕」標示
- [x] 4.10 [P] 建立可投資金額長條圖（負值紅色，寬度隨容器縮放）
- [x] 4.11 [P] 建立入不敷出警示與追趕預留提示區塊（無資料時不顯示；點選警示月份開啟明細）
- [x] 4.12 建立總覽空狀態，點選「新增項目」時切換到項目頁並開啟表單

## 5. 備份

- [x] 5.1 在 `src/features/backup/export.ts` 實作匯出：組出 JSON、以 Blob 下載，檔名 `fixed-cashflow-YYYYMMDD.json`
- [x] 5.2 在 `src/features/backup/import.ts` 實作匯入解析與驗證：JSON 解析、`app`、`schemaVersion`、設定與每個項目的驗證，錯誤訊息包含項目序號
- [x] 5.3 在設定頁完成匯入流程：選擇檔案 → 驗證 → 顯示摘要確認對話框 → `replaceAll` → 成功或失敗訊息

## 6. PWA

- [x] 6.1 設定 vite-plugin-pwa：manifest（名稱、短名稱、192／512 圖示、`standalone`、主題色）、預先快取所有靜態資源、`registerType: 'autoUpdate'`
- [x] 6.2 製作 192 與 512 像素的 App 圖示

## 7. 驗證

- [x] 7.1 `month.ts` 單元測試：月份換算、跨年、小月份與閏年日期顯示（budget-items「顯示發生日期」情境）
- [x] 7.2 `validation.ts` 單元測試：涵蓋 budget-items 所有驗證情境、異動紀錄驗證情境、推演設定的初始預留金驗證
- [x] 7.3 `occurrence.ts` 單元測試：涵蓋「判定項目的發生月份」與「金額異動紀錄」的金額判定情境
- [x] 7.4 `projection.ts` 單元測試：逐一涵蓋 cashflow-projection 的所有情境（推演期間、每月與非每月計入、預留計算七個情境、初始預留金分配四個情境、可投資金額、預留金餘額、追趕判定、逐年彙總），並加入性質測試：任一非每月支出在每次到期月份的月底餘額不小於 0，且每個週期的應預留合計等於該次金額（扣除初始分配）
- [x] 7.5 `repository.ts` 測試（fake-indexeddb）：CRUD、設定預設值、重新開啟資料庫後資料仍在、`replaceAll` 寫入失敗時回復原資料
- [x] 7.6 匯出／匯入測試：匯出內容與檔名、五種匯入驗證錯誤、取消匯入不變更、匯出後匯入推演結果一致
- [x] 7.7 元件測試：項目表單（隱藏發生月份、錯誤訊息、刪除確認與取消、預設分類）、項目清單分組與空狀態
- [x] 7.8 元件測試：總覽摘要卡片、表格切換與負數標示、月份明細標示、警示與追趕提示的顯示與隱藏、空狀態導向新增表單、底部分頁預設與切換、設定頁提醒文字、持久化儲存請求（支援與不支援）
- [x] 7.9 執行 `npm run build` 與完整測試，確認全部通過
- [x] 7.10 手動驗證：在手機（或 360px 模擬器）確認無水平捲動與點擊區域；加入主畫面後以飛航模式開啟、編輯與匯出；確認資料不發出網路請求（開發者工具 Network 面板）
      - 實機（iOS）：加入主畫面、獨立視窗開啟、飛航模式下開啟與編輯皆通過。
      - 360px 模擬器（淺色與深色）：無水平捲動、點擊區域至少 44px、離線開啟與離線匯出、編輯時無網路請求，皆通過。
      - 未驗證：實機上的離線匯出備份（模擬器已通過）。

## 8. 視覺調整（design 第 12 點）

- [x] 8.1 更新 `src/index.css` 的色彩 token（淺色與深色），並替換各元件中引用舊 token 的地方（`--invest`、`--reserve`、`--deficit` 等用途依新表調整）
- [x] 8.2 摘要卡改為主色色塊：白色文字與 12px 標籤、「本月可投資」28px、預留數字與比例條預留段用黃色、支出段用半透明白
- [x] 8.3 依字級表調整全域與各元件字級：最小 12px、次要 13px、內文 14px、輸入欄位 16px、h2 16px、h1 20px
- [x] 8.4 更新追趕提示、標記、負數列、長條圖、分頁列與主要按鈕的配色
- [x] 8.5 驗證：執行完整測試與建置；以 360px 模擬器（淺色與深色）檢查無水平捲動、點擊區域至少 44px、畫面中沒有小於 12px 的文字、主要文字與背景對比度至少 4.5:1，並更新截圖

