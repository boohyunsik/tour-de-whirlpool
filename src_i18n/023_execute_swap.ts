import { PublicKey } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { DecimalUtil, Percentage } from "@orca-so/common-sdk";
import {
  WhirlpoolContext, buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID,
  PDAUtil, swapQuoteByInputToken, IGNORE_CACHE
} from "@orca-so/whirlpools-sdk";
import Decimal from "decimal.js";

//LANG:JP スクリプト実行前に環境変数定義が必要です
//LANG:EN Environment variables must be defined before script execution
//LANG:KR 스크립트 실행 전 환경변수 설정을 미리 해야함
// ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
// ANCHOR_WALLET=wallet.json

async function main() {
  //LANG:JP WhirlpoolClient 作成
  //LANG:EN Create WhirlpoolClient
  //LANG:KR WhirlpoolClient 생성
  const provider = AnchorProvider.env();
  const ctx = WhirlpoolContext.withProvider(provider, ORCA_WHIRLPOOL_PROGRAM_ID);
  const client = buildWhirlpoolClient(ctx);

  console.log("endpoint:", ctx.connection.rpcEndpoint);
  console.log("wallet pubkey:", ctx.wallet.publicKey.toBase58());

  //LANG:JP トークン定義
  //LANG:EN Token definition
  //LANG:KR 토큰 정의
  // devToken specification
  // https://everlastingsong.github.io/nebula/
  const devUSDC = {mint: new PublicKey("BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k"), decimals: 6};
  const devSAMO = {mint: new PublicKey("Jd4M8bfJG3sAkd82RsGWyEXoaBXQP7njFzBwEaCTuDa"), decimals: 9};

  //LANG:JP Whirlpool の Config アカウント
  //LANG:EN WhirlpoolsConfig account
  //LANG:KR WhirlpoolsConfig 계정
  // devToken ecosystem / Orca Whirlpools
  const DEVNET_WHIRLPOOLS_CONFIG = new PublicKey("FcrweFY1G9HJAHG5inkGB6pKg1HZ6x9UC2WioAfWrGkR");

  //LANG:JP devSAMO/devUSDC プール取得
  //LANG:EN Get devSAMO/devUSDC whirlpool
  //LANG:KR devSAMO/devSUDC whirlpool을 가져옴옴
  //LANG:JP Whirlpool のプールは (プログラム, Config, 1個目のトークンのミントアドレス, 2個目のトークンのミントアドレス, ティックスペース)
  //LANG:JP の 5 要素で特定されます (DBで考えると5列の複合プライマリキーです)
  //LANG:EN Whirlpools are identified by 5 elements (Program, Config, mint address of the 1st token,
  //LANG:EN mint address of the 2nd token, tick spacing), similar to the 5 column compound primary key in DB
  //LANG:KR Whirlpools은 데이터베이스에서 5개의 열로 구성된 복합 기본키처럼, 다음의 5가지 요소로 식별됨
  //LANG:KR 프로그램, Config, 첫 번째 토큰의 민트 주소, 두 번째 토큰의 민트 주소, 그리고 틱 간격
  const tick_spacing = 64;
  const whirlpool_pubkey = PDAUtil.getWhirlpool(
      ORCA_WHIRLPOOL_PROGRAM_ID,
      DEVNET_WHIRLPOOLS_CONFIG,
      devSAMO.mint, devUSDC.mint, tick_spacing).publicKey;
  console.log("whirlpool_key:", whirlpool_pubkey.toBase58());
  const whirlpool = await client.getPool(whirlpool_pubkey);

  //LANG:JP 1 devUSDC トークンを devSAMO にスワップします
  //LANG:EN Swap 1 devUSDC for devSAMO
  //LANG:KR devUSDC 1개를 devSAMO로 스왑함
  const amount_in = new Decimal("1" /* devUSDC */);

  //LANG:JP スワップの見積もり取得(シミュレーション実行)
  //LANG:EN Obtain swap estimation (run simulation)
  //LANG:KR 스왑 예상치 획득(시뮬레이션 실행)
  const quote = await swapQuoteByInputToken(
    whirlpool,
    //LANG:JP 入力するトークン
    //LANG:EN Input token and amount
    //LANG:KR 입력할 토큰 및 수량
    devUSDC.mint,
    DecimalUtil.toBN(amount_in, devUSDC.decimals),
    //LANG:JP 許容するスリッページ (10/1000 = 1%)
    //LANG:EN Acceptable slippage (10/1000 = 1%)
    //LANG:KR 허용 슬리피지 (10/1000 = 1%)
    Percentage.fromFraction(10, 1000),
    ctx.program.programId,
    ctx.fetcher,
    IGNORE_CACHE,
  );

  //LANG:JP 見積もり結果表示
  //LANG:EN Output the estimation
  //LANG:KR 예상 결과 출력
  console.log("estimatedAmountIn:", DecimalUtil.fromBN(quote.estimatedAmountIn, devUSDC.decimals).toString(), "devUSDC");
  console.log("estimatedAmountOut:", DecimalUtil.fromBN(quote.estimatedAmountOut, devSAMO.decimals).toString(), "devSAMO");
  console.log("otherAmountThreshold:", DecimalUtil.fromBN(quote.otherAmountThreshold, devSAMO.decimals).toString(), "devSAMO");

  //LANG:JP トランザクションを送信
  //LANG:EN Send the transaction
  //LANG:KR 트랜잭션 전파
  const tx = await whirlpool.swap(quote);
  const signature = await tx.buildAndExecute();
  console.log("signature:", signature);

  //LANG:JP トランザクション完了待ち
  //LANG:EN Wait for the transaction to complete
  //LANG:KR 트랜잭션이 반영될 때 까지 대기
  const latest_blockhash = await ctx.connection.getLatestBlockhash();
  await ctx.connection.confirmTransaction({signature, ...latest_blockhash}, "confirmed");
}

main();
