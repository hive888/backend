/**
 * Seed PTGR-owned listings into the Project Pool marketplace.
 *
 * Each folder in seed/project-pool/<slug>/ holds:
 *   - project.json            listing fields (same shape as the customer-dashboard wizard payload)
 *   - deck.pdf | deck.pptx    pitch deck (PPTX is converted to PDF with LibreOffice)
 *   - cover.png | cover.jpg   optional; otherwise slide 1 of the deck is rendered with pdftoppm
 *
 * Usage:
 *   node scripts/seed-project-pool.js [--dry-run] [--only=<slug>] [--reupload] [--public-dir=<dir>]
 *
 *   --public-dir  copy deck/cover into <dir>/project-pool/<slug>/ and store root-relative URLs instead of
 *                 uploading to S3 (for local testing, e.g. --public-dir=../customer-dashboard/public)
 *
 * Env:
 *   PTGR_USERNAME (default "ptgr"), PTGR_EMAIL, PTGR_PASSWORD
 *   PTGR_EMAIL / PTGR_PASSWORD are only needed the first time, to create the owner account.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const { uploadToS3 } = require('../config/s3Config');
const { ROLE_IDS } = require('../config/roles');

const SEED_DIR = path.resolve(__dirname, '../seed/project-pool');
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const REUPLOAD = args.includes('--reupload');
const ONLY = (args.find(a => a.startsWith('--only=')) || '').split('=')[1];
const PUBLIC_DIR = (args.find(a => a.startsWith('--public-dir=')) || '').split('=')[1];

const prisma = new PrismaClient();
const log = (...m) => console.log(DRY_RUN ? '[dry-run]' : '[seed]', ...m);

async function ensureOwner() {
  const username = process.env.PTGR_USERNAME || 'ptgr';
  const existing = await prisma.users.findUnique({ where: { username } });
  if (existing) {
    log(`Owner account "${username}" exists (${existing.user_id})`);
    return existing.user_id;
  }

  const email = process.env.PTGR_EMAIL;
  const password = process.env.PTGR_PASSWORD;
  if (!email || !password) {
    throw new Error(`Owner "${username}" not found. Set PTGR_EMAIL and PTGR_PASSWORD to create it.`);
  }
  if (DRY_RUN) {
    log(`Would create owner account "${username}" <${email}>`);
    return 'dry-run-owner';
  }

  const userId = uuidv4();
  await prisma.$transaction(async tx => {
    const customer = await tx.customers.create({
      data: {
        email,
        phone: `ptgr-${userId.slice(0, 8)}`,
        first_name: 'PTGR',
        last_name: 'Group',
        is_email_verified: 1,
        email_verified_at: new Date(),
        customer_type: 'business',
      },
    });
    await tx.users.create({
      data: {
        user_id: userId,
        customer_id: customer.customer_id,
        username,
        password_hash: await bcrypt.hash(password, 10),
        role_id: ROLE_IDS.customer,
      },
    });
  });
  log(`Created owner account "${username}" <${email}> (${userId})`);
  return userId;
}

function findFile(dir, names) {
  return names.map(n => path.join(dir, n)).find(p => fs.existsSync(p));
}

function deckToPdf(deckPath, workDir) {
  if (deckPath.toLowerCase().endsWith('.pdf')) return deckPath;
  execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', workDir, deckPath], { stdio: 'ignore' });
  const pdf = path.join(workDir, path.basename(deckPath).replace(/\.[^.]+$/, '.pdf'));
  if (!fs.existsSync(pdf)) throw new Error(`PDF conversion failed for ${deckPath}`);
  return pdf;
}

function renderCover(pdfPath, workDir) {
  const out = path.join(workDir, 'cover');
  execFileSync('pdftoppm', ['-png', '-f', '1', '-l', '1', '-scale-to', '1600', '-singlefile', pdfPath, out]);
  return `${out}.png`;
}

async function upload(filePath, slug, name, mimetype) {
  if (DRY_RUN) {
    log(`  Would upload ${path.basename(filePath)} (${(fs.statSync(filePath).size / 1024 / 1024).toFixed(1)} MB) as ${name}`);
    return `dry-run://${slug}/${name}`;
  }
  if (PUBLIC_DIR) {
    const destDir = path.resolve(PUBLIC_DIR, 'project-pool', slug);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(filePath, path.join(destDir, name));
    return `/project-pool/${slug}/${name}`;
  }
  return uploadToS3({ buffer: fs.readFileSync(filePath), originalname: name, mimetype }, `project_pool/${slug}/`);
}

async function seedProject(slug, ownerId) {
  const dir = path.join(SEED_DIR, slug);
  const data = JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8'));
  const deckPath = findFile(dir, ['deck.pdf', 'deck.pptx', 'deck.ppt']);
  if (!deckPath) throw new Error(`${slug}: no deck.pdf / deck.pptx found`);

  const existing = await prisma.projectPool.findFirst({ where: { creator_id: ownerId, title: data.title } });
  log(`${slug}: "${data.title}" — ${existing ? `updating #${existing.id}` : 'creating'}`);

  let deckUrl = existing?.deck_url;
  let coverUrl = existing?.cover_image_url;
  if (!deckUrl || !coverUrl || REUPLOAD) {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `pp-${slug}-`));
    try {
      const pdfPath = deckToPdf(deckPath, workDir);
      const coverPath = findFile(dir, ['cover.png', 'cover.jpg']) || renderCover(pdfPath, workDir);
      deckUrl = await upload(pdfPath, slug, `${slug}-pitch-deck.pdf`, 'application/pdf');
      coverUrl = await upload(coverPath, slug, `${slug}-cover${path.extname(coverPath)}`,
        coverPath.endsWith('.jpg') ? 'image/jpeg' : 'image/png');
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  } else {
    log('  Reusing existing deck and cover (pass --reupload to replace)');
  }

  const record = {
    title: data.title,
    tagline: data.tagline || null,
    category: data.category,
    project_type: data.project_type || null,
    industry: data.industry || null,
    country: data.country || null,
    project_stage: data.project_stage || null,
    description: data.description,
    deliverables: data.deliverables || [],
    // NOT NULL columns: store empty strings rather than invented placeholder values
    timeline: data.timeline || '',
    team_structure: data.team_structure || '',
    budget: data.budget || '',
    funding_goal: data.funding_goal || null,
    mentor_needed: data.mentor_needed ? 1 : 0,
    required_skills: data.required_skills || [],
    project_logo_url: data.project_logo_url || null,
    cover_image_url: coverUrl,
    pitch_video_url: data.pitch_video_url || null,
    deck_url: deckUrl,
    target_audience: data.target_audience || null,
    competitive_advantage: data.competitive_advantage || null,
    blockchains: data.blockchains || null,
    github_link: data.github_link || null,
    twitter_link: data.twitter_link || null,
    discord_link: data.discord_link || null,
    extra_details: data.extra_details || {},
    status: 1, // PTGR listings go live without the moderation queue
    updated_at: new Date(),
  };

  if (DRY_RUN) {
    log(`  Would ${existing ? 'update' : 'insert'} project_pool row (status=1, deck_url=${deckUrl})`);
    return;
  }
  const row = existing
    ? await prisma.projectPool.update({ where: { id: existing.id }, data: record })
    : await prisma.projectPool.create({
      data: { ...record, creator_id: ownerId, funding_raised: '0' },
    });
  log(`  Saved project_pool #${row.id}`);
}

async function main() {
  const slugs = fs.readdirSync(SEED_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && (!ONLY || d.name === ONLY))
    .map(d => d.name);
  if (slugs.length === 0) throw new Error(`No project folders found in ${SEED_DIR}${ONLY ? ` matching ${ONLY}` : ''}`);

  const ownerId = await ensureOwner();
  for (const slug of slugs) {
    await seedProject(slug, ownerId);
  }
}

main()
  .catch(err => {
    console.error('[seed] Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
