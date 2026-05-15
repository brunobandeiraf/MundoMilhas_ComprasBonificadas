import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const url = process.env.DATABASE_URL!
console.log('URL:', url)

const libsql = createClient({ url })
const adapter = new PrismaLibSql(libsql)

const prisma = new PrismaClient({
  adapter,
  datasourceUrl: url,
} as any)

try {
  const users = await prisma.user.findMany()
  console.log('Users found:', users.length)
} catch (e: any) {
  console.error('Error:', e.message || e)
}
await prisma.$disconnect()
