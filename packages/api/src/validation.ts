import { z } from 'zod'

export const CommentQuerySchema = z.object({
  url: z.string().min(1, 'url is required'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
})

export const CreateCommentSchema = z.object({
  url: z.string().min(1),
  nick: z.string().min(1).max(100),
  mail: z.string().email().optional().or(z.literal('')),
  link: z.string().url().optional().or(z.literal('')),
  content: z.string().min(1).max(10000),
  rid: z.string().optional(),
  pid: z.string().optional(),
})

export const LoginSchema = z.object({
  password: z.string().min(1),
})

export const SetupSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const AdminConfigSchema = z.record(z.string(), z.any())

export const ModerateSchema = z.object({
  action: z.enum(['approve', 'spam', 'delete']),
})

export const TopSchema = z.object({
  top: z.boolean(),
})

export const AdminCommentQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  url: z.string().optional(),
  includeSpam: z.coerce.boolean().default(false),
})
