import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

const competencies = [
  {
    key: "frontend",
    name: "Frontend",
    weight: 30,
    required: true,
  },
  {
    key: "backend",
    name: "Backend",
    weight: 30,
    required: true,
  },
  {
    key: "databases",
    name: "Databases",
    weight: 25,
    required: true,
  },
  {
    key: "problem-solving",
    name: "Problem Solving",
    weight: 15,
    required: true,
  },
];

async function main() {
  for (const competency of competencies) {
    await prisma.competency.upsert({
      where: {
        key: competency.key,
      },
      update: {
        name: competency.name,
        weight: competency.weight,
        required: competency.required,
      },
      create: competency,
    });
  }

  console.log("Competencies seeded successfully");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });