# Maintenance Guide

ukagaka-doc-mcp の運用・保守手順を、共同メンテナ向けにまとめたドキュメント。
日常開発フローは [README](../README.md) / [CLAUDE.md](../CLAUDE.md) を参照のこと。

## 目次

1. [自動運用の全体像](#自動運用の全体像)
2. [依存関係の更新（人手）](#依存関係の更新人手)
3. [セキュリティ修正 (npm audit)](#セキュリティ修正-npm-audit)
4. [手動リリース](#手動リリース)
5. [手動 refresh:index](#手動-refreshindex)
6. [branch protection と PR ワークフロー](#branch-protection-と-pr-ワークフロー)
7. [トラブルシューティング](#トラブルシューティング)
8. [過去のインシデント・教訓](#過去のインシデント教訓)

---

## 自動運用の全体像

3 つの GitHub Actions が連携している。

| Workflow | Trigger | 役割 |
|---|---|---|
| `refresh-index-pr.yml` | cron `17 3 * * 1`（毎週月曜 12:17 JST） / `workflow_dispatch` | submodule 更新 → index 再生成 → patch version bump → PR 作成（auto-merge） |
| `ci.yml` | `pull_request` / `push` to main / `workflow_dispatch` | build + test + `npm pack` 検証。`auto-index-refresh` ラベル PR には scope 検証あり |
| `release.yml` | `push` to main で commit message 判定 / `workflow_dispatch` | npm publish (OIDC) + git tag + GitHub Release |

通常時はこの 3 つが噛み合って週次リリースが流れる。人手介入が必要になるのは以下のケース:

- 依存関係更新（major bump や脆弱性対応）
- 自動更新の失敗時リカバリ
- 手動リリース（ホットフィックス等）

---

## 依存関係の更新（人手）

### 判断

```bash
npm outdated
```

| 列 | 意味 |
|---|---|
| `Current` | 実際に install されているバージョン |
| `Wanted` | `package.json` の `^` 範囲内で取れる最新 |
| `Latest` | レジストリの最新 |

- **patch / minor**（`Wanted` と `Latest` が同 major）: `npm update --save` で安全に追従
- **major**（`Latest` が異なる major）: 破壊的変更の確認が必要

`@types/node` は `engines.node` の最低 major に合わせる慣習。現状 `engines.node: ">=20.0.0"` のため `@types/node` は **22 系維持**（Node 25 が出ても 22 のまま、engines を上げる議論とセット）。

### 段階的アップグレード手順

メジャーを複数本同時に上げるときは、3 commit を 1 PR に分けて各段階で build + test を独立検証する。

```bash
git checkout -b chore/deps-upgrade

# Step 1: patch updates（^ 範囲内のずれを揃える）
npm update --save
npm run build && npm test
git add package.json package-lock.json
git commit -m "chore(deps): apply patch updates within current ranges"

# Step 2: TypeScript major bump
npm install -D typescript@^N
npm run build && npm test
git add package.json package-lock.json
git commit -m "chore(deps): upgrade typescript to vN"

# Step 3: ライブラリ major bump
# 必ず先に SDK の peer を確認
cat node_modules/@modelcontextprotocol/sdk/package.json | jq '.peerDependencies'
npm install <library>@^N
npm run build && npm test
git add package.json package-lock.json
git commit -m "chore(deps): upgrade <library> to vN"

git push -u origin chore/deps-upgrade
gh pr create
```

**Why staged**: 破壊的変更を一段ずつ切り分け、回帰時に `git bisect` で特定可能。
**Why 1 PR**: レビューを束ねつつ履歴は段階単位で残す。

### refresh-index PR との衝突対処

週次 cron で main の `package.json` (version) と `package-lock.json` が頻繁に動くため、人手の dep PR を長く寝かせると衝突確定。

```bash
git fetch origin main
git rebase origin/main

# 通常 package.json は git auto-merge で解決
# package-lock.json で衝突 → main 側を採用 → 自分の package.json 制約で再生成
git checkout --ours package-lock.json
npm install --package-lock-only
git add package-lock.json
git rebase --continue

# rebase 後は実環境を再同期して再検証
npm install
npm run build && npm test
git push --force-with-lease origin <branch>
```

`--force-with-lease` は `--force` と違いリモートの変化を検知して安全に拒否してくれる。dep PR の force-push は常にこちらで。

---

## セキュリティ修正 (npm audit)

### 確認

```bash
npm audit              # 概要
npm audit --json       # 詳細（経路 / isDirect / fixAvailable を見るのに必須）
```

判断軸:

- `isDirect: false` → 推移依存。`fixAvailable: true` なら lockfile-only fix で済むことが多い
- `isDirect: true` → 自分の `package.json` を変更する必要がある可能性

### 適用

```bash
git checkout -b chore/audit-fix
npm audit fix          # --force は付けない（root の major bump を引き起こす）
npm run build && npm test
git add package-lock.json   # 通常 package.json は不変
git commit -m "chore(deps): npm audit fix for transitive vulnerabilities"
```

`npm audit fix` で解決しない場合は `package.json` の `overrides` で強制ピン:

```json
{
  "overrides": {
    "vulnerable-pkg": "^safe.version"
  }
}
```

### ランタイム影響の判定

本サーバーは **stdio transport の MCP サーバー**。SDK が引いてくる HTTP/SSE 系 (`hono` / `@hono/node-server`) は実行時に呼ばれない。`vite` / `postcss` は vitest 経由の dev-only。とはいえ npm audit クリーン化と将来の公開信頼性のため修正は推奨。

---

## 手動リリース

### release.yml の発火条件

`release.yml` は次のいずれかでのみ発火する:

1. `chore: refresh documentation snapshot` で**始まる** commit message が main に push（cron 経由の通常リリース）
2. `workflow_dispatch`（手動）

その他の commit message は publish しない。dep 系の `chore(deps):` 等は安全。

### 手動実行

```bash
# 事前に package.json の version を上げる（release.yml は自動 bump しない）
npm version patch  # or minor / major
git push origin main --follow-tags  # ※ tag は release.yml が後で打ち直すので push 必須ではない

gh workflow run release.yml
```

### 失敗時のチェックリスト

| チェック項目 | コマンド / 確認場所 |
|---|---|
| 既に publish 済みではないか（冪等性） | `npm view ukagaka-doc-mcp@<version>` |
| git tag `v<version>` の存在 | `git tag -l v<version>` |
| GitHub Release の存在 | `gh release view v<version>` |
| OIDC: Trusted Publisher 設定 | npmjs.com の package settings |
| OIDC: npm CLI が 11.5.1+ か | release.yml の `npm install -g "npm@>=11.5.1"` ステップ |
| OIDC: `setup-node` に `registry-url` 未設定か | `.github/workflows/release.yml` の `Set up Node.js` ステップ |

`release.yml` の Validate release state ステップは npm/tag/release の三位一体を検証している。途中まで成功して止まった場合、整合が崩れていると以後のリトライが弾かれる。手動で tag や release を消してから再実行すること。

---

## 手動 refresh:index

ローカルで snapshot を再生成したい場合:

```bash
npm run refresh:index
# 内部: git submodule sync --recursive
#       git submodule update --init --remote docs/ukadoc
#       npm run build:index
```

PR にする場合の注意:

- `auto-index-refresh` ラベルを **付けない**こと。ラベルが付くと `ci.yml` の scope 検証が動き、許可ファイル以外の変更で CI が落ちる
- 許可ファイル: `data/index.json` / `docs/ukadoc` / `package.json`（version 行のみ） / `package-lock.json`（version 行のみ）

人手のリフレッシュ PR を release に流したい場合は commit message を `chore: refresh documentation snapshot` にすること（cron 経由と同じ扱いで `release.yml` が動く）。

---

## branch protection と PR ワークフロー

main の保護設定:

| 設定 | 値 |
|---|---|
| Required status check | `validate` (`ci.yml`) |
| `strict` | `true`（main の最新と整合が必要） |
| `enforce_admins` | `false`（admin の直 push は通る） |
| `allow_force_pushes` | `false` |
| `allow_deletions` | `false` |

原則 **PR 経由**。docs-only であっても PR を切るのが筋。admin による直 push は CI gate を避けるため緊急対応用に留めること。

PR 作成時のトークンに注意:

- `GITHUB_TOKEN` で作った PR は CI が走らない（GitHub の循環防止仕様）
- ローカルからの `gh pr create` は個人 OAuth トークン → CI 走る
- 自動化からの作成は GitHub App トークン（`APP_ID` / `APP_PRIVATE_KEY` secrets）→ CI 走る

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| `git pull` 後 `docs/ukadoc (new commits)` と表示 | submodule HEAD が記録 SHA と乖離 | `git submodule update --recursive` |
| dep PR が `CONFLICTING` | 寝かせている間に refresh-index PR が main を更新 | [refresh-index PR との衝突対処](#refresh-index-pr-との衝突対処) |
| CI `validate` が走らない | PR 作成トークンが `GITHUB_TOKEN` | App token または個人トークンで作り直し |
| `npm publish` で OIDC 認証エラー | `registry-url` 設定 / npm CLI 古い / Trusted Publisher 不一致 | [失敗時のチェックリスト](#失敗時のチェックリスト) |
| `release.yml` が発火しない | commit message が `chore: refresh documentation snapshot` で始まらない | `gh workflow run release.yml` で手動実行 |
| `release.yml` が想定外発火 | 上記 prefix を持つ commit を意図せず作った | message を変更 / 即 revert |
| `npm audit fix` 後 build/test が壊れる | 推移依存の挙動変化が表面化 | 該当推移依存を `overrides` で前バージョンにピン → upstream 修正待ち |

---

## 過去のインシデント・教訓

<!--
TODO: 共同メンテナのために、過去に踏んだ大きな問題と再発防止策を残してください。
私（Claude）には git history からの推測しかできない領域です。例えば:

- `release.yml` を 2026-04 にゼロから書き直した経緯（commit 11f6d46 前後で何があったか）
- npm publish 周りで実際に詰まった具体例とその解決
- secrets ローテーションの履歴と運用ポリシー
- その他、再発防止のために残しておきたい教訓

書式は自由ですが、各エントリに「日付 / 症状 / 原因 / 対処 / 残った gotcha」を含めると次の人が辿りやすくなります。
-->
