# Design：新增固定收支規劃工具

## Context

- 全新專案，沒有既有程式碼或規格。
- 單一使用者、主要在手機上使用，資料只存在本機，沒有後端。
- 核心價值在推演計算的正確性，因此計算邏輯必須是可單獨測試的純函式。
- 所有金額為新台幣整數。

## Decisions

### 1. 技術棧

- 決策：Vite + React + TypeScript；Dexie（IndexedDB）；Chart.js + react-chartjs-2；vite-plugin-pwa；Vitest + @testing-library/react + fake-indexeddb。
- 理由：生態成熟、打包小、PWA 設定簡單；IndexedDB 容量與可靠性優於 localStorage；Dexie 讓查詢與交易更簡潔。
- 考慮過的替代方案：Vue（同樣可行，依使用者偏好可替換）；localStorage（容量小、同步 API 阻塞，不採用）；Recharts（體積較大）。

### 2. 資料模型

```ts
type Month = string;              // "YYYY-MM"
type ItemType = 'income' | 'expense';
type Frequency = 'monthly' | 'quarterly' | 'semiannual' | 'yearly';
// 週期月數：monthly=1, quarterly=3, semiannual=6, yearly=12

interface AmountChange {
  effectiveMonth: Month;          // 從這個月起生效
  amount: number;                 // 正整數
}

interface BudgetItem {
  id: string;                     // crypto.randomUUID()
  name: string;
  type: ItemType;
  amount: number;                 // 基本金額，正整數
  frequency: Frequency;
  anchorMonth: number | null;     // 1–12；非每月項目必填，每月項目為 null
  dayOfMonth: number;             // 1–31，只用於顯示
  startMonth: Month;
  endMonth: Month | null;         // null 表示持續
  category: Category;
  amountChanges: AmountChange[];  // 依 effectiveMonth 遞增排序
  createdAt: string;
  updatedAt: string;
}

interface Settings {
  initialReserve: number;         // 非負整數，預設 0
  horizonYears: 1 | 3 | 5 | 10;   // 預設 5
}
```

Dexie 資料表：`items`（主鍵 `id`）、`settings`（單一列，主鍵固定為 `'default'`）。

分類為固定清單：`居住`、`交通`、`保險`、`訂閱`、`稅費`、`教育`、`生活`、`薪資`、`其他`。

### 3. 月份與發生判定

- 月份在計算時轉為月序號 `idx = year * 12 + (month - 1)`，避免日期與時區問題。
- 項目在月份 `m` 發生的條件：
  - `startMonth ≤ m`，且 `endMonth` 為 null 或 `m ≤ endMonth`
  - 每月項目：每個月都發生
  - 非每月項目（週期 P）：`(m 的月份數字 − anchorMonth) mod P == 0`（取非負餘數）
- 項目在月份 `m` 的金額：`effectiveMonth ≤ m` 的最後一筆異動金額；沒有則為基本金額。
- `dayOfMonth` 大於該月天數時，顯示為該月最後一天。

### 4. 推演是無狀態的

- 推演起始月 `S` 為裝置目前月份，期間為 `S` 起共 `12 × horizonYears` 個月。
- 每次開啟或資料變動時，都從 `S` 與 `initialReserve` 重新計算，不保存歷史推演結果。
- 理由：邏輯簡單、可重現、不需要處理「實際扣款了沒」。代價見 Risks。

### 5. 收入與每月支出

- 每月項目（收入或支出）：在發生月份直接計入。
- 非每月收入（例如年終獎金）：在發生月份直接計入收入，不做平均分攤。
  - 理由：討論中的預留金模型是為了支出；收入保守地只在實際入帳的月份計入。

### 6. 非每月支出的預留演算法（核心）

每個非每月支出項目各自擁有一個虛擬預留帳戶 `balance`，推演時逐月計算：

```
對每個非每月支出項目 item：
  balance = 初始預留金分配給 item 的金額（見第 7 點）
  對推演期間的每個月 t（由 S 開始遞增）：
    D = item 在 t 或之後的下一次發生月份（可能超出推演期間；不存在則為 null）
    若 D 為 null：
      contribution(t) = 0
    否則：
      A = item 在 D 月的金額
      windowStart = max(S, item.startMonth, 上一次發生月份 + 1)
      若 t < windowStart：contribution(t) = 0
      否則：
        monthsLeft = D − t + 1
        contribution(t) = max(0, ceil((A − balance) / monthsLeft))
    balance += contribution(t)
    若 t == D：
      payment(t) = A        // 由預留金支付
      balance −= A
```

性質：
- **穩定狀態：** 付款後 `balance = 0`，下一次到期前有完整 P 個月，每月預留 `ceil(A / P)`，最後一個月自然補齊餘數，合計剛好等於 `A`。
- **追趕：** 新項目或到期時間太近時，`monthsLeft` 較小，每月預留自動變多。
- **金額異動：** 每個月都用「到期月份」的金額重新計算，不需要特別處理。
- **不會短缺：** 到期當月 `monthsLeft = 1`，會一次補足，所以到期時 `balance ≥ A` 一定成立。
- 使用無條件進位（`ceil`），確保每期累積的金額不少於應付金額。

**與討論總結的差異：** 討論總結提到「到期時預留金不足」的警示。由於追趕規則保證到期時一定足額，這個警示在模型中不會發生，因此改為「**追趕預留提示**」：當某月的預留金額高於該項目的穩定狀態金額 `ceil(A / P)` 時，提示使用者那幾個月的可投資金額會因追趕而減少。資金真正不夠時，會反映在「可投資金額為負」的警示上。

### 7. 初始預留金分配

在推演開始時（月份 `S`）：

1. 找出所有非每月支出項目，以及各自在 `S` 或之後的下一次發生月份 `D` 與金額 `A`。
2. 依 `D` 遞增排序；`D` 相同時依 `createdAt` 遞增。
3. 依序分配：`allocated = min(剩餘初始預留金, A)`。
4. 分配完仍有剩餘時，記為「**未分配預留金**」，在總覽顯示，不計入可投資金額，也不再分配給後續週期。

### 8. 每月彙總

```
income(t)        = Σ 當月發生的收入（每月與非每月）
monthlyExpense(t)= Σ 當月發生的每月支出
reserve(t)       = Σ 所有非每月支出項目的 contribution(t)
paidFromReserve(t)= Σ 所有非每月支出項目的 payment(t)
investable(t)    = income(t) − monthlyExpense(t) − reserve(t)
reserveBalance(t)= Σ 各項目月底 balance + 未分配預留金
```

逐年彙總以日曆年分組，加總金額欄位；`reserveBalance` 取該年最後一個推演月份的值。推演期間頭尾不滿 12 個月的年度標示「部分年度」。

### 9. 備份格式

```json
{
  "app": "fixed-cashflow-planner",
  "schemaVersion": 1,
  "exportedAt": "2026-09-17T10:00:00.000Z",
  "settings": { "initialReserve": 0, "horizonYears": 5 },
  "items": [ /* BudgetItem[] */ ]
}
```

- 匯入流程：解析 JSON → 檢查 `app` 與 `schemaVersion` → 逐筆以與表單相同的驗證規則檢查 → 使用者確認 → 在單一 Dexie 交易中清空並寫入。
- 任何一步失敗都不修改現有資料。

### 10. PWA 與儲存

- vite-plugin-pwa 產生 manifest 與 service worker，預先快取所有靜態資源（`registerType: 'autoUpdate'`）。
- 首次啟動時呼叫 `navigator.storage.persist()`，降低瀏覽器清除資料的機率。

### 11. 介面結構

底部分頁三個：**總覽**（dashboard）、**項目**（項目清單與編輯）、**設定**（初始預留金、推演期間、匯出與匯入）。

### 12. 視覺設計（配色 C「主色卡片」與字級）

- 決策：整體改為明亮的淡色背景；本月摘要卡改為飽和的主色色塊（白字），讓「本月可投資」一打開就最醒目；其他區塊維持白底與淡色。
- 理由：原本的灰綠底、深墨色文字與低彩度配色讓畫面偏暗沉；使用者在三個方向中選擇了 C。
- 顏色只承載意義：主色青綠＝可投資、黃色＝預留、紅色＝入不敷出，其餘為中性色。

色彩 token（`src/index.css` 的 `:root`）：

| Token | 淺色 | 深色 | 用途 |
|---|---|---|---|
| `--paper` | `#F3F6FB` | `#11151C` | 頁面背景 |
| `--surface` | `#FFFFFF` | `#1A1F29` | 卡片、清單、分頁列 |
| `--ink` | `#1E2433` | `#E8ECF3` | 主要文字 |
| `--ink-soft` | `#5B6479` | `#9AA3B5` | 次要文字 |
| `--line` | `#E2E7F0` | `#2C3340` | 分隔線、邊框 |
| `--primary` | `#137F73` | `#3CC4B2` | 主色：可投資金額文字、選取中的分頁、主要按鈕 |
| `--invest` | `#1A9E8F` | `#3CC4B2` | 長條圖正值、比例條可投資段 |
| `--hero` / `--on-hero` | `#137F73` / `#FFFFFF` | `#0F6E64` / `#FFFFFF` | 摘要卡底色與文字 |
| `--on-hero-soft` | `#E6F7F4` | `#CFEFEA` | 摘要卡上的標籤文字 |
| `--reserve` | `#9A6B00` | `#FFD166` | 預留金額文字 |
| `--reserve-accent` | `#FFD166` | `#FFD166` | 摘要卡上的預留數字與比例條預留段 |
| `--reserve-bg` | `#FFF4D6` | `#3A3016` | 追趕提示、「追趕」「由預留金支付」標記的底色 |
| `--spend` | `#C5CCD9` | `#4A5263` | 比例條支出段（摘要卡上改用半透明白） |
| `--deficit` | `#C9302C` | `#FF7A7A` | 負數文字 |
| `--deficit-bar` | `#E5484D` | `#FF7A7A` | 長條圖負值 |
| `--deficit-bg` | `#FDECEC` | `#3A1F22` | 負數列底色 |

- 主色 `#137F73` 比預覽的 `#1A9E8F` 稍深，讓摘要卡上的白色小字對比度達到 WCAG AA（4.5:1）；`#1A9E8F` 只用於不承載文字的長條圖與比例條。
- 所有文字與背景的組合 MUST 達到 4.5:1 對比度。

字級（行高 1.55）：

| 用途 | 大小 |
|---|---|
| 最小文字：分頁列標籤、標記（追趕、由預留金支付、部分年度）、摘要卡標籤、圖表座標 | 12px |
| 次要說明、欄位提示、錯誤訊息 | 13px |
| 內文、清單、表格、按鈕、切換鈕、表單標籤 | 14px |
| 輸入欄位與下拉選單 | 16px（例外：避免 iOS Safari 聚焦時自動放大畫面） |
| 區塊標題（h2） | 16px |
| 頁面標題（h1） | 20px |
| 摘要卡「本月可投資」 | 28px |
| 摘要卡其他數字、月份明細總計 | 18px |

- 字級縮小不影響點擊區域：互動元件仍維持至少 44 × 44 像素（app-shell「行動版面」需求）。

### 12. 配色與字級

- 決策：採用「主色卡片」方向。明亮的淡藍灰底色（`--paper`）搭配白色卡片；摘要卡片為飽和主色（teal）色塊配白色文字；預留金相關資訊使用黃色，紅色只用於入不敷出與錯誤訊息。深色模式一併重新配色。
- 字級：內文 14px，最小 12px（欄位標籤、說明文字、表格內容），標題與數字按比例調整。
- 理由：原本的灰綠底色與深墨綠文字整體偏暗；「本月可投資」是這個工具最重要的數字，用飽和色塊承載可以讓重點一眼看見。
- 不變：互動元件點擊區域仍至少 44 × 44 像素；比例條仍為支出、預留、可投資三段。

色彩 token（淺色／深色）：

| Token | 用途 | 淺色 | 深色 |
|---|---|---|---|
| `--paper` | 頁面底色 | `#f3f6fb` | `#121722` |
| `--surface` | 卡片、列表、表格 | `#ffffff` | `#1b2230` |
| `--ink` | 主要文字 | `#1e2433` | `#e8ecf4` |
| `--ink-soft` | 次要文字 | `#55607a` | `#9ba6b8` |
| `--line` | 分隔線、邊框 | `#dce3ed` | `#2e3747` |
| `--brand` | 摘要色塊、長條圖、分頁與強調 | `#127d72` | `#1fa596` |
| `--on-brand` | 主色塊上的文字 | `#ffffff` | `#06231f` |
| `--on-brand-soft` | 主色塊上的次要文字 | `#eefaf8` | `#042a24` |
| `--reserve-on-brand` | 主色塊上的預留金數字 | `#fff3cc` | `#3d2800` |
| `--invest` | 收入金額（白底上） | `#0f7a6e` | `#4cc0b0` |
| `--reserve-fill` | 預留：比例條、標記底色 | `#ffd166` | `#e0ae3c` |
| `--reserve-text` | 預留：文字與圖示 | `#7a5200` | `#f0c46a` |
| `--spend` | 支出段（白底上） | `#b9c2d0` | `#5b6779` |
| `--deficit` | 入不敷出、錯誤訊息 | `#c4342e` | `#f58c86` |
| `--deficit-bg` | 入不敷出列底色 | `#fdecea` | `#3a1e1c` |
| `--deficit-on-brand` | 主色塊上的負數 | `#ffd0cb` | `#7a1512` |

字級表：

| 大小 | 用途 |
|---|---|
| 12px | 欄位標籤、說明文字、標記、表格標頭、分頁文字 |
| 13px | 次要文字、表格內容、切換鈕 |
| 14px | 內文（全域基準） |
| 16px | 輸入欄位（避免 iOS 自動放大）、h2 |
| 18px | 摘要卡片的次要數字 |
| 20px | h1 |
| 28px | 摘要卡片的「本月可投資」 |

## Risks / Trade-offs

- **瀏覽器可能清除本機資料**（尤其 iOS）：以持久化儲存請求與匯出備份降低風險；使用者仍需自行定期匯出。
- **無狀態推演不追蹤實際預留金**：隨著時間經過，使用者需要手動更新「初始預留金」為目前實際預留的金額，否則推演會以舊數字重新計算追趕金額。第一版以設定頁說明文字提醒。
- **無條件進位造成的小誤差**：每期前幾個月可能多預留幾元，最後一個月補正，總額不變，可接受。
- **匯入為完全取代**：誤匯入會覆蓋資料；以確認對話框並建議先匯出來降低風險。
- **輸入欄位字級例外**：輸入欄位維持 16px，比內文大，是為了避免 iOS 聚焦時畫面縮放；視覺上略有不一致，可接受。
- **非每月收入不分攤**：年終獎金入帳月份的可投資金額會特別高，這是刻意的保守設計。

## Migration Plan

全新專案，不需要遷移。`schemaVersion` 從 1 開始，未來資料結構變更時，匯入流程需要處理舊版本升級。

## Open Questions

- 無阻擋實作的問題。技術棧若使用者偏好 Vue，只影響 `src/features/` 與測試工具，不影響 `src/domain/`。
