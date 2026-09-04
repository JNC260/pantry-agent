import { getCachedBoards, getCachedPins } from "./lib/pinterest-cache";

async function main() {
  const boards = await getCachedBoards();
  console.log(`Total boards cached: ${boards.length}`);

  for (const b of boards) {
    const pins = await getCachedPins(b.id);
    console.log(`${b.name} (${b.id}) — ${pins.length} pins`);
  }
}

main();
