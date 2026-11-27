// Placeholder db client — Prisma will be re-enabled after database setup.
// This allows the build to succeed without a database connection.
// When DATABASE_URL is set and Prisma is configured, replace this with:
// import { PrismaClient } from '@prisma/client'
// const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }
// export const db = globalForPrisma.prisma ?? new PrismaClient({ log: ['error', 'warn'] })
// if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

export const db = {
  // Dummy methods that return empty results — will be replaced with Prisma
  user: { findFirst: async () => null, findMany: async () => [], create: async (d: any) => ({ id: 'demo', ...d.data }), count: async () => 0 },
  post: { findMany: async () => [], create: async () => ({}), count: async () => 0 },
  notification: { findMany: async () => [], count: async () => 0 },
  story: { findMany: async () => [] },
  neighbourhood: { createManyAndReturn: async () => [] },
  listing: { findMany: async () => [] },
  job: { findMany: async () => [] },
  serviceJob: { findMany: async () => [], create: async () => ({}) },
  group: { findMany: async () => [] },
  event: { findMany: async () => [] },
  page: { findMany: async () => [] },
  conversation: { findMany: async () => [] },
  message: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
  conversationMember: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
  review: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
  alert: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
  helpRequest: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
  report: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
  tradeSlot: { findMany: async () => [] },
  tradeApproval: { findUnique: async () => null, create: async () => ({}) },
  collabRequest: { findMany: async () => [], create: async () => ({}), findFirst: async () => null },
  collabInterest: { findUnique: async () => null, create: async () => ({}) },
  supportCase: { findMany: async () => [], create: async () => ({}) },
  district: { findMany: async () => [], findFirst: async () => null },
  course: { findMany: async () => [], count: async () => 0 },
  enrollment: { findUnique: async () => null, create: async () => ({}), upsert: async () => ({}) },
  fundraiser: { findMany: async () => [], create: async () => ({}) },
  donation: { create: async () => ({}), aggregate: async () => ({ _sum: { amount: 0 } }) },
  mentor: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
  mentorSession: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
  jobReferral: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
  skillAssessment: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
  tradeSlot_update: async () => ({}),
}