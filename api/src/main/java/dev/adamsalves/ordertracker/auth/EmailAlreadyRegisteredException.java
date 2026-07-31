package dev.adamsalves.ordertracker.auth;

public class EmailAlreadyRegisteredException extends RuntimeException {

    private static final String MESSAGE = "Email already registered";

    public EmailAlreadyRegisteredException() {
        super(MESSAGE);
    }

    public EmailAlreadyRegisteredException(Throwable cause) {
        super(MESSAGE, cause);
    }
}
