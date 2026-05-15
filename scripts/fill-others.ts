import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const result = await prisma.store.updateMany({
    where: { category: null },
    data: { category: 'Outros' },
  })
  console.log(`[Categories] ${result.count} lojas marcadas como "Outros".`)
}

main().finally(() => prisma.$disconnect())
