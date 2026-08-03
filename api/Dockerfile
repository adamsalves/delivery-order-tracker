FROM eclipse-temurin:21-jdk AS build
WORKDIR /build

# The project's own wrapper rather than a maven image, so the Maven that builds here is the one
# pinned in .mvn/wrapper and not a second version to keep in step with it.
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./

# Resolved before src/ arrives, so this layer survives every edit to the source and only a change to
# pom.xml pays for the tree again. A BuildKit cache mount would do it more finely, but it fails
# outright on the classic builder — which is what Docker falls back to when the buildx plugin is
# absent, and a machine that thin is exactly the one this image exists for.
RUN ./mvnw --batch-mode dependency:go-offline

COPY src/ src/

# Tests are skipped deliberately: all three suites run on the host, and dragging the test stack in
# here would cost minutes per build without covering anything that is not already covered.
RUN ./mvnw --batch-mode -DskipTests package


FROM eclipse-temurin:21-jre
WORKDIR /app

RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin app

# Created before anything is mounted over it, and owned by the user that runs. An empty named volume
# takes the ownership of the directory it covers from the image; without this it would arrive owned
# by root and the application could not write app.db into it.
RUN mkdir /app/data && chown app:app /app/data

# Matched by pattern and not by name, so a version bump in pom.xml does not have to be repeated here.
# Repackaging leaves one jar beside its .original, so the pattern stays unambiguous.
COPY --from=build --chown=app:app /build/target/*.jar app.jar

USER app
EXPOSE 8080

# spring.datasource.url is ./data/app.db, resolved against the working directory.
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
