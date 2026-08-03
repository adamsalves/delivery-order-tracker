package dev.adamsalves.ordertracker.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.RequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@ExtendWith(OutputCaptureExtension.class)
@TestPropertySource(properties = "spring.datasource.url=jdbc:sqlite:./target/test-data/request-id.db")
class RequestIdTests {

    @Autowired
    private MockMvc mockMvc;

    /**
     * A refusal raised in the filter chain is the case the id has to survive: it is answered before
     * the dispatcher servlet, so a filter ordered behind security would never see the request. This
     * is what would notice if it stopped running first.
     */
    @Test
    void namesARequestRefusedBeforeItReachesTheApplication() throws Exception {
        mockMvc.perform(get("/api/orders"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().exists(RequestIdFilter.HEADER));
    }

    @Test
    void namesARequestItAnswers() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(header().exists(RequestIdFilter.HEADER));
    }

    @Test
    void givesEachRequestANameOfItsOwn() throws Exception {
        assertThat(idOf(get("/v3/api-docs"))).isNotEqualTo(idOf(get("/v3/api-docs")));
    }

    /**
     * The id is the API's own account of what it served, so it is minted here rather than taken from
     * whoever is asking. A caller that could name the request could write anything into the lines
     * that record it.
     */
    @Test
    void refusesToBeNamedByTheCaller() throws Exception {
        String supplied = "an-id-the-caller-chose";

        assertThat(idOf(get("/v3/api-docs").header(RequestIdFilter.HEADER, supplied)))
                .isNotEqualTo(supplied);
    }

    /**
     * Every other case here reads one end of the id or the other — the header on the way out, or the
     * message of a line — and none of them reads what was actually printed. That is the only place
     * the MDC key, the property name and Boot's pattern have to agree with each other, and none of
     * the three is checked by the compiler: a typo in any one leaves this suite green and the
     * console printing an empty pair of brackets.
     *
     * <p>The refused call is the one worth pinning, because it is the caller most likely to be
     * quoting an id back at someone and the line answering it is written inside the filter chain.
     */
    @Test
    void printsOnTheLineTheIdItHandedBack(CapturedOutput console) throws Exception {
        String requestId = idOf(get("/api/orders"));

        assertThat(console.getAll()).contains("[%s]".formatted(requestId));
    }

    private String idOf(RequestBuilder request) throws Exception {
        return mockMvc.perform(request).andReturn().getResponse().getHeader(RequestIdFilter.HEADER);
    }
}
