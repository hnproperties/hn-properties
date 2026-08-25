import { NextResponse, type NextRequest } from 'next/server';
import { ZodError, type ZodTypeAny } from 'zod';
import { prisma, plain } from './prisma';
import { getCurrentUser, type CurrentUser } from './auth';
import { can, requireUser } from './rbac';
import { ApiError, badRequest, forbidden, notFound } from './errors';
import { audit } from './audit';

export const ok = (data: unknown, init?: ResponseInit) => NextResponse.json({ data }, init);

export const fail = (error: unknown) => {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'Please check the highlighted fields', details: error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  console.error('[api] unhandled', error);
  return NextResponse.json({ error: 'Something went wrong on our side' }, { status: 500 });
};

export function route<T extends any[]>(handler: (req: NextRequest, ...rest: T) => Promise<Response>) {
  return async (req: NextRequest, ...rest: T) => {
    try {
      return await handler(req, ...rest);
    } catch (error) {
      return fail(error);
    }
  };
}

export async function currentUserOrThrow(): Promise<CurrentUser> {
  return requireUser(await getCurrentUser());
}

export async function readJson(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    throw badRequest('Expected a JSON body');
  }
}

export function parse<T extends ZodTypeAny>(schema: T, value: unknown): T['_output'] {
  return schema.parse(value);
}

export const clientIp = (req: NextRequest) =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? null;

/* ────────────────────────────────────────────── resource factory */

export type ResourceDef = {
  /** Permission prefix and audit name, e.g. 'property'. */
  name: string;
  /** Prisma model delegate key, e.g. 'property'. */
  model: string;
  label: string;
  searchFields?: string[];
  filterFields?: string[];
  defaultOrder?: Record<string, unknown> | Record<string, unknown>[];
  listSelect?: Record<string, unknown>;
  listInclude?: Record<string, unknown>;
  itemInclude?: Record<string, unknown>;
  createSchema: ZodTypeAny;
  updateSchema: ZodTypeAny;
  /**
   * Row scope for users without `<name>.view.all`. Returning null means the user
   * may not list this resource at all.
   */
  scope?: (user: CurrentUser) => Record<string, unknown> | null;
  mask?: (row: any, user: CurrentUser) => any;
  codeOf?: (row: any) => string | undefined;
  beforeCreate?: (input: any, user: CurrentUser) => Promise<any> | any;
  afterCreate?: (row: any, input: any, user: CurrentUser) => Promise<void> | void;
  beforeUpdate?: (input: any, existing: any, user: CurrentUser) => Promise<any> | any;
  afterUpdate?: (row: any, existing: any, input: any, user: CurrentUser) => Promise<void> | void;
  beforeDelete?: (existing: any, user: CurrentUser) => Promise<void> | void;
  afterDelete?: (existing: any, user: CurrentUser) => Promise<void> | void;
};

const delegate = (model: string) => (prisma as any)[model];

/** Only fields the resource declares can be filtered, so query strings cannot widen access. */
function pickFilters(params: URLSearchParams, fields: string[] = []) {
  const where: Record<string, unknown> = {};
  for (const field of fields) {
    const value = params.get(field);
    if (value === null || value === '') continue;
    if (value === 'true' || value === 'false') where[field] = value === 'true';
    else if (value.includes(',')) where[field] = { in: value.split(',').filter(Boolean) };
    else where[field] = value;
  }
  return where;
}

function searchWhere(term: string | null, fields: string[] = []) {
  if (!term || !fields.length) return undefined;
  return { OR: fields.map((field) => ({ [field]: { contains: term, mode: 'insensitive' } })) };
}

/** Row scope, applied to every list, read, update and delete — not just the list. */
export function scopeWhere(def: ResourceDef, user: CurrentUser) {
  if (can(user, `${def.name}.view.all`)) return {};
  const scope = def.scope?.(user);
  if (scope === null || scope === undefined) throw forbidden();
  return scope;
}

export function collectionRoutes(def: ResourceDef) {
  const GET = route(async (req: NextRequest) => {
    const user = await currentUserOrThrow();
    if (!can(user, `${def.name}.view`) && !can(user, `${def.name}.view.all`)) throw forbidden();

    const params = req.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get('page') ?? 1));
    const perPage = Math.min(100, Math.max(1, Number(params.get('perPage') ?? 25)));

    const where = {
      AND: [
        scopeWhere(def, user),
        pickFilters(params, def.filterFields),
        searchWhere(params.get('q'), def.searchFields) ?? {},
      ],
    };

    const [rows, total] = await Promise.all([
      delegate(def.model).findMany({
        where,
        orderBy: def.defaultOrder ?? { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        ...(def.listSelect ? { select: def.listSelect } : {}),
        ...(def.listInclude ? { include: def.listInclude } : {}),
      }),
      delegate(def.model).count({ where }),
    ]);

    const masked = def.mask ? rows.map((row: any) => def.mask!(row, user)) : rows;
    return ok({ rows: plain(masked), total, page, perPage });
  });

  const POST = route(async (req: NextRequest) => {
    const user = await currentUserOrThrow();
    if (!can(user, `${def.name}.create`)) throw forbidden();

    const input = parse(def.createSchema, await readJson(req));
    const data = def.beforeCreate ? await def.beforeCreate(input, user) : input;
    const row = await delegate(def.model).create({
      data,
      ...(def.itemInclude ? { include: def.itemInclude } : {}),
    });
    await def.afterCreate?.(row, input, user);
    await audit({
      user,
      action: `${def.name}.created`,
      entityType: def.name,
      entityId: row.id,
      entityCode: def.codeOf?.(row) ?? row.code ?? row.publicId,
      ip: clientIp(req),
    });
    return ok(plain(def.mask ? def.mask(row, user) : row), { status: 201 });
  });

  return { GET, POST };
}

type Ctx = { params: { id: string } };

export function itemRoutes(def: ResourceDef) {
  async function load(id: string, user: CurrentUser) {
    const row = await delegate(def.model).findFirst({
      where: { AND: [{ id }, scopeWhere(def, user)] },
      ...(def.itemInclude ? { include: def.itemInclude } : {}),
    });
    if (!row) throw notFound(`${def.label} not found`);
    return row;
  }

  const GET = route(async (_req: NextRequest, { params }: Ctx) => {
    const user = await currentUserOrThrow();
    if (!can(user, `${def.name}.view`) && !can(user, `${def.name}.view.all`)) throw forbidden();
    const row = await load(params.id, user);
    return ok(plain(def.mask ? def.mask(row, user) : row));
  });

  const PATCH = route(async (req: NextRequest, { params }: Ctx) => {
    const user = await currentUserOrThrow();
    if (!can(user, `${def.name}.edit`)) throw forbidden();
    const existing = await load(params.id, user);
    const input = parse(def.updateSchema, await readJson(req));
    const data = def.beforeUpdate ? await def.beforeUpdate(input, existing, user) : input;
    const row = await delegate(def.model).update({
      where: { id: params.id },
      data,
      ...(def.itemInclude ? { include: def.itemInclude } : {}),
    });
    await def.afterUpdate?.(row, existing, input, user);
    await audit({
      user,
      action: `${def.name}.updated`,
      entityType: def.name,
      entityId: row.id,
      entityCode: def.codeOf?.(row) ?? row.code ?? row.publicId,
      meta: { fields: Object.keys(input ?? {}) },
      ip: clientIp(req),
    });
    return ok(plain(def.mask ? def.mask(row, user) : row));
  });

  const DELETE = route(async (req: NextRequest, { params }: Ctx) => {
    const user = await currentUserOrThrow();
    if (!can(user, `${def.name}.delete`)) throw forbidden();
    const existing = await load(params.id, user);
    await def.beforeDelete?.(existing, user);
    await delegate(def.model).delete({ where: { id: params.id } });
    await def.afterDelete?.(existing, user);
    await audit({
      user,
      action: `${def.name}.deleted`,
      entityType: def.name,
      entityId: params.id,
      entityCode: def.codeOf?.(existing) ?? existing.code ?? existing.publicId,
      ip: clientIp(req),
    });
    return ok({ id: params.id });
  });

  return { GET, PATCH, DELETE };
}
