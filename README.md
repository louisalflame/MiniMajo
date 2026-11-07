# MiniMajo · 長夜之契

以魔女組隊、自動戰鬥、手動極式與蜂窩地圖探索為核心的網頁遊戲原型。使用原生 HTML／CSS／JavaScript，本機開發無需安裝前端套件；公開版使用 Node 腳本產生發布包。

目前包含首頁、探索旅程、整備、角色與法則商店、戰後獎勵，以及本機資料編輯器。介面使用繁體中文，採神秘暗黑與紙面、版畫風格。

## 本機啟動

需要安裝 Node.js，並使用現代瀏覽器。在專案根目錄執行：

```powershell
node editor-server.cjs
```

Windows 也可以雙擊 `啟動MiniMajo.cmd`，自動開啟編輯器。使用期間請保持服務視窗開啟。

1. 先開啟 [本機編輯器](http://127.0.0.1:4173/editor.html)，等待固定 JSON 載入成功，讓同來源的編輯資料快取建立完成。
2. 開啟 [遊戲首頁](http://127.0.0.1:4173/index.html)，開始新旅程。
3. 編輯設定後，等待編輯器頂部顯示「已同步」，再關閉頁面。設定於下一次新旅程載入。

請統一使用 `http://127.0.0.1:4173`；`localhost`、其他連接埠與 `file://` 的瀏覽器儲存空間不同。一般靜態伺服器及直接雙擊 HTML 不支援編輯器的固定檔案讀寫。

## 資料與目前限制

- `minimajo-editor.json` 是編輯器的固定資料來源，應隨專案保留。儲存操作會透過 `editor-server.cjs` 覆蓋此檔；缺檔或損壞時會報錯，不會自動建立空資料。
- 本機遊戲從同來源 localStorage 編輯資料快取建立旅程；公開發布包改讀唯讀設定，不需要先開工坊，也不覆寫編輯器快取。
- 遊戲尚無持久續玩存檔。編輯器完整備份包含已儲存設定，不包含表單草稿或旅程進度。
- 本機服務只監聽 `127.0.0.1`，供本機編輯與遊玩使用。

## 公開發布包與 Cloudflare Pages

預計使用 Cloudflare Pages 提供遊戲頁面與素材，Pages Functions（運行於 Workers）處理 API，D1 儲存通關隊伍，供其他玩家作為 BOSS 挑戰。

執行以下指令產生 `dist/`：

```powershell
node tools/build-release.cjs
```

建置驗證固定 JSON、初始隊伍、敵隊抽選池、檔案引用與路徑大小寫，將正式設定與執行所需檔案打包。驗證失敗保留上一份 `dist/`，不修改原始 JSON。公開包不含工坊、測試、工具或美術來源，首頁亦不提供工坊入口。

Cloudflare Pages 的 Git 整合設定：

| 欄位 | 值 |
|---|---|
| Production branch | `main` |
| Framework preset | `None` |
| Build command | `node tools/build-release.cjs` |
| Build output directory | `dist` |
| Root directory | 預設（儲存庫根目錄） |

先將程式與固定 JSON commit／push，再部署。`dist/` 由 Cloudflare 在建置時產生，不提交 Git。每次更新設定需重新建置／發布；`release.json` 記錄內容版本與戰鬥規則版本。公開設定於頁面載入時固定，重新整理才取得新版；本局不即時更新。

目前發布包與公開資料載入已實作，尚未完成 Cloudflare 線上部署、Pages Functions／D1 或玩家 BOSS 功能。詳細驗證與操作見 [部署說明](docs/DEPLOYMENT.md)。

## 檔案位置

| 位置 | 用途 |
|---|---|
| 根目錄 HTML | 四個正式入口：首頁、旅程、共用戰鬥與編輯器 |
| css/ | 25 個共用與頁面樣式檔 |
| js/ | 遊戲引擎、資料驗證與畫面控制 |
| minimajo-editor.json | 已儲存的完整編輯設定 |
| assets/characters/ | 正式角色卡與詳情頭像 |
| assets/ui/ | 按用途分類的正式 UI 圖片，共用元件在 common/ |
| docs/ | 操作規則、設計規範、候選圖、來源與驗證紀錄 |
| tools/ | 素材匯出、CSS 校準與盤點工具 |
| tests/ | Node 測試及 browser/ 實際瀏覽器腳本 |
| tmp/ | 可重建的測試輸出；預設忽略 |
| .local-archives/ | 本機整理封存；預設忽略，不公開發布 |

完整開發交接見 [AGENTS.md](AGENTS.md)、[現況](docs/PROJECT_CONTEXT.md)、[操作與規則](docs/README.md)。圖片分類與維護見 [素材索引](assets/README.md)；此次整理見 [紀錄](docs/maintenance/cleanup-2026-11-07/README.md)。

## 驗證

在專案根目錄執行完整 Node 測試：

```powershell
node --test tests/*.test.js
```

盤點素材與缺圖：

```powershell
node tools/audit-assets.cjs
```

`tests/browser/` 另有瀏覽器驗證腳本，依各腳本需要準備 Playwright 與指定瀏覽器。部分自動測試使用簡化 DOM；通過不代表已完成實際瀏覽器、手機觸控或完整旅程驗收。

## 協作與素材

修改前請先閱讀 [AGENTS.md](AGENTS.md) 與 [專案現況](docs/PROJECT_CONTEXT.md)。新圖與變體先放文件中的候選區，經確認後才放入正式素材目錄；歷史候選已依使用者要求清理；後續新圖僅保留必要來源與採用資訊。

`.gitignore` 排除本機暫存、封存、部署產物與環境機密；正式設定、素材、文件與測試仍需納入版本控制。Git 忽略規則不等於網站發布清單。
