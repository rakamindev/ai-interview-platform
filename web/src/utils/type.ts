import * as v from "valibot";

export function paginatedParams<TSchema extends v.ObjectEntries = {}>(extra?: TSchema) {
  return v.object({
    page: v.optional(v.number(), 1),
    per_page: v.optional(v.number(), 10),
    ...(extra ?? {}),
  });
}

function paginationObject() {
  return v.object({
    current_page: v.number(),
    per_page: v.number(),
    total_count: v.number(),
    total_pages: v.number(),
  });
}

export function paginatedList<TKey extends string, TItem extends v.GenericSchema>(key: TKey, item: TItem) {
  const entries = {
    [key]: v.array(item),
    meta: v.object({
      current_page: v.number(),
      per_page: v.number(),
      total_count: v.number(),
      total_pages: v.number(),
    }),
  } as Record<TKey, v.ArraySchema<TItem, undefined>> & {
    meta: ReturnType<typeof paginationObject>;
  };

  return v.object(entries);
}
