package dev.adamsalves.ordertracker.support;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.List;
import java.util.function.Predicate;
import org.slf4j.LoggerFactory;

/**
 * Keeps what was written to the log while a test ran, so a case can be made about the lines the API
 * writes and — the ones worth a test here — about what those lines must never carry.
 */
public class RecordedLogs implements AutoCloseable {

    private final ListAppender<ILoggingEvent> recorded = new ListAppender<>();

    public RecordedLogs() {
        recorded.start();
        root().addAppender(recorded);
    }

    @Override
    public void close() {
        root().detachAppender(recorded);
        recorded.stop();
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
        return recorded.list.stream()
                .filter(matching)
                .map(ILoggingEvent::getFormattedMessage)
                .toList();
    }

    private Logger root() {
        return (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
    }
}
