# 固定收支規劃

推演每月與非每月（年繳、季繳等）的固定收支，算出每個月可以放心投入的金額。資料只存在裝置本機。

規格文件在 `openspec/changes/add-fixed-cashflow-planner/`。

## 開發

需要 Node.js 20 以上。

```bash
npm install
npm run dev        # 開發伺服器
npm test           # 執行測試
npm run typecheck  # 型別檢查
npm run build      # 建置到 dist/
npm run preview    # 預覽建置結果（可測試離線）
```

## 在手機上使用

Service Worker 需要 HTTPS（或 localhost）才能運作。把 `dist/` 部署到任一靜態網站服務（例如 GitHub Pages、Netlify、Cloudflare Pages），用手機瀏覽器開啟後選擇「加入主畫面」。

資料只存在該裝置的瀏覽器中，請定期在「設定」頁匯出備份。
