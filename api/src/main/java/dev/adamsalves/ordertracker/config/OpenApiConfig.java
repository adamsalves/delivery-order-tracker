package dev.adamsalves.ordertracker.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import org.springframework.context.annotation.Configuration;

/**
 * The bearer scheme is declared once and required everywhere, which is what puts the Authorize
 * button on the page and sends the token along with every call tried from it. The two ways in say
 * for themselves that they are exempt.
 */
@Configuration
@OpenAPIDefinition(
        info =
                @Info(
                        title = "Delivery Order Tracker",
                        version = "v1",
                        description = "Delivery orders, their status and the trail of how they got there."),
        security = @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME))
@SecurityScheme(
        name = OpenApiConfig.BEARER_SCHEME,
        type = SecuritySchemeType.HTTP,
        scheme = "bearer",
        bearerFormat = "JWT")
class OpenApiConfig {

    static final String BEARER_SCHEME = "bearerAuth";
}
