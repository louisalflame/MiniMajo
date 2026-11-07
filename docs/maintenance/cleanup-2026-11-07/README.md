# 2026-11-07 檔案與素材整理

## 已完成

- 原樣搬移 133 檔，每檔核對 SHA-256 與大小；包含 62 張正式角色圖、54 張原始角色參考、9 張舊 UI、7 張共用 UI 及角色目錄的 .gitkeep。
- 正式角色統一到 assets/characters/，共用 UI 在 assets/ui/common/；原始參考在 docs/art-style/references/characters/；舊 UI 在 docs/ui-style/archive/legacy-runtime/。
- 更新正式程式、編輯器欄位說明、預覽頁、驗收腳本與文件。角色設定仍只存檔名；固定 minimajo-editor.json 的 SHA-256 與整理前相同，沒有透過 API 寫入資料。
- tmp/ 的 1,147 檔（約 66.8 MiB）逐檔核對 ZIP 內容的 SHA-256 後清出；封存 .local-archives/tmp-before-cleanup-2026-11-07.zip 約 13.9 MiB，節省約 52.9 MiB。未刪除角色來源、候選、生成提示或已確認的風格參考。
- 新增根目錄 README、素材分類索引、.gitignore、素材清單與盤點工具；正式 HTML 入口保留根目錄；後續使用者要求的 CSS 與試看頁收納見下方紀錄。
- 舊厚角石板匯出工具改輸出歷史區，避免重新混入正式 assets。

## 保留依據與限制

- css/battle-board.css 仍引用旋流背景，因此保留 assets/ui/battle-board/fine-flow-background.webp。
- 已授權的 16 枚極式圖案即使尚未指定技能，仍是正式可用素材，保留。
- 249 組完全相同圖片包含正式成品與採用來源；不以雜湊相同為理由刪除來源。
- 歷史 approved-assets.json 保留當時的路徑與採用雜湊，查找現在位置時使用 [搬移表](moves.json)。這些不是目前執行時的素材清單。
- 本機專案目錄沒有 .git，無法產生 Git 差異。搬移前每檔雜湊及文字更新清單均已保存。
- 此次未實作 Cloudflare 部署、遊戲公開資料載入、通關上傳或玩家 BOSS。既有本機編輯器與 localStorage 資料流程維持原規則。

## 驗證結果

- 全部 133 檔搬移後的 SHA-256 一致，舊位置不再存在；固定 JSON 雜湊一致。
- node tools/audit-assets.cjs：189 張正式圖片、100 個固定設定圖片路徑，未發現缺檔。正式程式與可執行預覽腳本未留下已移除的舊路徑；動態路徑仍以瀏覽器驗證補足。
- node --test --test-reporter=tap tests/*.test.js：474 項全部通過。首次執行發現既有 saved-data 測試將戰鬥秒數寫死 60，與未修改的固定 JSON 內 30 不符；只修正測試，改驗證保留來源設定，沒有改變遊戲秒數或讀檔規則。伺服器測試需允許本機 HTTP 連線。
- 隔離無頭 Edge 實際開啟首頁、旅程、編輯器、戰鬥、獎勵預覽、UI 預覽及四個歷史比較頁，共 10 頁，無頁面例外或 HTTP 錯誤。
- 瀏覽器成功解碼全部 189 張正式圖片；1366 與 390 寬角色詳情確認從 assets/characters/ 載入，已檢視截圖。沒有手動完整遊玩自然旅程，沒有實體手機觸控驗證。

[瀏覽器結果](browser-results.json)；桌面截圖（已清理）；手機寬度截圖（已清理）。可重跑 tests/browser/asset-paths.cjs（依既有測試方式提供 Playwright），新輸出位於 tmp/asset-paths/。

## 維護方式

- 圖片增減／搬移後執行 node tools/audit-assets.cjs，更新 assets/manifest.json 與 docs/maintenance/asset-audit.json。盤點是檢查線索，不自動刪除素材。
- .local-archives/ 與 tmp/ 是本機資料，不納入 Git 或網站發布；需要還原整理前暫存檔時，將 ZIP 解壓到另外的暫存目錄後選取所需檔案，避免覆蓋新輸出。
- 日後公開網站應使用獨立發布包；不要將整個 docs/ 或 .local-archives/ 上傳成遊戲網站。

## 使用者確認後的後續移除

2026-11-07 後續清理：依使用者要求移除 .gitkeep、極式 paths.txt、舊 gear-book.png、detail-border.svg 與旋流背景；工坊整備改用既有 preparation-book.png，共用彈窗沿用已採用羊皮紙框。原旋流背景 CSS 已移除，歷史比較頁改引用原始來源圖。正式圖片目前 186 張。未修改固定 JSON。

舊書本／SVG 邊框的工坊引用及相關測試已換成現行素材；paths.txt 的使用說明改指向既有 manifest.json。原始整理紀錄與雜湊保留為當時結果，後續移除清單見 [removed-obsolete.json](removed-obsolete.json)。本機還原 ZIP 在忽略的 .local-archives/。

後續驗證：完整 Node 474 項通過；隔離 Edge 10 頁與 186 張正式圖片解碼通過；工坊書本 src 與商店紙框 computed style 已確認，極式圖片瀏覽器測試通過。另執行的 law-presentation.cjs 在既有價格文案斷言失敗（期待「50 金幣」，目前畫面為「50」），尚未調整此舊測試；不將它宣稱為通過。固定 JSON 雜湊未變。

## 移除獨立 UI 試看

依使用者要求刪除 ui-preview.html、ui-preview.css、js/ui-preview.js、js/ui-preview-data.js、專用 Node 測試及瀏覽器測試；共用彈窗結構檢查轉移至 tests/preview-markup.test.js。移除工坊與歷史比較頁入口，清理現況文件；previews/roster-preview.html 與 previews/dialog-preview.html 仍被其他測試及比較頁使用，保留。原檔在忽略的 .local-archives/removed-ui-preview-2026-11-07.zip，僅供本機還原。

移除 UI 試看後驗證：470 項 Node 測試全通過（刪除4項專用檢查，保留共用結構檢查）；隔離 Edge 9頁與186張正式圖片、工坊現行書本／紙框及桌面／390px詳情通過。固定JSON SHA-256未變，未完整手動遊玩自然旅程。

## 根目錄收納

2026-11-07 根目錄收納完成：25 個 CSS 移至 css/，兩個試看頁移至 previews/；四個正式 HTML 與啟動入口維持根目錄。已同步更新正式頁、iframe／比較頁、測試與 CSS 產生工具；預覽頁以 base href="../" 沿用根目錄的共用彈窗結構，CSS 圖片改為 ../assets/，動態圖示遮罩則使用頁面基準網址轉成完整網址。固定 JSON 不變。

[搬移與變更清單](root-moves.json)。CSS 與頁面不是純位元組搬移，內部資源連結已同步調整。

根目錄收納驗證：470項Node測試通過，隔離Edge 9頁／186張正式圖片及桌面手機詳情通過；25個CSS反向還原圖片路徑後與搬移前SHA-256全部一致，沒有修改版面規則。完整 character-card-skin 瀏覽器腳本在舊統計步驟被 GAME SET 確認彈窗阻擋；scene-layout 腳本在商店地圖格點擊被SVG截取而逾時，這兩項完整流程未通過，不視為已驗證整趟旅程。

另以 MINIMAJO_SKIN_BOARD_ONLY=1 執行 character-card-skin.cjs：24組、72張卡檢查全部通過，無頁面例外或失敗請求，file://內嵌遮罩相容通過。

## 使用者授權的歷史美術與預覽退役

移除兩個剩餘試看頁、專用控制器、12支舊比較頁驗收腳本及4支過時素材工具；保留的卡框檢查改用正式play.html建立記憶體情境。刪除網路蒐集角色參考、全部歷史角色候選、UI示意圖、比較網頁、一次性截圖與重複成品。

清理前docs有2,005檔、約1,685.5MiB、1,262張圖片；整理後45檔、約21.8MiB、23張圖片（3張定案畫風參考＋20張現行工具來源），HTML為0。正式186張素材不變；目前編輯資料未由本次操作寫入，瀏覽器檢查前後雜湊一致，保留使用者其他操作的最新設定。

469項Node測試通過；隔離Edge正式4頁、186張圖片、退役預覽404、24組／72張卡框與file://遮罩通過。使用精簡來源重新匯出的40張PNG與正式圖逐像素相同；3支CSS校準工具可使用保留JSON執行，24個保留來源檔案雜湊一致。舊失衡匯出工具因無法重建目前成品一併退役。未手動完整遊玩自然旅程。

清理前整份docs留在忽略的.local-archives/development-docs-before-prune-2026-11-07.zip（2,005筆檔案長度已核對），供本機還原，不納入發布。保留來源與正式素材的檢查已改為內容雜湊，不依賴被清理的候選副本。新匯出物及測試輸出在tmp/，不再回填docs。詳見 [精簡結果](docs-prune.json)。
