# MiniMajo 公開發布

## 本機與公開資料分離

本機仍使用 `node editor-server.cjs` 與固定 `minimajo-editor.json`；開啟工坊重建 localStorage 快取，儲存流程不變。公開版只讀建置時驗證後的資料，透過 `js/public-data.js` 提供與既有 SavedData 相容的唯讀介面，不寫入編輯器快取。音效偏好仍可使用瀏覽器自己的儲存空間。

公開資料使用帶內容版本的 `data/game-<version>.js`，以 defer 順序先於狀態庫與旅程初始化。資料未載入或缺區時阻止開始，顯示重整提示，不使用玩家瀏覽器的舊設定。戰鬥 iframe 收取父頁的旅程快照；正式與工坊的結算界線保持不變。

版本由資料與執行來源計算；`release.json` 記錄版本及 `rulesVersion: 1`。後續引擎相容性改變時需維護規則版本。這不是續玩存檔或玩家 BOSS 快照格式。

## 建置與部署

1. 在工坊儲存並等待「已同步」。
2. 執行 `node --test tests/*.test.js`。
3. 執行 `node tools/build-release.cjs`。
4. 檢查發布目錄並以靜態服務試玩。不可直接以 file:// 驗收。
5. 將原始碼、固定 JSON 與必要素材 commit／push；不提交 dist、tmp 或本機環境檔。
6. 在 Pages 選 GitHub 的 MiniMajo、main 分支、None 框架，建置指令填 `node tools/build-release.cjs`，輸出目錄填 `dist`，根目錄預設，無需新增環境變數。
7. Save and Deploy 後查看建置日誌，再以無痕視窗檢查公開網址。

建置先完成所有驗證，再替換 dist。需要逐欄補值的舊資料會列出原因並中止發布；使用編輯器確認／儲存後再試。不可因此略過驗證或覆寫來源為預設資料。初始隊伍必須合法，normal／elite／boss 各需至少一支非空、正權重敵隊。

發布內容為三個遊戲頁、其 HTML／CSS 依賴的腳本與樣式、正式 assets 圖片、版本資料與錯誤頁。動態引用的正式圖案一併保留；docs 中的來源、工坊及工具不發布。檔名逐段核對大小寫，素材不得為符號連結。檔案限制檢查為單檔25 MiB、總數20,000。

`_headers` 讓靜態檔案每次重新驗證快取，第一版優先確保更新正確；尚未引入永久快取或 service worker。後續可再將素材改成內容雜湊檔名提升快取效率。已開啟的旅程仍維持本頁快照，發布更新後請重新整理開始新旅程。

## 驗證

`tests/release.test.js` 驗證獨立發布、未修改來源 JSON、舊快取隔離、缺設定錯誤、大小寫及建置失敗保留舊產物。

實際瀏覽器腳本：先產生 dist，準備 Playwright 與 Edge，執行 `node tests/browser/release.cjs`；可用 `MINIMAJO_PLAYWRIGHT_MODULE` 指定 Playwright 模組位置。測試自建隨機埠靜態服務，不依賴工坊 API，截圖在 `tmp/browser/release/`。測試在記憶體把相鄰格改成戰鬥驗證 iframe，不代表完整自然旅程通關驗收。

## 本階段界線

已完成發布包與唯讀設定載入；Cloudflare 帳號設定、公開網址驗收、Functions／D1、通關提交及玩家 BOSS 均需後續完成。此包沒有帳號或續玩功能，也沒有開放編輯器寫入 API。
