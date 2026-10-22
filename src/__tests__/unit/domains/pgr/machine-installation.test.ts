import {
  machineInstallationSchema,
  machineInstallationUpdateSchema,
} from "@/shared/domains/pgr/machine-installation";
const id = "11111111-1111-1111-1111-111111111111";
const input = {
  workUnitId: id,
  gesId: null,
  catalogId: id,
  mode: "individual",
  quantity: 1,
  identifier: "Patrimônio 1",
  description: "Descrição observada",
  reason: "Cadastro",
};
it("supports individual equipment and groups without inventing safety measures", () => {
  expect(machineInstallationSchema.parse(input).safetyMeasures).toBeNull();
  expect(
    machineInstallationSchema.safeParse({
      ...input,
      mode: "group",
      quantity: 4,
      identifier: null,
    }).success,
  ).toBe(true);
});
it("requires an identifier and unit quantity for individual equipment", () => {
  for (const added of [
    { identifier: "" },
    { quantity: 2 },
    { quantity: 0 },
    { quantity: 1.5 },
  ])
    expect(machineInstallationSchema.safeParse({ ...input, ...added }).success).toBe(
      false,
    );
});
it("rejects actor injection, invalid context and an update without concurrency version", () => {
  expect(
    machineInstallationSchema.safeParse({ ...input, createdBy: "forged" }).success,
  ).toBe(false);
  expect(
    machineInstallationSchema.safeParse({ ...input, gesId: "invalid" }).success,
  ).toBe(false);
  expect(machineInstallationUpdateSchema.safeParse({ data: input }).success).toBe(false);
});
