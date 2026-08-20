/**
 * Removes data left behind by automated tests.
 *
 * Browser scripts and `verify-all.js` create accounts, projects, posts and
 * leads on every run. Over time these pile up and start to distort the app:
 * the public blog fills with "Sinov maqola", counts that tests assert on
 * drift, and storage keeps growing.
 *
 * Dry run by default — nothing is deleted until `--apply` is passed.
 *
 *   npx ts-node -r tsconfig-paths/register scripts/clean-test-data.ts
 *   npx ts-node -r tsconfig-paths/register scripts/clean-test-data.ts --apply
 */

import prisma from '@/modules/db';
import { deleteObjects } from '@/modules/storage';

/**
 * Email patterns produced by the test suites.
 *
 * Everything else is treated as a real account. The rule is deliberately
 * narrow: deleting a real user cascades to their projects and cannot be
 * undone, so an unknown address is always kept.
 */
const TEST_EMAIL_PATTERNS = [
  /@archai\.test$/i,
  /^v\d{10,}@archai\.uz$/i,
  /^s\d{10,}@archai\.uz$/i,
  /^brute\d{10,}@archai\.uz$/i,
  /^t\d{10,}@archai\.uz$/i,
  /^pdf\d{10,}@archai\.uz$/i,
  /^neg-/i,
  /^dbg-/i,
];

/**
 * Project titles the suites produce.
 *
 * Matched on any account, not just the seed admin: the tests sign in as
 * whichever admin exists, and that account changes with `SEED_ADMIN_EMAIL`.
 * The dry run prints an owner breakdown so nothing is deleted blind.
 */
const TEST_PROJECT_TITLES = ['Test uy — PDF sinovi', 'Yangi nom', 'Tekshiruv loyihasi'];

const TEST_POST_PREFIXES = ['maqola-', 'qoralama-', 'sinov-markdown-', 'seo-sinov-'];
const TEST_LEAD_NAMES = ['Kod sinovi', 'Sinov ', 'Test Mijoz', 'Tekshiruv'];
const TEST_MEDIA_PREFIXES = ['media/sinov/', 'media/seo/'];

const isTestEmail = (email: string) => TEST_EMAIL_PATTERNS.some((pattern) => pattern.test(email));

interface Summary {
  users: number;
  projects: number;
  posts: number;
  categories: number;
  leads: number;
  faq: number;
  media: number;
  profiles: number;
}

const collect = async (): Promise<{ userIds: string[]; adminProjectIds: string[] }> => {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  const userIds = users.filter((user) => isTestEmail(user.email)).map((user) => user.id);

  /*
    Accounts that survive the email filter can still hold test projects: the
    suites sign in as an admin and create projects under it. Those are
    matched by title.
  */
  const titled = await prisma.project.findMany({
    where: { userId: { notIn: userIds }, title: { in: TEST_PROJECT_TITLES } },
    select: { id: true },
  });

  return { userIds, adminProjectIds: titled.map((project) => project.id) };
};

const count = async (): Promise<Summary> => {
  const { userIds, adminProjectIds } = await collect();

  const [projects, posts, categories, leads, faq, media, profiles] = await Promise.all([
    prisma.project.count({
      where: { OR: [{ userId: { in: userIds } }, { id: { in: adminProjectIds } }] },
    }),
    prisma.blogPost.count({ where: { OR: TEST_POST_PREFIXES.map((slug) => ({ slug: { startsWith: slug } })) } }),
    prisma.blogCategory.count({ where: { slug: { startsWith: 'kat-' } } }),
    prisma.lead.count({ where: { OR: TEST_LEAD_NAMES.map((name) => ({ name: { startsWith: name } })) } }),
    prisma.faqItem.count({ where: { category: 'sinov' } }),
    prisma.media.count({ where: { OR: TEST_MEDIA_PREFIXES.map((key) => ({ key: { startsWith: key } })) } }),
    prisma.priceProfile.count({ where: { userId: { in: userIds } } }),
  ]);

  return { users: userIds.length, projects, posts, categories, leads, faq, media, profiles };
};

const apply = async (): Promise<Summary> => {
  const before = await count();
  const { userIds, adminProjectIds } = await collect();

  /*
    Stored files are removed first. If the database rows go first and the
    storage call then fails, the files become unreachable orphans that
    nothing knows about any more.
  */
  const media = await prisma.media.findMany({
    where: { OR: TEST_MEDIA_PREFIXES.map((key) => ({ key: { startsWith: key } })) },
    select: { key: true },
  });

  const exports = await prisma.projectExport.findMany({
    where: { OR: [{ project: { userId: { in: userIds } } }, { projectId: { in: adminProjectIds } }] },
    select: { storageKey: true },
  });

  const keys = [...media.map((item) => item.key), ...exports.map((item) => item.storageKey)];
  if (keys.length > 0) await deleteObjects(keys);

  // Projects cascade to versions and exports; users cascade to projects.
  await prisma.project.deleteMany({ where: { id: { in: adminProjectIds } } });
  await prisma.priceProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  await prisma.blogPost.deleteMany({
    where: { OR: TEST_POST_PREFIXES.map((slug) => ({ slug: { startsWith: slug } })) },
  });
  await prisma.blogCategory.deleteMany({ where: { slug: { startsWith: 'kat-' } } });
  await prisma.lead.deleteMany({
    where: { OR: TEST_LEAD_NAMES.map((name) => ({ name: { startsWith: name } })) },
  });
  await prisma.faqItem.deleteMany({ where: { category: 'sinov' } });
  await prisma.media.deleteMany({
    where: { OR: TEST_MEDIA_PREFIXES.map((key) => ({ key: { startsWith: key } })) },
  });

  return before;
};

const main = async () => {
  const shouldApply = process.argv.includes('--apply');
  const summary = shouldApply ? await apply() : await count();

  console.info(shouldApply ? 'removed:' : 'would remove (dry run):');
  for (const [name, value] of Object.entries(summary)) {
    console.info(`  ${name}: ${value}`);
  }

  if (!shouldApply) console.info('\npass --apply to delete');

  console.info(`\nusers left: ${await prisma.user.count()}`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
