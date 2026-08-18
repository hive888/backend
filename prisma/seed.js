require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ROLES = [
  { role_id: '9080e145-19d4-11f0-8461-c89402834315', role_name: 'developer' },
  { role_id: '92cde9f8-7c30-11f0-a026-0253f940d945', role_name: 'accounting' },
  { role_id: 'c6e04f04-4d0d-11f0-8226-0253f940d945', role_name: 'manager' },
  { role_id: 'fd487831-19c2-11f0-8461-c89402834315', role_name: 'administrator' },
  { role_id: 'fd4fe48e-19c2-11f0-8461-c89402834315', role_name: 'superadmin' },
  { role_id: 'fd50497c-19c2-11f0-8461-c89402834315', role_name: 'customer' },
];

const COURSES = [
  {
    slug: 'blockchain-ecosystem',
    title: 'Blockchain Ecosystem',
    short_description: 'A deep dive into the history, structure, and fundamentals of the blockchain ecosystem.',
    detailed_description: 'This course covers the essentials of blockchain technology, major networks, and how the global ecosystem operates.',
    thumbnail_url: '/images/blockchain-ecosystem.png',
    is_active: 1,
  },
  {
    slug: 'blockchain-mechanisms-applications',
    title: 'Blockchain Mechanisms & Applications',
    short_description: 'Understand how consensus mechanisms work and where blockchain is applied.',
    detailed_description: 'Learn about Proof of Work, Proof of Stake, consensus protocols, and real-world industrial and corporate use cases.',
    thumbnail_url: '/images/blockchain-mechanisms.png',
    is_active: 1,
  },
  {
    slug: 'crypto-ecosystem',
    title: 'Crypto Ecosystem',
    short_description: 'Explore cryptocurrencies, tokens, wallets, and asset types.',
    detailed_description: 'An introduction to crypto assets, tokenomics, cryptography, secure transactions, wallet configurations, and key networks.',
    thumbnail_url: '/images/crypto-ecosystem.png',
    is_active: 1,
  },
  {
    slug: 'decentralized-finance',
    title: 'Decentralized Finance (DeFi)',
    short_description: 'Introduction to smart contracts, lending protocols, AMMs, and yield generation.',
    detailed_description: 'Learn how DeFi replaces traditional financial systems using automated smart contracts, liquidity pools, and staking.',
    thumbnail_url: '/images/decentralized-finance.png',
    is_active: 1,
  },
  {
    slug: 'web3',
    title: 'Web 3.0',
    short_description: 'The evolution of the internet towards ownership, DAOs, and NFTs.',
    detailed_description: 'Discover the new internet layer: user ownership, decentralized autonomous organizations, digital identity, and NFTs.',
    thumbnail_url: '/images/web3.png',
    is_active: 1,
  },
];

async function main() {
  for (const role of ROLES) {
    await prisma.roles.upsert({
      where: { role_id: role.role_id },
      update: { role_name: role.role_name },
      create: role,
    });
  }

  for (const course of COURSES) {
    await prisma.courses.upsert({
      where: { slug: course.slug },
      update: {
        title: course.title,
        short_description: course.short_description,
        detailed_description: course.detailed_description,
        thumbnail_url: course.thumbnail_url,
        is_active: course.is_active,
      },
      create: course,
    });
  }

  console.log(`Seeded ${ROLES.length} roles and ${COURSES.length} courses`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
