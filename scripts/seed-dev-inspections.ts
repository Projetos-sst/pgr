/**
 * Seed de demonstração das telas de inspeção (veicular e de segurança) no tenant
 * de desenvolvimento. Idempotente: remove o que semeou antes (marcado pelo
 * prefixo de placa / área) e insere de novo. Nunca roda contra produção — usa a
 * conexão owner de `.env.local`, igual ao `seed-dev-org.ts`.
 *
 * Uso: npx tsx scripts/seed-dev-inspections.ts
 */
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

const ORG_ID = "org_3ECY5T4eOq6AOXciWWdK3G2vzGD";
const SEED_TAG = "[seed-demo]";

const VEHICLES = [
  { plate: "NLR-2A34", brand: "Mercedes-Benz", model: "Actros 2651", type: "truck" },
  {
    plate: "PWX-5C11",
    brand: "Volkswagen",
    model: "Constellation 24.280",
    type: "truck",
  },
  { plate: "QRT-8090", brand: "Fiat", model: "Toro Endurance", type: "pickup" },
  { plate: "HGF-3B22", brand: "Ford", model: "Cargo 1719", type: "truck" },
  { plate: "MZK-1L77", brand: "Toyota", model: "Hilux SRV", type: "pickup" },
  { plate: "JTB-7D45", brand: "Renault", model: "Master Furgão", type: "van" },
];

const VEHICULAR_PLAN_ITEMS = [
  "Pneus: sulco, calibragem e ausência de bolhas",
  "Freios: curso do pedal e freio de estacionamento",
  "Iluminação: faróis, lanternas e setas",
  "Extintor de incêndio dentro da validade",
  "Cintos de segurança e apoios de cabeça",
  "Espelhos retrovisores e limpadores de para-brisa",
  "Documentação do veículo e CNH do condutor",
  "Vazamentos visíveis (óleo, combustível, arrefecimento)",
];

const SAFETY_PLAN_ITEMS = [
  "Sinalização de rotas de fuga e saídas de emergência",
  "Uso correto de EPI pela equipe em campo",
  "Guarda-corpo e proteção de aberturas no piso",
  "Organização e limpeza da frente de trabalho",
  "Armazenamento de produtos químicos",
];

const RESPONSIBLES = ["C. Menezes", "R. Duarte", "A. Ribeiro", "P. Alencar"];
const STATUSES = [
  "completed",
  "completed",
  "completed",
  "in_progress",
  "pending",
  "cancelled",
];
const ROUTES = [
  "Matriz → CD Jundiaí",
  "Obra Sul → Pátio central",
  "Ronda urbana",
  "Matriz → Cliente Campinas",
];

const SAFETY_CATEGORIES = ["safety", "environment", "quality", "health", "other"];
const SAFETY_AREAS = [
  "Almoxarifado",
  "Linha de montagem",
  "Canteiro — Bloco B",
  "Pátio de manobras",
  "Refeitório",
  "Subestação elétrica",
];
const OCCURRENCES = [
  { description: "Extintor com sinalização de piso apagada", severity: "low" },
  {
    description: "Colaborador sem protetor auricular na zona de ruído",
    severity: "high",
  },
  { description: "Material empilhado acima da altura permitida", severity: "medium" },
  { description: "Guarda-corpo com fixação folgada no vão leste", severity: "high" },
];

/** Data ISO recuando `daysAgo` dias a partir de uma âncora fixa (seed determinístico). */
function isoDate(daysAgo: number): string {
  const anchor = new Date("2026-07-02T00:00:00Z");
  anchor.setUTCDate(anchor.getUTCDate() - daysAgo);
  return anchor.toISOString().slice(0, 10);
}

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error("DATABASE_URL_UNPOOLED não encontrada em .env.local");
  const sql = postgres(url, { max: 1 });

  try {
    const companies = await sql`
      select id from public.companies where org_id = ${ORG_ID} order by created_at limit 2`;
    if (companies.length === 0) {
      throw new Error(
        "Nenhuma empresa no tenant dev — rode antes: npx tsx scripts/seed-dev-org.ts",
      );
    }

    console.log("Limpando inspeções semeadas anteriormente…");
    await sql`
      delete from public.inspections
      where org_id = ${ORG_ID} and notes like ${`${SEED_TAG}%`}`;
    await sql`
      delete from public.inspection_plans
      where org_id = ${ORG_ID} and description like ${`${SEED_TAG}%`}`;

    // ── Veículos ────────────────────────────────────────────────────────────
    for (const v of VEHICLES) {
      await sql`
        insert into public.vehicles (org_id, plate, brand, model, type, initial_km)
        values (${ORG_ID}, ${v.plate}, ${v.brand}, ${v.model}, ${v.type}, ${40000})
        on conflict (org_id, plate) do update
          set brand = excluded.brand, model = excluded.model, type = excluded.type`;
    }
    const vehicleRows = await sql<{ id: string; plate: string }[]>`
      select id, plate from public.vehicles where org_id = ${ORG_ID} order by plate`;
    console.log(`Veículos disponíveis: ${vehicleRows.length}`);

    // ── Planos de inspeção + itens ──────────────────────────────────────────
    async function createPlan(type: string, title: string, items: string[]) {
      const [plan] = await sql<{ id: string }[]>`
        insert into public.inspection_plans (org_id, number, type, title, description)
        values (
          ${ORG_ID},
          (select coalesce(max(number), 0) + 1 from public.inspection_plans where org_id = ${ORG_ID}),
          ${type}, ${title}, ${`${SEED_TAG} plano de demonstração`})
        returning id`;
      for (const [index, description] of items.entries()) {
        await sql`
          insert into public.inspection_plan_items (org_id, plan_id, description, default_value, "order")
          values (${ORG_ID}, ${plan.id}, ${description}, true, ${index})`;
      }
      return plan.id;
    }

    const vehicularPlanId = await createPlan(
      "vehicular",
      "Checklist Diário de Frota",
      VEHICULAR_PLAN_ITEMS,
    );
    const safetyPlanId = await createPlan(
      "safety",
      "Inspeção Planejada de Segurança",
      SAFETY_PLAN_ITEMS,
    );
    const planItems = await sql<{ id: string }[]>`
      select id from public.inspection_plan_items
      where plan_id = ${vehicularPlanId} order by "order"`;

    // ── Inspeções veiculares ────────────────────────────────────────────────
    const VEHICULAR_COUNT = 26;
    for (let i = 0; i < VEHICULAR_COUNT; i++) {
      const vehicle = vehicleRows[i % vehicleRows.length];
      const status = STATUSES[i % STATUSES.length];
      const [inspection] = await sql<{ id: string }[]>`
        insert into public.inspections (
          org_id, type, status, inspected_at, plan_id, vehicle_id,
          responsible, driver_name, driver_license, current_km, route, notes
        ) values (
          ${ORG_ID}, 'vehicular', ${status}, ${isoDate(i * 2)}, ${vehicularPlanId},
          ${vehicle.id}, ${RESPONSIBLES[i % RESPONSIBLES.length]},
          ${RESPONSIBLES[(i + 1) % RESPONSIBLES.length]}, ${`0${9000000 + i}`},
          ${48000 + i * 730}, ${ROUTES[i % ROUTES.length]},
          ${`${SEED_TAG} inspeção veicular de demonstração`}
        ) returning id`;

      if (status !== "pending") {
        for (const [index, item] of planItems.entries()) {
          // Uma não conformidade a cada 7 itens, para a tela mostrar variação.
          const value = (i + index) % 7 === 0 ? false : true;
          await sql`
            insert into public.inspection_item_responses (
              org_id, inspection_id, plan_item_id, value, observation
            ) values (
              ${ORG_ID}, ${inspection.id}, ${item.id}, ${value},
              ${value ? null : "Item reprovado — encaminhado para manutenção."}
            )`;
        }
      }
    }
    console.log(`Inspeções veiculares criadas: ${VEHICULAR_COUNT}`);

    // ── Inspeções de segurança ──────────────────────────────────────────────
    const SAFETY_COUNT = 22;
    for (let i = 0; i < SAFETY_COUNT; i++) {
      const company = companies[i % companies.length];
      const [inspection] = await sql<{ id: string }[]>`
        insert into public.inspections (
          org_id, type, status, inspected_at, plan_id, company_id,
          responsible, category, planned, area, notes
        ) values (
          ${ORG_ID}, 'safety', ${STATUSES[i % STATUSES.length]}, ${isoDate(i * 3)},
          ${safetyPlanId}, ${company.id}, ${RESPONSIBLES[i % RESPONSIBLES.length]},
          ${SAFETY_CATEGORIES[i % SAFETY_CATEGORIES.length]}, ${i % 3 !== 0},
          ${SAFETY_AREAS[i % SAFETY_AREAS.length]},
          ${`${SEED_TAG} inspeção de segurança de demonstração`}
        ) returning id`;

      // Nem toda inspeção tem ocorrência — a coluna "Ocorrências" precisa de zeros.
      const occurrenceCount = i % 4;
      for (let k = 0; k < occurrenceCount; k++) {
        const occurrence = OCCURRENCES[(i + k) % OCCURRENCES.length];
        await sql`
          insert into public.inspection_occurrences (org_id, inspection_id, description, severity)
          values (${ORG_ID}, ${inspection.id}, ${occurrence.description}, ${occurrence.severity})`;
      }
    }
    console.log(`Inspeções de segurança criadas: ${SAFETY_COUNT}`);
    console.log("Seed concluído.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
