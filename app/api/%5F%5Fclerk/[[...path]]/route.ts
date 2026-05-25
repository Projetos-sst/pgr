import { createFrontendApiProxyHandlers } from "@clerk/nextjs/server";

export const { GET, POST, PUT, DELETE, PATCH } = createFrontendApiProxyHandlers();

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
