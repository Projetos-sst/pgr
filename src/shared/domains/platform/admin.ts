export type MasterUser = {
  id: string;
  email: string | null;
  name: string;
};

export type OrgAiUsage = {
  orgId: string;
  orgName: string | null;
  count: number;
};
