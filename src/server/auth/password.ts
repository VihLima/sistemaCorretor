import bcrypt from "bcryptjs";

const ROUNDS = process.env.NODE_ENV === "test" ? 4 : 12;

export const hashPassword = (password: string) => bcrypt.hash(password, ROUNDS);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);
