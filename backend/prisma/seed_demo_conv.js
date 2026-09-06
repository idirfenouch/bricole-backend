const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createDemoConversation() {
  const amina = await prisma.user.findUnique({ where: { email: 'amina.d@demo.dz' } });
  const karim = await prisma.user.findUnique({ where: { email: 'karim.b@demo.dz' } });
  const category = await prisma.category.findFirst({ where: { name: 'Plomberie' } });

  if (!amina || !karim || !category) {
    console.log('Missing demo accounts');
    return;
  }

  let req = await prisma.request.findFirst({ where: { userId: amina.id } });
  if (!req) {
    req = await prisma.request.create({
      data: {
        userId: amina.id,
        categoryId: category.id,
        typeBesoin: "Réparer une fuite d'eau sous évier",
        description: "Bonjour, j'ai une fuite persistante sous l'évier de ma cuisine depuis hier.",
        ville: "Blida",
        budget: "Entre 5 000 et 20 000 DA",
        urgence: "Dès que possible",
        status: "interesses"
      }
    });
  }

  let prop = await prisma.proposal.findFirst({ where: { requestId: req.id, professionalId: karim.id } });
  if (!prop) {
    prop = await prisma.proposal.create({
      data: {
        requestId: req.id,
        professionalId: karim.id,
        message: "Bonjour Amina, je suis plombier qualifié à Blida et disponible aujourd'hui."
      }
    });
  }

  let conv = await prisma.conversation.findUnique({
    where: { requestId_professionalId: { requestId: req.id, professionalId: karim.id } }
  });
  if (!conv) {
    conv = await prisma.conversation.create({
      data: {
        requestId: req.id,
        particulierId: amina.id,
        professionalId: karim.id
      }
    });
  }

  const msgCount = await prisma.message.count({ where: { conversationId: conv.id } });
  if (msgCount === 0) {
    await prisma.message.create({
      data: {
        conversationId: conv.id,
        senderId: karim.id,
        content: "Bonjour Madame, je peux passer vers 14h pour inspecter la tuyauterie sous votre évier."
      }
    });
    await prisma.message.create({
      data: {
        conversationId: conv.id,
        senderId: amina.id,
        content: "Parfait Karim, 14h me convient très bien ! Merci beaucoup."
      }
    });
  }

  console.log('Demo conversation created successfully! ID:', conv.id);
}

createDemoConversation()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });
