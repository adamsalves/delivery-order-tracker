package dev.adamsalves.ordertracker.auth;

public class PasswordTooLongException extends RuntimeException {

    public PasswordTooLongException(int maxBytes) {
        super("Password must be at most %d bytes long".formatted(maxBytes));
    }
}
