## セットアップ

```bash
$ pnpm install

$ pnpm prisma migrate dev
```

## アプリ起動

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## テスト実行

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## APIクライアントコードの生成

open-api.jsonを出力

```bash
$ pnpm generate-api
```

## マイグレーションの実行

```bash
# development
$ pnpm prisma migrate dev --name <変更名>

# production
$ pnpm prisma migrate deploy --name <変更名>
```
