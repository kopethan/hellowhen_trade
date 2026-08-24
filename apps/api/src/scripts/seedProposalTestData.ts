import 'dotenv/config';
import { PrismaClient, type ProposalStatus, type TradePostType } from '@prisma/client';

const prisma = new PrismaClient();

const TESTDATA_MARKER = '[PROPOSAL-TESTDATA1]';
const WRITE_CONFIRMATION = 'I_UNDERSTAND_NON_PRODUCTION_ONLY';
const scenarioStatuses: ProposalStatus[] = ['pending', 'pending', 'declined', 'withdrawn'];

function env(name: string) {
  return process.env[name]?.trim() ?? '';
}

function requiredEnv(name: string) {
  const value = env(name);
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function parseApplicantEmails() {
  const raw = requiredEnv('PROPOSAL_TESTDATA_APPLICANT_EMAILS');
  const emails = Array.from(new Set(raw.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean)));
  if (!emails.length) throw new Error('PROPOSAL_TESTDATA_APPLICANT_EMAILS must contain at least one email.');
  return emails;
}

function databaseHost() {
  const databaseUrl = requiredEnv('DATABASE_URL');
  try {
    return new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.');
  }
}

function isObviouslyLocalDatabase(host: string) {
  return ['localhost', '127.0.0.1', '::1', 'postgres', 'db', 'database', 'host.docker.internal'].includes(host);
}

function assertDatabaseSafety(writeRequested: boolean) {
  if (env('NODE_ENV').toLowerCase() === 'production') {
    throw new Error('Proposal test-data generation is disabled when NODE_ENV=production.');
  }

  const host = databaseHost();
  if (!isObviouslyLocalDatabase(host) && env('PROPOSAL_TESTDATA_ALLOW_REMOTE_NONPROD') !== 'true') {
    throw new Error(
      `Refusing to use remote database host "${host}". `
      + 'If this is definitely a non-production test database, set PROPOSAL_TESTDATA_ALLOW_REMOTE_NONPROD=true.',
    );
  }

  if (writeRequested && env('PROPOSAL_TESTDATA_CONFIRM') !== WRITE_CONFIRMATION) {
    throw new Error(
      `Writes require PROPOSAL_TESTDATA_CONFIRM=${WRITE_CONFIRMATION}. `
      + 'Run without --write first to preview the selected records.',
    );
  }

  return host;
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000);
}

function proposalMessageFor(index: number, applicantName: string) {
  if (index === 0) return `${TESTDATA_MARKER} Hi! I can help with this. I would like to discuss the details and timing.`;
  if (index === 1) return `${TESTDATA_MARKER} I am interested too. I can adapt the exchange to the schedule in the Trade.`;
  if (index === 2) return `${TESTDATA_MARKER} Test proposal used to verify the declined state in the mobile UI.`;
  return `${TESTDATA_MARKER} Test proposal used to verify the withdrawn state in the mobile UI.`;
}

function threadBodies(applicantName: string, index: number) {
  if (index === 0) {
    return [
      `${TESTDATA_MARKER} Hi! I can help with this. I would like to discuss the details and timing.`,
      `${TESTDATA_MARKER} Thanks ${applicantName}. What timing would work for you?`,
      `${TESTDATA_MARKER} I can start this week and send a first update within two days.`,
      `${TESTDATA_MARKER} That works. Is there anything you need from me before you start?`,
      `${TESTDATA_MARKER} A short brief and one example would be enough.`,
      `${TESTDATA_MARKER} Great, I can prepare those today.`,
      `${TESTDATA_MARKER} Perfect. I will review them as soon as they arrive.`,
      `${TESTDATA_MARKER} I have one more question about the preferred format.`,
      `${TESTDATA_MARKER} Use the format mentioned in the Trade description.`,
      `${TESTDATA_MARKER} Got it. Thanks — ready when you are.`,
    ];
  }

  if (index === 1) {
    return [
      `${TESTDATA_MARKER} I am interested too. I can adapt the exchange to the schedule in the Trade.`,
      `${TESTDATA_MARKER} Thanks. Can you share a little more about how you would approach it?`,
      `${TESTDATA_MARKER} Yes. I would keep it simple and send progress updates in this thread.`,
    ];
  }

  return [proposalMessageFor(index, applicantName)];
}

function senderForMessage(messageIndex: number, applicantId: string, ownerId: string) {
  return messageIndex % 2 === 0 ? applicantId : ownerId;
}

async function suggestedInventory(applicantId: string, postType: TradePostType) {
  const [need, offer] = await Promise.all([
    postType === 'open_need'
      ? Promise.resolve(null)
      : prisma.need.findFirst({ where: { ownerId: applicantId, businessProfileId: null, status: 'active' }, orderBy: { updatedAt: 'desc' }, select: { id: true, title: true } }),
    postType === 'open_offer'
      ? Promise.resolve(null)
      : prisma.offer.findFirst({ where: { ownerId: applicantId, businessProfileId: null, status: 'active' }, orderBy: { updatedAt: 'desc' }, select: { id: true, title: true } }),
  ]);

  return {
    proposedNeedId: need?.id ?? null,
    proposedNeedTitle: need?.title ?? null,
    proposedOfferId: offer?.id ?? null,
    proposedOfferTitle: offer?.title ?? null,
  };
}

async function cleanTestData(writeRequested: boolean) {
  const proposals = await prisma.tradeProposal.findMany({
    where: { message: { startsWith: TESTDATA_MARKER } },
    select: { id: true, tradeId: true, applicantId: true, status: true },
  });

  console.log(`Found ${proposals.length} ${TESTDATA_MARKER} proposal(s).`);
  if (!writeRequested) {
    console.log('Dry run only. Re-run with --clean --write to delete them.');
    return;
  }

  if (proposals.length) {
    await prisma.tradeProposal.deleteMany({ where: { id: { in: proposals.map((proposal) => proposal.id) } } });
  }
  console.log(`Deleted ${proposals.length} proposal test record(s) and their cascading child rows.`);
}

async function seedTestData(writeRequested: boolean) {
  const ownerEmail = requiredEnv('PROPOSAL_TESTDATA_OWNER_EMAIL').toLowerCase();
  const applicantEmails = parseApplicantEmails();
  if (applicantEmails.includes(ownerEmail)) throw new Error('The Trade owner cannot also be a proposal applicant.');

  const owner = await prisma.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true, email: true, profile: { select: { displayName: true, handle: true } } },
  });
  if (!owner) throw new Error(`No user found for PROPOSAL_TESTDATA_OWNER_EMAIL=${ownerEmail}.`);

  const explicitTradeId = env('PROPOSAL_TESTDATA_TRADE_ID');
  const trade = explicitTradeId
    ? await prisma.trade.findFirst({ where: { id: explicitTradeId, ownerId: owner.id }, select: { id: true, title: true, status: true, isPublic: true, postType: true } })
    : await prisma.trade.findFirst({ where: { ownerId: owner.id, status: 'active', isPublic: true }, orderBy: { updatedAt: 'desc' }, select: { id: true, title: true, status: true, isPublic: true, postType: true } });

  if (!trade) {
    throw new Error(explicitTradeId
      ? `Trade ${explicitTradeId} was not found for owner ${ownerEmail}.`
      : `No active public Trade was found for ${ownerEmail}. Set PROPOSAL_TESTDATA_TRADE_ID to choose one explicitly.`);
  }
  if (trade.status !== 'active' || !trade.isPublic) {
    throw new Error(`Trade ${trade.id} must be active and public to represent a realistic proposal target.`);
  }

  const applicants = await prisma.user.findMany({
    where: { email: { in: applicantEmails } },
    select: { id: true, email: true, profile: { select: { displayName: true, handle: true } } },
  });
  const applicantByEmail = new Map(applicants.map((applicant) => [applicant.email.toLowerCase(), applicant]));
  const missingApplicants = applicantEmails.filter((email) => !applicantByEmail.has(email));
  if (missingApplicants.length) throw new Error(`Applicant user(s) not found: ${missingApplicants.join(', ')}`);

  const orderedApplicants = applicantEmails.map((email) => applicantByEmail.get(email)!);
  const prepared = [];

  for (let index = 0; index < orderedApplicants.length; index += 1) {
    const applicant = orderedApplicants[index]!;
    const status = scenarioStatuses[index % scenarioStatuses.length]!;
    const existing = await prisma.tradeProposal.findMany({
      where: { tradeId: trade.id, applicantId: applicant.id },
      select: { id: true, status: true, message: true },
      orderBy: { createdAt: 'desc' },
    });
    const testProposal = existing.find((proposal) => proposal.message.startsWith(TESTDATA_MARKER));
    const conflictingActiveProposal = existing.find((proposal) => !proposal.message.startsWith(TESTDATA_MARKER) && (proposal.status === 'pending' || proposal.status === 'accepted'));
    if (conflictingActiveProposal) {
      throw new Error(
        `${applicant.email} already has a real ${conflictingActiveProposal.status} proposal for Trade ${trade.id}. `
        + 'Use another applicant or another Trade rather than creating an impossible duplicate active proposal.',
      );
    }

    const inventory = await suggestedInventory(applicant.id, trade.postType);
    prepared.push({ applicant, status, testProposal, inventory, index });
  }

  console.log('Proposal test-data target:');
  console.log(`  Owner: ${owner.email}`);
  console.log(`  Trade: ${trade.id} · ${trade.title} · ${trade.postType}`);
  for (const item of prepared) {
    console.log(`  Applicant: ${item.applicant.email} -> ${item.status}${item.testProposal ? ' (update existing test proposal)' : ' (create)'}`);
    if (item.inventory.proposedNeedTitle) console.log(`    Need: ${item.inventory.proposedNeedTitle}`);
    if (item.inventory.proposedOfferTitle) console.log(`    Offer: ${item.inventory.proposedOfferTitle}`);
  }

  if (!writeRequested) {
    console.log('Dry run only. Re-run with --write after checking the owner, applicants, Trade, and database host.');
    return;
  }

  const results = [];
  for (const item of prepared) {
    const applicantName = item.applicant.profile?.displayName || item.applicant.profile?.handle || item.applicant.email;
    const createdAt = minutesAgo(240 - item.index * 45);
    const respondedAt = item.status === 'declined' ? minutesAgo(180 - item.index * 30) : null;
    const message = proposalMessageFor(item.index, applicantName);

    const proposal = item.testProposal
      ? await prisma.tradeProposal.update({
          where: { id: item.testProposal.id },
          data: {
            message,
            status: item.status,
            proposedNeedId: item.inventory.proposedNeedId,
            proposedOfferId: item.inventory.proposedOfferId,
            packageKind: 'standard',
            createdAt,
            respondedAt,
          },
        })
      : await prisma.tradeProposal.create({
          data: {
            tradeId: trade.id,
            applicantId: item.applicant.id,
            message,
            status: item.status,
            proposedNeedId: item.inventory.proposedNeedId,
            proposedOfferId: item.inventory.proposedOfferId,
            packageKind: 'standard',
            createdAt,
            respondedAt,
          },
        });

    await prisma.proposalMessage.deleteMany({ where: { proposalId: proposal.id } });
    const bodies = threadBodies(applicantName, item.index);
    await prisma.proposalMessage.createMany({
      data: bodies.map((body, messageIndex) => ({
        proposalId: proposal.id,
        senderId: senderForMessage(messageIndex, item.applicant.id, owner.id),
        body,
        createdAt: new Date(createdAt.getTime() + messageIndex * 7 * 60_000),
      })),
    });

    results.push({ proposalId: proposal.id, applicant: item.applicant.email, status: item.status, messages: bodies.length });
  }

  console.log(`Created/updated ${results.length} proposal test scenario(s):`);
  for (const result of results) {
    console.log(`  ${result.status.padEnd(9)} ${result.applicant} · ${result.messages} message(s) · ${result.proposalId}`);
  }
  console.log('No accepted proposals, notifications, accepted-deal snapshots, cash promises, or Trade status transitions were fabricated.');
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const clean = args.has('--clean');
  const writeRequested = args.has('--write');
  const host = assertDatabaseSafety(writeRequested);
  console.log(`Database host: ${host}`);
  console.log(writeRequested ? 'Mode: WRITE' : 'Mode: DRY RUN');

  if (clean) await cleanTestData(writeRequested);
  else await seedTestData(writeRequested);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
