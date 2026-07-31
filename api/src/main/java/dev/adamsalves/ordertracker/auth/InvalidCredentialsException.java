package dev.adamsalves.ordertracker.auth;

/**
 * Says only that the pair did not check out. Which half was wrong is withheld on purpose: telling
 * the two apart would turn the login into a way of asking which addresses have accounts.
 */
public class InvalidCredentialsException extends RuntimeException {

    public InvalidCredentialsException() {
        super("Invalid email or password");
    }
}
