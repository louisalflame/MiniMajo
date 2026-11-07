# 角色繪圖風格規格

畫風定案日期：2026-10-24；構圖與尺寸規則更新：2026-10-30。後續角色繪圖預設沿用本文件與附圖，不需重新探索漫畫家風格。既有參考及佩脫拉 v1 為方形胸像試作，未替換遊戲圖片或引用；後續角色卡圖必須依已確認佔格與卡片長寬比製作，實際輸出像素可等比例放大。

> 2026-11-07：歷史角色候選與網路角色參考已依使用者要求刪除。以下三張定案畫風參考保留；正式角色圖請直接查看 assets/characters/。文中的舊製作紀錄僅保留文字心得，不再提供候選頁。

## 視覺基準

以以下三張為共同基準。生成時必須實際查看並提供其中一張作風格參考；文字提示不能保證單獨重現一致性。

| 參考圖 | 用途 |
|---|---|
| [Isabelle](art-style/isabelle-approved.png) | 主要風格基準：金色排線較完整的版本，尚未混入灰色髮束排線 |
| [珍妮](art-style/jenny-approved.png) | 相同風格套用金髮、粉色蝴蝶結、藍眼角色 |
| [蓓拉綺](art-style/bellatrix-approved.png) | 相同風格套用酒紅雙辮、黑頭紗與十字配件角色 |

以上圖片是本次定案的視覺參考，不是正式上線素材。原始截圖只提供角色身分，不能把 UI、標誌、文字或其他小角色帶入繪圖。不要依賴 Downloads 或對話暫存路徑；風格參考已保存在本目錄。

## 固定規則

### 每名角色的兩種素材

| 用途 | 設定欄位 | 製作比例 |
|---|---|---|
| 戰鬥／整備／商店／領獎角色卡 | `imageFile` | 依角色佔格製作：1 格 134:288、2 格 268:288、3 格 402:288，並兼容領獎卡少量比例差異 |
| 角色詳情頭像 | `detailImageFile` | 統一 4:5，建議 800×1000，不依佔格改變 |

完整角色素材包含卡圖與詳情頭像兩張；兩者沿用相同角色辨識、素色、乾筆墨線及彩色排線規範，人體皆只取頭至胸部。詳情頭像須按 4:5 安排構圖，不把長條卡圖拉伸當成完成品。4:5 是素材比例，介面會隨螢幕縮放，並非固定顯示 800×1000 像素。以下佔格比例與隊伍卡框安全區規則針對卡圖；詳情頭像需另外檢查詳情介面的裁切與名牌遮擋。

角色試畫流程（2026-10-31 杜薩起）：先只製作多種姿態／神情的角色卡候選；使用者選定方向後，再製作該方向的卡圖及 4:5 詳情頭像兩種尺寸。試畫階段不為每個候選同步生成詳情圖；新圖皆經確認後才正式套用。

第一輪姿態示意（2026-11-02 珍妮起）：預設將四款一次畫在同一張2×2分格圖，方便快速選姿態／神情；每格仍依已確認佔格比例安排並維持定案畫風、角色特徵與頭至胸部範圍。這一輪先不套框、不核對邊框位置或HUD遮擋，也不宣稱安全區已通過。選定姿態後，單獨細畫卡圖時再做同高尺度、位置與正式卡框／HUD檢查，再衍生同姿態詳情圖。分格方式是使用者確認的工作偏好，沒有四張獨立生成的計時對照，不宣稱固定速度倍數。

珍妮後續流程改進（2026-11-02）：選中分格後以獨立的該格作母圖，先確認單獨卡圖的姿態、同高尺度及完整構圖，再製作詳情。不可將縮放／移位後截斷衣袖與髮尾的版本當完成品，結構斷裂時應重整完整構圖。使用者曾詢問是否改回逐張示意，尚未明確決定；沒有受控對照，不把此次失誤定論為分格造成。

姿態探索（2026-11-01 莉德起）：每輪四款需明顯拉開鏡頭俯仰、臉部朝向、視線及頭肩動作，至少兩款不看鏡頭。可用大側面、低角度仰視、高角度俯視、正面強動作分別探索；不能只是相同四分之三側臉看鏡頭再微調嘴角／歪頭。動作應帶動頸部、肩線、衣領或披風，仍遵守頭至胸部、已確認佔格比例及五官安全區，不為完整塞入而壓縮形體。比較以清楚的動作名稱辨識，不只依生成顯示順序的編號。

兩種尺寸需維持同一姿勢與神情：以選定卡圖為姿態母圖，詳情圖優先向左右延展背景、肩膀與髮型／配件，保留頭部角度、視線、笑嘴、頸部與肩線關係，不因換比例重新擺姿或改成另一個臉部透視。檢查時應並排比較；單靠「同一方向」提示不足以視為一致。

選定分格到細畫也必須保留姿態（2026-11-02 珍妮回饋）：以使用者選的原分格為母圖，逐項比對鏡頭、頭部角度、視線、頸肩關係、手勢與道具相對位置。不可為避開HUD將胸前抱熊改成貼臉抱熊，或將低頭改為面向鏡頭；先保留已選姿態，再如實記錄遮擋。需要實質改姿勢才能避開遮擋時，先提出取捨，不擅自改成另一個姿態後仍稱相同。

過程圖與交付（2026-11-02 使用者偏好）：允許自主重畫、修正，不需每次確認；對使用者優先只展示最後選出的成果，不逐張展示所有修正圖。若工具介面仍顯示過程圖，務必明確標記「過程版／不用看」與「本輪最終卡圖／詳情」，最後集中連結或展示最終兩張。這不等於已授權正式套用，也不要求每次重畫前請求確認。

雙尺寸對照也要核對後續新增的代表配件與背景設計，不只比姿勢。2026-11-01 辛子追加要求詳情同步最新卡圖的酒紅背景與飛舞雙皮帶；尺寸換框不應讓同一角色顯示成更新前後兩套設計。若使用者先前指定某張不改，後續提出同步要求時以最新要求為準，新生成成品仍先確認再套用。

程式已支援詳情圖優先載入，空值／缺圖則回退 `imageFile`；回退僅為缺素材時的顯示備援，不代表兩張素材已齊備。兩張皆各自經使用者確認後才存正式素材並設定引用，候選、來源與提示照常保留。友萌已套用一格卡圖及專用 4:5 詳情頭像，分別指定 `youmeng-1slot.png` 與 `youmeng-detail.png`。

### 共通畫風與卡圖構圖

- **跨佔格人物尺度（2026-11-01 辛子回饋）**：1／2／3 格卡圖的顯示高度相同，寬度依序為 134／268／402；增加佔格是向左右增加畫布空間，不把人物隨卡寬同比放大。與正式一格角色等高並排時，臉部及頭骨須維持接近的視覺尺寸，多出的空間用來容納肩膀、胸前手勢與背景，仍僅頭至胸部。不同髮型、頭飾及視角允許自然差異，不以頭髮外框或人物外接矩形強制統一。不只核對像素比例，也須做等高比較；詳情頭像的 4:5 構圖另行處理。

- **自然比例優先（2026-10-31 格瑞娜回饋）**：頭髮、頭巾／蝴蝶結少量被畫布邊緣裁切可以接受；不可為了完整塞入畫面而壓縮、扭曲頭型與配件。先保留自然形體、五官及主要手勢，留白需求以不變形為前提。格瑞娜詳情因此採原第一版，未採完整頭巾的留白修正版。

- **筆觸與明暗**：手繪墨線粗細明顯，輪廓適度斷裂；乾筆飛白、粗細方向性排線、局部交錯排線與大片黑影共同塑形。上色本身也要看得見筆畫與紙白間隙，不能只在平滑填色上疊紋理。
- **排線長度與粗細（2026-10-31 佩瑟雪回饋）**：減少雜點不等於減少排線或改用普通平滑上色。以較長、較粗、方向清楚的成組線條直接構成髮色、衣料與明暗，留出可辨識的紙白線隙；必要時增加筆畫長度與粗細來降低碎屑感，而非刪掉筆觸。避免排線退成細短碎線、顆粒紋理或平塗上的裝飾；臉部仍乾淨留白，只在轉折使用少量明確線組。
- **防止畫風漂移**：細畫仍須回帶最初定案參考圖，不只沿用上一張候選的表面畫法。彩色排線要直接構成髮色與明暗，不能逐版退成平塗加紙紋；細畫代表整理筆觸與形體，不代表抹平筆畫。臉部維持乾淨留白與選擇性排線，不為增加筆觸而全臉鋪滿細線。
- **配色**：黑白灰為骨架，每名角色允許約 2～3 種低飽和代表色，依原角色選擇，不固定全部角色都用紫金藍。髮色可用較完整、密度較高的彩色排線呈現，保留窄而斷續的白色高光與黑影，避免整頭近白。不要強制在金髮中大量穿插不同灰色排線；該實驗已退回。
- **臉與眼睛**：保留辨識度與乾淨留白，少量排線表現轉折；虹膜可保留角色代表色。避免柔焦眼影、暈染彩妝與過度整齊的濃睫毛，眼周筆觸需融入全圖。
- **背景**：較深的冷灰／炭灰為底，以大尺度乾筆和疏密排線形成安靜色塊；臉和頭髮需與背景明確分離。寬幅卡不應只有機械擴大的空底，可依角色加入少量低彩度代表色筆掃、抽象圖形或具辨識度的配件動勢，形成構圖方向；不代表每個角色都要用辛子的紅帶。裝飾不能搶過臉與手勢，也不能靠碎點、粒子、光暈、柔焦漸層或詳細場景填空。
- **細節**：優先保留五官、髮型輪廓與代表配件。髮絲成束、花瓣與服裝紋樣簡化，細節集中分組，避免全圖細線噪點。不要以粗網點作主要上色方式；以彩色排線、乾筆為主。
- **雜點控制（2026-10-31 確認）**：沿用友萌詳情頭像減雜點版的方向：減少隨機細小黑白點、碎屑、針孔與微小刮痕，尤其臉部、白衣、黑髮及背景。以較大、連續且有方向的筆畫分組保留排線、大片黑影及乾筆飛白；臉部保有乾淨留白，不以模糊或平滑厚塗消除筆觸。此為後續角色圖共通要求；參考 友萌減雜點候選，該圖的握刀手仍需修正，不作手部結構範本，也不代表已確認整張正式採用。
- **尺寸與佔格**：角色圖尺寸必須搭配角色卡的長寬比，生成前先確認該角色為 1／2／3 格。若無法確定，必須先詢問使用者，取得答案後才生成；不可自行猜測，也不能按稀有度推定佔格。目前戰鬥／整備／商店卡的寬×高基準為 1 格 134×288、2 格 268×288、3 格 402×288；這是比例基準，不要求輸出這麼小的像素圖。戰利品卡另為 134／275／416×288，需保留少量裁切餘裕以兼容。製作前核對當時的 `css/card-geometry.css`，不以改遊戲版面遷就圖片。既有方形參考只作畫風用途，不再預設新卡圖一律方形。
- **人體範圍**：只畫頭部至胸部的胸像／頭肩像，畫面下緣止於胸部，不出現腰、腹、臀或腿，也不使用半身到腰、四分之三身或全身構圖。1／2／3 格僅改變畫布比例，不改變人體範圍；窄幅卡不可為了填滿長畫布而拉遠鏡頭。需要手勢時僅在胸口附近入鏡，優先確保臉部夠大。
- **構圖**：依已確認的卡片比例設計頭胸取景，臉部保持可辨識，主要頭飾盡量完整且留裁切餘裕。每名角色必須另行設計新姿勢，不能與素材完全相同，也不能只裁切、鏡像或套濾鏡；保留角色辨識特徵，可調整頭部角度、肩膀方向、胸口附近手勢、表情與視角。
- **卡框上緣安全區**（2026-10-31 使用者實機回饋）：正式卡框上邊有弧度、中央寶石與裝飾，會遮住圖片上方。構圖須預留這些遮擋區，臉部與重要五官不可向上貼近卡框；不能只看未套框原圖判斷位置。以正式青青 `assets/characters/qingqing-1slot.png` 目前的臉部高度作為上限參考，後續不得再往上提，必要時略往下安排。不同職業／階級框的遮擋需分別核對；尚未量定統一像素或百分比，不自行假定固定安全距離。頭頂留白或頭飾完整不代表臉部一定安全。
- **避免**：乾淨平滑的卡通賽璐璐、柔焦漸層、精緻厚塗、光滑色塊、亮面塑膠感、過多髮絲和細密花紋。不要再用漫畫家／作品名混搭定義風格，以這些參考圖和具體技法為準。

### 兩格卡圖檢討與製作檢查（2026-11-01 辛子）

這次的問題不是只要輸出268:288就解決：原圖單獨看可用，放到同高隊伍卡與正式HUD後，才顯出頭部偏低、手勢被遮和背景過空。後續兩格角色在選定姿態後的細畫候選階段做同列套框比較；第一輪分格姿態示意先不核對邊框位置。

| 問題 | 本次原因／現象 | 後續處理原則 |
|---|---|---|
| 頭部隨卡寬放大 | 將近方形畫布當作獨立大頭像，與一格同列時人物比例失衡 | 兩格只加寬、高度不變；以同高的一格正式角色比臉部／頭骨大小，多出的寬度給肩膀、手勢和背景。不要以髮飾外框強制量齊，也不要只把整張圖縮小後任由頭沉到下方。 |
| 縮小後頭部過低 | 為避免放大而留下太多上方空底；縮放尺度與垂直位置沒有分開檢查 | 頭部大小與頭部高度是兩件事。以正式青青等同列角色的眼線、下巴及整體視覺高度比對；需要上移時整個頭頸、肩與手勢一起移，不拉長頸部或單獨搬頭。仍避開上緣弧度、中央寶石及裝飾，不能為齊高把五官塞進遮擋區。 |
| 背景過空、單調 | 兩格增加了側向空間，卻只延伸相同炭灰排線；上方大片留白又放大了低頭位感 | 保留深灰基底與呼吸空間，但用少量角色代表色、大尺度筆掃或有意義的配件動勢安排疏密。辛子最終採酒紅乾刷＋兩側紅皮帶環繞；這是本角色解法，不是所有角色的固定背景。 |
| 手勢原圖有、進卡看不到 | 勾指放在胸口，卻剛好落在姓名／血量／能力資訊區後方 | 提示詞寫「胸前」仍不足，要在目標框與正式HUD中核對手勢辨識點。重要指尖、道具輪廓或皮帶動勢應盡量留在可見區；自然裁切外緣可以接受。辛子上移後指尖較清楚，手掌下半仍受HUD遮擋，不宣稱整手完整可見。 |
| 詳情與卡圖變成兩套設計 | 卡圖追加酒紅背景與飛舞雙帶後，詳情仍留舊版 | 一張定案後要並排核對另一張的姿勢、神情、配件與背景。尺寸不同可以自然裁切或調整留白，不能重新擺姿；同步需要的新成品先送確認，再替換正式引用。若使用者指定某張暫時不改，記錄其差異，後續同步要求以最新指示為準。 |
| 生成尺寸不符提示 | 寫了4:5仍曾產生偏窄長圖；「看起來接近」不足以通過 | 每張讀取實際像素並計算寬高比。兩格268:288約0.931，詳情4:5為0.8，不是相同比例；同高時兩格比詳情寬約16%。不把非等比拉伸當作修正完成。 |

後續製作順序：

1. 先核對佔格與比例，再以正式一格圖作等高尺度參考，設計頭胸構圖及動作。
2. 分別檢查頭部大小與垂直高度，不能只完成其中一項；背景裝飾也在這時探索。
3. 選定姿態後的細畫候選放進目標職業／階級的正式框與HUD，旁邊擺一格角色，比五官安全區、眼線、手勢與背景效果；只限預覽引用。第一輪分格姿態示意不做此檢查。
4. 選定卡圖後製作同套詳情，再做卡圖／詳情並排及桌面／窄螢幕詳情檢查，確認配件／背景沒有漏同步。
5. 分別記錄已實際查看的結果、仍有遮擋或自然裁切的地方；經使用者確認後才正式套用，來源、提示及未選版本保留。

對照紀錄：早期等高尺度比較、使用者實際戰鬥回饋截圖、上移與背景四款、定案雙帶卡圖與卡框比較、已同步詳情與卡圖並排。本次曾使用的像素位移／頭部百分比只屬候選提示，沒有量定通用安全值，不沿用為所有角色硬規定。

## 可重用生成提示

將角色原圖與風格參考圖分別提供，明確標記角色／風格兩種用途。以下替換方括號內容即可；不是所有角色都應繼承 Isabelle 的玫瑰、服裝、姿勢或表情。

```text
Image 1 is CHARACTER IDENTITY reference. Image 2 is STYLE ONLY reference.
Create ONE newly drawn game character-card illustration of [character], composed for [confirmed slot count] slots at a width:height ratio of [confirmed card ratio], with proportional output dimensions.
Frame a close head-and-chest portrait ONLY, with the bottom edge at the chest. No waist, abdomen, hips or legs. Keep the face large; the tall card ratio must not cause a zoomed-out body view. Any hand gesture stays near the collar or chest.
At the SAME display height as approved one-slot cards, keep a comparable facial/skull scale for multi-slot cards. More slots add lateral room, not a larger head. Check vertical placement separately: do not leave excessive empty space above or let the face sink behind the bottom HUD. Move head, neck, shoulders and hands together when adjusting height, preserving anatomy and head scale.
Allow for the actual card frame's curved top edge, central gem and ornaments overlapping the upper artwork. Keep face and essential facial features safely below these overlaps. Do not place the face higher than the approved Qingqing qingqing-1slot.png reference; position it slightly lower when needed. Crown margin alone does not guarantee face clearance. Verify with the intended frame; no universal numeric margin has been established.
Preserve [recognizable facial features, hairstyle silhouette, signature accessories].
Use [new pose/expression designed to differ from the character source images]. Do not copy the style reference character's identity or costume.

Match the style reference: expressive hand-inked illustration with strongly varied thick/thin broken contours, worn dry-brush strokes, white paper gaps, decisive large black shadow masses, directional hatching and selective crosshatching.
Color itself is built from visible colored pen strokes and dry broken marks, not smooth fills with texture overlaid.
Use black/white/gray as structure with 2–3 restrained spot hues: [character-specific palette and placement].
Render [hair color] through fairly full, grouped directional colored hatching, with narrow broken paper-white highlights and black shadow recesses. Do not leave most hair planes blank white. Do not introduce gray streaks throughout hair.
Keep [iris color] within the irises. Clean pale facial planes with generous open space and selective shadow hatching; eye linework belongs to the same ink drawing, without cosmetic eyeshadow.
Group hair into readable locks, simplify accessory details and costume patterns. Preserve face and silhouette clarity at small avatar size.
Use a mid-dark cool charcoal background built from broad dry-brush and grouped hatching, quiet and visibly darker than face and light hair.
For wider cards, compose the extra negative space intentionally. If specified for this character, add sparse restrained [spot-color brush sweeps / abstract accents / signature accessory motion], subordinate to face and hand, with no noisy particles or busy scene. Preserve confirmed background/accessories when deriving the matching detail portrait.
Keep signature headwear inside frame with some margin.
Remove screenshot UI, text, logos, numbers, borders and unrelated characters.

Avoid smooth cel shading, airbrush gradients, soft makeup, glossy painting, flat polished color fills, coarse halftone-dot coloring, dense all-over micro-detail, white background merging with face, and artificial halos.
Reduce random tiny black/white speckles, pinholes and micro-scratches. Use fewer, larger directional stroke groups, continuous shadow masses and clean open facial planes; preserve purposeful hatching and broad drybrush breaks without blur or smooth paint.
Do not reduce hatching coverage to achieve cleanup. Use LONGER, THICKER, clearly grouped directional colored pen strokes with visible paper-white channels; let strokes directly build hair color, fabric and shadow. Avoid tiny short scratch marks and smooth filled color planes with merely decorative texture.
```

## 後續操作與檢查

### 已確認正式角色素材索引

| 角色 | 佔格 | 正式檔案 | 採用來源 | 遊戲設定 |
|---|---|---|---|---|
| 蓓拉綺 | 3 格 | [bellatrix-3slot.png](../assets/characters/bellatrix-3slot.png)／[bellatrix-detail.png](../assets/characters/bellatrix-detail.png)（詳情 4:5） | 立刃窺視，2026-11-05 使用者確認 | 已透過 editor-server 更新兩個圖片欄位，核對正式 PNG 雜湊、編輯器重載、破陣 UR 框與桌面／390px 詳情；握柄手下半受卡圖 HUD 遮擋，讀檔補值紀錄見來源 |
| 芭朵莉 | 3 格 | [baduoli-3slot.png](../assets/characters/baduoli-3slot.png)／[baduoli-detail.png](../assets/characters/baduoli-detail.png)（詳情 4:5） | 橫臂馭龍，2026-11-05 使用者確認 | 已透過 editor-server 僅更新兩個圖片欄位，核對正式 PNG 雜湊、編輯器重載、飛襲 UR 框與桌面／390px 詳情；帽簷有裁切，橫臂手部大多受卡圖 HUD 遮擋 |
| 玫可可 | 3 格 | [meikeke-3slot.png](../assets/characters/meikeke-3slot.png)／[meikeke-detail.png](../assets/characters/meikeke-detail.png)（詳情 4:5） | 甩袖叱喝・連續黑毛修正版，2026-11-05 使用者確認 | 已透過 editor-server 僅更新兩個圖片欄位，核對正式 PNG 雜湊、編輯器重載、飛襲 UR 框與桌面／390px 詳情；不採分岔灰白毛區版，耳尖／手部仍有裁切與 HUD 遮擋 |
| 妲玉 | 3 格 | [dayu-3slot.png](../assets/characters/dayu-3slot.png)／[dayu-detail.png](../assets/characters/dayu-detail.png)（詳情 4:5） | 探身擒拿，2026-11-05 使用者確認 | 已透過 editor-server 僅更新兩個圖片欄位，核對正式 PNG 雜湊、編輯器重載、守護 UR 框及桌面／390px 詳情；右手下半受 HUD 遮擋，保留使用者選定姿態 |
| 伊莎貝 | 3 格 | [isabelle-3slot.png](../assets/characters/isabelle-3slot.png)／[isabelle-detail.png](../assets/characters/isabelle-detail.png)（詳情 4:5） | 交指審視・第二版卡圖與詳情，2026-11-05 使用者確認 | 已透過 editor-server 更新兩個圖片欄位，核對正式 PNG 雜湊、編輯器重載、守護 UR 卡框與桌面／390px 詳情；保留較小頭部及無新增披風覆胸的第二版，手腕受卡圖 HUD 遮擋；補值紀錄見來源 |
| 芝潔 | 2 格 | [zhijie-2slot.png](../assets/characters/zhijie-2slot.png)／[zhijie-detail.png](../assets/characters/zhijie-detail.png)（詳情 4:5） | 持針挑笑，2026-11-04 使用者確認 | 已透過 editor-server 更新兩個圖片欄位，核對正式 PNG 雜湊、編輯器重載、支援 SSR 卡框與桌面／390px 詳情；針筒可辨，手腕受卡圖 HUD 遮擋；補值紀錄見來源 |
| 安瑪莉 | 2 格 | [an-mali-2slot.png](../assets/characters/an-mali-2slot.png)／[an-mali-detail.png](../assets/characters/an-mali-detail.png)（詳情 4:5） | 抬頷攏領，2026-11-04 使用者確認 | 已透過 editor-server 指定兩個圖片欄位，核對正式 PNG 雜湊、編輯器重載、支援 SSR 框與桌面／390px 詳情；攏領手大多受卡圖 HUD 遮擋，詳情可見；相容補值紀錄見來源 |
| 瑪蘿 | 2 格 | [maluo-2slot.png](../assets/characters/maluo-2slot.png)／[maluo-detail.png](../assets/characters/maluo-detail.png)（詳情 4:5） | 指向下令・置中修正版 v2，2026-11-05 使用者確認 | 原樣替換兩張 PNG，沿用圖片欄位，固定 JSON 不變；已核對正式 HTTP 雜湊、編輯器重載、支援 SSR 卡框及桌面／390px 詳情；指尖接近左框，衣袖下段受 HUD 遮擋 |
| 伽嵐奈 | 2 格 | [galannai-2slot.png](../assets/characters/galannai-2slot.png)／[galannai-detail.png](../assets/characters/galannai-detail.png)（詳情 4:5） | 雙手比框・右眼修正版，2026-11-04 使用者確認 | 已透過 editor-server 指定兩個圖片欄位並核對正式路徑；卡框與 HUD 尚未實機確認 |
| 珂漫 | 2 格 | [keman-2slot.png](../assets/characters/keman-2slot.png)／[keman-detail.png](../assets/characters/keman-detail.png)（詳情 4:5） | 側身持菸，2026-11-04 使用者確認 | 已透過 editor-server 指定兩個圖片欄位並核對正式路徑；卡框與 HUD 尚未實機確認 |
| 雲 | 2 格 | [yun-2slot.png](../assets/characters/yun-2slot.png)／[yun-detail.png](../assets/characters/yun-detail.png)（詳情 4:5） | 低頭扣腕・直視，2026-11-03 使用者確認 | 已透過 editor-server 指定兩個圖片欄位並核對正式路徑；卡框與 HUD 尚未實機確認 |
| 愛麗絲 | 2 格 | [alice-2slot.png](../assets/characters/alice-2slot.png)／[alice-detail.png](../assets/characters/alice-detail.png)（詳情 4:5） | 眨眼搭杖，2026-11-03 使用者確認 | 已透過 editor-server 指定兩個圖片欄位並核對正式路徑；卡框與 HUD 尚未實機確認 |
| 羅琳 | 2 格 | [luolin-2slot.png](../assets/characters/luolin-2slot.png)／[luolin-detail.png](../assets/characters/luolin-detail.png)（詳情 4:5） | 俯身行禮，2026-11-03 使用者確認 | 已透過 editor-server 指定兩個圖片欄位並核對正式路徑；卡框與 HUD 尚未實機確認 |
| 樂娜 | 2 格 | [lena-2slot.png](../assets/characters/lena-2slot.png)／[lena-detail.png](../assets/characters/lena-detail.png)（詳情 4:5） | 抬臂格擋，2026-11-03 使用者確認 | 已透過 editor-server 指定兩個圖片欄位並核對正式路徑；卡框與 HUD 尚未實機確認 |
| 華蕊 | 2 格 | [huarui-2slot.png](../assets/characters/huarui-2slot.png)／[huarui-detail.png](../assets/characters/huarui-detail.png)（詳情 4:5） | 抬頷扶領，2026-11-03 使用者確認 | 已透過 editor-server 指定兩個圖片欄位並核對正式路徑；卡框與 HUD 尚未實機確認 |
| 露西亞 | 2 格 | [lucia-2slot.png](../assets/characters/lucia-2slot.png)／[lucia-detail.png](../assets/characters/lucia-detail.png)（詳情 4:5） | 低首撫肩，2026-11-03 使用者確認 | 已透過 editor-server 指定兩個圖片欄位並核對正式路徑；卡框與 HUD 尚未實機確認 |
| 佩脫拉 | 2 格 | [petra-2slot.png](../assets/characters/petra-2slot.png)／[petra-detail.png](../assets/characters/petra-detail.png)（詳情4:5） | 閉眼淺笑卡圖與同姿態詳情，2026-11-02使用者確認 | 已透過editor-server指定兩個圖片欄位；驗證器另補缺少的嘲諷狀態預設，其他既有資料不變；正式路徑、編輯器重載及桌面／390px詳情載入檢查通過 |
| 洛米 | 2 格 | [luomi-2slot.png](../assets/characters/luomi-2slot.png)／[luomi-detail.png](../assets/characters/luomi-detail.png)（詳情 4:5） | 側身吹漆卡圖與詳情修正版，2026-11-03 使用者確認 | 正式路徑與固定資料引用已核對，詳情直接從卡圖裁出 |
| 御虹 | 2 格 | [yuhong-2slot.png](../assets/characters/yuhong-2slot.png)／[yuhong-detail.png](../assets/characters/yuhong-detail.png)（詳情4:5） | 抬頷冷笑卡圖與同姿態詳情，2026-11-02使用者確認 | 已透過editor-server指定兩個圖片欄位，其餘設定完整比對不變；編輯器重載、正式路徑及桌面／390px詳情載入檢查通過 |
| 珍妮 | 2 格 | [jenny-2slot.png](../assets/characters/jenny-2slot.png)／[jenny-detail.png](../assets/characters/jenny-detail.png)（詳情4:5） | 縮小與完整構圖修正v4，2026-11-02使用者確認 | 原樣替換兩張PNG，沿用圖片欄位，固定JSON不變；正式路徑、編輯器重載及桌面／390px詳情載入檢查通過 |
| 旋姬 | 2 格 | [xuanji-2slot.png](../assets/characters/xuanji-2slot.png)／[xuanji-detail.png](../assets/characters/xuanji-detail.png)（詳情4:5） | 俯視沉思・窄肩・斜時鐘v2，2026-11-02使用者確認 | 已透過editor-server指定兩個圖片欄位；其餘設定不變，已檢查正式飛襲SSR框及桌面／390px詳情 |
| 多蘿亞 | 1 格 | [dorothea-1slot.png](../assets/characters/dorothea-1slot.png) | 頭胸 v3，2026-10-30 使用者確認 | 已指定 `imageFile: dorothea-1slot.png`（2026-10-31 核對固定資料） |
| 格瑞娜 | 1 格 | [grenna-1slot.png](../assets/characters/grenna-1slot.png) | C 方向第一張細畫，2026-10-30 使用者選上方版本 | 已指定 `imageFile: grenna-1slot.png`（2026-10-31 核對固定資料） |
| 布荻 | 1 格 | [budi-1slot.png](../assets/characters/budi-1slot.png) | 第 2 版排線加強版，2026-10-30 使用者確認 | 已指定 `imageFile: budi-1slot.png`（2026-10-31 核對固定資料） |
| 青青 | 1 格 | [qingqing-1slot.png](../assets/characters/qingqing-1slot.png) | 第 1 方向細畫，2026-10-31 使用者確認 | 已透過 editor-server 寫入 `imageFile: qingqing-1slot.png` |
| 友萌 | 1 格 | [youmeng-1slot.png](../assets/characters/youmeng-1slot.png) | 第 4 方向手部／排線修正版，2026-10-31 使用者確認 | 已透過 editor-server 寫入 `imageFile: youmeng-1slot.png`；已確認飛襲 SR 框未遮五官 |
| 友萌詳情頭像 | 固定 4:5 | [youmeng-detail.png](../assets/characters/youmeng-detail.png) | v3 手部修正第二張，2026-10-31 使用者確認 | 已透過 editor-server 寫入 `detailImageFile: youmeng-detail.png`；已檢查桌面／390px 戰鬥詳情 |
| 多蘿亞詳情頭像 | 固定 4:5 | [dorothea-detail.png](../assets/characters/dorothea-detail.png) | 詳情第一版，2026-10-31 使用者確認 | 已指定 `detailImageFile: dorothea-detail.png`；已檢查桌面／390px 戰鬥詳情 |
| 格瑞娜詳情頭像 | 固定 4:5 | [grenna-detail.png](../assets/characters/grenna-detail.png) | 詳情第一版，2026-10-31 使用者確認 | 已指定 `detailImageFile: grenna-detail.png`；已檢查桌面／390px 戰鬥詳情 |
| 布荻詳情頭像 | 固定 4:5 | [budi-detail.png](../assets/characters/budi-detail.png) | 詳情第一版，2026-10-31 使用者確認 | 已指定 `detailImageFile: budi-detail.png`；已檢查桌面／390px 戰鬥詳情 |
| 青青詳情頭像 | 固定 4:5 | [qingqing-detail.png](../assets/characters/qingqing-detail.png) | 詳情第一版，2026-10-31 使用者確認 | 已指定 `detailImageFile: qingqing-detail.png`；已檢查桌面／390px 戰鬥詳情 |
| 杜薩 | 1 格 | [dusa-1slot.png](../assets/characters/dusa-1slot.png) | 第 3 方向仰頭大笑，2026-10-31 使用者確認 | 已指定 `imageFile: dusa-1slot.png`；已確認飛襲 SR 框未遮五官 |
| 杜薩詳情頭像 | 固定 4:5 | [dusa-detail.png](../assets/characters/dusa-detail.png) | 姿勢對齊 v2，2026-10-31 使用者確認 | 已指定 `detailImageFile: dusa-detail.png`；已檢查桌面／390px 戰鬥詳情 |
| 佩瑟雪 | 1 格 | [pesexue-1slot.png](../assets/characters/pesexue-1slot.png) | 持燭長線排線版，2026-10-31 使用者確認 | 已指定 `imageFile: pesexue-1slot.png`；已確認支援 SR 框未遮五官 |
| 佩瑟雪詳情頭像 | 固定 4:5 | [pesexue-detail.png](../assets/characters/pesexue-detail.png) | 同姿態延展詳情圖，2026-10-31 使用者確認 | 已指定 `detailImageFile: pesexue-detail.png`；已檢查桌面／390px 戰鬥詳情 |
| 希霓 | 1 格 | [xini-1slot.png](../assets/characters/xini-1slot.png) | 扶鏡＋笑開 v2，2026-10-31 使用者確認 | 已指定 `imageFile: xini-1slot.png`；已確認破陣 SR 框未遮五官 |
| 希霓詳情頭像 | 固定 4:5 | [xini-detail.png](../assets/characters/xini-detail.png) | 扶鏡＋笑開同姿勢延展，2026-10-31 使用者確認 | 已指定 `detailImageFile: xini-detail.png`；已檢查桌面／390px 戰鬥詳情 |
| 莉德 | 1 格 | [lide-1slot.png](../assets/characters/lide-1slot.png) | 大側面凝神 v1，2026-11-01 使用者確認 | 已透過 editor-server 指定 `imageFile: lide-1slot.png`；已確認破陣 SR 框未遮五官 |
| 莉德詳情頭像 | 固定 4:5 | [lide-detail.png](../assets/characters/lide-detail.png) | 同姿勢延展 v1，2026-11-01 使用者確認 | 已指定 `detailImageFile: lide-detail.png`；已檢查桌面／390px 戰鬥詳情 |
| 辛子 | 2 格 | [xinzi-2slot.png](../assets/characters/xinzi-2slot.png) | 上移＋酒紅背景＋第2款雙帶環繞，2026-11-01 使用者確認 | 沿用 `imageFile: xinzi-2slot.png`；正式SSR框五官／勾指尖可見，手掌下半仍受HUD遮擋 |
| 辛子詳情頭像 | 固定 4:5 | [xinzi-detail.png](../assets/characters/xinzi-detail.png) | 酒紅背景＋雙帶同步 v3，2026-11-01 使用者確認 | 沿用 `detailImageFile: xinzi-detail.png`；桌面／390px 正式詳情可見手勢與雙帶 |

正式角色圖放 `assets/characters/`；網路原始參考已清理；新候選暫存工作區，確認後清理未採用版本並保存必要提示。放入正式目錄與設定角色引用為兩個步驟，不把已存檔宣稱為已在遊戲顯示。

2026-10-31 多蘿亞、格瑞娜、布荻、青青的 4:5 詳情頭像已確認套用，四張採用來源比較。正式檔案依序為 dorothea-detail.png／grenna-detail.png／budi-detail.png／qingqing-detail.png，均已設定 detailImageFile，並檢查桌面／390px 戰鬥詳情。格瑞娜使用第一版，留白修正版未採用；友萌既有兩張正式圖不變。

1. 先查看角色來源和本文件參考圖；區分角色特徵與畫風。確認角色佔格與當前卡片長寬比；不確定為 1／2／3 格時先詢問使用者，未取得答案不生成。每張提示與製作記錄寫明佔格、目標比例及新姿勢。一次先少量試作，不擅自全批生成。
2. 使用內建 imagegen；本次工具沒有可設定的低解析度／低品質參數。若後續工具有不同能力再據實使用；大圖生成後縮小只供檢視，不能宣稱節省生成運算。
3. 保留原圖、另存新檔。未獲替換授權前，不修改 `assets/characters/` 或角色圖片設定。文件參考圖亦不要被新實驗覆蓋。
4. 檢查輸出長寬比是否符合已確認佔格、人體範圍是否只到胸部，以及角色特徵、彩色筆畫、乾筆、臉部乾淨程度、背景明暗分離、頭飾裁切與新姿勢；出現腰腹或腿即不合格，需重畫。以實際卡片比例檢視，確認下方資訊覆蓋時仍能辨識；亦可用約 64～96 px 檢視臉部可讀性，這是建議檢查尺寸，不是輸出規格。
5. 套用目標職業／階級卡框檢查上緣弧度、寶石與裝飾是否遮住臉部及五官；臉部位置不得比正式青青參考更高。此上限來自使用者實機觀察，不代表所有卡框已完成驗證；未實際套框不可宣稱安全區通過。
6. 定案參考仍有頭頂貼邊／局部裁切、部分臉部色感等生成偏差，後續不必複製這些缺陷；在不改變整體畫風下改善。不要聲稱已有遊戲內並排或正式版面驗證。
