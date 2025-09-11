@echo off
cd /d "C:\Users\yuzuk\OneDrive\デスクトップ\my-review-app"

echo データ削除問題の修正をプッシュします...
git add .
git commit -m "fix: 古い問題が削除できない問題を修正 - データソース選択機能追加"
git push origin main

echo 完了！
pause
