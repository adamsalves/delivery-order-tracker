package dev.adamsalves.ordertracker.auth;

/**
 * Worded without a subject because it is read as the message under a field: the response names
 * "password" as the key it sits behind, and a sentence repeating it would be read twice.
 */
public class PasswordTooLongException extends RuntimeException {

    public PasswordTooLongException(int maxBytes) {
        super("must be at most %d bytes long".formatted(maxBytes));
    }
}
