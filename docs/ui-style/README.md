# UI 製作資料

本目錄已依使用者要求清除舊示意圖、試看網頁、未採用版本、一次性驗證輸出與重複成品。正式遊戲只引用 assets/，不從此目錄載入 UI。

- sources/：現行工具需要的 22 張高解析來源及 4 份切圖／校準 JSON。
- adopted-records.json：與現有正式素材雜湊相符的採用紀錄；其中原始路徑是歷史資訊，不是可開啟的來源位置。
- adopted-prompts.md：與現有正式成品對應的生成提示彙整，供後續修改參考。

| 工具 | 來源 |
|---|---|
| tools/build-battle-skin.cjs、build-map-skin.cjs、build-shop-skin.cjs | sources/layout/ 的三份校準 JSON |
| tools/export-card-frames.py | sources/card-frames/；輸出 tmp/asset-exports/card-frames/，待確認後才正式套用 |
| tools/export-detail-assets.cjs | sources/character-details/；輸出 tmp/asset-exports/character-details/，確認後才正式套用 |
| tools/export-detail-icons.cjs | sources/detail-icons/ |
| tools/export-reward-accessories.py | sources/reward-accessories/ |
| tools/split-law-icons.cjs | sources/law-icons/ 的兩張去背來源；正式法則 ID 與裁切範圍見 assets/ui/law-icons/v1/manifest.json，重製輸出 tmp/asset-exports/law-icons/ |

測試的新截圖與日誌統一輸出 tmp/，不再建立舊的美術主題資料夾。未來新圖可暫設工作目錄，確認後僅保留必要來源與提示；不要重新累積整套未選候選。

所有圖片匯出工具均輸出到 tmp/asset-exports/，不再往來源目錄新增PNG，也不直接覆寫正式圖。CSS校準與file遮罩資料產生工具仍依既有用途更新程式檔。
