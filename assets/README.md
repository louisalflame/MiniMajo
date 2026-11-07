# 正式遊戲素材

目前共 218 張圖片：62 張角色卡／詳情圖、156 張 UI 圖。固定設定仍以角色檔名或圖案相對路徑引用。

| 目錄 | 用途 |
|---|---|
| characters/ | 角色卡與詳情圖；imageFile／detailImageFile 只存檔名 |
| ui/common/ | 共用羊皮紙、標題、按鈕、選取標記與分隔線 |
| ui/card-frames/v3/ | 四職業三階卡框及遮罩；支援職業已採用較新的頂弧成品 |
| ui/card-icons/approved-v1/ | 種族、屬性與能力圖示 |
| ui/character-details/ | 詳情框、分隔線與能力圖示 |
| ui/battle/ | 戰鬥背景、標牌、技能圓框、按鈕與共用整備書本 |
| ui/battle-board/ | 現行十格薄角石板 |
| ui/preparation/ | 出售區與整備分隔線 |
| ui/shop/ | 商店背景、紙面、法則框、按鈕及水晶 |
| ui/skill-picker/ | 技能選項及捲軸 |
| ui/map/ | 地板、場景與事件立板 |
| ui/status-icons/v1/ | 狀態圖案；manifest.json 保存 ID、檔名與採用雜湊供驗證 |
| ui/ultimate-icons/v1/ | 16 枚已授權極式圖案；manifest.json 可查圖案檔名 |
| ui/law-icons/v1/ | 32 枚 B 風格法則符文，01-law.png～32-law.png；manifest.json 記錄法則 ID、來源裁切及雜湊 |

執行 node tools/audit-assets.cjs 更新 [素材清單](manifest.json) 與 [盤點](../docs/maintenance/asset-audit.json)，檢查固定資料與 CSS 圖片引用。動態引用需以瀏覽器補驗證，不以「找不到字面引用」自動刪圖。

三張定案畫風參考保留於 docs/art-style/；網路蒐集角色參考、舊候選、試看頁與重複成品已清理。現行工具所需的精簡來源見 [UI 製作資料](../docs/ui-style/README.md)。正式素材的歷史採用資訊與必要提示已彙整到該目錄。

替換卡框遮罩或能力圖示後，執行 node tools/export-reward-mask-data.cjs 更新 file:// 的內嵌 PNG；HTTP 仍使用正式素材。新圖確認採用後才可放入本目錄，素材本身不包含在編輯資料 JSON 備份。
