type ClerkSyncLogLevel = "info" | "error";

type ClerkSyncLogFields = Record<string, unknown> & {
  operation: string;
  phase: "finish" | "rejected" | "error";
};

export function logClerkSync(level: ClerkSyncLogLevel, fields: ClerkSyncLogFields): void {
  const line = JSON.stringify({ level, ...fields });
  if (level === "error") {
    console.error(line);
    return;
  }
  console.log(line);
}
