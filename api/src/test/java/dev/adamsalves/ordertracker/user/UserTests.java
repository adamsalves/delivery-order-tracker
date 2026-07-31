package dev.adamsalves.ordertracker.user;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Locale;
import org.junit.jupiter.api.Test;

class UserTests {

    @Test
    void normalizesAwayCasingAndSurroundingSpace() {
        assertThat(User.normalizeEmail("  Adams@Example.COM  ")).isEqualTo("adams@example.com");
    }

    /**
     * Turkish lowercases I to a dotless i. If normalisation followed the JVM default locale, the
     * same mailbox would be filed under two different accounts depending on how it was typed.
     */
    @Test
    void normalizesTheSameWayUnderAnyDefaultLocale() {
        Locale original = Locale.getDefault();
        Locale.setDefault(Locale.forLanguageTag("tr"));

        try {
            assertThat(User.normalizeEmail("IHOR@EXAMPLE.COM")).isEqualTo("ihor@example.com");
        } finally {
            Locale.setDefault(original);
        }
    }
}
