import { z } from "zod";

/**
 * Update (PATCH) schema made from a create schema: every field optional and NO default applied.
 *
 * In Zod 4 `schema.partial()` keeps `.default()` inside each optional field, so a PATCH that sends only
 * `{ email }` comes back with every defaulted field (status, type, colour, ...) filled in, and the update
 * then overwrites what is stored. Strip the defaults first, then make the fields optional.
 * Refinements on the create schema are not carried over: add them again on the result when they still apply.
 */
type Stripped<F> = F extends z.ZodDefault<infer Inner> ? Inner : F;
type UpdateShape<S> = { [K in keyof S]: z.ZodOptional<Stripped<S[K]> & z.ZodType> };

export function updateSchemaOf<T extends z.ZodObject>(schema: T): z.ZodObject<UpdateShape<T["shape"]>> {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, field] of Object.entries(schema.shape as Record<string, z.ZodType>)) {
    shape[key] = field instanceof z.ZodDefault ? (field as z.ZodDefault<z.ZodType>).removeDefault() : field;
  }
  return z.object(shape).partial() as unknown as z.ZodObject<UpdateShape<T["shape"]>>;
}
