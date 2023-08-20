import { PublicKey } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { DecimalUtil, Percentage } from "@orca-so/common-sdk";
import {
  WhirlpoolContext, buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID,
  IGNORE_CACHE, getAllWhirlpoolAccountsForConfig, Trade,
  RoutingOptions, RouterUtils, RouteSelectOptions
} from "@orca-so/whirlpools-sdk";
import Decimal from "decimal.js";

//LANG:JP スクリプト実行前に環境変数定義が必要です
//LANG:EN Environment variables must be defined before script execution
// ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
// ANCHOR_WALLET=wallet.json

async function main() {
  //LANG:JP V0 トランザクション用の ALT を探す Lookup Table Fetcher を利用可能です
  //LANG:JP devnet では Orca が提供する Lookup Table Fetcher は存在しないため undefined とします
  //LANG:JP mainnet では以下のコードで Lookup Table Fetcher を作成できます
  //LANG:EN You can use the Lookup Table Fetcher to find ALTs for V0 transactions
  //LANG:EN The Lookup Table Fetcher provided by Orca is not available on devnet, so set it to undefined
  //LANG:EN On mainnet, you can create a Lookup Table Fetcher with the following code
  // import { OrcaLookupTableFetcher } from "@orca-so/orca-sdk";
  // import axios from "axios";
  // const server = axios.create({baseURL: "https://api.mainnet.orca.so/v1", responseType: "json"});
  // const lookupTableFetcher = new OrcaLookupTableFetcher(server, provider.connection);
  const lookupTableFetcher = undefined;

  //LANG:JP WhirlpoolClient 作成
  //LANG:EN Create WhirlpoolClient
  const provider = AnchorProvider.env();
  const ctx = WhirlpoolContext.withProvider(provider, ORCA_WHIRLPOOL_PROGRAM_ID, undefined, lookupTableFetcher);
  const client = buildWhirlpoolClient(ctx);

  console.log("endpoint:", ctx.connection.rpcEndpoint);
  console.log("wallet pubkey:", ctx.wallet.publicKey.toBase58());

  //LANG:JP トークン定義
  //LANG:EN Token definition
  // devToken specification
  // https://everlastingsong.github.io/nebula/
  const devUSDC = {mint: new PublicKey("BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k"), decimals: 6};
  const devSAMO = {mint: new PublicKey("Jd4M8bfJG3sAkd82RsGWyEXoaBXQP7njFzBwEaCTuDa"), decimals: 9};
  const devTMAC = {mint: new PublicKey("Afn8YB1p4NsoZeS5XJBZ18LTfEy5NFPwN46wapZcBQr6"), decimals: 6};

  //LANG:JP Whirlpool の Config アカウント
  //LANG:EN WhirlpoolsConfig account
  // devToken ecosystem / Orca Whirlpools
  const NEBULA_WHIRLPOOLS_CONFIG = new PublicKey("FcrweFY1G9HJAHG5inkGB6pKg1HZ6x9UC2WioAfWrGkR");

  //LANG:JP NEBULA_WHIRLPOOLS_CONFIG に所属するプールをすべて取得する
  //LANG:EN Get all pools belonging to NEBULA_WHIRLPOOLS_CONFIG
  const devWhirlpools = await getAllWhirlpoolAccountsForConfig({
    connection: ctx.connection,
    programId: ctx.program.programId,
    configId: NEBULA_WHIRLPOOLS_CONFIG,
  });
  console.log("detected whirlpools:", devWhirlpools.size);

  //LANG:JP プールのうち、現在の流動性が 0 であるものは除外する(パフォーマンスを上げるため)
  //LANG:EN Exclude pools with current liquidity of 0 (to improve performance)
  const addresses = Array.from(devWhirlpools.entries())
    .filter(([_address, data]) => !data.liquidity.isZero())
    .map(([address, _data]) => address);
  console.log("liquid whirlpools", addresses.length);

  //LANG:JP ルーターを作成する
  //LANG:EN Create router
  const router = await client.getRouter(addresses);

  //LANG:JP 100 devSAMO トークンを devTMAC にスワップする
  //LANG:EN Trade 100 devSAMO for devTMAC
  const trade: Trade = {
    tokenIn: devSAMO.mint,
    tokenOut: devTMAC.mint,
    amountSpecifiedIsInput: true, // we specify devSAMO input amount
    tradeAmount: DecimalUtil.toBN(new Decimal("100"), devSAMO.decimals),
  };

  //LANG:JP ルートの生成に利用するオプションを指定する
  //LANG:EN Specify the options to be used to generate the route
  const routingOptions: RoutingOptions = {
    ...RouterUtils.getDefaultRouteOptions(),
    //LANG:JP ルートの分割数や各ルートに割り当てる割合の変化率などを指定する
    //LANG:EN Specify the number of splits in the route and the rate of change of the allocation assigned to each route
  };
  const selectionOptions: RouteSelectOptions = {
    ...RouterUtils.getDefaultSelectOptions(),
    //LANG:JP V0 トランザクションをサポートするかどうかを指定する。デフォルトでは true となっている
    //LANG:EN Specify whether to support V0 transactions. The default is true
    maxSupportedTransactionVersion: ctx.txBuilderOpts.defaultBuildOption.maxSupportedTransactionVersion,
    //LANG:JP 作成済みの ATA を提供する (undefined の場合はチェーンからフェッチする)
    //LANG:JP 何度も同じ処理をする場合には、作成済みの ATA の一覧を指定することでパフォーマンスを向上させることができる
    //LANG:EN Provide the created ATA (fetch from the chain if undefined)
    //LANG:EN If you do the same process many times, you can improve performance by specifying a list of created ATAs
    availableAtaAccounts: undefined,
  };

  try {
    //LANG:JP 最適ルートを取得する
    //LANG:EN Get the best route
    const bestRoute = await router.findBestRoute(
      trade,
      routingOptions,
      selectionOptions,
      IGNORE_CACHE,
    );

    if (!bestRoute) {
      console.log("No route found");
      return;
    }

    //LANG:JP 取得したルートの詳細を表示する
    //LANG:JP チュートリアルでは devSAMO/devUSDC と devTMAC/devUSDC プールを経由して devSAMO から devTMAC にトレードされることを期待している
    //LANG:EN Display details of the route obtained
    //LANG:EN In this tutorial, we expect devSAMO to be traded for devTMAC via the devSAMO/devUSDC and devTMAC/devUSDC pools
    // devSAMO/devUSDC: EgxU92G34jw6QDG9RuTX9StFg1PmHuDqkRKAE5kVEiZ4
    // devTMAC/devUSDC: H3xhLrSEyDFm6jjG42QezbvhSxF5YHW75VdGUnqeEg5y
    const [tradeRoute, alts] = bestRoute;
    console.log("estimatedAmountIn:", DecimalUtil.fromBN(tradeRoute.totalAmountIn, devSAMO.decimals));
    console.log("estimatedAmountOut:", DecimalUtil.fromBN(tradeRoute.totalAmountOut, devTMAC.decimals));
    tradeRoute.subRoutes.forEach((subRoute, i) => {
      console.log(`subRoute[${i}] ${subRoute.splitPercent}%:`, subRoute.path.edges.map((e) => e.poolAddress).join(" - "));
    });
    console.log("alts:", alts?.map((a) => a.key.toBase58()).join(", "));

    //LANG:JP 許容するスリッページ (10/1000 = 1%)
    //LANG:EN Acceptable slippage (10/1000 = 1%)
    const slippage = Percentage.fromFraction(10, 1000);

    //LANG:JP トランザクションを送信
    //LANG:EN Send the transaction
    const tx = await router.swap(tradeRoute, slippage, null);
    const signature = await tx.buildAndExecute({
      //LANG:JP ALT を使用する場合のみ V0 Transaction を利用する
      //LANG:EN Use V0 Transaction if using ALT
      maxSupportedTransactionVersion: !!alts ? 0 : "legacy",
      lookupTableAccounts: alts,
    });
    console.log("signature:", signature);

    //LANG:JP トランザクション完了待ち
    //LANG:EN Wait for the transaction to complete
    const latest_blockhash = await ctx.connection.getLatestBlockhash();
    await ctx.connection.confirmTransaction({signature, ...latest_blockhash}, "confirmed");
  } catch (e) {
    console.error(e);
  }
}

main();