package dev.adamsalves.ordertracker.config;

import jakarta.servlet.DispatcherType;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
class SecurityConfig {

    /**
     * Everything the API serves is behind a bearer token. The openings are named one by one rather
     * than as a prefix so that an endpoint added under /api/auth later is protected by default:
     * logout, for one, only means anything when it can tell which token to revoke.
     *
     * <p>The ERROR dispatch is let through because an exception the container has to render takes a
     * second trip through the chain, and authorising it again turns every unhandled failure into an
     * empty 401. Only the container reaches /error that way: a client asking for it directly
     * arrives on a REQUEST dispatch and still has to authenticate.
     *
     * <p>The documentation is readable without a token because the page that describes how to
     * obtain one cannot itself require one. It states the shape of the API, not its contents.
     *
     * <p>The refusals are routed through a handler of our own so that they arrive as problem
     * details like every other failure. Naming it on the resource server is enough: the configurer
     * installs it as the entry point for the whole chain, so requests that never presented a token
     * are answered by it too.
     */
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, ProblemDetailAuthenticationHandler problemDetails)
            throws Exception {
        return http.csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(requests -> requests.dispatcherTypeMatchers(DispatcherType.ERROR)
                        .permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login")
                        .permitAll()
                        .requestMatchers(HttpMethod.GET, "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html")
                        .permitAll()
                        .anyRequest()
                        .authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults())
                        .authenticationEntryPoint(problemDetails)
                        .accessDeniedHandler(problemDetails))
                .build();
    }

    /**
     * Declared as a source consumed by the filter chain rather than through addCorsMappings, which
     * sits outside the chain and would let the browser preflight be rejected before the real
     * request is ever attempted. Credentials stay off because the token travels in a header.
     */
    @Bean
    CorsConfigurationSource corsConfigurationSource(@Value("${app.cors.allowed-origins}") List<String> allowedOrigins) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(allowedOrigins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
