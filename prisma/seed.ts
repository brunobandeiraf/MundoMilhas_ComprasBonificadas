import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const adminEmail = 'contatomundomilhas@gmail.com'

  const existingAdmin = await prisma.user.findFirst({
    where: { email: adminEmail },
  })

  if (existingAdmin) {
    console.log(`[Seed] Admin já existe: ${adminEmail}`)
  } else {
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Bruno Bandeira Fernandes',
        role: 'admin',
        isActive: false,
        passwordHash: null,
      },
    })
    console.log(`[Seed] Admin criado: ${adminEmail}`)
    console.log('[Seed] No primeiro login, um token de ativação será enviado por e-mail.')
  }

  // Seed do programa Livelo
  const existingProgram = await prisma.loyaltyProgram.findFirst({
    where: { name: 'Livelo' },
  })

  if (!existingProgram) {
    await prisma.loyaltyProgram.create({
      data: {
        name: 'Livelo',
        url: 'https://www.livelo.com.br/juntar-pontos/todos-os-parceiros',
        isActive: true,
      },
    })
    console.log('[Seed] Programa Livelo criado.')
  } else {
    console.log('[Seed] Programa Livelo já existe.')
  }
}

main()
  .catch((e) => {
    console.error('[Seed] Erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
