# めじるしサムネのComfyUIローカル生成（無料化）

2026-07-20 導入。めじるし新作記事のアイキャッチを Gemini API（有料）から
ローカルの ComfyUI（無料）に切り替えた際の構成メモ。

## 構成（投稿とサムネの分離＝後付け方式）

```
10:30 GitHub Actions (post-wordpress.yml)
      └ mejirushi:post … og:imageを仮アイキャッチにして投稿（止まらない）

随時  ローカルMac (launchd: 毎時)
      └ mejirushi:retrofit … サムネ未設定/仮の投稿を検出
           → ComfyUI(animagine-xl-4.0)でイラスト生成
           → compose-text.py で日本語タイトル・バッジ・値札を合成
           → WPメディアへアップし featured_media を差し替え
```

- ComfyUI は**プロジェクト内 `ComfyUI/`**（git対象外・arm64 venv・MPS対応）。
  モデル `animagine-xl-4.0-opt.safetensors` は328プロジェクトの実体への
  シンボリックリンク（7GB節約）
- retrofit が**サーバーを自動管理**する:
  ① 既存サーバー(8188等)が生きていれば相乗り
  ② いなければプロジェクト内ComfyUIをポート8189で自動起動
  ③ 自前起動した場合は完了後に停止してメモリを返す
- どちらも無ければ静かにスキップ（次回実行で処理）
- 判定: featured_media が 0、またはメディアファイル名が `-og.` を含む（og:image仮）

## セットアップ（launchd・1回だけ）

```bash
cat > ~/Library/LaunchAgents/com.sealmania.mejirushi-retrofit.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.sealmania.mejirushi-retrofit</string>
  <key>WorkingDirectory</key><string>/Users/noharakouhei/Downloads/321_seal-mania-claude</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>scripts/mejirushi/retrofit-thumbnails.js</string>
  </array>
  <key>StartInterval</key><integer>3600</integer>
  <key>StandardOutPath</key><string>/tmp/mejirushi-retrofit.log</string>
  <key>StandardErrorPath</key><string>/tmp/mejirushi-retrofit.log</string>
</dict>
</plist>
EOF
launchctl load ~/Library/LaunchAgents/com.sealmania.mejirushi-retrofit.plist
```

- 毎時実行（Macが起きている間）。スリープ中はスキップされ、起床後の次回実行で回収
- ログ: `/tmp/mejirushi-retrofit.log`
- 解除: `launchctl unload ~/Library/LaunchAgents/com.sealmania.mejirushi-retrofit.plist`

## 手動実行

```bash
npm run mejirushi:retrofit
```

## コスト

- Gemini `gemini-3.1-flash-image-preview`（画像 $0.04〜0.13/枚）→ **0円**
- 抽選・新作販売・週間まとめの3系統は当面Geminiのまま（様子見後に横展開判断）
