package dev.adamsalves.ordertracker.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * The two text fields stop at the length their column already declares: a {@code @Column} with no
 * length is 255, and SQLite does not enforce the one it was given, so until now nothing stood
 * between a 5000-character name and the table. The number is the same 255 the order request bounds
 * its own text with.
 */
public record RegisterRequest(
        @NotBlank @Size(max = 255) String name,
        @NotBlank @Email @Size(max = 255) String email,

        /*
         * The ceiling is written out rather than left open because a bare min renders as "size must
         * be between 8 and 2147483647", which is what a caller reading the API directly is told.
         * Naming the max is the whole of that fix: the stock message reads both ends of the range,
         * so it now says "between 8 and 72" on its own and needs no wording of ours.
         *
         * It is not the ceiling that matters, though. BCrypt measures 72 bytes and this counts
         * characters, so 72 accented ones pass here and are turned away in AuthService, which stays
         * the one place that answers for what the encoder will take. Since a character is never
         * less than a byte, nothing this refuses would have been hashable anyway — which is also
         * why the message must not promise bytes: it would be describing a unit it never counted,
         * and it is read by whoever undershot the floor just as much as by whoever overshot.
         */
        @NotBlank @Size(min = 8, max = 72) String password) {}
