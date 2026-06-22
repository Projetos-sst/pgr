import { resolvePageParams, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "@/shared/pagination";

describe("resolvePageParams", () => {
  it("usa defaults quando entrada ausente", () => {
    expect(resolvePageParams()).toEqual({
      page: 1,
      pageSize: PAGE_SIZE_DEFAULT,
      limit: PAGE_SIZE_DEFAULT,
      offset: 0,
    });
  });

  it("calcula offset a partir de page/pageSize válidos", () => {
    expect(resolvePageParams({ page: 3, pageSize: 10 })).toEqual({
      page: 3,
      pageSize: 10,
      limit: 10,
      offset: 20,
    });
  });

  it.each([0, -2, 1.5, NaN])("page inválida (%p) cai em 1", (page) => {
    expect(resolvePageParams({ page }).page).toBe(1);
  });

  it.each([0, -5, 2.5, NaN])("pageSize inválido (%p) cai no default", (pageSize) => {
    expect(resolvePageParams({ pageSize }).pageSize).toBe(PAGE_SIZE_DEFAULT);
  });

  it("clampa pageSize ao máximo", () => {
    expect(resolvePageParams({ pageSize: 5000 }).pageSize).toBe(PAGE_SIZE_MAX);
  });
});
