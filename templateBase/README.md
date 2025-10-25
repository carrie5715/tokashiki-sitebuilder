# 依存ツール
## rclone
ドライブへアップロードに使用しています。
rcloneを使えるように設定してください。
```
brew install rclone
```

## ダウンロード（output フォルダ → ローカル ./output）
`.env` の `PROJECT_FOLDER_ID` を、対象プロジェクトの Drive フォルダIDに設定してから実行します。

ドライラン（確認のみ）
```
npm run download:dry
```

実行（同期：ローカルを一度空にしてから再配置）
```
npm run download
```

備考:
- rclone は `--drive-root-folder-id=$PROJECT_FOLDER_ID` を使ってプロジェクトフォルダをルートに設定し、その直下の `output` ディレクトリを `./output` に同期します。
- 余分なファイルは同期の過程で削除されます（`sync` の仕様）。
- `download` はローカル `./output` を一旦削除してから、`copy` で配置します（実質フルリプレース）。

## プレビュー（ローカル）
`./output` を静的配信します。ポートは 5174 を使用します。

```
npm run preview
```

URL: http://localhost:5174