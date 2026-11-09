# 網站用半尺寸 WebP

本目錄是已授權的正式 PNG 衍生素材，不是新的候選美術。原始圖保留在 `assets/`；工坊與本機原始頁仍使用 PNG，公開發布包使用此處 WebP，保持完整的既有兩批預載。

寬、高各為原圖的 50%，奇數四捨五入、最少 1px。Lanczos3 縮放，WebP 品質85、透明通道品質100；卡框 window 遮罩使用無損編碼，以保留亮度掃描。manifest.json 記錄來源與輸出 SHA256、尺寸、透明通道及體積。縮小不改變正式1600×900場景與元件顯示尺寸。

更新原始素材後，準備 Node 與 sharp（可透過 `MINIMAJO_SHARP_MODULE` 指定模組路徑），執行：

```powershell
node tools/optimize-release-images.cjs
node tools/build-release.cjs
```

轉檔只處理 `assets/` PNG，檢查既有雜湊後重用未變更的輸出。新增或更換圖片後請一併提交 WebP 和 manifest。雲端建置只讀取已產生的檔案，不需要安裝 sharp；缺少或過期的衍生圖會中止建置，保留既有 dist。

發布時自動重寫 CSS、JS 動態路徑與唯讀資料的圖片欄位；像素單位的 border-image 切邊轉為原圖比例，保留畫面邊框寬度。HTTP 發布移除僅供 file:// 使用的內嵌原始 PNG。固定 minimajo-editor.json 不被改寫，歷史隊伍池版本不變。
