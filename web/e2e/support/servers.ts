/**
 * The pair of ports the suite runs on, named once. `playwright.config.ts` starts the two servers on
 * them and the specs that speak to the API directly address it here, so the two cannot drift apart.
 *
 * <p>Not the 8080/5173 the README documents, and deliberately so: the development stack keeps those
 * and `api/data/app.db` is never opened by a test run.
 */
export const API_URL = "http://localhost:8081";

export const WEB_URL = "http://localhost:4173";
