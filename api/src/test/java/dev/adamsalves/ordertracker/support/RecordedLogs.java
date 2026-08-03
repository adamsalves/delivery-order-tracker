package dev.adamsalves.ordertracker.support;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.IThrowableProxy;
import ch.qos.logback.classic.spi.ThrowableProxyUtil;
import ch.qos.logback.core.read.ListAppender;
import java.util.List;
import java.util.function.Predicate;
import org.junit.jupiter.api.extension.AfterEachCallback;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.junit.jupiter.api.extension.ParameterContext;
import org.junit.jupiter.api.extension.ParameterResolver;
import org.slf4j.LoggerFactory;

/**
 * Keeps what was written to the log while a test ran, so a case can be made about the lines the API
 * writes and — the ones worth a test here — about what those lines must never carry.
 *
 * <p>Registered with {@code @ExtendWith} and asked for as a parameter, which puts attaching and
 * detaching on the framework rather than on each class remembering both halves. What it is worth
 * comes up on the way out: an appender left on the root logger stays there for the rest of the fork,
 * collecting every line of every test that follows into a list nobody reads.
 */
public class RecordedLogs implements BeforeEachCallback, AfterEachCallback, ParameterResolver {

    private final ListAppender<ILoggingEvent> recorded = new ListAppender<>();

    @Override
    public void beforeEach(ExtensionContext context) {
        recorded.list.clear();
        recorded.start();
        root().addAppender(recorded);
    }

    @Override
    public void afterEach(ExtensionContext context) {
        root().detachAppender(recorded);
        recorded.stop();
    }

    @Override
    public boolean supportsParameter(ParameterContext parameter, ExtensionContext context) {
        return parameter.getParameter().getType() == RecordedLogs.class;
    }

    @Override
    public Object resolveParameter(ParameterContext parameter, ExtensionContext context) {
        return this;
    }

    public List<String> all() {
        return messages(event -> true);
    }

    public List<String> from(Class<?> source) {
        return messages(event -> event.getLoggerName().equals(source.getName()));
    }

    public List<String> from(Class<?> source, Level level) {
        return messages(event -> event.getLoggerName().equals(source.getName()) && event.getLevel() == level);
    }

    private List<String> messages(Predicate<ILoggingEvent> matching) {
        return recorded.list.stream().filter(matching).map(RecordedLogs::render).toList();
    }

    /**
     * The stack trace is part of the line, not something attached to it. Most of what these cases
     * assert is that a value never appears anywhere in the log, and a throwable is the likeliest way
     * one would arrive without anybody writing it: reading only the formatted message would let a
     * secret through inside a {@code caused by} and still report the assertion as passing.
     */
    private static String render(ILoggingEvent event) {
        IThrowableProxy failure = event.getThrowableProxy();

        return failure == null
                ? event.getFormattedMessage()
                : event.getFormattedMessage() + System.lineSeparator() + ThrowableProxyUtil.asString(failure);
    }

    private Logger root() {
        return (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
    }
}
