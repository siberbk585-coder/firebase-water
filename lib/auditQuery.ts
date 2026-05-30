import { prisma } from "./db";
import { enrichAuditLogRows } from "./auditEnrich";
import {
  auditActionLabel,
  entityLabel,
  userRoleLabel,
} from "./vi";

export const AUDIT_LOG_PAGE_SIZE = 50;

export type AuditLogQueryParams = {
  page?: number;
  pageSize?: number;
  action?: string;
  /** Chỉ log của user này */
  actorId?: string;
  /** Lọc metadata.nguon = MOBILE | WEB */
  source?: "MOBILE" | "WEB";
};

export type AuditLogApiItem = {
  id: string;
  createdAt: string;
  action: string;
  actionLabel: string;
  entity: string;
  entityLabel: string;
  entityId: string | null;
  entitySummary: string | null;
  actor: {
    name: string;
    phone: string;
    role: string;
    roleLabel: string;
  } | null;
  details: { label: string; value: string }[];
};

export async function queryAuditLogs(params: AuditLogQueryParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(
    100,
    Math.max(1, params.pageSize ?? AUDIT_LOG_PAGE_SIZE)
  );
  const skip = (page - 1) * pageSize;

  const where: {
    action?: string;
    actorId?: string;
    metadata?: { contains: string };
  } = {};
  if (params.action) where.action = params.action;
  if (params.actorId) where.actorId = params.actorId;
  if (params.source === "MOBILE") {
    where.metadata = { contains: '"nguon":"MOBILE"' };
  }

  const [logs, total, actionGroups] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
      include: {
        actor: { select: { name: true, phone: true, role: true } },
      },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({
      by: ["action"],
      _count: { action: true },
      orderBy: { _count: { action: "desc" } },
    }),
  ]);

  const enriched = await enrichAuditLogRows(logs);

  const items: AuditLogApiItem[] = enriched.map(
    ({ log, lines, entitySummary }) => ({
      id: log.id,
      createdAt: log.createdAt.toISOString(),
      action: log.action,
      actionLabel: auditActionLabel(log.action),
      entity: log.entity,
      entityLabel: entityLabel(log.entity),
      entityId: log.entityId,
      entitySummary,
      actor: log.actor
        ? {
            name: log.actor.name,
            phone: log.actor.phone,
            role: log.actor.role,
            roleLabel: userRoleLabel(log.actor.role),
          }
        : null,
      details: lines,
    })
  );

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    actionCounts: actionGroups.map((g) => ({
      action: g.action,
      label: auditActionLabel(g.action),
      count: g._count.action,
    })),
  };
}
