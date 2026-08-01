package dev.adamsalves.ordertracker.config;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationEntryPoint;
import org.springframework.security.oauth2.server.resource.web.access.BearerTokenAccessDeniedHandler;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * A token that is missing or rejected is turned away in the filter chain, before the dispatcher
 * servlet, so the advice that shapes every other failure never sees it. Left alone, the two
 * commonest refusals of a bearer API answer with an empty body while everything else answers RFC
 * 9457.
 *
 * <p>The stock handlers still run first, for the WWW-Authenticate header they set: that header is
 * what names the scheme and, when a token was supplied and turned down, why. Only the body is added
 * here, and it deliberately says no more than the status already does — whether the token was
 * absent, expired or revoked is the header's business, and spelling it out in the body would help
 * an attacker sort valid tokens from invalid ones.
 */
@Component
class ProblemDetailAuthenticationHandler implements AuthenticationEntryPoint, AccessDeniedHandler {

    private static final String UNAUTHENTICATED = "A valid bearer token is required to access this resource";
    private static final String FORBIDDEN = "The token presented does not grant access to this resource";

    private final AuthenticationEntryPoint unauthenticated = new BearerTokenAuthenticationEntryPoint();
    private final AccessDeniedHandler forbidden = new BearerTokenAccessDeniedHandler();
    private final ObjectMapper objectMapper;

    ProblemDetailAuthenticationHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException failure)
            throws IOException, ServletException {
        unauthenticated.commence(request, response, failure);
        writeProblem(request, response, UNAUTHENTICATED);
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException failure)
            throws IOException, ServletException {
        forbidden.handle(request, response, failure);
        writeProblem(request, response, FORBIDDEN);
    }

    /**
     * The status is read back off the response rather than assumed, because the delegate is what
     * decided it, and a body disagreeing with the status line would be worse than no body at all.
     */
    private void writeProblem(HttpServletRequest request, HttpServletResponse response, String detail)
            throws IOException {
        if (response.isCommitted()) {
            return;
        }

        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.valueOf(response.getStatus()), detail);
        body.setInstance(URI.create(request.getRequestURI()));

        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getWriter(), body);
    }
}
