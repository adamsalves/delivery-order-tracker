import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/*
 * Testing Library registers this itself when the runner exposes its hooks globally. This suite does
 * not, so it is registered by hand: without it every render stays in the document and the next
 * test's query finds two of whatever it was looking for.
 */
afterEach(cleanup);
