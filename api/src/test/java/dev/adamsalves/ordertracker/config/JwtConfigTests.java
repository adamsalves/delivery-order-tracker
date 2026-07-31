package dev.adamsalves.ordertracker.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;

/**
 * The signing key is checked while the context is being built, so that a secret the API cannot sign
 * with stops the application from starting instead of breaking the first login.
 */
class JwtConfigTests {

    private static final String LONG_ENOUGH_SECRET = "a-test-secret-that-is-long-enough-for-hs256";

    private final ApplicationContextRunner runner =
            new ApplicationContextRunner().withUserConfiguration(JwtConfig.class, AcceptEverything.class);

    @Test
    void refusesToStartWhenNoSecretIsConfigured() {
        runner.run(context ->
                assertThat(context).hasFailed().getFailure().hasMessageContaining("app.jwt.secret is not set"));
    }

    @Test
    void refusesToStartWhenTheSecretIsBlank() {
        runner.withPropertyValues("app.jwt.secret=")
                .run(context ->
                        assertThat(context).hasFailed().getFailure().hasMessageContaining("app.jwt.secret is not set"));
    }

    @Test
    void refusesToStartWhenTheSecretIsTooShortForHs256() {
        runner.withPropertyValues("app.jwt.secret=too-short")
                .run(context -> assertThat(context).hasFailed().getFailure().hasMessageContaining("at least 32 bytes"));
    }

    @Test
    void buildsTheEncoderAndDecoderForALongEnoughSecret() {
        runner.withPropertyValues("app.jwt.secret=" + LONG_ENOUGH_SECRET)
                .run(context -> assertThat(context)
                        .hasNotFailed()
                        .hasSingleBean(JwtEncoder.class)
                        .hasSingleBean(JwtDecoder.class));
    }

    /**
     * The decoder collects every OAuth2TokenValidator in the context, and collection injection needs
     * at least one candidate.
     */
    @Configuration
    static class AcceptEverything {

        @Bean
        OAuth2TokenValidator<Jwt> permissiveValidator() {
            return token -> OAuth2TokenValidatorResult.success();
        }
    }
}
