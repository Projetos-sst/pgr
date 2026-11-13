import { readFileSync } from "node:fs";
import path from "node:path";

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeightRule,
  ImageRun,
  LineRuleType,
  PageNumber,
  Paragraph,
  ShadingType,
  TabStopType,
  TextRun,
  TableRow,
  type ParagraphChild,
  type Table,
} from "docx";

import { PGR_DOCX_STYLE_IDS } from "@/shared/domains/pgr/pgr-docx/ooxml";
import { keepLastWords } from "@/shared/domains/pgr/pgr-docx/rich-text";
import { PGR_DOCX_LOGO_PLACEHOLDER } from "@/shared/domains/pgr/pgr-docx/template-file";
import {
  PGR_DOCX_AGENT_COLORS,
  PGR_DOCX_AGENT_KEYS,
  PGR_DOCX_FONT,
  PGR_DOCX_RISK_CLASS_COLORS,
  PGR_DOCX_RISK_CLASSES,
  PGR_DOCX_TABLE_HEAD,
} from "@/shared/domains/pgr/pgr-docx/theme";
import type { PgrDocxTextKey } from "@/shared/domains/pgr/pgr-docx/defaults";

import {
  BORDERS,
  C,
  HEAD,
  MUTED,
  S,
  SMALL_LABEL,
  WIDTH,
  body,
  control,
  createKit,
  grid,
  heading,
  headerRow,
  spacer,
  subheading,
  subtitle,
  tc,
  tp,
  tr,
  type Kit,
  type TemplateMode,
} from "./template-kit";

/** Nome do `docPr` da imagem do logo no cabeçalho — a renderização troca pelo logo da empresa. */
export const LOGO_PLACEHOLDER_NAME = PGR_DOCX_LOGO_PLACEHOLDER;

const ASSETS = path.join(process.cwd(), "templates/pgr/assets");

const A4 = { width: 11906, height: 16838 };
const MARGINS = {
  top: 1900,
  right: 720,
  bottom: 1150,
  left: 720,
  header: 360,
  footer: 380,
};

const WIDOW_CONTROL = { widowControl: true };

// ---------------------------------------------------------------- cabeçalho / rodapé

function pageHeader(kit: Kit, titleChildren: ParagraphChild[]) {
  const logo = new ImageRun({
    type: "png",
    data: readFileSync(path.join(ASSETS, "pgr-e-logo.png")),
    // Caixa do logo: 150×50 px — o logo da empresa entra proporcional dentro dela.
    transformation: { width: 150, height: 50 },
    altText: {
      name: LOGO_PLACEHOLDER_NAME,
      title: LOGO_PLACEHOLDER_NAME,
      description: "Logo da empresa (substituído na geração do documento)",
    },
  });
  const logoWidth = 2600;
  return new Header({
    children: [
      grid(
        [
          tr([
            tc([new Paragraph({ children: [logo] })], { width: logoWidth, margins: 0 }),
            tc(
              [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: titleChildren,
                }),
              ],
              { width: WIDTH - logoWidth * 2 },
            ),
            tc([], { width: logoWidth }),
          ]),
        ],
        [logoWidth, WIDTH - logoWidth * 2, logoWidth],
        BORDERS.none,
      ),
      new Paragraph({
        spacing: { before: 60, after: 0 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 8, color: C.primary, space: 1 },
        },
        children: [],
      }),
    ],
  });
}

function pageFooter(kit: Kit) {
  const small = { size: S.small, color: C.subtle };
  return new Footer({
    children: [
      new Paragraph({
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: C.border, space: 6 },
        },
        tabStops: [
          { type: TabStopType.CENTER, position: Math.round(WIDTH / 2) },
          { type: TabStopType.RIGHT, position: WIDTH },
        ],
        children: [
          kit.fx("PGR-e · Sistema de Gestão de Riscos", {
            ...small,
            bold: true,
            color: C.primary,
          }),
          new TextRun({ text: "\t", ...small }),
          kit.fx("Emitido em: ", { ...small, bold: true, color: C.muted }),
          kit.dy("emittedAt", { ...small, color: C.muted }),
          new TextRun({ text: "\t", ...small }),
          new TextRun({
            ...small,
            children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES],
          }),
        ],
      }),
    ],
  });
}

// ---------------------------------------------------------------- capa

function cover(kit: Kit) {
  const brand = new ImageRun({
    type: "png",
    data: readFileSync(path.join(ASSETS, "pgr-e-logo.png")),
    transformation: { width: 150, height: 50 },
    altText: {
      name: "pgr-cover-brand",
      title: "PGR-e",
      description: "Marca PGR-e na capa",
    },
  });
  const right = (children: ParagraphChild[], after = 0) =>
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after },
      children,
    });
  const band = grid(
    [
      tr([
        tc(
          [
            right(
              [
                kit.fx("PGR-e · SISTEMA DE GESTÃO DE RISCOS", {
                  size: S.small,
                  bold: true,
                  color: C.white,
                  characterSpacing: 30,
                }),
              ],
              240,
            ),
            right([
              kit.label("documentTitle", { size: 120, bold: true, color: C.white }),
            ]),
            right([kit.label("documentSubtitle", { size: 40, color: C.white })]),
          ],
          { width: WIDTH, fill: C.primary, margins: 520 },
        ),
      ]),
      new TableRow({
        height: { value: 140, rule: HeightRule.EXACT },
        cantSplit: true,
        children: [
          tc([spacer(20)], { width: WIDTH, fill: C.primaryStrong, margins: 20 }),
        ],
      }),
    ],
    [WIDTH],
    BORDERS.none,
  );
  return [
    new Paragraph({ spacing: { before: 0, after: 2600 }, children: [brand] }),
    band,
    spacer(560),
    raw(kit, "cover.validityXml"),
    raw(kit, "cover.razaoSocialXml"),
    raw(kit, "cover.nomeFantasiaXml"),
    raw(kit, "cover.cityStateXml"),
    raw(kit, "cover.workUnitXml"),
    raw(kit, "cover.contractXml"),
  ];
}

// ---------------------------------------------------------------- identificação

function kv(
  kit: Kit,
  labelKey: Parameters<Kit["label"]>[0],
  tag: string,
  fallback?: string,
) {
  return [
    kit.label(labelKey, { bold: true }),
    kit.fx(" "),
    kit.dy(tag),
    ...(fallback ? [kit.ctl(`^${tag}`), kit.fx(fallback), kit.ctl(`/${tag}`)] : []),
  ];
}
const SEP = (kit: Kit) => kit.fx("   |   ", { color: C.subtle });
const NOT_INFORMED = "Não informado";
function optionalKv(kit: Kit, labelKey: Parameters<Kit["label"]>[0], tag: string) {
  return [kit.ctl(`#${tag}`), SEP(kit), ...kv(kit, labelKey, tag), kit.ctl(`/${tag}`)];
}

function identification(kit: Kit) {
  const line = (children: ParagraphChild[]) => body(children, { align: "left" });
  const contractLine = (key: Parameters<Kit["label"]>[0], tag: string) =>
    line([
      kit.label(key, { color: C.primaryStrong }),
      kit.fx(" "),
      kit.dy(tag),
      kit.ctl(`^${tag}`),
      kit.fx(NOT_INFORMED),
      kit.ctl(`/${tag}`),
    ]);
  const respWidth = [WIDTH * 0.62, WIDTH * 0.38].map(Math.round);
  return [
    heading([kit.label("employerSection")]),
    line(kv(kit, "company", "company.razaoSocial", NOT_INFORMED)),
    line(kv(kit, "address", "company.address", NOT_INFORMED)),
    line([
      ...kv(kit, "cnpj", "company.cnpj", NOT_INFORMED),
      ...optionalKv(kit, "stateRegistration", "company.stateRegistration"),
      ...optionalKv(kit, "phone", "company.phone"),
    ]),
    line(kv(kit, "cnae", "company.cnae", NOT_INFORMED)),
    line(kv(kit, "riskGrade", "company.riskGrade", NOT_INFORMED)),

    heading([kit.label("workUnitSection")]),
    line([
      ...kv(kit, "workUnit", "workUnit.name", NOT_INFORMED),
      ...optionalKv(kit, "workUnitContract", "workUnit.contractNumbers"),
    ]),
    control(kit, "#contract.hasAny"),
    line([kit.label("contractDescription", { bold: true })]),
    contractLine("contractor", "contract.contractor"),
    contractLine("contractorCnpj", "contract.contractorCnpj"),
    contractLine("contractNumber", "contract.number"),
    contractLine("contractManager", "contract.manager"),
    contractLine("contractInspector", "contract.inspector"),
    contractLine("contractAgent", "contract.agent"),
    contractLine("contractAgentContact", "contract.agentContact"),
    contractLine("contractObject", "contract.object"),
    contractLine("contractTerm", "contract.term"),
    contractLine("contractEmployees", "contract.employees"),
    contractLine("executionPlace", "contract.executionPlace"),
    control(kit, "/contract.hasAny"),
    line([kit.label("workUnitAddress", { bold: true })]),
    raw(kit, "workUnitAddressXml"),

    heading([kit.label("responsiblesSection")]),
    grid(
      [
        tr([
          tc(
            [
              tp([
                ...kv(kit, "author", "responsibles.author", NOT_INFORMED),
                ...optionalKv(kit, "coauthors", "responsibles.coauthors"),
              ]),
            ],
            { width: respWidth[0] },
          ),
          tc(
            [
              tp([
                ...kv(
                  kit,
                  "registration",
                  "responsibles.authorRegistration",
                  NOT_INFORMED,
                ),
                ...optionalKv(kit, "registration", "responsibles.coauthorRegistration"),
              ]),
            ],
            { width: respWidth[1] },
          ),
        ]),
        tr([
          tc(
            [
              tp(
                kv(
                  kit,
                  "companyResponsible",
                  "responsibles.companyResponsible",
                  NOT_INFORMED,
                ),
              ),
            ],
            {
              width: respWidth[0],
            },
          ),
          tc(
            [
              tp(
                kv(
                  kit,
                  "registrationType",
                  "responsibles.registrationType",
                  NOT_INFORMED,
                ),
              ),
            ],
            {
              width: respWidth[1],
            },
          ),
        ]),
      ],
      respWidth,
      BORDERS.rows,
    ),

    heading([kit.label("revisionSection")]),
    revisionsTable(kit),
  ];
}

function revisionsTable(kit: Kit) {
  const widths = [900, 1200, 1200, 3700, 3466];
  return grid(
    [
      headerRow([
        { children: [kit.label("revisionNumber", HEAD)], width: widths[0] },
        { children: [kit.label("revisionDate", HEAD)], width: widths[1] },
        { children: [kit.label("revisionValidUntil", HEAD)], width: widths[2] },
        { children: [kit.label("revisionDescription", HEAD)], width: widths[3] },
        { children: [kit.label("revisionResponsible", HEAD)], width: widths[4] },
      ]),
      tr([
        tc([tp([kit.ctl("#revisions"), kit.dy("number", { bold: true })])], {
          width: widths[0],
        }),
        tc([tp([kit.dy("date"), kit.ctl("^date"), kit.fx("—"), kit.ctl("/date")])], {
          width: widths[1],
        }),
        tc(
          [
            tp([
              kit.dy("validUntil"),
              kit.ctl("^validUntil"),
              kit.fx("—"),
              kit.ctl("/validUntil"),
            ]),
          ],
          {
            width: widths[2],
          },
        ),
        tc(
          [
            tp([
              kit.dy("description"),
              kit.ctl("^description"),
              kit.fx("—"),
              kit.ctl("/description"),
            ]),
          ],
          {
            width: widths[3],
          },
        ),
        tc(
          [
            tp([
              kit.dy("responsible"),
              kit.ctl("^responsible"),
              kit.fx("—"),
              kit.ctl("/responsible"),
              kit.ctl("/revisions"),
            ]),
          ],
          { width: widths[4] },
        ),
      ]),
    ],
    widths,
    BORDERS.rows,
  );
}

function summary(kit: Kit) {
  return [
    heading([kit.label("summary")], { pageBreakBefore: true }),
    control(kit, "#summary"),
    new Paragraph({
      spacing: { after: 90 },
      border: {
        bottom: { style: BorderStyle.DOTTED, size: 4, color: C.border, space: 3 },
      },
      children: [kit.semi("title", { size: S.body, color: C.text })],
    }),
    control(kit, "/summary"),
  ];
}

// ---------------------------------------------------------------- seções 1–24

/** Parágrafo com a tag crua de um texto semi-fixo (o código injeta os parágrafos). */
const rawText = (kit: Kit, key: PgrDocxTextKey) =>
  new Paragraph({ children: [kit.ctl(`@texts.${key}`)] });
const raw = (kit: Kit, tag: string) => new Paragraph({ children: [kit.ctl(`@${tag}`)] });

/** Parágrafo de texto FIXO (amarelo), com `{{company.razaoSocial}}` onde o texto cita a empresa. */
function fixedParagraph(kit: Kit, text: string, keepNext = false) {
  const parts = text.split("{empresa}");
  const children: ParagraphChild[] = [];
  parts.forEach((part, index) => {
    if (index > 0) children.push(kit.dy("company.razaoSocial"));
    children.push(...kit.fxRich(keepLastWords(part)));
  });
  return new Paragraph({
    style: PGR_DOCX_STYLE_IDS.body,
    keepNext: keepNext || text.trim().endsWith(":"),
    children,
  });
}
const fixedItem = (kit: Kit, text: string, keepNext = false) =>
  new Paragraph({
    style: PGR_DOCX_STYLE_IDS.item,
    keepNext: keepNext || undefined,
    children: kit.fxRich(keepLastWords(text)),
  });

function jobRolesTable(kit: Kit) {
  const widths = [2300, 4400, 2500, 1266];
  const dataRow = (
    open: string[],
    close: string[],
    edges: { top: number; bottom: number; border: boolean },
  ) =>
    tr(
      [
        tc([tp([...open.map((tag) => kit.ctl(tag)), kit.dy("name", { bold: true })])], {
          width: widths[0],
          vAlign: "top",
          bottomBorder: edges.border,
          marginTop: edges.top,
          marginBottom: edges.bottom,
        }),
        tc([raw(kit, "descriptionXml")], {
          width: widths[1],
          vAlign: "top",
          bottomBorder: edges.border,
          marginTop: edges.top,
          marginBottom: edges.bottom,
        }),
        tc([tp([kit.dy("workload")])], {
          width: widths[2],
          vAlign: "top",
          bottomBorder: edges.border,
          marginTop: edges.top,
          marginBottom: edges.bottom,
        }),
        tc(
          [
            tp(
              [
                kit.dy("employeeCount", { bold: true }),
                ...close.map((tag) => kit.ctl(tag)),
              ],
              { align: "center" },
            ),
          ],
          {
            width: widths[3],
            vAlign: "top",
            bottomBorder: edges.border,
            marginTop: edges.top,
            marginBottom: edges.bottom,
          },
        ),
      ],
      { cantSplit: true },
    );
  return [
    grid(
      [
        headerRow([
          { children: [kit.label("jobRoleName", HEAD)], width: widths[0] },
          { children: [kit.label("jobRoleDescription", HEAD)], width: widths[1] },
          { children: [kit.label("jobRoleWorkload", HEAD)], width: widths[2] },
          { children: [kit.label("jobRoleCount", HEAD)], width: widths[3] },
        ]),
        dataRow(["#jobRoles", "#parts", "#whole"], ["/whole"], {
          top: 50,
          bottom: 50,
          border: true,
        }),
        dataRow(["#head"], ["/head"], { top: 50, bottom: 0, border: false }),
        dataRow(["#body"], ["/body"], { top: 0, bottom: 0, border: false }),
        dataRow(["#tail"], ["/tail", "/parts", "/jobRoles"], {
          top: 0,
          bottom: 50,
          border: true,
        }),
        tr([
          tc(
            [
              tp([
                kit.ctl("^jobRoles"),
                kit.fx("Nenhuma função vinculada aos GES deste PGR.", {
                  italics: true,
                  ...MUTED,
                }),
              ]),
            ],
            { width: WIDTH - widths[3], span: 3, openRight: true, bottomBorder: true },
          ),
          tc([tp([kit.ctl("/jobRoles")])], {
            width: widths[3],
            openLeft: true,
            bottomBorder: true,
          }),
        ]),
      ],
      widths,
      BORDERS.rowsOpen,
    ),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 120, after: 120 },
      children: [
        kit.label("jobRolesTotal", { bold: true, color: C.muted }),
        kit.fx("  "),
        kit.dy("jobRolesTotal", { bold: true, size: 22, color: C.primaryStrong }),
      ],
    }),
  ];
}

function classificationTable(kit: Kit) {
  const widths = [2300, WIDTH - 2300];
  const caption = (key: "classificationTable" | "classificationTableErgonomic") =>
    tr([
      tc([tp([kit.label(key, { bold: true })], { align: "center", keepNext: true })], {
        width: WIDTH,
        span: 2,
        fill: C.surfaceAlt,
      }),
    ]);
  const group = (agent: keyof typeof PGR_DOCX_AGENT_COLORS, name: string, text: string) =>
    tr([
      tc([tp([kit.fx(name, { bold: true, color: PGR_DOCX_AGENT_COLORS[agent].text })])], {
        width: widths[0],
        fill: PGR_DOCX_AGENT_COLORS[agent].fill,
      }),
      tc([tp([kit.fx(text)])], { width: widths[1] }),
    ]);
  return grid(
    [
      caption("classificationTable"),
      group(
        "physical",
        "Riscos Físicos",
        "Ruídos, Vibrações, Radiações Ionizantes, Radiações não Ionizantes, Frio, Calor, Pressões Anormais, Umidade.",
      ),
      group(
        "chemical",
        "Riscos Químicos",
        "Poeiras, Fumos, Névoas, Neblinas, Gases, Vapores, Substâncias compostas ou produtos químicos em geral.",
      ),
      group(
        "biological",
        "Riscos Biológicos",
        "Vírus, Bactérias Protozoários, Fungos, Parasitas, Bacilos.",
      ),
      caption("classificationTableErgonomic"),
      group(
        "ergonomic",
        "Riscos Ergonômicos",
        "Esforço físico, Repetitividade, Postura inadequada, Iluminação inadequada, Ritmo excessivo de trabalho, Jornadas de trabalho prolongadas, Monotonia das atividades, Controle rígido de produtividade, Levantamento e manuseio de cargas, entre outros.",
      ),
      group(
        "accident",
        "Riscos de Acidentes",
        "São todos os fatores que colocam em perigo o trabalhador ou afetam sua integridade física ou moral. São considerados como riscos geradores de acidentes: arranjo físico deficiente; máquinas e equipamentos sem proteção; ferramentas inadequadas; ou defeituosas; eletricidade; incêndio ou explosão; animais peçonhentos; armazenamento inadequado, colisão, entre outros.",
      ),
    ],
    widths,
  );
}

/** Tabela de metodologia (semi-fixa): título indigo, legenda, cabeçalho e linhas em loop. */
function methodologyTable(
  kit: Kit,
  options: {
    titleKey: Parameters<Kit["label"]>[0];
    base: string;
    caption: ParagraphChild[];
    columns: { label: Parameters<Kit["label"]>[0]; field: string; width: number }[];
  },
) {
  const widths = options.columns.map((column) => column.width);
  const total = widths.reduce((sum, w) => sum + w, 0);
  const last = options.columns.length - 1;
  return grid(
    [
      tr([
        tc(
          [tp([kit.label(options.titleKey, HEAD)], { align: "center", keepNext: true })],
          {
            width: total,
            span: options.columns.length,
            fill: PGR_DOCX_TABLE_HEAD.fill,
            bottomRule: PGR_DOCX_TABLE_HEAD.rule,
          },
        ),
      ]),
      tr([
        tc([tp(options.caption, { align: "center", keepNext: true })], {
          width: total,
          span: options.columns.length,
          fill: C.primarySofter,
        }),
      ]),
      tr(
        options.columns.map((column) =>
          tc(
            [
              tp([kit.label(column.label, { bold: true })], {
                align: "center",
                keepNext: true,
              }),
            ],
            {
              width: column.width,
              fill: C.surfaceAlt,
            },
          ),
        ),
      ),
      tr(
        options.columns.map((column, index) =>
          tc(
            [
              tp(
                [
                  ...(index === 0 ? [kit.ctl(`#${options.base}.rows`)] : []),
                  kit.semi(column.field, index === 0 ? { bold: true } : {}),
                  ...(index === last ? [kit.ctl(`/${options.base}.rows`)] : []),
                ],
                { align: "center", keepNext: true },
              ),
            ],
            { width: column.width },
          ),
        ),
      ),
    ],
    widths,
  );
}

function controlNeedTable(kit: Kit) {
  const first = 1900;
  const rest = Math.floor((WIDTH - first) / 3);
  const widths = [first, rest, rest, WIDTH - first - rest * 2];
  const order: [(typeof PGR_DOCX_RISK_CLASSES)[number], string][] = [
    ["intolerable", "1º Intolerável"],
    ["substantial", "2º Substancial"],
    ["moderate", "3º Moderado"],
    ["tolerable", "4º Tolerável"],
    ["trivial", "5º Trivial"],
  ];
  return grid(
    [
      tr([
        tc(
          [
            tp([kit.label("controlNeedPriority", { bold: true })], {
              align: "center",
              keepNext: true,
            }),
          ],
          {
            width: first,
            vMerge: "restart",
            fill: C.primarySoft,
          },
        ),
        tc(
          [
            tp([kit.label("controlNeedTable", HEAD)], {
              align: "center",
              keepNext: true,
            }),
          ],
          {
            width: WIDTH - first,
            span: 3,
            fill: PGR_DOCX_TABLE_HEAD.fill,
            bottomRule: PGR_DOCX_TABLE_HEAD.rule,
          },
        ),
      ]),
      tr([
        tc([tp([], { keepNext: true })], { width: first, vMerge: "continue" }),
        tc(
          [
            tp([kit.label("controlNeedUncertainty", { bold: true })], {
              align: "center",
              keepNext: true,
            }),
          ],
          {
            width: WIDTH - first,
            span: 3,
            fill: C.primarySofter,
          },
        ),
      ]),
      tr([
        tc([tp([], { keepNext: true })], { width: first, vMerge: "continue" }),
        ...(
          [
            "controlNeedCertain",
            "controlNeedUncertain",
            "controlNeedHighlyUncertain",
          ] as const
        ).map((key, index) =>
          tc(
            [tp([kit.label(key, { bold: true })], { align: "center", keepNext: true })],
            {
              width: widths[index + 1],
              fill: C.surfaceAlt,
            },
          ),
        ),
      ]),
      ...order.map(([riskClass, name], row) =>
        tr([
          tc(
            [
              tp(
                [
                  kit.fx(name, {
                    bold: true,
                    color: PGR_DOCX_RISK_CLASS_COLORS[riskClass].text,
                  }),
                ],
                {
                  align: "center",
                  keepNext: row < order.length - 1,
                },
              ),
            ],
            { width: first, fill: PGR_DOCX_RISK_CLASS_COLORS[riskClass].strong },
          ),
          ...(["certain", "uncertain", "highlyUncertain"] as const).map((field, index) =>
            tc(
              [
                tp([kit.semi(`methodology.controlNeed.${riskClass}.${field}`)], {
                  align: "center",
                  keepNext: row < order.length - 1,
                }),
              ],
              {
                width: widths[index + 1],
              },
            ),
          ),
        ]),
      ),
    ],
    widths,
  );
}

function annexActionsTable(kit: Kit) {
  const widths = [1800, 1900, 2966, 1550, 1000, 1250];
  return grid(
    [
      headerRow([
        { children: [kit.fx("GES", HEAD)], width: widths[0] },
        { children: [kit.fx("Risco", HEAD)], width: widths[1] },
        { children: [kit.fx("Ação", HEAD)], width: widths[2] },
        { children: [kit.fx("Responsável", HEAD)], width: widths[3] },
        { children: [kit.fx("Prazo", HEAD)], width: widths[4] },
        { children: [kit.fx("Status", HEAD)], width: widths[5] },
      ]),
      tr([
        tc([tp([kit.ctl("#annexActions"), kit.dy("gesTitle", { bold: true })])], {
          width: widths[0],
          vAlign: "top",
        }),
        tc([tp([kit.dy("riskRef", { bold: true })]), tp([kit.dy("occupationalRisk")])], {
          width: widths[1],
          vAlign: "top",
        }),
        tc([tp([kit.dy("action")])], { width: widths[2], vAlign: "top" }),
        tc([tp([kit.dy("responsible")])], { width: widths[3], vAlign: "top" }),
        tc([tp([kit.dy("deadline")])], { width: widths[4], vAlign: "top" }),
        tc([tp([kit.dy("status"), kit.ctl("/annexActions")])], {
          width: widths[5],
          vAlign: "top",
        }),
      ]),
      tr([
        tc(
          [
            tp([
              kit.ctl("^annexActions"),
              kit.fx("Nenhuma ação planejada neste PGR.", { italics: true, ...MUTED }),
            ]),
          ],
          { width: WIDTH - widths[5], span: 5, openRight: true },
        ),
        tc([tp([kit.ctl("/annexActions")])], { width: widths[5], openLeft: true }),
      ]),
    ],
    widths,
  );
}

function sections(kit: Kit) {
  const fp = (text: string) => fixedParagraph(kit, text);
  const fsub = (key: Parameters<Kit["label"]>[0]) => subtitle([kit.label(key)]);
  return [
    heading([kit.title("introduction")], { pageBreakBefore: true }),
    rawText(kit, "introduction"),
    heading([kit.title("objective")]),
    rawText(kit, "objective"),
    heading([kit.title("responsibilities")]),
    rawText(kit, "responsibilities"),

    heading([kit.title("jobRoles")]),
    ...jobRolesTable(kit),
    heading([kit.title("trainingMatrix")]),
    raw(kit, "trainingMatrixXml"),

    heading([kit.title("epi")]),
    rawText(kit, "epi"),
    heading([kit.title("strategy")]),
    rawText(kit, "strategy"),
    heading([kit.title("records")]),
    rawText(kit, "records"),
    heading([kit.title("periodicity")]),
    rawText(kit, "periodicity"),
    heading([kit.title("identification")]),
    rawText(kit, "identification"),
    heading([kit.title("actionLevel")]),
    rawText(kit, "actionLevel"),
    heading([kit.title("cipa")]),
    rawText(kit, "cipa"),
    heading([kit.title("fieldRecord")]),
    rawText(kit, "fieldRecord"),
    heading([kit.title("psychosocial")]),
    rawText(kit, "psychosocial"),
    heading([kit.title("classification")]),
    rawText(kit, "classification"),
    classificationTable(kit),
    heading([kit.title("communication")]),
    rawText(kit, "communication"),

    heading([kit.title("riskCategory")]),
    rawText(kit, "riskCategoryProbability"),
    methodologyTable(kit, {
      titleKey: "probabilityQuantTable",
      base: "methodology.probabilityQuantitative",
      caption: [
        kit.semi("methodology.probabilityQuantitative.caption"),
        new TextRun({ text: "", break: 1 }),
        kit.semi("methodology.probabilityQuantitative.source", { bold: true }),
      ],
      columns: [
        { label: "methodologyLevel", field: "level", width: 1000 },
        { label: "methodologyCategory", field: "category", width: 4733 },
        { label: "methodologyExposure", field: "exposure", width: WIDTH - 5733 },
      ],
    }),
    spacer(),
    methodologyTable(kit, {
      titleKey: "probabilityQualTable",
      base: "methodology.probabilityQualitative",
      caption: [kit.semi("methodology.probabilityQualitative.caption")],
      columns: [
        { label: "methodologyLevel", field: "level", width: 1000 },
        { label: "methodologyControl", field: "control", width: 3300 },
        { label: "methodologyPrevention", field: "prevention", width: WIDTH - 4300 },
      ],
    }),
    spacer(),
    rawText(kit, "riskCategorySeverity"),
    methodologyTable(kit, {
      titleKey: "severityTable",
      base: "methodology.severity",
      caption: [
        kit.semi("methodology.severity.caption"),
        kit.fx(" | "),
        kit.semi("methodology.severity.source", { bold: true }),
      ],
      columns: [
        { label: "methodologyLevel", field: "level", width: 1000 },
        { label: "methodologyDefinition", field: "definition", width: WIDTH - 1000 },
      ],
    }),
    spacer(),
    rawText(kit, "riskCategoryMatrix"),
    raw(kit, "riskMatrixXml"),
    spacer(),
    rawText(kit, "riskCategoryExample"),
    controlNeedTable(kit),

    heading([kit.title("methodology")]),
    fp(
      "Será feito de acordo com as atividades desenvolvidas na empresa e a exposição dos colaboradores ao risco e acompanhamento periódico das atividades usando ferramentas de Segurança e Saúde Ocupacional em máquinas e equipamentos e atualização constante do registro das coletas de inspeção além dos Programas de Saúde Ocupacional.",
    ),
    subtitle(kit.fxRich("Detalhamento da metodologia de avaliação:")),
    fp(
      "A metodologia aplicada estará baseada no estudo dos locais de trabalho, análise dos setores e funções expostas, avaliação dos possíveis riscos aos que os empregados poderão estar expostos, segundo os conceitos técnicos adotados pela Portaria MTP nº 816, de 13 de abril de 2022, em sua Norma Regulamentadora NR\u00A0–\u00A00 e seus anexos, e NHO´S (Normas de Higiene Ocupacional) da Fundacentro e de acordo com os procedimentos da Contratante.",
    ),
    subtitle(kit.fxRich("Monitoração de Agentes Ambientais")),
    fp(
      "A monitoração da exposição aos agentes agressivos deverá observar a metodologia recomendada pelo Nacional Institute for Ocupacional Safety and Health (NIOSH – USA), FUNDACENTRO, Portaria SEPRT 1.359/19 e NBR’s pertinentes ou outras Normas Internacionalmente aceitas como adequadas.",
    ),
    fp(
      "As amostragens deverão ser planejadas e executadas assumindo-se que os trabalhadores de cada setor militam em um ambiente que é comum a todos os membros do grupo homogêneo de exposição, portanto pertencem a uma mesma zona de exposição. Cada incursão deverá ser rastreável através da Memória de Amostragem estabelecida para cada tipo de agente.",
    ),
    fp(
      "Todos os instrumentos de amostragem deverão ser calibrados e aferidos conforme especificação do fabricante, sendo os devidos certificados de conformidade anexados aos relatórios técnicos.",
    ),
    fp(
      "Para garantir a representatividade estatística, a quantidade de incursões realizadas por função deverá observar os procedimentos estabelecidos pelo National Institute of Occupational Safety and Health (NIOSH – USA).",
    ),

    heading([kit.title("emergency")]),
    subtitle(kit.fxRich("Plano de Atendimento a Emergência.")),
    fp(
      "A organização deve estabelecer, implementar e manter procedimentos de respostas aos cenários de emergências, de acordo com os riscos, as características e as circunstâncias das atividades.",
    ),
    fp("Os procedimentos de respostas aos cenários de emergências devem prever:"),
    fixedItem(
      kit,
      "a) os meios e recursos necessários para os primeiros socorros, encaminhamento de acidentados e abandono;",
      true,
    ),
    fixedItem(
      kit,
      "b) as medidas necessárias para os cenários de emergências de grande magnitude, quando aplicável;",
    ),
    fp(
      "A organização deverá implementar Plano de Emergências, e disponibilizar para conhecimento de todos os funcionários, podendo ser anexado a este PGR.",
    ),

    heading([kit.title("gesStructure")]),
    fp(
      "Através dos levantamentos de dados obtidos no local de trabalho, definiu-se que os GES serão identificados de forma sequencial conforme a natureza da atividade, da seguinte forma: GHE 01; GHE 02; e assim por diante.",
    ),

    heading([kit.title("sanitary")]),
    fp(
      "Em atendimento à Norma Regulamentadora nº 24 – Condições Sanitárias e de Conforto nos Locais de Trabalho, a empresa assegura aos trabalhadores condições adequadas de higiene, conforto e bem-estar durante a execução das atividades de terraplenagem, observando as características operacionais da obra e a mobilidade das frentes de serviço.",
    ),
    fsub("sanitaryFacilities"),
    fp(
      "A obra dispõe de instalações sanitárias em quantidade compatível com o efetivo de trabalhadores, mantendo condições adequadas de higiene, conservação e funcionamento. Os sanitários são dotados de bacia sanitária, lavatório, disponibilidade de água, sabonete ou produto equivalente para higienização das mãos e papel higiênico, sendo realizada limpeza periódica para garantir condições satisfatórias de utilização.",
    ),
    fp(
      "Em razão da natureza dinâmica da atividade de terraplenagem, as instalações sanitárias poderão ser reposicionadas sempre que necessário, acompanhando o deslocamento das frentes de trabalho, de modo a manter acesso adequado aos trabalhadores e atender às exigências da NR 24.",
    ),
    fsub("foodArea"),
    fp(
      "{empresa} não mantém refeitório no canteiro de obras, uma vez que as refeições são realizadas durante o intervalo intrajornada em restaurante localizado fora da área operacional da obra, proporcionando aos trabalhadores ambiente apropriado para alimentação, com condições adequadas de higiene e conforto, em conformidade com a NR 24.",
    ),
    fsub("drinkingWater"),
    fp(
      "Durante toda a jornada de trabalho é disponibilizada água potável em quantidade suficiente para todos os trabalhadores, por meio de recipientes ou equipamentos apropriados, mantidos em condições de higiene, garantindo a hidratação adequada durante a execução das atividades.",
    ),
    fsub("supportFacilities"),
    fp(
      "A administração da obra realizará inspeções periódicas nas instalações de apoio, verificando suas condições de limpeza, conservação, abastecimento de materiais de higiene e funcionamento, adotando as medidas corretivas necessárias sempre que identificadas não conformidades, mantendo o atendimento contínuo às exigências da NR 24.",
    ),

    heading([kit.title("healthSchedule")]),
    fp(
      "O Cronograma Anual de Ações de Prevenção e Promoção da Saúde do Trabalhador foi elaborado em conformidade com a Lei nº 15.377, de 2 de abril de 2026, contemplando ações educativas, preventivas e de conscientização voltadas à saúde e à segurança dos trabalhadores, em atendimento às diretrizes da NR-01, especialmente no que se refere ao gerenciamento de riscos ocupacionais e à promoção de ambientes de trabalho seguros e saudáveis.",
    ),
    fp(
      "O planejamento estabelece campanhas temáticas distribuídas ao longo do ano, abordando temas como saúde mental, prevenção de doenças ocupacionais, segurança no trabalho, prevenção de acidentes e promoção da saúde da mulher e do homem, com o objetivo de fortalecer a cultura de prevenção e o bem-estar no ambiente organizacional.",
    ),
    fp(
      "As ações previstas neste cronograma poderão ser desenvolvidas de forma integrada ao PCMSO, conforme dispõe a NR-07, permitindo a articulação entre as medidas de saúde ocupacional, o monitoramento clínico dos trabalhadores e os programas preventivos adotados pela empresa.",
    ),
    fp(
      "Este cronograma poderá ser revisado e atualizado periodicamente, de acordo com as necessidades da organização, eventuais alterações na legislação aplicável e os riscos identificados no ambiente de trabalho.",
    ),
    raw(kit, "campaignsXml"),

    heading([kit.title("annexSchedule")]),
    subtitle(kit.fxRich("Anexo I – Cronograma de Implementação do PGR")),
    fp(
      "O presente Programa de Gerenciamento de Riscos (PGR) apresenta, em anexo, o Cronograma de Implementação e Acompanhamento das Ações, elaborado para orientar a execução das medidas preventivas previstas durante a vigência do programa.",
    ),
    fp(
      "O cronograma estabelece as prioridades, os responsáveis, os prazos de execução, os indicadores de acompanhamento e o status das ações, permitindo o monitoramento sistemático da implementação das medidas de prevenção e a verificação de sua efetividade.",
    ),
    fp(
      "Este anexo constitui parte integrante do PGR e deverá ser atualizado sempre que houver necessidade de revisão do programa, em decorrência de mudanças nos processos, alterações legais, ocorrência de acidentes, identificação de novos riscos ou demais situações previstas na NR 01.",
    ),
    annexActionsTable(kit),

    heading([kit.title("finalProvisions")]),
    fixedParagraph(
      kit,
      "Sempre que vários empregados realizarem simultaneamente atividades no mesmo local, estes deverão executar ações integradas para aplicação de medidas prevencionistas contidas no PGR visando à proteção de todos os trabalhadores expostos aos riscos ambientais.",
      true,
    ),
    fp(
      "Será garantido que a ocorrência de riscos ambientais nos locais de trabalho que coloquem em situação de risco grave iminente um ou mais colaboradores, que eles possam interromper de imediato suas atividades, preenchendo formulário – Direito\u00A0de\u00A0Recusa, comunicando o fato à chefia imediata para as devidas providências.",
    ),
  ];
}

// ---------------------------------------------------------------- inventário

const INVENTORY_BLOCKS = [
  "1 - CARACTERIZAÇÃO DO PROCESSO",
  "2 - CARACTERÍSTICAS CONSTRUTIVAS DO LOCAL DE ATIVIDADES",
  "3 - CARACTERIZAÇÃO DAS ATIVIDADES",
  "4 - IDENTIFICAÇÃO DE PERIGOS E AVALIAÇÃO DE RISCOS – QUALITATIVA/QUANTITATIVA (NR 1/NR 9)",
  "5 - MEDIDAS DE PREVENÇÃO POR ORDEM DE PRIORIDADE",
  "6 - EQUIPAMENTO DE PROTEÇÃO INDIVIDUAL DISPONÍVEIS",
  "7 - PLANO DE AÇÃO",
  "8 - DASHBOARD DE GESTÃO DE RISCOS",
];

const HALF = Math.round(WIDTH / 2);

/** Par rótulo/valor de uma célula do cartão de risco. */
function field(kit: Kit, label: string, value: ParagraphChild[]) {
  return [
    tp([kit.fx(label, SMALL_LABEL)], { after: 10, keepNext: true }),
    tp(value, { keepNext: true }),
  ];
}

function riskCard(kit: Kit) {
  const headerRows = PGR_DOCX_AGENT_KEYS.map((agent) => {
    const colors = PGR_DOCX_AGENT_COLORS[agent];
    return tr([
      tc(
        [
          tp(
            [
              kit.ctl(`#agent.${agent}`),
              kit.fx("RISCO ", { bold: true, size: 26, color: C.text }),
              kit.dy("number", { bold: true, size: 26, color: C.primaryStrong }),
            ],
            { keepNext: true },
          ),
        ],
        { width: HALF, fill: C.surfaceAlt, margins: 120, accentLeft: colors.fill },
      ),
      tc(
        [
          tp([kit.fx("AGENTE/TIPO", { ...SMALL_LABEL, size: S.tableSmall })], {
            align: "right",
            after: 20,
            keepNext: true,
          }),
          tp(
            [
              new TextRun({
                text: " {{agentType}} ",
                bold: true,
                size: 19,
                color: colors.text,
                shading: { type: ShadingType.CLEAR, color: "auto", fill: colors.fill },
              }),
              kit.ctl(`/agent.${agent}`),
            ],
            { align: "right", keepNext: true },
          ),
        ],
        { width: WIDTH - HALF, fill: C.surfaceAlt, margins: 120 },
      ),
    ]);
  });

  // Nível de risco com o selo na cor da classe (uma variante por classe + sem classe).
  const levelRuns: ParagraphChild[] = [
    ...PGR_DOCX_RISK_CLASSES.flatMap((riskClass) => {
      const colors = PGR_DOCX_RISK_CLASS_COLORS[riskClass];
      return [
        kit.ctl(`#level.${riskClass}`),
        new TextRun({
          text: " {{riskLevel}} ",
          bold: true,
          color: colors.text,
          shading: { type: ShadingType.CLEAR, color: "auto", fill: colors.strong },
        }),
        kit.ctl(`/level.${riskClass}`),
      ];
    }),
    kit.ctl("^riskClass"),
    kit.dy("riskLevel", { bold: true }),
    kit.ctl("/riskClass"),
  ];

  const pair = (left: [string, ParagraphChild[]], right: [string, ParagraphChild[]]) =>
    tr([
      tc(field(kit, left[0], left[1]), { width: HALF, vAlign: "top" }),
      tc(field(kit, right[0], right[1]), { width: WIDTH - HALF, vAlign: "top" }),
    ]);

  return [
    control(kit, "#risks"),
    grid(
      [
        ...headerRows,
        pair(["NÍVEL DE RISCO (X x Y):", levelRuns], ["PERIGO:", [kit.dy("hazard")]]),
        pair(["RISCO:", [kit.dy("risk")]], ["FONTES GERADORAS:", [kit.dy("sources")]]),
        pair(
          ["TRAJETÓRIA / MEIOS DE PROPAGAÇÃO:", [kit.dy("propagation")]],
          ["TEMPO DE EXPOSIÇÃO:", [kit.dy("exposureTime")]],
        ),
        pair(
          ["POSSÍVEIS LESÕES OU AGRAVOS À SAÚDE:", [kit.dy("injuries")]],
          ["CRITÉRIO:", [kit.dy("criterion")]],
        ),
        tr([
          tc(
            field(kit, "CÓDIGO AGENTE NOCIVO (eSOCIAL - TAB 24):", [
              kit.dy("esocialCode"),
            ]),
            {
              width: HALF,
              vAlign: "top",
            },
          ),
          tc(
            [
              tp([kit.dy("unitLabel", SMALL_LABEL)], { after: 10, keepNext: true }),
              tp([kit.dy("unitValue")], { keepNext: true }),
            ],
            { width: WIDTH - HALF, vAlign: "top" },
          ),
        ]),
        tr([
          tc(
            [
              tp([kit.fx("MATRIZ DE RISCO", SMALL_LABEL)], { after: 10, keepNext: true }),
              tp([kit.fx("Grau de Incerteza: ", MUTED), kit.dy("uncertainty")], {
                keepNext: true,
              }),
              tp(
                [kit.fx("Gradação da Probabilidade (X): ", MUTED), kit.dy("probability")],
                {
                  keepNext: true,
                },
              ),
            ],
            { width: HALF, fill: C.surfaceAlt, vAlign: "top" },
          ),
          tc(
            [
              tp(
                [
                  kit.fx("Severidade dos Efeitos à Saúde (Y): ", MUTED),
                  kit.dy("severity"),
                ],
                {
                  keepNext: true,
                },
              ),
              tp(
                [
                  kit.fx("Necessidade de controle e informações adicionais: ", MUTED),
                  kit.dy("controlNeed"),
                ],
                { keepNext: true },
              ),
            ],
            { width: WIDTH - HALF, fill: C.surfaceAlt, vAlign: "center" },
          ),
        ]),
        tr([
          tc(
            [
              tp([kit.fx("CONCENTRAÇÃO / INTENSIDADE", SMALL_LABEL)], {
                after: 10,
                keepNext: true,
              }),
              tp([kit.fx("Resultado Encontrado: ", MUTED), kit.dy("result")], {
                keepNext: true,
              }),
            ],
            { width: HALF, vAlign: "top" },
          ),
          tc(
            [
              tp([kit.fx("Limite de Tolerância: ", MUTED), kit.dy("toleranceLimit")], {
                keepNext: true,
              }),
            ],
            {
              width: WIDTH - HALF,
              vAlign: "bottom",
            },
          ),
        ]),
      ],
      [HALF, WIDTH - HALF],
      BORDERS.card,
    ),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 160 },
      children: [
        kit.fx("———  Fim do Risco ", { size: S.tableSmall, color: C.subtle }),
        kit.dy("number", { size: S.tableSmall, color: C.subtle }),
        kit.fx("  ———", { size: S.tableSmall, color: C.subtle }),
      ],
    }),
    control(kit, "/risks"),
  ];
}

const HIERARCHY = [
  ["elimination", "I. É possível eliminação dos fatores de\u00A0risco?"],
  [
    "substitution",
    "II. É possível substituição por processo, material ou equipamento de menor\u00A0risco?",
  ],
  [
    "collective",
    "III. Minimização e controle dos fatores de risco, com a adoção de controles de engenharia e medidas de proteção\u00A0coletiva?",
  ],
  [
    "administrative",
    "IV. Minimização e controle dos fatores de risco, com a adoção de medidas administrativas ou de organização do\u00A0trabalho?",
  ],
  ["individual", "V. Adoção de medidas de proteção\u00A0individual?"],
] as const;

function measuresTable(kit: Kit) {
  const widths = [1500, 3100, 750, 2700, WIDTH - 8050];
  return grid(
    [
      headerRow([
        { children: [kit.fx("Risco", HEAD)], width: widths[0] },
        {
          children: [kit.fx("Controle de risco e suas hierarquias", HEAD)],
          width: widths[1],
        },
        { children: [kit.fx("Sim/Não", HEAD)], width: widths[2] },
        {
          children: [kit.fx("Medidas de controle existentes/Justificativa", HEAD)],
          width: widths[3],
        },
        { children: [kit.fx("Monitoramento", HEAD)], width: widths[4] },
      ]),
      ...HIERARCHY.map(([level, question], index) =>
        tr([
          tc(
            index === 0
              ? [
                  tp([kit.ctl("#measures"), kit.dy("riskLabel", { bold: true })], {
                    keepNext: true,
                  }),
                  tp([kit.dy("riskName")], { keepNext: true }),
                ]
              : [tp([], { keepNext: index < HIERARCHY.length - 1 })],
            {
              width: widths[0],
              vMerge: index === 0 ? "restart" : "continue",
              fill: C.primarySofter,
              vAlign: "top",
            },
          ),
          tc([tp([kit.fx(question)], { keepNext: index < HIERARCHY.length - 1 })], {
            width: widths[1],
            fill: index % 2 === 0 ? C.surfaceAlt : undefined,
          }),
          tc(
            [
              tp([kit.dy(`${level}.applies`, { bold: true })], {
                align: "center",
                keepNext: index < HIERARCHY.length - 1,
              }),
            ],
            {
              width: widths[2],
              fill: index % 2 === 0 ? C.surfaceAlt : undefined,
            },
          ),
          tc(
            [
              tp([kit.dy(`${level}.measures`)], {
                keepNext: index < HIERARCHY.length - 1,
              }),
            ],
            {
              width: widths[3],
              fill: index % 2 === 0 ? C.surfaceAlt : undefined,
            },
          ),
          tc(
            [
              tp(
                [
                  kit.dy(`${level}.monitoring`),
                  ...(index === HIERARCHY.length - 1 ? [kit.ctl("/measures")] : []),
                ],
                { keepNext: index < HIERARCHY.length - 1 },
              ),
            ],
            { width: widths[4], fill: index % 2 === 0 ? C.surfaceAlt : undefined },
          ),
        ]),
      ),
      tr([
        tc(
          [
            tp([
              kit.ctl("^measures"),
              kit.fx("Nenhuma medida de prevenção cadastrada neste GES.", {
                italics: true,
                ...MUTED,
              }),
            ]),
          ],
          { width: WIDTH - widths[4], span: 4, openRight: true },
        ),
        tc([tp([kit.ctl("/measures")])], { width: widths[4], openLeft: true }),
      ]),
    ],
    widths,
  );
}

function episTable(kit: Kit) {
  const widths = [1300, 3400, 3100, 1100, WIDTH - 8900];
  return grid(
    [
      headerRow([
        { children: [kit.fx("Risco (Ref.)", HEAD)], width: widths[0] },
        { children: [kit.fx("Perigo", HEAD)], width: widths[1] },
        { children: [kit.fx("EPI", HEAD)], width: widths[2] },
        { children: [kit.fx("CA", HEAD)], width: widths[3] },
        { children: [kit.fx("Neutraliza os Riscos?", HEAD)], width: widths[4] },
      ]),
      tr([
        tc([tp([kit.ctl("#epis"), kit.dy("riskRef", { bold: true })])], {
          width: widths[0],
        }),
        tc([tp([kit.dy("hazard")])], { width: widths[1] }),
        tc([tp([kit.dy("epi")])], { width: widths[2] }),
        tc([tp([kit.dy("ca")])], { width: widths[3] }),
        tc([tp([kit.dy("neutralizes"), kit.ctl("/epis")])], { width: widths[4] }),
      ]),
      tr([
        tc(
          [
            tp([
              kit.ctl("^epis"),
              kit.fx("Nenhum EPI indicado para os riscos deste GES.", {
                italics: true,
                ...MUTED,
              }),
            ]),
          ],
          { width: WIDTH - widths[4], span: 4, openRight: true },
        ),
        tc([tp([kit.ctl("/epis")])], { width: widths[4], openLeft: true }),
      ]),
    ],
    widths,
  );
}

function actionsTable(kit: Kit) {
  const first = 1100;
  const rest = Math.floor((WIDTH - first) / 4);
  const widths = [first, rest, rest, rest, WIDTH - first - rest * 3];
  const labelCell = (text: string, index: number) =>
    tc([tp([kit.fx(text, { bold: true, color: C.muted })], { keepNext: true })], {
      width: widths[index],
      fill: C.surfaceAlt,
    });
  const valueCell = (children: ParagraphChild[], index: number, keepNext = true) =>
    tc([tp(children, { keepNext })], { width: widths[index], vAlign: "center" });
  const riskCell = (
    children: ParagraphChild[],
    keepNext: boolean,
    edges: { openTop?: boolean; openBottom?: boolean },
    vAlign: "top" | "center" | "bottom" = "center",
  ) =>
    tc([tp(children, { align: "center", keepNext })], {
      width: first,
      fill: C.primarySofter,
      vAlign,
      ...edges,
    });
  return grid(
    [
      tr([
        riskCell([kit.ctl("#actions")], true, { openBottom: true }),
        labelCell("Risco Ocupacional", 1),
        labelCell("Nível de risco", 2),
        labelCell("Ação", 3),
        labelCell("Formas de acompanhamento", 4),
      ]),
      tr([
        riskCell(
          [kit.dy("riskRef", { bold: true })],
          true,
          { openTop: true, openBottom: true },
          "bottom",
        ),
        valueCell([kit.dy("occupationalRisk")], 1),
        valueCell([kit.dy("riskLevel")], 2),
        valueCell([kit.dy("action")], 3),
        valueCell([kit.dy("tracking")], 4),
      ]),
      tr([
        riskCell([], true, { openTop: true, openBottom: true }),
        labelCell("Aferição de resultados", 1),
        labelCell("Responsável", 2),
        labelCell("Prazo para execução", 3),
        labelCell("Status", 4),
      ]),
      tr([
        riskCell([], false, { openTop: true }),
        valueCell([kit.dy("measurement")], 1, false),
        valueCell([kit.dy("responsible")], 2, false),
        valueCell([kit.dy("deadline")], 3, false),
        valueCell([kit.dy("status"), kit.ctl("/actions")], 4, false),
      ]),
      tr([
        tc(
          [
            tp([
              kit.ctl("^actions"),
              kit.fx("Nenhuma ação planejada para os riscos deste GES.", {
                italics: true,
                ...MUTED,
              }),
            ]),
          ],
          { width: WIDTH - widths[4], span: 4, openRight: true },
        ),
        tc([tp([kit.ctl("/actions")])], { width: widths[4], openLeft: true }),
      ]),
    ],
    widths,
  );
}

function dashboard(kit: Kit) {
  const labelRun = { bold: true, size: S.tableSmall };
  const cards: { label: ParagraphChild; tag: string; fill: string; text: string }[] = [
    {
      label: kit.fx("Riscos Totais", { ...labelRun, color: C.primaryStrong }),
      tag: "dashboard.total",
      fill: C.primarySoft,
      text: C.primaryStrong,
    },
    ...PGR_DOCX_RISK_CLASSES.map((riskClass) => {
      const colors = PGR_DOCX_RISK_CLASS_COLORS[riskClass];
      return {
        label: kit.semi(`riskLevelLabels.${riskClass}`, {
          ...labelRun,
          color: colors.text,
        }),
        tag: `dashboard.${riskClass}`,
        fill: colors.soft,
        text: colors.text,
      };
    }),
  ];
  const width = Math.floor(WIDTH / cards.length);
  const widths = cards.map((_, index) =>
    index === cards.length - 1 ? WIDTH - width * (cards.length - 1) : width,
  );
  return grid(
    [
      tr(
        cards.map((card, index) =>
          tc(
            [
              tp([card.label]),
              tp([kit.dy(card.tag, { bold: true, size: 36, color: card.text })], {
                align: "right",
              }),
            ],
            { width: widths[index], fill: card.fill, margins: 110 },
          ),
        ),
      ),
    ],
    widths,
    {
      ...BORDERS.none,
      insideVertical: { style: BorderStyle.SINGLE, size: 24, color: C.white },
    },
  );
}

function inventory(kit: Kit) {
  const constructionWidths = [3489, 3489, WIDTH - 6978];
  const cField = (label: string, tag: string, keepNext = true) =>
    tp([kit.fx(label, { bold: true }), kit.fx(" "), kit.dy(tag)], {
      keepNext: keepNext || undefined,
    });
  return [
    heading([kit.label("inventoryHeaderTitle")]),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      shading: { type: ShadingType.CLEAR, color: "auto", fill: C.primarySofter },
      spacing: { before: 60, after: 120 },
      children: [
        kit.fx("Cada setor (GES) será detalhado seguindo a seguinte estrutura abaixo:", {
          bold: true,
        }),
      ],
    }),
    ...INVENTORY_BLOCKS.map(
      (text) =>
        new Paragraph({
          style: PGR_DOCX_STYLE_IDS.item,
          children: [kit.fx(text, { bold: true, color: C.text })],
        }),
    ),
    control(kit, "^ges"),
    body([kit.fx("Nenhum GES cadastrado neste PGR.", { italics: true, ...MUTED })]),
    new Paragraph({
      spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT },
      run: { size: 2 },
      children: [],
    }),
    control(kit, "/ges"),
    control(kit, "#ges"),
    heading([kit.dy("title", { color: C.white })], { fill: C.primary }),
    subheading([kit.fx(INVENTORY_BLOCKS[0])]),
    body([kit.fx("Descrição: ", { bold: true }), kit.dy("processDescription")], {
      keepNext: true,
    }),
    subheading([kit.fx(INVENTORY_BLOCKS[1])]),
    grid(
      [
        tr([
          tc([cField("Tipo de construção:", "construction.buildingType")], {
            width: constructionWidths[0],
          }),
          tc([cField("Pé-direito:", "construction.ceilingHeight")], {
            width: constructionWidths[1],
          }),
          tc([cField("Piso:", "construction.floor")], { width: constructionWidths[2] }),
        ]),
        tr([
          tc([cField("Cobertura:", "construction.roof")], {
            width: constructionWidths[0],
          }),
          tc([cField("Iluminação:", "construction.lighting")], {
            width: constructionWidths[1],
          }),
          tc([cField("Ventilação:", "construction.ventilation")], {
            width: constructionWidths[2],
          }),
        ]),
        tr([
          tc([cField("Outras características:", "construction.other", false)], {
            width: WIDTH,
            span: 3,
          }),
        ]),
      ],
      constructionWidths,
      BORDERS.none,
    ),
    subheading([kit.fx(INVENTORY_BLOCKS[2])]),
    grid(
      [
        // Abre o loop numa célula e fecha na outra: o docxtemplater repete a LINHA.
        tr([
          tc([tp([kit.ctl("#jobRoles"), kit.fx("Cargo/Função:", { bold: true })])], {
            width: 1700,
            fill: C.surfaceAlt,
          }),
          tc([tp([kit.dy("name"), kit.ctl("/jobRoles")])], { width: WIDTH - 1700 }),
        ]),
        tr([
          tc([tp([kit.ctl("^jobRoles"), kit.fx("Cargo/Função:", { bold: true })])], {
            width: 1700,
            fill: C.surfaceAlt,
          }),
          tc(
            [
              tp([
                kit.fx("Nenhuma função vinculada a este GES.", {
                  italics: true,
                  ...MUTED,
                }),
                kit.ctl("/jobRoles"),
              ]),
            ],
            { width: WIDTH - 1700 },
          ),
        ]),
      ],
      [1700, WIDTH - 1700],
      BORDERS.rows,
    ),
    subheading([kit.fx(INVENTORY_BLOCKS[3])]),
    ...riskCard(kit),
    control(kit, "^risks"),
    body([kit.fx("Nenhum risco identificado neste GES.", { italics: true, ...MUTED })]),
    control(kit, "/risks"),
    subheading([kit.fx(INVENTORY_BLOCKS[4])]),
    measuresTable(kit),
    subheading([kit.fx(INVENTORY_BLOCKS[5])]),
    episTable(kit),
    subheading([kit.fx(INVENTORY_BLOCKS[6])]),
    actionsTable(kit),
    subheading([kit.fx(INVENTORY_BLOCKS[7])]),
    dashboard(kit),
    // O DOCX exige um parágrafo depois da tabela final. Com altura normal ele transbordava
    // para uma página em branco quando o dashboard fechava a página: aqui ele tem 1pt. O
    // respiro entre GES vem do espaço antes do título do próximo.
    new Paragraph({
      spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT },
      run: { size: 2 },
      children: [],
    }),
    control(kit, "/ges"),
  ];
}

// ---------------------------------------------------------------- documento

function machineInventory(kit: Kit) {
  const field = (label: string, key: string) =>
    body([kit.fx(`${label}: `, { bold: true }), kit.dy(key)]);
  return [
    control(kit, "#hasMachines"),
    heading([kit.fx("MÁQUINAS E EQUIPAMENTOS NO CONTEXTO DO PGR")]),
    body([
      kit.fx(
        "Informações cadastradas para a obra e os ambientes deste PGR. A relação não certifica conformidade técnica dos equipamentos.",
      ),
    ]),
    control(kit, "#machines"),
    field("Máquina ou equipamento", "name"),
    field("Identificação", "identifier"),
    field("Quantidade", "quantity"),
    field("Fabricante", "manufacturer"),
    field("Ambiente", "context"),
    field("Descrição e finalidade", "description"),
    field("Condições de operação e exposição", "operatingConditions"),
    field("Medidas de segurança informadas", "safetyMeasures"),
    field("Manutenção e acompanhamento", "maintenanceNotes"),
    field("Responsável informado", "responsible"),
    spacer(),
    control(kit, "/machines"),
    control(kit, "/hasMachines"),
  ];
}
export function buildTemplateDocument(mode: TemplateMode): Document {
  const kit = createKit(mode);
  const page = { size: A4, margin: MARGINS };
  const headerTitle = (key: "headerTitle" | "inventoryHeaderTitle") => [
    kit.label("documentTitle", { bold: true, size: 26, color: C.primary }),
    new TextRun({ text: "", break: 1 }),
    kit.label(key, { bold: true, size: 22, color: C.text }),
  ];
  return new Document({
    creator: "PGR-e",
    title: "Programa de Gerenciamento de Riscos",
    description: "Template do PGR-e (docxtemplater)",
    styles: {
      default: {
        document: {
          run: { font: PGR_DOCX_FONT, size: S.body, color: C.text },
          paragraph: { ...WIDOW_CONTROL, spacing: { after: 0, line: 259 } },
        },
      },
      paragraphStyles: [
        {
          id: PGR_DOCX_STYLE_IDS.body,
          name: "PGR Corpo",
          basedOn: "Normal",
          quickFormat: true,
          run: { font: PGR_DOCX_FONT, size: S.body, color: C.text },
          paragraph: {
            ...WIDOW_CONTROL,
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 100, line: 276 },
          },
        },
        {
          id: PGR_DOCX_STYLE_IDS.item,
          name: "PGR Item",
          basedOn: PGR_DOCX_STYLE_IDS.body,
          quickFormat: true,
          paragraph: {
            ...WIDOW_CONTROL,
            indent: { left: 284 },
            spacing: { after: 60, line: 276 },
          },
        },
        {
          id: PGR_DOCX_STYLE_IDS.subtitle,
          name: "PGR Subtítulo",
          basedOn: PGR_DOCX_STYLE_IDS.body,
          next: PGR_DOCX_STYLE_IDS.body,
          quickFormat: true,
          run: { bold: true, color: C.primaryStrong, size: 19 },
          paragraph: {
            alignment: AlignmentType.LEFT,
            spacing: { before: 160, after: 80 },
            keepNext: true,
            keepLines: true,
          },
        },
        {
          id: PGR_DOCX_STYLE_IDS.tableText,
          name: "PGR Tabela",
          basedOn: "Normal",
          quickFormat: true,
          run: { font: PGR_DOCX_FONT, size: S.table, color: C.text },
          paragraph: { spacing: { after: 0, line: 240 } },
        },
        {
          id: "PgrHeading1",
          name: "PGR Seção",
          basedOn: "Normal",
          next: PGR_DOCX_STYLE_IDS.body,
          quickFormat: true,
          run: { font: PGR_DOCX_FONT, size: S.h1, bold: true, color: C.primaryStrong },
          paragraph: {
            spacing: { before: 240, after: 120 },
            keepNext: true,
            keepLines: true,
            outlineLevel: 0,
            indent: { left: 80, right: 80 },
          },
        },
        {
          id: "PgrHeading2",
          name: "PGR Bloco",
          basedOn: "Normal",
          next: PGR_DOCX_STYLE_IDS.body,
          quickFormat: true,
          run: { font: PGR_DOCX_FONT, size: 16, bold: true, color: C.text },
          paragraph: {
            spacing: { before: 160, after: 80 },
            keepNext: true,
            keepLines: true,
            outlineLevel: 1,
            indent: { left: 60, right: 60 },
          },
        },
      ],
    },
    sections: [
      { properties: { page }, children: cover(kit) },
      {
        properties: { page },
        headers: { default: pageHeader(kit, headerTitle("headerTitle")) },
        footers: { default: pageFooter(kit) },
        children: [
          control(kit, "#emissionNotice"),
          body([kit.dy("emissionNotice", { bold: true })]),
          control(kit, "/emissionNotice"),
          ...identification(kit),
          ...summary(kit),
          ...sections(kit),
        ],
      },
      {
        properties: { page },
        headers: { default: pageHeader(kit, headerTitle("inventoryHeaderTitle")) },
        footers: { default: pageFooter(kit) },
        children: [...inventory(kit), ...machineInventory(kit)] as (Paragraph | Table)[],
      },
    ],
  });
}
