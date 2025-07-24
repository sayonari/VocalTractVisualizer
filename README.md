# Vocal Tract Visualizer

https://github.com/HidekiKawahara/SparkNG
このリポジトリの内容を参考に作りました．河原英紀先生に敬意を表します．

[**Live Demo**](https://sayonari.github.io/VocalTractVisualizer/) - 音声分析ツールのデモページ

## 概要

Vocal Tract Visualizerは、リアルタイム音声分析と声道形状の可視化を行うWebアプリケーションです。SparkNG（MATLAB版）の機能をWebブラウザ上で実現しました。

## 主な機能

- **リアルタイム音声分析**: マイクからの音声入力をリアルタイムで解析
- **声道形状の3D可視化**: LPC分析による声道断面積を3Dモデルで表示
- **スペクトログラム表示**: 音声の時間-周波数特性を可視化
- **音響特徴量の表示**: 基本周波数（F0）、フォルマント、音声強度など

## 技術スタック

- **フロントエンド**: TypeScript, LitElement (Web Components)
- **音声処理**: Web Audio API, カスタムDSPアルゴリズム
- **3D可視化**: Three.js
- **ビルドツール**: Vite
- **状態管理**: MobX

## インストールと実行

```bash
# リポジトリのクローン
git clone https://github.com/sayonari/VocalTractVisualizer.git
cd VocalTractVisualizer

# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# 本番ビルド
npm run build
```

## 使用方法

1. Webブラウザでアプリケーションを開く
2. 「録音開始」ボタンをクリックしてマイクアクセスを許可
3. 音声を入力すると、リアルタイムで分析結果が表示される
   - 左側: 音声波形
   - 右側: 3D声道モデル
   - 下部: スペクトログラム

## ブラウザ要件

- Chrome 90+
- Firefox 88+
- Safari 14.1+
- Edge 90+

WebAudioAPIとWebGLをサポートしているモダンブラウザが必要です。

## ライセンス

このソフトウェアはApache License 2.0のもとで公開されています。

### 謝辞とライセンス表記

This software includes code derived from SparkNG  
Copyright 2017, 2018 Hideki Kawahara, all rights reserved  
Licensed under the Apache License, Version 2.0

Original SparkNG repository: https://github.com/HidekiKawahara/SparkNG

### 本ソフトウェアのライセンス

Copyright 2025 Ryota Nishimura

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

## 技術的詳細

### 音声分析アルゴリズム

- **LPC分析**: Levinson-Durbinアルゴリズムによる線形予測分析
- **FFT**: Cooley-Tukeyアルゴリズムによる高速フーリエ変換
- **基本周波数推定**: 自己相関法とケプストラム法の組み合わせ
- **フォルマント推定**: LPCスペクトルのピーク検出

### 声道モデリング

反射係数から声道断面積への変換には、音響管モデルに基づく以下の式を使用：

```
A[i] = A[i-1] * ((1 - k[i]) / (1 + k[i]))
```

ここで、A[i]は各セクションの断面積、k[i]は反射係数です。

## 貢献

バグ報告や機能提案は[Issues](https://github.com/sayonari/VocalTractVisualizer/issues)にお願いします。

プルリクエストも歓迎します。大きな変更を行う場合は、まずIssueで議論してください。

## 参考文献

- Kawahara, H. (2017-2018). SparkNG: Speech Production and Auditory perception Research Kernel, Next Generation.
- Markel, J. D., & Gray, A. H. (1976). Linear prediction of speech. Springer-Verlag.