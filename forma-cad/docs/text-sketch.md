# 押し出せる文字

スケッチのツールバーの「文字」を押し、日本語・英数字を入力します。「文字の並び」で横書き・縦書きを選べます。縦書きは文字を正立させて上から下へ並べ、改行すると左の列へ進みます。英数字も1文字ずつ縦に並べます。文字の高さ、追加の字間、角度、揃え方をプレビューで指定できます。横書きは左・中央・右揃え、縦書きは列ごとの上・中央・下揃えです。改行は5行（縦書きでは5列）、文字数は80文字までです。横書きの高さは最も背の高い行の実際の輪郭、縦書きの高さは最も背の高い1文字の実際の輪郭です。

プレビュー上の文字、または「移動」ハンドルをドラッグして位置を調整できます。移動時は作図面のグリッドに吸着し、Shiftで解除します。四隅のハンドルをドラッグすると、反対の角を固定し、縦横比を保って拡大・縮小します。文字の高さと字間を同じ比率で変え、入力欄にも反映します。Shiftを押しながら四隅を引くと微調整できます。回転した文字やXY以外の作図面でも同様です。移動中の決定ボタンと文字のハンドルは半透明です。

ドラッグ中は既存モデルを変更せず、プレビューだけを移動・拡大縮小します。マウスを離しても文字配置は未確定で、「スケッチに配置」「配置して押し出す」で適用します。Esc・キャンセルで元のモデルを保ち、ドラッグ中のキャンセルやウィンドウのフォーカスを失った場合はドラッグ前の設定へ戻します。

平面を選んでから開くとその面に配置し、それ以外は現在のスケッチ／基準平面を使います。「画面で位置を指定」を押すと、次にクリックした平面上の位置へ配置します。表示中のグリッド間隔に吸着し、Shiftで一時解除します。横位置・縦位置はその平面の座標です。

「スケッチに配置」は輪郭を配置し、「配置して押し出す」は文字のすべての実体領域を選んで通常の押し出し操作へ進みます。押し出し操作の新規・結合・切り取り、距離・方向を使えます。文字内の空洞（O・B・8など）は選択対象にせず、そのまま空けます。入力プレビューと位置調整は確定まで工程を変更しません。配置は1回で元に戻せます。

輪郭は通常の閉じたポリラインとして保存します。フォントを埋め込まず、保存・再読み込み、移動、後続のCAD処理、STL出力に利用できます。配置後の文字列やフォントの再編集には対応していません。必要なら配置を元に戻し、文字を変更して配置し直してください。既存工程と文字の輪郭・押し出しを合わせて工程数150、文字輪郭15,000頂点までです。複雑な長文は分割してください。

「フォント」で、ゴシック（Noto Sans CJK JP）、太字ゴシック（Noto Sans CJK JP Bold）、明朝（Noto Serif CJK JP）、丸ゴシック（Zen Maru Gothic）の4種類から選べます。いずれも日本語・英数字に対応し、選んだ書体の実際の輪郭をプレビュー・押し出しに使います。切り替えても文字・高さ・字間・角度・位置・揃え方は維持します。

選択した書体だけを同じサイトの `fonts/` から読み込み、読み込み済みの書体は再利用します。読み込み中は確定できず、読み込みが前後しても最後に選んだ書体を使います。TTF・OTF・WOFF形式の手持ちのフォントも端末内で読み込め、メニューの「読み込み：ファイル名」から再選択できます。「標準フォントに戻す」はゴシックへ戻します。未収録文字は警告し、代替の四角い字形で確定しません。

## 同梱フォント

- 原本：[Noto CJK / Japanese Regular](https://github.com/notofonts/noto-cjk/blob/main/Sans/OTF/Japanese/NotoSansCJKjp-Regular.otf)
- ライセンス：[SIL Open Font License 1.1](https://github.com/notofonts/noto-cjk/blob/main/Sans/LICENSE)。`assets/fonts/OFL.txt` と配布先 `dist/fonts/OFL.txt` に同梱。フォント本体は未変更。
- 太字：[Noto Sans CJK JP Bold](https://github.com/notofonts/noto-cjk/blob/main/Sans/OTF/Japanese/NotoSansCJKjp-Bold.otf)。ゴシックと同じライセンス。
- 明朝：[Noto Serif CJK JP Regular](https://github.com/notofonts/noto-cjk/blob/main/Serif/OTF/Japanese/NotoSerifCJKjp-Regular.otf)。ライセンスは `NotoSerif-OFL.txt` に同梱。
- 丸ゴシック：[Zen Maru Gothic Regular](https://github.com/google/fonts/blob/main/ofl/zenmarugothic/ZenMaruGothic-Regular.ttf)。ライセンスは `ZenMaruGothic-OFL.txt` に同梱。
- すべてのフォントは原本のまま配布。各ライセンス・著作権・出典とハッシュは `assets/fonts/` と `dist/fonts/` の `NOTICE.txt` に記載。
- 輪郭抽出：[OpenType.js](https://opentype.js.org/) 1.3.4（MIT）。既存ロック内の依存を直接依存として明示。

曲線の輪郭は物理寸法に応じた誤差上限0.002〜0.02 mmで分割し、非ゼロ巻き数で重なる筆画を統合します。文字の穴の情報は輪郭に保存され、一般スケッチの入れ子領域の扱いには影響しません。

縦書きはフォントのOpenType `vert` / `vrt2` 置換を利用します。該当字形がないフォントでは、括弧・長音などを回転し、句読点を右上へ配置します。通常の日本語・英数字の字形は回転しません。組版全体の禁則処理や縦中横には対応していません。[OpenType縦書き字形の仕様](https://learn.microsoft.com/en-us/typography/opentype/spec/features_uz#vrt2)

## 検証

- `node tests/text-sketch.mjs`：日本語／英数字、文字内の穴、字間・高さ・揃え・回転、改行、保存、移動、入力エラー、一般スケッチ。
- `node tests/text-sketch-native.mjs`：実CADの日本語／英数字押し出し、斜めの平面、穴を除いた体積、切り取り、有効なソリッド。
- `node tests/text-sketch-browser.mjs`：実画面のプレビュー、配置、吸着、キャンセル、元に戻す／やり直す、一括押し出し、保存・再読み込み、フォント切替。
- `node tests/text-fonts.mjs`：4種類の実輪郭・文字内の穴・保存、遅延読み込み・キャッシュ・失敗後の再試行。
- `node tests/text-fonts-native.mjs`：4種類すべての日本語・英数字の実CAD押し出し、有効なソリッドと穴を除いた体積。
- `node tests/text-fonts-browser.mjs`：メニュー切替、設定維持、遅い読み込みによる逆戻り防止、失敗と再試行、読み込み中の確定防止、ファイル読み込み、保存・再読み込みと一括押し出し。
- `node tests/text-layout-edit.mjs`：縦書きの並び・列・句読点・穴、4隅の拡大縮小、固定角と比率、移動吸着。
- `node tests/text-layout-edit-native.mjs`：全4書体の縦書き・サイズ変更後の実CAD押し出しと斜めの平面、穴・体積・有効性。
- `node tests/text-layout-edit-browser.mjs`：縦横切替、文字とハンドルのドラッグ、吸着解除、4隅・回転・XZ面のサイズ変更、プレビューの不変性、キャンセル、数値反映、押し出しと保存。
- `node tests/text-overlay-lifecycle-browser.mjs`：文字編集中だけ枠を表示し、取消・入力エラー・配置・押し出しへの移行時に枠とハンドルを消す。古い枠の座標を残さない。
