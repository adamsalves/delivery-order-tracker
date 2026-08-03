/**
 * What the API refuses, restated on this side so a form can say it before spending a request on
 * finding out. Every number here is a mirror and not a decision: the decision is the annotation on
 * the DTO, and a copy that drifts from it is worse than no copy, because it refuses what the server
 * would have taken.
 *
 * <p>They live together because the same ceiling is read from two screens. Held one per screen, the
 * register form and the order form each carried their own 255 and their own sentence for it, and
 * nothing but proximity kept the two agreeing.
 */

/** Mirrors @Size(max = 255), itself the width a @Column with no length declares. */
export const MAX_TEXT_LENGTH = 255;

/** Mirrors @Size(max = 100) on the items list. */
export const MAX_ITEMS = 100;

/** Mirrors the floor of @Size(min = 8) on the password. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * BCrypt's own ceiling, which AuthService enforces. Counted in bytes, so an accent costs two — the
 * annotation on the DTO counts characters and cannot be the one that answers for this.
 */
export const MAX_PASSWORD_BYTES = 72;

/** One sentence for one ceiling, so the two screens cannot word it differently. */
export function tooLong(): string {
  return `No máximo ${MAX_TEXT_LENGTH} caracteres.`;
}
