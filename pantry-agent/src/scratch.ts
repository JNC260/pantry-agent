import "dotenv/config";
import { getPantryItems } from "./lib/pantry-db";

async function main() {
  const items = await getPantryItems();
  console.log("Pantry items:", items);
}

main();
