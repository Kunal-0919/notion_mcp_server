import { z } from "zod";

export const jsonObjectSchema = z.record(z.string(), z.unknown());
export const jsonArraySchema = z.array(z.unknown());
