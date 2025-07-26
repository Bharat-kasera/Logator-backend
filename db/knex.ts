import dotenv from "dotenv";
import knex from "knex";

dotenv.config();
console.log("DATABASE_URL:", process.env.DATABASE_URL);

const db = knex({
  client: "pg",
  connection: process.env.DATABASE_URL!,
});

export default db;
