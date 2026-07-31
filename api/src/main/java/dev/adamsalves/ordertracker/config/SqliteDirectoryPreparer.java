package dev.adamsalves.ordertracker.config;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.context.EnvironmentAware;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * The SQLite driver refuses to connect when the parent directory of the database file is missing,
 * and it never creates the directory itself.
 *
 * <p>This runs as a {@link BeanFactoryPostProcessor} so it executes during the context refresh,
 * before any singleton is instantiated and therefore before the {@code DataSource} and Hibernate
 * open the first connection. The environment arrives through {@link EnvironmentAware} because bean
 * factory post processors are created too early for constructor injection.
 */
@Component
class SqliteDirectoryPreparer implements BeanFactoryPostProcessor, EnvironmentAware {

    private static final String URL_PROPERTY = "spring.datasource.url";
    private static final String SQLITE_URL_PREFIX = "jdbc:sqlite:";
    private static final String IN_MEMORY_DATABASE = ":memory:";

    private Environment environment;

    @Override
    public void setEnvironment(Environment environment) {
        this.environment = environment;
    }

    @Override
    public void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) {
        String url = environment.getProperty(URL_PROPERTY, "");
        if (!url.startsWith(SQLITE_URL_PREFIX)) {
            return;
        }

        String databaseFile = url.substring(SQLITE_URL_PREFIX.length());
        if (databaseFile.isBlank() || databaseFile.startsWith(IN_MEMORY_DATABASE)) {
            return;
        }

        Path directory = Path.of(databaseFile).getParent();
        if (directory == null) {
            return;
        }

        try {
            Files.createDirectories(directory);
        } catch (IOException e) {
            throw new UncheckedIOException("Could not create the SQLite database directory " + directory, e);
        }
    }
}
