# MiniMajo 公開發布

## 本機與公開資料分離

本機仍使用 `node editor-server.cjs` 與固定 `minimajo-editor.json`；開啟工坊重建 localStorage 快取，儲存流程不變。公開版只讀建置時驗證後的資料，透過 `js/public-data.js` 提供與既有 SavedData 相容的唯讀介面，不寫入編輯器快取。音效偏好仍可使用瀏覽器自己的儲存空間。

公開資料使用帶內容版本的 `data/game-<version>.js`，以 defer 順序先於狀態庫與旅程初始化。資料未載入或缺區時阻止開始，顯示重整提示，不使用玩家瀏覽器的舊設定。戰鬥 iframe 收取父頁的旅程快照；正式與工坊的結算界線保持不變。

版本由資料與執行來源計算；`release.json` 記錄發布版本、`rulesVersion: 2` 及歷史隊伍的 `poolVersion`。poolVersion只依規則版本與平衡資料計算，忽略圖片路徑、名稱、敘述與音量；美術／介面更新不清掉歷史池。修改引擎規則時須維護rulesVersion。這些版本不是旅程續玩存檔。

## 建置與部署

1. 在工坊儲存並等待「已同步」。
2. 執行 `node --test tests/*.test.js`。
3. 執行 `node tools/build-release.cjs`。
4. 檢查發布目錄並以靜態服務試玩。不可直接以 file:// 驗收。
5. 將原始碼、固定 JSON 與必要素材 commit／push；不提交 dist、tmp 或本機環境檔。
6. 在 Pages 選 GitHub 的 MiniMajo、main 分支、None 框架，建置指令填 `node tools/build-release.cjs`，輸出目錄填 `dist`，根目錄預設，無需新增環境變數。
7. Save and Deploy 後查看建置日誌，再以無痕視窗檢查公開網址。

建置先完成所有驗證，再替換 dist。舊敵隊缺少可選 skillId 時補 null 並列出紀錄，可繼續發布而不改原檔。其他需要逐欄補值的舊資料會列出原因並中止發布；使用編輯器確認／儲存後再試。不可因此略過驗證或覆寫來源為預設資料。初始隊伍必須合法，normal／elite／boss 各需至少一支非空、正權重敵隊。

發布內容為三個遊戲頁、其 HTML／CSS 依賴的腳本與樣式、正式 assets 圖片、版本資料與錯誤頁。動態引用的正式圖案一併保留；docs 中的來源、工坊及工具不發布。檔名逐段核對大小寫，素材不得為符號連結。檔案限制檢查為單檔25 MiB、總數20,000。

三個遊戲頁共用game-viewport固定1600×900內部場景；外框只負責安全區、等比縮放、手機直向90度旋轉與URL同步。Loading及歷史紀錄只在實際遊戲場景啟動，外框不重複下載圖片或提交資料；發布包依HTML依賴自動包含這兩個viewport檔案，無需另一套手機發布包。

`_headers` 讓靜態檔案每次重新驗證快取，第一版優先確保更新正確；尚未引入永久快取或 service worker。後續可再將素材改成內容雜湊檔名提升快取效率。已開啟的旅程仍維持本頁快照，發布更新後請重新整理開始新旅程。

## 驗證

`node tests/browser/fixed-viewport.cjs` 驗證桌面、手機橫向與直向的完整遊戲畫布、實際觸控、疊層彈窗、戰鬥／領獎返回。`tests/browser/game-page.cjs` 讓瀏覽器回歸測試在內部場景操作DOM，實際輸入、截圖與網路監看仍使用外層Page。實體手機及瀏海／動態網址列仍需裝置驗收，不以舊390px元件測試取代。

本機可執行 `node tools/preview-release.cjs`，開啟 `http://127.0.0.1:4174/` 預覽 dist。加入 `--slow` 會讓每張圖片回應延遲250毫秒，方便觀察 Loading；這個延遲只存在本機預覽服務，不會發布到 Cloudflare。預覽服務只提供靜態讀取，不提供工坊 API。

公開版首頁按「START」後，先以約2.7秒完成文字左移淡出、符陣置中放大、月蝕與全畫面淡黑；首頁黑底Loading銜接play.html的同色Loading與無數字進度條。減少動態效果時略過轉場位移與月蝕。發布資料保留完整 images，並分為 criticalImages（背景、框線、按鈕等介面圖）與 backgroundImages（角色、狀態、法則、極式圖案，包含對應資料欄位的自訂路徑）。目前完整218張約267.0 MiB，先等待86張約50.9 MiB介面圖，以最多4張並行下載／解碼，全部成功才建立旅程與載入戰鬥 iframe；不以 localStorage 旗標跳過。本機原始 play.html 與工坊不加此關卡。

Loading 使用純黑底，文字以1.8秒循環明暗變化，進度條反映已成功的介面圖比例，不顯示張數、百分比或返回首頁；減少動態效果時停用循環與進度過渡。介面圖失敗或單張45秒逾時才顯示「載入失敗」與重試按鈕，重試只補失敗圖片。

開局後延後300毫秒啟動剩餘132張約216.1 MiB圖片的背景預載，最多2張並行、低請求優先級，不阻擋地圖與戰鬥，不因背景圖片失敗重開Loading。角色與法則沿用既有預留圖；狀態圖片也改為載入前顯示通用符號、載完替換，壞圖維持通用符號。瀏覽器仍自行管理快取與記憶體，後續重繪可能再解碼；此流程不保證離線遊玩。等待時間仍依介面素材大小及網速而定。

`tests/browser/home-transition.cjs` 在建置dist後驗證正式首頁轉場階段、本機／公開版、桌面／390px、連點、返回首頁及減少動態效果，截圖輸出tmp/。`tests/release.test.js` 驗證獨立發布、未修改來源 JSON、舊快取隔離、缺設定錯誤、大小寫、完整圖片清單及建置失敗保留舊產物；`tests/asset-preloader.test.js` 驗證並行上限、去重、等待全部圖片、失敗收集與重試。

實際瀏覽器腳本：先產生 dist，準備 Playwright 與 Edge，執行 `node tests/browser/release.cjs`；可用 `MINIMAJO_PLAYWRIGHT_MODULE` 指定 Playwright 模組位置。測試自建隨機埠靜態服務，不依賴工坊 API，截圖在 `tmp/browser/release/`。測試在記憶體把相鄰格改成戰鬥驗證 iframe，不代表完整自然旅程通關驗收。

## 本階段界線

已實作發布包、唯讀設定、Pages Functions、勝利隊伍提交及菁英／BOSS歷史匹配，規則見 [PLAYER_TEAMS_SPEC](PLAYER_TEAMS_SPEC.md)。2026-11-07正式與預覽D1已建立並完成migration，wrangler.jsonc已分別設定綁定；獨立預覽 https://player-teams-test.minimajo.pages.dev 已連接測試庫，正式網站尚待發布這次程式與設定。沒有綁定時遊戲會使用編輯器敵隊，尚未傳出的勝利暫存於分頁待傳佇列。沒有登入、旅程續玩或公開編輯器寫入API。

## Cloudflare D1 連接

目前 `minimajo-teams`（Production）與 `minimajo-teams-preview`（Preview）都已存在且資料表已初始化，無需重新建立。`wrangler.jsonc`是綁定設定來源，下一次Git部署包含此檔即套用；本機預設為預覽綁定的本機副本。不要再用Dashboard覆蓋成兩環境共用同一庫。以下步驟供移轉／重建時參考：

1. 在Cloudflare的D1建立正式資料庫，例如 `minimajo-teams`；另建測試資料庫 `minimajo-teams-preview`。
2. 分別在兩個資料庫的Console執行 [migrations/0001_player_teams.sql](../migrations/0001_player_teams.sql) 全文，建立player_teams與索引。此migration使用IF NOT EXISTS，可重跑，不會清除資料。
3. 在wrangler.jsonc設定DB：env.production指向正式庫、env.preview指向測試庫，頂層本機預設採預覽庫的綁定。移轉時使用新帳號建立資料庫後取得的真實ID；不需另外到Dashboard覆蓋綁定。
4. 重新部署包含wrangler.jsonc、functions/、server/、js/、migration與建置腳本的提交。Pages的Functions程式放在儲存庫根目錄functions/，不作為靜態檔案複製到dist；官方建置會一併編譯。dist的_routes.json只讓/api/*進入Functions。
5. 開啟 `https://<網站>/api/health`，應回傳 `{"ok":true,"database":true}`。若503，檢查綁定、migration及Functions部署日誌。
6. 用兩個獨立旅程在相同等級驗證：第一個一般戰勝利留下紀錄，另一個旅程菁英／BOSS抽到「旅人殘影」。普通戰鬥不發配對GET；敗北與平手不POST；同節點敗退重試不重抽。

日後只需補套migration時，可使用：

```powershell
npx wrangler d1 execute DB --env production --remote --file migrations/0001_player_teams.sql --yes
npx wrangler d1 execute DB --env preview --remote --file migrations/0001_player_teams.sql --yes
```

需要命令列代為建立／管理時，可執行 `npx wrangler login --scopes account:read user:read d1:write pages:write` 完成一次Cloudflare授權。不可把API token、登入資料放進儲存庫。D1資料庫ID不是API token，但未設定前不應提交虛構ID的正式wrangler設定。

## 本機 Functions／D1 驗證

純畫面預覽仍可用 `node tools/preview-release.cjs`；它不提供API，會自動使用原敵隊。測試完整後端需Wrangler，並先建立本機綁定設定，例如 `tmp/player-teams-local.json`：

```json
{"name":"minimajo-local","compatibility_date":"2026-11-07","d1_databases":[{"binding":"DB","database_name":"minimajo-local","database_id":"00000000-0000-4000-8000-000000000001"}]}
```

以上ID僅供本機測試，不是正式資料庫ID。在專案根目錄執行：

```powershell
node tools/build-release.cjs
npx wrangler d1 execute DB --config tmp/player-teams-local.json --local --persist-to tmp/player-teams-d1 --file migrations/0001_player_teams.sql --yes
npx wrangler pages dev dist --d1 DB=00000000-0000-4000-8000-000000000001 --persist-to tmp/player-teams-d1 --port 4175 --ip 127.0.0.1 --compatibility-date 2026-11-07
```

保持服務開啟，使用 `http://127.0.0.1:4175/`。`tests/browser/player-teams.cjs` 對此本機服務建立獨立瀏覽器旅程，可用MINIMAJO_RECORD_TEST_URL指定另一個本機測試網址；不要指向正式網站，測試會上傳刻意調整能力的隔離測試隊伍。Playwright使用方式與其他瀏覽器腳本相同。

後端自動測試使用node:sqlite的記憶體資料庫（本機Node 24.15），包含migration、SQL匹配與去重；不是以假陣列模擬資料庫。正式免費Workers CPU上限與真實網路延遲仍需上線後觀察。
