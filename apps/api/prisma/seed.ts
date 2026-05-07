import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const passwordHashPromise = bcrypt.hash('password123', 12);
type DemoUserInput = { email: string; displayName: string; handle: string; bio: string; credits: number; role?: 'user' | 'admin' };
async function upsertDemoUser(input: DemoUserInput) {
  const passwordHash = await passwordHashPromise;
  const user = await prisma.user.upsert({ where: { email: input.email }, update: { passwordHash, role: input.role ?? 'user' }, create: { email: input.email, passwordHash, role: input.role ?? 'user', emailVerifiedAt: new Date(), profile: { create: { displayName: input.displayName, handle: input.handle, bio: input.bio } }, settings: { create: {} }, wallet: { create: { purchasedAvailableCredits: input.credits } }, identities: { create: { provider: 'email', providerUserId: input.email, email: input.email } } }, include: { profile: true, settings: true, wallet: true } });
  await prisma.userIdentity.upsert({ where: { provider_providerUserId: { provider: 'email', providerUserId: input.email } }, update: { userId: user.id, email: input.email }, create: { userId: user.id, provider: 'email', providerUserId: input.email, email: input.email } });
  await prisma.profile.upsert({ where: { userId: user.id }, update: { displayName: input.displayName, handle: input.handle, bio: input.bio }, create: { userId: user.id, displayName: input.displayName, handle: input.handle, bio: input.bio } });
  await prisma.userSettings.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
  const wallet = await prisma.wallet.upsert({ where: { userId: user.id }, update: { purchasedAvailableCredits: input.credits }, create: { userId: user.id, purchasedAvailableCredits: input.credits } });
  const existingGrant = await prisma.creditLedgerEntry.findFirst({ where: { userId: user.id, walletId: wallet.id, type: 'starting_demo_credits', description: 'Starting demo credits for fake/test trades' } });
  if (!existingGrant) await prisma.creditLedgerEntry.create({ data: { userId: user.id, walletId: wallet.id, type: 'starting_demo_credits', balanceType: 'purchased', amount: input.credits, description: 'Starting demo credits for fake/test trades', metadata: { seed: true, fakeCreditsOnly: true, purchasedCreditsAreWithdrawable: false } } });
  return { user, wallet };
}
async function main() {
  const demo = await upsertDemoUser({ email: 'demo@hellowhen.app', displayName: 'Demo Owner', handle: 'demo', bio: 'Demo owner account for testing trade proposals and fake credits.', credits: 250 });
  const helper = await upsertDemoUser({ email: 'helper@hellowhen.app', displayName: 'Helper User', handle: 'helper', bio: 'Demo helper account for sending proposals and earning fake credits.', credits: 120 });
  const admin = await upsertDemoUser({ email: 'admin@hellowhen.app', displayName: 'Admin Reviewer', handle: 'admin', bio: 'Demo admin account for reviewing uploaded images.', credits: 50, role: 'admin' });
  const need = (await prisma.need.findFirst({ where: { ownerId: demo.user.id, title: 'Need a landing page hero review' } })) ?? await prisma.need.create({ data: { ownerId: demo.user.id, title: 'Need a landing page hero review', description: 'I need feedback on headline, CTA, and first fold for a small launch page.', status: 'active' } });
  const offer = (await prisma.offer.findFirst({ where: { ownerId: helper.user.id, title: 'Offer: quick brand naming feedback' } })) ?? await prisma.offer.create({ data: { ownerId: helper.user.id, title: 'Offer: quick brand naming feedback', description: 'I can review names and give concise positioning feedback for early product ideas.', status: 'active' } });
  const openTrade = (await prisma.trade.findFirst({ where: { ownerId: demo.user.id, title: 'Need logo concept directions', status: 'active' } })) ?? await prisma.trade.create({ data: { ownerId: demo.user.id, needId: need.id, title: 'Need logo concept directions', description: 'Looking for 3 simple visual directions for a modern trade-first app logo. Please include notes on shape, typography, and feel.', creditAmount: 35, status: 'active', isPublic: true, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) } });
  const helperTrade = (await prisma.trade.findFirst({ where: { ownerId: helper.user.id, title: 'Offer: profile bio rewrite', status: 'active' } })) ?? await prisma.trade.create({ data: { ownerId: helper.user.id, offerId: offer.id, title: 'Offer: profile bio rewrite', description: 'I can rewrite a short profile bio to make it clearer, warmer, and more trade-focused.', creditAmount: 18, status: 'active', isPublic: true, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5) } });
  const existingProposal = await prisma.tradeProposal.findUnique({ where: { tradeId_applicantId: { tradeId: openTrade.id, applicantId: helper.user.id } } });
  if (!existingProposal) { const proposal = await prisma.tradeProposal.create({ data: { tradeId: openTrade.id, applicantId: helper.user.id, message: 'I can help with 3 logo directions and explain which one fits Hellowhen best. I can deliver a first pass tomorrow.' } }); await prisma.proposalMessage.create({ data: { proposalId: proposal.id, senderId: helper.user.id, body: proposal.message } }); await prisma.proposalMessage.create({ data: { proposalId: proposal.id, senderId: demo.user.id, body: 'Great — can you keep it simple and not too corporate?' } }); }
  const existingSupportTicket = await prisma.supportTicket.findFirst({ where: { userId: demo.user.id, subject: 'Question about credits on a trade' } });
  if (!existingSupportTicket) {
    const ticket = await prisma.supportTicket.create({ data: { userId: demo.user.id, category: 'credits_issue', priority: 'normal', subject: 'Question about credits on a trade', message: 'I want to understand what happens to fake credits when I accept a proposal.', relatedTradeId: openTrade.id } });
    await prisma.supportTicketMessage.create({ data: { ticketId: ticket.id, senderId: demo.user.id, senderRole: 'user', body: ticket.message } });
    await prisma.supportTicketMessage.create({ data: { ticketId: ticket.id, senderId: admin.user.id, senderRole: 'admin', body: 'Fake credits are held when a proposal is accepted, then released to pending earned credits when the trade is completed.' } });
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: 'waiting_for_user', assignedAdminId: admin.user.id } });
  }
  console.log('Seeded Patch 9 demo accounts, media-ready trades, sample proposal flow, Stripe test credit data, and support ticket flow.'); console.log('Owner:  demo@hellowhen.app / password123'); console.log('Helper: helper@hellowhen.app / password123'); console.log('Admin:  admin@hellowhen.app / password123'); console.log(`Sample trades: ${openTrade.title}; ${helperTrade.title}`);
}
main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
