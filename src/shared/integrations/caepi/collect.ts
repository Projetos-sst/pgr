/**
 * Coleta da base oficial do CAEPI — o ÚNICO módulo com browser (anti-corruption
 * layer, contracts/ingestion-pipeline.md): nenhum outro arquivo conhece
 * Cloudflare/ASP.NET; quando o portal mudar, o conserto é aqui. Sem
 * `server-only`: roda apenas no script tsx do job, nunca no runtime da app.
 *
 * Fatos do Spike 0 (02/07/2026): o portal fica atrás de Cloudflare com desafio
 * JS (403 a cliente não-browser) e o download é um postback ASP.NET WebForms
 * que responde `RelatorioCA_AAAAMMDD_HHMMSS.csv.gz` (application/gzip).
 */
import { mkdtempSync, openSync, readSync, closeSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { chromium } from "playwright";

const CAEPI_PAGE_URL = "https://caepi.trabalho.gov.br/internet/ConsultaCAInternet.aspx";
// id real no DOM (spike T018): o ASP.NET emite o anchor SEM o prefixo `ctl00_`
// do UniqueID usado no __doPostBack.
const DOWNLOAD_LINK_ID = "#PlaceHolderConteudo_LinkButton1";
const CLOUDFLARE_CHALLENGE_TIMEOUT_MS = 90_000;
const DOWNLOAD_TIMEOUT_MS = 300_000;
const GZIP_SIGNATURE = Buffer.from([0x1f, 0x8b, 0x08]);

export class CollectError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CollectError";
  }
}

function assertGzipFile(filePath: string): void {
  const { size } = statSync(filePath);
  if (size === 0) throw new CollectError(`Download vazio: ${filePath}`);

  const fd = openSync(filePath, "r");
  const header = Buffer.alloc(GZIP_SIGNATURE.length);
  try {
    readSync(fd, header, 0, header.length, 0);
  } finally {
    closeSync(fd);
  }
  if (!header.equals(GZIP_SIGNATURE)) {
    throw new CollectError(
      `Assinatura gzip inválida em ${filePath} (esperado 1f 8b 08, veio ${header.toString("hex")})`,
    );
  }
}

/**
 * Baixa a base oficial e devolve o caminho do `.csv.gz` validado (existe,
 * não-vazio, assinatura gzip). Qualquer outra situação — desafio Cloudflare não
 * resolvido, timeout, download ausente — lança `CollectError`: nunca devolve
 * caminho de arquivo suspeito (o fail-safe do job depende disso).
 */
export async function collectCaepiFile(opts: { outDir?: string } = {}): Promise<string> {
  const outDir = opts.outDir ?? mkdtempSync(path.join(tmpdir(), "caepi-"));
  // Spike T018 (2026-07-02): TODO modo headless (shell antigo, headless novo do
  // Chromium completo e do Chrome real) fica preso no desafio Cloudflare
  // ("Um momento…"); o browser HEADED passa. Por isso o default é headed — o
  // runner do job precisa de display (xvfb em CI); sem display, o caminho
  // oficial é o fallback `--file` (mesmo parse+upsert, zero retrabalho).
  const browser = await chromium.launch({ channel: "chromium", headless: false });

  try {
    const context = await browser.newContext({ locale: "pt-BR" });
    const page = await context.newPage();

    await page.goto(CAEPI_PAGE_URL, { waitUntil: "domcontentloaded" });
    // O desafio Cloudflare redireciona/re-renderiza sozinho num browser real;
    // a página só está "vencida" quando o link de download existe no DOM.
    await page
      .waitForSelector(DOWNLOAD_LINK_ID, { timeout: CLOUDFLARE_CHALLENGE_TIMEOUT_MS })
      .catch((cause) => {
        throw new CollectError(
          "Link de download não apareceu — desafio Cloudflare não resolvido ou layout do portal mudou.",
          { cause },
        );
      });

    const downloadPromise = page.waitForEvent("download", {
      timeout: DOWNLOAD_TIMEOUT_MS,
    });
    await page.click(DOWNLOAD_LINK_ID);
    const download = await downloadPromise.catch((cause) => {
      throw new CollectError("Download não iniciou após o postback.", { cause });
    });

    // `path()` espera o download TERMINAR (saveAs num download ainda em curso
    // cancela em corrida com o fim da navegação do postback).
    const failure = await download.failure();
    if (failure) {
      throw new CollectError(`Download falhou no browser: ${failure}`);
    }
    await download.path();

    const fileName = download.suggestedFilename() || "RelatorioCA.csv.gz";
    const filePath = path.join(outDir, fileName);
    await download.saveAs(filePath);

    assertGzipFile(filePath);
    return filePath;
  } finally {
    await browser.close();
  }
}
