import { z } from 'zod/v4'

export const storeFiltersSchema = z
  .object({
    search: z.string().max(100).optional(),
    category: z.string().optional(),
    program: z.string().optional(),
    sortBy: z.enum(['relevance', 'score_desc', 'score_asc', 'name_asc', 'name_desc']).optional(),
    minScore: z.coerce.number().int().min(1).max(99).optional(),
    maxScore: z.coerce.number().int().min(1).max(99).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .refine(
    (data) => {
      if (data.minScore !== undefined && data.maxScore !== undefined) {
        return data.minScore <= data.maxScore
      }
      return true
    },
    { message: 'Pontuação mínima deve ser menor ou igual à máxima' }
  )

export type StoreFilters = z.infer<typeof storeFiltersSchema>
