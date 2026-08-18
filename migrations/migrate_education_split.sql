-- migrate_education_split.sql

-- 1. Add course_id to chapters
ALTER TABLE chapters ADD COLUMN course_id bigint NULL;
ALTER TABLE chapters ADD CONSTRAINT fk_chapters_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;

-- 2. Insert 5 new courses
INSERT INTO courses (slug, title, short_description, detailed_description, thumbnail_url, is_active) VALUES
('blockchain-ecosystem', 'Blockchain Ecosystem', 'A deep dive into the history, structure, and fundamentals of the blockchain ecosystem.', 'This course covers the essentials of blockchain technology, major networks, and how the global ecosystem operates.', '/images/blockchain-ecosystem.png', 1),
('blockchain-mechanisms-applications', 'Blockchain Mechanisms & Applications', 'Understand how consensus mechanisms work and where blockchain is applied.', 'Learn about Proof of Work, Proof of Stake, consensus protocols, and real-world industrial and corporate use cases.', '/images/blockchain-mechanisms.png', 1),
('crypto-ecosystem', 'Crypto Ecosystem', 'Explore cryptocurrencies, tokens, wallets, and asset types.', 'An introduction to crypto assets, tokenomics, cryptography, secure transactions, wallet configurations, and key networks.', '/images/crypto-ecosystem.png', 1),
('decentralized-finance', 'Decentralized Finance (DeFi)', 'Introduction to smart contracts, lending protocols, AMMs, and yield generation.', 'Learn how DeFi replaces traditional financial systems using automated smart contracts, liquidity pools, and staking.', '/images/decentralized-finance.png', 1),
('web3', 'Web 3.0', 'The evolution of the internet towards ownership, DAOs, and NFTs.', 'Discover the new internet layer: user ownership, decentralized autonomous organizations, digital identity, and NFTs.', '/images/web3.png', 1);

-- 3. Map chapters to their respective courses
UPDATE chapters SET course_id = (SELECT id FROM courses WHERE slug = 'blockchain-ecosystem') WHERE id = 11;
UPDATE chapters SET course_id = (SELECT id FROM courses WHERE slug = 'blockchain-mechanisms-applications') WHERE id = 13;
UPDATE chapters SET course_id = (SELECT id FROM courses WHERE slug = 'crypto-ecosystem') WHERE id = 14;
UPDATE chapters SET course_id = (SELECT id FROM courses WHERE slug = 'decentralized-finance') WHERE id = 15;
UPDATE chapters SET course_id = (SELECT id FROM courses WHERE slug = 'web3') WHERE id = 16;

-- 4. Copy existing user access to the new courses
INSERT INTO customer_course_access (customer_id, course_id, status, granted_via, access_code_id, expires_at)
SELECT cca.customer_id, c.id, cca.status, cca.granted_via, cca.access_code_id, cca.expires_at
FROM customer_course_access cca
CROSS JOIN courses c
WHERE cca.course_id = 2 AND c.slug IN ('blockchain-ecosystem', 'blockchain-mechanisms-applications', 'crypto-ecosystem', 'decentralized-finance', 'web3');

-- 5. Mark old courses inactive
UPDATE courses SET is_active = 0 WHERE id IN (1, 2);
