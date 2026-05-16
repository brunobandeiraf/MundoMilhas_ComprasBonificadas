import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const categoryMap: Record<string, string[]> = {
  'Moda': ['Adidas', 'Nike', 'Zara', 'C&A', 'Renner', 'Riachuelo', 'Shein', 'Dafiti', 'Netshoes', 'Centauro', 'Puma', 'Arezzo', 'Havaianas', 'Hering', 'Levi', 'Calvin Klein', 'Lacoste', 'Tommy', 'Reserva', 'Amaro', 'Shoulder', 'Farm', 'Animale', 'Osklen', 'Melissa', 'Vans', 'New Balance', 'Asics', 'Under Armour', 'Mizuno', 'Olympikus', 'Lupo', 'Track&Field', 'Youcom', 'Marisa', 'Posthaus', 'Privalia', 'Off Premium', 'Kanui', 'Tricae', 'Zattini', 'Vivara', 'Pandora', 'Swarovski', 'Ray-Ban', 'Oakley', 'Chilli Beans', 'Passarela', 'Colcci', 'Forum', 'Morena Rosa', 'Lança Perfume', 'John John', 'Ellus'],
  'Eletrônicos': ['Samsung', 'Apple', 'Dell', 'Lenovo', 'HP', 'Multilaser', 'Positivo', 'LG', 'Sony', 'JBL', 'Bose', 'Philips', 'Motorola', 'Xiaomi', 'Huawei', 'Asus', 'Acer', 'Kabum', 'Pichau', 'Terabyte', 'Fast Shop', 'Girafa', 'Consul', 'Brastemp', 'Electrolux'],
  'Casa e Decoração': ['Tok&Stok', 'Etna', 'MadeiraMadeira', 'Leroy Merlin', 'Telhanorte', 'Camicado', 'Tramontina', 'Mondial', 'Britânia', 'Polishop', 'Mobly', 'Westwing', 'Shoptime', 'TendTudo', 'Zelo', 'Buddemeyer'],
  'Beleza': ['O Boticário', 'Boticário', 'Natura', 'Sephora', 'MAC', 'Avon', 'Eudora', 'Quem Disse Berenice', 'Beleza na Web', 'Época Cosméticos', 'The Body Shop', "L'Occitane", 'Dermage', 'Vult', 'Salon Line', 'Loccitane', 'Granado', 'Phytoervas', 'Bio Extratus'],
  'Supermercado': ['Carrefour', 'Extra', 'Pão de Açúcar', 'GPA', 'iFood', 'Rappi', 'Zé Delivery', 'James Delivery', 'Mambo'],
  'Viagens': ['Booking', 'Decolar', 'CVC', 'Hurb', 'Submarino Viagens', 'Latam', 'Gol', 'Azul', 'Airbnb', 'Hotels.com', 'Expedia', 'Rentcars', 'Localiza', 'Movida', 'Unidas', 'Smiles', 'Passagens Promo', '123milhas', 'MaxMilhas', 'Vai de Promo'],
  'Saúde e Bem-estar': ['Drogasil', 'Droga Raia', 'Panvel', 'Pague Menos', 'Ultrafarma', 'Drogaria São Paulo', 'Onofre', 'Netfarma', 'Growth', 'Integral Médica', 'Drogaria', 'Farmácia', 'Farma'],
  'Esporte e Lazer': ['Centauro', 'Netshoes', 'Decathlon', 'Nike', 'Adidas', 'Puma', 'Under Armour', 'Mizuno', 'Asics', 'New Balance', 'World Tennis'],
  'Marketplace': ['Shopee', 'Amazon', 'Mercado Livre', 'Magazine Luiza', 'Magalu', 'Americanas', 'Submarino', 'Casas Bahia', 'Ponto', 'AliExpress', 'Wish', 'Shoptime'],
  'Alimentação': ['iFood', 'Rappi', 'Zé Delivery', 'Wine', 'Evino', 'Grand Cru', 'Nespresso', 'Dolce Gusto', 'Nestlé', 'Empório', 'Café'],
  'Pet': ['Petz', 'Cobasi', 'Petlove', 'DogHero', 'Pet'],
  'Infantil': ['Ri Happy', 'PBKids', 'Lego', 'Disney', 'Tricae', 'Baby', 'Kids', 'Infantil'],
  'Livros e Educação': ['Saraiva', 'Cultura', 'Estante Virtual', 'Udemy', 'Alura', 'Hotmart', 'Livro'],
  'Serviços': ['Uber', '99', 'Sem Parar', 'ConectCar', 'Vivo', 'Claro', 'Tim', 'Oi', 'NET', 'Sky', 'Porto Seguro', 'Seguro'],
  'Automotivo': ['Auto', 'Pneu', 'Carro', 'Moto', 'Combustível', 'Shell', 'Ipiranga'],
}

async function main() {
  const stores = await prisma.store.findMany({ where: { category: null } })
  let updated = 0

  for (const store of stores) {
    const nameLower = store.name.toLowerCase()
    const matchedCategories: string[] = []

    for (const [category, keywords] of Object.entries(categoryMap)) {
      const match = keywords.some((kw) => nameLower.includes(kw.toLowerCase()))
      if (match) matchedCategories.push(category)
    }

    if (matchedCategories.length > 0) {
      await prisma.store.update({
        where: { id: store.id },
        data: { category: matchedCategories.join(', ') },
      })
      updated++
    }
  }

  console.log(`[Categories] ${updated} lojas atualizadas de ${stores.length} sem categoria.`)
  const remaining = await prisma.store.count({ where: { category: null } })
  console.log(`[Categories] ${remaining} lojas ainda sem categoria.`)
}

main().finally(() => prisma.$disconnect())
