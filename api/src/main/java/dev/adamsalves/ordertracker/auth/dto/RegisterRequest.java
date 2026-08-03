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
        @NotBlank @Size(min = 8) String password) {}
