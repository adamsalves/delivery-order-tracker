package dev.adamsalves.ordertracker.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Gives every request a name of its own, so that the lines written while it was served can be found
 * together and a caller reporting a failure has something to quote. It travels two ways: into the
 * MDC, where the log pattern picks it up, and back to the caller as a response header.
 *
 * <p>Ordered ahead of everything else so that it wraps the security chain instead of sitting behind
 * it. The refusals a bearer API gives most often are written inside that chain, and an id covering
 * only what got past authentication would be missing from exactly the responses worth tracing.
 *
 * <p>The id is minted here rather than read off an incoming header. Nothing stands in front of this
 * API to inherit one from, and a header the caller writes is caller-controlled text going into
 * lines that whoever reads them takes for the system's own account of itself.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class RequestIdFilter extends OncePerRequestFilter {

    static final String HEADER = "X-Request-Id";
    static final String MDC_KEY = "requestId";

    private static final Logger log = LoggerFactory.getLogger(RequestIdFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String requestId = UUID.randomUUID().toString();
        MDC.put(MDC_KEY, requestId);
        response.setHeader(HEADER, requestId);

        try {
            chain.doFilter(request, response);
        } catch (Exception failure) {
            // The container logs this one as well, and later: by then the request has left this
            // filter and the id is gone from the MDC, so its stack trace names no request. Logging
            // it here, on the way out, is what puts the failure and the request in the same line.
            log.error("{} {} failed", request.getMethod(), request.getRequestURI(), failure);
            throw failure;
        } finally {
            MDC.remove(MDC_KEY);
        }
    }
}
