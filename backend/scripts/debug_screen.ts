
import { PrismaClient } from '@prisma/client';
import { getScreenContent } from '../src/services/screenService';

const prisma = new PrismaClient();

async function main() {
  try {
    const screens = await prisma.screen.findMany();
    console.log(`Found ${screens.length} screens`);

    for (const screen of screens) {
      console.log(`Checking screen: ${screen.name} (${screen.id})`);
      try {
        const content = await getScreenContent(screen.id);
        console.log('Content retrieved successfully');
        console.log('Playlist:', content.playlist ? content.playlist.id : 'None');
        console.log('Config Traffic:', content.config?.traffic);
      } catch (err) {
        console.error('Error retrieving content:', err);
      }
    }
  } catch (e) {
    console.error('Main error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
