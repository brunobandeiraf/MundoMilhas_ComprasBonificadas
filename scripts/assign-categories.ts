import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// Category mapping based on known store names
const categoryMap: Record<string, string[]> = {
  'Moda': ['Adidas', 'Nike', 'Zara', 'C&A', 'Renner', 'Riachuelo', 'Shein', 'Dafiti', 'Netshoes', 'Centauro', 'Puma', 'Arezzo', 'Havaianas', 'Hering', 'Levi', 'Calvin Klein', 'Lacoste', 'Tommy', 'Reserva', 'Amaro', 'Shoulder', 'Farm', 'Animale', 'Osklen', 'Melissa', 'Vans', 'New Balance', 'Asics', 'Under Armour', 'Mizuno', 'Olympikus', 'Lupo', 'Track&Field', 'Youcom', 'Marisa', 'Posthaus', 'Privalia', 'Off Premium', 'Kanui', 'Tricae', 'Zattini'],
  'Eletrônicos': ['Samsung', 'Apple', 'Dell', 'Lenovo', 'HP', 'Multilaser', 'Positivo', 'LG', 'Sony', 'JBL', 'Bose', 'Philips', 'Motorola', 'Xiaomi', 'Huawei', 'Asus', 'Acer'],
  'Casa e Decoração': ['Tok&Stok', 'Etna', 'MadeiraMadeira', 'Leroy Merlin', 'Telhanorte', 'Camicado', 'Tramontina', 'Consul', 'Brastemp', 'Electrolux', 'Mondial', 'Britânia', 'Polishop', 'Mobly', 'Westwing'],
  'Beleza': ['O Boticário', 'Natura', 'Sephora', 'MAC', 'Avon', 'Eudora', 'Quem Disse Berenice', 'Beleza na Web', 'Época Cosméticos', 'The Body Shop', 'L\'Occitane', 'Dermage', 'Vult', 'Salon Line'],
  'Supermercado': ['Carrefour', 'Extra', 'Pão de Açúcar', 'GPA', 'Mercado Livre', 'iFood', 'Rappi', 'Zé Delivery', 'James Delivery'],
  'Viagens': ['Booking', 'Decolar', 'CVC', 'Hurb', 'Submarino Viagens', 'Latam', 'Gol', 'Azul', 'Airbnb', 'Hotels.com', 'Expedia', 'Rentcars', 'Localiza', 'Movida', 'Unidas'],
  'Saúde e Bem-estar': ['Drogasil', 'Droga Raia', 'Panvel', 'Pague Menos', 'Ultrafarma', 'Drogaria São Paulo', 'Onofre', 'Netfarma', 'Growth', 'Integral Médica'],
  'Esporte e Lazer': ['Centauro', 'Netshoes', 'Decathlon', 'Nike', 'Adidas', 'Puma', 'Under Armour', 'Mizuno', 'Asics', 'New Balance'],
  'Marketplace': ['Shopee', 'Amazon', 'Mercado Livre', 'Magazine Luiza', 'Americanas', 'Submarino', 'Casas Bahia', 'Ponto', 'AliExpress', 'Wish'],
  'Alimentação': ['iFood', 'Rappi', 'Zé Delivery', 'Wine', 'Evino', 'Grand Cru', 'Nespresso', 'Dolce Gusto', 'Nestlé'],
  'Pet': ['Petz', 'Cobasi', 'Petlove', 'DogHero'],
  'Infantil': ['Ri Happy', 'PBKids', 'Lego', 'Disney', 'Tricae'],
  'Livros e Educação': ['Amazon', 'Saraiva', 'Cultura', 'Estante Virtual', 'Udemy', 'Alura', 'Hotmart'],
  'Serviços': ['Uber', '99', 'Sem Parar', 'ConectCar', 'Vivo', 'Claro', 'Tim', 'Oi', 'NET', 'Sky'],
}

async function main() {
  const stores = await prisma.store.findMany({ where: { category: null } })
  let updated = 0

  for (const store of stores) {
    const nameLower = store.name.toLowerCase()

    for (const [category, keywords] of Object.entries(categoryMap)) {
      const match = keywords.some((kw) => nameLower.includes(kw.toLowerCase()))
      if (match) {
        await prisma.store.update({
          where: { id: store.id },
          data: { category },
        })
        updated++
        break
      }
    }
  }

  console.log(`[Categories] ${updated} lojas atualizadas de ${stores.length} sem categoria.`)

  // Show remaining without category
  const remaining = await prisma.store.count({ where: { category: null } })
  console.log(`[Categories] ${remaining} lojas ainda sem categoria.`)
}

main().finally(() => prisma.$disconnect())
