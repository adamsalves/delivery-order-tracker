package dev.adamsalves.ordertracker.config;

import dev.adamsalves.ordertracker.auth.EmailAlreadyRegisteredException;
import dev.adamsalves.ordertracker.auth.InvalidCredentialsException;
import dev.adamsalves.ordertracker.auth.PasswordTooLongException;
import dev.adamsalves.ordertracker.order.InvalidStatusTransitionException;
import dev.adamsalves.ordertracker.order.OrderNotFoundException;
import dev.adamsalves.ordertracker.order.UnsupportedSortPropertyException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.stream.Collectors;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import tools.jackson.databind.exc.InvalidFormatException;

/**
 * Every failure the API answers with leaves through here, as an RFC 9457 problem detail.
 *
 * <p>Extending ResponseEntityExceptionHandler is what turns the framework's own exceptions into
 * that shape, and registering it withdraws Boot's equivalent handler, which stands down on
 * ConditionalOnMissingBean of this very type. Exceptions that already carry a status of their own
 * keep it: the base class handles anything implementing ErrorResponse.
 */
@RestControllerAdvice
class ApiExceptionHandler extends ResponseEntityExceptionHandler {

    private static final String UNREADABLE_BODY = "Failed to read request";
    private static final String VALIDATION_FAILED = "Request validation failed";
    private static final int MAX_ECHOED_LENGTH = 50;

    @ExceptionHandler(OrderNotFoundException.class)
    ProblemDetail handleOrderNotFound(OrderNotFoundException ex) {
        return problem(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(InvalidStatusTransitionException.class)
    ProblemDetail handleInvalidStatusTransition(InvalidStatusTransitionException ex) {
        return problem(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(EmailAlreadyRegisteredException.class)
    ProblemDetail handleEmailAlreadyRegistered(EmailAlreadyRegisteredException ex) {
        return problem(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    ProblemDetail handleInvalidCredentials(InvalidCredentialsException ex) {
        return problem(HttpStatus.UNAUTHORIZED, ex.getMessage());
    }

    /**
     * The one bound checked in a service rather than by an annotation, because it counts bytes and
     * @Size counts characters. That is a reason to raise it elsewhere, not a reason to answer it
     * differently: it is still a field of the request being refused, so it leaves naming that field
     * in {@code errors}, the way every other refused field does. Answered only in {@code detail}, it
     * was the one refusal a caller had to read a second way to find out which field it was about.
     */
    @ExceptionHandler(PasswordTooLongException.class)
    ProblemDetail handlePasswordTooLong(PasswordTooLongException ex) {
        ProblemDetail body = problem(HttpStatus.BAD_REQUEST, VALIDATION_FAILED);
        body.setProperty("errors", Map.of("password", List.of(ex.getMessage())));

        return body;
    }

    @ExceptionHandler(UnsupportedSortPropertyException.class)
    ProblemDetail handleUnsupportedSortProperty(UnsupportedSortPropertyException ex) {
        return problem(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {

        ProblemDetail body = createProblemDetail(ex, status, VALIDATION_FAILED, null, null, request);
        body.setProperty("errors", violationsByField(ex));

        return handleExceptionInternal(ex, body, headers, status, request);
    }

    /**
     * The status is already the 400 the base class assigns; what is added is the reason. A body
     * naming a status that does not exist would otherwise come back as "failed to read request",
     * which does not tell the caller which of the two words was the wrong one.
     */
    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(
            HttpMessageNotReadableException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {

        ProblemDetail body = createProblemDetail(ex, status, describe(ex), null, null, request);

        return handleExceptionInternal(ex, body, headers, status, request);
    }

    /**
     * Collected into lists because one field can break more than one rule at a time — a blank name
     * longer than the ceiling reports both — and a map keyed by field would lose all but one.
     */
    private Map<String, List<String>> violationsByField(MethodArgumentNotValidException ex) {
        return ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.groupingBy(
                        FieldError::getField,
                        TreeMap::new,
                        Collectors.mapping(
                                error -> Objects.requireNonNullElse(error.getDefaultMessage(), "is invalid"),
                                Collectors.toList())));
    }

    private ProblemDetail problem(HttpStatus status, String detail) {
        return ProblemDetail.forStatusAndDetail(status, detail);
    }

    private String describe(HttpMessageNotReadableException ex) {
        if (ex.getCause() instanceof InvalidFormatException invalid
                && invalid.getTargetType() != null
                && invalid.getTargetType().isEnum()) {
            return "%s is not a valid %s, accepted values are %s"
                    .formatted(
                            abbreviate(invalid.getValue()),
                            invalid.getTargetType().getSimpleName(),
                            Arrays.toString(invalid.getTargetType().getEnumConstants()));
        }

        return UNREADABLE_BODY;
    }

    /**
     * What came in is quoted back so the caller can see what was read, but only as much of it as
     * identifies the value: the rest is the caller's own bytes, and a body of any size would
     * otherwise decide the size of the answer.
     */
    private String abbreviate(Object value) {
        String rejected = String.valueOf(value);

        return rejected.length() <= MAX_ECHOED_LENGTH ? rejected : rejected.substring(0, MAX_ECHOED_LENGTH) + "…";
    }
}
