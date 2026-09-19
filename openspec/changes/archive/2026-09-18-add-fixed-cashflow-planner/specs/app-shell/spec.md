## ADDED Requirements

### Requirement: 可安裝為 PWA

系統 SHALL 提供 Web App Manifest（名稱、短名稱、圖示 192 與 512 像素、`display: standalone`、主題色），讓使用者可以將網頁加入手機主畫面，並以獨立視窗開啟。

#### Scenario: 加入主畫面

- **WHEN** 使用者在支援 PWA 的手機瀏覽器開啟網站並選擇加入主畫面
- **THEN** 主畫面出現 App 圖示，點選後以不含網址列的獨立視窗開啟

### Requirement: 離線使用

系統 SHALL 透過 Service Worker 預先快取所有靜態資源；在首次成功載入後，沒有網路時 MUST 能開啟 App，並能查看與編輯所有資料。有新版本時，系統 SHALL 在背景更新，並於下次開啟時使用新版本。

#### Scenario: 離線開啟

- **WHEN** 使用者曾經開啟過 App，之後在飛航模式下開啟
- **THEN** App 正常顯示總覽，並可新增、編輯、刪除項目

#### Scenario: 離線匯出

- **WHEN** 使用者在離線狀態下點選「匯出備份」
- **THEN** 備份檔仍能正常下載

### Requirement: 分頁導覽

系統 SHALL 在畫面底部提供三個分頁：總覽、項目、設定；開啟 App 時預設顯示總覽，目前所在的分頁 SHALL 有明顯標示。

#### Scenario: 預設分頁

- **WHEN** 使用者開啟 App
- **THEN** 顯示總覽頁面，且底部「總覽」分頁為選取狀態

#### Scenario: 切換分頁

- **WHEN** 使用者點選「項目」
- **THEN** 顯示項目頁面，且底部「項目」分頁為選取狀態

### Requirement: 設定頁內容

設定頁 SHALL 包含：初始預留金輸入欄位、推演年數選項（1、3、5、10 年）、匯出備份、匯入備份，以及說明文字提醒使用者「預留金不會自動追蹤實際帳戶，請定期把初始預留金更新為目前實際預留的金額」與「資料只存在這台裝置，請定期匯出備份」。

#### Scenario: 顯示提醒文字

- **WHEN** 使用者開啟設定頁
- **THEN** 頁面顯示上述兩則提醒文字

### Requirement: 請求持久化儲存

系統 SHALL 在首次啟動時，若瀏覽器支援 `navigator.storage.persist()`，請求持久化儲存；請求失敗或不支援時 MUST NOT 影響 App 使用。

#### Scenario: 支援持久化儲存

- **WHEN** 使用者第一次開啟 App，且瀏覽器支援 `navigator.storage.persist()`
- **THEN** 系統呼叫一次 `navigator.storage.persist()`

#### Scenario: 不支援持久化儲存

- **WHEN** 瀏覽器不支援 `navigator.storage.persist()`
- **THEN** App 正常啟動，不顯示錯誤

### Requirement: 行動版面

系統 SHALL 以手機直向使用為主要版面；在寬度 360 像素的畫面上，頁面本體 MUST NOT 出現水平捲動，互動元件的點擊區域 SHALL 至少為 44 × 44 像素。

#### Scenario: 窄螢幕顯示

- **WHEN** 在寬度 360 像素的畫面開啟任一頁面
- **THEN** 頁面本體沒有水平捲軸，只有推演表格區域可以水平捲動
