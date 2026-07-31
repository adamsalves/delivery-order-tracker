package dev.adamsalves.ordertracker.config;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.stream.Collectors;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
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

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {

        ProblemDetail body = createProblemDetail(ex, status, "Request validation failed", null, null, request);
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

    private String describe(HttpMessageNotReadableException ex) {
        if (ex.getCause() instanceof InvalidFormatException invalid
                && invalid.getTargetType() != null
                && invalid.getTargetType().isEnum()) {
            return "%s is not a valid %s, accepted values are %s"
                    .formatted(
                            invalid.getValue(),
                            invalid.getTargetType().getSimpleName(),
                            Arrays.toString(invalid.getTargetType().getEnumConstants()));
        }

        return UNREADABLE_BODY;
    }
}
