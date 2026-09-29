import { defineSecret } from "firebase-functions/params";

/** Pepper de contraseñas en Secret Manager, independiente del salt propio de argon2. */
export const PEPPER_SECRET = defineSecret("LOGIN_PEPPER");
